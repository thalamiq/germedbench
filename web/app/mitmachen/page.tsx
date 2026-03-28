import type { Metadata } from "next";
import { Separator } from "@thalamiq/ui/components/separator";

export const metadata: Metadata = {
  title: "Mitmachen",
  description:
    "Wie du zu GerMedBench beitragen kannst: Modelle einreichen, Tasks vorschlagen, Daten verbessern.",
  alternates: { canonical: "/mitmachen" },
};

export default function MitmachenPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight">Mitmachen</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          GerMedBench ist ein offenes Projekt — Beiträge sind willkommen
        </p>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="mb-3 text-lg font-semibold">Modell vorschlagen</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Du möchtest ein Modell im Leaderboard sehen, das noch nicht
            evaluiert wurde? Erstelle ein{" "}
            <a
              href="https://github.com/thalamiq/germedbench/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline underline-offset-4 hover:text-foreground/80"
            >
              GitHub Issue
            </a>{" "}
            mit der Modell-ID (z.B. Together AI oder Hugging Face ID). Wir
            übernehmen die Evaluation und veröffentlichen die Ergebnisse.
          </p>
        </section>

        <Separator />

        <section>
          <h2 className="mb-3 text-lg font-semibold">Task vorschlagen</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Du hast eine Idee für einen neuen klinischen Task? Erstelle ein
            GitHub Issue mit folgenden Informationen:
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
            <li>— Beschreibung der Aufgabe und klinische Relevanz</li>
            <li>— Vorgeschlagenes Input/Output-Format</li>
            <li>— Evaluationsansatz (automatisch vs. LLM-as-Judge)</li>
            <li>— Beispiel-Fälle (wenn vorhanden)</li>
          </ul>
        </section>

        <Separator />

        <section>
          <h2 className="mb-3 text-lg font-semibold">Daten verbessern</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Die aktuelle Datengrundlage ist synthetisch. Verbesserungen sind
            besonders wertvoll:
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
            <li>
              — Korrektur fehlerhafter ICD-10 Codes oder Ground-Truth-Annotationen
            </li>
            <li>— Hinweise auf unrealistische Fallkonstruktionen</li>
            <li>
              — Beitrag anonymisierter klinischer Fälle (mit Ethikvotum)
            </li>
          </ul>
        </section>

        <Separator />

        <section>
          <h2 className="mb-3 text-lg font-semibold">Kontakt</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Technische Fragen und Bug Reports:{" "}
            <a
              href="https://github.com/thalamiq/germedbench/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline underline-offset-4 hover:text-foreground/80"
            >
              GitHub Issues
            </a>
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Kooperationsanfragen und allgemeines Feedback:{" "}
            <a
              href="mailto:hello@thalamiq.io"
              className="font-medium text-foreground underline underline-offset-4 hover:text-foreground/80"
            >
              hello@thalamiq.io
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
