"use client";
import { PriceInput } from "./price-input";
import { useState } from "react";
import { payment, fitting, transition, cancelBooking } from "@/app/actions";
import { money, balance, itemStatus, nextStatuses, labels } from "@/lib/domain";
import type { Booking, ShopData } from "@/lib/types";
import { Badge, Modal } from "./ui";
export function BookingDetail({
  booking: b,
  data,
  onEdit,
  notify,
}: {
  booking: Booking;
  data: ShopData;
  onEdit: () => void;
  notify: (text: string) => void;
}) {
  const [dialog, setDialog] = useState<"payment" | "fitting" | "cancel" | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const f = data.fittings.find((f) => f.booking_id === b.id);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
      setDialog(null);
      notify("تم حفظ التغييرات.");
    } catch (e) {
      setError(
        e instanceof Error && /[\u0600-\u06FF]/.test(e.message)
          ? e.message
          : "تعذر الحفظ.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="booking-detail">
      <div className="detail-heading">
        <div>
          <span className="eyebrow">ملف الحجز #{b.number}</span>
          <h2>{b.customer_name}</h2>
          <Badge status={b.status} />
        </div>
        <div className="title-actions">
          <button onClick={() => window.print()}>طباعة الملف</button>
          {b.status === "active" && (
            <button onClick={onEdit}>تعديل الحجز والقطع</button>
          )}
        </div>
      </div>
      <div className="detail-columns">
        <section className="panel">
          <h3>معلومات العميلة والمناسبة</h3>
          <dl>
            <dt>نوع الحجز</dt>
            <dd>{labels[b.customer_type]}</dd>
            <dt>الهاتف الأساسي</dt>
            <dd dir="ltr">{b.customer_phone}</dd>
            <dt>الهاتف الإضافي</dt>
            <dd dir="ltr">{b.secondary_phone || "—"}</dd>
            <dt>العنوان</dt>
            <dd>
              {[
                ...new Set([b.customer_city, b.customer_town].filter(Boolean)),
              ].join(" / ") || "—"}
            </dd>
            <dt>تاريخ المناسبة</dt>
            <dd>{b.event_date}</dd>
          </dl>
          {b.notes && <p className="note">{b.notes}</p>}
        </section>
        <section className="panel">
          <h3>الملخص المالي</h3>
          <dl>
            <dt>المجموع الأصلي</dt>
            <dd>{money(b.original_subtotal)}</dd>
            <dt>العروض والخصومات</dt>
            <dd>{money(b.automatic_discount)}</dd>
            <dt>السعر بعد العروض</dt>
            <dd>{money(b.calculated_total)}</dd>
            <dt>السعر المتفق عليه</dt>
            <dd>{money(b.agreed_total)}</dd>
            <dt>المبلغ المدفوع</dt>
            <dd>{money(Number(b.agreed_total) - balance(b))}</dd>
          </dl>
          <div className="balance">
            <span>المبلغ المتبقي</span>
            <strong>{money(balance(b))}</strong>
          </div>
          {b.offer_snapshot.map((o) => (
            <p className="offer-callout" key={o.id}>
              {o.name} · {money(o.discount)}
            </p>
          ))}
          {b.status !== "cancelled" && balance(b) > 0 && (
            <button
              className="primary full"
              onClick={() => setDialog("payment")}
            >
              تسجيل دفعة
            </button>
          )}
        </section>
      </div>
      <section className="panel">
        <h3>
          البدلات والفساتين المستأجرة <small>({b.booking_items.length})</small>
        </h3>
        {b.booking_items.map((i) => (
          <article className="rental-row" key={i.id}>
            <div>
              <b>{i.dress_name}</b>
              <p>
                {i.dress_code} · {i.category_name}
              </p>
              <Badge status={itemStatus(i, data.today)} />
            </div>
            <div>
              <small>الفترة المحجوزة</small>
              <p>
                {i.blocked_from} ← {i.blocked_until}
              </p>
              <small>التسليم: {i.delivery_date}</small>
              <p>الإرجاع المتوقع: {i.expected_return_date}</p>
              <small>
                الإرجاع الفعلي: {i.actual_return_date || "لم يتم بعد"}
              </small>
            </div>
            <div>
              <small>السعر الأصلي: {money(i.original_price)}</small>
              <p>
                <b>{money(i.price)}</b>
              </p>
              <small>
                {i.offer_name || "دون عرض"} · بعد العرض: {money(i.offer_price)}
              </small>
              <div className="title-actions">
                {nextStatuses[i.status]?.map((s) => (
                  <button
                    key={s}
                    disabled={busy}
                    onClick={() => run(() => transition(i.id, s))}
                  >
                    {labels[s]}
                  </button>
                ))}
              </div>
            </div>
          </article>
        ))}
      </section>
      <div className="detail-columns">
        <section className="panel">
          <h3>سجل الدفعات</h3>
          {b.payments.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>التاريخ</th>
                    <th>المبلغ</th>
                    <th>ملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  {b.payments.map((p) => (
                    <tr key={p.id}>
                      <td>{p.payment_date}</td>
                      <td>{money(p.amount)}</td>
                      <td>{p.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">لم تُسجّل دفعات لهذا الحجز.</p>
          )}
        </section>
        <section className="panel">
          <h3>موعد البروفة</h3>
          {f ? (
            <>
              <p>
                {new Date(f.scheduled_at).toLocaleString("ar-PS", {
                  timeZone: data.settings.timezone,
                })}
              </p>
              <Badge status={f.status} />
              <p>{f.notes}</p>
            </>
          ) : (
            <p className="muted">لا يوجد موعد بروفة.</p>
          )}
          {b.customer_type === "bride" && b.status === "active" && (
            <button onClick={() => setDialog("fitting")}>
              تغيير موعد البروفة
            </button>
          )}
        </section>
      </div>
      {b.status === "active" && (
        <button className="danger" onClick={() => setDialog("cancel")}>
          إلغاء الحجز
        </button>
      )}
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {dialog && (
        <Modal
          title={
            dialog === "payment"
              ? "تسجيل دفعة"
              : dialog === "fitting"
                ? "تعديل البروفة"
                : "إلغاء الحجز"
          }
          onClose={() => setDialog(null)}
        >
          {dialog === "cancel" ? (
            <>
              <p>
                هل تريد إلغاء هذا الحجز؟ ستُتاح القطع للحجز مجدداً. يبقى سجل
                الدفعات محفوظاً؛ تسوية أي مبلغ مُعاد للعميلة تتم لدى المتجر.
              </p>
              <button
                disabled={busy}
                className="danger"
                onClick={() => run(() => cancelBooking(b.id))}
              >
                تأكيد إلغاء الحجز
              </button>
            </>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                run(() =>
                  dialog === "payment"
                    ? payment({
                        booking_id: b.id,
                        amount: fd.get("amount"),
                        payment_date: fd.get("date"),
                        note: fd.get("note"),
                      })
                    : fitting({
                        booking_id: b.id,
                        scheduled_at: new Date(
                          String(fd.get("at")),
                        ).toISOString(),
                        status: fd.get("status"),
                        notes: fd.get("note"),
                      }),
                );
              }}
            >
              {dialog === "payment" ? (
                <>
                  <label>
                    المبلغ
                    <PriceInput
                      type="number"
                      name="amount"
                      required
                      min="0.01"
                      max={balance(b)}
                      step="0.01"
                    />
                  </label>
                  <label>
                    تاريخ الدفع
                    <input
                      type="date"
                      name="date"
                      required
                      defaultValue={data.today}
                    />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    موعد البروفة (بتوقيت جهازك)
                    <input
                      type="datetime-local"
                      name="at"
                      required
                      defaultValue={
                        f ? localDateTime(f.scheduled_at) : undefined
                      }
                    />
                  </label>
                  <label>
                    حالة البروفة
                    <select
                      name="status"
                      defaultValue={f?.status || "scheduled"}
                    >
                      <option value="scheduled">مجدول</option>
                      <option value="completed">مكتمل</option>
                      <option value="cancelled">ملغى</option>
                    </select>
                  </label>
                </>
              )}
              <label>
                ملاحظات
                <textarea
                  name="note"
                  defaultValue={dialog === "fitting" ? f?.notes : ""}
                />
              </label>
              <button className="primary full" disabled={busy}>
                {busy ? "جارٍ الحفظ…" : "حفظ"}
              </button>
            </form>
          )}
          {error && <p className="alert">{error}</p>}
        </Modal>
      )}
    </div>
  );
}
function localDateTime(date: string) {
  const d = new Date(date);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
