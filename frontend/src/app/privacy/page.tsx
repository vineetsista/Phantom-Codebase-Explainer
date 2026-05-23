import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://phantom.video";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Phantom handles repository data and personal information.",
  alternates: { canonical: `${BASE_URL}/privacy` },
};

const LAST_UPDATED = "2026-05-23";

export default function PrivacyPage() {
  return (
    <section className="mx-auto max-w-3xl px-6 pb-32 pt-24">
      <div className="kicker">Privacy</div>
      <h1 className="mt-6 font-display text-5xl font-bold leading-[0.95] tracking-tighter text-bone sm:text-6xl">
        What we keep, what we delete.
      </h1>
      <p className="mt-4 font-mono text-xs uppercase tracking-[0.32em] text-mist">
        Last updated · {LAST_UPDATED}
      </p>

      <div className="mt-16 space-y-12 text-base leading-relaxed text-fog">
        <Block heading="Repository data">
          <p>
            When you submit a public GitHub URL, Phantom shallow-clones the repo
            into ephemeral storage on the worker. The clone is deleted the
            moment the video finishes rendering. We never push the contents of
            your repo anywhere outside the rendering pipeline.
          </p>
          <p>
            We retain a structured analysis (file counts, languages, module
            roles, top-file paths) and the generated script + audio + video
            files. We do <span className="text-bone">not</span> retain raw
            source code excerpts beyond what appears inside the rendered video.
          </p>
        </Block>

        <Block heading="Private repositories">
          <p>
            Private repo support is in beta. When it ships, your GitHub
            personal access token is encrypted at rest, scoped to read-only,
            and used once per generation. Tokens are never logged. We will
            update this section the day the feature goes live.
          </p>
        </Block>

        <Block heading="What we collect about you">
          <p>
            Standard server logs (IP, user agent, request paths) for up to 30
            days. No third-party advertising trackers. No cross-site cookies.
            If you reach out via{" "}
            <a
              href="mailto:hello@phantom.video"
              className="text-bone underline decoration-electric/40 underline-offset-4 hover:text-electric"
            >
              hello@phantom.video
            </a>
            , we keep the email thread for support.
          </p>
          <p>
            For signed-in users we additionally store: your GitHub user id,
            username, display name, email (from your GitHub profile), and a
            monthly usage counter. We use PostHog for product analytics
            (EU-region storage if you&apos;re in the EEA) and Sentry for error
            tracking. Both honor the Do Not Track header.
          </p>
          <p>
            For anonymous share dedup we record a SHA-256 hash of (IP + a
            daily rotating salt). We do not store raw IPs.
          </p>
        </Block>

        <Block heading="Your rights">
          <p>
            You can export all your data as JSON from{" "}
            <span className="text-bone">/dashboard/settings → Download my data</span>,
            and delete your account from the same page. Deletion cascades to
            favorites, comments, reactions, collections, and API keys.
            Generated videos are anonymized (user attribution removed) rather
            than deleted, so existing shared URLs continue to resolve.
          </p>
        </Block>

        <Block heading="Where data lives">
          <p>
            Vercel (frontend), Railway (API + worker), Supabase (Postgres
            metadata), Upstash (Redis queue), Cloudflare R2 (video + thumbnail
            storage). Each provider has its own privacy terms.
          </p>
        </Block>

        <Block heading="Deletion">
          <p>
            Email{" "}
            <a
              href="mailto:hello@phantom.video"
              className="text-bone underline decoration-electric/40 underline-offset-4 hover:text-electric"
            >
              hello@phantom.video
            </a>{" "}
            with the job ID or repo URL and we'll delete the artifacts within
            72 hours.
          </p>
        </Block>

        <Block heading="Changes">
          <p>
            We'll update this page if anything material changes, and note the
            date at the top.
          </p>
        </Block>
      </div>
    </section>
  );
}

function Block({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="font-display text-2xl font-bold tracking-tight text-bone">
        {heading}
      </h2>
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}
