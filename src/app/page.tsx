import { redirect } from "next/navigation";
import { configured, session } from "@/lib/supabase";
import { loadShop } from "@/lib/data";
import { ShopApp } from "@/components/shop-app";
import Link from "next/link";
export const dynamic = "force-dynamic";
export default async function Page() {
  if (!configured())
    return (
      <main className="setup">
        <div className="brand-mark">
          D<span>F</span>
        </div>
        <p className="eyebrow">DRESSFLOW</p>
        <h1>نظام حجز وتأجير البدلات والفساتين</h1>
        <p>مساحة واحدة لكل تفاصيل متجرك.</p>
        <section className="panel">
          <h2>لنبدأ بإعداد الاتصال</h2>
          <p>
            أضف بيانات مشروع Supabase إلى ملف البيئة، ثم طبّق ترحيلات قاعدة
            البيانات وأنشئ حساب مدير النظام.
          </p>
          <ol>
            <li>
              انسخ ملف <b dir="ltr">.env.example</b> إلى{" "}
              <b dir="ltr">.env.local</b>.
            </li>
            <li>أدخل رابط المشروع والمفتاح العام ومفتاح الإدارة.</li>
            <li>
              طبّق ملفات SQL الموجودة في مجلد{" "}
              <b dir="ltr">supabase/migrations</b> بالترتيب.
            </li>
            <li>
              اتبع دليل الإعداد في <b dir="ltr">README.md</b> ثم أعد تشغيل
              التطبيق.
            </li>
          </ol>
          <Link className="button primary" href="/login">
            الانتقال إلى تسجيل الدخول
          </Link>
        </section>
        <small>البيانات محفوظة في Supabase • لا توجد بيانات تجريبية</small>
      </main>
    );
  let ctx;
  try {
    ctx = await session();
  } catch {
    redirect("/login");
  }
  if (ctx.profile.role === "super_admin") redirect("/admin");
  try {
    const data = await loadShop();
    return <ShopApp data={data} />;
  } catch (error) {
    return (
      <main className="setup">
        <h1>تعذر فتح المتجر</h1>
        <p>{error instanceof Error ? error.message : "حدث خطأ غير متوقع."}</p>
        <Link className="button" href="/login">
          تسجيل الدخول
        </Link>
      </main>
    );
  }
}
