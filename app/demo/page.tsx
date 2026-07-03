import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Eyebrow, Section, SectionHeading } from "@/components/ui/Section";
import { SITE } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "FirstReply pavyzdžiai — kaip atrodo pirmas atsakymas",
  description:
    "Pavyzdžiai, kaip FirstReply paruošia atsakymą į web formos ar Paslaugos.lt užklausą: orientacinė kaina, trūkstami klausimai, preliminarus terminas ir follow-up.",
  alternates: {
    canonical: "/demo",
  },
  openGraph: {
    title: "FirstReply pavyzdžiai — kaip atrodo pirmas atsakymas",
    description:
      "Pavyzdžiai, kaip FirstReply paruošia atsakymą į web formos ar Paslaugos.lt užklausą: orientacinė kaina, trūkstami klausimai, preliminarus terminas ir follow-up.",
    url: "/demo",
  },
};

type IconName =
  | "arrow"
  | "calendar"
  | "check"
  | "clock"
  | "file"
  | "inbox"
  | "message"
  | "pause"
  | "search"
  | "send"
  | "shield"
  | "spark"
  | "tag";

const workflowSteps = [
  {
    icon: "inbox",
    title: "Klientas atsiunčia užklausą",
    text: "Web forma arba Paslaugos.lt pranešimas patenka į vieną FirstReply srautą.",
  },
  {
    icon: "search",
    title: "Atpažįstama esmė",
    text: "Išskiriama paslauga, kainos klausimas, terminas, vieta ir tai, ko dar trūksta.",
  },
  {
    icon: "tag",
    title: "Tikrinamos kainų taisyklės",
    text: "Naudojami tik jūsų patvirtinti kainų rėžiai, išimtys ir saugios formuluotės.",
  },
  {
    icon: "calendar",
    title: "Tikrinamas užimtumas",
    text: "Parenkamas atsargus preliminarus darbų pradžios langas, ne pažadėta data.",
  },
  {
    icon: "message",
    title: "Paruošiamas atsakymas",
    text: "Klientas gauna orientacinę kainą, trūkstamus klausimus ir preliminarų startą.",
  },
  {
    icon: "pause",
    title: "Rizika stabdoma",
    text: "Skubūs, neaiškūs, nestandartiniai ar komerciškai jautrūs atvejai keliauja peržiūrai.",
  },
  {
    icon: "clock",
    title: "Laukiama kliento",
    text: "Jei klientas neatsako, užklausa lieka lentoje su aiškiu statusu.",
  },
  {
    icon: "send",
    title: "Vienas follow-up",
    text: "Po nustatyto laiko gali būti išsiųstas vienas mandagus priminimas.",
  },
] as const;

const extractedFacts = [
  { label: "Paslauga", value: "Termo medienos terasa" },
  { label: "Kainos klausimas", value: "Taip" },
  { label: "Termino klausimas", value: "Kada galite pradėti?" },
  { label: "Vieta", value: "Vilniaus raj." },
  { label: "Trūksta", value: "Pagrindo nuotraukos, turėklai" },
] as const;

const pricingRules = [
  {
    label: "Terasos · termo mediena",
    value: "€90-130 / m²",
    note: "Galima rodyti tik kaip orientacinį rėžį.",
  },
  {
    label: "Papildomi darbai",
    value: "Tik po peržiūros",
    note: "Laiptai, turėklai ir sudėtingas pagrindas netvirtinami automatiškai.",
  },
  {
    label: "Finali sąmata",
    value: "Savininko patvirtinimas",
    note: "FirstReply jos nesiunčia automatiškai.",
  },
] as const;

const availability = [
  { week: "Sav. 1", state: "Užimta", tone: "muted" },
  { week: "Sav. 2", state: "Užimta", tone: "muted" },
  { week: "Sav. 3", state: "Galima nuo", tone: "brand" },
  { week: "Sav. 4", state: "Rezervas", tone: "brand" },
] as const;

