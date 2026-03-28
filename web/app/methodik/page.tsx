import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@thalamiq/ui/components/card";
import { Badge } from "@thalamiq/ui/components/badge";
import { Separator } from "@thalamiq/ui/components/separator";

export const metadata: Metadata = {
  title: "Methodik",
  description:
    "Wie GerMedBench funktioniert: Synthetische Datengenerierung, Evaluationsverfahren, Scoring-Metriken und Transparenz-Hinweise.",
  alternates: { canonical: "/methodik" },
};

export default function MethodikPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight">Methodik</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Datengrundlage, Evaluationsverfahren und Bewertungskriterien
        </p>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="mb-3 text-lg font-semibold">Warum GerMedBench?</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Allgemeine LLM-Leaderboards wie{" "}
            <a href="https://artificialanalysis.ai/" target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline underline-offset-4 hover:text-foreground/80">Artificial Analysis</a> und{" "}
            <a href="https://lmarena.ai/" target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline underline-offset-4 hover:text-foreground/80">LM Arena</a>{" "}
            messen Modelle auf englischsprachigen, domänenübergreifenden Tasks.
            GerMedBench ergänzt diese um eine Dimension, die dort fehlt:
            die Evaluation auf <strong>deutschen klinischen Texten</strong> mit
            fachspezifischen Aufgaben wie ICD-10-Kodierung, Arztbrief-Zusammenfassung
            und Differentialdiagnostik.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Bestehende deutsche Datensätze (GGPONC, BRONCO, GraSCCo) wurden für
            die BERT-Ära entwickelt und evaluieren vorwiegend klassische
            NLP-Tasks wie Named Entity Recognition. Generative klinische
            Fähigkeiten moderner LLMs wurden für Deutsch bisher nicht
            systematisch und öffentlich bewertet.
          </p>
        </section>

        <Separator />

        <section>
          <h2 className="mb-3 text-lg font-semibold">Datengenerierung</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Die Benchmark-Daten werden synthetisch generiert. Ein
            Frontier-Modell (<code className="text-xs">gemini-3-flash-preview</code>)
            erstellt für jeden Task fokussierte klinische Texte mit
            passender Ground Truth. Jeder Task erhält Texte in der optimalen
            Länge und mit dem passenden Detailgrad:
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
            <li>
              — ICD-10-Kodierung: Kurzepikrisen (150–300 Wörter)
            </li>
            <li>
              — Arztbrief-Zusammenfassung: Vollständige Entlassbriefe
              (600–1000 Wörter)
            </li>
            <li>
              — Klinisches Reasoning: Fallvignetten ohne explizite Diagnose
              (200–400 Wörter)
            </li>
            <li>
              — Entitätsextraktion: Klinische Textauszüge mit Diagnosen,
              Prozeduren, Medikamenten und Laborwerten (200–400 Wörter)
            </li>
            <li>
              — Medikamentenextraktion: Texte mit Medikamentenlisten
              (150–300 Wörter)
            </li>
          </ul>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Alle Texte variieren über sechs Fachbereiche (Innere Medizin,
            Kardiologie, Pneumologie, Neurologie, Gastroenterologie,
            Onkologie) und drei Komplexitätsgrade. Die synthetische
            Generierung vermeidet Datenschutzprobleme und ermöglicht eine
            kontrollierte Variation. Langfristig ist die Integration
            öffentlicher Korpora (GraSCCo, GGPONC 2.0) sowie
            community-beigetragener anonymisierter Fälle geplant.
          </p>
        </section>

        <Separator />

        <section>
          <h2 className="mb-4 text-lg font-semibold">Evaluationsverfahren</h2>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">
                    ICD-10-GM Kodierung
                  </CardTitle>
                  <Badge variant="default" className="text-xs">
                    Aktiv
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-3">
                <p>
                  <span className="font-medium text-foreground">Aufgabe:</span>{" "}
                  Das Modell erhält einen klinischen Freitext und soll alle
                  kodierbaren ICD-10-GM Codes extrahieren, inklusive der
                  Klassifikation als Haupt- oder Nebendiagnose.
                </p>
                <p>
                  <span className="font-medium text-foreground">
                    Evaluation:
                  </span>{" "}
                  Vollautomatisch, kein LLM-as-Judge erforderlich. Drei Metriken:
                </p>
                <ul className="space-y-1.5 pl-1">
                  <li>
                    <span className="font-medium text-foreground">
                      Exact Match F1
                    </span>{" "}
                    — Precision und Recall auf Ebene der vollständigen ICD-10-GM
                    Codes (z.B. I21.0). Misst, ob das Modell die exakten Codes
                    findet.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Category F1
                    </span>{" "}
                    — Matching auf Kategorie-Ebene (z.B. I21 statt I21.0).
                    Erkennt, ob das Modell zumindest die richtige
                    Diagnose-Kategorie identifiziert, auch wenn die letzte Stelle
                    abweicht.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Hauptdiagnose Accuracy
                    </span>{" "}
                    — Ob das Modell die korrekte Hauptdiagnose identifiziert.
                    Klinisch besonders relevant, da die Hauptdiagnose
                    abrechnungsrelevant ist.
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">
                    Klinische Entitätsextraktion
                  </CardTitle>
                  <Badge variant="default" className="text-xs">
                    Aktiv
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-3">
                <p>
                  <span className="font-medium text-foreground">Aufgabe:</span>{" "}
                  Das Modell erhält einen Auszug aus einem Entlassbrief und soll
                  alle klinischen Entitäten erkennen und klassifizieren:
                  Diagnosen (mit ICD-10-GM), Prozeduren (mit OPS), Medikamente
                  (Wirkstoff, Dosierung) und Laborwerte (Parameter, Wert, Einheit).
                </p>
                <p>
                  <span className="font-medium text-foreground">
                    Evaluation:
                  </span>{" "}
                  Vollautomatisch, kein LLM-as-Judge erforderlich. Fünf Metriken:
                </p>
                <ul className="space-y-1.5 pl-1">
                  <li>
                    <span className="font-medium text-foreground">
                      Micro F1
                    </span>{" "}
                    — Micro-gemittelter F1-Score über alle Entitätstypen.
                    Primäre Leaderboard-Metrik.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Diagnose F1
                    </span>{" "}
                    — F1 für Diagnose-Entitäten (Name + ICD-10-GM Code).
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Prozedur F1
                    </span>{" "}
                    — F1 für Prozedur-Entitäten (Name + OPS Code).
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Medikament F1
                    </span>{" "}
                    — F1 für Medikamenten-Entitäten (Wirkstoff, Dosierung).
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Laborwert F1
                    </span>{" "}
                    — F1 für Laborwert-Entitäten (Parameter, Wert, Einheit).
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">
                    Klinisches Reasoning
                  </CardTitle>
                  <Badge variant="default" className="text-xs">
                    Aktiv
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-3">
                <p>
                  <span className="font-medium text-foreground">Aufgabe:</span>{" "}
                  Das Modell erhält eine klinische Fallvignette mit Anamnese,
                  Untersuchungsbefund, Laborwerten und ggf. Bildgebung. Es soll
                  eine geordnete Differentialdiagnose-Liste mit klinischer
                  Begründung erstellen.
                </p>
                <p>
                  <span className="font-medium text-foreground">
                    Evaluation:
                  </span>{" "}
                  Hybrid — automatische DDx-Metriken plus LLM-as-Judge. Sechs
                  Metriken:
                </p>
                <ul className="space-y-1.5 pl-1">
                  <li>
                    <span className="font-medium text-foreground">
                      Top-1 Accuracy
                    </span>{" "}
                    — Hat das Modell die korrekte Diagnose an erster Stelle?
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Top-3 Recall
                    </span>{" "}
                    — Ist die korrekte Diagnose unter den ersten drei
                    Differentialdiagnosen?
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      DDx Overlap F1
                    </span>{" "}
                    — Überlappung der vorgeschlagenen mit den
                    Referenz-Differentialdiagnosen.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Reasoning-Qualität
                    </span>{" "}
                    — Sind die Begründungen klinisch nachvollziehbar und
                    befundbasiert?
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      DDx-Plausibilität
                    </span>{" "}
                    — Ist die Reihenfolge der Differentialdiagnosen klinisch
                    sinnvoll?
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Red-Flag-Bewusstsein
                    </span>{" "}
                    — Werden gefährliche Differentialdiagnosen angemessen
                    berücksichtigt?
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">
                    Medikamentenextraktion
                  </CardTitle>
                  <Badge variant="default" className="text-xs">
                    Aktiv
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-3">
                <p>
                  <span className="font-medium text-foreground">Aufgabe:</span>{" "}
                  Das Modell erhält einen klinischen Text mit Medikamentenangaben
                  und soll für jedes Medikament Wirkstoff, Dosis und
                  Einnahmefrequenz strukturiert extrahieren.
                </p>
                <p>
                  <span className="font-medium text-foreground">
                    Evaluation:
                  </span>{" "}
                  Vollautomatisch, kein LLM-as-Judge erforderlich. Drei Metriken:
                </p>
                <ul className="space-y-1.5 pl-1">
                  <li>
                    <span className="font-medium text-foreground">
                      Wirkstoff F1
                    </span>{" "}
                    — F1 auf Ebene der Wirkstoff-Erkennung (fuzzy Matching).
                    Primäre Leaderboard-Metrik.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Partial F1
                    </span>{" "}
                    — Wirkstoff korrekt und mindestens Dosis oder Frequenz stimmen.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Exact F1
                    </span>{" "}
                    — Wirkstoff, Dosis und Frequenz alle korrekt.
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">
                    Arztbrief-Zusammenfassung
                  </CardTitle>
                  <Badge variant="default" className="text-xs">
                    Aktiv
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-3">
                <p>
                  <span className="font-medium text-foreground">Aufgabe:</span>{" "}
                  Das Modell erhält einen vollständigen Entlassbrief und soll
                  eine strukturierte Zusammenfassung mit vier Feldern erstellen:
                  Hauptdiagnose, Therapie, Procedere und offene Fragen.
                </p>
                <p>
                  <span className="font-medium text-foreground">
                    Evaluation:
                  </span>{" "}
                  LLM-as-Judge (<code className="text-xs">gemini-3.1-pro-preview</code>) bewertet
                  jede Zusammenfassung anhand einer klinischen Rubrik mit vier
                  Dimensionen (je 1–5):
                </p>
                <ul className="space-y-1.5 pl-1">
                  <li>
                    <span className="font-medium text-foreground">
                      Faktentreue
                    </span>{" "}
                    — Sind alle genannten Fakten korrekt und im Original belegbar?
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Vollständigkeit
                    </span>{" "}
                    — Sind alle klinisch relevanten Informationen enthalten?
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Halluzinationsfreiheit
                    </span>{" "}
                    — Enthält die Zusammenfassung keine erfundenen Informationen?
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Formatkonformität
                    </span>{" "}
                    — Entspricht die Zusammenfassung dem erwarteten Format?
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        <Separator />

        <section>
          <h2 className="mb-3 text-lg font-semibold">Modell-Inferenz</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Open-Source-Modelle werden über Together AI evaluiert. Jedes Modell
            erhält denselben Prompt mit dem klinischen Text und soll die
            Ergebnisse in einem strukturierten JSON-Format zurückgeben. Die
            Inferenz erfolgt mit Temperatur 0 für maximale Reproduzierbarkeit.
            Antworten, die nicht als gültiges JSON geparst werden können, werden
            als Parse-Fehler gewertet — auch das ist eine relevante Metrik für
            die klinische Einsatzfähigkeit eines Modells.
          </p>
        </section>

        <Separator />

        <section>
          <h2 className="mb-3 text-lg font-semibold">
            Einschränkungen und Transparenz
          </h2>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li>
              — Die aktuelle Datengrundlage ist synthetisch. Synthetische Texte
              können systematische Muster aufweisen, die in echten klinischen
              Texten nicht vorkommen.
            </li>
            <li>
              — ICD-10-GM Kodierung ist ein komplexer Prozess, der in der
              Praxis Kontextwissen erfordert, das über den reinen Text
              hinausgeht (z.B. Kodierrichtlinien, DRG-Relevanz).
            </li>
            <li>
              — Die Benchmark-Ergebnisse sind nicht direkt auf klinische
              Einsatzszenarien übertragbar, sondern dienen als vergleichende
              Orientierung.
            </li>
            <li>
              — Alle Daten, Prompts und Evaluations-Logik sind Open Source und
              reproduzierbar.
            </li>
          </ul>
        </section>

        <Separator />

        <p className="text-xs text-muted-foreground">
          GerMedBench ist ein Open-Source-Projekt von der ThalamiQ GmbH.
        </p>
      </div>
    </div>
  );
}
