"use client";

import { useState, type FormEvent } from "react";
import type { TestLeadResult } from "@/lib/leads/create-test-lead";
import { TestResult } from "@/components/dashboard/TestResult";

type ServiceOption = {
  id: string;
  name: string;
};

type ApiResponse =
  | { ok: true; result: TestLeadResult }
  | { ok: false; error: string; fields?: Record<string, string> };

export function TestInquiryForm({ services }: { services: ServiceOption[] }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [result, setResult] = useState<TestLeadResult | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setFields({});
    setResult(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      serviceId: String(formData.get("serviceId") ?? ""),
      customerName: String(formData.get("customerName") ?? ""),
      customerEmail: String(formData.get("customerEmail") ?? ""),
      customerPhone: String(formData.get("customerPhone") ?? ""),
      city: String(formData.get("city") ?? ""),
      inquiryMessage: String(formData.get("inquiryMessage") ?? ""),
      asksPrice: formData.get("asksPrice") === "on",
      asksAvailability: formData.get("asksAvailability") === "on",
      isUrgent: formData.get("isUrgent") === "on",
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
    <div className="grid gap-5 lg:grid-cols-[minmax(0,520px)_1fr]">
      <form
        onSubmit={onSubmit}
        className="rounded-lg border border-line bg-white p-5 shadow-cardsoft"
      >
        <div className="grid gap-4">
          <FieldError message={error} />

          <label className="grid gap-1 text-sm font-semibold text-ink">
            Paslauga
            <select
              name="serviceId"
              required
              className="rounded-lg border border-line bg-white px-3 py-2 font-normal"
            >
              <option value="">Pasirinkite</option>
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
              rows={8}
              className="resize-y rounded-lg border border-line px-3 py-2 font-normal leading-relaxed"
            />
            <FieldError message={fields.inquiryMessage} />
          </label>

          <div className="grid gap-2 text-sm text-ink">
            <Checkbox name="asksPrice" label="Klientas klausia kainos" />
            <Checkbox
              name="asksAvailability"
              label="Klientas klausia termino / kada galite pradėti"
            />
            <Checkbox name="isUrgent" label="Skubu" />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-brand px-5 py-3 text-sm font-bold text-white shadow-cta hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Testuojama..." : "Testuoti atsakymą"}
          </button>
        </div>
      </form>

      {result ? (
        <TestResult result={result} />
      ) : (
        <div className="rounded-lg border border-line bg-white p-5 text-sm text-ink-soft shadow-cardsoft">
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
        className="rounded-lg border border-line px-3 py-2 font-normal"
      />
      <FieldError message={error} />
    </label>
  );
}

function Checkbox({ name, label }: { name: string; label: string }) {
  return (
    <label className="flex items-center gap-2">
      <input name={name} type="checkbox" className="h-4 w-4 accent-brand" />
      <span>{label}</span>
    </label>
  );
}

function FieldError({ message }: { message?: string | null }) {
  if (!message) {
    return null;
  }

  return <span className="text-xs font-semibold text-red-700">{message}</span>;
}
