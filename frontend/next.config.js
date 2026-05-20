/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    return [
      // Proxy /media/* (generated MP4s + thumbnails) through Next so the
      // browser can use same-origin URLs and avoid CORS friction.
      { source: "/media/:path*", destination: `${api}/media/:path*` },
    ];
  },
};

module.exports = nextConfig;
