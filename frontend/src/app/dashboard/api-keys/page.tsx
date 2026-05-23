"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Key {
  id: string;
  name: string;
  prefix: string;
  last_used_at: string | null;
  created_at: string;
  revoked: boolean;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<Key[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/api-keys");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setKeys(data.keys || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName || "Untitled key" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setCreatedKey(data.key);
      setNewName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this key? Any client using it stops working immediately.")) return;
    const res = await fetch(`/api/v1/api-keys/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  return (
    <section className="mx-auto max-w-3xl px-6 pb-32 pt-20">
      <header className="flex items-end justify-between">
        <div>
          <div className="kicker">Pro feature</div>
          <h1 className="mt-3 font-display text-4xl font-bold text-bone">API keys</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-fog">
            Use these to call <code className="font-mono text-electric">/api/v1/generate</code>{" "}
            programmatically. Each key shows once on creation — store it
            somewhere safe.
          </p>
        </div>
        <Link href="/dashboard" className="text-sm text-fog hover:text-bone">
          ← Dashboard
        </Link>
      </header>

      {/* Create form */}
      <div className="mt-12 rounded-2xl border border-white/10 bg-graphite/40 p-6">
        <label className="kicker">Create new key</label>
        <div className="mt-3 flex gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="my-laptop"
            className="h-10 flex-1 rounded-lg border border-white/10 bg-ink px-3 text-sm text-bone placeholder:text-mist focus:border-electric focus:outline-none"
          />
          <button
            onClick={create}
            disabled={creating}
            className="rounded-full bg-electric px-5 text-sm font-medium text-ink transition-all hover:brightness-110 disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create"}
          </button>
        </div>
        {error && (
          <p className="mt-3 text-xs text-rose-400">{error}</p>
        )}
      </div>

      {/* Just-created key (shown ONCE) */}
      {createdKey && (
        <div className="mt-6 rounded-2xl border border-emerald-400/40 bg-emerald-400/5 p-6">
          <div className="kicker text-emerald-300">Save this — you won't see it again</div>
          <div className="mt-3 flex items-center gap-3">
            <code className="flex-1 break-all rounded-lg bg-ink px-3 py-2 font-mono text-sm text-emerald-200">
              {createdKey}
            </code>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(createdKey)}
              className="rounded-full border border-emerald-400/40 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-400/10"
            >
              Copy
            </button>
          </div>
          <button
            type="button"
            onClick={() => setCreatedKey(null)}
            className="mt-4 text-xs text-mist hover:text-fog"
          >
            I've saved it — dismiss
          </button>
        </div>
      )}

      {/* Keys list */}
      <div className="mt-12">
        <div className="kicker">Your keys</div>
        {loading ? (
          <p className="mt-4 text-fog">Loading…</p>
        ) : keys.length === 0 ? (
          <p className="mt-4 text-fog">No keys yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {keys.map((k) => (
              <li
                key={k.id}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-graphite/30 px-5 py-4"
              >
                <div>
                  <div className="font-medium text-bone">
                    {k.name}
                    {k.revoked && (
                      <span className="ml-2 rounded-full bg-rose-400/10 px-2 py-0.5 font-mono text-[10px] uppercase text-rose-300">
                        Revoked
                      </span>
                    )}
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-mist">
                    {k.prefix}··· · Created{" "}
                    {new Date(k.created_at).toLocaleDateString()} · Last used{" "}
                    {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : "never"}
                  </div>
                </div>
                {!k.revoked && (
                  <button
                    type="button"
                    onClick={() => revoke(k.id)}
                    className="text-sm text-rose-300 hover:text-rose-200"
                  >
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
