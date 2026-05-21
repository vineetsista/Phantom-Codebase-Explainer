/**
 * Renders a Schema.org JSON-LD block. Server-component-safe — no "use client"
 * needed since it just emits a <script> tag. Google + AI crawlers consume it.
 *
 * Usage:
 *   <JsonLd data={{ "@context": "https://schema.org", "@type": "VideoObject", ... }} />
 */

interface JsonLdProps {
  data: Record<string, unknown> | Record<string, unknown>[];
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      // dangerouslySetInnerHTML is the standard pattern for embedding JSON-LD.
      // The data is server-controlled (never user input) so XSS risk is nil.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
