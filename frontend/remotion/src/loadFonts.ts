import { cancelRender, continueRender, delayRender, staticFile } from "remotion";

/**
 * Loads the brand fonts (Clash Display + Satoshi + JetBrains Mono) into the
 * Remotion rendering browser before the first frame is composed.
 *
 * The fonts live in the shared frontend public folder — `remotion.config.ts`
 * points `setPublicDir` at `../public` so `staticFile('fonts/...')` resolves
 * to the same files the Next.js side serves over HTTP.
 *
 * If a file is missing on disk the FontFace promise rejects silently and the
 * scene falls back to the next font in the stack (Satoshi → system sans;
 * Clash → Satoshi → system sans). This matches the web side, which uses
 * `font-display: swap` for the same reason.
 */

interface FontSpec {
  family: string;
  file: string;
  weight: string;
}

const FONTS: FontSpec[] = [
  { family: "Clash Display", file: "fonts/clash-display-500.woff2", weight: "500" },
  { family: "Clash Display", file: "fonts/clash-display-600.woff2", weight: "600" },
  { family: "Clash Display", file: "fonts/clash-display-700.woff2", weight: "700" },
  { family: "Satoshi", file: "fonts/satoshi-400.woff2", weight: "400" },
  { family: "Satoshi", file: "fonts/satoshi-500.woff2", weight: "500" },
  { family: "Satoshi", file: "fonts/satoshi-700.woff2", weight: "700" },
  { family: "JetBrains Mono", file: "fonts/jetbrains-mono-400.woff2", weight: "400" },
  { family: "JetBrains Mono", file: "fonts/jetbrains-mono-500.woff2", weight: "500" },
  { family: "JetBrains Mono", file: "fonts/jetbrains-mono-700.woff2", weight: "700" },
];

let loaded = false;

export function loadFonts(): void {
  if (loaded || typeof document === "undefined") return;
  loaded = true;

  const handle = delayRender("Loading brand fonts");

  Promise.all(
    FONTS.map(async (spec) => {
      try {
        const face = new FontFace(spec.family, `url(${staticFile(spec.file)})`, {
          weight: spec.weight,
          style: "normal",
          display: "swap",
        });
        await face.load();
        document.fonts.add(face);
      } catch {
        // Missing file or decode failure — fall back to system stack, same as the web side.
      }
    }),
  )
    .then(() => continueRender(handle))
    .catch((err) => cancelRender(err));
}

/**
 * Font stacks used by every Remotion scene. Exported as constants so the swap
 * lives in one place — if a third display face ships, change it here.
 */
export const FONT_DISPLAY =
  '"Clash Display", "Satoshi", ui-sans-serif, system-ui, -apple-system, sans-serif';
export const FONT_BODY =
  '"Satoshi", ui-sans-serif, system-ui, -apple-system, sans-serif';
export const FONT_MONO =
  '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
