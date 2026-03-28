import type { Metadata } from "next";
import "@/globals.css";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

const SITE_URL = "https://germedbench.de";

export const metadata: Metadata = {
  title: {
    default: "GerMedBench — LLM-Benchmark für deutsche klinische Texte",
    template: "%s | GerMedBench",
  },
  description:
    "Offenes Benchmark-Framework zur Evaluation von LLMs auf deutschen klinischen Texten. Vergleiche Open-Source-Modelle bei ICD-10-Kodierung, Entitätsextraktion und klinischer Zusammenfassung.",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type: "website",
    locale: "de_DE",
    url: SITE_URL,
    siteName: "GerMedBench",
    title: "GerMedBench — LLM-Benchmark für deutsche klinische Texte",
    description:
      "Offenes Benchmark-Framework zur Evaluation von LLMs auf deutschen klinischen Texten. Vergleiche Open-Source-Modelle bei ICD-10-Kodierung und mehr.",
  },
  twitter: {
    card: "summary_large_image",
    title: "GerMedBench — LLM-Benchmark für deutsche klinische Texte",
    description:
      "Offenes Benchmark-Framework zur Evaluation von LLMs auf deutschen klinischen Texten.",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className="flex min-h-screen flex-col bg-background text-foreground antialiased">
        <Header />
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
