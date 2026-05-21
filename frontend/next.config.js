/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // The Next.js server runs this server-side. In Docker, `localhost:8000`
    // resolves to the frontend container itself — we need the backend service
    // name. API_PROXY_TARGET overrides for that case; fall back to the public
    // API URL for local dev.
    const api =
      process.env.API_PROXY_TARGET ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:8000";
    return [
      // Proxy /media/* (generated MP4s + thumbnails) through Next so the
      // browser uses same-origin URLs and avoids CORS friction.
      { source: "/media/:path*", destination: `${api}/media/:path*` },
    ];
  },
  async headers() {
    return [
      {
        // Allow /embed/* to be loaded inside any third-party <iframe>.
        // We omit X-Frame-Options entirely (instead of "ALLOWALL", which
        // isn't standard) and use a permissive frame-ancestors CSP.
        source: "/embed/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
          { key: "X-Frame-Options", value: "ALLOWALL" },
          // Cache the embed page itself briefly so iframe loads don't
          // hammer the origin on a viral video.
          { key: "Cache-Control", value: "public, max-age=60, s-maxage=300" },
        ],
      },
      {
        // Lock the rest of the site down by default.
        source: "/((?!embed).*)",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
    ];
  },
};

module.exports = nextConfig;
