import type { Metadata } from "next";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@thalamiq/ui/components/card";
import { getBenchmarkCases } from "@/lib/data";

export const metadata: Metadata = {
  title: "Benchmarks",
  description:
    "Klinische Tasks zur Evaluation generativer LLM-Fähigkeiten: ICD-10-Kodierung, Entitätsextraktion und Arztbrief-Zusammenfassung.",
  alternates: { canonical: "/benchmarks" },
};

export const dynamic = "force-dynamic";

const TASKS = [
  {
    id: "icd10_coding",
    name: "ICD-10-GM Kodierung",
    description: "Haupt- und Nebendiagnosen aus klinischem Freitext kodieren",
  },
  {
    id: "summarization",
    name: "Arztbrief-Zusammenfassung",
    description: "Strukturierte Kurzfassung von Entlassbriefen erstellen",
  },
  {
    id: "clinical_reasoning",
    name: "Klinisches Reasoning",
    description:
      "Differentialdiagnostik mit klinischer Begründung aus Fallvignetten",
  },
  {
    id: "ner",
    name: "Klinische Entitätsextraktion",
    description:
      "Diagnosen, Prozeduren, Medikamente und Laborwerte erkennen und klassifizieren",
  },
  {
    id: "med_extraction",
    name: "Medikamentenextraktion",
    description:
      "Wirkstoff, Dosis und Frequenz aus klinischem Freitext extrahieren",
  },
];

export default function BenchmarksPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Benchmarks</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Klinische Tasks zur Evaluation generativer Fähigkeiten
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TASKS.map((task) => {
          const cases = getBenchmarkCases(task.id);
          return (
            <Link key={task.id} href={`/benchmarks/${task.id}`}>
              <Card className="transition-colors hover:border-foreground/20 hover:bg-muted/50">
                <CardHeader>
                  <CardTitle className="text-base">{task.name}</CardTitle>
                  <CardDescription>{task.description}</CardDescription>
                </CardHeader>
                {cases.length > 0 && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {cases.length} Fälle
                    </p>
                  </CardContent>
                )}
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
