import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBenchmarkCases } from "@/lib/data";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@thalamiq/ui/components/card";
import { Badge } from "@thalamiq/ui/components/badge";

export const dynamic = "force-dynamic";

const TASK_META: Record<string, { name: string; description: string; metrics: string[]; input: string; output: string }> = {
  icd10_coding: {
    name: "ICD-10-GM Kodierung",
    description: "Haupt- und Nebendiagnosen aus klinischem Freitext kodieren — Benchmark-Fälle und Ergebnisse.",
    metrics: ["Exact Match F1", "Category F1", "Hauptdiagnose Accuracy"],
    input: "Kurzepikrise / Entlassungsbrief",
    output: "ICD-10-GM Codes",
  },
  summarization: {
    name: "Arztbrief-Zusammenfassung",
    description: "Strukturierte Kurzfassung von Entlassbriefen — bewertet durch LLM-as-Judge.",
    metrics: ["Faktentreue", "Vollständigkeit", "Halluzinationsfreiheit", "Formatkonformität", "Overall"],
    input: "Vollständiger Entlassbrief",
    output: "Strukturierte Zusammenfassung (Hauptdiagnose, Therapie, Procedere, Offene Fragen)",
  },
  clinical_reasoning: {
    name: "Klinisches Reasoning",
    description: "Differentialdiagnostik und klinisches Reasoning aus Fallvignetten — bewertet durch automatische DDx-Metriken und LLM-as-Judge.",
    metrics: ["Top-1 Accuracy", "Top-3 Recall", "DDx F1", "Reasoning-Qualität", "DDx-Plausibilität", "Red Flags", "Overall"],
    input: "Klinische Fallvignette (Anamnese, Befunde, Labor)",
    output: "Geordnete Differentialdiagnose-Liste mit Begründung",
  },
  ner: {
    name: "Klinische Entitätsextraktion",
    description: "Diagnosen, Prozeduren, Medikamente und Laborwerte aus klinischem Text erkennen — vollautomatisch evaluiert.",
    metrics: ["Micro F1", "Diagnose F1", "Prozedur F1", "Medikament F1", "Laborwert F1"],
    input: "Entlassbrief-Auszug",
    output: "Strukturierte Entitätenliste (Diagnosen, Prozeduren, Medikamente, Laborwerte)",
  },
  med_extraction: {
    name: "Medikamentenextraktion",
    description: "Wirkstoff, Dosis und Frequenz aus klinischem Freitext extrahieren — vollautomatisch evaluiert.",
    metrics: ["Wirkstoff F1", "Partial F1", "Exact F1"],
    input: "Entlassbrief-Auszug mit Medikamentenliste",
    output: "Strukturierte Medikamentenliste (Wirkstoff, Dosis, Frequenz)",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ task: string }>;
}): Promise<Metadata> {
  const { task } = await params;
  const meta = TASK_META[task];
  if (!meta) return {};
  return {
    title: meta.name,
    description: meta.description,
    alternates: { canonical: `/benchmarks/${task}` },
  };
}

export default async function TaskPage({
  params,
}: {
  params: Promise<{ task: string }>;
}) {
  const { task } = await params;
  const meta = TASK_META[task];
  if (!meta) notFound();

  const cases = getBenchmarkCases(task);

  return (
    <div>
      <div className="mb-1">
        <Link
          href="/benchmarks"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Benchmarks
        </Link>
      </div>

      <div className="mb-2">
        <h1 className="text-2xl font-semibold tracking-tight">{meta.name}</h1>
      </div>

      <div className="mb-8 flex flex-wrap gap-4 text-sm text-muted-foreground">
        <div>
          <span className="font-medium text-foreground">Input:</span>{" "}
          {meta.input}
        </div>
        <div>
          <span className="font-medium text-foreground">Output:</span>{" "}
          {meta.output}
        </div>
        <div className="flex gap-1.5">
          <span className="font-medium text-foreground">Metriken:</span>
          {meta.metrics.map((m) => (
            <Badge key={m} variant="secondary" className="text-xs">
              {m}
            </Badge>
          ))}
        </div>
      </div>

      {cases.length === 0 ? (
        <p className="text-sm text-muted-foreground">Keine Fälle vorhanden.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cases.map((c) => (
            <Link key={c.id} href={`/benchmarks/${task}/${c.id}`}>
              <Card className="h-full transition-colors hover:border-foreground/20 hover:bg-muted/50">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-mono text-sm">
                      {c.id}
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {c.fachbereich}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="mb-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                    {c.text}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {"diagnosen" in c && c.diagnosen.map((d) => (
                      <Badge
                        key={d.code}
                        variant={
                          d.typ === "Hauptdiagnose" ? "default" : "secondary"
                        }
                        className="text-xs"
                      >
                        {d.code}
                      </Badge>
                    ))}
                    {"gold_summary" in c && (
                      <Badge variant="secondary" className="text-xs">
                        {c.komplexitaet}
                      </Badge>
                    )}
                    {"gold_diagnoses" in c && (
                      <>
                        <Badge variant="secondary" className="text-xs">
                          {c.schwierigkeitsgrad}
                        </Badge>
                        <Badge variant="default" className="text-xs">
                          {c.correct_diagnosis}
                        </Badge>
                      </>
                    )}
                    {"entities" in c && (
                      <Badge variant="secondary" className="text-xs">
                        {c.entities.length} Entitäten
                      </Badge>
                    )}
                    {"medications" in c && (
                      <Badge variant="secondary" className="text-xs">
                        {c.medications.length} Medikamente
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
