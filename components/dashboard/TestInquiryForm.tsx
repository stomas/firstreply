"use client";

import { useState, type FormEvent } from "react";
import type { TestLeadResult } from "@/lib/leads/create-test-lead";
import type { LeadProcessingTrace } from "@/lib/leads/test-pipeline";
import { TestResult, TracePanel } from "@/components/dashboard/TestResult";

type ServiceOption = {
  id: string;
  name: string;
};

type ApiResponse =
  | { ok: true; result: TestLeadResult }
  | {
      ok: false;
      error: string;
      fields?: Record<string, string>;
      trace?: LeadProcessingTrace;
    };

export function TestInquiryForm({ services }: { services: ServiceOption[] }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [result, setResult] = useState<TestLeadResult | null>(null);
  const [errorTrace, setErrorTrace] = useState<LeadProcessingTrace | null>(
    null,
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setFields({});
    setResult(null);
    setErrorTrace(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      serviceId: String(formData.get("serviceId") ?? ""),
      customerName: String(formData.get("customerName") ?? ""),
      customerEmail: String(formData.get("customerEmail") ?? ""),
      customerPhone: String(formData.get("customerPhone") ?? ""),
      city: String(formData.get("city") ?? ""),
      inquiryMessage: String(formData.get("inquiryMessage") ?? ""),
    };

    try {
      const response = await fetch("/api/dashboard/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await response.json()) as ApiResponse;

      if (!json.ok) {
        setError(json.error);
        setFields(json.fields ?? {});
        setErrorTrace(json.trace ?? null);
        return;
      }

      setResult(json.result);
    } catch {
      setError("response generation error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(360px,480px)_minmax(0,1fr)]">
      <form
        onSubmit={onSubmit}
        className="min-w-0 rounded-lg border border-line bg-white p-4 shadow-cardsoft sm:p-5"
      >
        <div className="grid gap-4">
          <FieldError message={error} />

          <label className="grid gap-1 text-sm font-semibold text-ink">
            Paslauga
            <select
              name="serviceId"
              className="min-w-0 rounded-lg border border-line bg-white px-3 py-2 font-normal"
            >
              <option value="">Auto-detect iš užklausos</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
            <FieldError message={fields.serviceId} />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput
              label="Kliento vardas"
              name="customerName"
              error={fields.customerName}
            />
            <TextInput
              label="El. paštas"
              name="customerEmail"
              type="email"
              error={fields.customerEmail}
            />
            <TextInput
              label="Telefonas"
              name="customerPhone"
              error={fields.customerPhone}
            />
            <TextInput label="Miestas" name="city" error={fields.city} />
          </div>

          <label className="grid gap-1 text-sm font-semibold text-ink">
            Užklausa
            <textarea
              name="inquiryMessage"
              required
              rows={5}
              className="min-h-32 resize-y rounded-lg border border-line px-3 py-2 font-normal leading-relaxed"
            />
            <FieldError message={fields.inquiryMessage} />
          </label>

          <p className="text-xs leading-relaxed text-ink-muted">
            Kainos, termino klausimai ir skuba atpažįstami automatiškai iš
            užklausos teksto — kaip ir su tikra kliento žinute.
          </p>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-brand px-5 py-3 text-sm font-bold text-white shadow-cta hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Testuojama..." : "Testuoti atsakymą"}
          </button>
        </div>
      </form>

      {result ? (
        <TestResult result={result} />
      ) : errorTrace ? (
        <div className="min-w-0 rounded-lg border border-line bg-white p-4 shadow-cardsoft sm:p-5">
          <div className="text-sm font-bold text-warn-text">
            Užklausa sustojo prieš rezultatą
          </div>
          <TracePanel trace={errorTrace} className="mt-4" />
        </div>
      ) : (
        <div className="min-w-0 rounded-lg border border-line bg-white p-4 text-sm text-ink-soft shadow-cardsoft sm:p-5">
          Rezultatas atsiras sukūrus testinį lead įrašą.
        </div>
      )}
    </div>
  );
}

function TextInput({
  label,
  name,
  type = "text",
  error,
}: {
  label: string;
  name: string;
  type?: string;
  error?: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-ink">
      {label}
      <input
        name={name}
        type={type}
        className="min-w-0 rounded-lg border border-line px-3 py-2 font-normal"
      />
      <FieldError message={error} />
    </label>
  );
}

function FieldError({ message }: { message?: string | null }) {
  if (!message) {
    return null;
  }

  return <span className="text-xs font-semibold text-red-700">{message}</span>;
}
