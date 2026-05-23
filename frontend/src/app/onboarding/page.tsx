"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface GHRepo {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  language: string | null;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<"welcome" | "pick" | "queueing">("welcome");
  const [repos, setRepos] = useState<GHRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadRepos() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/me/github-repos");
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login?next=/onboarding");
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setRepos(data.repos || []);
      setStep("pick");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load repos.");
    } finally {
      setLoading(false);
    }
  }

  async function generate(repoUrl: string) {
    setStep("queueing");
    try {
      const res = await fetch("/api/v1/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_url: repoUrl, options: {} }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
      router.push(`/v/${data.job_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't queue the video.");
      setStep("pick");
    }
  }

  return (
    <section className="mx-auto max-w-2xl px-6 pb-32 pt-20">
      {step === "welcome" && (
        <>
          <div className="kicker">Welcome</div>
          <h1 className="mt-3 font-display text-5xl font-bold text-bone">
            Let&rsquo;s explain your first codebase.
          </h1>
          <p className="mt-5 max-w-lg text-lg text-fog">
            Pick one of your GitHub repos and we&rsquo;ll generate a narrated
            walkthrough — usually under three minutes long. You get three free
            videos every month.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={loadRepos}
              disabled={loading}
              className="rounded-full bg-electric px-6 py-3 font-mono text-sm text-ink transition-colors hover:bg-electric/80 disabled:opacity-50"
            >
              {loading ? "Loading your repos…" : "Pick from my repos →"}
            </button>
            <Link
              href="/dashboard"
              className="rounded-full border border-white/10 px-6 py-3 text-sm text-fog transition-colors hover:border-electric/40 hover:text-bone"
            >
              Skip for now
            </Link>
          </div>
          {error && (
            <p className="mt-6 text-sm text-rose-300">{error}</p>
          )}
        </>
      )}

      {step === "pick" && (
        <>
          <div className="kicker">Your repos</div>
          <h1 className="mt-3 font-display text-4xl font-bold text-bone">
            Which one first?
          </h1>
          <p className="mt-3 text-fog">
            Pick the repo you&rsquo;d most want to share with someone new to it.
          </p>
          {repos.length === 0 ? (
            <p className="mt-8 text-mist">
              No public repos on your account.{" "}
              <Link href="/" className="text-electric hover:underline">
                Paste any GitHub URL on the home page →
              </Link>
            </p>
          ) : (
            <ul className="mt-8 space-y-2">
              {repos.map((r) => (
                <li key={r.full_name}>
                  <button
                    type="button"
                    onClick={() => generate(r.html_url)}
                    className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-graphite/60 px-5 py-4 text-left transition hover:border-electric/40"
                  >
                    <div>
                      <div className="font-display text-lg font-bold text-bone">
                        {r.name}
                      </div>
                      {r.description && (
                        <p className="mt-1 line-clamp-1 text-sm text-fog">
                          {r.description}
                        </p>
                      )}
                    </div>
                    <div className="ml-4 shrink-0 text-right">
                      <div className="font-mono text-xs text-mist">
                        ★ {r.stargazers_count}
                      </div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-mist">
                        {r.language || "—"}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {step === "queueing" && (
        <div className="mt-20 text-center">
          <div className="kicker">Queuing</div>
          <h1 className="mt-3 font-display text-3xl font-bold text-bone">
            Hang tight — your first video is generating.
          </h1>
          <p className="mt-3 text-fog">
            Usually takes 1–2 minutes. You&rsquo;ll be redirected as soon as
            it&rsquo;s ready.
          </p>
        </div>
      )}
    </section>
  );
}
