"use client";

import { motion } from "framer-motion";
import {
  AudioLines,
  GitBranch,
  LayoutGrid,
  Network,
  ScrollText,
  Share2,
} from "lucide-react";

const features = [
  { icon: LayoutGrid, title: "Architecture maps", body: "Auto-generated module diagrams from the actual file tree." },
  { icon: ScrollText, title: "Code walkthroughs", body: "Highlighted code with narration over the parts that matter." },
  { icon: AudioLines, title: "Voice narration", body: "OpenAI or ElevenLabs voices, your pick." },
  { icon: Network, title: "Dependency graphs", body: "See how the pieces wire together — not just where they live." },
  { icon: GitBranch, title: "Key insights", body: "Patterns, design choices, the architecture's intent." },
  { icon: Share2, title: "Export & share", body: "MP4 download, shareable links, embeddable players." },
];

export function Features() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-violet-glow">What you get</p>
        <h2 className="mt-4 font-display text-4xl font-bold tracking-tight text-ink-50">
          Built for engineers in a hurry
        </h2>
      </div>

      <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.4, delay: (index % 3) * 0.08 }}
              className="glass rounded-xl p-6"
            >
              <Icon className="h-5 w-5 text-cyan-glow" />
              <h3 className="mt-4 font-display text-lg font-semibold text-ink-50">{feature.title}</h3>
              <p className="mt-1 text-sm text-ink-50/60">{feature.body}</p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
