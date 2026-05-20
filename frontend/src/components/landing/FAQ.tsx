"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useState } from "react";

const items = [
  {
    q: "What kinds of repos work best?",
    a: "Anything up to roughly 100MB on the free tier. Public works out of the box; private needs a personal access token. The analyzer handles 12+ languages — TypeScript, Python, Go, Rust, Java, Ruby, and friends. Tiny single-file demos work but get short videos; gigantic monorepos may take longer to render.",
  },
  {
    q: "How long does generation take?",
    a: "Most repos finish in 2 to 5 minutes. Larger codebases on the free tier may queue. Pro users skip the queue entirely.",
  },
  {
    q: "Where does the narration come from?",
    a: "By default, OpenAI's tts-1-hd voice. Pro users can switch to ElevenLabs for premium voices. The script itself is written by Claude based on the actual repo analysis — not generic templates.",
  },
  {
    q: "Can I use private repositories?",
    a: "Yes — you'll need to provide a GitHub personal access token with read access. Tokens are encrypted at rest and never logged. Repos are cloned to ephemeral storage and deleted immediately after the video renders.",
  },
  {
    q: "Who owns the video?",
    a: "You do. Phantom keeps a watermarked copy for free tier; Pro and Studio tiers are watermark-free and yours to use anywhere — internal docs, YouTube, talks, your portfolio.",
  },
  {
    q: "Can I customize the video?",
    a: "Pro adds API access so you can script the generation. Studio adds custom branding, intro/outro cards, and a white-label embed. A full template editor is on the roadmap.",
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
