import "server-only";
import { shopSession } from "./supabase";
import type { ShopData, Item, Payment } from "./types";
export async function loadShop(): Promise<ShopData> {
  const { db, tenantId, user } = await shopSession();
  const refreshed = await db.rpc("refresh_notifications");
  if (refreshed.error) throw Error("تعذر تحديث التنبيهات.");
  async function all<T>(table: string): Promise<T[]> {
    const rows: T[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db
        .from(table)
        .select("*")
        .order("id")
        .range(offset, offset + 499);
      if (error)
        throw Error(
          "تعذر تحميل البيانات. تحقق من تطبيق ترحيلات قاعدة البيانات.",
        );
      rows.push(...(data as unknown as T[]));
      if (data.length < 500) return rows;
    }
  }
  const [
    tenantResult,
    settingsResult,
    categories,
    dresses,
    customers,
    bookingRows,
    items,
    payments,
    fittings,
    offerRows,
    targets,
    notificationResult,
  ] = await Promise.all([
    db.from("tenants").select("*").eq("id", tenantId).single(),
    db.from("tenant_settings").select("*").single(),
    all<ShopData["categories"][number]>("categories"),
    all<ShopData["dresses"][number]>("dresses"),
    all<ShopData["customers"][number]>("customers"),
    all<ShopData["bookings"][number]>("bookings"),
    all<Item>("booking_items"),
    all<Payment>("payments"),
    all<ShopData["fittings"][number]>("fittings"),
    all<ShopData["offers"][number]>("offers"),
    all<{
      offer_id: string;
      dress_id: string | null;
      category_id: string | null;
    }>("offer_targets"),
    db
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (tenantResult.error || settingsResult.error || notificationResult.error)
    throw Error("تعذر تحميل بيانات المتجر.");
  const tenant = tenantResult.data as ShopData["tenant"];
  tenant.email = user.email;
  const settings = settingsResult.data as ShopData["settings"];
  const byBooking = <T extends { booking_id: string }>(rows: T[]) => {
    const groups = new Map<string, T[]>();
    for (const row of rows)
      groups.set(row.booking_id, [...(groups.get(row.booking_id) || []), row]);
    return groups;
  };
  const itemsByBooking = byBooking(items);
  const paymentsByBooking = byBooking(payments);
  const targetsByOffer = new Map<string, typeof targets>();
  for (const target of targets)
    targetsByOffer.set(target.offer_id, [
      ...(targetsByOffer.get(target.offer_id) || []),
      target,
    ]);
  const bookings = bookingRows
    .map((b) => ({
      ...b,
      booking_items: itemsByBooking.get(b.id) || [],
      payments: paymentsByBooking.get(b.id) || [],
    }))
    .sort((a, b) => b.number - a.number);
  const offers = offerRows.map((o) => ({
    ...o,
    offer_targets: targetsByOffer.get(o.id) || [],
  }));
  const paths = [...categories, ...dresses]
    .map((r) => r.image_path)
    .filter((p): p is string => !!p);
  if (tenant.logo_path) paths.push(tenant.logo_path);
  if (paths.length) {
    const { data } = await db.storage
      .from("rental-images")
      .createSignedUrls([...new Set(paths)], 3600);
    const urls = new Map(data?.map((p) => [p.path, p.signedUrl]));
    for (const row of [...categories, ...dresses])
      if (row.image_path) row.image_url = urls.get(row.image_path) ?? undefined;
    if (tenant.logo_path)
      tenant.logo_url = urls.get(tenant.logo_path) ?? undefined;
  }
  return {
    tenant,
    settings,
    categories,
    dresses,
    customers,
    bookings,
    fittings,
    offers,
    notifications: notificationResult.data as ShopData["notifications"],
    today: new Intl.DateTimeFormat("en-CA", {
      timeZone: settings.timezone,
    }).format(new Date()),
  };
}
