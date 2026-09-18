"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Shirt,
  CalendarDays,
  CalendarCheck,
  Tag,
  Users,
  Settings,
  Bell,
  Search,
  Plus,
  ArrowUpLeft,
  ArrowLeft,
  LogOut,
  Menu,
  RotateCcw,
  Check,
  SlidersHorizontal,
  Wallet,
  PackageCheck,
  Clock,
  MoreHorizontal,
} from "lucide-react";
import type {
  ShopData,
  Booking,
  Category,
  Dress,
  Customer,
  Offer,
} from "@/lib/types";
import {
  money,
  balance,
  itemStatus,
  inventoryStatus,
  labels,
} from "@/lib/domain";
import { logout, deleteRecord, transition, readNotice } from "@/app/actions";
import {
  Badge,
  Empty,
  Modal,
  SearchBox,
  SectionTitle,
  DressDrawing,
  SmallLink,
} from "./ui";
import { OfferForm } from "./offer-form";
import { BookingForm } from "./booking-form";
import { RecordForm, SettingsForm } from "./record-forms";
import { BookingDetail } from "./booking-detail";
import { AvailabilityView } from "./availability";
import { FittingsView } from "./fittings-view";
import { DressHistory } from "./dress-history";
type Page =
  | "home"
  | "dresses"
  | "categories"
  | "bookings"
  | "fittings"
  | "offers"
  | "customers"
  | "availability"
  | "returns"
  | "notifications"
  | "settings";
type Dialog =
  | {
      kind: "booking";
      existing?: Booking;
      preselect?: { id: string; date: string };
    }
  | {
      kind: "categories" | "dresses" | "customers";
      record?: Category | Dress | Customer;
    }
  | { kind: "offer"; offer?: Offer }
  | { kind: "delete"; table: string; id: string };
