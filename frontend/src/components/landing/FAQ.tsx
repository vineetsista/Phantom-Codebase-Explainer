"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useState } from "react";

const items = [
  {
    q: "What kinds of repos work best?",
    a: "Anything up to roughly 100MB. Public repos work out of the box. The analyzer handles 12+ languages — TypeScript, Python, Go, Rust, Java, Ruby, and friends. Tiny single-file demos get short videos; gigantic monorepos may take a while to render.",
  },
  {
    q: "How long does generation take?",
    a: "Most repos finish in 8 to 15 minutes. Two scenes (architecture + code walkthrough) render in parallel via Remotion; the assemble + mux step is ffmpeg-bound.",
  },
  {
    q: "Where does the narration come from?",
    a: "ElevenLabs Antoni voice by default (OpenAI tts-1-hd as fallback when no ElevenLabs key is configured). The script itself is written by Claude Sonnet 4.5 based on the actual repo analysis — not generic templates. Word-level alignment data drives the visual sync so module reveals and code highlights land exactly when the narrator speaks them.",
  },
  {
    q: "Is this a real product or a project?",
    a: "Portfolio project — open source on GitHub. No plans, no quotas, no Stripe. Clone it, drop your own API keys in .env, and run docker-compose up.",
  },
  {
    q: "Who owns the video?",
    a: "Whoever generated it. The MP4s live in your local /output directory (or Cloudflare R2 when R2_* env vars are set). Phantom adds a small watermark by default, configurable in /dashboard/settings.",
  },
  {
    q: "Can I trigger generation programmatically?",
    a: "Yes — create an API key at /dashboard/api-keys, then POST to /api/v1/generate with the X-Phantom-Key header. The intake classifier accepts plain repo URLs, commit URLs, file (blob) URLs, gists, and PRs.",
  },
];

export function FAQ() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-32">
      <div className="text-center">
        <div className="kicker">FAQ</div>
        <h2 className="mt-6 font-display text-4xl font-bold leading-[1.05] tracking-tight text-bone sm:text-5xl">
          Common questions.
        </h2>
      </div>

      <div className="mt-16 divide-y divide-white/[0.06] border-y border-white/[0.06]">
        {items.map((item, index) => (
          <FAQItem key={index} q={item.q} a={item.a} />
        ))}
      </div>
    </section>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="group flex w-full items-center justify-between gap-6 py-6 text-left transition-colors duration-300 hover:text-electric"
      >
        <span className="font-display text-xl font-medium text-bone group-hover:text-bone">
          {q}
        </span>
        <Plus
          aria-hidden
          className={`h-5 w-5 shrink-0 text-fog transition-transform duration-400 ease-luxe ${
            open ? "rotate-45 text-electric" : "rotate-0"
          }`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-6 pr-12 text-base leading-relaxed text-fog">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
