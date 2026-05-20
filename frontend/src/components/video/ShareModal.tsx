"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check, Copy, Linkedin, Twitter, X } from "lucide-react";
import { useEffect, useState } from "react";

import type { VideoRecord } from "@/lib/api";

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  video: VideoRecord;
}

export function ShareModal({ open, onClose, video }: ShareModalProps) {
  const [copied, setCopied] = useState<"link" | "embed" | null>(null);
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareUrl(window.location.href);
    }
  }, []);

  // Close on escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const embedCode = shareUrl
    ? `<iframe src="${shareUrl}/embed" width="100%" height="500" frameborder="0" allowfullscreen></iframe>`
    : "";

  const tweetText = encodeURIComponent(
    `Just generated a video walkthrough of ${video.repo_owner}/${video.repo_name} with @usephantom. AI that actually understands codebases.`,
  );
  const twitterUrl = `https://twitter.com/intent/tweet?text=${tweetText}&url=${encodeURIComponent(shareUrl)}`;
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;

  async function copy(value: string, kind: "link" | "embed") {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1600);
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
            className="surface-2 relative w-full max-w-[640px] rounded-3xl p-8"
            role="dialog"
            aria-labelledby="share-title"
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

            <div className="kicker">Share</div>
            <h2 id="share-title" className="mt-3 font-display text-3xl font-bold tracking-tight text-bone">
              Send it everywhere.
            </h2>
            <p className="mt-2 text-sm text-fog">
              The link unfurls into a rich preview on Twitter, LinkedIn, Slack, Discord.
            </p>

            {/* Live OG card preview */}
            <div className="mt-8 overflow-hidden rounded-2xl border border-white/[0.08] bg-ink">
              <div className="relative aspect-[1200/630] overflow-hidden">
                {video.thumbnail_url ? (
                  <img
                    src={video.thumbnail_url}
                    alt=""
                    className="absolute inset-0 h-full w-full scale-110 object-cover blur-[2px] brightness-[0.45]"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-electric/20 via-graphite to-plasma/20" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/60 to-transparent" />
                <div className="absolute inset-0 flex flex-col justify-between p-6">
                  <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.32em] accent-electric">
                    <span className="live-dot" />
                    Phantom · RepoX
                  </div>
                  <div>
                    <div className="font-display text-xl font-bold text-bone sm:text-2xl">
                      {video.repo_owner}/{video.repo_name}
                    </div>
                    <div className="mt-1 max-w-md text-xs text-fog sm:text-sm">
                      {video.repo_description ||
                        "AI-generated walkthrough of the architecture, key files, and design decisions."}
                    </div>
                    <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-electric/15 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.32em] text-electric">
                      ▶ Watch the codebase explainer
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick share row */}
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <a
                href={twitterUrl}
                target="_blank"
                rel="noreferrer"
                className="surface-1 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-bone transition-all duration-300 ease-luxe hover:border-electric/40 hover:text-electric"
              >
                <Twitter className="h-4 w-4" />
                Share on Twitter
              </a>
              <a
                href={linkedinUrl}
                target="_blank"
                rel="noreferrer"
                className="surface-1 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-bone transition-all duration-300 ease-luxe hover:border-electric/40 hover:text-electric"
              >
                <Linkedin className="h-4 w-4" />
                Share on LinkedIn
              </a>
            </div>

            {/* Copy URL */}
            <div className="mt-6">
              <label className="kicker mb-2 block text-fog">Direct link</label>
              <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-ink/60 pl-4 pr-2">
                <span className="flex-1 truncate font-mono text-sm text-bone">{shareUrl}</span>
                <button
                  type="button"
                  onClick={() => copy(shareUrl, "link")}
                  className="inline-flex items-center gap-2 rounded-full bg-electric px-4 py-2 text-xs font-semibold text-ink transition-all duration-300 hover:brightness-110"
                >
                  {copied === "link" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied === "link" ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            {/* Embed code */}
            <div className="mt-5">
              <label className="kicker mb-2 block text-fog">Embed</label>
              <div className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-ink/60 p-3">
                <code className="flex-1 truncate font-mono text-[11px] text-fog">{embedCode}</code>
                <button
                  type="button"
                  onClick={() => copy(embedCode, "embed")}
                  className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-xs text-bone transition-colors duration-300 hover:bg-white/10"
                >
                  {copied === "embed" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied === "embed" ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
