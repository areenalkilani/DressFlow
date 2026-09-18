"use client";
import { useState } from "react";
import type { ShopData, Dress } from "@/lib/types";
import { itemStatus, labels } from "@/lib/domain";
import { Badge, Empty, SearchBox } from "./ui";
export function DressHistory({
  dress,
  data,
  onOpen,
}: {
  dress: Dress;
  data: ShopData;
  onOpen: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const rentals = data.bookings
    .flatMap((b) =>
      b.booking_items
        .filter((i) => i.dress_id === dress.id)
        .map((item) => ({
          booking: b,
          item,
          address: b.customer_town || b.customer_city || "",
        })),
    )
    .sort((a, b) => b.booking.event_date.localeCompare(a.booking.event_date));
  const addresses = new Map<string, Set<string>>();
  for (const r of rentals) {
    if (
      r.booking.status === "cancelled" ||
      r.booking.customer_type !== "bride" ||
      !r.address.trim()
    )
      continue;
    const key = r.address.trim();
    const customers = addresses.get(key) || new Set<string>();
    customers.add(r.booking.customer_id);
    addresses.set(key, customers);
  }
  const repeated = [...addresses].filter(([, customers]) => customers.size > 1);
  const matches = rentals.filter((r) =>
    `${r.booking.customer_name} ${r.booking.customer_phone} ${r.address}`.includes(
      search,
    ),
  );
  return (
    <div className="dress-history">
      <p className="muted">
        {dress.code} — {dress.name}. كل المستأجرات السابقات والحاليات من سجلات
        متجرك.
      </p>
      <SearchBox
        value={search}
        onChange={setSearch}
        placeholder="ابحثي باسم المستأجرة أو العنوان…"
      />
      {repeated.length > 0 && (
        <div className="history-notice">
          <b>عرائس مختلفات من نفس العنوان استأجرن هذه البدلة</b>
          <p>
            {repeated
              .map(([address, people]) => `${address} (${people.size})`)
              .join("، ")}
          </p>
          <small>للمعلومة فقط؛ لا يمنع الحجز.</small>
        </div>
      )}
      {!matches.length ? (
        <Empty
          title="لا توجد حجوزات مطابقة"
          description="سيظهر هنا اسم المستأجرة وعنوانها عند حجز البدلة."
        />
      ) : (
        <div className="history-list">
          {matches.map(({ booking: b, item, address }) => (
            <article className="history-entry" key={item.id}>
              <header>
                <div>
                  <b>{b.customer_name}</b>
                  <small>
                    {labels[b.customer_type]} ·{" "}
                    <span dir="ltr">{b.customer_phone}</span>
                  </small>
                </div>
                <Badge
                  status={
                    b.status === "cancelled"
                      ? "cancelled"
                      : itemStatus(item, data.today)
                  }
                />
              </header>
              <dl>
                <dt>العنوان</dt>
                <dd>{address || "غير مسجل"}</dd>
                <dt>تاريخ المناسبة</dt>
                <dd>{b.event_date}</dd>
                <dt>فترة الحجز</dt>
                <dd>
                  {item.blocked_from} — {item.blocked_until}
                </dd>
                <dt>الإرجاع الفعلي</dt>
                <dd>{item.actual_return_date || "لم يُسجل"}</dd>
              </dl>
              <button type="button" onClick={() => onOpen(b.id)}>
                فتح ملف الحجز #{b.number}
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
