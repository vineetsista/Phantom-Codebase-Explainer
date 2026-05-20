import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

/**
 * Dynamic Open Graph image. 1200x630, optimized for Twitter / LinkedIn / Slack
 * link previews. Query params:
 *   title    — main headline (default: "Any codebase. Explained in minutes.")
 *   owner    — repo owner
 *   name     — repo name
 *   language — primary language label (rendered as a pill)
 *   stars    — github star count (rendered as a pill if > 0)
 *
 * Usage in metadata: `images: ["/api/og?owner=vercel&name=next.js&language=TypeScript&stars=120000"]`
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const owner = params.get("owner") || "";
  const name = params.get("name") || "";
  const title =
    params.get("title") ||
    (owner && name ? `${owner}/${name}` : "Any codebase. Explained in minutes.");
  const language = params.get("language") || "";
  const stars = params.get("stars");

  const subtitle = owner && name
    ? "AI-generated walkthrough — architecture, key files, design decisions."
    : "Drop a GitHub URL. Get a cinematic AI-generated video walkthrough.";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background:
            "linear-gradient(135deg, #050507 0%, #0A0A0B 50%, #14141A 100%)",
          padding: 72,
          position: "relative",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        {/* Atmosphere blobs */}
        <div
          style={{
            position: "absolute",
            top: -150,
            left: -150,
            width: 600,
            height: 600,
            background:
              "radial-gradient(circle, rgba(0,240,255,0.30), transparent 60%)",
            filter: "blur(40px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -150,
            right: -150,
            width: 600,
            height: 600,
            background:
              "radial-gradient(circle, rgba(123,97,255,0.30), transparent 60%)",
            filter: "blur(40px)",
          }}
        />

        {/* Top kicker */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 18,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: "#00F0FF",
            fontWeight: 700,
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              background: "#00F0FF",
              boxShadow: "0 0 18px #00F0FF",
            }}
          />
          PHANTOM · REPOX
        </div>

        {/* Body */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            marginTop: 32,
          }}
        >
          <div
            style={{
              fontSize: 96,
              fontWeight: 800,
              color: "#F5F5F0",
              lineHeight: 1,
              letterSpacing: -4,
              maxWidth: 1000,
            }}
          >
            {title}
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 28,
              color: "#A8A8B3",
              maxWidth: 900,
              lineHeight: 1.35,
            }}
          >
            {subtitle}
          </div>

          {(language || stars) && (
            <div style={{ display: "flex", gap: 12, marginTop: 36 }}>
              {language && <Pill label={language} color="#00F0FF" />}
              {stars && Number(stars) > 0 && (
                <Pill
                  label={`★ ${Number(stars).toLocaleString()}`}
                  color="#7B61FF"
                />
              )}
            </div>
          )}
        </div>

        {/* Bottom row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 22,
            color: "#A8A8B3",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background:
                  "linear-gradient(135deg, #00F0FF, #7B61FF)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                fontWeight: 900,
                color: "#050507",
              }}
            >
              P
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ color: "#F5F5F0", fontSize: 24, fontWeight: 700 }}>
                Phantom
              </span>
              <span style={{ fontSize: 16, color: "#6B6B78" }}>phantom.video</span>
            </div>
          </div>
          <div
            style={{
              padding: "12px 22px",
              borderRadius: 999,
              background: "rgba(0,240,255,0.15)",
              border: "1px solid rgba(0,240,255,0.4)",
              color: "#00F0FF",
              fontSize: 20,
              fontWeight: 600,
            }}
          >
            ▶ Watch the codebase explainer
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <div
      style={{
        padding: "12px 22px",
        borderRadius: 999,
        border: `1px solid ${color}66`,
        background: `${color}1A`,
        color,
        fontSize: 22,
        fontWeight: 600,
      }}
    >
      {label}
    </div>
  );
}
