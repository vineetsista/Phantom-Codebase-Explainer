/**
 * The pre-rendered showcase gallery — popular open source projects we've
 * generated explainers for. These are static metadata; the actual MP4s are
 * expected to live at /public/showcase/{slug}.mp4 and posters at
 * /public/showcase/{slug}-poster.jpg.
 *
 * To populate them, run the pipeline against each repo and copy the resulting
 * files into /frontend/public/showcase/. The page handles missing assets
 * gracefully (shows the gradient placeholder).
 */

export interface ShowcaseRepo {
  slug: string;
  repo: string;        // "owner/name"
  url: string;
  title: string;
  description: string;
  language: string;
  stars: number;
  takeaways: string[];
  durationLabel: string;
}

export const SHOWCASE_REPOS: ShowcaseRepo[] = [
  {
    slug: "react",
    repo: "facebook/react",
    url: "https://github.com/facebook/react",
    title: "React.js codebase explained",
    description: "How React's reconciler, fibers, and hooks fit together.",
    language: "JavaScript",
    stars: 228000,
    takeaways: [
      "Fiber is a unit of work, not a fiber in the OS sense",
      "Hooks are stored as a linked list on the fiber",
      "Reconciler and renderer are decoupled by design",
    ],
    durationLabel: "3:14",
  },
  {
    slug: "vue",
    repo: "vuejs/core",
    url: "https://github.com/vuejs/core",
    title: "Vue 3 codebase explained",
    description: "Composition API, reactivity proxies, and the compiler.",
    language: "TypeScript",
    stars: 47000,
    takeaways: [
      "Reactivity is built on ES Proxies",
      "Compiler emits hyperscript at build time",
      "Composition API is just function composition over reactive refs",
    ],
    durationLabel: "2:58",
  },
  {
    slug: "fastapi",
    repo: "tiangolo/fastapi",
    url: "https://github.com/tiangolo/fastapi",
    title: "FastAPI codebase explained",
    description: "How Starlette + Pydantic become a typed HTTP framework.",
    language: "Python",
    stars: 79000,
    takeaways: [
      "FastAPI is a thin layer over Starlette",
      "Type hints drive validation, docs, and dependency injection",
      "The dependency tree is resolved at request time",
    ],
    durationLabel: "2:42",
  },
  {
    slug: "next-js",
    repo: "vercel/next.js",
    url: "https://github.com/vercel/next.js",
    title: "Next.js codebase explained",
    description: "The App Router, RSCs, and the framework's build pipeline.",
    language: "TypeScript",
    stars: 126000,
    takeaways: [
      "App Router unifies layouts, loading, and error boundaries",
      "RSCs render on the server, hydrate on the client",
      "Turbopack replaces Webpack for dev builds",
    ],
    durationLabel: "4:01",
  },
  {
    slug: "tailwindcss",
    repo: "tailwindlabs/tailwindcss",
    url: "https://github.com/tailwindlabs/tailwindcss",
    title: "Tailwind CSS codebase explained",
    description: "The JIT engine and the design-token-to-CSS pipeline.",
    language: "TypeScript",
    stars: 82000,
    takeaways: [
      "JIT scans your source, generates only the utilities you use",
      "Theme is the source of truth; variants compose utility classes",
      "The Oxide engine rewrites the core in Rust",
    ],
    durationLabel: "2:36",
  },
  {
    slug: "langchain",
    repo: "langchain-ai/langchain",
    url: "https://github.com/langchain-ai/langchain",
    title: "LangChain codebase explained",
    description: "Runnables, chains, and the LCEL execution model.",
    language: "Python",
    stars: 94000,
    takeaways: [
      "Everything is a Runnable",
      "LCEL composes runnables with the | operator",
      "Tool calling unifies agent and chain APIs",
    ],
    durationLabel: "3:48",
  },
  {
    slug: "supabase",
    repo: "supabase/supabase",
    url: "https://github.com/supabase/supabase",
    title: "Supabase codebase explained",
    description: "Postgres-first BaaS — auth, storage, edge functions.",
    language: "TypeScript",
    stars: 73000,
    takeaways: [
      "Built on real Postgres — no proprietary query language",
      "Row-Level Security is the auth boundary",
      "Realtime is logical replication over WebSockets",
    ],
    durationLabel: "3:22",
  },
  {
    slug: "bun",
    repo: "oven-sh/bun",
    url: "https://github.com/oven-sh/bun",
    title: "Bun codebase explained",
    description: "Zig + JavaScriptCore — why Bun is fast.",
    language: "Zig",
    stars: 73000,
    takeaways: [
      "JavaScriptCore (not V8) under the hood",
      "Bun.serve is a Zig-native HTTP server",
      "Node compatibility is a deliberate, growing surface",
    ],
    durationLabel: "3:05",
  },
];

export function findShowcase(slug: string): ShowcaseRepo | undefined {
  return SHOWCASE_REPOS.find((r) => r.slug === slug);
}
