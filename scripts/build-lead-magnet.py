"""Build frontend/public/lead-magnets/top-10-codebases.pdf — the lead-magnet
PDF that the exit-intent popup delivers in exchange for an email.

12 pages: cover · intro · 10 deep-dives · closing CTA.

Run:
    pip install reportlab
    python scripts/build-lead-magnet.py

Output:
    frontend/public/lead-magnets/top-10-codebases.pdf  (~12 pages, ~400 KB)
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas

VOID = HexColor("#050507")
INK = HexColor("#0A0A0B")
GRAPHITE = HexColor("#14141A")
SMOKE = HexColor("#1F1F28")
BONE = HexColor("#F5F5F0")
FOG = HexColor("#A8A8B3")
MIST = HexColor("#6B6B78")
ELECTRIC = HexColor("#00F0FF")
PLASMA = HexColor("#7B61FF")

ROOT = Path(__file__).resolve().parent.parent
OUTPUT_PATH = ROOT / "frontend" / "public" / "lead-magnets" / "top-10-codebases.pdf"

PAGE_W, PAGE_H = LETTER


@dataclass
class Repo:
    name: str
    handle: str            # "facebook/react"
    one_liner: str
    why_study: str         # 1-2 sentence why it's worth your time
    architecture: str      # the dominant pattern
    learnings: list[str]   # 3-4 concrete things you'll learn
    entry_point: str       # the file to open first


REPOS: list[Repo] = [
    Repo(
        name="React",
        handle="facebook/react",
        one_liner="The UI library everyone copies the patterns from.",
        why_study=(
            "React's reconciler is one of the cleanest decoupled architectures in "
            "frontend. Reading it teaches you scheduling, double-buffered state, "
            "and the cost of immutability done well."
        ),
        architecture="Fiber tree + reconciler + renderer separation",
        learnings=[
            "Why hooks are stored as a linked list on the fiber",
            "How the work loop yields to the browser between units of work",
            "The contract between reconciler and renderer (react-dom, react-native)",
            "How Suspense leverages throw-based control flow",
        ],
        entry_point="packages/react-reconciler/src/ReactFiberWorkLoop.js",
    ),
    Repo(
        name="PostgreSQL",
        handle="postgres/postgres",
        one_liner="The database that ate the database world.",
        why_study=(
            "Postgres is one of the most thoroughly engineered codebases in "
            "existence. Forty years of careful C, and it's still readable. The "
            "query planner alone is worth a week."
        ),
        architecture="Process-per-connection, shared memory + WAL, extensible types",
        learnings=[
            "How the query planner enumerates and costs plan trees",
            "Why MVCC (multi-version concurrency control) avoids most locks",
            "How extensions can register new types without touching core",
            "The WAL contract that lets replication work",
        ],
        entry_point="src/backend/executor/execMain.c",
    ),
    Repo(
        name="Redis",
        handle="redis/redis",
        one_liner="In-memory data structures at network speed.",
        why_study=(
            "Redis is the cleanest example of 'do one thing well' in systems "
            "code. The event loop is 1,200 lines. Every line earns its place."
        ),
        architecture="Single-threaded event loop + on-disk persistence options",
        learnings=[
            "Why single-threaded is fast (and where it isn't)",
            "How RDB snapshots and AOF logging trade off durability vs. speed",
            "Sorted set implementation: skip list + hash table dual indexing",
            "Cluster mode's gossip protocol and slot remapping",
        ],
        entry_point="src/server.c",
    ),
    Repo(
        name="Vue 3",
        handle="vuejs/core",
        one_liner="The framework where the reactivity is the point.",
        why_study=(
            "Vue 3 was a ground-up rewrite around ES Proxies. Reading it is a "
            "masterclass in reactive systems — useful even if you never write Vue."
        ),
        architecture="Proxy-based reactivity + compiler-emitted hyperscript",
        learnings=[
            "How Proxies enable fine-grained dependency tracking",
            "Why the Composition API is 'just' function composition over refs",
            "Compiler optimizations: static hoisting, patch flags",
            "The reactivity scheduler and effect dedup",
        ],
        entry_point="packages/reactivity/src/reactive.ts",
    ),
    Repo(
        name="Bun",
        handle="oven-sh/bun",
        one_liner="A JS runtime written in Zig that's faster than Node.",
        why_study=(
            "Bun is the most interesting language-runtime project of the last "
            "five years. Reading it teaches you Zig, FFI design, and how to "
            "build Node-compatibility without becoming Node."
        ),
        architecture="JavaScriptCore (not V8) + native HTTP server in Zig",
        learnings=[
            "Why Bun chose JavaScriptCore over V8",
            "How Bun.serve is a Zig HTTP server with a JS surface",
            "Node compatibility as a deliberate, growing surface",
            "The bundler architecture (Esbuild-inspired but native)",
        ],
        entry_point="src/bun.js/javascript.zig",
    ),
    Repo(
        name="FastAPI",
        handle="tiangolo/fastapi",
        one_liner="What Flask should have been if it grew up after type hints.",
        why_study=(
            "FastAPI is a thin layer over Starlette. Reading it shows how much "
            "leverage you get from Pydantic + type hints — the dependency tree "
            "is resolved at request time without metaclass voodoo."
        ),
        architecture="Type-driven routing + dependency injection over Starlette",
        learnings=[
            "How type hints drive validation, docs, and DI",
            "The request lifecycle: dependency tree resolution",
            "Why FastAPI generates OpenAPI 'for free'",
            "Where Starlette's async primitives end and FastAPI begins",
        ],
        entry_point="fastapi/routing.py",
    ),
    Repo(
        name="Tailwind CSS",
        handle="tailwindlabs/tailwindcss",
        one_liner="A class-name system that turned out to be a design system.",
        why_study=(
            "The JIT engine is the second-best PostCSS plugin ever written. "
            "Reading it teaches you AST manipulation, source-driven generation, "
            "and how to build configurable design systems that don't drown."
        ),
        architecture="PostCSS plugin + JIT scan + theme-driven utility generation",
        learnings=[
            "How JIT scans source files and emits only used utilities",
            "Why the theme is the source of truth, not the CSS",
            "The variant system: how `hover:` and `dark:` compose",
            "The new Oxide engine: why rewrite the core in Rust",
        ],
        entry_point="src/lib/setupTrackingContext.js",
    ),
    Repo(
        name="Next.js",
        handle="vercel/next.js",
        one_liner="The framework that ate the meta-framework world.",
        why_study=(
            "Next.js is enormous, but the App Router subsystem is the most "
            "interesting bit of frontend architecture this decade. Read it for "
            "how RSCs actually serialize between server and client."
        ),
        architecture="App Router + RSCs + Turbopack/Webpack",
        learnings=[
            "How RSCs render on the server and hydrate on the client",
            "Why layouts, loading, and error boundaries unify under one tree",
            "Turbopack's incremental compilation model",
            "How edge runtime differs from Node runtime (and why both)",
        ],
        entry_point="packages/next/src/server/app-render/app-render.tsx",
    ),
    Repo(
        name="LangChain",
        handle="langchain-ai/langchain",
        one_liner="The 'glue code' library that became its own glue.",
        why_study=(
            "Whatever you think of LangChain, the LCEL (LangChain Expression "
            "Language) abstraction is genuinely interesting. Reading it shows "
            "you how to compose async streams of typed values cleanly."
        ),
        architecture="Runnable interface + LCEL pipe composition",
        learnings=[
            "Why every primitive is a Runnable",
            "How the pipe operator composes runnables with type safety",
            "Streaming: token-by-token output through the chain",
            "Tool calling: unifying agent and chain APIs",
        ],
        entry_point="libs/core/langchain_core/runnables/base.py",
    ),
    Repo(
        name="Sourcegraph",
        handle="sourcegraph/sourcegraph",
        one_liner="Code search at the scale of all of GitHub.",
        why_study=(
            "Sourcegraph is the only OSS project that's seriously attempted "
            "universal code search. Reading the indexer + query planner is a "
            "masterclass in trade-offs at scale."
        ),
        architecture="Distributed indexer (Zoekt) + GraphQL API + frontend",
        learnings=[
            "How Zoekt indexes billions of lines with sub-second search",
            "The trade-off between exact vs. regex vs. structural search",
            "Why GraphQL fits a code-intelligence API surface",
            "How to expose code intelligence (definitions, references) at scale",
        ],
        entry_point="cmd/frontend/main.go",
    ),
]


def wrap(text: str, width_pt: float, font: str, size: float, c: canvas.Canvas) -> list[str]:
    """Word-wrap to fit a max width in points. Returns lines."""
    words = text.split()
    line, lines = "", []
    for w in words:
        candidate = (line + " " + w).strip()
        if c.stringWidth(candidate, font, size) > width_pt:
            lines.append(line.strip())
            line = w
        else:
            line = candidate
    if line:
        lines.append(line.strip())
    return lines


def fill_background(c: canvas.Canvas) -> None:
    c.setFillColor(VOID)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)


def page_footer(c: canvas.Canvas, page_num: int, total: int) -> None:
    c.setFillColor(MIST)
    c.setFont("Helvetica", 8)
    c.drawString(56, 36, "Phantom · phantom.video")
    c.drawRightString(PAGE_W - 56, 36, f"{page_num} / {total}")


def draw_cover(c: canvas.Canvas) -> None:
    fill_background(c)

    # Accent blobs (simulated with alpha rectangles)
    c.setFillColor(ELECTRIC)
    c.setFillAlpha(0.10)
    c.circle(120, PAGE_H - 100, 180, fill=1, stroke=0)
    c.setFillColor(PLASMA)
    c.setFillAlpha(0.12)
    c.circle(PAGE_W - 100, 120, 200, fill=1, stroke=0)
    c.setFillAlpha(1.0)

    # Kicker
    c.setFillColor(ELECTRIC)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(56, PAGE_H - 80, "PHANTOM · A FIELD GUIDE")

    # Title
    c.setFillColor(BONE)
    c.setFont("Helvetica-Bold", 44)
    c.drawString(56, PAGE_H - 200, "The 10 codebases")
    c.setFillColor(ELECTRIC)
    c.drawString(56, PAGE_H - 250, "every engineer")
    c.setFillColor(BONE)
    c.drawString(56, PAGE_H - 300, "should be able to read.")

    # Subtitle
    c.setFillColor(FOG)
    c.setFont("Helvetica", 14)
    c.drawString(
        56,
        PAGE_H - 340,
        "Why they're worth studying, what you'll learn, and where to start.",
    )

    # Stamp
    c.setStrokeColor(ELECTRIC)
    c.setFillColor(ELECTRIC)
    c.setFillAlpha(0.10)
    c.roundRect(56, 120, 240, 50, 8, fill=1, stroke=1)
    c.setFillAlpha(1.0)
    c.setFillColor(ELECTRIC)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(72, 138, "10 repos · ~25 min read")

    # Footer
    c.setFillColor(MIST)
    c.setFont("Helvetica", 9)
    c.drawString(56, 72, "From the team building Phantom.")
    c.drawString(56, 58, "phantom.video")


def draw_intro(c: canvas.Canvas, page_num: int, total: int) -> None:
    fill_background(c)
    c.setFillColor(ELECTRIC)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(56, PAGE_H - 80, "INTRO")

    c.setFillColor(BONE)
    c.setFont("Helvetica-Bold", 28)
    c.drawString(56, PAGE_H - 130, "Why these ten.")

    paragraphs = [
        "There's no shortage of 'best codebases' lists. Most are about the "
        "popular projects. This is a list about the ones worth reading — the "
        "ones whose internals teach you something general about how systems "
        "are built.",
        "The repos picked here are all open. They're all readable in a "
        "weekend (or, in Postgres's case, a month of weekends — but the first "
        "week pays for itself). And each one demonstrates a pattern that "
        "shows up everywhere once you've seen it.",
        "For each repo, you'll get: why it's worth your time, the dominant "
        "architectural pattern, three or four concrete things you'll learn, "
        "and the single file to open first.",
        "If you want any of these as a 3-minute video walkthrough, generate "
        "one at phantom.video. The free tier gets you the first video.",
    ]

    y = PAGE_H - 180
    for para in paragraphs:
        lines = wrap(para, PAGE_W - 112, "Helvetica", 11, c)
        c.setFillColor(FOG)
        c.setFont("Helvetica", 11)
        for ln in lines:
            c.drawString(56, y, ln)
            y -= 16
        y -= 8

    page_footer(c, page_num, total)


def draw_repo_page(c: canvas.Canvas, repo: Repo, page_num: int, total: int, index: int) -> None:
    fill_background(c)

    # Page number badge top-right
    c.setStrokeColor(ELECTRIC)
    c.setFillColor(ELECTRIC)
    c.setFillAlpha(0.10)
    c.roundRect(PAGE_W - 110, PAGE_H - 100, 56, 26, 6, fill=1, stroke=1)
    c.setFillAlpha(1.0)
    c.setFillColor(ELECTRIC)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(PAGE_W - 98, PAGE_H - 92, f"{index:02d} / 10")

    # Repo handle (small mono-style top-left)
    c.setFillColor(MIST)
    c.setFont("Helvetica", 9)
    c.drawString(56, PAGE_H - 90, repo.handle)

    # Name
    c.setFillColor(BONE)
    c.setFont("Helvetica-Bold", 38)
    c.drawString(56, PAGE_H - 140, repo.name)

    # One-liner
    c.setFillColor(ELECTRIC)
    c.setFont("Helvetica-Oblique", 13)
    for i, ln in enumerate(wrap(repo.one_liner, PAGE_W - 112, "Helvetica-Oblique", 13, c)):
        c.drawString(56, PAGE_H - 170 - i * 18, ln)

    y = PAGE_H - 230

    # Why study
    c.setFillColor(ELECTRIC)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(56, y, "WHY IT'S WORTH YOUR TIME")
    y -= 18
    c.setFillColor(FOG)
    c.setFont("Helvetica", 11)
    for ln in wrap(repo.why_study, PAGE_W - 112, "Helvetica", 11, c):
        c.drawString(56, y, ln)
        y -= 15

    y -= 18

    # Architecture
    c.setFillColor(ELECTRIC)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(56, y, "DOMINANT PATTERN")
    y -= 18
    c.setFillColor(BONE)
    c.setFont("Helvetica-Bold", 12)
    for ln in wrap(repo.architecture, PAGE_W - 112, "Helvetica-Bold", 12, c):
        c.drawString(56, y, ln)
        y -= 16

    y -= 20

    # Learnings
    c.setFillColor(ELECTRIC)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(56, y, "WHAT YOU'LL LEARN")
    y -= 18
    for learning in repo.learnings:
        c.setFillColor(ELECTRIC)
        c.setFont("Helvetica-Bold", 12)
        c.drawString(56, y, "·")
        c.setFillColor(FOG)
        c.setFont("Helvetica", 11)
        lines = wrap(learning, PAGE_W - 130, "Helvetica", 11, c)
        for i, ln in enumerate(lines):
            c.drawString(72, y, ln)
            y -= 15
        y -= 4

    # Entry point card
    card_y = 100
    c.setStrokeColor(SMOKE)
    c.setFillColor(GRAPHITE)
    c.roundRect(56, card_y, PAGE_W - 112, 56, 8, fill=1, stroke=1)
    c.setFillColor(ELECTRIC)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(72, card_y + 36, "START HERE")
    c.setFillColor(BONE)
    c.setFont("Courier-Bold", 11)
    # Truncate if too long
    ep_max = PAGE_W - 144
    ep = repo.entry_point
    while c.stringWidth(ep, "Courier-Bold", 11) > ep_max and len(ep) > 20:
        ep = "…" + ep[2:]
    c.drawString(72, card_y + 16, ep)

    page_footer(c, page_num, total)


def draw_closing(c: canvas.Canvas, page_num: int, total: int) -> None:
    fill_background(c)

    # Accent blob
    c.setFillColor(PLASMA)
    c.setFillAlpha(0.10)
    c.circle(PAGE_W / 2, PAGE_H / 2, 280, fill=1, stroke=0)
    c.setFillAlpha(1.0)

    c.setFillColor(ELECTRIC)
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(PAGE_W / 2, PAGE_H - 200, "ONE MORE THING")

    c.setFillColor(BONE)
    c.setFont("Helvetica-Bold", 36)
    c.drawCentredString(PAGE_W / 2, PAGE_H - 260, "Want a video of any of these?")

    c.setFillColor(FOG)
    c.setFont("Helvetica", 13)
    for i, ln in enumerate(
        [
            "Generate a 3-minute narrated walkthrough of any repo on this list",
            "(or your own codebase) at phantom.video. First one's free.",
        ]
    ):
        c.drawCentredString(PAGE_W / 2, PAGE_H - 300 - i * 18, ln)

    # CTA pill
    cta_w, cta_h = 260, 50
    cta_x = (PAGE_W - cta_w) / 2
    cta_y = PAGE_H / 2 - 70
    c.setFillColor(ELECTRIC)
    c.roundRect(cta_x, cta_y, cta_w, cta_h, 25, fill=1, stroke=0)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(PAGE_W / 2, cta_y + 18, "phantom.video →")

    c.setFillColor(MIST)
    c.setFont("Helvetica", 9)
    c.drawCentredString(PAGE_W / 2, cta_y - 30, "No signup required for your first video.")

    page_footer(c, page_num, total)


def build(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(path), pagesize=LETTER)
    c.setTitle("The 10 codebases every engineer should be able to read")
    c.setAuthor("Phantom")
    c.setSubject("Field guide to 10 worth-reading open source codebases")
    c.setKeywords("codebase, open source, react, postgres, redis, vue, bun, fastapi, tailwind, nextjs, langchain, sourcegraph")

    total_pages = 1 + 1 + len(REPOS) + 1  # cover + intro + 10 + closing

    draw_cover(c)
    c.showPage()

    draw_intro(c, page_num=2, total=total_pages)
    c.showPage()

    for i, repo in enumerate(REPOS):
        draw_repo_page(c, repo, page_num=3 + i, total=total_pages, index=i + 1)
        c.showPage()

    draw_closing(c, page_num=total_pages, total=total_pages)
    c.showPage()

    c.save()
    print(f"✓ Wrote {path.relative_to(ROOT)} ({total_pages} pages)")


if __name__ == "__main__":
    build(OUTPUT_PATH)
