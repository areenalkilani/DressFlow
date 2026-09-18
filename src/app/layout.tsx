import type { Metadata, Viewport } from "next";
import { PwaRegistration } from "@/components/install-app";
import "./globals.css";
export const metadata: Metadata = {
  title: "DressFlow | نظام حجز وتأجير البدلات والفساتين",
  description: "إدارة الحجوزات والفساتين والبروفات في مكان واحد.",
  applicationName: "DressFlow",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [
      { url: "/icons/icon-180.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: { capable: true, title: "DressFlow", statusBarStyle: "default" },
};
export const viewport: Viewport = {
  themeColor: "#8b6e77",
  width: "device-width",
  initialScale: 1,
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <PwaRegistration />
        {children}
      </body>
    </html>
  );
}
