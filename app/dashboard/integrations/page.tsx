import {
  OutboundIntegrationStatus,
  SourceIntegrationStatus,
  SourceIntegrationType,
} from "@prisma/client";
import { ConfirmSubmitButton } from "@/components/dashboard/ConfirmSubmitButton";
import { CopyValueButton } from "@/components/dashboard/CopyValueButton";
import { DashboardError } from "@/components/dashboard/DashboardError";
import { getAppErrorMessage } from "@/lib/app-errors";
import { getCurrentClient } from "@/lib/client-context";
import {
  getIntegrationDashboard,
  type IntegrationDashboardItem,
} from "@/lib/inbound/integrations";
import {
  getOutboundIntegrationDashboard,
  type OutboundIntegrationDashboardItem,
} from "@/lib/outbound/integrations";
import {
  createOutboundIntegrationAction,
  createPaslaugosIntegrationAction,
  createWebFormIntegrationAction,
  rotateIntegrationAction,
  refreshOutboundIntegrationAction,
  setDefaultOutboundIntegrationAction,
  setIntegrationStatusAction,
  setOutboundIntegrationStatusAction,
} from "./actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    created?: string;
    updated?: string;
    rotated?: string;
    outboundCreated?: string;
    outboundUpdated?: string;
    outboundError?: string;
  }>;
};

