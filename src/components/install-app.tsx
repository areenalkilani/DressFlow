"use client";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Modal } from "./ui";
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
let deferred: InstallEvent | null = null;
export function PwaRegistration() {
  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault();
      deferred = event as InstallEvent;
    };
    window.addEventListener("beforeinstallprompt", capture);
    if ("serviceWorker" in navigator && window.isSecureContext)
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => {});
    return () => window.removeEventListener("beforeinstallprompt", capture);
  }, []);
  return null;
}
export function InstallApp() {
  const [help, setHelp] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const update = () =>
      setInstalled(
        media.matches ||
          !!(navigator as Navigator & { standalone?: boolean }).standalone,
      );
    update();
    media.addEventListener("change", update);
    window.addEventListener("appinstalled", update);
    return () => {
      media.removeEventListener("change", update);
      window.removeEventListener("appinstalled", update);
    };
  }, []);
  if (installed) return null;
  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          if (!deferred) {
            setHelp(true);
            return;
          }
          setBusy(true);
          const prompt = deferred;
          deferred = null;
          try {
            await prompt.prompt();
            const result = await prompt.userChoice;
            if (result.outcome === "accepted") setInstalled(true);
          } catch {
            setHelp(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Download size={18} />
        تثبيت التطبيق
      </button>
      {help && (
        <Modal title="تثبيت DressFlow على جهازك" onClose={() => setHelp(false)}>
          <div className="install-help">
            <img
              src="/icons/icon-192.png"
              width="72"
              height="72"
              alt="أيقونة DressFlow"
            />
            <p>
              بيظهر التطبيق بأيقونته على الشاشة الرئيسية، وبيفتح بنافذة مستقلة.
            </p>
            <h3>على آيفون / آيباد</h3>
            <p>
              افتحي الموقع في Safari، ثم مشاركة ← إضافة إلى الشاشة الرئيسية.
            </p>
            <h3>على أندرويد أو الكمبيوتر</h3>
            <p>
              من قائمة Chrome أو Edge اختاري «تثبيت التطبيق» أو «إضافة إلى
              الشاشة الرئيسية». قد يظهر خيار التثبيت في شريط العنوان.
            </p>
            <small>
              التثبيت يعتمد على دعم المتصفح ويحتاج رابط HTTPS (أو localhost
              للتجربة). استخدام بيانات المعرض يحتاج إنترنت.
            </small>
          </div>
        </Modal>
      )}
    </>
  );
}
