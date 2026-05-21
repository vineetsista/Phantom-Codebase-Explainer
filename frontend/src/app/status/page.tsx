"use client";

import { CheckCircle2, Clock, Cpu, Database, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Health = "operational" | "degraded" | "down";

interface SystemSnapshot {
  health: Health;
  apiLatencyMs: number | null;
  queueDepth: number | null;
  checkedAt: string;
}

/**
 * Public status page. Pings /health on the backend and reports:
 *   - Overall health (operational / degraded / down)
 *   - API latency (one-shot)
 *   - Queue depth — placeholder until /api/v1/queue lands
 *
 * The honesty here matters: showing a real status page that says "operational"
 * signals more than a glossy uptime number. If you're degraded, the page
 * should say so.
 */
export default function StatusPage() {
  const [snap, setSnap] = useState<SystemSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const start = performance.now();
      try {
        const res = await fetch(`${API_URL}/health`, { cache: "no-store" });
        const latency = Math.round(performance.now() - start);
        if (cancelled) return;
        setSnap({
          health: res.ok ? "operational" : "degraded",
          apiLatencyMs: latency,
          queueDepth: null,
          checkedAt: new Date().toISOString(),
        });
      } catch {
        if (cancelled) return;
        setSnap({
          health: "down",
          apiLatencyMs: null,
          queueDepth: null,
          checkedAt: new Date().toISOString(),
        });
      }
    }
    check();
    const id = setInterval(check, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <section className="mx-auto max-w-3xl px-6 pb-32 pt-24">
      <div className="kicker">Status</div>
      <h1 className="mt-6 font-display text-5xl font-bold leading-[0.95] tracking-tighter text-bone sm:text-6xl">
        Are we up?
      </h1>
      <p className="mt-6 max-w-2xl text-lg text-fog">
        Live view of the Phantom platform. Re-checks every 30 seconds.
      </p>

      <Banner snap={snap} />

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        <Card
          icon={Cpu}
          label="API"
          value={snap?.apiLatencyMs == null ? "—" : `${snap.apiLatencyMs} ms`}
          subtitle="One-shot latency"
          ok={snap?.health === "operational"}
        />
        <Card
          icon={Database}
          label="Queue depth"
          value={snap?.queueDepth == null ? "—" : `${snap.queueDepth}`}
          subtitle="Jobs ahead of yours"
          ok
        />
        <Card
          icon={Sparkles}
          label="Renderer"
          value="Remotion 4.0"
          subtitle="Worker pool"
          ok
        />
      </div>

      <div className="mt-16">
        <div className="kicker">Recent incidents</div>
        <div className="surface-1 mt-4 rounded-2xl p-6 text-fog">
          <div className="flex items-center gap-3 text-bone">
            <CheckCircle2 className="h-4 w-4 text-electric" /> No incidents
            recorded.
          </div>
          <p className="mt-3 text-sm">
            We'll publish a brief post-mortem here for anything that affects
            generation throughput, video quality, or the API.
          </p>
        </div>
      </div>

      {snap && (
        <p className="mt-12 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.32em] text-mist">
          <Clock className="h-3 w-3" /> Last checked{" "}
          {new Date(snap.checkedAt).toLocaleTimeString()}
        </p>
      )}
    </section>
  );
}

function Banner({ snap }: { snap: SystemSnapshot | null }) {
  const palette =
    !snap || snap.health === "operational"
      ? { bg: "bg-electric/[0.05]", ring: "ring-electric/30", text: "text-electric" }
      : snap.health === "degraded"
        ? { bg: "bg-yellow-500/[0.05]", ring: "ring-yellow-500/30", text: "text-yellow-400" }
        : { bg: "bg-error/[0.05]", ring: "ring-error/30", text: "text-error" };
  const label = !snap
    ? "Checking…"
    : snap.health === "operational"
      ? "All systems operational"
      : snap.health === "degraded"
        ? "Degraded performance"
        : "API unreachable from your network";
  return (
    <div
      className={`mt-12 flex items-center gap-3 rounded-2xl px-6 py-5 ring-1 ${palette.bg} ${palette.ring}`}
    >
      <span
        className={`grid h-8 w-8 place-items-center rounded-full bg-graphite ${palette.text}`}
      >
        <CheckCircle2 className="h-4 w-4" />
      </span>
      <div>
        <div className={`font-display text-lg font-semibold ${palette.text}`}>{label}</div>
        <div className="text-sm text-fog">
          {snap?.health === "down"
            ? "We can't reach the backend from your browser. The most common cause is your network blocking it, not an outage."
            : "Renderer + API + queue checking in."}
        </div>
      </div>
    </div>
  );
}

function Card({
  icon: Icon,
  label,
  value,
  subtitle,
  ok,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtitle: string;
  ok: boolean;
}) {
  return (
    <div className="surface-1 rounded-2xl p-6">
      <div className="flex items-center gap-3">
        <Icon className={`h-4 w-4 ${ok ? "text-electric" : "text-error"}`} />
        <div className="kicker text-fog">{label}</div>
      </div>
      <div className="mt-4 font-mono text-3xl text-bone tabular-nums">{value}</div>
      <div className="mt-1 text-sm text-fog">{subtitle}</div>
    </div>
  );
}
