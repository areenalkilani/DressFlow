"use client";
import { useEffect, useRef, type InputHTMLAttributes } from "react";

// Keep native decimal/min/max validation without accidental stepping.
export function PriceInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const input = ref.current;
    const preventStep = (event: WheelEvent) => {
      if (document.activeElement === input) event.preventDefault();
    };
    input?.addEventListener("wheel", preventStep, { passive: false });
    return () => input?.removeEventListener("wheel", preventStep);
  }, []);
  return (
    <input
      {...props}
      ref={ref}
      type="number"
      inputMode="decimal"
      className={`price-input ${props.className || ""}`}
      onKeyDown={(event) => {
        if (event.key === "ArrowUp" || event.key === "ArrowDown")
          event.preventDefault();
        props.onKeyDown?.(event);
      }}
    />
  );
}
