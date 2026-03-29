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
            Im Gesundheitswesen gelten strenge Datenschutz- und
            Regulierungsanforderungen. Patientendaten dürfen in der Regel nicht
            an externe Cloud-Dienste übermittelt werden — in der Praxis bedeutet
            das, dass Kliniken und Gesundheitsunternehmen auf{" "}
            <strong>Open-Weights-Modelle</strong> angewiesen sind, die lokal
            oder on-premise betrieben werden können.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Allgemeine LLM-Leaderboards wie{" "}
            <a href="https://artificialanalysis.ai/" target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline underline-offset-4 hover:text-foreground/80">Artificial Analysis</a> und{" "}
            <a href="https://lmarena.ai/" target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline underline-offset-4 hover:text-foreground/80">LM Arena</a>{" "}
            messen Modelle auf englischsprachigen, domänenübergreifenden Tasks.
            GerMedBench ergänzt diese um eine Dimension, die dort fehlt:
            die Evaluation von <strong>Open-Weights-Modellen</strong> auf{" "}
            <strong>deutschen klinischen Texten</strong> mit fachspezifischen
            Aufgaben wie ICD-10-Kodierung, Arztbrief-Zusammenfassung und
            Differentialdiagnostik — genau die Modelle, die im klinischen
            Alltag tatsächlich einsetzbar sind.
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
              — Medikamentenextraktion: Texte mit Medikamentenlisten
              (150–300 Wörter)
            </li>
            <li>
              — Medizinisches Wissen: IMPP-Stil MC-Fragen mit Fallvignette
              (5 Antwortmöglichkeiten)
            </li>
            <li>
              — Patientenverständliche Erklärung: Medizinische Fachtexte
              (Befundberichte, Histopathologie, Laborbefunde, 100–250 Wörter)
            </li>
          </ul>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Alle Texte variieren über neun Fachbereiche (Innere Medizin,
            Kardiologie, Pneumologie, Neurologie, Gastroenterologie,
            Onkologie, Orthopädie/Unfallchirurgie, Psychiatrie/Psychosomatik,
            Gynäkologie/Geburtshilfe) und drei Komplexitätsgrade. Die synthetische
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
                  Hybrid — automatische DDx-Metriken plus LLM-as-Judge.
                  Diagnose-Namen werden per LLM-assistiertem Matching verglichen
                  (Gemini Flash Lite), um Synonym-Varianten korrekt zu erkennen
                  (z.B. &quot;Bakterielle Pneumonie&quot; ↔ &quot;Ambulant erworbene Pneumonie&quot;).
                  Sechs Metriken:
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
                  Vollautomatisch. Wirkstoff-Matching per LLM-assistiertem
                  Vergleich (Gemini Flash Lite), um Handelsnamen, Salzformen
                  und Abkürzungen korrekt zuzuordnen
                  (z.B. &quot;ASS&quot; ↔ &quot;Acetylsalicylsäure&quot;). Drei Metriken:
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
                    Medizinisches Wissen
                  </CardTitle>
                  <Badge variant="default" className="text-xs">
                    Aktiv
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-3">
                <p>
                  <span className="font-medium text-foreground">Aufgabe:</span>{" "}
                  Das Modell erhält eine klinische Multiple-Choice-Frage im Stil
                  des IMPP M2 Staatsexamens (Zweiter Abschnitt der Ärztlichen
                  Prüfung). Jede Frage enthält eine kurze Fallvignette und fünf
                  Antwortmöglichkeiten (A–E), von denen genau eine korrekt ist.
                </p>
                <p>
                  <span className="font-medium text-foreground">
                    Evaluation:
                  </span>{" "}
                  Vollautomatisch, kein LLM-as-Judge erforderlich. Eine Metrik:
                </p>
                <ul className="space-y-1.5 pl-1">
                  <li>
                    <span className="font-medium text-foreground">
                      Accuracy
                    </span>{" "}
                    — Anteil korrekt beantworteter Fragen. Misst klinisches
                    Fachwissen über Diagnostik, Therapie, Pharmakologie und
                    Pathophysiologie auf Staatsexamen-Niveau.
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">
                    Patientenverständliche Erklärung
                  </CardTitle>
                  <Badge variant="default" className="text-xs">
                    Aktiv
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-3">
                <p>
                  <span className="font-medium text-foreground">Aufgabe:</span>{" "}
                  Das Modell erhält einen komplexen medizinischen Fachtext
                  (Befundbericht, Laborbefund, Histopathologie, OP-Bericht) und
                  soll diesen so erklären, dass ein Patient ohne medizinische
                  Vorkenntnisse alles versteht.
                </p>
                <p>
                  <span className="font-medium text-foreground">
                    Evaluation:
                  </span>{" "}
                  LLM-as-Judge (<code className="text-xs">gemini-3-flash-preview</code>) bewertet
                  jede Erklärung anhand einer strengen Rubrik mit drei
                  Dimensionen (je 1–5):
                </p>
                <ul className="space-y-1.5 pl-1">
                  <li>
                    <span className="font-medium text-foreground">
                      Verständlichkeit
                    </span>{" "}
                    — Ist der Text für einen Laien ohne Vorkenntnisse verständlich?
                    Jeder unerklärte Fachbegriff ist ein Fehler.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Medizinische Korrektheit
                    </span>{" "}
                    — Sind alle medizinischen Sachverhalte korrekt vereinfacht?
                    Keine irreführenden Vereinfachungen.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Vollständigkeit
                    </span>{" "}
                    — Sind alle klinisch relevanten Informationen kommuniziert?
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
                  LLM-as-Judge (<code className="text-xs">gemini-3-flash-preview</code>) bewertet
                  jede Zusammenfassung anhand einer strengen klinischen Rubrik mit drei
                  Dimensionen (je 1–5, alle Ankerpunkte definiert):
                </p>
                <ul className="space-y-1.5 pl-1">
                  <li>
                    <span className="font-medium text-foreground">
                      Faktentreue
                    </span>{" "}
                    — Sind alle genannten Fakten korrekt und im Original belegbar?
                    Halluzinationen zählen als schwere Fehler.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Vollständigkeit
                    </span>{" "}
                    — Sind alle klinisch relevanten Informationen aus dem
                    Gold Standard enthalten? Punkt-für-Punkt-Vergleich.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Klinische Präzision
                    </span>{" "}
                    — Ist die Zusammenfassung spezifisch und klinisch verwertbar?
                    Generische Formulierungen werden bestraft.
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
            Open-Source-Modelle werden über Together AI und DeepInfra evaluiert. Jedes Modell
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
              — GerMedBench verwendet Frontier-Modelle (Gemini) als Ground-Truth-Generator
              und LLM-as-Judge. Die Qualität der Benchmark-Daten und der
              generativen Bewertungen ist damit durch die Fähigkeiten dieser
              Modelle begrenzt — insbesondere bei deutschem medizinischem
              Fachvokabular können auch Frontier-Modelle Fehler machen.
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
