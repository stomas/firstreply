import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteButton } from "@/components/dashboard/DeleteButton";
import { DashboardError } from "@/components/dashboard/DashboardError";
import { SuperAdminServiceDetails } from "@/components/dashboard/SuperAdminServiceDetails";
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
import {
  getAllowedPlaceholders,
  getSuperAdminOperationalConfig,
  type SuperAdminAutosendPolicyBuilder,
  type SuperAdminAutosendPolicyRow,
  type SuperAdminLocationZoneRow,
  type SuperAdminOperationalConfig,
  type SuperAdminResponseTemplateRow,
  type SuperAdminScheduleRuleRow,
} from "@/lib/dashboard/super-admin-operational";
import { cn } from "@/lib/utils";
import {
  createSuperAdminLocationZoneAction,
  createSuperAdminPricingRuleAction,
  createSuperAdminRequirementAction,
  createSuperAdminResponseTemplateAction,
  createSuperAdminScheduleRuleAction,
  createSuperAdminServiceAction,
  createSuperAdminSubjectAction,
  deactivateSuperAdminResponseTemplateAction,
  deactivateSuperAdminPricingRuleAction,
  deactivateSuperAdminRequirementAction,
  deleteSuperAdminLocationZoneAction,
  deleteSuperAdminScheduleRuleAction,
  deleteSuperAdminServiceAction,
  saveSuperAdminAutosendPolicyAction,
  updateSuperAdminLocationZoneAction,
  deleteSuperAdminSubjectAction,
  updateSuperAdminPricingRuleAction,
  updateSuperAdminRequirementAction,
  updateSuperAdminResponseTemplateAction,
  updateSuperAdminScheduleRuleAction,
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
const DEFAULT_AUTOSEND_BUILDER: SuperAdminAutosendPolicyBuilder = {
  enabled: false,
  requireAllRequiredResolved: true,
  allowDeterministicSource: true,
  allowFormFieldSource: true,
  aiEvidenceVerifiedRequired: true,
  aiMinConfidence: 0.85,
  aiValidationPassedRequired: true,
  blockIfConflicts: true,
  blockIfRange: false,
  autoSendConfidence: 0.85,
  draftForReviewConfidence: 0.6,
  aiClassifiedServiceAllowedForAutoSend: false,
};

export default async function SuperAdminPage({ searchParams }: PageProps) {
  if (!isSuperAdminEnabled()) {
    notFound();
  }

  try {
    const query = await searchParams;
    const client = await getCurrentClient();
    const [config, operationalConfig] = await Promise.all([
      getSuperAdminConfig(client.id),
      getSuperAdminOperationalConfig({
        id: client.id,
        tenantId: client.tenantId,
      }),
    ]);

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
              Techninė konfigūracija request understanding, kainodaros ir
              tenant-level operational taisyklėms. MVP 2 prideda location zones,
              schedule rules, autosend policy ir response templates.
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

        <OperationalConfigPanel config={operationalConfig} />

        <section className="mt-6">
          <InlineCreate title="Nauja paslauga">
            <ServiceCreateForm />
          </InlineCreate>
        </section>

        {config.groups.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mt-6 grid gap-4">
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

function OperationalConfigPanel({
  config,
}: {
  config: SuperAdminOperationalConfig;
}) {
  const summaryItems = [
    { label: "Location zones", value: config.summary.locationZonesCount },
    { label: "Schedule rules", value: config.summary.scheduleRulesCount },
    {
      label: "Active templates",
      value: config.summary.activeResponseTemplatesCount,
    },
    {
      label: "Unsupported ops JSON",
      value: config.summary.unsupportedOperationalJsonCount,
    },
  ];

  return (
    <section className="mt-6 rounded-lg border border-line bg-white p-5 shadow-cardsoft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-ink">
            Operational Config MVP 2
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-soft">
            Tenant-level taisyklės: location zones, bendras lead time, autosend
            policy ir response templates. Šie nustatymai veikia visą dabartinio
            kliento tenant kontekstą.
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            Tenant ID:{" "}
            {config.tenantId ? <code>{config.tenantId}</code> : "nėra"}
          </p>
        </div>
      </div>

      {!config.tenantId ? (
        <div className="mt-4">
          <WarningText>
            Dabartinis klientas neturi tenantId, todėl operational config negali
            būti redaguojamas.
          </WarningText>
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {summaryItems.map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-line bg-line-soft p-3"
              >
                <div className="text-xs font-extrabold uppercase text-ink-muted">
                  {item.label}
                </div>
                <div className="mt-1 text-2xl font-extrabold text-ink">
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-3">
            <OperationalDetails
              title="Location Zones"
              meta={`${config.locationZones.length} įrašai`}
            >
              <LocationZoneList zones={config.locationZones} />
            </OperationalDetails>
            <OperationalDetails
              title="Schedule Rules"
              meta={`${config.scheduleRules.length} įrašai`}
            >
              <ScheduleRuleList rules={config.scheduleRules} />
            </OperationalDetails>
            <OperationalDetails
              title="Autosend Policy"
              meta={
                config.autosendPolicy?.missing
                  ? "saugus default"
                  : config.autosendPolicy?.support.supported
                    ? "supported"
                    : "unsupported"
              }
            >
              {config.autosendPolicy ? (
                <AutosendPolicyForm policy={config.autosendPolicy} />
              ) : null}
            </OperationalDetails>
            <OperationalDetails
              title="Response Templates"
              meta={`${config.responseTemplates.length} įrašai`}
            >
              <ResponseTemplateList templates={config.responseTemplates} />
            </OperationalDetails>
          </div>
        </>
      )}
    </section>
  );
}

function OperationalDetails({
  title,
  meta,
  children,
}: {
  title: string;
  meta: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-lg border border-line bg-line-soft">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 marker:hidden">
        <div>
          <h3 className="text-base font-extrabold text-ink">{title}</h3>
          <p className="text-xs font-semibold uppercase text-ink-muted">
            {meta}
          </p>
        </div>
        <span className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-extrabold uppercase text-ink-muted group-open:hidden">
          Atidaryti
        </span>
        <span className="hidden rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-extrabold uppercase text-ink-muted group-open:inline-flex">
          Suskleisti
        </span>
      </summary>
      <div className="border-t border-line p-4">{children}</div>
    </details>
  );
}

function LocationZoneList({ zones }: { zones: SuperAdminLocationZoneRow[] }) {
  return (
    <div className="grid gap-4">
      {zones.length === 0 ? (
        <SectionEmpty>Location zones dar nėra.</SectionEmpty>
      ) : (
        zones.map((zone) => <LocationZoneForm key={zone.id} zone={zone} />)
      )}

      <InlineCreate title="Nauja location zone">
        <LocationZoneForm />
      </InlineCreate>
    </div>
  );
}

function LocationZoneForm({ zone }: { zone?: SuperAdminLocationZoneRow }) {
  return (
    <form
      action={
        zone
          ? updateSuperAdminLocationZoneAction
          : createSuperAdminLocationZoneAction
      }
      className="grid gap-3 rounded-lg border border-line bg-white p-4"
    >
      {zone ? (
        <input type="hidden" name="locationZoneId" value={zone.id} />
      ) : null}
      <div className="grid gap-3 md:grid-cols-3">
        <TextInput
          name="adminUnitCode"
          label="admin unit code"
          defaultValue={zone?.adminUnitCode}
          placeholder="LT-VL"
          required
        />
        <TextInput
          name="zone"
          label="zone"
          defaultValue={zone?.zone}
          placeholder="Vilnius"
          required
        />
        <TextInput
          name="travelFeeEur"
          label="travel fee EUR"
          defaultValue={formatInputNumber(zone?.travelFeeEur) || "0"}
          placeholder="0"
        />
      </div>
      <CheckboxGrid>
        <Checkbox
          name="served"
          label="served"
          defaultChecked={zone?.served ?? true}
        />
      </CheckboxGrid>
      <div className="flex flex-wrap justify-end gap-2">
        {zone ? (
          <DeleteButton
            action={deleteSuperAdminLocationZoneAction.bind(null, zone.id)}
            confirmText={`Ištrinti location zone „${zone.zone}“? Veiksmas negrįžtamas.`}
            renderAs="button"
          />
        ) : null}
        <SubmitButton>
          {zone ? "Išsaugoti location zone" : "Sukurti location zone"}
        </SubmitButton>
      </div>
    </form>
  );
}

function ScheduleRuleList({ rules }: { rules: SuperAdminScheduleRuleRow[] }) {
  return (
    <div className="grid gap-4">
      {rules.length === 0 ? (
        <SectionEmpty>Schedule rules dar nėra.</SectionEmpty>
      ) : (
        rules.map((rule) => <ScheduleRuleForm key={rule.id} rule={rule} />)
      )}

      <InlineCreate title="Nauja schedule rule">
        <ScheduleRuleForm />
      </InlineCreate>
    </div>
  );
}

function ScheduleRuleForm({ rule }: { rule?: SuperAdminScheduleRuleRow }) {
  const builder = rule?.builder;

  return (
    <form
      action={
        rule
          ? updateSuperAdminScheduleRuleAction
          : createSuperAdminScheduleRuleAction
      }
      className="grid gap-3 rounded-lg border border-line bg-white p-4"
    >
      {rule ? (
        <input type="hidden" name="scheduleRuleId" value={rule.id} />
      ) : null}
      {rule && !rule.support.supported ? (
        <WarningText>
          Unsupported schedule JSON: {rule.support.reason} Išsaugojus forma
          pakeis jį į lead_time_weeks shape.
        </WarningText>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        <TextInput
          name="minWeeks"
          label="min weeks"
          defaultValue={formatInputNumber(builder?.minWeeks) || "3"}
          placeholder="3"
          required
        />
        <TextInput
          name="maxWeeks"
          label="max weeks"
          defaultValue={formatInputNumber(builder?.maxWeeks) || "5"}
          placeholder="5"
          required
        />
      </div>
      {rule ? (
        <JsonPreview title="Read-only schedule JSON" value={rule.rulePreview} />
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        {rule ? (
          <DeleteButton
            action={deleteSuperAdminScheduleRuleAction.bind(null, rule.id)}
            confirmText="Ištrinti schedule rule? Veiksmas negrįžtamas."
            renderAs="button"
          />
        ) : null}
        <SubmitButton>
          {rule ? "Išsaugoti schedule rule" : "Sukurti schedule rule"}
        </SubmitButton>
      </div>
    </form>
  );
}

function AutosendPolicyForm({
  policy,
}: {
  policy: SuperAdminAutosendPolicyRow;
}) {
  const builder = policy.builder ?? DEFAULT_AUTOSEND_BUILDER;

  return (
    <form
      action={saveSuperAdminAutosendPolicyAction}
      className="grid gap-3 rounded-lg border border-line bg-white p-4"
    >
      {policy.id ? (
        <input type="hidden" name="autosendPolicyId" value={policy.id} />
      ) : null}
      {policy.missing ? (
        <WarningText>
          Autosend policy dar nėra. Naujas policy bus sukurtas su enabled=false,
          kol jo sąmoningai neįjungsite.
        </WarningText>
      ) : null}
      {!policy.support.supported ? (
        <WarningText>
          Unsupported autosend policy JSON: {policy.support.reason} Išsaugojus
          forma pakeis jį į MVP 2 builder shape.
        </WarningText>
      ) : null}
      <WarningText>
        Atsargiai: agresyvūs autosend nustatymai gali leisti realiems atsakymams
        išeiti be rankinės peržiūros, kai siuntimo integracija bus prijungta.
      </WarningText>

      <CheckboxGrid>
        <Checkbox
          name="enabled"
          label="enabled"
          defaultChecked={builder.enabled}
        />
        <Checkbox
          name="requireAllRequiredResolved"
          label="require all required resolved"
          defaultChecked={builder.requireAllRequiredResolved}
        />
        <Checkbox
          name="blockIfConflicts"
          label="block if conflicts"
          defaultChecked={builder.blockIfConflicts}
        />
        <Checkbox
          name="blockIfRange"
          label="block if range"
          defaultChecked={builder.blockIfRange}
        />
      </CheckboxGrid>

      <fieldset className="grid gap-3 rounded-lg border border-line bg-line-soft p-3">
        <legend className="px-1 text-sm font-extrabold text-ink">
          Price-affecting requirement sources
        </legend>
        <CheckboxGrid>
          <Checkbox
            name="allowDeterministicSource"
            label="allow deterministic"
            defaultChecked={builder.allowDeterministicSource}
          />
          <Checkbox
            name="allowFormFieldSource"
            label="allow form field"
            defaultChecked={builder.allowFormFieldSource}
          />
          <Checkbox
            name="aiEvidenceVerifiedRequired"
            label="AI evidence verified required"
            defaultChecked={builder.aiEvidenceVerifiedRequired}
          />
          <Checkbox
            name="aiValidationPassedRequired"
            label="AI validation passed required"
            defaultChecked={builder.aiValidationPassedRequired}
          />
        </CheckboxGrid>
        <TextInput
          name="aiMinConfidence"
          label="AI min confidence"
          defaultValue={formatInputNumber(builder.aiMinConfidence)}
          placeholder="0.85"
          required
        />
      </fieldset>

      <div className="grid gap-3 md:grid-cols-3">
        <TextInput
          name="autoSendConfidence"
          label="confidenceBands.autoSend"
          defaultValue={formatInputNumber(builder.autoSendConfidence)}
          placeholder="0.85"
          required
        />
        <TextInput
          name="draftForReviewConfidence"
          label="confidenceBands.draftForReview"
          defaultValue={formatInputNumber(builder.draftForReviewConfidence)}
          placeholder="0.6"
          required
        />
        <div className="flex items-end">
          <Checkbox
            name="aiClassifiedServiceAllowedForAutoSend"
            label="AI-classified service allowed"
            defaultChecked={builder.aiClassifiedServiceAllowedForAutoSend}
          />
        </div>
      </div>

      <JsonPreview title="Read-only policy JSON" value={policy.policyPreview} />
      <div className="flex justify-end">
        <SubmitButton>
          {policy.missing ? "Sukurti autosend policy" : "Išsaugoti policy"}
        </SubmitButton>
      </div>
    </form>
  );
}

function ResponseTemplateList({
  templates,
}: {
  templates: SuperAdminResponseTemplateRow[];
}) {
  return (
    <div className="grid gap-4">
      {templates.length === 0 ? (
        <SectionEmpty>Response templates dar nėra.</SectionEmpty>
      ) : (
        templates.map((template) => (
          <ResponseTemplateForm key={template.id} template={template} />
        ))
      )}

      <InlineCreate title="Naujas response template">
        <ResponseTemplateForm />
      </InlineCreate>
    </div>
  );
}

function ResponseTemplateForm({
  template,
}: {
  template?: SuperAdminResponseTemplateRow;
}) {
  const placeholders =
    template?.placeholders ?? getAllowedPlaceholders("custom_template");
  const warning = template?.warning ?? null;

  return (
    <form
      action={
        template
          ? updateSuperAdminResponseTemplateAction
          : createSuperAdminResponseTemplateAction
      }
      className="grid gap-3 rounded-lg border border-line bg-white p-4"
    >
      {template ? (
        <input type="hidden" name="responseTemplateId" value={template.id} />
      ) : null}
      {warning ? <WarningText>{warning}</WarningText> : null}
      <TextInput
        name="templateKey"
        label="template key"
        defaultValue={template?.templateKey}
        placeholder="price_estimate"
        required
      />
      <label className="grid gap-1 text-sm font-semibold text-ink">
        body
        <textarea
          name="body"
          required
          rows={4}
          defaultValue={template?.body}
          placeholder="Sveiki, orientacinė kaina: {{priceAmount}} {{currency}}."
          className="resize-y rounded-lg border border-line bg-white px-3 py-2 font-normal leading-relaxed"
        />
      </label>
      <p className="text-xs leading-relaxed text-ink-muted">
        Placeholder hints:{" "}
        {placeholders.length > 0 ? placeholders.join(", ") : "nėra"}
      </p>
      <CheckboxGrid>
        <Checkbox
          name="active"
          label="active"
          defaultChecked={template?.active ?? true}
        />
      </CheckboxGrid>
      <div className="flex flex-wrap justify-end gap-2">
        {template?.active ? (
          <DeleteButton
            action={deactivateSuperAdminResponseTemplateAction.bind(
              null,
              template.id,
            )}
            label="Deaktyvuoti"
            confirmText={`Deaktyvuoti response template „${template.templateKey}“? Jei jį naudoja sprendimo tipas, response generation gali baigtis config klaida.`}
            renderAs="button"
          />
        ) : null}
        <SubmitButton>
          {template ? "Išsaugoti template" : "Sukurti template"}
        </SubmitButton>
      </div>
    </form>
  );
}

function ServiceConfigCard({
  group,
  config,
}: {
  group: SuperAdminServiceGroup;
  config: SuperAdminConfig;
}) {
  const unsupportedCount =
    group.pricingRules.filter((rule) => !rule.support.supported).length +
    group.requirements.filter(
      (requirement) => !requirement.expectedFactSupported,
    ).length;
  const activeRequirementKeys = new Set(
    group.requirements
      .filter((requirement) => requirement.active)
      .map((requirement) => requirement.requirementKey),
  );
  const brokenReferencesCount = group.pricingRules.reduce((count, rule) => {
    if (!rule.active || !rule.builder) {
      return count;
    }
    const referencedKeys = new Set([
      rule.builder.requirementKey,
      ...rule.builder.requiresText
        .split(",")
        .map((key) => key.trim())
        .filter(Boolean),
      ...rule.builder.modifiers.map((modifier) => modifier.requirementKey),
    ]);
    return (
      count +
      Array.from(referencedKeys).filter(
        (key) => !activeRequirementKeys.has(key),
      ).length
    );
  }, 0);

  return (
    <SuperAdminServiceDetails
      serviceName={group.serviceName}
      serviceId={group.serviceId}
      serviceActive={group.serviceActive}
      subjectsCount={group.subjects.length}
      requirementsCount={group.requirements.length}
      pricingRulesCount={group.pricingRules.length}
      unsupportedCount={unsupportedCount}
      brokenReferencesCount={brokenReferencesCount}
    >
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <DeleteButton
          action={deleteSuperAdminServiceAction.bind(null, group.serviceId)}
          label="Ištrinti visą paslaugą"
          confirmText={`Ištrinti visą paslaugą „${group.serviceName}“? Kartu bus negrįžtamai ištrintos ${group.subjects.length} temos, ${group.requirements.length} klausimai, ${group.pricingRules.length} kainodaros taisyklės ir visi pasiekiamumo nustatymai. Užklausų istorija liks, bet nebebus susieta su šia paslauga.`}
        />
        <Link
          href="/dashboard/test"
          className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold text-ink-soft hover:bg-line-soft"
        >
          Test this configuration
        </Link>
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
    </SuperAdminServiceDetails>
  );
}

function ServiceCreateForm() {
  return (
    <form
      action={createSuperAdminServiceAction}
      className="grid gap-3 rounded-lg border border-line bg-line-soft p-4"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <TextInput
          name="name"
          label="Vidinis paslaugos pavadinimas"
          placeholder="Segmentinės tvoros montavimas"
          required
        />
        <TextInput
          name="label"
          label="Pavadinimas klientui"
          placeholder="Segmentinė tvora"
        />
      </div>
      <TextInput
        name="keywords"
        label="Atpažinimo raktažodžiai, atskirti kableliais"
        placeholder="tvora, tvoros, segmentinė"
      />
      <CheckboxGrid>
        <Checkbox name="active" label="Aktyvi" defaultChecked />
      </CheckboxGrid>
      <p className="text-xs leading-relaxed text-ink-muted">
        Paslauga bus priskirta dabartiniam klientui. Temas, klausimus ir
        kainodarą galėsite pridėti jos kortelėje po sukūrimo.
      </p>
      <div className="flex justify-end">
        <SubmitButton>Sukurti paslaugą</SubmitButton>
      </div>
    </form>
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
        Dabartinis klientas paslaugų dar neturi. Sukurkite pirmą paslaugą
        aukščiau esančioje formoje.
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
