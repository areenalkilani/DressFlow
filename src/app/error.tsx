"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="setup">
      <h1>تعذر إكمال الطلب</h1>
      <p>تحقق من الاتصال وإعدادات قاعدة البيانات ثم أعد المحاولة.</p>
      <button className="primary" onClick={reset}>
        إعادة المحاولة
      </button>
    </main>
  );
}
