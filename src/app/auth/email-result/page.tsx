import Link from "next/link";
export const dynamic = "force-dynamic";
export default async function EmailResult({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  return (
    <main className="setup">
      <h1>
        {status === "error" ? "تعذر إكمال التأكيد" : "تأكيد البريد الإلكتروني"}
      </h1>
      <p>
        {status === "error"
          ? "قد يكون الرابط منتهياً أو فُتح بمتصفح مختلف. جرّبي تسجيل الدخول بالبريد الجديد، أو اطلبي التغيير مجدداً من إعدادات حسابك."
          : "تمت معالجة رابط التأكيد. إذا وصلتك رسالة ثانية إلى البريد الآخر، أكّديها أيضاً لإكمال تغيير عنوان الدخول."}
      </p>
      <Link className="button primary" href="/">
        العودة إلى حسابي
      </Link>
      <p>
        <Link href="/login">تسجيل الدخول</Link>
      </p>
    </main>
  );
}
