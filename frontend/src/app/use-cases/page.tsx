import type { Metadata } from "next";
import Link from "next/link";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://phantom.video";

export const metadata: Metadata = {
  title: "Use cases — who Phantom is for",
  description:
    "Onboarding new engineers, evaluating open-source tools, prepping for code reviews and interviews, DevRel content, and engineering management. Phantom in real workflows.",
  alternates: { canonical: `${BASE_URL}/use-cases` },
};

interface UseCase {
  id: string;
  title: string;
  scenario: string;
  problem: string;
  how: string;
  workflow: string[];
}

const USE_CASES: UseCase[] = [
  {
    id: "onboarding",
    title: "Onboarding new engineers",
    scenario:
      "A senior dev joins your team Monday. Their first week is supposed to be impact-light and learning-heavy — but the README hasn't been updated since 2022 and the codebase has been refactored twice.",
    problem:
      "Every veteran on the team gets pulled into \"how does X work\" pings for a week. Real work stalls. The new hire's first real PR doesn't land until week three.",
    how: "Generate a Phantom walkthrough for the repo, the staging-only services, and the two adjacent libraries your platform team owns. Share the links on day zero. The new hire watches them before their first standup and shows up Tuesday already mapping where things live.",
    workflow: [
      "Generate explainers for your top 3-5 repos",
      "Drop the links in your onboarding doc / Notion",
      "Update once a quarter or when architecture meaningfully changes",
    ],
  },
  {
    id: "open-source-eval",
    title: "Evaluating open-source tools",
    scenario:
      "You're picking between three OSS libraries that solve the same problem. README comparisons miss what actually matters — how the code is structured, where the seams are, and whether the maintainer's instincts match yours.",
    problem:
      "Reading three codebases cold takes a day each. You'll skim and ship the one with the prettiest docs.",
    how: "Generate a Phantom for each candidate. Watch them back-to-back. The architecture scene tells you which one took the abstraction seriously. The code walkthrough tells you whether the author over- or under-engineered. Sometimes the third candidate — the underrated one — turns out to be the right call.",
    workflow: [
      "Paste each repo URL into Phantom",
      "Watch the 2-5 minute explainer for each",
      "Pick on shape, not on stars",
    ],
  },
  {
    id: "code-review",
    title: "Code review prep",
    scenario:
      "You're reviewing a 1200-line PR in a part of the codebase you haven't touched in months. The diff is hard to read because the context isn't in your head.",
    problem:
      "You either rubber-stamp it (bad) or spend an hour walking the surrounding code first (slow).",
    how: "Generate a Phantom for the affected module before opening the diff. Five minutes in, you have the mental model. Now the diff reads as targeted changes to a system you understand — not as a wall of unfamiliar code.",
    workflow: [
      "Identify the module(s) the PR touches",
      "Generate or refresh the Phantom for them",
      "Watch, then open the PR with context loaded",
    ],
  },
  {
    id: "interviews",
    title: "Technical interviews",
    scenario:
      "You're interviewing at a company whose codebase is public. The on-site has a 'walk us through your understanding of our system' round.",
    problem:
      "You can read the README. You can't read 40,000 lines of code in an evening.",
    how: "Generate a Phantom the night before. Take notes on the architecture diagram. Walk in able to name three design decisions, two trade-offs you'd push back on, and one thing you'd steal.",
    workflow: [
      "Find the public repo (or product OSS) the night before",
      "Generate, watch, take notes",
      "Show up with opinions",
    ],
  },
  {
    id: "devrel",
    title: "DevRel content",
    scenario:
      "You ship a new feature, integration, or library. The launch blog post lives. The Twitter thread peaks at 12k impressions. Nobody actually understands what shipped.",
    problem:
      "Written launch content under-represents engineering depth. Video does it justice but takes a week to produce.",
    how: "Generate a Phantom of the new integration's source, embed it in the announcement post, share the iframe in the launch thread. People who would never read the code now watch the video.",
    workflow: [
      "Generate after the merge",
      "Drop the iframe into your announcement",
      "Track the embed views as a quality signal",
    ],
  },
  {
    id: "eng-mgmt",
    title: "Engineering management",
    scenario:
      "You manage three sub-teams that share infrastructure. Your sub-teams understand their own code; they don't understand each other's.",
    problem:
      "Every cross-team integration starts with a kickoff meeting where someone whiteboards their service. The whiteboard fades. New hires re-ask the same questions.",
    how: "Generate Phantoms for every service your team owns. Embed them in the service's README. Now 'how does payments-svc work' has a 4-minute answer that's the same every time, available at 3 AM during an incident.",
    workflow: [
      "Audit your service inventory",
      "Generate for each, embed in the README",
      "Refresh when ownership or architecture changes",
    ],
  },
];

export default function UseCasesPage() {
  return (
    <section className="mx-auto max-w-5xl px-6 pb-32 pt-24">
      <div className="kicker">Use cases</div>
      <h1 className="mt-6 max-w-3xl font-display text-5xl font-bold leading-[0.95] tracking-tighter text-bone sm:text-6xl">
        Six places Phantom earns its keep.
      </h1>
      <p className="mt-6 max-w-2xl text-lg text-fog">
        Phantom is for engineers who need to load a codebase into their head
        without spending a week doing it. Here's how that plays out in real
        workflows.
      </p>

      <div className="mt-16 grid gap-6 lg:grid-cols-2">
        {USE_CASES.map((useCase) => (
          <article
            key={useCase.id}
            className="surface-1 group flex flex-col rounded-3xl p-8 transition-colors duration-300 ease-luxe hover:border-electric/20"
          >
            <div className="kicker text-electric">{useCase.title.split(" ")[0]}</div>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-bone">
              {useCase.title}
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-fog">
              <span className="block font-medium uppercase tracking-[0.32em] text-mist">
                Scenario
              </span>
              {useCase.scenario}
            </p>
            <p className="mt-4 text-sm leading-relaxed text-fog">
              <span className="block font-medium uppercase tracking-[0.32em] text-mist">
                Problem
              </span>
              {useCase.problem}
            </p>
            <p className="mt-4 text-sm leading-relaxed text-bone">
              <span className="block font-medium uppercase tracking-[0.32em] text-mist">
                How Phantom helps
              </span>
              {useCase.how}
            </p>
            <ol className="mt-6 space-y-2 border-t border-white/[0.06] pt-5 text-sm text-fog">
              {useCase.workflow.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="font-mono text-mist">0{index + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </article>
        ))}
      </div>

      <div className="mt-20 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-display text-2xl font-bold tracking-tight text-bone">
          Ready to try one for your repo?
        </h3>
        <Link
          href="/generate"
          className="inline-flex h-12 items-center gap-2 rounded-full bg-electric px-6 text-sm font-semibold text-ink transition-all duration-300 hover:brightness-110"
        >
          Generate now →
        </Link>
      </div>
    </section>
  );
}
