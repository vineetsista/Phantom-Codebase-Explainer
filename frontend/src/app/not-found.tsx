import Link from "next/link";

export default function NotFound() {
  return (
    <section className="relative mx-auto grid min-h-[80vh] max-w-3xl place-items-center px-6 py-32 text-center">
      <div aria-hidden className="absolute inset-0 -z-10 grid place-items-center">
        <div className="font-display text-[28vw] font-bold leading-none tracking-tighter text-graphite/40">
          404
        </div>
      </div>

      <div className="relative">
        <div className="kicker">404 · ParseError</div>
        <h1 className="mt-6 font-display text-5xl font-bold leading-[0.95] tracking-tighter text-bone sm:text-6xl">
          This route isn't in the codebase.
          <br />
          <span className="accent-electric">Try a different URL.</span>
        </h1>
        <pre className="mx-auto mt-8 inline-block rounded-lg border border-white/[0.06] bg-graphite/60 px-5 py-3 text-left font-mono text-sm text-fog">
          <span className="text-mist">$ </span>
          <span>phantom analyze</span> <span className="text-error">--path /{}</span>
          {"\n"}
          <span className="text-mist">→ </span>
          <span>not found in tree. did you mean </span>
          <span className="accent-electric">/showcase</span>
          <span>?</span>
        </pre>

        <p className="mx-auto mt-8 max-w-md text-lg text-fog">
          Either the link is stale or someone shipped the page into a Phantom video
          and forgot to leave a forwarding address.
        </p>

        <div className="mt-12 flex justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-12 items-center rounded-full bg-electric px-6 text-sm font-semibold text-ink transition-all duration-300 hover:brightness-110"
          >
            Back to phantom.video
          </Link>
          <Link
            href="/showcase"
            className="inline-flex h-12 items-center rounded-full border border-white/10 px-6 text-sm font-medium text-bone transition-colors duration-300 hover:border-electric/40 hover:text-electric"
          >
            See the showcase
          </Link>
        </div>
      </div>
    </section>
  );
}
