import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteButton } from "@/components/dashboard/DeleteButton";
import { DashboardError } from "@/components/dashboard/DashboardError";
import { getAppErrorMessage } from "@/lib/app-errors";
import { getCurrentClient } from "@/lib/client-context";
import {
  getSuperAdminConfig,
  isSuperAdminEnabled,
  type SuperAdminConfig,
  type SuperAdminPricingRuleRow,
  type SuperAdminRequirementRow,
  type SuperAdminServiceGroup,
  type SuperAdminSubjectRow,
} from "@/lib/dashboard/super-admin";
import { cn } from "@/lib/utils";
import {
  createSuperAdminPricingRuleAction,
  createSuperAdminRequirementAction,
  createSuperAdminSubjectAction,
  deactivateSuperAdminPricingRuleAction,
  deactivateSuperAdminRequirementAction,
  deleteSuperAdminSubjectAction,
  updateSuperAdminPricingRuleAction,
  updateSuperAdminRequirementAction,
  updateSuperAdminSubjectAction,
} from "./actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    updated?: string;
    deleted?: string;
    error?: string;
  }>;
};

const DIMENSIONS = [
  { value: "length", label: "length" },
  { value: "height", label: "height" },
  { value: "width", label: "width" },
  { value: "area", label: "area" },
] as const;

const MODIFIER_ROWS = 3;

export default async function SuperAdminPage({ searchParams }: PageProps) {
  if (!isSuperAdminEnabled()) {
    notFound();
  }

  try {
    const query = await searchParams;
    const client = await getCurrentClient();
    const config = await getSuperAdminConfig(client.id);

    return (
      <div className="mx-auto max-w-content">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-sm font-bold uppercase text-brand">
              Super Admin
            </div>
            <h1 className="mt-1 text-3xl font-extrabold text-ink">
              System Config
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-soft">
              Techninė konfigūracija request understanding ir kainodaros
              taisyklėms. MVP 1 keičia tik dabartinio kliento paslaugas, temas,
              advanced requirements ir pricing rules.
            </p>
          </div>
          <Link
            href="/dashboard/test"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white shadow-cta hover:bg-brand-hover"
          >
            Test this configuration
          </Link>
        </header>

        <SeedWarning />
        <SummaryGrid summary={config.summary} />
        <FlashMessages
          updated={query?.updated}
          deleted={query?.deleted}
          error={query?.error}
        />

        {config.groups.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mt-6 grid gap-6">
            {config.groups.map((group) => (
              <ServiceConfigCard
                key={group.serviceId}
                group={group}
                config={config}
              />
            ))}
          </div>
        )}
      </div>
    );
  } catch (error) {
    console.error("[super-admin] failed to load:", error);
    return (
      <div className="mx-auto max-w-content">
        <DashboardError message={getAppErrorMessage(error)} />
      </div>
    );
  }
}

function SeedWarning() {
  return (
    <section className="mb-4 rounded-lg border border-warn-border bg-warn-bg px-4 py-3 text-sm font-semibold leading-relaxed text-warn-text">
      Ši konfigūracija skirta testavimui. Paleidus{" "}
      <code className="font-bold">`npm run db:seed`</code>, dalis pakeitimų gali
      būti perrašyta.
    </section>
  );
}

