"use client";
import { PriceInput } from "./price-input";
import { EmailForm } from "./email-form";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { compressImage } from "@/lib/image-client";
import {
  saveRecord,
  uploadImage,
  saveSettings,
  changePassword,
  createDressVariants,
} from "@/app/actions";
import type { ShopData, Category, Dress, Customer } from "@/lib/types";
type RecordKind = "categories" | "dresses" | "customers";
export function RecordForm({
  kind,
  record,
  data,
  onSaved,
}: {
  kind: RecordKind;
  record?: Category | Dress | Customer;
  data: ShopData;
  onSaved: () => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [variants, setVariants] = useState([{ size: "", quantity: 1 }]);
  const r = (record || {}) as Partial<Dress & Customer>;
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const fd = new FormData(e.currentTarget);
        try {
          let imagePath = r.image_path;
          const file = fd.get("image");
          if (file instanceof File && file.size) {
            const upload = new FormData();
            upload.set("file", await compressImage(file));
            upload.set("folder", kind);
            imagePath = await uploadImage(upload);
          }
          const common = { id: r.id, name: fd.get("name") };
          const payload =
            kind === "categories"
              ? { ...common, visible: fd.has("visible"), image_path: imagePath }
              : kind === "dresses"
                ? {
                    ...common,
                    category_id: fd.get("category_id"),
                    code: fd.get("code"),
                    color: fd.get("color"),
                    size: fd.get("size"),
                    default_price: fd.get("default_price"),
                    status: fd.get("status"),
                    visible: fd.has("visible"),
                    notes: fd.get("notes"),
                    image_path: imagePath,
                  }
                : {
                    ...common,
                    phone: fd.get("phone"),
                    secondary_phone: fd.get("secondary_phone"),
                    city: r.city || "",
                    town: fd.get("address"),
                    notes: fd.get("notes"),
                  };
          if (kind === "dresses" && !r.id) {
            await createDressVariants({ ...payload, variants });
          } else await saveRecord(kind, payload);
          onSaved();
        } catch (e) {
          setError(
            e instanceof Error && /[\u0600-\u06FF]/.test(e.message)
              ? e.message
              : "تعذر الحفظ.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-grid">
        <label>
          الاسم
          <input name="name" required defaultValue={r.name} />
        </label>
        {kind === "dresses" && (
          <>
            <label>
              رمز القطعة
              <input
                name="code"
                required
                pattern="[A-Za-z0-9_-]+"
                dir="ltr"
                defaultValue={r.code}
              />
            </label>
            <label>
              التصنيف
              <select name="category_id" required defaultValue={r.category_id}>
                <option value="">اختر التصنيف</option>
                {data.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              اللون
              <input name="color" defaultValue={r.color} />
            </label>
            {r.id ? (
              <label>
                المقاس
                <input name="size" defaultValue={r.size} />
              </label>
            ) : (
              <div className="variant-editor">
                <div>
                  <b>المقاسات والكميات</b>
                  <small>
                    كل قطعة تُحفظ بشكل مستقل حتى تنحجز وتُرجع لوحدها.
                  </small>
                </div>
                {variants.map((variant, index) => (
                  <div className="variant-row" key={index}>
                    <label>
                      المقاس
                      <input
                        required
                        value={variant.size}
                        onChange={(e) =>
                          setVariants((v) =>
                            v.map((x, i) =>
                              i === index ? { ...x, size: e.target.value } : x,
                            ),
                          )
                        }
                        placeholder="مثال: M"
                      />
                    </label>
                    <label>
                      الكمية
                      <input
                        required
                        type="number"
                        min="1"
                        max="50"
                        value={variant.quantity}
                        onChange={(e) =>
                          setVariants((v) =>
                            v.map((x, i) =>
                              i === index
                                ? {
                                    ...x,
                                    quantity: Number(e.target.value) || 1,
                                  }
                                : x,
                            ),
                          )
                        }
                      />
                    </label>
                    {variants.length > 1 && (
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="حذف المقاس"
                        onClick={() =>
                          setVariants((v) => v.filter((_, i) => i !== index))
                        }
                      >
                        <Trash2 size={17} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    setVariants((v) => [...v, { size: "", quantity: 1 }])
                  }
                >
                  <Plus size={16} /> إضافة نمرة أخرى
                </button>
              </div>
            )}
            <label>
              سعر التأجير الافتراضي
              <PriceInput
                type="number"
                name="default_price"
                required
                min="0"
                step="0.01"
                defaultValue={r.default_price}
              />
            </label>
            <label>
              جاهزية المخزون
              <select
                name="status"
                defaultValue={
                  ["available", "cleaning", "out_of_service"].includes(
                    r.status || "",
                  )
                    ? r.status
                    : "available"
                }
              >
                <option value="available">متاحة</option>
                <option value="cleaning">تنظيف</option>
                <option value="out_of_service">خارج الخدمة</option>
              </select>
              <small>حالات التسليم والإرجاع تُدار من ملف الحجز.</small>
            </label>
          </>
        )}
        {kind === "customers" && (
          <>
            <label>
              رقم الهاتف الأساسي
              <input
                name="phone"
                type="tel"
                dir="ltr"
                required
                minLength={7}
                defaultValue={r.phone}
              />
            </label>
            <label>
              رقم هاتف إضافي
              <input
                name="secondary_phone"
                type="tel"
                dir="ltr"
                defaultValue={r.secondary_phone}
              />
            </label>
            <label>
              العنوان
              <input
                name="address"
                defaultValue={r.town || r.city}
                placeholder="البلدة أو الحي"
              />
            </label>
          </>
        )}
        {kind !== "customers" && (
          <>
            <label>
              الصورة (اختيارية)
              <input
                type="file"
                name="image"
                accept="image/png,image/jpeg,image/webp"
              />
              <small>
                تُضغط تلقائياً قبل الحفظ لتقليل المساحة؛ الحد النهائي ٢
                ميغابايت.
              </small>
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                name="visible"
                defaultChecked={r.visible ?? true}
              />{" "}
              إظهار في المخزون
            </label>
          </>
        )}
      </div>
      {kind !== "categories" && (
        <label>
          ملاحظات
          <textarea name="notes" rows={3} defaultValue={r.notes} />
        </label>
      )}
      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}
      <button disabled={busy} className="primary full">
        {busy ? "جارٍ الحفظ…" : "حفظ البيانات"}
      </button>
    </form>
  );
}
export function SettingsForm({
  data,
  notify,
}: {
  data: ShopData;
  notify: (text: string) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="settings-grid">
      <form
        className="panel"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const fd = new FormData(e.currentTarget);
          try {
            let logo = data.tenant.logo_path;
            const file = fd.get("logo");
            if (file instanceof File && file.size) {
              const upload = new FormData();
              upload.set("file", await compressImage(file));
              upload.set("folder", "logo");
              logo = await uploadImage(upload);
            }
            await saveSettings({
              name: fd.get("name"),
              owner_name: fd.get("owner_name"),
              phone: fd.get("phone"),
              logo_path: logo,
              days_before_event: fd.get("days_before_event"),
              days_after_event: fd.get("days_after_event"),
              fitting_days_before_event: fd.get("fitting_days_before_event"),
              same_town_warning_enabled: fd.has("same_town_warning_enabled"),
              notifications_enabled: fd.has("notifications_enabled"),
              timezone: fd.get("timezone"),
            });
            router.refresh();
            notify("تم حفظ إعدادات المتجر.");
          } catch (e) {
            setError(
              e instanceof Error && /[\u0600-\u06FF]/.test(e.message)
                ? e.message
                : "تعذر الحفظ.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <h3>معلومات المتجر</h3>
        <div className="form-grid">
          <label>
            اسم المتجر
            <input required name="name" defaultValue={data.tenant.name} />
          </label>
          <label>
            اسم صاحب الحساب
            <input
              required
              name="owner_name"
              defaultValue={data.tenant.owner_name}
            />
          </label>
          <label>
            هاتف التواصل
            <input
              name="phone"
              type="tel"
              dir="ltr"
              required
              pattern="\+[1-9][0-9]{7,14}"
              defaultValue={data.tenant.phone}
            />
            <small>
              أدخلي الرقم مع رمز الدولة، مثال: ‎+972… تسجيل الدخول يبقى
              بالإيميل.
            </small>
          </label>
          <label>
            شعار المتجر
            <input
              type="file"
              name="logo"
              accept="image/jpeg,image/png,image/webp"
            />
          </label>
        </div>
        <h3>إعدادات التأجير</h3>
        <div className="form-grid">
          {(
            [
              ["days_before_event", "أيام الحجز قبل المناسبة", 60],
              ["days_after_event", "أيام الحجز بعد المناسبة", 60],
              ["fitting_days_before_event", "أيام البروفة قبل المناسبة", 365],
            ] as const
          ).map(([key, label, max]) => (
            <label key={key}>
              {label}
              <input
                type="number"
                name={key}
                required
                min="0"
                max={max}
                defaultValue={data.settings[key]}
              />
            </label>
          ))}
          <label>
            المنطقة الزمنية
            <select name="timezone" defaultValue={data.settings.timezone}>
              <option>Asia/Jerusalem</option>
              <option>Asia/Hebron</option>
              <option>Asia/Amman</option>
              <option>Asia/Riyadh</option>
              <option>Asia/Dubai</option>
              <option>Africa/Cairo</option>
              <option>UTC</option>
            </select>
          </label>
        </div>
        <label className="checkbox">
          <input
            type="checkbox"
            name="same_town_warning_enabled"
            defaultChecked={data.settings.same_town_warning_enabled}
          />{" "}
          تنبيه عروس من نفس العنوان (لا يمنع الحجز)
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            name="notifications_enabled"
            defaultChecked={data.settings.notifications_enabled}
          />{" "}
          تفعيل تنبيهات البروفات والتسليم والإرجاع
        </label>
        <p className="muted">
          تؤثر إعدادات الفترات على الحجوزات الجديدة. تبقى تواريخ الحجوزات
          السابقة محفوظة.
        </p>
        {error && <p className="alert">{error}</p>}
        <button className="primary" disabled={busy}>
          {busy ? "جارٍ الحفظ…" : "حفظ الإعدادات"}
        </button>
      </form>
      <div>
        <EmailForm email={data.tenant.email} notify={notify} />
        <PasswordForm notify={notify} />
      </div>
    </div>
  );
}
function PasswordForm({ notify }: { notify: (message: string) => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="panel"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        setBusy(true);
        setError("");
        try {
          if (fd.get("password") !== fd.get("confirm"))
            throw Error("كلمتا المرور غير متطابقتين.");
          await changePassword({
            current: fd.get("current"),
            password: fd.get("password"),
          });
          form.reset();
          notify("تم تغيير كلمة المرور.");
        } catch (e) {
          setError(
            e instanceof Error && /[\u0600-\u06FF]/.test(e.message)
              ? e.message
              : "تعذر التغيير.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>أمان الحساب</h3>
      <label>
        كلمة المرور الحالية
        <input
          type="password"
          name="current"
          required
          autoComplete="current-password"
        />
      </label>
      <label>
        كلمة المرور الجديدة
        <input
          type="password"
          name="password"
          minLength={12}
          required
          autoComplete="new-password"
        />
      </label>
      <label>
        تأكيد كلمة المرور
        <input
          type="password"
          name="confirm"
          minLength={12}
          required
          autoComplete="new-password"
        />
      </label>
      {error && <p className="alert">{error}</p>}
      <button disabled={busy}>تحديث كلمة المرور</button>
    </form>
  );
}
