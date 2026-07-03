"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
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
  source: "web-forma",
  companyWebsite: "",
};

const labelClass = "block text-sm font-medium text-ink";
const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-ink shadow-sm outline-none transition-colors placeholder:text-ink-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30";
const errorClass = "mt-1 text-xs font-medium text-red-600";

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

    // Client-side validation with the shared schema.
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
      <div
        role="status"
        className="rounded-2xl border border-brand-200 bg-brand-50 p-8 text-center"
      >
        <span
          aria-hidden
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <h3 className="mt-4 text-xl font-bold text-ink">
          Ačiū! Užklausa gauta.
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Susisieksime su jumis el. paštu ir suderinsime demo laiką. Paprastai
          atsakome per 1 darbo dieną.
        </p>
        <Button
          variant="secondary"
          className="mt-6"
          onClick={() => setStatus("idle")}
        >
          Siųsti dar vieną
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-8"
    >
      {/* Honeypot — visually hidden, off screen, ignored by real users. */}
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className={labelClass}>
            Vardas <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            autoComplete="name"
            className={inputClass}
            placeholder="Vardas Pavardė"
            value={values.name}
            onChange={(e) => update("name", e.target.value)}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "name-error" : undefined}
          />
          {errors.name && (
            <p id="name-error" className={errorClass}>
              {errors.name}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="company" className={labelClass}>
            Įmonė <span className="text-red-500">*</span>
          </label>
          <input
            id="company"
            name="company"
            type="text"
            required
            autoComplete="organization"
            className={inputClass}
            placeholder="Jūsų įmonės pavadinimas"
            value={values.company}
            onChange={(e) => update("company", e.target.value)}
            aria-invalid={!!errors.company}
            aria-describedby={errors.company ? "company-error" : undefined}
          />
          {errors.company && (
            <p id="company-error" className={errorClass}>
              {errors.company}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="email" className={labelClass}>
            El. paštas <span className="text-red-500">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className={inputClass}
            placeholder="jus@imone.lt"
            value={values.email}
            onChange={(e) => update("email", e.target.value)}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          {errors.email && (
            <p id="email-error" className={errorClass}>
              {errors.email}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="phone" className={labelClass}>
            Telefonas{" "}
            <span className="font-normal text-ink-muted">(nebūtina)</span>
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            className={inputClass}
            placeholder="+370 6xx xxxxx"
            value={values.phone}
            onChange={(e) => update("phone", e.target.value)}
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? "phone-error" : undefined}
          />
          {errors.phone && (
            <p id="phone-error" className={errorClass}>
              {errors.phone}
            </p>
          )}
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="website" className={labelClass}>
            Svetainė{" "}
            <span className="font-normal text-ink-muted">(nebūtina)</span>
          </label>
          <input
            id="website"
            name="website"
            type="text"
            autoComplete="url"
            className={inputClass}
            placeholder="https://jusu-svetaine.lt"
            value={values.website}
            onChange={(e) => update("website", e.target.value)}
            aria-invalid={!!errors.website}
            aria-describedby={errors.website ? "website-error" : undefined}
          />
          {errors.website && (
            <p id="website-error" className={errorClass}>
              {errors.website}
            </p>
          )}
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="source" className={labelClass}>
            Iš kur šiuo metu gaunate užklausas?{" "}
            <span className="text-red-500">*</span>
          </label>
          <select
            id="source"
            name="source"
            required
            className={inputClass}
            value={values.source}
            onChange={(e) => update("source", e.target.value)}
            aria-invalid={!!errors.source}
            aria-describedby={errors.source ? "source-error" : undefined}
          >
            {LEAD_SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {errors.source && (
            <p id="source-error" className={errorClass}>
              {errors.source}
            </p>
          )}
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="message" className={labelClass}>
            Žinutė <span className="text-red-500">*</span>
          </label>
          <textarea
            id="message"
            name="message"
            required
            rows={4}
            className={inputClass}
            placeholder="Trumpai aprašykite savo veiklą ir kokias užklausas gaunate."
            value={values.message}
            onChange={(e) => update("message", e.target.value)}
            aria-invalid={!!errors.message}
            aria-describedby={errors.message ? "message-error" : undefined}
          />
          {errors.message && (
            <p id="message-error" className={errorClass}>
              {errors.message}
            </p>
          )}
        </div>
      </div>

      {serverError && status === "error" && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {serverError}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        className="mt-6 w-full"
        disabled={status === "submitting"}
      >
        {status === "submitting" ? "Siunčiama…" : "Gauti demo"}
      </Button>

      <p className="mt-3 text-center text-xs text-ink-muted">
        Paspausdami „Gauti demo“ sutinkate, kad susisieksime dėl demo. Duomenų
        trečiosioms šalims neperduodame.
      </p>
    </form>
  );
}
