import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Phantom",
  description: "The agreement between you and Phantom.",
};

export default function TermsPage() {
  return (
    <section className="mx-auto max-w-3xl px-6 pb-32 pt-20 prose-styling">
      <div className="kicker">Legal</div>
      <h1 className="mt-3 font-display text-5xl font-bold text-bone">Terms of Service</h1>
      <p className="mt-4 text-sm text-mist">Last updated: May 23, 2026.</p>

      <div className="mt-12 space-y-10 text-fog">
        <Block title="What Phantom is">
          Phantom turns a public GitHub repository, gist, commit, or PR URL into
          a short narrated video walkthrough using AI. By using Phantom you
          authorize us to clone the public repo you submit, analyze it, and
          generate audio + video derived from its contents and metadata.
        </Block>

        <Block title="What you can submit">
          Phantom is for public, lawful code. Don&apos;t submit URLs to:
          repositories containing material that targets a person or group with
          slurs; instructions or tools whose primary purpose is unauthorized
          intrusion; sexual content involving minors; or content you don&apos;t
          have the right to make public. We run an automated content moderation
          step on every submission and may refuse to generate a video at our
          discretion.
        </Block>

        <Block title="Your account">
          Sign-in is via GitHub OAuth. You&apos;re responsible for what happens
          under your account. Sharing API keys (Pro tier) with third parties is
          allowed — but rate limits and quotas count against your account.
        </Block>

        <Block title="Plans + billing">
          Free, Pro ($19/mo), Team ($49/mo). Quotas reset on the first day of
          each calendar month. We don&apos;t prorate downgrades. Cancellations
          take effect at the end of the current billing period. Stripe is the
          processor; we never store your card details.
        </Block>

        <Block title="Your content">
          Videos generated from your submissions belong to you. By generating a
          video on a public visibility setting, you grant Phantom a worldwide,
          royalty-free license to host and display it on phantom.video and to
          promote it on our showcase, social media, and marketing materials.
          Switching a video to unlisted or private (Pro+) revokes the
          promotional license going forward.
        </Block>

        <Block title="Our intellectual property">
          The Phantom name, the animated explainer format, our diagram
          renderer, and the codebase that runs the site are ours. The narration
          script and on-screen animation produced for your repo are
          AI-generated and licensed to you as described above.
        </Block>

        <Block title="Termination">
          We can suspend or terminate any account that violates these terms,
          attempts to exploit the rate limiter, attempts to scrape the service,
          or that we have a reasonable belief is being used to abuse third
          parties. You can delete your account at any time from
          /dashboard/settings. We anonymize your generated videos rather than
          deleting them, so shared URLs continue to work.
        </Block>

        <Block title="No warranty">
          Phantom is provided &ldquo;as is.&rdquo; AI-generated content may
          contain errors. We don&apos;t guarantee uptime, accuracy of
          narration, or that any specific repo will produce a high-quality
          video. Don&apos;t rely on Phantom output for safety-critical
          decisions.
        </Block>

        <Block title="Liability cap">
          To the maximum extent permitted by law, Phantom&apos;s liability is
          capped at the greater of (a) the amount you paid us in the last 12
          months, or (b) $100 USD.
        </Block>

        <Block title="Changes to these terms">
          We&apos;ll update this page when the terms change and email you when
          changes are material. Continued use after a change means you accept
          the new terms.
        </Block>

        <Block title="Contact">
          Questions? Email <a href="mailto:hello@phantom.video" className="text-electric">hello@phantom.video</a>.
        </Block>
      </div>
    </section>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-2xl font-bold text-bone">{title}</h2>
      <p className="mt-3 leading-relaxed">{children}</p>
    </section>
  );
}
