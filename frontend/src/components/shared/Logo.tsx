import Link from "next/link";

import { cn } from "@/lib/utils";

export function Logo({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const textSize = size === "sm" ? "text-lg" : size === "lg" ? "text-3xl" : "text-xl";
  return (
    <Link
      href="/"
      className={cn("group inline-flex items-center gap-3", className)}
      aria-label="Phantom — home"
    >
      <span className="relative inline-grid h-8 w-8 place-items-center overflow-hidden rounded-lg bg-graphite ring-1 ring-white/10">
        <span className="font-display text-base font-bold text-bone">P</span>
        <span className="pointer-events-none absolute inset-0 rounded-lg bg-gradient-to-br from-electric/60 via-transparent to-plasma/60 opacity-40 transition-opacity duration-400 ease-luxe group-hover:opacity-90" />
        <span className="pointer-events-none absolute -inset-2 rounded-xl bg-electric/20 opacity-0 blur-xl transition-opacity duration-400 ease-luxe group-hover:opacity-100" />
      </span>
      <span className={cn("font-display font-bold tracking-tight text-bone", textSize)}>
        Phantom
      </span>
    </Link>
  );
}
