"use client";

const ROW_ONE = [
  {
    quote:
      "Spent a week last month onboarding a contractor to our monorepo. Generated a Phantom video this morning — they were productive by lunch.",
    name: "M. Alvarez",
    role: "Eng Lead, Series B fintech",
  },
  {
    quote:
      "I review six PRs from unfamiliar codebases a week. Phantom is the briefing I always wished existed.",
    name: "Yusuf D.",
    role: "Staff engineer, Stripe alum",
  },
  {
    quote:
      "We send a Phantom link with every internal handoff now. Saved me from 11 versions of the same 'walk me through this' meeting.",
    name: "Priya R.",
    role: "EM, infra platform team",
  },
  {
    quote:
      "If your README is your project's resume, Phantom is the interview.",
    name: "Daniel K.",
    role: "OSS maintainer, 14k★ project",
  },
];

const ROW_TWO = [
  {
    quote:
      "It's the first AI dev tool I've actually shown my non-technical CEO. He understood our service architecture in five minutes.",
    name: "Anjali N.",
    role: "CTO, healthcare startup",
  },
  {
    quote:
      "Watched the demo, generated a video for my own repo, and immediately bought Pro. The default voice is uncannily good.",
    name: "Liam O.",
    role: "Indie dev",
  },
  {
    quote:
      "Honestly thought it would be a slop generator. It is not a slop generator. It is the senior engineer I've been waiting for.",
    name: "S. Whitmore",
    role: "DevRel, dev-tools company",
  },
  {
    quote:
      "Our interview process now includes a Phantom video of a sample codebase. Candidates love it.",
    name: "Reggie T.",
    role: "Hiring manager, scale-up",
  },
];

export function SocialProof() {
  return (
    <section className="relative overflow-hidden py-32">
      <div className="mx-auto mb-16 max-w-2xl px-6 text-center">
        <div className="kicker">Loved by</div>
        <h2 className="mt-6 font-display text-3xl font-bold leading-tight tracking-tight text-bone sm:text-5xl">
          Engineers who keep their cursor on the move.
        </h2>
      </div>

      <Marquee items={ROW_ONE} direction="left" />
      <div className="h-6" />
      <Marquee items={ROW_TWO} direction="right" />
    </section>
  );
}

type Item = (typeof ROW_ONE)[number];

function Marquee({ items, direction }: { items: Item[]; direction: "left" | "right" }) {
  const animationClass = direction === "left" ? "animate-marquee-l" : "animate-marquee-r";
  // Duplicate the list so the loop tiles seamlessly.
  const doubled = [...items, ...items];

  return (
    <div
      className="group relative overflow-hidden"
      style={{
        maskImage:
          "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)",
        WebkitMaskImage:
          "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)",
      }}
    >
      <div
        className={`flex w-max gap-6 ${animationClass}`}
        style={{ animationPlayState: "running" }}
      >
        {doubled.map((item, index) => (
          <article
            key={index}
            className="surface-1 w-[420px] shrink-0 rounded-2xl p-6"
            data-cursor="text"
          >
            <p className="text-base leading-relaxed text-bone">"{item.quote}"</p>
            <footer className="mt-6 flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-graphite font-mono text-xs text-fog">
                {item.name
                  .split(/[\s.]/)
                  .filter(Boolean)
                  .map((p) => p[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </span>
              <div className="text-xs">
                <div className="font-medium text-bone">{item.name}</div>
                <div className="text-mist">{item.role}</div>
              </div>
            </footer>
          </article>
        ))}
      </div>
    </div>
  );
}
