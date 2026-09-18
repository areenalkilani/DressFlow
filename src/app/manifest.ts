import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "DressFlow — نظام حجز وتأجير البدلات والفساتين",
    short_name: "DressFlow",
    description: "إدارة حجوزات المعرض والفساتين والبروفات",
    lang: "ar",
    dir: "rtl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7f8fa",
    theme_color: "#8b6e77",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "الحجوزات", url: "/#page=bookings" },
      { name: "مواعيد البروفا", url: "/#page=fittings" },
    ],
    prefer_related_applications: false,
  };
}
