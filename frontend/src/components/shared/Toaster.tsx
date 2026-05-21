"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/**
 * Tiny, dependency-free toast system. Replaces silent failures and the
 * occasional `alert()` with brand-accented notifications in the top-right.
 *
 * Usage:
 *   const { toast } = useToast();
 *   toast.success("Copied to clipboard");
 *   toast.error("Could not start generation");
 *   toast.info("Job is still warming up");
 */

type ToastKind = "success" | "error" | "info";

interface ToastRecord {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
  /** ms before auto-dismiss; 0 = sticky */
  duration: number;
}

interface ToastContextValue {
  push: (kind: ToastKind, title: string, description?: string, duration?: number) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToasterProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, title: string, description?: string, duration = 4500) => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, kind, title, description, duration }]);
      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      }
    },
    [],
  );

  const value = useMemo<ToastContextValue>(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-20 z-[300] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <ToastView key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

function ToastView({
  toast,
  onDismiss,
}: {
  toast: ToastRecord;
  onDismiss: () => void;
}) {
  const Icon =
    toast.kind === "success" ? CheckCircle2 : toast.kind === "error" ? AlertCircle : Info;
  const accent =
    toast.kind === "success"
      ? "text-electric"
      : toast.kind === "error"
        ? "text-error"
        : "text-fog";
  const ring =
    toast.kind === "success"
      ? "ring-electric/30"
      : toast.kind === "error"
        ? "ring-error/30"
        : "ring-white/10";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 24, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.98 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={
        "pointer-events-auto flex items-start gap-3 rounded-2xl border border-white/10 bg-graphite/95 p-4 shadow-2xl ring-1 backdrop-blur-xl " +
        ring
      }
      role={toast.kind === "error" ? "alert" : "status"}
      aria-live={toast.kind === "error" ? "assertive" : "polite"}
    >
      <Icon className={"mt-0.5 h-4 w-4 shrink-0 " + accent} />
      <div className="flex-1 leading-snug">
        <div className="text-sm font-medium text-bone">{toast.title}</div>
        {toast.description && (
          <div className="mt-0.5 text-xs text-fog">{toast.description}</div>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="-mt-1 -mr-1 grid h-7 w-7 place-items-center rounded-full text-fog transition-colors duration-200 hover:bg-white/[0.04] hover:text-bone"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  // Provide a no-op stub when outside the provider so calls don't crash
  // (e.g. during a Storybook render or a partial SSR).
  if (!ctx) {
    const noop: ToastContextValue = {
      push: () => undefined,
      dismiss: () => undefined,
    };
    return wrap(noop);
  }
  return wrap(ctx);
}

function wrap(ctx: ToastContextValue) {
  return {
    toast: {
      success: (title: string, description?: string, duration?: number) =>
        ctx.push("success", title, description, duration),
      error: (title: string, description?: string, duration?: number) =>
        ctx.push("error", title, description, duration),
      info: (title: string, description?: string, duration?: number) =>
        ctx.push("info", title, description, duration),
    },
    dismiss: ctx.dismiss,
  };
}

/** Re-mount safety — if a toast is open during page transition, escape-to-dismiss it. */
export function useEscapeDismissAll() {
  const { dismiss } = useToast();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Dismiss all by spamming ids 1..nextId; cheap.
        for (let i = 1; i < nextId; i++) dismiss(i);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismiss]);
}
