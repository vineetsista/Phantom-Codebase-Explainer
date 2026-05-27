"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Logo } from "@/components/shared/Logo";
import { cn } from "@/lib/utils";

const links = [
  { href: "/generate", label: "Generate" },
  { href: "/showcase", label: "Showcase" },
  { href: "/trending", label: "Trending" },
  { href: "/#how", label: "How it works" },
];

export function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  // Embed surfaces render inside other people's iframes — no chrome.
  if (pathname?.startsWith("/embed")) return null;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-400 ease-luxe",
        scrolled
          ? "border-b border-white/[0.04] bg-void/80 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-6">
        <Logo />
        <nav className="hidden items-center gap-8 text-sm text-fog md:flex">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "transition-colors duration-300 ease-luxe hover:text-bone",
                  active && "text-bone",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <Link
          href="/generate"
          className="group inline-flex h-9 items-center gap-2 rounded-full bg-electric px-4 text-sm font-medium text-ink transition-all duration-300 ease-luxe hover:brightness-110 hover:shadow-[0_0_24px_-4px_rgba(0,240,255,0.7)]"
        >
          Try RepoX
          <span className="transition-transform duration-300 ease-luxe group-hover:translate-x-0.5">
            →
          </span>
        </Link>
      </div>
    </header>
  );
}