const demoCases = [
  {
    title: "Saugus pirmas atsakymas",
    status: "Paruošta siųsti",
    tone: "brand",
    inquiry:
      "Domina 30 m² terasa iš termo medienos. Kokia būtų orientacinė kaina ir kada galėtumėte pradėti?",
    reply:
      "Sveiki! Orientacinė termo medienos terasos kaina būtų apie €90-130/m². Tikslesniam pasiūlymui praverstų pagrindo nuotraukos ir informacija, ar reikės turėklų. Preliminariai galėtume pradėti maždaug nuo 3 savaitės.",
    note: "Kainos rėžis rastas taisyklėse, terminas suformuluotas atsargiai.",
  },
  {
    title: "Rankinė peržiūra",
    status: "Stabdoma",
    tone: "warn",
    inquiry:
      "Reikia stoginės dviem automobiliams, geriausia per artimiausias 10 dienų. Ar tikrai spėsite?",
    reply:
      "Paruoštas atsakymo juodraštis, bet jis nesiunčiamas automatiškai, nes klientas prašo konkretaus greito termino ir darbas gali būti nestandartinis.",
    note: "Savininkas patikrina terminą, apimtį ir tik tada atsako klientui.",
  },
  {
    title: "Vienas follow-up",
    status: "Laukiama atsakymo",
    tone: "neutral",
    inquiry:
      "Klientui paprašyta atsiųsti pagrindo nuotraukas ir patikslinti, ar reikės laiptų.",
    reply:
      "Jei klientas neatrašo, FirstReply gali išsiųsti vieną trumpą priminimą: ar dar aktualu, ir kokios informacijos trūksta tikslesnei sąmatai.",
    note: "Ne daugiau kaip vienas priminimas, be spaudimo ir be naujų pažadų.",
  },
] as const;

const boundaries = [
  "Kainos imamos tik iš patvirtintų kliento taisyklių.",
  "Finali sąmata nėra siunčiama automatiškai.",
  "Preliminarus startas nėra garantuota data.",
  "FirstReply nerezervuoja susitikimų ir neužsako darbų.",
  "Skubūs, neaiškūs ar individualūs atvejai keliauja peržiūrai.",
  "Galutinį pasiūlymą ir terminą visada patvirtina savininkas.",
] as const;

function DemoIcon({ name, className }: { name: IconName; className?: string }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className,
  };

  switch (name) {
    case "arrow":
      return (
        <svg {...common}>
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="17" rx="3" />
          <path d="M8 2v4" />
          <path d="M16 2v4" />
          <path d="M3 10h18" />
        </svg>
      );
    case "check":
      return (
        <svg {...common} strokeWidth={2.4}>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "file":
      return (
        <svg {...common}>
          <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
          <path d="M14 2v5h5" />
          <path d="M9 13h6" />
          <path d="M9 17h4" />
        </svg>
      );
    case "inbox":
      return (
        <svg {...common}>
          <path d="M22 12h-6l-2 3h-4l-2-3H2" />
          <path d="m5.45 5.11-3.2 8A2 2 0 0 0 4.11 16H19.9a2 2 0 0 0 1.86-2.89l-3.2-8A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.85 1.11z" />
        </svg>
      );
    case "message":
      return (
        <svg {...common}>
          <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
        </svg>
      );
    case "pause":
      return (
        <svg {...common}>
          <path d="M10 4v16" />
          <path d="M15 4v16" />
        </svg>
      );
    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      );
    case "send":
      return (
        <svg {...common}>
          <path d="m22 2-7 20-4-9-9-4Z" />
          <path d="M22 2 11 13" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case "spark":
      return (
        <svg {...common}>
          <path d="M13 2 9 10l-7 3 7 3 4 8 4-8 7-3-7-3z" />
        </svg>
      );
    case "tag":
      return (
        <svg {...common}>
          <path d="M20.6 13.1 13.1 20.6a2 2 0 0 1-2.8 0l-7-7A2 2 0 0 1 2.7 12V4a2 2 0 0 1 2-2h8a2 2 0 0 1 1.4.6l6.5 6.5a2 2 0 0 1 0 2.8z" />
          <path d="M7.5 7.5h.01" />
        </svg>
      );
  }
}

function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex items-center justify-center rounded-[11px] bg-brand font-display font-extrabold text-white shadow-[0_3px_10px_rgba(15,143,106,0.28)]",
        className,
      )}
    >
      FR
    </span>
  );
}

function DemoHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-page/[0.86] backdrop-blur-md">
      <div className="mx-auto flex h-[70px] max-w-content items-center justify-between gap-4 px-6">
        <Link
          href="/"
          className="flex items-center gap-[11px]"
          aria-label={SITE.name}
        >
          <LogoMark className="h-[38px] w-[38px] text-[15px]" />
          <span className="font-display text-[19px] font-extrabold text-ink">
            {SITE.name}
          </span>
        </Link>

        <nav
          className="hidden items-center gap-[26px] md:flex"
          aria-label="Pavyzdžių navigacija"
        >
          <a
            href="#workflow"
            className="text-[15px] font-medium text-ink-soft transition-colors hover:text-ink"
          >
            Eiga
          </a>
          <a
            href="#pavyzdziai"
            className="text-[15px] font-medium text-ink-soft transition-colors hover:text-ink"
          >
            Pavyzdžiai
          </a>
          <a
            href="#sauga"
            className="text-[15px] font-medium text-ink-soft transition-colors hover:text-ink"
          >
            Ribos
          </a>
        </nav>

        <Button href="/#cta" size="md" className="hidden md:inline-flex">
          Gauti pasiūlymą
        </Button>
        <Button href="/#cta" size="md" className="md:hidden">
          Gauti pasiūlymą
        </Button>
      </div>
    </header>
  );
}

function Pill({
  children,
  tone = "brand",
}: {
  children: React.ReactNode;
  tone?: "brand" | "warn" | "neutral";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-[6px] text-xs font-bold",
        tone === "brand" && "border-brand-tintborder bg-brand-tint text-brand",
        tone === "warn" && "border-warn-border bg-warn-bg text-warn-text",
        tone === "neutral" && "border-line bg-white text-ink-soft",
      )}
    >
      {children}
    </span>
  );
}

