"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check, Code2, Copy, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { VideoRecord } from "@/lib/api";

interface EmbedModalProps {
  open: boolean;
  onClose: () => void;
  video: VideoRecord;
}

type Theme = "dark" | "light" | "auto";

export function EmbedModal({ open, onClose, video }: EmbedModalProps) {
  const [copied, setCopied] = useState(false);
  const [shareOrigin, setShareOrigin] = useState("");
  const [width, setWidth] = useState("100%");
  const [height, setHeight] = useState("500");
  const [theme, setTheme] = useState<Theme>("dark");
  const [hideControls, setHideControls] = useState(false);
  const [autoplay, setAutoplay] = useState(false);
  const [loop, setLoop] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") setShareOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const embedUrl = useMemo(() => {
    if (!shareOrigin) return "";
    const params = new URLSearchParams();
    if (theme !== "dark") params.set("theme", theme);
    if (hideControls) params.set("controls", "0");
    if (autoplay) params.set("autoplay", "1");
    if (loop) params.set("loop", "1");
    const qs = params.toString();
    return `${shareOrigin}/embed/${video.id}${qs ? `?${qs}` : ""}`;
  }, [shareOrigin, video.id, theme, hideControls, autoplay, loop]);

  const embedCode = useMemo(() => {
    if (!embedUrl) return "";
    const w = /^\d+$/.test(width) ? `${width}` : width;
    return `<iframe src="${embedUrl}" width="${w}" height="${height}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
  }, [embedUrl, width, height]);

  async function copy() {
    await navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[200] grid place-items-center bg-void/80 px-4 backdrop-blur"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            onClick={(event) => event.stopPropagation()}
            className="surface-2 relative w-full max-w-[680px] rounded-3xl p-8"
            role="dialog"
            aria-labelledby="embed-title"
            aria-modal="true"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full bg-white/[0.04] text-fog transition-colors duration-300 hover:bg-white/10 hover:text-bone"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="kicker flex items-center gap-2">
              <Code2 className="h-3 w-3" /> Embed
            </div>
            <h2
              id="embed-title"
              className="mt-3 font-display text-3xl font-bold tracking-tight text-bone"
            >
              Drop it in anywhere.
            </h2>
            <p className="mt-2 text-sm text-fog">
              Notion, your docs, your blog, a customer-facing changelog. Updates live.
            </p>

            {/* Options grid */}
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <Field label="Width">
                <input
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                  placeholder="100% or 720"
                  className={INPUT}
                />
              </Field>
              <Field label="Height (px)">
                <input
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="500"
                  className={INPUT}
                />
              </Field>
              <Field label="Theme">
                <div className="flex gap-2">
                  {(["dark", "light", "auto"] as Theme[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTheme(t)}
                      className={
                        "rounded-full px-3 py-1 text-xs font-mono uppercase tracking-[0.32em] transition-colors duration-300 " +
                        (theme === t
                          ? "bg-electric/15 text-electric"
                          : "bg-white/[0.04] text-fog hover:bg-white/[0.08] hover:text-bone")
                      }
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </Field>
              <div className="flex flex-col gap-2 pt-1">
                <Toggle checked={hideControls} onChange={setHideControls} label="Hide controls" />
                <Toggle checked={autoplay} onChange={setAutoplay} label="Autoplay (muted)" />
                <Toggle checked={loop} onChange={setLoop} label="Loop" />
              </div>
            </div>

            {/* Embed code box */}
            <div className="mt-7">
              <label className="kicker mb-2 block text-fog">Snippet</label>
              <div className="flex items-start gap-2 rounded-2xl border border-white/[0.08] bg-ink/60 p-3">
                <code className="flex-1 break-all font-mono text-[11px] leading-relaxed text-fog">
                  {embedCode}
                </code>
                <button
                  type="button"
                  onClick={copy}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full bg-electric px-4 py-2 text-xs font-semibold text-ink transition-all duration-300 hover:brightness-110"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="mt-3 text-xs text-mist">
                The iframe is light (~6KB shell) and lazy-loads the video on play.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const INPUT =
  "h-9 w-full rounded-full border border-white/[0.08] bg-ink/60 px-4 font-mono text-sm text-bone outline-none transition-colors duration-300 focus:border-electric/40";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="kicker text-fog">{label}</span>
      {children}
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 text-left"
    >
      <span
        className={
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-300 " +
          (checked ? "bg-electric" : "bg-white/[0.1]")
        }
      >
        <span
          className={
            "inline-block h-3.5 w-3.5 transform rounded-full bg-bone shadow transition-transform duration-300 " +
            (checked ? "translate-x-[18px]" : "translate-x-1")
          }
        />
      </span>
      <span className="text-sm text-bone">{label}</span>
    </button>
  );
}
