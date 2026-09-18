"use client";
import { useState } from "react";
import { saveOffer } from "@/app/actions";
import { money } from "@/lib/domain";
import type { ShopData, Offer } from "@/lib/types";
import { PriceInput } from "./price-input";

export function OfferForm({
  data,
  offer,
  onSaved,
}: {
  data: ShopData;
  offer?: Offer;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState(offer?.kind || "percentage");
  const [scope, setScope] = useState(
    offer?.offer_targets.length ? "selected" : "all",
  );
  const [value, setValue] = useState(String(offer?.value ?? ""));
  const [minimum, setMinimum] = useState(String(offer?.min_items ?? 1));
  const [selectedDresses, setSelectedDresses] = useState(
    offer?.offer_targets.flatMap((t) => (t.dress_id ? [t.dress_id] : [])) || [],
  );
  const [selectedCategories, setSelectedCategories] = useState(
    offer?.offer_targets.flatMap((t) =>
      t.category_id ? [t.category_id] : [],
    ) || [],
  );
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const choices = [
    {
      id: "percentage",
      title: "خصم بنسبة",
      help: "مثال: خصم ٢٠٪ على القطع المختارة",
    },
    { id: "fixed", title: "خصم مبلغ", help: "مثال: خصم ١٠٠ شيكل من المجموع" },
    {
      id: "bundle",
      title: "باقة بسعر واحد",
      help: "مثال: بدلتان معاً بسعر ١٥٠٠ شيكل",
    },
  ];
  const fieldLabel =
    kind === "percentage"
      ? "نسبة الخصم (%)"
      : kind === "fixed"
        ? "مبلغ الخصم (شيكل)"
        : "السعر الإجمالي للباقة (شيكل)";
  const toggle = (values: string[], id: string) =>
    values.includes(id) ? values.filter((v) => v !== id) : [...values, id];
  const hasTargets = selectedDresses.length + selectedCategories.length > 0;
  return (
    <form
      className="offer-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        const fd = new FormData(e.currentTarget);
        if (scope === "selected" && !hasTargets) {
          setError("اختاري قطعة أو تصنيفاً واحداً على الأقل.");
          return;
        }
        if (String(fd.get("ends_on")) < String(fd.get("starts_on"))) {
          setError("تاريخ نهاية العرض يجب أن يكون بعد البداية أو بنفس اليوم.");
          return;
        }
        setBusy(true);
        try {
          await saveOffer({
            id: offer?.id,
            name: fd.get("name"),
            kind,
            value,
            min_items: minimum,
            starts_on: fd.get("starts_on"),
            ends_on: fd.get("ends_on"),
            active: fd.has("active"),
            targets:
              scope === "all"
                ? []
                : [
                    ...selectedDresses.map((dress_id) => ({ dress_id })),
                    ...selectedCategories.map((category_id) => ({
                      category_id,
                    })),
                  ],
          });
          onSaved();
        } catch {
          setError("تعذر حفظ العرض. تحققي من القيم وحاولي مرة أخرى.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <section className="offer-section">
        <h3>١. ما نوع العرض؟</h3>
        <label>
          اسم العرض
          <input
            name="name"
            required
            defaultValue={offer?.name}
            placeholder="مثال: عرض فساتين الصيف"
          />
        </label>
        <div className="offer-type-options" role="group" aria-label="نوع العرض">
          {choices.map((c) => (
            <button
              type="button"
              aria-pressed={kind === c.id}
              className={kind === c.id ? "selected" : ""}
              key={c.id}
              onClick={() => {
                setKind(c.id);
                setValue("");
              }}
            >
              <strong>{c.title}</strong>
              <small>{c.help}</small>
            </button>
          ))}
        </div>
        <div className="form-grid">
          <label>
            {fieldLabel}
            <PriceInput
              required
              min="0"
              max={kind === "percentage" ? 100 : 99999999}
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={
                kind === "percentage" ? "20" : kind === "fixed" ? "100" : "1500"
              }
            />
          </label>
          <label>
            يبدأ العرض عند حجز كم قطعة؟
            <input
              type="number"
              min="1"
              max="50"
              required
              value={minimum}
              onChange={(e) => setMinimum(e.target.value)}
            />
            <small>اختاري ١ إذا كان العرض ينطبق على قطعة واحدة.</small>
          </label>
        </div>
      </section>
      <section className="offer-section">
        <h3>٢. على أي قطع ينطبق؟</h3>
        <div className="segmented">
          <button
            type="button"
            className={scope === "all" ? "selected" : ""}
            onClick={() => setScope("all")}
          >
            كل القطع
          </button>
          <button
            type="button"
            className={scope === "selected" ? "selected" : ""}
            onClick={() => setScope("selected")}
          >
            قطع أو تصنيفات محددة
          </button>
        </div>
        {scope === "selected" && (
          <>
            <p className="muted">
              اختاري تصنيفاً كاملاً أو حددي البدلات بالاسم.
            </p>
            <h4>التصنيفات</h4>
            <div className="offer-targets">
              {data.categories.map((c) => (
                <label className="checkbox" key={c.id}>
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(c.id)}
                    onChange={() =>
                      setSelectedCategories(toggle(selectedCategories, c.id))
                    }
                  />
                  {c.name}
                </label>
              ))}
            </div>
            <label>
              ابحثي عن بدلة
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="اسم البدلة أو رمزها"
              />
            </label>
            <div className="target-list">
              {data.dresses
                .filter((d) =>
                  `${d.code} ${d.name}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .map((d) => (
                  <label className="checkbox" key={d.id}>
                    <input
                      type="checkbox"
                      checked={selectedDresses.includes(d.id)}
                      onChange={() =>
                        setSelectedDresses(toggle(selectedDresses, d.id))
                      }
                    />
                    {d.code} — {d.name}
                  </label>
                ))}
              {!data.dresses.length && (
                <p className="muted">لا توجد بدلات بعد.</p>
              )}
            </div>
            <small>
              {selectedDresses.length} بدلات و{selectedCategories.length}{" "}
              تصنيفات مختارة
            </small>
          </>
        )}
        {kind === "bundle" && (
          <p className="offer-explanation">
            سعر الباقة هو مجموع القطع المشمولة معاً، وليس سعر كل قطعة. إذا حددتِ
            بدلات بأسمائها، يجب إضافتها جميعاً للحجز. عند شمول تصنيف أو كل
            القطع، يُطبّق السعر على جميع القطع المؤهلة في الحجز بعد بلوغ العدد
            المحدد.
          </p>
        )}
      </section>
      <section className="offer-section">
        <h3>٣. متى يكون العرض سارياً؟</h3>
        <div className="form-grid">
          <label>
            من تاريخ
            <input
              type="date"
              name="starts_on"
              required
              defaultValue={offer?.starts_on || data.today}
            />
          </label>
          <label>
            حتى تاريخ
            <input
              type="date"
              name="ends_on"
              required
              defaultValue={offer?.ends_on}
            />
          </label>
        </div>
        <small className="muted">
          ينطبق على تاريخ المناسبة، وليس تاريخ إدخال الحجز.
        </small>
        <label className="checkbox">
          <input
            type="checkbox"
            name="active"
            defaultChecked={offer?.active ?? true}
          />{" "}
          تفعيل العرض
        </label>
      </section>
      <div className="offer-preview">
        <strong>ملخص العرض</strong>
        <p>
          {kind === "percentage"
            ? `خصم ${value || "…"}٪`
            : kind === "fixed"
              ? `خصم ${money(Number(value))} من المجموع`
              : `سعر الباقة ${money(Number(value))}`}{" "}
          — عند حجز {minimum || "…"} قطع أو أكثر من{" "}
          {scope === "all" ? "جميع القطع" : "القطع والتصنيفات التي اخترتِها"}.
        </p>
        <small>
          يختار النظام أفضل عرض مؤهل، ويمكنك الاتفاق على سعر نهائي مختلف في
          الحجز.
        </small>
      </div>
      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}
      <button className="primary full" disabled={busy}>
        {busy ? "جارٍ الحفظ…" : "حفظ العرض"}
      </button>
    </form>
  );
}
