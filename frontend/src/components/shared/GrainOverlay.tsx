/**
 * Fixed full-viewport SVG noise overlay. Sits above everything (z-index: 9999)
 * but ignores pointer events so the rest of the UI is unaffected.
 *
 * Why SVG instead of a PNG? It's ~400 bytes, scales perfectly, and the
 * fractalNoise primitive is what print-grain plugins use under the hood.
 */
export function GrainOverlay() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[9999] opacity-[0.04] mix-blend-overlay"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.6 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        backgroundSize: "180px 180px",
      }}
    />
  );
}
