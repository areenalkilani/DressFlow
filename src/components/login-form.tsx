"use client";
import { useState } from "react";
import { login } from "@/app/actions";
export function LoginForm({ configured }: { configured: boolean }) {
  const [admin, setAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <form
        action={async (fd) => {
          setBusy(true);
          setError("");
          try {
            const result = await login(fd);
            if (result) setError(result.error);
          } catch (e) {
            if (e instanceof Error && e.message.includes("NEXT_REDIRECT"))
              throw e;
            setError("تعذر الاتصال. تحقق من إعدادات النظام.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <input type="hidden" name="mode" value={admin ? "admin" : "shop"} />
        <label>
          البريد الإلكتروني
          <input
            name="identifier"
            type="email"
            dir="ltr"
            placeholder="name@example.com"
            required
            autoComplete="username"
          />
        </label>
        <label>
          كلمة المرور
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </label>
        {(!configured || error) && (
          <div role="alert" className="alert">
            {error || "يجب إعداد اتصال Supabase أولاً."}
          </div>
        )}
        <button className="primary full" disabled={busy || !configured}>
          {busy ? "جارٍ تسجيل الدخول…" : "تسجيل الدخول ←"}
        </button>
      </form>
      <button
        className="text-button full"
        onClick={() => {
          setAdmin(!admin);
          setError("");
        }}
      >
        {admin ? "العودة لدخول المتجر" : "دخول مدير النظام"}
      </button>
    </>
  );
}
