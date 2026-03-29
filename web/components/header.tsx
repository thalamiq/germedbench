"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV = [
  { href: "/", label: "Leaderboard" },
  { href: "/modelle", label: "Modelle" },
  { href: "/benchmarks", label: "Benchmarks" },
  { href: "/methodik", label: "Methodik" },
  { href: "/mitmachen", label: "Mitmachen" },
];

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b border-border/40">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:gap-8 sm:px-6 sm:py-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight sm:gap-2.5 sm:text-xl">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-5 w-5 sm:h-6 sm:w-6"
            aria-hidden="true"
          >
            <rect x="2" y="13" width="5" height="9" rx="1.5" className="fill-primary/40" />
            <rect x="9.5" y="7" width="5" height="15" rx="1.5" className="fill-primary/70" />
            <rect x="17" y="2" width="5" height="20" rx="1.5" className="fill-primary" />
          </svg>
          <span>
            <span className="text-primary">Ger</span>
            <span className="text-foreground">Med</span>
            <span className="text-primary">Bench</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden gap-1 sm:flex">
          {NAV.map(({ href, label }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {/* Mobile menu button */}
          <button
            onClick={() => setOpen(!open)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground sm:hidden"
            aria-label="Menü"
          >
            {open ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile nav dropdown */}
      {open && (
        <nav className="border-t border-border/40 px-4 py-2 sm:hidden">
          {NAV.map(({ href, label }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
