"use client";

import { motion } from "framer-motion";

/**
 * Bento grid. CSS grid lets cells span multiple rows/cols freely.
 * Cells use the `data-cursor="interactive"` attribute so the custom cursor
 * expands when hovering them.
 */

export function WhatYouGet() {
  return (
    <section className="mx-auto max-w-[1280px] px-6 py-48">
      <div className="mx-auto max-w-2xl">
        <div className="kicker">What you get</div>
        <h2 className="mt-6 font-display text-4xl font-bold leading-[1.05] tracking-tight text-bone sm:text-5xl md:text-6xl">
          Built for engineers in a hurry.
        </h2>
      </div>

      <div className="mt-24 grid auto-rows-[180px] grid-cols-1 gap-4 md:grid-cols-4">
        <BentoCell className="md:col-span-2 md:row-span-2" delay={0}>
          <ArchitecturePreview />
          <CellLabel kicker="Visual" title="Architecture maps">
            Auto-generated from the actual file tree.
          </CellLabel>
        </BentoCell>

        <BentoCell className="md:col-span-1" delay={0.05}>
          <VoicePreview />
          <CellLabel kicker="Audio" title="Voice narration">
            OpenAI or ElevenLabs.
          </CellLabel>
        </BentoCell>

        <BentoCell className="md:col-span-1" delay={0.1}>
          <ExportPreview />
          <CellLabel kicker="Export" title="Anywhere">
            MP4, embed code, share link.
          </CellLabel>
        </BentoCell>

        <BentoCell className="md:col-span-2" delay={0.12}>
          <CodePreview />
          <CellLabel kicker="Code" title="Walkthroughs">
            Syntax-highlighted, narrated over the parts that matter.
          </CellLabel>
        </BentoCell>

        <BentoCell className="md:col-span-1" delay={0.16}>
          <GraphPreview />
          <CellLabel kicker="Graph" title="Dependencies">
            See how the pieces wire up.
          </CellLabel>
        </BentoCell>

        <BentoCell className="md:col-span-1" delay={0.2}>
          <LangPreview />
          <CellLabel kicker="Lang" title="Polyglot">
            12 languages and counting.
          </CellLabel>
        </BentoCell>
      </div>
    </section>
  );
}

function BentoCell({
  children,
  className,
  delay,
}: {
  children: React.ReactNode;
  className?: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      data-cursor="interactive"
      className={`group relative overflow-hidden rounded-3xl border border-white/[0.06] bg-graphite/60 p-6 transition-all duration-400 ease-luxe hover:-translate-y-1 hover:border-electric/30 hover:bg-graphite ${className ?? ""}`}
    >
      {children}
    </motion.div>
  );
}

function CellLabel({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="absolute inset-x-6 bottom-6 flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-mist">{kicker}</span>
      <h3 className="font-display text-xl font-bold tracking-tight text-bone">{title}</h3>
      <p className="text-sm text-fog">{children}</p>
    </div>
  );
}

/* --- Mini visual previews used in the bento cells ---------------------- */

function ArchitecturePreview() {
  return (
    <svg viewBox="0 0 320 220" className="absolute inset-0 h-2/3 w-full">
      {[
        { x: 40, y: 40 },
        { x: 200, y: 40 },
        { x: 40, y: 140 },
        { x: 200, y: 140 },
      ].map((box, index) => (
        <g key={index}>
          <rect
            x={box.x}
            y={box.y}
            width="80"
            height="50"
            rx="8"
            fill="#0A0A0B"
            stroke="#00F0FF"
            strokeOpacity={0.6}
          />
          <circle cx={box.x + 40} cy={box.y + 25} r="3" fill="#00F0FF" />
        </g>
      ))}
      <path d="M 120 65 L 200 65" stroke="#00F0FF" strokeOpacity={0.35} strokeDasharray="4 6" />
      <path d="M 80 90 L 80 140" stroke="#00F0FF" strokeOpacity={0.35} strokeDasharray="4 6" />
      <path d="M 240 90 L 240 140" stroke="#00F0FF" strokeOpacity={0.35} strokeDasharray="4 6" />
      <path d="M 120 165 L 200 165" stroke="#00F0FF" strokeOpacity={0.35} strokeDasharray="4 6" />
    </svg>
  );
}

function VoicePreview() {
  return (
    <div className="absolute inset-x-6 top-6 flex h-16 items-end gap-1">
      {Array.from({ length: 28 }).map((_, i) => {
        const h = 8 + Math.abs(Math.sin(i * 0.6)) * 48;
        return (
          <span
            key={i}
            style={{ height: `${h}px` }}
            className="block w-1.5 rounded-full bg-electric/70 transition-all duration-300 ease-luxe group-hover:bg-electric"
          />
        );
      })}
    </div>
  );
}

function ExportPreview() {
  return (
    <div className="absolute inset-x-6 top-6 flex gap-2">
      {["MP4", "MOV", "WEBM", "GIF"].map((label, index) => (
        <span
          key={label}
          className="rounded-md border border-white/10 bg-ink/60 px-2 py-1 font-mono text-[10px] tracking-widest text-fog transition-colors duration-300 ease-luxe group-hover:border-electric/40 group-hover:text-electric"
          style={{ transform: `translateY(${index * 4}px)` }}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function CodePreview() {
  const lines = [
    "export async function analyze(repo) {",
    "  const tree = await clone(repo);",
    "  const stats = await scan(tree);",
    "  return summarize(stats);",
    "}",
  ];
  return (
    <pre className="absolute inset-x-6 top-6 overflow-hidden font-mono text-xs text-fog">
      {lines.map((line, i) => (
        <span key={i} className="block">
          <span className="mr-3 text-mist">{(i + 1).toString().padStart(2, "0")}</span>
          <span className={i === 2 ? "text-electric" : undefined}>{line}</span>
        </span>
      ))}
    </pre>
  );
}

function GraphPreview() {
  return (
    <svg viewBox="0 0 200 140" className="absolute inset-x-6 top-6 h-20 w-auto">
      <circle cx="40" cy="70" r="6" fill="#00F0FF" />
      <circle cx="100" cy="30" r="6" fill="#7B61FF" />
      <circle cx="100" cy="110" r="6" fill="#00F0FF" />
      <circle cx="160" cy="70" r="6" fill="#00F0FF" />
      <path d="M40 70 L100 30 L160 70 L100 110 Z" stroke="#00F0FF" strokeOpacity={0.4} fill="none" />
      <path d="M40 70 L160 70" stroke="#7B61FF" strokeOpacity={0.4} />
    </svg>
  );
}

function LangPreview() {
  const langs = ["TS", "PY", "GO", "RS", "JS"];
  return (
    <div className="absolute inset-x-6 top-6 flex flex-wrap gap-1">
      {langs.map((lang) => (
        <span
          key={lang}
          className="rounded-md border border-white/10 bg-ink/60 px-2 py-1 font-mono text-[10px] tracking-widest text-fog"
        >
          {lang}
        </span>
      ))}
    </div>
  );
}
