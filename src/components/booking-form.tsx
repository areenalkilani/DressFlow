"use client";
import { PriceInput } from "./price-input";
import { useEffect, useState } from "react";
import { Plus, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";
import { previewBooking, saveBooking } from "@/app/actions";
import { money, shiftDate } from "@/lib/domain";
import type {
  ShopData,
  Booking,
  RentalInput,
  Quote,
  Availability,
} from "@/lib/types";
import { SearchBox } from "./ui";
const cleanPhone = (value: string) => {
  let result = value.replace(/[^\d+]/g, "");
  if (/^00(?:970|972)5\d{8}$/.test(result)) result = `+${result.slice(2)}`;
  if (/^(?:970|972)5\d{8}$/.test(result)) result = `+${result}`;
  if (/^0?5\d{8}$/.test(result))
    result = `${/^0?(?:56|59)/.test(result) ? "+970" : "+972"}${result.replace(/^0/, "")}`;
  return result;
};
export function BookingForm({
  data,
  existing,
  preselect,
  onSaved,
}: {
  data: ShopData;
  existing?: Booking;
  preselect?: { id: string; date: string };
  onSaved: (id: string) => void;
}) {
  const [name, setName] = useState(existing?.customer_name || "");
  const [phone, setPhone] = useState(existing?.customer_phone || "");
  const [secondary, setSecondary] = useState(existing?.secondary_phone || "");
  const [city, setCity] = useState(existing?.customer_city || "");
  const [town, setTown] = useState(
    existing?.customer_town || existing?.customer_city || "",
  );
  const [type, setType] = useState(existing?.customer_type || "bride");
  const [event, setEvent] = useState(
    existing?.event_date || preselect?.date || data.today,
  );
  const [notes, setNotes] = useState(existing?.notes || "");
  const [items, setItems] = useState<RentalInput[]>(
    existing?.booking_items
      .filter((i) => i.status !== "cancelled")
      .map((i) => ({
        dress_id: i.dress_id,
        price: Number(i.price),
        blocked_from: i.blocked_from,
        blocked_until: i.blocked_until,
        delivery_date: i.delivery_date,
        expected_return_date: i.expected_return_date,
      })) || (preselect ? [{ dress_id: preselect.id }] : []),
  );
  const [agreed, setAgreed] = useState(
    existing ? String(existing.agreed_total) : "",
  );
  const [deposit, setDeposit] = useState("");
  const [fittingDate, setFittingDate] = useState(() => {
    const fitting = data.fittings.find((f) => f.booking_id === existing?.id);
    if (!fitting) return "";
    const at = new Date(fitting.scheduled_at);
    return new Date(at.getTime() - at.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  });
  const [search, setSearch] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [checkError, setCheckError] = useState("");
  useEffect(() => {
    let current = true;
    if (!items.length) {
      setQuote(null);
      setAvailability([]);
      setChecking(false);
      return;
    }
    setChecking(true);
    const timer = setTimeout(() => {
      previewBooking(items, event, town, type, existing?.id)
        .then((r) => {
          if (current) {
            setQuote(r.quote);
            setAvailability(r.availability);
            setCheckError("");
          }
        })
        .catch((e) => {
          if (current)
            setCheckError(
              e instanceof Error && /[\u0600-\u06FF]/.test(e.message)
                ? e.message
                : "تعذر فحص التوفر. تحقق من الاتصال ثم أعد المحاولة.",
            );
        })
        .finally(() => {
          if (current) setChecking(false);
        });
    }, 350);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [items, event, town, type, existing?.id]);
  const blocked = availability.some((a) => a.conflict || a.unready);
  const total =
    agreed !== "" ? Number(agreed) : Number(quote?.calculated_total || 0);
  const paid =
    existing?.payments.reduce((s, p) => s + Number(p.amount), 0) ||
    Number(deposit) ||
    0;
  function patchItem(index: number, patch: Partial<RentalInput>) {
    setItems((v) =>
      v.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }
  function customer(id: string) {
    const c = data.customers.find((c) => c.id === id);
    if (c) {
      setName(c.name);
      setPhone(c.phone);
      setSecondary(c.secondary_phone);
      setCity(c.city);
      setTown(c.town || c.city);
    }
  }
  return (
    <form
      className="booking-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          const id = await saveBooking({
            id: existing?.id,
            name,
            phone,
            secondary_phone: secondary,
            city,
            town,
            customer_type: type,
            event_date: event,
            notes,
            items,
            agreed_total: agreed !== "" ? Number(agreed) : undefined,
            deposit: deposit ? Number(deposit) : undefined,
            fitting_at:
              type === "bride" && fittingDate
                ? new Date(fittingDate).toISOString()
                : undefined,
          });
          onSaved(id);
        } catch (e) {
          setError(
            e instanceof Error && /[\u0600-\u06FF]/.test(e.message)
              ? e.message
              : "تعذر حفظ الحجز.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="booking-main">
        <section className="form-section">
          <h3>
            <span className="step">١</span> معلومات العميلة والمناسبة
          </h3>
          <label>
            اختيار عميلة سابقة
            <select defaultValue="" onChange={(e) => customer(e.target.value)}>
              <option value="">عميلة جديدة / إدخال يدوي</option>
              {data.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.phone}
                </option>
              ))}
            </select>
          </label>
          <div className="form-grid">
            <label>
              الاسم الكامل
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              نوع الحجز
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="bride">عروس</option>
                <option value="companion">مرافقة</option>
              </select>
            </label>
            <label>
              رقم الهاتف الأساسي
              <input
                required
                placeholder="0591234567 أو 591234567"
                inputMode="tel"
                dir="ltr"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={() => setPhone(cleanPhone(phone))}
              />
            </label>
            <label>
              رقم هاتف إضافي
              <input
                dir="ltr"
                type="tel"
                placeholder="اختياري"
                inputMode="tel"
                value={secondary}
                onChange={(e) => setSecondary(e.target.value)}
                onBlur={() =>
                  setSecondary(secondary ? cleanPhone(secondary) : "")
                }
              />
            </label>
            <label>
              العنوان
              <input value={town} onChange={(e) => setTown(e.target.value)} />
            </label>
            <label>
              تاريخ المناسبة
              <input
                type="date"
                required
                value={event}
                onChange={(e) => setEvent(e.target.value)}
              />
            </label>
            {type === "bride" && (
              <label>
                موعد البروفة (اختياري)
                <input
                  type="datetime-local"
                  value={fittingDate}
                  onChange={(e) => setFittingDate(e.target.value)}
                />
                <small>
                  المقترح:{" "}
                  {shiftDate(event, -data.settings.fitting_days_before_event)}{" "}
                  الساعة ١٢:٠٠ بتوقيت المتجر. الوقت اليدوي بتوقيت جهازك.
                </small>
              </label>
            )}
          </div>
        </section>
        <section className="form-section">
          <h3>
            <span className="step">٢</span> البدلات والفساتين المستأجرة{" "}
            <small>{items.length} قطع</small>
          </h3>
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="ابحث عن قطعة بالاسم أو الرمز لإضافتها…"
          />
          <div className="item-picker">
            {data.dresses
              .filter(
                (d) =>
                  d.visible &&
                  data.categories.some(
                    (c) => c.id === d.category_id && c.visible,
                  ) &&
                  `${d.name} ${d.code}`
                    .toLowerCase()
                    .includes(search.toLowerCase()) &&
                  !items.some((i) => i.dress_id === d.id),
              )
              .slice(0, 20)
              .map((d) => (
                <button
                  type="button"
                  key={d.id}
                  onClick={() => setItems([...items, { dress_id: d.id }])}
                >
                  <Plus size={15} />
                  <b>{d.code}</b> {d.name}
                  <span>{money(d.default_price)}</span>
                </button>
              ))}
            {!data.dresses.length && (
              <p className="muted">أضف قطعاً إلى المخزون أولاً.</p>
            )}
          </div>
          {items.map((item, index) => {
            const d = data.dresses.find((d) => d.id === item.dress_id);
            const a = availability.find((a) => a.dress_id === item.dress_id);
            if (!d) return null;
            return (
              <div className="selected-item" key={item.dress_id}>
                <div className="selected-item-head">
                  <div>
                    <b>{d.name}</b>
                    <small>
                      {d.code} ·{" "}
                      {
                        data.categories.find((c) => c.id === d.category_id)
                          ?.name
                      }{" "}
                      · السعر الأصلي {money(d.default_price)}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="icon-button danger"
                    aria-label="إزالة القطعة"
                    onClick={() =>
                      setItems(items.filter((_, i) => i !== index))
                    }
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
                <div className="form-grid">
                  <label>
                    سعر القطعة لهذا الحجز
                    <PriceInput
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.price ?? d.default_price}
                      onChange={(e) =>
                        patchItem(index, { price: Number(e.target.value) })
                      }
                    />
                  </label>
                  <div className="availability-indicator">
                    {checking ? (
                      "جارٍ فحص التوفر…"
                    ) : a?.conflict || a?.unready ? (
                      <span className="danger">
                        <AlertTriangle size={16} />{" "}
                        {a.conflict
                          ? "هذه البدلة غير متاحة في هذه الفترة."
                          : "القطعة غير جاهزة للتأجير."}
                      </span>
                    ) : (
                      <span className="success">
                        <CheckCircle2 size={16} /> متاحة للفترة المحددة
                      </span>
                    )}
                  </div>
                </div>
                <p className="muted small">
                  العرض:{" "}
                  {quote?.item_quotes?.find((q) => q.dress_id === item.dress_id)
                    ?.offer_name || "لا يوجد"}{" "}
                  · السعر بعد العرض:{" "}
                  {money(
                    quote?.item_quotes?.find(
                      (q) => q.dress_id === item.dress_id,
                    )?.offer_price ??
                      item.price ??
                      d.default_price,
                  )}
                </p>
                <details>
                  <summary>تعديل فترة الحجز ومواعيد التسليم والإرجاع</summary>
                  <div className="form-grid">
                    {(
                      [
                        [
                          "blocked_from",
                          "بداية الفترة المحجوزة",
                          -data.settings.days_before_event,
                        ],
                        [
                          "blocked_until",
                          "نهاية الفترة المحجوزة",
                          data.settings.days_after_event,
                        ],
                        [
                          "delivery_date",
                          "موعد التسليم",
                          -data.settings.days_before_event,
                        ],
                        [
                          "expected_return_date",
                          "الإرجاع المتوقع",
                          data.settings.days_after_event,
                        ],
                      ] as const
                    ).map(([key, label, offset]) => (
                      <label key={key}>
                        {label}
                        <input
                          type="date"
                          required
                          value={item[key] || shiftDate(event, offset)}
                          onChange={(e) =>
                            patchItem(index, { [key]: e.target.value })
                          }
                        />
                      </label>
                    ))}
                  </div>
                </details>
                {a?.same_town && (
                  <p className="warning">
                    <AlertTriangle size={16} /> تنبيه: توجد عروس أخرى من نفس
                    العنوان حجزت هذه البدلة. يمكنك متابعة الحجز.
                  </p>
                )}
              </div>
            );
          })}
        </section>
        <label>
          ملاحظات
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </label>
      </div>
      <aside className="booking-summary">
        <h3>ملخص الحجز</h3>
        <div className="summary-row">
          <span>المجموع الأصلي</span>
          <b>{money(quote?.original_subtotal || 0)}</b>
        </div>
        <div className="summary-row">
          <span>أسعار القطع المتفق عليها</span>
          <b>{money(quote?.item_subtotal || 0)}</b>
        </div>
        <div className="summary-row">
          <span>العروض والخصومات</span>
          <b className="success">− {money(quote?.automatic_discount || 0)}</b>
        </div>
        {quote?.offers.map((o) => (
          <div className="offer-callout" key={o.id}>
            {o.name}
          </div>
        ))}
        <p className="muted small">
          يُطبّق أفضل عرض مؤهل دون جمع العروض، حسب تاريخ المناسبة.
        </p>
        <div className="summary-row total">
          <span>السعر بعد العروض</span>
          <b>{money(quote?.calculated_total || 0)}</b>
        </div>
        <label>
          السعر المتفق عليه
          <PriceInput
            type="number"
            min="0"
            step="0.01"
            value={agreed}
            placeholder={String(quote?.calculated_total || 0)}
            onChange={(e) => setAgreed(e.target.value)}
          />
          <small>اتركه فارغاً لاستخدام السعر المحسوب.</small>
        </label>
        {!existing && (
          <label>
            العربون
            <PriceInput
              type="number"
              min="0"
              max={total}
              step="0.01"
              value={deposit}
              placeholder="0"
              onChange={(e) => setDeposit(e.target.value)}
            />
          </label>
        )}
        <div className="summary-row">
          <span>المبلغ المدفوع</span>
          <b>{money(paid)}</b>
        </div>
        <div className="balance">
          <span>المبلغ المتبقي</span>
          <strong>{money(total - paid)}</strong>
        </div>
        {existing && (
          <p className="warning">
            حفظ التعديلات يعيد حساب الأسعار والعروض الحالية. سجّل الدفعات من ملف
            الحجز.
          </p>
        )}
        {(error || checkError) && (
          <div className="alert" role="alert">
            {error || checkError}
          </div>
        )}
        <button
          className="primary full"
          disabled={
            busy ||
            checking ||
            blocked ||
            !items.length ||
            !!checkError ||
            paid > total
          }
        >
          {busy
            ? "جارٍ الحفظ…"
            : existing
              ? "حفظ تعديلات الحجز"
              : "تأكيد وحفظ الحجز"}
        </button>
        <p className="muted small">
          يُحفظ الحجز والقطع والعربون معاً في معاملة واحدة.
        </p>
      </aside>
    </form>
  );
}
