import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Privatumo politika",
  description: `${SITE.name} privatumo politika.`,
  robots: { index: false, follow: true },
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-20 sm:px-6">
      <Link href="/" className="text-brand-600 text-sm font-medium">
        ← Grįžti į pradžią
      </Link>
      <h1 className="mt-6 text-3xl font-bold text-ink">Privatumo politika</h1>
      <p className="mt-2 text-sm text-ink-soft">Atnaujinta 2026-07-14</p>
      <p className="mt-4 rounded-lg border border-warn-border bg-warn-bg p-4 text-sm font-semibold leading-relaxed text-warn-text">
        Tai produkto privatumo informacijos projektas. Prieš viešą paleidimą
        būtina įrašyti realų duomenų valdytoją, teisinius pagrindus, konkrečius
        saugojimo terminus, tarptautinių perdavimų informaciją ir skundo
        instituciją bei atlikti teisinę peržiūrą.
      </p>
      <p className="mt-4 leading-relaxed text-ink-soft">
        {SITE.name} padeda paslaugų teikėjams priimti klientų užklausas ir
        parengti atsakymo juodraščius. Paslaugų teikėjas, kuris prijungia savo
        formą ar Paslaugos.lt šaltinį, sprendžia, kokiu tikslu tvarkomi jo
        klientų duomenys; {SITE.name} šiuos duomenis tvarko paslaugai suteikti.
      </p>

      <h2 className="mt-8 text-xl font-bold text-ink">
        Kokius duomenis tvarkome
      </h2>
      <p className="mt-4 leading-relaxed text-ink-soft">
        Priklausomai nuo užklausos, galime tvarkyti vardą, el. pašto adresą,
        telefono numerį, miestą, užklausos tekstą, puslapio URL, laiško
        antraštes, gavėjus, laiką ir priedų metadata. Priedų turinio ši versija
        neanalizuoja. Taip pat saugome source integracijos, apdorojimo būsenos,
        atsakymo juodraščio, žmogaus patvirtinto išsiųsto laiško, siuntėjo bei
        gavėjo adresų, providerio event ID, pristatymo/bounce/complaint būsenos,
        ribotos klaidos diagnostikos ir audituotų naudotojo veiksmų duomenis.
      </p>

      <h2 className="mt-8 text-xl font-bold text-ink">Šaltinių ribojimas</h2>
      <p className="mt-4 leading-relaxed text-ink-soft">
        Bendros kliento pašto dėžutės persiųsti nereikia ir nerekomenduojama.
        Svetainės forma siunčia struktūruotą serverio užklausą, o Paslaugos.lt
        integracijai turi būti naudojama tiksli pašto taisyklė, persiunčianti
        tik Paslaugos.lt pranešimus. Kiti laiškai neturi patekti į {SITE.name}.
      </p>

      <h2 className="mt-8 text-xl font-bold text-ink">Paslaugų teikėjai</h2>
      <p className="mt-4 leading-relaxed text-ink-soft">
        Duomenims priimti, saugoti ir atsakymams parengti gali būti naudojami
        infrastruktūros, el. pašto priėmimo ir siuntimo (Resend), duomenų bazės
        ir AI paslaugų teikėjai. Jiems perduodama tik tiek duomenų, kiek reikia
        atitinkamai funkcijai. Duomenys neparduodami ir nenaudojami nesusijusiai
        reklamai.
      </p>

      <h2 className="mt-8 text-xl font-bold text-ink">Sauga ir saugojimas</h2>
      <p className="mt-4 leading-relaxed text-ink-soft">
        Inbound užklausos tikrinamos parašais, kiekvienas šaltinis routinamas
        atskirai, o naudotojai mato tik savo įmonės duomenis. Duomenys saugomi
        tiek, kiek reikia paslaugai, sutartiniams įsipareigojimams ir teisėtiems
        saugos bei apskaitos tikslams; konkretų ištrynimo terminą gali nustatyti
        paslaugą naudojanti įmonė.
      </p>

      <h2 className="mt-8 text-xl font-bold text-ink">Jūsų teisės</h2>
      <p className="mt-4 leading-relaxed text-ink-soft">
        Dėl prieigos, ištaisymo, ištrynimo, tvarkymo apribojimo ar kitų klausimų
        pirmiausia kreipkitės į įmonę, kuriai pateikėte užklausą. Dėl
        {SITE.name} paslaugos ar saugumo taip pat galite rašyti žemiau nurodytu
        adresu. Prieš viešą produkto paleidimą ši politika turi būti suderinta
        su konkrečiais sutartiniais saugojimo terminais ir paslaugų teikėjų
        sąrašu.
      </p>
      <p className="mt-4 leading-relaxed text-ink-soft">
        Klausimai:{" "}
        <a href={`mailto:${SITE.email}`} className="text-brand-600">
          {SITE.email}
        </a>
      </p>
    </main>
  );
}
