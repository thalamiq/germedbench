"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Leaderboard" },
  { href: "/benchmarks", label: "Benchmarks" },
  { href: "/methodik", label: "Methodik" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border/40">
      <div className="mx-auto flex max-w-6xl items-center gap-8 px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5 text-xl font-bold tracking-tight">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-6 w-6"
            aria-hidden="true"
          >
            <rect x="2" y="13" width="5" height="9" rx="1.5" className="fill-primary/40" />
            <rect x="9.5" y="7" width="5" height="15" rx="1.5" className="fill-primary/70" />
            <rect x="17" y="2" width="5" height="20" rx="1.5" className="fill-primary" />
          </svg>
          <span className="flex items-baseline gap-1.5">
            <span>
              <span className="text-primary">Ger</span>
              <span className="text-foreground">Med</span>
              <span className="text-primary">Bench</span>
            </span>
            <span className="text-[10px] font-normal text-muted-foreground">
              by{" "}
              <span className="hover:text-foreground transition-colors">
                ThalamiQ
              </span>
            </span>
          </span>
        </Link>
        <nav className="flex gap-1">
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
      </div>
    </header>
  );
}
