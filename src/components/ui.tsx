"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X, Search, Inbox, ArrowLeft } from "lucide-react";
import { labels } from "@/lib/domain";
export function Badge({ status }: { status: string }) {
  return (
    <span className={`badge badge-${status}`}>{labels[status] || status}</span>
  );
}
export function Empty({
  title = "لا توجد بيانات بعد",
  description = "ستظهر التفاصيل هنا عند إضافة أول سجل.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span>
        <Inbox size={28} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "modal wide" : "modal"}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button className="icon-button" aria-label="إغلاق" onClick={onClose}>
          <X size={20} />
        </button>
      </header>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
export function SearchBox({
  value,
  onChange,
  placeholder = "ابحث بالاسم، رقم الهاتف أو رمز القطعة…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search-box">
      <Search size={18} />
      <input
        aria-label="بحث"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
export function SectionTitle({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="title-actions">{children}</div>
    </div>
  );
}
export function DressDrawing() {
  return (
    <svg viewBox="0 0 160 180" fill="none" aria-hidden="true">
      <path
        d="M62 25 72 36h16l10-11 9 12-12 31 32 87c-27 13-66 13-94 0l32-87-12-31 9-12Z"
        fill="currentColor"
        opacity=".14"
      />
      <path
        d="m62 25 10 11h16l10-11 9 12-12 31 32 87c-27 13-66 13-94 0l32-87-12-31 9-12Zm3 43h30M72 36l-7 32m23-32 7 32m-19 6-9 73m18-73 9 73"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M76 17a5 5 0 1 1 8 4v7"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}
export function SmallLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="text-button" onClick={onClick}>
      {children}
      <ArrowLeft size={15} />
    </button>
  );
}
