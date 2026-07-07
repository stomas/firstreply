import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Naudojimosi sąlygos",
  description: `${SITE.name} naudojimosi sąlygos.`,
  robots: { index: false, follow: true },
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-20 sm:px-6">
      <Link href="/" className="text-brand-600 text-sm font-medium">
        ← Grįžti į pradžią
      </Link>
      <h1 className="mt-6 text-3xl font-bold text-ink">Naudojimosi sąlygos</h1>
      <p className="mt-4 leading-relaxed text-ink-soft">
        Tai yra dokumento vietos rezervavimas. Prieš viešą paleidimą čia bus
        įrašytos pilnos {SITE.name} naudojimosi sąlygos.
      </p>
      <p className="mt-4 leading-relaxed text-ink-soft">
        Svarbu: sistema ruošia arba siunčia orientacinius atsakymus. Galutinę
        sąmatą, kainą ir terminą visada tvirtina paslaugos teikėjas. Sistema
        automatiškai nesiunčia galutinių įsipareigojimų ar garantuotų datų.
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