export default async function IntegrationsPage({ searchParams }: PageProps) {
  try {
    const query = await searchParams;
    const client = await getCurrentClient();
    const [integrations, outboundIntegrations] = await Promise.all([
      getIntegrationDashboard(client.id),
      getOutboundIntegrationDashboard(client.id),
    ]);

    return (
      <div className="mx-auto max-w-content">
        <header>
          <div className="text-sm font-bold uppercase text-brand">
            Konfigūracija
          </div>
          <h1 className="mt-1 text-3xl font-extrabold text-ink">
            Integracijos
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-soft">
            Kiekvienas šaltinis jungiamas atskirai. Bendros pašto dėžutės
            persiųsti nereikia — taip FirstReply gauna tik tas užklausas, kurias
            sąmoningai prijungiate.
          </p>
        </header>

        {query?.created ||
        query?.updated ||
        query?.rotated ||
        query?.outboundCreated ||
        query?.outboundUpdated ? (
          <div
            role="status"
            className="mt-5 rounded-lg border border-brand-tintborder bg-brand-tint px-4 py-3 text-sm font-semibold text-brand"
          >
            Integracijos nustatymai išsaugoti.
          </div>
        ) : null}
        {query?.outboundError ? (
          <div
            role="alert"
            className="mt-5 rounded-lg border border-warn-border bg-warn-bg px-4 py-3 text-sm font-semibold text-warn-text"
          >
            {query.outboundError}
          </div>
        ) : null}

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <CreateIntegrationCard
            title="Svetainės forma"
            description="Server-side forma, Make arba Zapier siunčia struktūruotą ir HMAC parašu apsaugotą užklausą."
            defaultName="Pagrindinė svetainės forma"
            action={createWebFormIntegrationAction}
          />
          <CreateIntegrationCard
            title="Paslaugos.lt"
            description="Pašto taisyklė persiunčia tik Paslaugos.lt pranešimus į atskirą FirstReply adresą."
            defaultName="Paslaugos.lt"
            action={createPaslaugosIntegrationAction}
          />
        </section>

        <section className="mt-8 grid gap-5">
          <h2 className="text-xl font-extrabold text-ink">
            Sukurti šaltiniai ({integrations.length})
          </h2>
          {integrations.length ? (
            integrations.map((integration) => (
              <IntegrationCard key={integration.id} integration={integration} />
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-line bg-white p-6 text-sm text-ink-soft">
              Integracijų dar nėra. Sukurkite pirmą šaltinį aukščiau.
            </div>
          )}
        </section>

        <OutboundSection integrations={outboundIntegrations} />
      </div>
    );
  } catch (error) {
    console.error("[dashboard-integrations] failed to load", error);
    return (
      <div className="mx-auto max-w-content">
        <DashboardError message={getAppErrorMessage(error)} />
      </div>
    );
  }
}

function OutboundSection({
  integrations,
}: {
  integrations: OutboundIntegrationDashboardItem[];
}) {
  const sendingEnabled = process.env.EMAIL_SENDING_ENABLED === "true";
  return (
    <section className="mt-10 border-t border-line pt-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-ink">
            Atsakymų siuntimas
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-soft">
            Patvirtinkite savo domeną Resend DNS įrašais. Laiškas siunčiamas tik
            žmogui paspaudus „Siųsti klientui“.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-extrabold ${sendingEnabled ? "bg-brand-tint text-brand" : "bg-warn-bg text-warn-text"}`}
        >
          {sendingEnabled ? "Siuntimas įjungtas" : "Globaliai išjungta"}
        </span>
      </div>

      <form
        action={createOutboundIntegrationAction}
        className="mt-5 grid gap-3 rounded-lg border border-line bg-white p-5 shadow-cardsoft md:grid-cols-2"
      >
        <label className="text-sm font-bold text-ink">
          Integracijos pavadinimas
          <input
            name="name"
            defaultValue="Pagrindinis el. paštas"
            maxLength={120}
            required
            className="mt-2 min-h-11 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </label>
        <label className="text-sm font-bold text-ink">
          Siuntėjo vardas
          <input
            name="fromName"
            placeholder="UAB Pavyzdys"
            maxLength={120}
            required
            className="mt-2 min-h-11 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </label>
        <label className="text-sm font-bold text-ink">
          Siuntėjo el. paštas
          <input
            type="email"
            name="fromEmail"
            placeholder="labas@atsakymai.imone.lt"
            maxLength={320}
            required
            className="mt-2 min-h-11 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </label>
        <label className="text-sm font-bold text-ink">
          Reply-To el. paštas
          <input
            type="email"
            name="replyToEmail"
            placeholder="info@imone.lt"
            maxLength={320}
            required
            className="mt-2 min-h-11 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <span className="mt-1 block text-xs font-normal leading-relaxed text-ink-muted">
            Kliento atsakymas keliaus į šią įmonės dėžutę. FirstReply jo dar
            automatiškai neįkels į pokalbį.
          </span>
        </label>
        <div className="md:col-span-2">
          <button className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-hover">
            Sukurti Resend domeną
          </button>
        </div>
      </form>

      <div className="mt-5 grid gap-5">
        {integrations.map((integration) => (
          <OutboundIntegrationCard
            key={integration.id}
            integration={integration}
          />
        ))}
        {!integrations.length ? (
          <div className="rounded-lg border border-dashed border-line bg-white p-6 text-sm text-ink-soft">
            Siuntėjo tapatybė dar nesukurta.
          </div>
        ) : null}
      </div>
    </section>
  );
}

function OutboundIntegrationCard({
  integration,
}: {
  integration: OutboundIntegrationDashboardItem;
}) {
  const active = integration.status === OutboundIntegrationStatus.ACTIVE;
  return (
    <article className="rounded-lg border border-line bg-white p-5 shadow-cardsoft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-extrabold text-ink">
              {integration.name}
            </h3>
            <span className="rounded-full bg-line-soft px-2.5 py-1 text-xs font-extrabold text-ink-soft">
              {outboundStatusLabel(integration.status)}
            </span>
            {integration.isDefault ? (
              <span className="rounded-full bg-brand-tint px-2.5 py-1 text-xs font-extrabold text-brand">
                Numatytasis
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-ink-soft">
            {integration.fromName} &lt;{integration.fromEmail}&gt; · Reply-To{" "}
            {integration.replyToEmail} · {integration.dispatchCount} siuntimai
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={refreshOutboundIntegrationAction}>
            <input type="hidden" name="integrationId" value={integration.id} />
            <button className="rounded-lg border border-line px-3 py-2 text-xs font-bold text-brand hover:bg-brand-tint">
              Tikrinti DNS
            </button>
          </form>
          <form action={setOutboundIntegrationStatusAction}>
            <input type="hidden" name="integrationId" value={integration.id} />
            <input
              type="hidden"
              name="enabled"
              value={active ? "false" : "true"}
            />
            <button className="rounded-lg border border-line px-3 py-2 text-xs font-bold text-ink-soft hover:bg-line-soft">
              {active ? "Išjungti" : "Įjungti"}
            </button>
          </form>
          {active && !integration.isDefault ? (
            <form action={setDefaultOutboundIntegrationAction}>
              <input
                type="hidden"
                name="integrationId"
                value={integration.id}
              />
              <button className="rounded-lg border border-line px-3 py-2 text-xs font-bold text-ink-soft hover:bg-line-soft">
                Naudoti pagal nutylėjimą
              </button>
            </form>
          ) : null}
        </div>
      </div>
      <p className="mt-3 text-xs text-ink-muted">
        Resend būsena: {integration.providerStatus} · Domenas:{" "}
        {integration.domain}
      </p>
      {integration.lastError ? (
        <p className="mt-3 rounded-lg border border-warn-border bg-warn-bg p-3 text-sm text-warn-text">
          {integration.lastError}
        </p>
      ) : null}
      {integration.dnsRecords.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line text-ink-muted">
                <th className="p-2">Tipas</th>
                <th className="p-2">Pavadinimas</th>
                <th className="p-2">Reikšmė</th>
                <th className="p-2">Prioritetas</th>
                <th className="p-2">Būsena</th>
              </tr>
            </thead>
            <tbody>
              {integration.dnsRecords.map((record, index) => (
                <tr
                  key={`${record.record}-${record.name}-${index}`}
                  className="border-b border-line-soft"
                >
                  <td className="p-2 font-bold">{record.type}</td>
                  <td className="p-2">
                    <code className="break-all">{record.name}</code>
                  </td>
                  <td className="p-2">
                    <div className="flex min-w-60 items-center gap-2">
                      <code className="break-all">{record.value}</code>
                      <CopyValueButton
                        value={record.value}
                        label={`${record.record} DNS reikšmę`}
                      />
                    </div>
                  </td>
                  <td className="p-2">{record.priority ?? "—"}</td>
                  <td className="p-2">{record.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </article>
  );
}

function outboundStatusLabel(status: OutboundIntegrationStatus): string {
  if (status === OutboundIntegrationStatus.ACTIVE) return "Aktyvi";
  if (status === OutboundIntegrationStatus.DISABLED) return "Išjungta";
  if (status === OutboundIntegrationStatus.FAILED) return "DNS klaida";
  return "Laukiama DNS";
}

function CreateIntegrationCard({
  title,
  description,
  defaultName,
  action,
}: {
  title: string;
  description: string;
  defaultName: string;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form
      action={action}
      className="rounded-lg border border-line bg-white p-5 shadow-cardsoft"
    >
      <h2 className="text-lg font-extrabold text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        {description}
      </p>
      <label className="mt-4 block text-sm font-bold text-ink">
        Pavadinimas
        <input
          name="name"
          defaultValue={defaultName}
          maxLength={120}
          className="mt-2 min-h-11 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand"
        />
      </label>
      <button
        type="submit"
        className="mt-4 rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-hover"
      >
        Sukurti integraciją
      </button>
    </form>
  );
}

function IntegrationCard({
  integration,
}: {
  integration: IntegrationDashboardItem;
}) {
  const active = integration.status === SourceIntegrationStatus.ACTIVE;
  const value = integration.routingAddress ?? integration.webhookUrl;

  return (
    <article className="rounded-lg border border-line bg-white p-5 shadow-cardsoft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-extrabold text-ink">
              {integration.name}
            </h3>
            <span className="rounded-full bg-line-soft px-2.5 py-1 text-xs font-extrabold text-ink-soft">
              {sourceLabel(integration.sourceType)}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${
                active
                  ? "bg-brand-tint text-brand"
                  : "bg-line-soft text-ink-muted"
              }`}
            >
              {active ? "Aktyvi" : "Išjungta"}
            </span>
          </div>
          <p className="mt-2 text-sm text-ink-soft">
            {integration.eventCount} įvykiai · {integration.messageCount}{" "}
            žinutės
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={setIntegrationStatusAction}>
            <input type="hidden" name="integrationId" value={integration.id} />
            <input
              type="hidden"
              name="status"
              value={
                active
                  ? SourceIntegrationStatus.DISABLED
                  : SourceIntegrationStatus.ACTIVE
              }
            />
            <button className="rounded-lg border border-line px-3 py-2 text-xs font-bold text-ink-soft hover:bg-line-soft">
              {active ? "Išjungti" : "Įjungti"}
            </button>
          </form>
          <form action={rotateIntegrationAction}>
            <input type="hidden" name="integrationId" value={integration.id} />
            <ConfirmSubmitButton
              label={
                integration.routingAddress ? "Keisti adresą" : "Rotuoti raktą"
              }
              confirmText={
                integration.routingAddress
                  ? "Senas persiuntimo adresas iš karto nustos veikti. Pakeiskite pašto taisyklę nauju adresu. Tęsti?"
                  : "Senas signing secret iš karto nustos veikti. Atnaujinkite jį siuntėjo serveryje. Tęsti?"
              }
              className="rounded-lg border border-warn-border px-3 py-2 text-xs font-bold text-warn-text hover:bg-warn-bg"
            />
          </form>
        </div>
      </div>

      {value ? (
        <div className="mt-4 rounded-lg border border-line bg-line-soft p-3">
          <div className="text-xs font-extrabold uppercase text-ink-muted">
            {integration.routingAddress ? "Persiuntimo adresas" : "Webhook URL"}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all text-xs text-ink">
              {value}
            </code>
            <CopyValueButton
              value={value}
              label={
                integration.routingAddress
                  ? "Paslaugos.lt persiuntimo adresą"
                  : "webhook URL"
              }
            />
          </div>
        </div>
      ) : null}

      {integration.signingSecret ? (
        <div className="mt-3 rounded-lg border border-line bg-line-soft p-3">
          <div className="text-xs font-extrabold uppercase text-ink-muted">
            HMAC signing secret
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all text-xs text-ink">
              {integration.signingSecret}
            </code>
            <CopyValueButton
              value={integration.signingSecret}
              label="HMAC signing secret"
            />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-ink-muted">
            Laikykite tik serverio pusėje. Viešame formos JavaScript šio rakto
            būti negali.
          </p>
        </div>
      ) : null}

      <p className="mt-4 text-sm leading-relaxed text-ink-soft">
        {integration.sourceType === SourceIntegrationType.WEB_FORM
          ? "Siųskite JSON su X-FirstReply-Timestamp, X-FirstReply-Event-Id ir X-FirstReply-Signature antraštėmis."
          : "Sukurkite pašto taisyklę, kuri į šį adresą persiunčia tik Paslaugos.lt pranešimus — ne visą dėžutę."}
      </p>

      <IntegrationSetupInstructions integration={integration} />

      {integration.lastEvent ? (
        <div className="mt-4 border-t border-line pt-3 text-xs text-ink-muted">
          Paskutinis įvykis: {eventStatusLabel(integration.lastEvent.status)} (
          {integration.lastEvent.status})
          {integration.lastEvent.errorCode
            ? ` · Diagnostika: ${integration.lastEvent.errorCode}`
            : ""}{" "}
          · {formatDate(integration.lastEvent.createdAt)}
        </div>
      ) : null}
    </article>
  );
}

function IntegrationSetupInstructions({
  integration,
}: {
  integration: IntegrationDashboardItem;
}) {
  return (
    <details className="mt-4 rounded-lg border border-line px-4 py-3 text-sm text-ink-soft">
      <summary className="cursor-pointer font-bold text-ink">
        Prijungimo instrukcija
      </summary>
      {integration.sourceType === SourceIntegrationType.WEB_FORM ? (
        <ol className="mt-3 list-decimal space-y-2 pl-5 leading-relaxed">
          <li>
            Siųskite server-side <code>POST</code> į aukščiau esantį URL. JSON
            laukai: privalomas <code>message</code>; pasirinktinai{" "}
            <code>name</code>, <code>email</code>, <code>phone</code>,{" "}
            <code>city</code>, <code>pageUrl</code> ir <code>submittedAt</code>.
          </li>
          <li>
            Sukurkite Unix timestamp sekundėmis ir stabilų unikalų event ID.
            HMAC-SHA256 skaičiuokite nuo tikslių baitų:{" "}
            <code>
              ${"{timestamp}"}.${"{eventId}"}.${"{rawBody}"}
            </code>
            .
          </li>
          <li>
            Parašą siųskite kaip <code>v1=&lt;hex&gt;</code>. Rakto nedėkite į
            browser JavaScript. Tą patį event ID per retry išlaikykite, o gavę
            <code>503</code> su <code>Retry-After</code> kartokite po nurodyto
            laiko.
          </li>
        </ol>
      ) : (
        <ol className="mt-3 list-decimal space-y-2 pl-5 leading-relaxed">
          <li>
            Pašte sukurkite taisyklę pagal tikslų Paslaugos.lt siuntėją ir, jei
            reikia, temos požymį.
          </li>
          <li>
            Persiųskite tik sutampančius laiškus į aukščiau esantį adresą.
            Bendros dėžutės persiųsti negalima.
          </li>
          <li>
            Išbandykite vienu realiu pranešimu ir patikrinkite čia paskutinio
            įvykio būseną bei užklausos timeline.
          </li>
        </ol>
      )}
    </details>
  );
}

function sourceLabel(sourceType: SourceIntegrationType): string {
  return sourceType === SourceIntegrationType.WEB_FORM
    ? "Web forma"
    : "Paslaugos.lt";
}

function eventStatusLabel(status: string): string {
  if (status === "COMPLETED") return "Užbaigtas";
  if (status === "PROCESSING") return "Apdorojamas";
  if (status === "FAILED") return "Nepavyko";
  if (status === "REJECTED") return "Atmestas";
  return status;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("lt-LT", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Vilnius",
  }).format(new Date(value));
}
