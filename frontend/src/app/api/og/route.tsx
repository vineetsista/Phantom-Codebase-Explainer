import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Dynamic Open Graph image. 1200x630, optimized for Twitter / LinkedIn / Slack
 * link previews. Two modes:
 *
 *   ?id=<video_id>  — per-video card with 4-frame strip pulled from the
 *                     rendered MP4 (v7). Best for share unfurls.
 *   ?owner=&name=&language=&stars=  — generic repo card (legacy).
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const videoId = params.get("id");

  // Per-video mode — fetch metadata + frame URLs.
  if (videoId) {
    return renderVideoCard(videoId);
  }

  // Legacy generic mode.
  return renderGenericCard(params);
}

async function fetchVideo(id: string) {
  try {
    const res = await fetch(`${API_URL}/api/v1/videos/${id}`, {
      cache: "force-cache",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function renderVideoCard(id: string) {
  const data = await fetchVideo(id);
  const video = data?.video ?? {};
  const title = video.repo_name && video.repo_owner
    ? `${video.repo_owner}/${video.repo_name}`
    : "Phantom · codebase explainer";
  const language = video.repo_language || "";
  const stars = video.repo_stars || 0;
  const tldr = (video.summary_data?.tldr || "").slice(0, 140);
  const frameBase = `${API_URL}/media/frames/${id}`;
  const frames = [0, 1, 2, 3].map((i) => `${frameBase}/${i}.jpg`);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #050507 0%, #0A0A0B 50%, #14141A 100%)",
          padding: 56,
          position: "relative",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <Atmosphere />

        {/* Top kicker */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 16,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: "#00F0FF",
            fontWeight: 700,
          }}
        >
          <Dot />
          PHANTOM · REPOX
        </div>

        {/* Title */}
        <div
          style={{
            marginTop: 18,
            fontSize: 64,
            fontWeight: 800,
            color: "#F5F5F0",
            lineHeight: 1,
            letterSpacing: -2,
            maxWidth: 1080,
            display: "flex",
          }}
        >
          {title}
        </div>

        {/* Pills */}
        {(language || stars) && (
          <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
            {language && <Pill label={language} color="#00F0FF" />}
            {stars > 0 && (
              <Pill label={`★ ${stars.toLocaleString()}`} color="#7B61FF" />
            )}
          </div>
        )}

        {/* Frame strip */}
        <div
          style={{
            marginTop: 28,
            display: "flex",
            gap: 10,
            width: "100%",
          }}
        >
          {frames.map((url) => (
            <div
              key={url}
              style={{
                flex: 1,
                height: 152,
                borderRadius: 10,
                overflow: "hidden",
                display: "flex",
                background: "#11111a",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {/* @vercel/og fetches the image at edge — server URLs work
                  in dev and prod alike. */}
              <img
                src={url}
                width={270}
                height={152}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          ))}
        </div>

        {/* TLDR */}
        {tldr && (
          <div
            style={{
              marginTop: 22,
              fontSize: 22,
              color: "#A8A8B3",
              lineHeight: 1.3,
              maxWidth: 1080,
              display: "flex",
            }}
          >
            {tldr}
          </div>
        )}

        {/* Spacer + bottom row */}
        <div style={{ flex: 1, display: "flex" }} />
        <BottomRow />
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

function renderGenericCard(params: URLSearchParams) {
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
          background: "linear-gradient(135deg, #050507 0%, #0A0A0B 50%, #14141A 100%)",
          padding: 72,
          position: "relative",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <Atmosphere />
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
          <Dot />
          PHANTOM · REPOX
        </div>
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
        <BottomRow />
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

function Atmosphere() {
  return (
    <>
      <div
        style={{
          position: "absolute",
          top: -150,
          left: -150,
          width: 600,
          height: 600,
          background: "radial-gradient(circle, rgba(0,240,255,0.30), transparent 60%)",
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
          background: "radial-gradient(circle, rgba(123,97,255,0.30), transparent 60%)",
          filter: "blur(40px)",
        }}
      />
    </>
  );
}

function Dot() {
  return (
    <span
      style={{
        width: 10,
        height: 10,
        borderRadius: 5,
        background: "#00F0FF",
        boxShadow: "0 0 18px #00F0FF",
      }}
    />
  );
}

function BottomRow() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: 22,
        color: "#A8A8B3",
        marginTop: 18,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: "linear-gradient(135deg, #00F0FF, #7B61FF)",
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
          display: "flex",
        }}
      >
        ▶ Watch the codebase explainer
      </div>
    </div>
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
        display: "flex",
      }}
    >
      {label}
    </div>
  );
}
