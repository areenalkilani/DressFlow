"use client";
import { useState } from "react";
import { changeEmail } from "@/app/actions";
export function EmailForm({
  email,
  notify,
}: {
  email?: string;
  notify: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  return (
    <form
      className="panel"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        setMessage("");
        const form = e.currentTarget;
        const fd = new FormData(form);
        try {
          const result = await changeEmail({
            email: fd.get("email"),
            current: fd.get("current"),
          });
          if (result.error) setError(result.error);
          else {
            setMessage(result.message || "");
            notify(result.message || "تم إرسال الطلب.");
            form.reset();
          }
        } catch {
          setError("تعذر تغيير البريد. حاولي مجدداً.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>البريد الإلكتروني للدخول</h3>
      <p className="muted">
        البريد الحالي: <b dir="ltr">{email || "غير مسجل"}</b>
      </p>
      <label>
        البريد الجديد
        <input
          name="email"
          type="email"
          dir="ltr"
          required
          autoComplete="email"
        />
      </label>
      <label>
        كلمة المرور الحالية
        <input
          name="current"
          type="password"
          required
          autoComplete="current-password"
        />
      </label>
      <p className="muted small">
        لتأكيد ملكية البريد، اتبعي رسائل التأكيد التي تصل إلى البريد الحالي
        والجديد.
      </p>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="offer-callout" role="status">
          {message}
        </p>
      )}
      <button disabled={busy}>
        {busy ? "جارٍ الإرسال…" : "طلب تغيير البريد"}
      </button>
    </form>
  );
}
