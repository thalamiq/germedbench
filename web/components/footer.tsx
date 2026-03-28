import Link from "next/link";
import { Separator } from "@thalamiq/ui/components/separator";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-border/40">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-sm text-muted-foreground">
        <p>
          Ein Open-Source-Projekt von{" "}
          <a
            href="https://thalamiq.io"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground hover:text-primary transition-colors"
          >
            ThalamiQ
          </a>
        </p>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/thalamiq/germedbench"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            GitHub
          </a>
          <Separator orientation="vertical" className="h-4" />
          <a
            href="https://thalamiq.io"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            thalamiq.io
          </a>
        </div>
      </div>
    </footer>
  );
}
