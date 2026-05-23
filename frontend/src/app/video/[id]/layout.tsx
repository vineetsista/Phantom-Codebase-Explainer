/**
 * Server-component layout that owns the per-video OG metadata. The
 * page itself is a Client Component (uses hooks), so metadata has to
 * live one level up. This is the file that makes Twitter / LinkedIn /
 * Slack / Discord show the 4-frame strip preview when someone pastes
 * a video URL.
 */
import type { Metadata } from "next";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface VideoRecord {
  id: string;
  repo_owner?: string;
  repo_name?: string;
  repo_description?: string;
  repo_language?: string;
  repo_stars?: number;
  script_data?: { title?: string; hook?: string } | null;
  summary_data?: { tldr?: string } | null;
}

async function fetchVideo(id: string): Promise<VideoRecord | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/videos/${id}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.video as VideoRecord;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const v = await fetchVideo(params.id);
  if (!v) return { title: "Video · Phantom" };

  const title =
    v.script_data?.title ||
    (v.repo_owner && v.repo_name ? `${v.repo_owner}/${v.repo_name}` : "Phantom video");
  const description =
    v.summary_data?.tldr ||
    v.script_data?.hook ||
    v.repo_description ||
    "AI-generated codebase walkthrough.";
  // Per-video OG: 4 frames extracted from the actual MP4 + repo metadata.
  const ogImage = `${APP_URL}/api/og?id=${params.id}`;
  const url = `${APP_URL}/video/${params.id}`;

  return {
    title: `${title} · Phantom`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "video.other",
      title,
      description,
      url,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
      siteName: "Phantom",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default function VideoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
