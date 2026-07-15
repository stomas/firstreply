"use client";

import { useState } from "react";

export function CopyValueButton({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  return (
    <span>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setStatus("copied");
          } catch {
            setStatus("error");
          }
          window.setTimeout(() => setStatus("idle"), 1_500);
        }}
        aria-label={`Kopijuoti ${label}`}
        className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold text-brand hover:bg-brand-tint"
      >
        {status === "copied"
          ? "Nukopijuota"
          : status === "error"
            ? "Nepavyko"
            : "Kopijuoti"}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {status === "copied"
          ? `${label} nukopijuotas.`
          : status === "error"
            ? `Nepavyko nukopijuoti: ${label}.`
            : ""}
      </span>
    </span>
  );
}
