import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";
import { SITE } from "@/lib/constants";
import { getSiteUrl } from "@/lib/utils";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-inter",
});

const manrope = Manrope({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  weight: ["700", "800"],
  variable: "--font-manrope",
});

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${SITE.name} — pirmas atsakymas klientui per kelias minutes`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.shortDescription,
  keywords: [
    "FirstReply",
    "užklausų atsakymas",
    "Paslaugos.lt",
    "terasų montavimas",
    "tvorų montavimas",
    "stoginės",
    "vartai",
    "orientacinė kaina",
    "montavimo darbai",
  ],
  authors: [{ name: SITE.name }],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "lt_LT",
    url: siteUrl,
    siteName: SITE.name,
    title: `${SITE.name} — greitesni atsakymai į klientų užklausas`,
    description:
      "Pirmas atsakymas klientui per kelias minutes: orientacinė kaina, trūkstami klausimai, preliminarus terminas ir follow-up.",
    images: [
      {
        url: "/opengraph-image.svg",
        width: 1200,
        height: 630,
        alt: SITE.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — greitesni atsakymai į klientų užklausas`,
    description:
      "Pirmas atsakymas klientui per kelias minutes: orientacinė kaina, trūkstami klausimai, preliminarus terminas ir follow-up.",
    images: ["/opengraph-image.svg"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#0d8a66",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="lt" className={`${inter.variable} ${manrope.variable}`}>
      {/*
        suppressHydrationWarning: some browser extensions (e.g. Grammarly,
        LastPass) inject attributes into <body> before React hydrates, which
        would otherwise trigger a false-positive hydration mismatch. This does
        NOT hide mismatches from our own code — it only silences attribute
        differences on this single element.
      */}
      <body
        className="min-h-screen bg-page font-sans text-ink antialiased"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
