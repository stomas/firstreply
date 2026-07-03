"use client";

import { useState, type FormEvent } from "react";
import { FINAL_CTA } from "@/lib/constants";
import {
  LEAD_SOURCES,
  leadSchema,
  fieldErrors,
  type LeadInput,
} from "@/lib/lead-schema";

type Status = "idle" | "submitting" | "success" | "error";

const initialValues: LeadInput = {
  name: "",
  company: "",
  email: "",
  phone: "",
  website: "",
  message: "",
  source: "abu",
  companyWebsite: "",
};

const labelClass =
  "flex flex-col gap-[7px] text-[13px] font-semibold text-ink";
const inputClass =
  "rounded-xl border border-line bg-page px-[14px] py-3 text-[15px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink-muted focus:border-brand focus:bg-white focus:ring-[3px] focus:ring-brand/15";
const optionalClass = "font-medium text-ink-muted";
const errorClass = "text-xs font-medium text-red-600";

export function LeadForm() {
  const [values, setValues] = useState<LeadInput>(initialValues);
  const [errors, setErrors] = useState<
    Partial<Record<keyof LeadInput, string>>
  >({});
  const [status, setStatus] = useState<Status>("idle");
  const [serverError, setServerError] = useState<string | null>(null);

  function update<K extends keyof LeadInput>(key: K, value: LeadInput[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);

    const parsed = leadSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      setStatus("error");
      return;
    }

    setErrors({});
    setStatus("submitting");

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data: {
        ok: boolean;
        error?: string;
        fields?: Partial<Record<keyof LeadInput, string>>;
      } = await res.json().catch(() => ({ ok: false }));

      if (!res.ok || !data.ok) {
        if (data.fields) setErrors(data.fields);
        setServerError(data.error ?? "Nepavyko išsiųsti. Bandykite dar kartą.");
        setStatus("error");
        return;
      }

      setStatus("success");
      setValues(initialValues);
    } catch {
      setServerError(
        "Įvyko tinklo klaida. Patikrinkite ryšį ir bandykite dar kartą.",
      );
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div role="status" className="px-2 py-6 text-center">
        <div className="mx-auto flex h-[60px] w-[60px] items-center justify-center rounded-full border border-brand-tintborder bg-brand-tint">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0F8F6A" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h3 className="mt-[18px] font-display text-[22px] font-extrabold text-ink">
          {FINAL_CTA.successTitle}
        </h3>
        <p className="mt-[10px] text-base leading-relaxed text-ink-soft">
          {FINAL_CTA.successText}
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-6 rounded-xl border border-line bg-white px-5 py-[11px] text-[15px] font-bold text-ink transition-colors hover:bg-line-soft"
        >
          Siųsti dar vieną
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-[18px]">
      {/* Honeypot — off-screen, ignored by real users. */}
      <div className="absolute left-[-9999px]" aria-hidden>
        <label htmlFor="companyWebsite">Įmonės svetainė (nepildyti)</label>
        <input
          type="text"
          id="companyWebsite"
          name="companyWebsite"
          tabIndex={-1}
          autoComplete="off"
          value={values.companyWebsite}
          onChange={(e) => update("companyWebsite", e.target.value)}
        />
      </div>

      <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        <label className={labelClass}>
          Vardas
          <input
            type="text"
            required
            autoComplete="name"
            className={inputClass}
            value={values.name}
            onChange={(e) => update("name", e.target.value)}
            aria-invalid={!!errors.name}
          />
          {errors.name && <span className={errorClass}>{errors.name}</span>}
        </label>

        <label className={labelClass}>
          Įmonė
          <input
            type="text"
            autoComplete="organization"
            className={inputClass}
            value={values.company}
            onChange={(e) => update("company", e.target.value)}
            aria-invalid={!!errors.company}
          />
          {errors.company && (
            <span className={errorClass}>{errors.company}</span>
          )}
        </label>

        <label className={labelClass}>
          El. paštas
          <input
            type="email"
            required
            autoComplete="email"
            className={inputClass}
            value={values.email}
            onChange={(e) => update("email", e.target.value)}
            aria-invalid={!!errors.email}
          />
          {errors.email && <span className={errorClass}>{errors.email}</span>}
        </label>

        <label className={labelClass}>
          <span className="whitespace-nowrap">
            Telefonas <span className={optionalClass}>(nebūtina)</span>
          </span>
          <input
            type="tel"
            autoComplete="tel"
            className={inputClass}
            value={values.phone}
            onChange={(e) => update("phone", e.target.value)}
            aria-invalid={!!errors.phone}
          />
          {errors.phone && <span className={errorClass}>{errors.phone}</span>}
        </label>

        <label className={labelClass}>
          <span className="whitespace-nowrap">
            Svetainė <span className={optionalClass}>(nebūtina)</span>
          </span>
          <input
            type="text"
            autoComplete="url"
            className={inputClass}
            value={values.website}
            onChange={(e) => update("website", e.target.value)}
            aria-invalid={!!errors.website}
          />
          {errors.website && (
            <span className={errorClass}>{errors.website}</span>
          )}
        </label>

        <label className={labelClass}>
          Iš kur ateina užklausos
          <select
            className={inputClass}
            value={values.source}
            onChange={(e) => update("source", e.target.value)}
          >
            {LEAD_SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className={labelClass}>
        Žinutė
        <textarea
          rows={4}
          className={`${inputClass} resize-y`}
          placeholder="Trumpai apie jūsų paslaugas arba įklijuokite kelias tipines užklausas"
          value={values.message}
          onChange={(e) => update("message", e.target.value)}
          aria-invalid={!!errors.message}
        />
        {errors.message && <span className={errorClass}>{errors.message}</span>}
      </label>

      {serverError && status === "error" && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {serverError}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="mt-1 rounded-[14px] bg-brand py-4 text-base font-bold text-white shadow-cta transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-70"
      >
        {status === "submitting" ? "Siunčiama…" : FINAL_CTA.cta}
      </button>

      <p className="text-center text-[13px] text-ink-muted">
        {FINAL_CTA.disclaimer}
      </p>
    </form>
  );
}
