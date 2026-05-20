"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

const AUDIENCES = [
  "developer onboarding",
  "technical interviews",
  "code reviews",
  "open source maintainers",
  "engineering managers",
  "DevRel teams",
  "students",
];

export function BuiltFor() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(
      () => setIndex((i) => (i + 1) % AUDIENCES.length),
      2400,
    );
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="relative mx-auto max-w-[1280px] px-6 py-32">
      <div className="flex flex-col items-baseline gap-3 text-balance font-display text-4xl font-bold leading-tight tracking-tighter text-fog sm:flex-row sm:flex-wrap sm:text-5xl md:text-6xl">
        <span>Built for</span>
        <span className="relative inline-block min-h-[1.05em] min-w-[280px]">
          <AnimatePresence mode="wait">
            <motion.span
              key={AUDIENCES[index]}
              initial={{ opacity: 0, y: 12, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -12, filter: "blur(6px)" }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="absolute left-0 top-0 whitespace-nowrap accent-electric"
            >
              {AUDIENCES[index]}.
            </motion.span>
          </AnimatePresence>
        </span>
      </div>
    </section>
  );
}
