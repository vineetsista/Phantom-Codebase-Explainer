"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Compass,
  CornerDownLeft,
  Github,
  LayoutDashboard,
  Search,
  Sparkles,
  Video,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { useToast } from "@/components/shared/Toaster";
import { isValidGitHubUrl } from "@/lib/utils";

/**
 * Cmd+K command palette.
 *
 * Three input modes — auto-detected from the query:
 *   - Fuzzy match against a static command list (navigation, settings)
 *   - GitHub URL detected → "Generate from this URL" becomes the top hit
 *   - Free text → search past videos (TODO once /api/v1/videos?q= exists)
 *
 * Keyboard:
 *   - Cmd/Ctrl+K toggles open
 *   - ↑/↓ moves selection
 *   - Enter executes
 *   - Esc closes
 */

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Used for fuzzy match — defaults to label */
  keywords?: string[];
  run: (router: ReturnType<typeof useRouter>) => void;
}

const STATIC_COMMANDS: Command[] = [
  {
    id: "home",
    label: "Go to home",
    hint: "G H",
    icon: Compass,
    keywords: ["home", "landing", "start"],
    run: (r) => r.push("/"),
  },
  {
    id: "generate",
    label: "Generate a new video",
    hint: "G G",
    icon: Sparkles,
    keywords: ["new", "generate", "create", "make"],
    run: (r) => r.push("/generate"),
  },
  {
    id: "showcase",
    label: "Browse the showcase",
    hint: "G S",
    icon: Video,
    keywords: ["showcase", "gallery", "explore", "browse"],
    run: (r) => r.push("/showcase"),
  },
  {
    id: "dashboard",
    label: "Open dashboard",
    hint: "G D",
    icon: LayoutDashboard,
    keywords: ["dashboard", "my videos", "account"],
    run: (r) => r.push("/admin"),
  },
  {
    id: "trending",
    label: "See trending videos",
    hint: "G T",
    icon: Zap,
    keywords: ["trending", "popular", "top"],
    run: (r) => r.push("/trending"),
  },
  {
    id: "status",
    label: "Check system status",
    icon: Zap,
    keywords: ["status", "uptime", "incident", "health"],
    run: (r) => r.push("/status"),
  },
  {
    id: "api-docs",
    label: "Read API docs",
    icon: Github,
    keywords: ["api", "docs", "developer", "integration"],
    run: (r) => r.push("/docs/api"),
  },
];

function score(query: string, command: Command): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  const haystack = [command.label, ...(command.keywords ?? [])]
    .join(" ")
    .toLowerCase();
  if (haystack.startsWith(q)) return 100;
  if (haystack.includes(q)) return 60;
  // Cheap subsequence match for fuzzy fallback.
  let qi = 0;
  for (let i = 0; i < haystack.length && qi < q.length; i++) {
    if (haystack[i] === q[qi]) qi++;
  }
  return qi === q.length ? 20 : -1;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { toast } = useToast();

  // Cmd/Ctrl+K to toggle. Mac uses meta, others use ctrl.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const isToggle =
        event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey);
      if (isToggle) {
        event.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Autofocus on open. setTimeout is required because the input is
  // conditionally rendered behind AnimatePresence — focus before mount is a
  // no-op.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Build the result list with a synthetic "Generate from this URL" command
  // hoisted to the top whenever the query parses as a GitHub URL.
  const results = useMemo<Command[]>(() => {
    const trimmed = query.trim();
    const isGh = isValidGitHubUrl(trimmed);
    const dynamic: Command[] = isGh
      ? [
          {
            id: "generate-from-url",
            label: `Generate from ${trimmed.replace(/^https?:\/\/(www\.)?github\.com\//, "")}`,
            hint: "↵",
            icon: Sparkles,
            run: (r) => {
              r.push(`/generate?url=${encodeURIComponent(trimmed)}`);
              toast.info("Pasting URL into generation form");
            },
          },
        ]
      : [];
    const scored = STATIC_COMMANDS.map((c) => ({ c, s: score(trimmed, c) }))
      .filter((x) => trimmed === "" || x.s >= 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.c);
    return [...dynamic, ...scored];
  }, [query, toast]);

  // Reset highlighted row when results change.
  useEffect(() => {
    setActiveIndex(0);
  }, [results.length]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[250] grid place-items-start bg-void/70 px-4 pt-[20vh] backdrop-blur"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -4 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="surface-2 mx-auto w-full max-w-[640px] overflow-hidden rounded-2xl"
          >
            <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
              <Search className="h-4 w-4 text-mist" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setOpen(false);
                  else if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setActiveIndex((i) => Math.min(results.length - 1, i + 1));
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setActiveIndex((i) => Math.max(0, i - 1));
                  } else if (event.key === "Enter") {
                    event.preventDefault();
                    const cmd = results[activeIndex];
                    if (cmd) {
                      setOpen(false);
                      cmd.run(router);
                    }
                  }
                }}
                placeholder="Search commands or paste a GitHub URL…"
                className="flex-1 bg-transparent text-base text-bone outline-none placeholder:text-mist"
                aria-label="Command palette search"
              />
              <kbd className="hidden rounded-md border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-mist sm:inline">
                Esc
              </kbd>
            </div>

            <div className="max-h-[60vh] overflow-y-auto py-2">
              {results.length === 0 && (
                <div className="px-5 py-8 text-center text-sm text-fog">
                  No matches. Try a GitHub URL or a feature name.
                </div>
              )}
              {results.map((cmd, index) => {
                const Icon = cmd.icon;
                const active = index === activeIndex;
                return (
                  <button
                    key={cmd.id}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      cmd.run(router);
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={
                      "flex w-full items-center gap-3 px-5 py-3 text-left transition-colors duration-150 " +
                      (active ? "bg-electric/[0.08]" : "")
                    }
                  >
                    <span
                      className={
                        "grid h-8 w-8 place-items-center rounded-lg " +
                        (active
                          ? "bg-electric/15 text-electric"
                          : "bg-white/[0.04] text-fog")
                      }
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="flex-1 text-sm text-bone">{cmd.label}</span>
                    {cmd.hint && (
                      <kbd className="rounded-md border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-mist">
                        {cmd.hint}
                      </kbd>
                    )}
                    {active && (
                      <CornerDownLeft className="h-3.5 w-3.5 text-electric" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.32em] text-mist">
              <span>
                <kbd className="rounded border border-white/10 px-1 py-0.5 text-mist">↑↓</kbd>{" "}
                navigate ·{" "}
                <kbd className="rounded border border-white/10 px-1 py-0.5 text-mist">↵</kbd>{" "}
                select
              </span>
              <span>
                <kbd className="rounded border border-white/10 px-1 py-0.5 text-mist">⌘K</kbd>{" "}
                toggle
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
