import type { Metadata, Viewport } from "next";

import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { CursorFollower } from "@/components/shared/CursorFollower";
import { GrainOverlay } from "@/components/shared/GrainOverlay";
import { PageTransition } from "@/components/shared/PageTransition";
import "@/styles/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: {
    default: "Phantom — Any codebase. Explained in minutes.",
    template: "%s · Phantom",
  },
  description:
    "Drop a GitHub URL. Get a cinematic AI-generated video walkthrough — architecture, key files, data flow, narrated by AI.",
  keywords: [
    "codebase explainer",
    "AI code walkthrough",
    "GitHub video",
    "repository documentation",
    "RepoX",
    "Phantom",
  ],
  authors: [{ name: "Vineet Sista" }],
  creator: "Vineet Sista",
  openGraph: {
    type: "website",
    siteName: "Phantom",
    title: "Any codebase. Explained in minutes.",
    description:
      "Drop a GitHub URL. Get a cinematic AI-generated video walkthrough.",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "Phantom — Any codebase. Explained in minutes.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Any codebase. Explained in minutes.",
    description:
      "Drop a GitHub URL. Get a cinematic AI-generated video walkthrough.",
    images: ["/api/og"],
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#050507",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-void font-body text-bone antialiased">
        <GrainOverlay />
        <CursorFollower />
        <Navbar />
        <main className="relative">
          <PageTransition>{children}</PageTransition>
        </main>
        <Footer />
      </body>
    </html>
  );
}
