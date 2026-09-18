import Link from "next/link";
export default function NotFound() {
  return (
    <main className="setup">
      <h1>الصفحة غير موجودة</h1>
      <Link className="button primary" href="/">
        العودة إلى الرئيسية
      </Link>
    </main>
  );
}
