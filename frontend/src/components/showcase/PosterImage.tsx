"use client";

import { useState } from "react";

/**
 * Tiny client wrapper around an <img> that hides itself if the poster
 * doesn't exist yet. Keeps the parent showcase pages as Server Components
 * so they get static generation + SEO benefits.
 */
export function PosterImage({ src, className }: { src: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setBroken(true)}
      className={className}
    />
  );
}
