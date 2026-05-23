import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const metadata: Metadata = {
  title: "History · Phantom",
  robots: { index: false, follow: false },
};

interface VideoRow {
  id: string;
  repo_owner: string;
  repo_name: string;
  repo_language: string;
  thumbnail_url: string;
  duration_seconds: number;
  view_count: number;
  status: string;
  visibility: string;
  created_at: string;
}

async function fetchMyVideos(backendId: string): Promise<VideoRow[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/videos?mine=true&limit=200`, {
      headers: { "X-User-Id": backendId },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.videos as VideoRow[];
  } catch {
    return [];
  }
}

export default async function HistoryPage() {
  const session = await getServerSession(authOptions);
  const backendId = (session as { backendId?: string } | null)?.backendId;
  if (!backendId) redirect("/login?next=/dashboard/history");

  const videos = await fetchMyVideos(backendId);

  return (
    <section className="mx-auto max-w-6xl px-6 pb-32 pt-20">
      <header className="flex items-end justify-between">
        <div>
          <div className="kicker">All generations</div>
          <h1 className="mt-3 font-display text-4xl font-bold text-bone">History</h1>
        </div>
        <Link
          href="/dashboard"
          className="text-sm text-fog hover:text-bone"
        >
          ← Back to dashboard
        </Link>
      </header>

      {videos.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-white/10 bg-graphite/40 p-12 text-center">
          <p className="text-fog">This is where your generated videos live.</p>
        </div>
      ) : (
        <div className="mt-10 overflow-hidden rounded-2xl border border-white/10 bg-graphite/30">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-ink/40 text-mist">
              <tr>
                <th className="px-5 py-3 font-mono text-[11px] uppercase tracking-wider">Repo</th>
                <th className="px-5 py-3 font-mono text-[11px] uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 font-mono text-[11px] uppercase tracking-wider">Visibility</th>
                <th className="px-5 py-3 font-mono text-[11px] uppercase tracking-wider">Views</th>
                <th className="px-5 py-3 font-mono text-[11px] uppercase tracking-wider">Date</th>
                <th className="px-5 py-3 text-right" />
              </tr>
            </thead>
            <tbody>
              {videos.map((v) => (
                <tr key={v.id} className="border-t border-white/5 hover:bg-graphite/50">
                  <td className="px-5 py-4">
                    <Link href={`/video/${v.id}`} className="font-medium text-bone hover:text-electric">
                      {v.repo_owner}/{v.repo_name}
                    </Link>
                    {v.repo_language && (
                      <span className="ml-2 font-mono text-[10px] uppercase text-mist">
                        {v.repo_language}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-fog">{v.status}</td>
                  <td className="px-5 py-4 text-fog">{v.visibility}</td>
                  <td className="px-5 py-4 text-fog">{v.view_count.toLocaleString()}</td>
                  <td className="px-5 py-4 text-fog">
                    {new Date(v.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link href={`/video/${v.id}`} className="text-electric hover:underline">
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