function SummaryGrid({ summary }: { summary: SuperAdminConfig["summary"] }) {
  const items = [
    { label: "Paslaugos", value: summary.servicesCount },
    { label: "Temos", value: summary.subjectsCount },
    { label: "Aktyvūs requirements", value: summary.activeRequirementsCount },
    { label: "Aktyvi kainodara", value: summary.activePricingRulesCount },
    { label: "Unsupported JSON", value: summary.unsupportedJsonCount },
    { label: "Broken refs", value: summary.brokenReferencesCount },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-line bg-white p-4 shadow-cardsoft"
        >
          <div className="text-xs font-extrabold uppercase text-ink-muted">
            {item.label}
          </div>
          <div className="mt-1 text-3xl font-extrabold text-ink">
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function FlashMessages({
  updated,
  deleted,
  error,
}: {
  updated?: string;
  deleted?: string;
  error?: string;
}) {
  return (
    <>
      {updated ? (
        <div className="mt-4 rounded-lg border border-brand-tintborder bg-brand-tint px-4 py-3 text-sm font-semibold text-brand">
          Konfigūracija išsaugota.
        </div>
      ) : null}
      {deleted ? (
        <div className="mt-4 rounded-lg border border-brand-tintborder bg-brand-tint px-4 py-3 text-sm font-semibold text-brand">
          Įrašas pašalintas arba deaktyvuotas.
        </div>
      ) : null}
      {error ? (
        <div className="mt-4 rounded-lg border border-warn-border bg-warn-bg px-4 py-3 text-sm font-semibold text-warn-text">
          {error}
        </div>
      ) : null}
    </>
  );
}

function ServiceConfigCard({
  group,
  config,
}: {
  group: SuperAdminServiceGroup;
  config: SuperAdminConfig;
}) {
  return (
    <article className="rounded-lg border border-line bg-white p-5 shadow-cardsoft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-ink">
            {group.serviceName}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Service ID: <code>{group.serviceId}</code>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!group.serviceActive ? <Badge tone="muted">Neaktyvi</Badge> : null}
          <Link
            href="/dashboard/test"
            className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold text-ink-soft hover:bg-line-soft"
          >
            Test this configuration
          </Link>
        </div>
      </div>

      <ConfigSection
        title="Subjects"
        description="service_subjects konfigūracija deterministiniam temos atpažinimui."
      >
        <SubjectList group={group} serviceOptions={config.groups} />
      </ConfigSection>

      <ConfigSection
        title="Requirements Advanced"
        description="Techniniai expectedFact, validation ir requirementKey laukai."
      >
        <RequirementList group={group} />
      </ConfigSection>

      <ConfigSection
        title="Pricing Builder"
        description="Ribotas builderis tik dabartinio engine palaikomai pricing_rules.rule struktūrai."
      >
        <PricingRuleList group={group} />
      </ConfigSection>
    </article>
  );
}

function ConfigSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 border-t border-line pt-5">
      <div className="mb-4">
        <h3 className="text-base font-extrabold text-ink">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

function SubjectList({
  group,
  serviceOptions,
}: {
  group: SuperAdminServiceGroup;
  serviceOptions: SuperAdminServiceGroup[];
}) {
  return (
    <div className="grid gap-4">
      {group.subjects.length === 0 ? (
        <SectionEmpty>Temų šiai paslaugai dar nėra.</SectionEmpty>
      ) : (
        group.subjects.map((subject) => (
          <SubjectForm
            key={subject.id}
            subject={subject}
            group={group}
            serviceOptions={serviceOptions}
          />
        ))
      )}

      <InlineCreate title="Nauja tema">
        <SubjectForm group={group} serviceOptions={serviceOptions} />
      </InlineCreate>
    </div>
  );
}

function SubjectForm({
  group,
  serviceOptions,
  subject,
}: {
  group: SuperAdminServiceGroup;
  serviceOptions: SuperAdminServiceGroup[];
  subject?: SuperAdminSubjectRow;
}) {
  return (
    <form
      action={
        subject ? updateSuperAdminSubjectAction : createSuperAdminSubjectAction
      }
      className="grid gap-3 rounded-lg border border-line bg-line-soft p-4"
    >
      {subject ? (
        <input type="hidden" name="subjectId" value={subject.id} />
      ) : null}
      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr]">
        <label className="grid gap-1 text-sm font-semibold text-ink">
          Service
          <select
            name="serviceId"
            defaultValue={subject?.serviceId ?? group.serviceId}
            className="rounded-lg border border-line bg-white px-3 py-2 font-normal"
          >
            {serviceOptions.map((service) => (
              <option key={service.serviceId} value={service.serviceId}>
                {service.serviceName}
              </option>
            ))}
          </select>
        </label>
        <TextInput
          name="subjectKey"
          label="subjectKey"
          defaultValue={subject?.subjectKey}
          placeholder="fence"
          required
        />
        <TextInput
          name="labelLt"
          label="labelLt"
          defaultValue={subject?.labelLt}
          placeholder="Tvora"
          required
        />
      </div>
      <TextInput
        name="descriptionLt"
        label="descriptionLt"
        defaultValue={subject?.descriptionLt}
        placeholder="Segmentinės, skardinės ir kitos tvoros."
        required
      />
      <TextInput
        name="synonyms"
        label="Synonyms, comma-separated"
        defaultValue={subject?.synonyms.join(", ")}
        placeholder="tvora, tvoros, segmentai"
      />
      {subject ? (
        <JsonPreview title="JSON preview" value={subject.rawJsonPreview} />
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        {subject ? (
          <DeleteButton
            action={deleteSuperAdminSubjectAction.bind(null, subject.id)}
            confirmText={`Ištrinti temą „${subject.labelLt}“? Veiksmas negrįžtamas ir bus blokuojamas, jei ją naudoja aktyvūs klausimai.`}
            renderAs="button"
          />
        ) : null}
        <SubmitButton>
          {subject ? "Išsaugoti temą" : "Sukurti temą"}
        </SubmitButton>
      </div>
    </form>
  );
}

function RequirementList({ group }: { group: SuperAdminServiceGroup }) {
  return (
    <div className="grid gap-4">
      {group.requirements.length === 0 ? (
        <SectionEmpty>Requirements šiai paslaugai dar nėra.</SectionEmpty>
      ) : (
        group.requirements.map((requirement) => (
          <RequirementForm
            key={requirement.id}
            group={group}
            requirement={requirement}
          />
        ))
      )}

      <InlineCreate title="Naujas requirement">
        <RequirementForm group={group} />
      </InlineCreate>
    </div>
  );
}

function RequirementForm({
  group,
  requirement,
}: {
  group: SuperAdminServiceGroup;
  requirement?: SuperAdminRequirementRow;
}) {
  const subjectOptions = includeCurrentSubject(group.subjects, requirement);

  return (
    <form
      action={
        requirement
          ? updateSuperAdminRequirementAction
          : createSuperAdminRequirementAction
      }
      className="grid gap-3 rounded-lg border border-line bg-line-soft p-4"
    >
      <input type="hidden" name="serviceId" value={group.serviceId} />
      <input type="hidden" name="expectedKind" value="measurement" />
      {requirement ? (
        <input type="hidden" name="requirementId" value={requirement.id} />
      ) : null}

      {requirement && !requirement.expectedFactSupported ? (
        <WarningText>
          Unsupported expectedFact struktūra. Išsaugojus forma pakeis ją į MVP 1
          measurement shape.
        </WarningText>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
        <TextInput
          name="requirementKey"
          label="requirementKey"
          defaultValue={requirement?.requirementKey}
          placeholder="fence_length"
          required
        />
        <TextInput
          name="label"
          label="Label"
          defaultValue={requirement?.label}
          placeholder="Tvoros ilgis"
          required
        />
      </div>
      <label className="grid gap-1 text-sm font-semibold text-ink">
        Question text
        <textarea
          name="question"
          required
          rows={2}
          defaultValue={requirement?.question}
          placeholder="Kiek metrų tvoros reikėtų?"
          className="resize-y rounded-lg border border-line bg-white px-3 py-2 font-normal leading-relaxed"
        />
      </label>

      <div className="grid gap-3 md:grid-cols-4">
        <ReadOnlyField label="expectedFact.kind" value="measurement" />
        <label className="grid gap-1 text-sm font-semibold text-ink">
          subject
          <select
            name="subjectKey"
            defaultValue={requirement?.subjectKey ?? ""}
            className="rounded-lg border border-line bg-white px-3 py-2 font-normal"
          >
            <option value="">Be temos</option>
            {subjectOptions.map((subject) => (
              <option key={subject.subjectKey} value={subject.subjectKey}>
                {subject.labelLt} ({subject.subjectKey})
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-ink">
          dimension
          <select
            name="dimension"
            defaultValue={requirement?.dimension ?? "length"}
            className="rounded-lg border border-line bg-white px-3 py-2 font-normal"
          >
            {DIMENSIONS.map((dimension) => (
              <option key={dimension.value} value={dimension.value}>
                {dimension.label}
              </option>
            ))}
          </select>
        </label>
        <TextInput
          name="units"
          label="units"
          defaultValue={requirement?.units.join(", ") || "m"}
          placeholder="m"
          required
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <TextInput
          name="validationMin"
          label="validation.min"
          defaultValue={formatInputNumber(requirement?.validationMin)}
          placeholder="1"
        />
        <TextInput
          name="validationMax"
          label="validation.max"
          defaultValue={formatInputNumber(requirement?.validationMax)}
          placeholder="500"
        />
        <TextInput
          name="priority"
          label="priority"
          defaultValue={formatInputNumber(requirement?.priority) || "100"}
          placeholder="100"
        />
      </div>

      <CheckboxGrid>
        <Checkbox
          name="required"
          label="required"
          defaultChecked={requirement?.required ?? true}
        />
        <Checkbox
          name="affectsPrice"
          label="affectsPrice"
          defaultChecked={requirement?.affectsPrice ?? true}
        />
        <Checkbox
          name="active"
          label="active"
          defaultChecked={requirement?.active ?? true}
        />
      </CheckboxGrid>

      {requirement ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <JsonPreview
            title="expectedFact JSON"
            value={requirement.expectedFactPreview}
          />
          <JsonPreview
            title="validation JSON"
            value={requirement.validationPreview}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        {requirement && requirement.active ? (
          <DeleteButton
            action={deactivateSuperAdminRequirementAction.bind(
              null,
              requirement.id,
            )}
            label="Deaktyvuoti"
            confirmText={`Deaktyvuoti requirement „${requirement.label}“? Veiksmas bus blokuojamas, jei aktyvi kainodara naudoja šį requirementKey.`}
            renderAs="button"
          />
        ) : null}
        <SubmitButton>
          {requirement ? "Išsaugoti requirement" : "Sukurti requirement"}
        </SubmitButton>
      </div>
    </form>
  );
}

function PricingRuleList({ group }: { group: SuperAdminServiceGroup }) {
  return (
    <div className="grid gap-4">
      {group.pricingRules.length === 0 ? (
        <SectionEmpty>
          Kainodaros taisyklių šiai paslaugai dar nėra.
        </SectionEmpty>
      ) : (
        group.pricingRules.map((rule) => (
          <PricingRuleForm key={rule.id} group={group} rule={rule} />
        ))
      )}

      <InlineCreate title="Nauja pricing rule">
        <PricingRuleForm group={group} />
      </InlineCreate>
    </div>
  );
}

function PricingRuleForm({
  group,
  rule,
}: {
  group: SuperAdminServiceGroup;
  rule?: SuperAdminPricingRuleRow;
}) {
  const activeRequirements = group.requirements.filter(
    (requirement) => requirement.active,
  );
  const builder = rule?.builder ?? null;
  const primaryRequirementKey =
    builder?.requirementKey ?? activeRequirements[0]?.requirementKey ?? "";
  const requirementOptions = includeCurrentRequirement(
    activeRequirements,
    primaryRequirementKey,
  );

  return (
    <form
      action={
        rule
          ? updateSuperAdminPricingRuleAction
          : createSuperAdminPricingRuleAction
      }
      className="grid gap-3 rounded-lg border border-line bg-line-soft p-4"
    >
      <input type="hidden" name="serviceId" value={group.serviceId} />
      {rule ? (
        <input type="hidden" name="pricingRuleId" value={rule.id} />
      ) : null}

      {rule && !rule.support.supported ? (
        <WarningText>
          Unsupported structure: {rule.support.reason} Išsaugojus forma pakeis
          JSON į palaikomą builder shape.
        </WarningText>
      ) : null}
      {activeRequirements.length === 0 ? (
        <WarningText>
          Kainodarai reikia bent vieno aktyvaus requirement šiai paslaugai.
        </WarningText>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
        <TextInput
          name="name"
          label="Name"
          defaultValue={rule?.name}
          placeholder="Segmentinė tvora pagal metrą"
          required
        />
        <label className="grid gap-1 text-sm font-semibold text-ink">
          rule.type
          <select
            name="ruleType"
            defaultValue={builder?.ruleType ?? "per_unit"}
            className="rounded-lg border border-line bg-white px-3 py-2 font-normal"
          >
            <option value="per_unit">per_unit</option>
            <option value="range_estimate">range_estimate</option>
          </select>
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <label className="grid gap-1 text-sm font-semibold text-ink md:col-span-2">
          rule.requirementKey
          <select
            name="requirementKey"
            defaultValue={primaryRequirementKey}
            className="rounded-lg border border-line bg-white px-3 py-2 font-normal"
            required
          >
            {requirementOptions.map((requirement) => (
              <option
                key={requirement.requirementKey}
                value={requirement.requirementKey}
              >
                {requirement.label} ({requirement.requirementKey})
              </option>
            ))}
          </select>
        </label>
        <TextInput
          name="ruleUnit"
          label="rule.unit"
          defaultValue={builder?.ruleUnit ?? "m"}
          placeholder="m"
          required
        />
        <TextInput
          name="currency"
          label="rule.currency"
          defaultValue={builder?.currency ?? "EUR"}
          placeholder="EUR"
          required
        />
      </div>

      <TextInput
        name="requires"
        label="rule.requires, comma-separated"
        defaultValue={builder?.requiresText ?? primaryRequirementKey}
        placeholder="fence_length, fence_height"
      />

      <div className="grid gap-3 md:grid-cols-4">
        <TextInput
          name="pricePerUnit"
          label="rule.pricePerUnit"
          defaultValue={formatInputNumber(builder?.pricePerUnit)}
          placeholder="38"
        />
        <TextInput
          name="priceMin"
          label="price min"
          defaultValue={formatInputNumber(rule?.priceMin)}
          placeholder="32"
        />
        <TextInput
          name="priceMax"
          label="price max"
          defaultValue={formatInputNumber(rule?.priceMax)}
          placeholder="75"
        />
        <TextInput
          name="unit"
          label="customer unit"
          defaultValue={rule?.unit ?? ""}
          placeholder="€/m"
        />
      </div>

      <fieldset className="grid gap-2 rounded-lg border border-line bg-white p-3">
        <legend className="px-1 text-sm font-extrabold text-ink">
          per_unit modifiers
        </legend>
        <p className="text-xs leading-relaxed text-ink-muted">
          Naudojama forma: if.requirementKey + gte → pricePerUnitDelta. Tuščios
          eilutės ignoruojamos.
        </p>
        {Array.from({ length: MODIFIER_ROWS }, (_, index) => (
          <ModifierRow
            key={index}
            index={index}
            modifier={builder?.modifiers[index]}
            requirements={activeRequirements}
          />
        ))}
      </fieldset>

      <CheckboxGrid>
        <Checkbox
          name="autoSendAllowed"
          label="auto-send allowed"
          defaultChecked={rule?.autoSendAllowed ?? false}
        />
        <Checkbox
          name="active"
          label="active"
          defaultChecked={rule?.active ?? true}
        />
      </CheckboxGrid>

      <label className="grid gap-1 text-sm font-semibold text-ink">
        disclaimer
        <textarea
          name="disclaimerText"
          rows={2}
          defaultValue={rule?.disclaimerText ?? ""}
          className="resize-y rounded-lg border border-line bg-white px-3 py-2 font-normal leading-relaxed"
        />
      </label>

      {rule ? (
        <JsonPreview title="Read-only rule JSON" value={rule.rulePreview} />
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        {rule && rule.active ? (
          <DeleteButton
            action={deactivateSuperAdminPricingRuleAction.bind(null, rule.id)}
            label="Deaktyvuoti"
            confirmText={`Deaktyvuoti kainodaros taisyklę „${rule.name}“?`}
            renderAs="button"
          />
        ) : null}
        <SubmitButton disabled={activeRequirements.length === 0}>
          {rule ? "Išsaugoti pricing rule" : "Sukurti pricing rule"}
        </SubmitButton>
      </div>
    </form>
  );
}

function ModifierRow({
  index,
  modifier,
  requirements,
}: {
  index: number;
  modifier?: { requirementKey: string; gte: number; pricePerUnitDelta: number };
  requirements: SuperAdminRequirementRow[];
}) {
  const options = includeCurrentRequirement(
    requirements,
    modifier?.requirementKey,
  );

  return (
    <div className="grid gap-2 md:grid-cols-3">
      <label className="grid gap-1 text-xs font-bold text-ink-muted">
        condition requirement
        <select
          name={`modifierRequirementKey_${index}`}
          defaultValue={modifier?.requirementKey ?? ""}
          className="rounded-lg border border-line bg-white px-3 py-2 font-normal text-ink"
        >
          <option value="">Be modifier</option>
          {options.map((requirement) => (
            <option
              key={requirement.requirementKey}
              value={requirement.requirementKey}
            >
              {requirement.requirementKey}
            </option>
          ))}
        </select>
      </label>
      <TextInput
        name={`modifierGte_${index}`}
        label="gte"
        defaultValue={formatInputNumber(modifier?.gte)}
        placeholder="1.7"
        small
      />
      <TextInput
        name={`modifierPricePerUnitDelta_${index}`}
        label="pricePerUnitDelta"
        defaultValue={formatInputNumber(modifier?.pricePerUnitDelta)}
        placeholder="6"
        small
      />
    </div>
  );
}

function InlineCreate({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className="rounded-lg border border-dashed border-line bg-white p-3">
      <summary className="cursor-pointer text-sm font-extrabold text-brand">
        {title}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function TextInput({
  name,
  label,
  defaultValue = "",
  placeholder,
  required,
  small,
}: {
  name: string;
  label: string;
  defaultValue?: string | number | null;
  placeholder?: string;
  required?: boolean;
  small?: boolean;
}) {
  return (
    <label
      className={cn(
        "grid gap-1 font-semibold text-ink",
        small ? "text-xs text-ink-muted" : "text-sm",
      )}
    >
      {label}
      <input
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        required={required}
        className="rounded-lg border border-line bg-white px-3 py-2 font-normal text-ink"
      />
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 text-sm font-semibold text-ink">
      {label}
      <div className="rounded-lg border border-line bg-white px-3 py-2 font-normal text-ink-soft">
        {value}
      </div>
    </div>
  );
}

function CheckboxGrid({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-4">{children}</div>;
}

function Checkbox({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-start gap-2 text-sm font-semibold text-ink">
      <input
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 accent-brand"
      />
      <span>{label}</span>
    </label>
  );
}

function JsonPreview({ title, value }: { title: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-xs font-extrabold uppercase text-ink-muted">
        {title}
      </div>
      <pre className="max-h-64 overflow-auto rounded-lg border border-line bg-white p-3 text-xs leading-relaxed text-ink-soft">
        {value}
      </pre>
    </div>
  );
}

function WarningText({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-warn-border bg-warn-bg px-3 py-2 text-sm font-semibold leading-relaxed text-warn-text">
      {children}
    </div>
  );
}

function SectionEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-line bg-line-soft px-3 py-3 text-sm leading-relaxed text-ink-soft">
      {children}
    </p>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "muted";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-extrabold uppercase",
        tone === "muted" && "border-line bg-line-soft text-ink-muted",
      )}
    >
      {children}
    </span>
  );
}

function SubmitButton({
  children,
  disabled,
}: {
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className={cn(
        "rounded-lg px-4 py-2 text-sm font-bold",
        disabled
          ? "cursor-not-allowed border border-line bg-line-soft text-ink-muted"
          : "bg-brand text-white shadow-cta hover:bg-brand-hover",
      )}
    >
      {children}
    </button>
  );
}

function EmptyState() {
  return (
    <section className="mt-6 rounded-lg border border-dashed border-line bg-white p-8 text-center shadow-cardsoft">
      <h2 className="text-xl font-extrabold text-ink">
        Konfigūracijos įrašų nėra
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
        Super Admin MVP 1 rodomas, kai dabartinis klientas turi paslaugų, temų,
        requirements arba pricing rules.
      </p>
    </section>
  );
}

function includeCurrentSubject(
  subjects: SuperAdminSubjectRow[],
  requirement?: SuperAdminRequirementRow,
): SuperAdminSubjectRow[] {
  if (
    !requirement?.subjectKey ||
    subjects.some((subject) => subject.subjectKey === requirement.subjectKey)
  ) {
    return subjects;
  }

  return [
    ...subjects,
    {
      id: requirement.subjectKey,
      serviceId: requirement.serviceId,
      subjectKey: requirement.subjectKey,
      labelLt: requirement.subjectKey,
      descriptionLt: "",
      synonyms: [],
      rawJsonPreview: "[]",
    },
  ];
}

function includeCurrentRequirement(
  requirements: SuperAdminRequirementRow[],
  requirementKey?: string,
): SuperAdminRequirementRow[] {
  if (
    !requirementKey ||
    requirements.some(
      (requirement) => requirement.requirementKey === requirementKey,
    )
  ) {
    return requirements;
  }

  return [
    ...requirements,
    {
      id: requirementKey,
      serviceId: "",
      requirementKey,
      label: requirementKey,
      question: "",
      expectedKind: "measurement",
      subjectKey: null,
      dimension: "length",
      units: ["m"],
      validationMin: null,
      validationMax: null,
      required: true,
      affectsPrice: true,
      active: true,
      priority: 100,
      expectedFactSupported: true,
      expectedFactPreview: "{}",
      validationPreview: "{}",
    },
  ];
}

function formatInputNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}