function HeroDemoSurface() {
  return (
    <div className="overflow-hidden rounded-[24px] border border-line bg-white text-left shadow-hero">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft bg-tint2 px-5 py-4">
        <div className="flex items-center gap-3">
          <LogoMark className="h-8 w-8 text-[12px]" />
          <div>
            <div className="font-display text-sm font-extrabold text-ink">
              FirstReply pavyzdžių lenta
            </div>
            <div className="text-xs text-ink-muted">
              Web forma + Paslaugos.lt
            </div>
          </div>
        </div>
        <Pill>Paruošta peržiūrai</Pill>
      </div>

      <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
        <div className="border-b border-line-soft p-5 lg:border-b-0 lg:border-r">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">
            Kliento užklausa
          </div>
          <div className="rounded-[15px] bg-line-soft px-4 py-3 text-[14.5px] leading-[1.55] text-ink">
            Sveiki, domina 30 m² terasa iš termo medienos Vilniaus rajone. Kiek
            maždaug kainuotų ir kada galėtumėte pradėti?
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-[15px] border border-brand-tintborder bg-brand-reply px-4 py-3">
            <span className="mt-px flex h-8 w-8 flex-none items-center justify-center rounded-[10px] border border-brand-tintborder bg-white text-brand">
              <DemoIcon name="search" />
            </span>
            <div>
              <div className="text-sm font-bold text-ink">
                FirstReply perskaito
              </div>
              <p className="mt-1 text-[13.5px] leading-[1.5] text-ink-soft">
                Pirmiausia neatsakoma skubotai. Iš užklausos ištraukiami faktai,
                tada tikrinamos taisyklės.
              </p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-line-soft">
          <div className="p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand">
                Atpažinta
              </div>
              <span className="text-xs text-ink-muted">5 signalai</span>
            </div>
            <dl className="grid gap-2 sm:grid-cols-2">
              {extractedFacts.map((fact) => (
                <div
                  key={fact.label}
                  className="rounded-[13px] border border-line-soft bg-white px-3 py-[10px]"
                >
                  <dt className="text-[12px] text-ink-muted">{fact.label}</dt>
                  <dd className="mt-[2px] text-[13.5px] font-bold leading-[1.35] text-ink">
                    {fact.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="grid sm:grid-cols-2">
            <div className="border-b border-line-soft p-5 sm:border-b-0 sm:border-r">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">
                <DemoIcon name="tag" className="h-[15px] w-[15px] text-brand" />
                Taisyklės
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3 rounded-[13px] bg-brand-reply px-3 py-[10px]">
                  <span className="text-[13px] text-ink-soft">
                    Kainos rėžis
                  </span>
                  <span className="text-[13px] font-extrabold text-brand">
                    €90-130 / m²
                  </span>
                </div>
                <div className="rounded-[13px] bg-line-soft px-3 py-[10px] text-[13px] leading-[1.45] text-ink-soft">
                  Nepakanka finaliai sąmatai, pakanka saugiam pirmam atsakymui.
                </div>
              </div>
            </div>

            <div className="p-5">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">
                <DemoIcon
                  name="calendar"
                  className="h-[15px] w-[15px] text-brand"
                />
                Užimtumas
              </div>
              <div className="grid grid-cols-2 gap-2">
                {availability.map((slot) => (
                  <div
                    key={slot.week}
                    className={cn(
                      "rounded-[13px] border px-3 py-[10px]",
                      slot.tone === "brand"
                        ? "border-brand-tintborder bg-brand-tint"
                        : "border-line bg-line-soft",
                    )}
                  >
                    <div className="text-[12px] text-ink-muted">
                      {slot.week}
                    </div>
                    <div
                      className={cn(
                        "mt-[2px] text-[13px] font-bold",
                        slot.tone === "brand" ? "text-brand" : "text-ink-soft",
                      )}
                    >
                      {slot.state}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-brand-reply p-5">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-brand">
              <DemoIcon name="message" className="h-[15px] w-[15px]" />
              Atsakymo juodraštis
            </div>
            <p className="rounded-[15px] border border-brand-replyborder bg-white px-4 py-3 text-[14.5px] leading-[1.6] text-ink">
              Sveiki! Ačiū už užklausą. 30 m² termo medienos terasa
              preliminariai kainuotų apie €90-130/m². Tikslesniam pasiūlymui
              praverstų pagrindo nuotraukos ir informacija, ar reikės turėklų.
              Preliminariai galėtume pradėti maždaug nuo 3 savaitės.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkflowCard({
  step,
  index,
}: {
  step: (typeof workflowSteps)[number];
  index: number;
}) {
  return (
    <li className="rounded-[20px] border border-line bg-white p-5 shadow-cardsoft">
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[12px] bg-brand-tint text-brand">
          <DemoIcon name={step.icon} />
        </span>
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-ink-muted">
            {String(index + 1).padStart(2, "0")}
          </div>
          <h3 className="mt-1 text-[18px] font-bold leading-[1.25] text-ink">
            {step.title}
          </h3>
          <p className="mt-2 text-[15px] leading-[1.55] text-ink-soft">
            {step.text}
          </p>
        </div>
      </div>
    </li>
  );
}

function RulesAndAvailability() {
  return (
    <Section maxWidth="1100px">
      <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
        <SectionHeading
          eyebrow="Vidinė logika"
          title="Atsakymas gimsta iš taisyklių, ne iš spėjimų"
          subtitle="Pavyzdiniame workflow rodoma supaprastinta versija: kainos lentelė, užimtumo langai ir saugumo ribos, kurias FirstReply turi gerbti prieš siųsdama atsakymą."
        />

        <div className="overflow-hidden rounded-[22px] border border-line bg-white shadow-card">
          <div className="border-b border-line-soft bg-tint2 px-5 py-4">
            <div className="flex items-center gap-2 font-display text-[15px] font-extrabold text-ink">
              <DemoIcon name="file" className="h-[18px] w-[18px] text-brand" />
              Patvirtintos taisyklės
            </div>
          </div>
          <div className="divide-y divide-line-soft">
            {pricingRules.map((rule) => (
              <div
                key={rule.label}
                className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto]"
              >
                <div>
                  <div className="font-bold text-ink">{rule.label}</div>
                  <p className="mt-1 text-sm leading-[1.5] text-ink-soft">
                    {rule.note}
                  </p>
                </div>
                <div className="text-left text-[15px] font-extrabold text-brand sm:text-right">
                  {rule.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

function DemoCases() {
  return (
    <Section id="pavyzdziai" tone="tint" maxWidth="1100px">
      <SectionHeading
        eyebrow="Pavyzdžiai"
        title="Trys pavyzdiniai FirstReply atsakymai"
        subtitle="Šie scenarijai parodo, kada FirstReply gali judėti pati, o kada sąmoningai sustoja."
        centered
      />

      <div className="mt-11 grid gap-5 lg:grid-cols-3">
        {demoCases.map((item) => (
          <article
            key={item.title}
            className="flex flex-col rounded-[22px] border border-line bg-white p-6 shadow-card"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-[19px] font-extrabold leading-[1.25] text-ink">
                {item.title}
              </h3>
              <Pill
                tone={
                  item.tone === "brand"
                    ? "brand"
                    : item.tone === "warn"
                      ? "warn"
                      : "neutral"
                }
              >
                {item.status}
              </Pill>
            </div>

            <div className="mt-5">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">
                Pavyzdinė užklausa
              </div>
              <p className="rounded-[14px] bg-line-soft px-4 py-3 text-[14px] leading-[1.55] text-ink">
                {item.inquiry}
              </p>
            </div>

            <div className="mt-4">
              <div
                className={cn(
                  "mb-2 text-[11px] font-bold uppercase tracking-[0.08em]",
                  item.tone === "warn" ? "text-warn-text" : "text-brand",
                )}
              >
                Pavyzdinis FirstReply atsakymas
              </div>
              <p
                className={cn(
                  "rounded-[14px] border px-4 py-3 text-[14px] leading-[1.55] text-ink",
                  item.tone === "warn"
                    ? "border-warn-border2 bg-warn-bg2"
                    : "border-brand-replyborder bg-brand-reply",
                )}
              >
                {item.reply}
              </p>
            </div>

            <div className="mt-auto pt-4">
              <div className="flex items-start gap-2 rounded-[13px] border border-line bg-white px-3 py-[10px] text-sm leading-[1.45] text-ink-soft">
                <DemoIcon
                  name={item.tone === "warn" ? "pause" : "check"}
                  className={cn(
                    "mt-[2px] h-[16px] w-[16px] flex-none",
                    item.tone === "warn" ? "text-warn-text" : "text-brand",
                  )}
                />
                <span>{item.note}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </Section>
  );
}

function SafetyBoundaries() {
  return (
    <Section id="sauga" maxWidth="980px">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div>
          <Eyebrow>Saugos ribos</Eyebrow>
          <h2 className="mt-3 text-[clamp(28px,4vw,42px)] font-extrabold leading-[1.12] text-ink">
            Pavyzdžiai aiškiai parodo, ko FirstReply nedaro
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-ink-soft">
            Tai svarbu paslaugų verslams: sistema pagreitina pirmą atsakymą, bet
            neperima savininko komercinių sprendimų.
          </p>
        </div>

        <ul className="grid gap-3">
          {boundaries.map((item) => (
            <li
              key={item}
              className="flex items-start gap-3 rounded-[16px] border border-line bg-white px-4 py-3 shadow-cardsoft"
            >
              <span className="mt-[2px] flex h-6 w-6 flex-none items-center justify-center rounded-full bg-brand-tint text-brand">
                <DemoIcon name="shield" className="h-[15px] w-[15px]" />
              </span>
              <span className="text-[15px] leading-[1.55] text-ink-soft">
                {item}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

function DemoFooter() {
  return (
    <footer className="bg-footer-bg px-6 py-9 text-footer-text">
      <div className="mx-auto flex max-w-content flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/"
          className="flex items-center gap-[11px]"
          aria-label={SITE.name}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand font-display text-sm font-extrabold text-white">
            FR
          </span>
          <span className="font-display text-[19px] font-extrabold text-white">
            {SITE.name}
          </span>
        </Link>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-[14px]">
          <Link href="/" className="hover:text-white">
            Pagrindinis
          </Link>
          <Link href="/#kaina" className="hover:text-white">
            Kaina
          </Link>
          <Link href="/#cta" className="hover:text-white">
            Gauti pasiūlymą
          </Link>
          <a href={`mailto:${SITE.email}`} className="hover:text-white">
            {SITE.email}
          </a>
        </div>
      </div>
    </footer>
  );
}

export default function DemoPage() {
  return (
    <>
      <DemoHeader />
      <main>
        <section
          id="hero"
          className="relative overflow-hidden bg-page"
          style={{
            background:
              "radial-gradient(900px 420px at 50% -80px, #E8F7F1 0%, rgba(232,247,241,0) 70%), #F8FAF9",
          }}
        >
          <div
            aria-hidden
            className="bg-dots pointer-events-none absolute inset-0 z-0 opacity-[0.05]"
            style={{
              WebkitMaskImage:
                "radial-gradient(760px 420px at 50% 8%, #000 0%, transparent 78%)",
              maskImage:
                "radial-gradient(760px 420px at 50% 8%, #000 0%, transparent 78%)",
            }}
          />

          <div className="relative z-10 mx-auto grid max-w-content gap-10 px-6 pb-[clamp(56px,8vw,86px)] pt-[clamp(54px,8vw,92px)] lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-[13px] font-medium text-ink-soft shadow-[0_1px_3px_rgba(16,32,27,0.04)]">
                <span className="h-[7px] w-[7px] flex-none rounded-full bg-brand" />
                <span>Pavyzdinis workflow</span>
              </div>
              <h1 className="mt-7 max-w-[14ch] text-[clamp(38px,6vw,62px)] font-extrabold leading-[1.02] text-ink [text-wrap:balance]">
                FirstReply pavyzdžiai: kaip atrodo pirmas atsakymas
              </h1>
              <p className="mt-6 max-w-[58ch] text-[clamp(16px,2vw,19px)] leading-relaxed text-ink-soft">
                Pavyzdžiai rodo, kaip FirstReply iš web formos ar Paslaugos.lt
                užklausos galėtų paruošti pirmą atsakymą pagal jūsų taisykles:
                su orientacine kaina, trūkstamais klausimais, preliminariu
                darbų pradžios langu ir aiškiu sustojimu rizikingais atvejais.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button href="#pavyzdziai" size="lg">
                  Žiūrėti pavyzdžius
                </Button>
                <Button href="/#cta" size="lg" variant="secondary">
                  Gauti pasiūlymą
                </Button>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Pill>Neišgalvoja kainų</Pill>
                <Pill tone="neutral">Nesiunčia finalios sąmatos</Pill>
                <Pill tone="warn">Rizika keliauja peržiūrai</Pill>
              </div>
            </div>

            <HeroDemoSurface />
          </div>
        </section>

        <Section id="workflow" tone="tint" maxWidth="1120px">
          <SectionHeading
            eyebrow="Pavyzdinis workflow"
            title="Nuo užklausos iki pirmo atsakymo"
            subtitle="Srautas parodytas kaip pavyzdys: nuo kliento žinutės iki atsargiai paruošto pirmo atsakymo ir vieno follow-up."
            centered
          />

          <ol className="mt-11 grid gap-4 md:grid-cols-2">
            {workflowSteps.map((step, index) => (
              <WorkflowCard key={step.title} step={step} index={index} />
            ))}
          </ol>
        </Section>

        <RulesAndAvailability />
        <DemoCases />
        <SafetyBoundaries />

        <section id="cta" className="px-6 py-[clamp(60px,8vw,92px)]">
          <div className="mx-auto max-w-[820px] text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[15px] bg-brand text-white shadow-cta">
              <DemoIcon name="spark" />
            </div>
            <h2 className="mt-5 text-[clamp(28px,4vw,44px)] font-extrabold leading-[1.12] text-ink [text-wrap:balance]">
              Norite, kad įvertintume jūsų užklausas?
            </h2>
            <p className="mx-auto mt-4 max-w-[62ch] text-[17px] leading-relaxed text-ink-soft">
              Atsiųskite kelias tipines užklausas arba palikite kontaktą —
              susisieksime ir paruošime pasiūlymą pagal jūsų paslaugas,
              taisykles ir užklausų kanalus.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button href="/#cta" size="lg">
                Gauti pasiūlymą
              </Button>
              <Button href="/" size="lg" variant="secondary">
                Grįžti į pagrindinį puslapį
              </Button>
            </div>
          </div>
        </section>
      </main>
      <DemoFooter />
    </>
  );
}
