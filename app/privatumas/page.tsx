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
      <p className="mt-4 leading-relaxed text-ink-soft">
        Tai yra dokumento vietos rezervavimas. Prieš viešą paleidimą čia bus
        įrašyta pilna {SITE.name} privatumo politika: kokius duomenis renkame
        per pasiūlymo formą, kaip juos saugome ir kaip su mumis susisiekti dėl
        duomenų.
      </p>
      <p className="mt-4 leading-relaxed text-ink-soft">
        Kol kas pasiūlymo formos duomenis naudojame tik tam, kad susisiektume su
        jumis dėl pasiūlymo. Duomenų trečiosioms šalims neperduodame.
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
