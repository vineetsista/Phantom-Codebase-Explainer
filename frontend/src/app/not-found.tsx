import Link from "next/link";

export default function NotFound() {
  return (
    <section className="relative mx-auto grid min-h-[80vh] max-w-3xl place-items-center px-6 py-32 text-center">
      <div className="absolute inset-0 -z-10 grid place-items-center">
        <div className="font-display text-[28vw] font-bold leading-none tracking-tighter text-graphite/40">
          404
        </div>
      </div>
      <div>
        <div className="kicker">Page not found</div>
        <h1 className="mt-6 font-display text-5xl font-bold leading-[0.95] tracking-tighter text-bone sm:text-6xl">
          We looked everywhere.
          <br />
          <span className="accent-electric">It's not here.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-md text-lg text-fog">
          Either the URL is wrong or the page got rendered to a video and shipped
          off to someone's Slack. Try going home.
        </p>
        <div className="mt-12 flex justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-12 items-center rounded-full bg-electric px-6 text-sm font-semibold text-ink transition-all duration-300 hover:brightness-110"
          >
            Go home
          </Link>
          <Link
            href="/generate"
            className="inline-flex h-12 items-center rounded-full border border-white/10 px-6 text-sm font-medium text-bone transition-colors duration-300 hover:border-electric/40 hover:text-electric"
          >
            Generate a video
          </Link>
        </div>
      </div>
    </section>
  );
}
