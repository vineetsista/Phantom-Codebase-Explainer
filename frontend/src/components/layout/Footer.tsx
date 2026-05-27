"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/shared/Logo";

type FooterLink = {
  href?: string;
  label: string;
  external?: boolean;
};

const columns: { title: string; links: FooterLink[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/#how", label: "How it works" },
      { href: "/showcase", label: "Showcase" },
      { href: "/trending", label: "Trending" },
      { href: "/search", label: "Search" },
      { href: "/generate", label: "Generate" },
    ],
  },
  {
    title: "Resources",
    links: [
      {
        href: "https://github.com/vineetsista/Phantom",
        label: "GitHub",
        external: true,
      },
      { href: "/status", label: "Status" },
      { label: "Docs · coming soon" },
      { label: "Changelog · coming soon" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      {
        href: "https://twitter.com/usephantom",
        label: "Twitter",
        external: true,
      },
      { href: "mailto:hello@phantom.video", label: "Contact" },
      { href: "/privacy", label: "Privacy" },
    ],
  },
];

export function Footer() {
  const pathname = usePathname();
  if (pathname?.startsWith("/embed")) return null;

  return (
    <footer className="mt-48 border-t border-white/[0.06] bg-void">
      <div className="mx-auto max-w-[1280px] px-6 py-24">
        <div className="grid gap-16 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="space-y-6">
            <Logo />
            <p className="max-w-xs text-sm leading-relaxed text-fog">
              The AI that understands codebases. RepoX is the first product —
              more coming.
            </p>
            <div className="kicker">v0.1 · beta</div>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <div className="kicker mb-6 text-fog">{column.title}</div>
              <ul className="space-y-4">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.href ? (
                      <Link
                        href={link.href}
                        target={link.external ? "_blank" : undefined}
                        rel={link.external ? "noreferrer" : undefined}
                        className="text-sm text-bone transition-colors duration-300 ease-luxe hover:text-electric"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <span className="text-sm text-mist">{link.label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-24 flex flex-col items-start justify-between gap-3 border-t border-white/[0.04] pt-8 text-xs text-mist sm:flex-row sm:items-center">
          <span>© {new Date().getFullYear()} Phantom · All rights reserved.</span>
          <span>
            Built by{" "}
            <a
              href="https://twitter.com/usephantom"
              className="text-bone transition-colors duration-300 ease-luxe hover:text-electric"
            >
              Vineet Sista
            </a>{" "}
            in Columbus, Ohio.
          </span>
        </div>
      </div>
    </footer>
  );
}
