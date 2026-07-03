import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { SITE } from "@/lib/constants";
import { getSiteUrl } from "@/lib/utils";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-inter",
});

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${SITE.name} — greitesni atsakymai į web ir Paslaugos.lt užklausas`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.shortDescription,
  keywords: [
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
    title: `${SITE.name} — greitesni atsakymai į užklausas`,
    description: SITE.shortDescription,
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
    title: `${SITE.name} — greitesni atsakymai į užklausas`,
    description: SITE.shortDescription,
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
    <html lang="lt" className={inter.variable}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
