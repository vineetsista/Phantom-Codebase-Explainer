"use client";

import { motion, useInView } from "framer-motion";
import { Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function WatchItWork() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inView = useInView(wrapperRef, { margin: "-30% 0px -30% 0px" });
  const [hasPlayed, setHasPlayed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (inView && !hasPlayed) {
      video.play().catch(() => undefined);
      setHasPlayed(true);
    }
  }, [inView, hasPlayed]);

  return (
    <section className="relative mx-auto max-w-[1440px] px-6 py-48">
      <div className="mx-auto max-w-3xl text-center">
        <div className="kicker">Demo</div>
        <h2 className="mt-6 font-display text-4xl font-bold leading-[1.05] tracking-tight text-bone sm:text-5xl md:text-6xl">
          Watch it work.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg text-fog">
          This three-minute video was generated automatically from the React.js
          repo. No editing. No human input.
        </p>
      </div>

      <motion.div
        ref={wrapperRef}
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-15%" }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="relative mx-auto mt-24 aspect-video max-w-[1200px] overflow-hidden rounded-3xl border border-white/[0.08] bg-graphite"
      >
        <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-electric/20" />
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          muted
          loop
          playsInline
          preload="metadata"
          poster="/showcase/react-poster.jpg"
        >
          {/* When you pre-generate showcase videos, drop them into /public/showcase/ */}
          <source src="/showcase/react.mp4" type="video/mp4" />
        </video>

        {!hasPlayed && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-gradient-to-br from-ink/40 via-transparent to-ink/40">
            <div className="grid h-20 w-20 place-items-center rounded-full bg-electric/15 ring-1 ring-electric/40 backdrop-blur-xl">
              <Play className="h-8 w-8 fill-electric text-electric" />
            </div>
          </div>
        )}

        {/* Corner timecode overlay — purely aesthetic */}
        <div className="pointer-events-none absolute right-4 top-4 rounded-full bg-ink/70 px-3 py-1 font-mono text-xs text-fog">
          REC · 00:00:00
        </div>
      </motion.div>
    </section>
  );
}
