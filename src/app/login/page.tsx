import { LoginForm } from "@/components/login-form";
import { InstallApp } from "@/components/install-app";
import { configured } from "@/lib/supabase";
export const dynamic = "force-dynamic";
export default function Login() {
  return (
    <main className="login-page">
      <section className="login-story">
        <div className="wordmark">
          Dress<span>Flow</span>
          <i>✦</i>
        </div>
        <div>
          <p className="eyebrow">تفاصيل أقل. لحظات أجمل.</p>
          <h1>
            كل حكاية جميلة،
            <br />
            تبدأ بترتيب أنيق.
          </h1>
          <p>
            من أول بروفة إلى آخر إرجاع.
            <br />
            مساحتك لإدارة يومك، والعناية بكل التفاصيل.
          </p>
        </div>
        <small>نظام حجز وتأجير البدلات والفساتين</small>
        <div className="story-orbit" />
      </section>
      <section className="login-form-wrap">
        <div className="login-form-inner">
          <span className="mini-tag">مساحة إدارة المتجر</span>
          <h2>أهلاً بعودتك</h2>
          <p className="muted">سجّل الدخول لمتابعة حجوزاتك ويوم عملك.</p>
          <LoginForm configured={configured()} />
          <div className="login-install">
            <InstallApp />
          </div>
          <p className="login-help">
            للحصول على حساب أو استعادة الوصول، تواصل مع مدير النظام.
          </p>
        </div>
      </section>
    </main>
  );
}
