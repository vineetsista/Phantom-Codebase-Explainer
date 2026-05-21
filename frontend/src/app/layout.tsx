import type { Metadata, Viewport } from "next";

import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { CommandPalette } from "@/components/shared/CommandPalette";
import { CursorFollower } from "@/components/shared/CursorFollower";
import { ExitIntentPopup } from "@/components/shared/ExitIntentPopup";
import { GrainOverlay } from "@/components/shared/GrainOverlay";
import { JsonLd } from "@/components/shared/JsonLd";
import { PageTransition } from "@/components/shared/PageTransition";
import { ToasterProvider } from "@/components/shared/Toaster";
import "@/styles/globals.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: {
    default: "Phantom — Any codebase. Explained in minutes.",
    template: "%s · Phantom",
  },
  description:
    "Drop a GitHub URL. Get a cinematic AI-generated video walkthrough — architecture, key files, and design decisions, narrated by AI.",
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
      <head>
        <JsonLd
          data={[
            {
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Phantom",
              url: APP_URL,
              logo: `${APP_URL}/favicon.svg`,
              description:
                "AI that turns any GitHub repository into a narrated video explainer.",
              founder: { "@type": "Person", name: "Vineet Sista" },
              sameAs: ["https://twitter.com/usephantom"],
            },
            {
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Phantom",
              url: APP_URL,
              potentialAction: {
                "@type": "SearchAction",
                target: `${APP_URL}/showcase?q={search_term_string}`,
                "query-input": "required name=search_term_string",
              },
            },
            {
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "Phantom RepoX",
              applicationCategory: "DeveloperApplication",
              operatingSystem: "Web",
              offers: [
                { "@type": "Offer", name: "Hobby", price: "0", priceCurrency: "USD" },
                { "@type": "Offer", name: "Pro", price: "19", priceCurrency: "USD" },
                { "@type": "Offer", name: "Studio", price: "49", priceCurrency: "USD" },
              ],
              description:
                "AI-generated narrated video walkthroughs of any GitHub repository.",
            },
          ]}
        />
      </head>
      <body className="min-h-screen bg-void font-body text-bone antialiased">
        <ToasterProvider>
          <GrainOverlay />
          <CursorFollower />
          <Navbar />
          <main className="relative">
            <PageTransition>{children}</PageTransition>
          </main>
          <Footer />
          <ExitIntentPopup />
          <CommandPalette />
        </ToasterProvider>
      </body>
    </html>
  );
}
