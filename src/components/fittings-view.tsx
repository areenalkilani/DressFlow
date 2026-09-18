"use client";
import { useState } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { shiftDate } from "@/lib/domain";
import type { ShopData } from "@/lib/types";
import { Badge, Empty } from "./ui";
export function FittingsView({
  data,
  onOpen,
}: {
  data: ShopData;
  onOpen: (id: string) => void;
}) {
  const [view, setView] = useState("month");
  const [day, setDay] = useState(data.today);
  const asDate = (d: string) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: data.settings.timezone,
    }).format(new Date(d));
  const first =
    view === "month"
      ? day.slice(0, 7) + "-01"
      : view === "week"
        ? shiftDate(day, -new Date(day + "T12:00:00Z").getUTCDay())
        : day;
  const count =
    view === "month"
      ? new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)), 0).getDate()
      : view === "week"
        ? 7
        : 1;
  const end = shiftDate(first, count - 1);
  const fits = data.fittings.filter(
    (f) =>
      view === "list" ||
      (asDate(f.scheduled_at) >= first && asDate(f.scheduled_at) <= end),
  );
  return (
    <>
      <div className="toolbar">
        <div className="segmented">
          {[
            ["day", "يومي"],
            ["week", "أسبوعي"],
            ["month", "شهري"],
            ["list", "قائمة"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={view === key ? "selected" : ""}
              onClick={() => setView(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="title-actions">
          <button
            className="icon-button"
            aria-label="الفترة السابقة"
            onClick={() =>
              setDay(shiftDate(first, view === "month" ? -1 : -count))
            }
          >
            <ChevronRight size={18} />
          </button>
          <input
            type="date"
            aria-label="تاريخ العرض"
            value={day}
            onChange={(e) => {
              if (e.target.value) setDay(e.target.value);
            }}
          />
          <button
            className="icon-button"
            aria-label="الفترة التالية"
            onClick={() => setDay(shiftDate(first, count))}
          >
            <ChevronLeft size={18} />
          </button>
        </div>
      </div>
      {view === "list" ? (
        <div className="panel">
          {fits.length ? (
            fits.map((f) => {
              const b = data.bookings.find((b) => b.id === f.booking_id);
              return (
                <button
                  className="fitting-list-row"
                  key={f.id}
                  onClick={() => onOpen(f.booking_id)}
                >
                  <span>
                    <b>{b?.customer_name}</b>
                    <small>{b?.customer_phone}</small>
                  </span>
                  <span>
                    {new Date(f.scheduled_at).toLocaleString("ar-PS", {
                      timeZone: data.settings.timezone,
                    })}
                  </span>
                  <span>
                    المناسبة: {b?.event_date}
                    <small>
                      {b?.booking_items.map((i) => i.dress_code).join("، ")}
                    </small>
                  </span>
                  <Badge status={f.status} />
                </button>
              );
            })
          ) : (
            <Empty title="لا توجد مواعيد بروفة" />
          )}
        </div>
      ) : (
        <div className={`calendar calendar-${view}`}>
          {Array.from({ length: count }, (_, i) => shiftDate(first, i)).map(
            (date) => (
              <div
                key={date}
                className={`calendar-cell ${date === data.today ? "is-today" : ""}`}
              >
                <header>
                  {new Date(date + "T12:00:00Z").toLocaleDateString("ar-PS", {
                    weekday: "short",
                    day: "numeric",
                  })}
                </header>
                {fits
                  .filter((f) => asDate(f.scheduled_at) === date)
                  .map((f) => (
                    <button
                      key={f.id}
                      className={`calendar-event ${f.status}`}
                      onClick={() => onOpen(f.booking_id)}
                    >
                      <b>
                        {
                          data.bookings.find((b) => b.id === f.booking_id)
                            ?.customer_name
                        }
                      </b>
                      <small>
                        {new Date(f.scheduled_at).toLocaleTimeString("ar-PS", {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: data.settings.timezone,
                        })}
                      </small>
                    </button>
                  ))}
              </div>
            ),
          )}
        </div>
      )}
    </>
  );
}
