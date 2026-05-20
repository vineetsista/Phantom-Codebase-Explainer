/**
 * Phantom analytics — tiny, provider-agnostic event tracker.
 *
 * Wires up to PostHog or Plausible if available on `window`, otherwise no-ops.
 * Drop the PostHog snippet (or Plausible script) in the root layout to enable.
 *
 * Usage:
 *   import { track } from "@/lib/analytics";
 *   track("generation_started", { repo_url: url });
 */

export type PhantomEvent =
  | "landing_view"
  | "hero_input_focused"
  | "generation_started"
  | "generation_stage_reached"
  | "generation_completed"
  | "generation_failed"
  | "video_played"
  | "video_completed"
  | "share_clicked"
  | "download_clicked"
  | "pricing_viewed"
  | "pricing_tier_clicked"
  | "signup_started"
  | "signup_completed"
  | "showcase_video_clicked"
  | "regenerate_clicked";

type Props = Record<string, string | number | boolean | null | undefined>;

interface PosthogLike {
  capture: (event: string, props?: Props) => void;
}
interface PlausibleLike {
  (event: string, options?: { props?: Props }): void;
}

declare global {
  interface Window {
    posthog?: PosthogLike;
    plausible?: PlausibleLike;
  }
}

export function track(event: PhantomEvent, props: Props = {}): void {
  if (typeof window === "undefined") return;

  // PostHog
  if (window.posthog) {
    try {
      window.posthog.capture(event, props);
    } catch {
      // ignore
    }
  }

  // Plausible
  if (window.plausible) {
    try {
      window.plausible(event, { props });
    } catch {
      // ignore
    }
  }

  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.debug("[analytics]", event, props);
  }
}

/** Convenience: track an event once per page load, keyed by name. */
const fired = new Set<string>();
export function trackOnce(event: PhantomEvent, props: Props = {}): void {
  if (fired.has(event)) return;
  fired.add(event);
  track(event, props);
}
