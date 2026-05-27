"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Me {
  id: string;
  github_username: string;
  name: string;
  bio?: string;
  custom_slug?: string;
  default_voice: string;
  default_visibility: string;
  custom_watermark?: string;
  email_on_complete: boolean;
  email_on_milestone: boolean;
  webhook_url?: string;
  webhook_secret?: string;
}

export default function SettingsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/me")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setMe)
      .catch(() => setError("Couldn't load settings. Are you signed in?"));
  }, []);

  async function save(patch: Partial<Me>) {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/v1/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `HTTP ${res.status}`);
      }
      setMe(await res.json());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function exportData() {
    const res = await fetch("/api/v1/me/export");
    if (!res.ok) {
      alert("Export failed");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `phantom-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function deleteAccount() {
    const confirmation = prompt(
      "Delete your account? Type DELETE to confirm. Videos remain accessible but anonymized.",
    );
    if (confirmation !== "DELETE") return;
    const res = await fetch("/api/v1/me", { method: "DELETE" });
    if (res.ok) {
      window.location.href = "/";
    } else {
      alert("Delete failed");
    }
  }

  if (error && !me) {
    return (
      <section className="mx-auto max-w-2xl px-6 pb-32 pt-20">
        <p className="text-rose-300">{error}</p>
        <Link href="/login" className="mt-4 inline-block text-electric hover:underline">
          Sign in →
        </Link>
      </section>
    );
  }
  if (!me) return null;

  return (
    <section className="mx-auto max-w-2xl px-6 pb-32 pt-20">
      <header className="flex items-end justify-between">
        <div>
          <div className="kicker">Account</div>
          <h1 className="mt-3 font-display text-4xl font-bold text-bone">Settings</h1>
        </div>
        <Link href="/dashboard" className="text-sm text-fog hover:text-bone">
          ← Dashboard
        </Link>
      </header>

      {saved && (
        <div className="mt-6 rounded-xl border border-emerald-400/40 bg-emerald-400/5 px-4 py-3 text-sm text-emerald-300">
          Saved.
        </div>
      )}
      {error && (
        <div className="mt-6 rounded-xl border border-rose-400/40 bg-rose-400/5 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      {/* Profile */}
      <Section title="Profile">
        <Field label="Display name">
          <input
            defaultValue={me.name}
            className="input"
            onBlur={(e) => save({ name: e.target.value })}
          />
        </Field>
        <Field label="Public slug">
          <div className="flex items-center gap-2">
            <span className="text-fog">phantom.video/u/</span>
            <input
              defaultValue={me.custom_slug || me.github_username}
              className="input"
              onBlur={(e) => save({ custom_slug: e.target.value })}
            />
          </div>
        </Field>
        <Field label="Bio" hint="280 chars max — shown on your public profile.">
          <textarea
            defaultValue={me.bio || ""}
            maxLength={280}
            rows={3}
            className="input"
            onBlur={(e) => save({ bio: e.target.value })}
          />
        </Field>
      </Section>

      {/* Preferences */}
      <Section title="Generation preferences">
        <Field label="Default voice">
          <select
            defaultValue={me.default_voice}
            className="input"
            onChange={(e) => save({ default_voice: e.target.value })}
          >
            <option value="antoni">Antoni · younger male</option>
            <option value="brian">Brian · warm male</option>
            <option value="rachel">Rachel · clear female</option>
            <option value="adam">Adam · authoritative male</option>
          </select>
        </Field>
        <Field label="Default visibility">
          <select
            defaultValue={me.default_visibility}
            className="input"
            onChange={(e) => save({ default_visibility: e.target.value })}
          >
            <option value="public">Public</option>
            <option value="unlisted">Unlisted</option>
            <option value="private">Private</option>
          </select>
        </Field>
        <Field label="Custom watermark" hint="Replaces 'Generated by Phantom' on your videos.">
          <input
            defaultValue={me.custom_watermark || ""}
            maxLength={64}
            className="input"
            onBlur={(e) => save({ custom_watermark: e.target.value })}
          />
        </Field>
      </Section>

      {/* Notifications */}
      <Section title="Notifications">
        <Toggle
          label="Email me when a generation completes"
          checked={me.email_on_complete}
          onChange={(v) => save({ email_on_complete: v })}
        />
        <Toggle
          label="Email me on milestones (first 100 views, etc.)"
          checked={me.email_on_milestone}
          onChange={(v) => save({ email_on_milestone: v })}
        />
      </Section>

      {/* Webhooks */}
      <Section title="Webhooks" subtitle="Receive an HMAC-signed POST when a generation completes.">
        <Field label="Webhook URL">
          <input
            defaultValue={me.webhook_url || ""}
            type="url"
            placeholder="https://your-app.com/webhooks/phantom"
            className="input"
            onBlur={(e) => save({ webhook_url: e.target.value })}
          />
        </Field>
        {me.webhook_secret && (
          <Field label="Signing secret" hint="Verify X-Phantom-Signature using HMAC-SHA256.">
            <code className="block break-all rounded-lg bg-ink px-3 py-2 font-mono text-xs text-bone">
              {me.webhook_secret}
            </code>
          </Field>
        )}
      </Section>

      {/* API keys quick link */}
      <Section title="Account">
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/api-keys" className="link-pill">
            Manage API keys
          </Link>
        </div>
      </Section>

      {/* Danger zone */}
      <Section title="Danger zone">
        <div className="space-y-3">
          <button
            type="button"
            onClick={exportData}
            className="link-pill"
          >
            Download my data
          </button>
          <div>
            <button
              type="button"
              onClick={deleteAccount}
              className="rounded-full border border-rose-400/40 bg-rose-400/10 px-4 py-2 text-sm text-rose-200 transition-colors hover:bg-rose-400/20"
            >
              Delete account
            </button>
            <p className="mt-3 text-xs text-mist">
              Your generated videos remain accessible to anyone with the URL,
              but with no user attribution.
            </p>
          </div>
        </div>
      </Section>

      <style jsx global>{`
        .input {
          width: 100%;
          height: 40px;
          border-radius: 10px;
          background: #0c0c10;
          border: 1px solid rgba(255,255,255,0.1);
          color: #f5f5f0;
          padding: 0 12px;
          font-size: 14px;
        }
        textarea.input { height: auto; padding: 10px 12px; }
        .input:focus { border-color: #00f0ff; outline: none; }
        .link-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          height: 40px;
          padding: 0 18px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.1);
          color: #f5f5f0;
          font-size: 14px;
          transition: border-color 200ms, color 200ms;
        }
        .link-pill:hover { border-color: rgba(0,240,255,0.5); color: #00f0ff; }
      `}</style>
    </section>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12 border-t border-white/10 pt-8">
      <div className="kicker">{title}</div>
      {subtitle && <p className="mt-2 text-sm leading-relaxed text-fog">{subtitle}</p>}
      <div className="mt-6 space-y-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="kicker text-fog">{label}</div>
      <div className="mt-2">{children}</div>
      {hint && <p className="mt-2 text-xs text-mist">{hint}</p>}
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        defaultChecked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 accent-electric"
      />
      <span className="text-sm leading-relaxed text-bone">{label}</span>
    </label>
  );
}
