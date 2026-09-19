"use client";
import { useState } from "react";
import { checkAvailability } from "@/app/actions";
import type { ShopData, Availability } from "@/lib/types";
import { money } from "@/lib/domain";
import { DressDrawing, Empty, Badge } from "./ui";
export function AvailabilityView({
  data,
  onBook,
}: {
  data: ShopData;
  onBook: (id: string, date: string) => void;
}) {
  const [event, setEvent] = useState(data.today);
  const [category, setCategory] = useState("");
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [town, setTown] = useState("");
  const [result, setResult] = useState<Availability[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <form
        className="panel filter-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const dresses = data.dresses.filter(
              (d) =>
                d.visible &&
                data.categories.some(
                  (c) => c.id === d.category_id && c.visible,
                ) &&
                (!category || d.category_id === category) &&
                (!color || d.color.includes(color)) &&
                (!size || d.size.includes(size)),
            );
            const batches = [];
            for (let i = 0; i < dresses.length; i += 50)
              batches.push(dresses.slice(i, i + 50));
            const values = await Promise.all(
              batches.map((batch) =>
                checkAvailability(
                  batch.map((d) => ({ dress_id: d.id })),
                  event,
                  town,
                  "bride",
                ),
              ),
            );
            setResult(
              values.flat().filter((item) => !item.conflict && !item.unready),
            );
          } catch (e) {
            setError(
              e instanceof Error && /[\u0600-\u06FF]/.test(e.message)
                ? e.message
                : "تعذر فحص التوفر.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          تاريخ المناسبة
          <input
            type="date"
            required
            value={event}
            onChange={(e) => {
              setEvent(e.target.value);
              setResult(null);
            }}
          />
        </label>
        <label>
          التصنيف
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">كل التصنيفات</option>
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          اللون
          <input value={color} onChange={(e) => setColor(e.target.value)} />
        </label>
        <label>
          المقاس
          <input value={size} onChange={(e) => setSize(e.target.value)} />
        </label>
        <label>
          العنوان
          <input value={town} onChange={(e) => setTown(e.target.value)} />
        </label>
        <button className="primary" disabled={busy}>
          {busy ? "جارٍ الفحص…" : "فحص التوفر"}
        </button>
      </form>
      {error && <p className="alert">{error}</p>}
      {result === null ? (
        <Empty
          title="اعثري على القطعة المناسبة"
          description="اختاري موعد المناسبة لفحص التوفر الفعلي للقطع."
        />
      ) : !result.length ? (
        <Empty title="لا توجد قطع مطابقة" />
      ) : (
        <div className="dress-grid">
          {result.map((a) => {
            const d = data.dresses.find((d) => d.id === a.dress_id)!;
            return (
              <article className="dress-card" key={d.id}>
                <div className="dress-image">
                  {d.image_url ? (
                    <img
                      src={d.image_url}
                      alt={d.name}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <DressDrawing />
                  )}
                  <Badge status="available" />
                </div>
                <div className="dress-body">
                  <small>
                    {d.code} · {d.color} · {d.size}
                  </small>
                  <h3>{d.name}</h3>
                  <b>{money(d.default_price)}</b>
                  {a.same_town && (
                    <p className="warning">
                      عروس أخرى من نفس العنوان حجزت هذه القطعة. التنبيه لا يمنع
                      الحجز.
                    </p>
                  )}
                  <button className="full" onClick={() => onBook(d.id, event)}>
                    إنشاء حجز بهذه البدلة
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
