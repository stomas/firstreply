import { Section, SectionHeading } from "@/components/ui/Section";
import { DEMOS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function DemoExamples() {
  return (
    <Section id="demo-pavyzdziai">
      <SectionHeading
        eyebrow="Demo"
        title="Kaip atrodo paruoštas atsakymas"
        subtitle="Tikroviški pavyzdžiai iš terasų, tvorų ir stoginių srities. Atkreipkite dėmesį, kaip skiriasi saugus automatinis atsakymas ir rankinis patikrinimas."
      />

      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {DEMOS.map((demo) => (
          <article
            key={demo.id}
            className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <span className="text-sm font-semibold text-ink">
                {demo.service}
              </span>
              <StatusBadge status={demo.status} label={demo.statusLabel} />
            </div>

            <div className="space-y-4 p-5">
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Užklausa
                </p>
                <blockquote className="rounded-xl bg-slate-50 p-3.5 text-sm leading-relaxed text-ink-soft">
                  {demo.inquiry}
                </blockquote>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {demo.status === "review"
                    ? "Kodėl rankinis patikrinimas"
                    : "Paruoštas atsakymas"}
                </p>
                <div
                  className={cn(
                    "space-y-2 rounded-xl border p-3.5 text-sm leading-relaxed",
                    demo.status === "review"
                      ? "border-amber-200 bg-amber-50 text-amber-900"
                      : "border-brand-100 bg-brand-50/50 text-ink-soft",
                  )}
                >
                  {demo.reply.map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-ink-muted">
        Kainos rėžiai pavyzdžiuose pažymėti „…“ — realioje sistemoje jie
        užpildomi pagal jūsų patvirtintas kainodaros taisykles.
      </p>
    </Section>
  );
}

function StatusBadge({
  status,
  label,
}: {
  status: "auto" | "review";
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        status === "review"
          ? "bg-amber-100 text-amber-800"
          : "bg-brand-100 text-brand-800",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "review" ? "bg-amber-500" : "bg-brand-500",
        )}
      />
      {label}
    </span>
  );
}