const nav = [
  { key: "home", label: "الرئيسية", icon: LayoutDashboard },
  { key: "dresses", label: "البدلات والفساتين", icon: Shirt },
  { key: "bookings", label: "الحجوزات", icon: CalendarDays },
  { key: "fittings", label: "مواعيد البروفا", icon: CalendarCheck },
  { key: "offers", label: "العروض والخصومات", icon: Tag },
  { key: "customers", label: "العميلات", icon: Users },
] as const;
const titles: Record<Page, string> = {
  home: "الرئيسية",
  dresses: "البدلات والفساتين",
  categories: "التصنيفات",
  bookings: "الحجوزات",
  fittings: "مواعيد البروفا",
  offers: "العروض والخصومات",
  customers: "العميلات",
  availability: "فحص توفر البدلات",
  returns: "تسجيل إرجاع",
  notifications: "مركز التنبيهات",
  settings: "إعدادات المتجر",
};
export function ShopApp({ data }: { data: ShopData }) {
  const [historyDress, setHistoryDress] = useState<Dress | null>(null);
  const router = useRouter();
  const [page, setPage] = useState<Page>("home");
  const [selected, setSelected] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [date, setDate] = useState("");
  const [place, setPlace] = useState("");
  const [mobile, setMobile] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    function sync() {
      const params = new URLSearchParams(location.hash.slice(1));
      const p = params.get("page");
      if (p === "dashboard") {
        setPage("home");
        history.replaceState(null, "", "#page=home");
      } else if (p && p in titles) setPage(p as Page);
      setSelected(params.get("booking"));
    }
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 60000);
    return () => clearInterval(timer);
  }, [router]);
  function go(p: Page) {
    setPage(p);
    setSelected(null);
    setQuery("");
    setCategory("");
    setStatus("");
    setDate("");
    setType("");
    setPlace("");
    setMobile(false);
    location.hash = `page=${p}`;
  }
  function open(id: string) {
    setPage("bookings");
    setSelected(id);
    location.hash = `page=bookings&booking=${id}`;
  }
  function done(message = "تم الحفظ بنجاح.") {
    setDialog(null);
    setToast(message);
    router.refresh();
  }
  function run(fn: () => Promise<void>) {
    setError("");
    startTransition(async () => {
      try {
        await fn();
        done();
      } catch (e) {
        setError(
          e instanceof Error && /[\u0600-\u06FF]/.test(e.message)
            ? e.message
            : "تعذر إتمام العملية.",
        );
      }
    });
  }
  const unread = data.notifications.filter((n) => !n.read_at).length;
  const active = data.bookings.filter((b) => b.status === "active");
  const allItems = data.bookings.flatMap((b) =>
    b.booking_items.map((i) => ({ ...i, booking: b })),
  );
  const outstanding = allItems.filter((i) =>
    ["delivered", "awaiting_return", "returned", "cleaning"].includes(i.status),
  );
  const late = allItems.filter((i) => itemStatus(i, data.today) === "late");
  const fittingsToday = data.fittings.filter(
    (f) =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: data.settings.timezone,
      }).format(new Date(f.scheduled_at)) === data.today &&
      f.status === "scheduled",
  );
  const deliveries = allItems.filter(
    (i) =>
      i.delivery_date === data.today &&
      ["reserved", "ready_for_delivery"].includes(i.status),
  );
  const returns = allItems.filter(
    (i) =>
      i.expected_return_date === data.today &&
      !i.actual_return_date &&
      i.active,
  );
  const available = data.dresses.filter(
    (d) =>
      d.visible &&
      ![
        "cleaning",
        "out_of_service",
        "delivered",
        "awaiting_return",
        "late",
        "returned",
      ].includes(d.status) &&
      !allItems.some(
        (i) =>
          i.dress_id === d.id &&
          i.active &&
          i.blocked_from <= data.today &&
          i.blocked_until >= data.today,
      ),
  );
  const selectedBooking = data.bookings.find((b) => b.id === selected);
  const filteredBookings = data.bookings.filter(
    (b) =>
      `${b.customer_name} ${b.customer_phone} ${b.booking_items.map((i) => i.dress_code + " " + i.dress_name).join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (!status || b.status === status) &&
      (!type || b.customer_type === type) &&
      (!date || b.event_date === date) &&
      (!place || `${b.customer_city} ${b.customer_town}`.includes(place)),
  );
  const search = <SearchBox value={query} onChange={setQuery} />;
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <a className="wordmark" href="#page=home" onClick={() => go("home")}>
          Dress<span>Flow</span>
          <i>✦</i>
        </a>
        <p className="sidebar-caption">كل التفاصيل، في مكان واحد</p>
        <div className="shop-chip">
          {data.tenant.logo_url ? (
            <img src={data.tenant.logo_url} alt="شعار المتجر" />
          ) : (
            <span>✦</span>
          )}
          <div>
            <b>{data.tenant.name}</b>
            <small>مساحة إدارة المتجر</small>
          </div>
          <span className="online-dot" />
        </div>
        <p className="nav-caption">مساحة العمل</p>
        <nav>
          {nav.map((n) => (
            <button
              key={n.key}
              className={page === n.key ? "active" : ""}
              onClick={() => go(n.key)}
            >
              <n.icon size={19} />
              <span>{n.label}</span>
              {n.key === "bookings" && active.length > 0 && (
                <small>{active.length}</small>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            onClick={() => go("settings")}
            className={page === "settings" ? "active" : ""}
          >
            <Settings size={19} /> إعدادات المتجر
          </button>
          <form action={logout}>
            <button>
              <LogOut size={18} /> تسجيل الخروج
            </button>
          </form>
          <div className="user-chip">
            <span>{data.tenant.owner_name.slice(0, 1)}</span>
            <div>
              <b>{data.tenant.owner_name}</b>
              <small>مدير المتجر</small>
            </div>
          </div>
        </div>
      </aside>
      {mobile && (
        <button
          className="sidebar-overlay"
          aria-label="إغلاق القائمة"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="workspace">
        <header className="topbar">
          <div className="title-actions">
            <button
              className="icon-button mobile-menu"
              aria-label="القائمة"
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb">
              مساحة العمل <span>/</span> <b>{titles[page]}</b>
            </span>
          </div>
          <div className="topbar-actions">
            <span className="top-date">
              {new Date(data.today + "T12:00:00Z").toLocaleDateString("ar-PS", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            <button
              className="notification-button icon-button"
              aria-label={`التنبيهات، ${unread} غير مقروء`}
              onClick={() => go("notifications")}
            >
              <Bell size={20} />
              {unread > 0 && <span>{unread > 99 ? "99+" : unread}</span>}
            </button>
            <span className="avatar">{data.tenant.owner_name.slice(0, 1)}</span>
          </div>
        </header>
        <main className="main-content">
          {error && (
            <div className="alert" role="alert">
              {error}
              <button className="text-button" onClick={() => setError("")}>
                إغلاق
              </button>
            </div>
          )}
          {page === "home" && (
            <>
              <SectionTitle
                title={`أهلاً ${data.tenant.owner_name.split(" ")[0]}، يومك أجمل بترتيبك ✦`}
                description="نظرة سريعة على متجرك، وكل ما يحتاج اهتمامك اليوم."
              >
                <button onClick={() => go("availability")}>
                  <Search size={17} />
                  فحص توفر
                </button>
                <button
                  className="primary"
                  onClick={() => setDialog({ kind: "booking" })}
                >
                  <Plus size={18} />
                  حجز جديد
                </button>
              </SectionTitle>
              {page === "home" && (
                <section className="welcome-banner">
                  <div>
                    <span className="mini-tag">كل لحظة تستحق الاهتمام</span>
                    <h2>
                      مساحة منظّمة.
                      <br />
                      تجربة لا تُنسى.
                    </h2>
                    <p>
                      حجوزاتك، فساتينك ومواعيدك…
                      <br />
                      كل التفاصيل الصغيرة التي تصنع يوماً مميزاً.
                    </p>
                    <button onClick={() => setDialog({ kind: "booking" })}>
                      لنرتّب المناسبة القادمة <ArrowLeft size={17} />
                    </button>
                  </div>
                  <div className="banner-illustration">
                    <span className="orbit one" />
                    <span className="orbit two" />
                    <div className="illustration-dress">
                      <DressDrawing />
                    </div>
                    <span className="floating-tag">
                      <Check size={15} /> كل التفاصيل تحت السيطرة
                    </span>
                    <span className="spark s1">✦</span>
                    <span className="spark s2">✧</span>
                  </div>
                </section>
              )}
              <div className="stats-grid">
                <Stat
                  label="الحجوزات النشطة"
                  value={active.length}
                  sub="حجوزات قيد المتابعة"
                  icon={<CalendarDays size={21} />}
                  color="purple"
                />
                <Stat
                  label="القطع المتاحة"
                  value={available.length}
                  sub="جاهزة للحجز اليوم"
                  icon={<Shirt size={21} />}
                  color="green"
                />
                <Stat
                  label="بروفات اليوم"
                  value={fittingsToday.length}
                  sub="مواعيد تستحق الاستعداد"
                  icon={<CalendarCheck size={21} />}
                  color="gold"
                />
                <Stat
                  label="إرجاعات متأخرة"
                  value={late.length}
                  sub={
                    late.length ? "تحتاج إلى المتابعة" : "كل شيء يسير بانتظام"
                  }
                  icon={<Clock size={21} />}
                  color="rose"
                />
              </div>
              <div className="dashboard-columns">
                <section className="panel today-panel">
                  <div className="panel-heading">
                    <h3>
                      على جدولك اليوم{" "}
                      <span className="count">
                        {fittingsToday.length +
                          deliveries.length +
                          returns.length}
                      </span>
                    </h3>
                    <SmallLink onClick={() => go("fittings")}>
                      عرض المواعيد
                    </SmallLink>
                  </div>
                  <div className="today-tabs">
                    <span>
                      <i className="dot purple" /> البروفات{" "}
                      {fittingsToday.length}
                    </span>
                    <span>
                      <i className="dot green" /> التسليم {deliveries.length}
                    </span>
                    <span>
                      <i className="dot gold" /> الإرجاع {returns.length}
                    </span>
                  </div>
                  {!fittingsToday.length &&
                  !deliveries.length &&
                  !returns.length ? (
                    <Empty
                      title="يوم هادئ، وبدايات جديدة"
                      description="لا توجد مواعيد تسليم أو إرجاع أو بروفة اليوم."
                    />
                  ) : (
                    <div className="agenda">
                      {fittingsToday.map((f) => (
                        <button key={f.id} onClick={() => open(f.booking_id)}>
                          <span className="agenda-icon purple">
                            <CalendarCheck size={19} />
                          </span>
                          <div>
                            <b>
                              {
                                data.bookings.find((b) => b.id === f.booking_id)
                                  ?.customer_name
                              }
                            </b>
                            <small>موعد بروفة</small>
                          </div>
                          <time>
                            {new Date(f.scheduled_at).toLocaleTimeString(
                              "ar-PS",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                                timeZone: data.settings.timezone,
                              },
                            )}
                          </time>
                          <ArrowUpLeft size={17} />
                        </button>
                      ))}
                      {[...deliveries, ...returns].map((i, index) => (
                        <button
                          key={i.id + index}
                          onClick={() => open(i.booking_id)}
                        >
                          <span className="agenda-icon green">
                            <PackageCheck size={19} />
                          </span>
                          <div>
                            <b>{i.booking.customer_name}</b>
                            <small>
                              {i.dress_code} ·{" "}
                              {index < deliveries.length
                                ? "تسليم قطعة"
                                : "إرجاع قطعة"}
                            </small>
                          </div>
                          <ArrowUpLeft size={17} />
                        </button>
                      ))}
                    </div>
                  )}
                </section>
                <section className="panel quick-panel">
                  <h3>خطوة واحدة تكفي</h3>
                  <p className="muted">اختصارات ليوم عمل أسهل</p>
                  <div className="quick-grid">
                    <button onClick={() => setDialog({ kind: "booking" })}>
                      <CalendarDays />
                      <span>حجز جديد</span>
                      <small>مناسبة جديدة، تفاصيل جديدة</small>
                    </button>
                    <button onClick={() => go("availability")}>
                      <Search />
                      <span>فحص توفر</span>
                      <small>القطعة المناسبة في وقتها</small>
                    </button>
                    <button onClick={() => setDialog({ kind: "dresses" })}>
                      <Plus />
                      <span>إضافة قطعة</span>
                      <small>إطلالة جديدة لمجموعتك</small>
                    </button>
                    <button onClick={() => go("returns")}>
                      <RotateCcw />
                      <span>تسجيل إرجاع</span>
                      <small>استلام وتنظيف وتجهيز</small>
                    </button>
                  </div>
                </section>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <h3>الحجوزات القادمة</h3>
                  <SmallLink onClick={() => go("bookings")}>
                    جميع الحجوزات
                  </SmallLink>
                </div>
                <BookingTable
                  bookings={active
                    .filter((b) => b.event_date >= data.today)
                    .sort((a, b) => a.event_date.localeCompare(b.event_date))
                    .slice(0, 5)}
                  onOpen={open}
                />
              </section>
              {page === "home" && (
                <>
                  <div className="stats-grid financial-stats">
                    <Stat
                      label="إجمالي قيمة الحجوزات"
                      value={money(
                        data.bookings
                          .filter((b) => b.status !== "cancelled")
                          .reduce((s, b) => s + Number(b.agreed_total), 0),
                      )}
                      sub="الحجوزات غير الملغاة"
                      icon={<Wallet />}
                      color="purple"
                    />
                    <Stat
                      label="إجمالي المدفوع"
                      value={money(
                        data.bookings.reduce(
                          (s, b) =>
                            s +
                            b.payments.reduce(
                              (x, p) => x + Number(p.amount),
                              0,
                            ),
                          0,
                        ),
                      )}
                      sub="جميع الدفعات المسجلة"
                      icon={<Check />}
                      color="green"
                    />
                    <Stat
                      label="الأرصدة المستحقة"
                      value={money(
                        data.bookings
                          .filter((b) => b.status !== "cancelled")
                          .reduce((s, b) => s + balance(b), 0),
                      )}
                      sub="محسوبة من سجل الدفعات"
                      icon={<Wallet />}
                      color="gold"
                    />
                    <Stat
                      label="القطع المسلّمة"
                      value={
                        outstanding.filter((i) => !i.actual_return_date).length
                      }
                      sub="بانتظار الإرجاع"
                      icon={<PackageCheck />}
                      color="rose"
                    />
                  </div>
                  <div className="panel">
                    <h3>المتابعات القادمة</h3>
                    <p>
                      بروفات قادمة:{" "}
                      {
                        data.fittings.filter(
                          (f) =>
                            f.status === "scheduled" &&
                            f.scheduled_at >= data.today,
                        ).length
                      }
                    </p>
                    <p>
                      تسليمات قادمة:{" "}
                      {
                        allItems.filter(
                          (i) =>
                            i.active &&
                            i.delivery_date >= data.today &&
                            ["reserved", "ready_for_delivery"].includes(
                              i.status,
                            ),
                        ).length
                      }
                    </p>
                    <p>
                      إرجاعات قادمة:{" "}
                      {
                        allItems.filter(
                          (i) =>
                            i.active &&
                            !i.actual_return_date &&
                            i.expected_return_date >= data.today,
                        ).length
                      }
                    </p>
                    <p>
                      قطع محجوزة اليوم:{" "}
                      {
                        new Set(
                          allItems
                            .filter(
                              (i) =>
                                i.active &&
                                i.blocked_from <= data.today &&
                                i.blocked_until >= data.today,
                            )
                            .map((i) => i.dress_id),
                        ).size
                      }
                    </p>
                  </div>
                </>
              )}
              <div className="bottom-note">
                <span className="online-dot" /> جميع بيانات متجرك محفوظة بأمان{" "}
                <span>نظام حجز وتأجير البدلات والفساتين</span>
              </div>
            </>
          )}
          {page === "dresses" && (
            <>
              <SectionTitle
                title="البدلات والفساتين"
                description="مجموعتك المميزة، جاهزة لكل مناسبة."
              >
                <button onClick={() => go("categories")}>
                  إدارة التصنيفات
                </button>
                <button
                  className="primary"
                  onClick={() => setDialog({ kind: "dresses" })}
                >
                  <Plus size={18} />
                  إضافة بدلة / فستان
                </button>
              </SectionTitle>
              <div className="toolbar">
                {search}
                <select
                  aria-label="التصنيف"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">كل التصنيفات</option>
                  {data.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="الحالة"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">كل الحالات</option>
                  {[
                    "available",
                    "reserved",
                    "delivered",
                    "cleaning",
                    "out_of_service",
                    "hidden",
                  ].map((s) => (
                    <option key={s} value={s}>
                      {s === "hidden" ? "مخفية" : labels[s]}
                    </option>
                  ))}
                </select>
              </div>
              {!data.dresses.length ? (
                <Empty
                  title="ابدئي بإضافة مجموعتك"
                  description="أضيفي أول قطعة مع رمزها وسعرها وصورتها."
                  action={
                    <button
                      className="primary"
                      onClick={() => setDialog({ kind: "dresses" })}
                    >
                      إضافة قطعة
                    </button>
                  }
                />
              ) : (
                <div className="dress-grid">
                  {data.dresses
                    .filter(
                      (d) =>
                        `${d.name} ${d.code}`
                          .toLowerCase()
                          .includes(query.toLowerCase()) &&
                        (!category || d.category_id === category) &&
                        (!status ||
                          (status === "hidden"
                            ? !d.visible
                            : inventoryStatus(d, allItems, data.today) ===
                              status)),
                    )
                    .map((d) => (
                      <article className="dress-card" key={d.id}>
                        <div className="dress-image">
                          {d.image_url ? (
                            <img src={d.image_url} alt={d.name} />
                          ) : (
                            <DressDrawing />
                          )}
                          <Badge
                            status={
                              !d.visible
                                ? "مخفية"
                                : inventoryStatus(d, allItems, data.today)
                            }
                          />
                          <button
                            className="icon-button image-menu"
                            aria-label={`تعديل ${d.name}`}
                            onClick={() =>
                              setDialog({ kind: "dresses", record: d })
                            }
                          >
                            <MoreHorizontal size={19} />
                          </button>
                        </div>
                        <div className="dress-body">
                          <small>
                            {
                              data.categories.find(
                                (c) => c.id === d.category_id,
                              )?.name
                            }{" "}
                            · {d.code}
                          </small>
                          <h3>{d.name}</h3>
                          <div className="dress-meta">
                            <span>
                              {d.color || "—"} · {d.size || "—"}
                            </span>
                            <b>{money(d.default_price)}</b>
                          </div>
                          <div className="card-actions">
                            <button onClick={() => setHistoryDress(d)}>
                              مين استأجرها؟
                            </button>
                            <button
                              onClick={() =>
                                setDialog({
                                  kind: "booking",
                                  preselect: { id: d.id, date: data.today },
                                })
                              }
                              disabled={!d.visible}
                            >
                              حجز القطعة
                            </button>
                            <button
                              className="text-button danger"
                              onClick={() =>
                                setDialog({
                                  kind: "delete",
                                  table: "dresses",
                                  id: d.id,
                                })
                              }
                            >
                              حذف
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                </div>
              )}
            </>
          )}
          {page === "categories" && (
            <>
              <SectionTitle
                title="التصنيفات"
                description="تصنيفات خاصة بمتجرك، قابلة للإظهار والإخفاء."
              >
                <button
                  className="primary"
                  onClick={() => setDialog({ kind: "categories" })}
                >
                  <Plus size={18} />
                  إضافة تصنيف
                </button>
              </SectionTitle>
              <div className="category-grid">
                {data.categories.map((c) => (
                  <article className="panel category-card" key={c.id}>
                    {c.image_url ? (
                      <img src={c.image_url} alt={c.name} />
                    ) : (
                      <Shirt size={35} />
                    )}
                    <h3>{c.name}</h3>
                    <p>
                      {
                        data.dresses.filter((d) => d.category_id === c.id)
                          .length
                      }{" "}
                      قطع · {c.visible ? "ظاهر" : "مخفي"}
                    </p>
                    <button
                      onClick={() =>
                        setDialog({ kind: "categories", record: c })
                      }
                    >
                      تعديل
                    </button>
                    <button
                      className="text-button danger"
                      onClick={() =>
                        setDialog({
                          kind: "delete",
                          table: "categories",
                          id: c.id,
                        })
                      }
                    >
                      حذف
                    </button>
                  </article>
                ))}
              </div>
            </>
          )}
          {page === "bookings" && (
            <>
              {selectedBooking ? (
                <>
                  <button
                    className="text-button"
                    onClick={() => go("bookings")}
                  >
                    → العودة إلى الحجوزات
                  </button>
                  <BookingDetail
                    booking={selectedBooking}
                    data={data}
                    onEdit={() =>
                      setDialog({ kind: "booking", existing: selectedBooking })
                    }
                    notify={done}
                  />
                </>
              ) : (
                <>
                  <SectionTitle
                    title="الحجوزات"
                    description="كل مناسبة، في ملف واحد متكامل."
                  >
                    <button
                      className="primary"
                      onClick={() => setDialog({ kind: "booking" })}
                    >
                      <Plus size={18} />
                      حجز جديد
                    </button>
                  </SectionTitle>
                  <div className="toolbar">
                    {search}
                    <select
                      aria-label="حالة الحجز"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="">كل الحالات</option>
                      {["active", "completed", "cancelled"].map((s) => (
                        <option key={s} value={s}>
                          {labels[s]}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="نوع العميلة"
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                    >
                      <option value="">عروس / مرافقة</option>
                      <option value="bride">عروس</option>
                      <option value="companion">مرافقة</option>
                    </select>
                    <input
                      aria-label="تاريخ المناسبة"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                    <input
                      aria-label="العنوان"
                      placeholder="العنوان"
                      value={place}
                      onChange={(e) => setPlace(e.target.value)}
                    />
                  </div>
                  <section className="panel">
                    <BookingTable bookings={filteredBookings} onOpen={open} />
                  </section>
                </>
              )}
            </>
          )}
          {page === "availability" && (
            <>
              <SectionTitle
                title="فحص توفر البدلات"
                description="توفر فعلي يعتمد على الفترة المحجوزة وجاهزية القطعة."
              />
              <AvailabilityView
                data={data}
                onBook={(id, date) =>
                  setDialog({ kind: "booking", preselect: { id, date } })
                }
              />
            </>
          )}
          {page === "fittings" && (
            <>
              <SectionTitle
                title="مواعيد البروفا"
                description="وقت مخصص لكل عروس، وكل تفصيلة."
              />
              <FittingsView data={data} onOpen={open} />
            </>
          )}
          {page === "offers" && (
            <>
              <SectionTitle
                title="العروض والخصومات"
                description="عروض تلقائية مع حرية الاتفاق على السعر النهائي."
              >
                <button
                  className="primary"
                  onClick={() => setDialog({ kind: "offer" })}
                >
                  <Plus size={18} />
                  إضافة عرض
                </button>
              </SectionTitle>
              {!data.offers.length ? (
                <Empty
                  title="امنحي مناسباتك عرضاً مميزاً"
                  description="أضيفي خصماً أو باقة لتطبيقها تلقائياً على الحجوزات المؤهلة."
                />
              ) : (
                <div className="category-grid">
                  {data.offers.map((o) => (
                    <article className="panel offer-card" key={o.id}>
                      <Tag size={26} />
                      <Badge status={o.active ? "active" : "غير فعّال"} />
                      <h3>{o.name}</h3>
                      <strong>
                        {o.kind === "percentage"
                          ? `${o.value}٪`
                          : money(o.value)}
                      </strong>
                      <p>
                        {labels[o.kind]} · {o.min_items} قطع على الأقل
                      </p>
                      <small>
                        {o.starts_on} ← {o.ends_on}
                      </small>
                      <button
                        className="full"
                        onClick={() => setDialog({ kind: "offer", offer: o })}
                      >
                        تعديل العرض / إيقافه
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
          {page === "customers" && (
            <>
              <SectionTitle
                title="العميلات"
                description="علاقة تتجدد مع كل مناسبة."
              >
                <button
                  className="primary"
                  onClick={() => setDialog({ kind: "customers" })}
                >
                  <Plus size={18} />
                  إضافة عميلة
                </button>
              </SectionTitle>
              <div className="toolbar">{search}</div>
              <div className="panel table-wrap">
                {!data.customers.length ? (
                  <Empty
                    title="لا توجد عميلات بعد"
                    description="تُحفظ العميلة تلقائياً عند إنشاء حجزها الأول."
                  />
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>الاسم</th>
                        <th>الهاتف</th>
                        <th>العنوان</th>
                        <th>الحجوزات</th>
                        <th>الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.customers
                        .filter((c) => `${c.name} ${c.phone}`.includes(query))
                        .map((c) => (
                          <tr key={c.id}>
                            <td>
                              <b>{c.name}</b>
                            </td>
                            <td dir="ltr">{c.phone}</td>
                            <td>{c.town || c.city || "—"}</td>
                            <td>
                              {
                                data.bookings.filter(
                                  (b) => b.customer_id === c.id,
                                ).length
                              }
                            </td>
                            <td>
                              <button
                                className="text-button"
                                onClick={() =>
                                  setDialog({ kind: "customers", record: c })
                                }
                              >
                                تعديل
                              </button>
                              <button
                                className="text-button danger"
                                onClick={() =>
                                  setDialog({
                                    kind: "delete",
                                    table: "customers",
                                    id: c.id,
                                  })
                                }
                              >
                                حذف
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
          {page === "returns" && (
            <>
              <SectionTitle
                title="تسجيل إرجاع"
                description="استلام كل قطعة، ثم تنظيفها وتجهيزها للحجز التالي."
              />
              <div className="toolbar">{search}</div>
              <section className="panel">
                {!outstanding.length ? (
                  <Empty title="لا توجد قطع بانتظار المتابعة" />
                ) : (
                  outstanding
                    .filter((i) =>
                      `${i.booking.customer_name} ${i.booking.customer_phone} ${i.dress_code}`.includes(
                        query,
                      ),
                    )
                    .map((i) => (
                      <div className="rental-row" key={i.id}>
                        <div>
                          <b>
                            {i.dress_name} · {i.dress_code}
                          </b>
                          <p>
                            {i.booking.customer_name} ·{" "}
                            {i.booking.customer_phone}
                          </p>
                        </div>
                        <div>
                          <Badge status={itemStatus(i, data.today)} />
                          <p>الإرجاع المتوقع {i.expected_return_date}</p>
                        </div>
                        <div className="title-actions">
                          <button
                            className="text-button"
                            onClick={() => open(i.booking_id)}
                          >
                            ملف الحجز
                          </button>
                          <button
                            className="primary"
                            disabled={pending}
                            onClick={() =>
                              run(() =>
                                transition(
                                  i.id,
                                  i.status === "returned"
                                    ? "cleaning"
                                    : i.status === "cleaning"
                                      ? "available"
                                      : "returned",
                                ),
                              )
                            }
                          >
                            {i.status === "returned"
                              ? "نقل إلى التنظيف"
                              : i.status === "cleaning"
                                ? "جاهزة ومتاحة"
                                : "تم استلام البدلة"}
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </section>
            </>
          )}
          {page === "notifications" && (
            <>
              <SectionTitle
                title="مركز التنبيهات"
                description="المواعيد المهمة والمتابعات، في مكان واحد."
              >
                <button
                  disabled={pending || !unread}
                  onClick={() => run(() => readNotice(null))}
                >
                  تحديد الكل كمقروء
                </button>
              </SectionTitle>
              <section className="panel">
                {!data.notifications.length ? (
                  <Empty title="لا توجد تنبيهات جديدة" />
                ) : (
                  data.notifications.map((n) => (
                    <div
                      className={`notification-row ${!n.read_at ? "unread" : ""}`}
                      key={n.id}
                    >
                      <Bell size={19} />
                      <div>
                        <b>{n.message}</b>
                        <small>
                          {new Date(n.created_at).toLocaleString("ar-PS", {
                            timeZone: data.settings.timezone,
                          })}
                        </small>
                      </div>
                      <div className="title-actions">
                        {n.booking_id && (
                          <button
                            className="text-button"
                            onClick={() => open(n.booking_id!)}
                          >
                            عرض الحجز
                          </button>
                        )}
                        {!n.read_at && (
                          <button
                            disabled={pending}
                            className="icon-button"
                            aria-label="تحديد كمقروء"
                            onClick={() => run(() => readNotice(n.id))}
                          >
                            <Check size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </section>
            </>
          )}
          {page === "settings" && (
            <>
              <SectionTitle
                title="إعدادات المتجر"
                description="إعدادات تناسب طريقة عملك."
              />
              <SettingsForm data={data} notify={done} />
            </>
          )}
        </main>
      </div>
      {historyDress && (
        <Modal
          title={`سجل تأجير ${historyDress.name}`}
          onClose={() => setHistoryDress(null)}
        >
          <DressHistory
            dress={historyDress}
            data={data}
            onOpen={(id) => {
              setHistoryDress(null);
              open(id);
            }}
          />
        </Modal>
      )}
      {dialog && (
        <Modal
          wide={dialog.kind === "booking"}
          title={
            dialog.kind === "booking"
              ? dialog.existing
                ? "تعديل الحجز"
                : "حجز جديد"
              : dialog.kind === "offer"
                ? "العروض والخصومات"
                : dialog.kind === "delete"
                  ? "تأكيد الحذف"
                  : dialog.kind === "dresses"
                    ? "بيانات البدلة / الفستان"
                    : dialog.kind === "categories"
                      ? "بيانات التصنيف"
                      : "بيانات العميلة"
          }
          onClose={() => setDialog(null)}
        >
          {dialog.kind === "booking" ? (
            <BookingForm
              data={data}
              existing={dialog.existing}
              preselect={dialog.preselect}
              onSaved={(id) => {
                done("تم حفظ الحجز بنجاح.");
                open(id);
              }}
            />
          ) : dialog.kind === "offer" ? (
            <OfferForm
              data={data}
              offer={dialog.offer}
              onSaved={() => done()}
            />
          ) : dialog.kind === "delete" ? (
            <>
              <p>
                هل تريد حذف هذا السجل؟ لا يمكن حذف سجل مرتبط بحجوزات أو سجلات
                أخرى. يمكنك إخفاء القطعة أو التصنيف للاحتفاظ بالتاريخ.
              </p>
              <button
                className="danger"
                disabled={pending}
                onClick={() => run(() => deleteRecord(dialog.table, dialog.id))}
              >
                تأكيد الحذف
              </button>
              {error && <p className="alert">{error}</p>}
            </>
          ) : (
            <RecordForm
              kind={dialog.kind}
              record={dialog.record}
              data={data}
              onSaved={() => done()}
            />
          )}
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}
    </div>
  );
}
function Stat({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string;
  value: number | string;
  sub: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <article className="stat-card">
      <div>
        <span>{label}</span>
        <strong>
          {typeof value === "number" ? value.toLocaleString("ar-PS") : value}
        </strong>
        <small>{sub}</small>
      </div>
      <span className={`stat-icon ${color}`}>{icon}</span>
    </article>
  );
}
function BookingTable({
  bookings,
  onOpen,
}: {
  bookings: Booking[];
  onOpen: (id: string) => void;
}) {
  return bookings.length ? (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>الحجز / العميلة</th>
            <th>المناسبة</th>
            <th>القطع المستأجرة</th>
            <th>المتفق عليه</th>
            <th>المدفوع</th>
            <th>المتبقي</th>
            <th>الحالة</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => (
            <tr key={b.id}>
              <td>
                <button className="table-name" onClick={() => onOpen(b.id)}>
                  {b.customer_name}
                </button>
                <small>
                  #{b.number} · {b.customer_phone}
                </small>
              </td>
              <td>
                {b.event_date}
                <small>{labels[b.customer_type]}</small>
              </td>
              <td>
                <details>
                  <summary>{b.booking_items.length} قطع</summary>
                  {b.booking_items.map((i) => (
                    <small key={i.id}>
                      {i.dress_code} — {i.dress_name}
                    </small>
                  ))}
                </details>
              </td>
              <td>{money(b.agreed_total)}</td>
              <td>{money(Number(b.agreed_total) - balance(b))}</td>
              <td className={balance(b) > 0 ? "text-rose" : "success"}>
                {money(balance(b))}
              </td>
              <td>
                <Badge status={b.status} />
              </td>
              <td>
                <button
                  className="icon-button"
                  aria-label={`فتح حجز ${b.customer_name}`}
                  onClick={() => onOpen(b.id)}
                >
                  <ArrowUpLeft size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty
      title="لا توجد حجوزات لعرضها"
      description="أضيفي حجزاً جديداً أو غيّري خيارات البحث."
    />
  );
}
