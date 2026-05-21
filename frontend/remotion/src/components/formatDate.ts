/**
 * Format an ISO-8601 timestamp as a short "x ago" string suitable for the
 * intro metadata strip. Deterministic — no `new Date()` of the current
 * moment — so two renders of the same input produce the same string and
 * the video is reproducible.
 *
 * "Now" is passed in explicitly. Default is the build-time fallback.
 */
export function formatRelative(iso: string | undefined, now = new Date()): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!isFinite(t)) return "—";
  const days = Math.floor((now.getTime() - t) / (1000 * 60 * 60 * 24));
  if (days < 0) return "today";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  if (days < 730) return `${Math.round(days / 30)} months ago`;
  return `${Math.round(days / 365)} years ago`;
}

export function formatYear(iso: string | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!isFinite(t)) return "—";
  return String(new Date(t).getUTCFullYear());
}
