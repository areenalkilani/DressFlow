import type { Item, Booking, Dress } from "./types";
export const money = (n: number) =>
  new Intl.NumberFormat("ar-PS", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 2,
  }).format(Number(n) || 0);
export function shiftDate(date: string, days: number) {
  const d = new Date(date + "T12:00:00Z");
  if (Number.isNaN(d.getTime())) return "";
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function overlaps(a: string, b: string, c: string, d: string) {
  return a <= d && b >= c;
}
export function itemStatus(item: Item, today: string) {
  return !item.actual_return_date &&
    item.expected_return_date < today &&
    item.active
    ? "late"
    : item.status;
}
export function balance(b: Booking) {
  return (
    Number(b.agreed_total) -
    b.payments.reduce((s, p) => s + Number(p.amount), 0)
  );
}
export function inventoryStatus(dress: Dress, items: Item[], today: string) {
  const rentals = items.filter((i) => i.dress_id === dress.id && i.active);
  if (rentals.some((i) => itemStatus(i, today) === "late")) return "late";
  if (
    [
      "cleaning",
      "out_of_service",
      "delivered",
      "awaiting_return",
      "returned",
    ].includes(dress.status)
  )
    return dress.status;
  const current = rentals.find(
    (i) => i.blocked_from <= today && i.blocked_until >= today,
  );
  return current?.status || dress.status;
}
export const labels: Record<string, string> = {
  available: "متاحة",
  reserved: "محجوزة",
  ready_for_delivery: "جاهزة للتسليم",
  delivered: "تم التسليم",
  awaiting_return: "بانتظار الإرجاع",
  returned: "تم الإرجاع",
  cleaning: "تنظيف",
  late: "متأخرة",
  out_of_service: "خارج الخدمة",
  active: "نشط",
  completed: "مكتمل",
  cancelled: "ملغى",
  scheduled: "مجدول",
  bride: "عروس",
  companion: "مرافقة",
  percentage: "نسبة مئوية",
  fixed: "خصم ثابت",
  bundle: "سعر باقة",
};
export const nextStatuses: Record<string, string[]> = {
  reserved: ["ready_for_delivery"],
  ready_for_delivery: ["delivered"],
  delivered: ["awaiting_return", "returned"],
  awaiting_return: ["returned"],
  returned: ["cleaning"],
  cleaning: ["available"],
};
