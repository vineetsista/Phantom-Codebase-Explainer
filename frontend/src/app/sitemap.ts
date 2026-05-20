import type { MetadataRoute } from "next";

import { SHOWCASE_REPOS } from "@/lib/showcase";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://phantom.video";
  const now = new Date();
  const fixed = ["", "/generate", "/showcase", "/pricing"].map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.8,
  }));
  const showcase = SHOWCASE_REPOS.map((repo) => ({
    url: `${base}/showcase/${repo.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));
  return [...fixed, ...showcase];
}
