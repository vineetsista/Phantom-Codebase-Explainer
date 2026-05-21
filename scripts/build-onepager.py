"""Build marketing/onepager.pdf — a single-page brand-on-brand PDF for
emailing recruiters, investors, and DevRel contacts.

Run:
    pip install reportlab
    python scripts/build-onepager.py

Output:
    marketing/onepager.pdf  (US Letter, dark theme, ~250 KB)
"""
from __future__ import annotations

from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Brand tokens (mirror frontend/tailwind.config.ts)
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
OUTPUT_PATH = ROOT / "marketing" / "onepager.pdf"

PAGE_W, PAGE_H = LETTER  # 612 × 792 pt


def kicker(c: canvas.Canvas, x: float, y: float, text: str, color=ELECTRIC) -> None:
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(color)
    c.drawString(x, y, text.upper())


def body(c: canvas.Canvas, x: float, y: float, text: str, size=10, color=FOG) -> None:
    c.setFont("Helvetica", size)
    c.setFillColor(color)
    c.drawString(x, y, text)


def headline(c: canvas.Canvas, x: float, y: float, text: str, size=36, color=BONE) -> None:
    c.setFont("Helvetica-Bold", size)
    c.setFillColor(color)
    c.drawString(x, y, text)


def build(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(path), pagesize=LETTER)
    c.setTitle("Phantom — one-pager")
    c.setAuthor("Phantom")
    c.setSubject("AI that turns any GitHub repo into a narrated video explainer.")

    # Background
    c.setFillColor(VOID)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    # Accent gradient strip top-right
    c.setFillColor(ELECTRIC)
    c.setFillAlpha(0.06)
    c.rect(PAGE_W - 180, PAGE_H - 180, 180, 180, fill=1, stroke=0)
    c.setFillColor(PLASMA)
    c.setFillAlpha(0.06)
    c.rect(0, 0, 180, 180, fill=1, stroke=0)
    c.setFillAlpha(1.0)

    margin = 56

    # Header
    kicker(c, margin, PAGE_H - margin, "Phantom · RepoX")
    c.setFillColor(BONE)
    c.setFont("Helvetica-Bold", 12)
    c.drawRightString(PAGE_W - margin, PAGE_H - margin, "phantom.video")

    # Hero
    headline_y = PAGE_H - margin - 80
    headline(c, margin, headline_y, "Any codebase.", 48)
    headline_y -= 50
    c.setFillColor(ELECTRIC)
    c.setFont("Helvetica-Bold", 48)
    c.drawString(margin, headline_y, "Explained in minutes.")

    # Tagline
    body(
        c,
        margin,
        headline_y - 36,
        "Drop a GitHub URL. Get a 3-minute video walkthrough — architecture, key files,",
        size=12,
    )
    body(
        c,
        margin,
        headline_y - 52,
        "data flow, narrated by AI. Built for engineers who don't have days to read code.",
        size=12,
    )

    # Divider
    c.setStrokeColor(SMOKE)
    c.setLineWidth(0.5)
    c.line(margin, headline_y - 84, PAGE_W - margin, headline_y - 84)

    # Three-step "how it works"
    step_y = headline_y - 124
    step_w = (PAGE_W - 2 * margin) / 3
    steps = [
        ("01", "Paste", "Drop any GitHub URL. Public or private with token."),
        ("02", "Analyze", "Claude reads the codebase like a senior engineer."),
        ("03", "Watch", "A polished video with narration, diagrams, walkthroughs."),
    ]
    for i, (number, title, desc) in enumerate(steps):
        x = margin + i * step_w
        c.setFillColor(ELECTRIC)
        c.setFont("Helvetica-Bold", 28)
        c.drawString(x, step_y, number)
        c.setFillColor(BONE)
        c.setFont("Helvetica-Bold", 14)
        c.drawString(x, step_y - 24, title)
        c.setFillColor(FOG)
        c.setFont("Helvetica", 9)
        # Wrap manually for the narrow column
        words = desc.split()
        line, lines = "", []
        for w in words:
            if c.stringWidth(line + " " + w, "Helvetica", 9) > step_w - 14:
                lines.append(line.strip())
                line = w
            else:
                line += " " + w
        lines.append(line.strip())
        for j, ln in enumerate(lines):
            c.drawString(x, step_y - 42 - j * 12, ln)

    # Divider
    pricing_y = step_y - 110
    c.setStrokeColor(SMOKE)
    c.line(margin, pricing_y + 16, PAGE_W - margin, pricing_y + 16)

    # Pricing block
    kicker(c, margin, pricing_y - 8, "Pricing")

    tier_y = pricing_y - 40
    tier_w = (PAGE_W - 2 * margin) / 3
    tiers = [
        ("Hobby", "$0", "Free forever", "2 videos / mo, 720p, watermark"),
        ("Pro", "$19", "per month", "Unlimited, 1080p, no watermark, API access"),
        ("Studio", "$49", "per month", "Pro + team workspace + white-label embed"),
    ]
    for i, (name, price, cadence, perks) in enumerate(tiers):
        x = margin + i * tier_w
        # Box
        c.setStrokeColor(SMOKE)
        c.setFillColor(GRAPHITE)
        c.roundRect(x, tier_y - 70, tier_w - 12, 80, 8, fill=1, stroke=1)
        # Name
        c.setFillColor(BONE)
        c.setFont("Helvetica-Bold", 12)
        c.drawString(x + 12, tier_y - 14, name)
        # Price
        c.setFillColor(BONE if name != "Pro" else ELECTRIC)
        c.setFont("Helvetica-Bold", 22)
        c.drawString(x + 12, tier_y - 36, price)
        c.setFillColor(MIST)
        c.setFont("Helvetica", 8)
        c.drawString(x + 60, tier_y - 36, cadence)
        # Perks
        c.setFillColor(FOG)
        c.setFont("Helvetica", 8)
        # wrap perks
        words = perks.split()
        line, lines = "", []
        for w in words:
            if c.stringWidth(line + " " + w, "Helvetica", 8) > tier_w - 24:
                lines.append(line.strip())
                line = w
            else:
                line += " " + w
        lines.append(line.strip())
        for j, ln in enumerate(lines):
            c.drawString(x + 12, tier_y - 54 - j * 10, ln)

    # About strip
    about_y = tier_y - 110
    kicker(c, margin, about_y, "About")
    c.setFillColor(FOG)
    c.setFont("Helvetica", 9)
    c.drawString(
        margin,
        about_y - 16,
        "Phantom is built by Vineet Sista — OSU CS, previously at JPMorgan Chase and VeloQuant.",
    )
    c.drawString(
        margin,
        about_y - 30,
        "RepoX is the first product under the Phantom brand. More coming.",
    )

    # Footer
    footer_y = 48
    c.setStrokeColor(SMOKE)
    c.line(margin, footer_y + 24, PAGE_W - margin, footer_y + 24)
    c.setFillColor(MIST)
    c.setFont("Helvetica", 8)
    c.drawString(margin, footer_y, "hello@phantom.video  ·  phantom.video  ·  @usephantom")
    c.drawRightString(PAGE_W - margin, footer_y, "© 2026 Phantom")

    c.showPage()
    c.save()
    print(f"✓ Wrote {path.relative_to(ROOT)}")


if __name__ == "__main__":
    build(OUTPUT_PATH)
