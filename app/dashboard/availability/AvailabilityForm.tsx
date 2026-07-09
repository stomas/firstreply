import Link from "next/link";
import {
  AVAILABILITY_STATUSES,
  type DashboardAvailabilityRow,
} from "@/lib/dashboard/availability";

type AvailabilityFormProps = {
  action: (formData: FormData) => Promise<void>;
  hiddenField: { name: "serviceId" | "ruleId"; value: string };
  rule?: DashboardAvailabilityRow;
  submitLabel: string;
};

export function AvailabilityForm({
  action,
  hiddenField,
  rule,
  submitLabel,
}: AvailabilityFormProps) {
  return (
    <form
      action={action}
      className="rounded-lg border border-line bg-white p-5 shadow-cardsoft"
    >
      <input type="hidden" name={hiddenField.name} value={hiddenField.value} />

      <section className="grid gap-4">
        <SectionHeading
          title="Regionas ir būsena"
          description="Palikite regioną tuščią, jei įrašas galioja visur, kur atskiro įrašo nėra."
        />
        <label className="grid max-w-xs gap-1 text-sm font-semibold text-ink">
          Regionas / miestas
          <input
            name="location"
            defaultValue={rule?.location ?? ""}
            placeholder="Pvz. Vilnius (tuščia — kiti regionai)"
            className="rounded-lg border border-line px-3 py-2 font-normal"
          />
        </label>
        <div className="grid gap-2">
          <div className="text-sm font-semibold text-ink">Būsena</div>
          {AVAILABILITY_STATUSES.map((status) => (
            <label
              key={status.value}
              className="flex items-start gap-2 rounded-lg border border-line p-3 text-sm font-semibold text-ink"
            >
              <input
                type="radio"
                name="status"
                value={status.value}
                defaultChecked={
                  rule
                    ? rule.status === status.value
                    : status.value === "available"
                }
                className="mt-0.5 h-4 w-4 accent-brand"
              />
              <span>
                {status.label}
                <span className="block font-normal text-ink-soft">
                  {status.description}
                </span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="mt-7 grid gap-4 border-t border-line pt-6">
        <SectionHeading
          title="Tekstas klientui"
          description="Terminas ir pastaba, kurie gali būti rodomi atsakyme."
        />
        <label className="grid gap-1 text-sm font-semibold text-ink">
          Anksčiausias terminas
          <input
            name="earliestStartText"
            defaultValue={rule?.earliestStartText ?? ""}
            placeholder="Pvz. Per 3-5 savaites"
            className="rounded-lg border border-line px-3 py-2 font-normal"
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-ink">
          Pastaba klientui
          <textarea
            name="noteForCustomer"
            rows={3}
            defaultValue={rule?.noteForCustomer ?? ""}
            placeholder="Pvz. Terminą patiksliname gavę objekto informaciją."
            className="resize-y rounded-lg border border-line px-3 py-2 font-normal leading-relaxed"
          />
        </label>
      </section>

      <section className="mt-7 grid gap-4 border-t border-line pt-6">
        <SectionHeading
          title="Galiojimas ir siuntimas"
          description="Pasibaigus galiojimui įrašas pažymimas kaip nebegaliojantis — atnaujinkite terminus."
        />
        <label className="grid max-w-xs gap-1 text-sm font-semibold text-ink">
          Galioja iki
          <input
            name="validUntil"
            type="date"
            defaultValue={rule?.validUntil ?? ""}
            className="rounded-lg border border-line px-3 py-2 font-normal"
          />
        </label>
        <label className="flex items-start gap-2 text-sm font-semibold text-ink">
          <input
            name="autoSendAllowed"
            type="checkbox"
            defaultChecked={rule?.autoSendAllowed ?? false}
            className="mt-0.5 h-4 w-4 accent-brand"
          />
          <span>
            Leisti auto-send — terminas gali būti siunčiamas automatiškai
          </span>
        </label>
      </section>

      <div className="mt-7 flex flex-wrap items-center justify-end gap-3 border-t border-line pt-5">
        <Link
          href="/dashboard/availability"
          className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-bold text-ink-soft hover:bg-line-soft"
        >
          Atšaukti
        </Link>
        <button
          type="submit"
          className="rounded-lg bg-brand px-5 py-2 text-sm font-bold text-white shadow-cta hover:bg-brand-hover"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-base font-extrabold text-ink">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">
        {description}
      </p>
    </div>
  );
}
