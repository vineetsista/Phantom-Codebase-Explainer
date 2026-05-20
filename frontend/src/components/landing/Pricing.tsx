"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import Link from "next/link";

const tiers = [
  {
    name: "Hobby",
    price: "$0",
    cadence: "forever",
    pitch: "Try it without thinking about it.",
    perks: ["2 videos per month", "720p MP4", "Watermark", "Repos up to 5K LOC"],
    cta: "Start free",
    href: "/generate",
    accent: false,
  },
  {
    name: "Pro",
    price: "$19",
    cadence: "per month",
    pitch: "For people who explain code for a living.",
    perks: [
      "Unlimited videos",
      "1080p MP4",
      "No watermark",
      "Any repo size",
      "Priority queue",
      "API access",
    ],
    cta: "Go Pro",
    href: "/generate",
    accent: true,
  },
  {
    name: "Studio",
    price: "$49",
    cadence: "per month",
    pitch: "Teams that want their own brand on every video.",
    perks: [
      "Everything in Pro",
      "Team workspace",
      "Custom branding",
      "White-label embeds",
      "Dedicated support",
    ],
    cta: "Contact sales",
    href: "mailto:hello@phantom.video",
    accent: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-[1280px] px-6 py-48">
      <div className="mx-auto max-w-2xl">
        <div className="kicker">Pricing</div>
        <h2 className="mt-6 font-display text-4xl font-bold leading-[1.05] tracking-tight text-bone sm:text-5xl md:text-6xl">
          Simple, honest pricing.
        </h2>
      </div>

      <div className="mt-24 grid items-stretch gap-6 md:grid-cols-3">
        {tiers.map((tier, index) => (
          <motion.div
            key={tier.name}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
            className={`relative ${tier.accent ? "md:-translate-y-4 md:scale-105" : ""}`}
            data-cursor="interactive"
          >
            <div
              className={
                tier.accent
                  ? "relative h-full overflow-hidden rounded-3xl border border-electric/50 bg-gradient-to-b from-electric/[0.08] via-graphite to-graphite p-8 glow-electric"
                  : "surface-1 relative h-full overflow-hidden rounded-3xl p-8 transition-all duration-400 ease-luxe hover:border-electric/30"
              }
            >
              {tier.accent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-electric px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-ink">
                  Most popular
                </span>
              )}
              <h3 className="font-display text-2xl font-bold text-bone">{tier.name}</h3>
              <p className="mt-2 text-sm text-fog">{tier.pitch}</p>
              <div className="mt-8 flex items-baseline gap-2">
                <span className="font-display text-6xl font-bold tracking-tight text-bone">
                  {tier.price}
                </span>
                <span className="text-sm text-mist">{tier.cadence}</span>
              </div>
              <ul className="mt-8 space-y-3 text-sm text-fog">
                {tier.perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-3">
                    <Check className="mt-1 h-4 w-4 shrink-0 accent-electric" />
                    {perk}
                  </li>
                ))}
              </ul>
              <Link
                href={tier.href}
                className={
                  tier.accent
                    ? "mt-12 inline-flex h-12 w-full items-center justify-center rounded-full bg-electric text-sm font-semibold text-ink transition-all duration-300 ease-luxe hover:brightness-110"
                    : "mt-12 inline-flex h-12 w-full items-center justify-center rounded-full border border-white/15 text-sm font-medium text-bone transition-colors duration-300 ease-luxe hover:border-electric/50 hover:text-electric"
                }
              >
                {tier.cta}
              </Link>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
