"use client";
import { useState } from "react";
import { Plus, LogOut } from "lucide-react";
import { saveShop, logout } from "@/app/actions";
import type { Tenant } from "@/lib/types";
import { Modal, SectionTitle, SearchBox, Empty, Badge } from "./ui";
export function AdminApp({ tenants }: { tenants: Tenant[] }) {
  const [editing, setEditing] = useState<Tenant | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <div className="wordmark">
            Dress<span>Flow</span>
            <i>✦</i>
          </div>
          <small className="muted">نظام حجز وتأجير البدلات والفساتين</small>
        </div>
        <form action={logout}>
          <button>
            <LogOut size={16} /> تسجيل الخروج
          </button>
        </form>
      </header>
      <SectionTitle
        title="إدارة حسابات المتاجر"
        description="لوحة مدير النظام · حساب مستقل ومساحة خاصة لكل متجر."
      >
        <button
          className="primary"
          onClick={() => {
            setEditing(null);
            setError("");
          }}
        >
          <Plus size={18} />
          إنشاء حساب متجر
        </button>
      </SectionTitle>
      <div className="stats-grid">
        {[
          ["إجمالي المتاجر", tenants.length],
          ["حسابات نشطة", tenants.filter((t) => t.active).length],
          ["حسابات معطّلة", tenants.filter((t) => !t.active).length],
          [
            "أُنشئت خلال ٣٠ يوماً",
            tenants.filter(
              (t) =>
                Date.now() - new Date(t.created_at).getTime() < 30 * 86400000,
            ).length,
          ],
        ].map(([label, value]) => (
          <article key={label} className="stat-card">
            <div>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          </article>
        ))}
      </div>
      <div className="toolbar">
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder="ابحث باسم المتجر، المالك أو رقم الهاتف…"
        />
      </div>
      <section className="panel table-wrap">
        {!tenants.length ? (
          <Empty
            title="أضف أول متجر"
            description="يتم إنشاء حساب آمن وتصنيفات وإعدادات افتراضية تلقائياً."
          />
        ) : (
          <table>
            <thead>
              <tr>
                <th>المتجر</th>
                <th>صاحب الحساب</th>
                <th>الهاتف</th>
                <th>بريد الدخول</th>
                <th>تاريخ الإنشاء</th>
                <th>الحالة</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {tenants
                .filter((t) =>
                  `${t.name} ${t.owner_name} ${t.phone} ${t.email || ""}`.includes(
                    query,
                  ),
                )
                .map((t) => (
                  <tr key={t.id}>
                    <td>
                      <b>{t.name}</b>
                    </td>
                    <td>{t.owner_name}</td>
                    <td dir="ltr">{t.phone}</td>
                    <td>{t.email || "أضيفي إيميل لتفعيل الدخول"}</td>
                    <td>
                      {new Date(t.created_at).toLocaleDateString("ar-PS")}
                    </td>
                    <td>
                      <Badge status={t.active ? "active" : "معطّل"} />
                    </td>
                    <td>
                      <button
                        onClick={() => {
                          setEditing(t);
                          setError("");
                        }}
                      >
                        تعديل / {t.active ? "تعطيل" : "تفعيل"}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </section>
      {editing !== undefined && (
        <Modal
          title={editing ? "تعديل حساب المتجر" : "إنشاء حساب متجر"}
          onClose={() => setEditing(undefined)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const fd = new FormData(e.currentTarget);
              try {
                await saveShop({
                  id: editing?.id,
                  name: fd.get("name"),
                  owner_name: fd.get("owner_name"),
                  phone: fd.get("phone"),
                  email: fd.get("email"),
                  password: fd.get("password") || undefined,
                  active: fd.has("active"),
                });
                setEditing(undefined);
              } catch (e) {
                setError(
                  e instanceof Error && /[\u0600-\u06FF]/.test(e.message)
                    ? e.message
                    : "تعذر حفظ الحساب.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              اسم المتجر
              <input name="name" required defaultValue={editing?.name} />
            </label>
            <label>
              اسم صاحب الحساب
              <input
                name="owner_name"
                required
                defaultValue={editing?.owner_name}
              />
            </label>
            <label>
              رقم الهاتف للتواصل
              <input
                name="phone"
                type="tel"
                pattern="\+[1-9][0-9]{7,14}"
                dir="ltr"
                required
                placeholder="+972…"
                defaultValue={editing?.phone}
              />
              <small>
                رمز الدولة دون مسافات. تحقق من ملكية الرقم قبل اعتماده.
              </small>
            </label>
            <label>
              البريد الإلكتروني للدخول
              <input
                name="email"
                type="email"
                dir="ltr"
                required
                defaultValue={editing?.email}
                autoComplete="off"
              />
              <small>
                أدخلي بريد صاحب الحساب بعد التحقق منه. للحساب القديم، إضافة
                البريد تحافظ على كلمة المرور والبيانات.
              </small>
            </label>
            <label>
              {editing ? "كلمة مرور جديدة (اختيارية)" : "كلمة المرور"}
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                required={!editing}
                minLength={12}
              />
              <small>١٢ حرفاً على الأقل. لا تُحفظ في جداول التطبيق.</small>
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                name="active"
                defaultChecked={editing?.active ?? true}
              />{" "}
              الحساب نشط
            </label>
            <p className="muted small">
              تعطيل الحساب يمنع الوصول إلى جميع بيانات المتجر فوراً، مع الاحتفاظ
              بسجلاته.
            </p>
            {error && (
              <p role="alert" className="alert">
                {error}
              </p>
            )}
            <button className="primary full" disabled={busy}>
              {busy ? "جارٍ الحفظ…" : "حفظ الحساب"}
            </button>
          </form>
        </Modal>
      )}
    </main>
  );
}
