"use client";

import { motion } from "framer-motion";

const steps = [
  {
    n: "01",
    title: "Paste",
    body: "Drop any GitHub URL. Public or private with token.",
    align: "left",
    rotate: -1.2,
    delay: 0,
    icon: PasteIcon,
  },
  {
    n: "02",
    title: "Analyze",
    body: "Our AI reads the codebase like a senior engineer. Architecture, dependencies, the parts that matter.",
    align: "center",
    rotate: 1.4,
    delay: 0.08,
    icon: AnalyzeIcon,
  },
  {
    n: "03",
    title: "Watch",
    body: "Get a polished video with narration, diagrams, and code walkthroughs.",
    align: "right",
    rotate: -0.8,
    delay: 0.16,
    icon: WatchIcon,
  },
] as const;

export function HowItWorks() {
  return (
    <section id="how" className="relative mx-auto max-w-[1280px] px-6 py-48">
      <div className="mx-auto max-w-2xl">
        <div className="kicker">How it works</div>
        <h2 className="mt-6 font-display text-4xl font-bold leading-[1.05] tracking-tight text-bone sm:text-5xl md:text-6xl">
          Three steps to understand any repo.
        </h2>
      </div>

      <div className="relative mt-24 grid gap-12 md:grid-cols-3 md:gap-6">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const offsetClass =
            step.align === "left"
              ? "md:-translate-y-12"
              : step.align === "center"
                ? "md:translate-y-12"
                : "md:translate-y-32";

          return (
            <motion.div
              key={step.n}
              initial={{ opacity: 0, y: 40, rotate: step.rotate * 4 }}
              whileInView={{ opacity: 1, y: 0, rotate: step.rotate }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.9, delay: step.delay, ease: [0.16, 1, 0.3, 1] }}
              className={`relative ${offsetClass}`}
            >
              <div className="surface-1 group relative overflow-hidden rounded-3xl p-8 transition-all duration-400 ease-luxe hover:-translate-y-1 hover:border-electric/40">
                <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-electric/10 blur-3xl transition-opacity duration-600 ease-luxe group-hover:bg-electric/25" />
                <div className="relative flex items-start justify-between">
                  <div className="font-display text-7xl font-bold leading-none accent-electric">
                    {step.n}
                  </div>
                  <div className="grid h-12 w-12 place-items-center rounded-xl border border-electric/30 bg-electric/5">
                    <Icon />
                  </div>
                </div>
                <h3 className="relative mt-12 font-display text-3xl font-bold tracking-tight text-bone">
                  {step.title}
                </h3>
                <p className="relative mt-3 max-w-xs text-base text-fog">{step.body}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

function PasteIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="#00F0FF" strokeWidth="1.5" />
      <path d="M8 12h8M12 8v8" stroke="#00F0FF" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function AnalyzeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="#00F0FF" strokeWidth="1.5" />
      <path d="m20 20-3.5-3.5" stroke="#00F0FF" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7 11h8" stroke="#00F0FF" strokeWidth="1.5" strokeLinecap="round">
        <animate attributeName="opacity" values="1;0.2;1" dur="2s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}

function WatchIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M8 6.5v11l9-5.5-9-5.5Z" fill="#00F0FF" />
    </svg>
  );
}
