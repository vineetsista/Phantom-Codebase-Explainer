const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface GenerateOptions {
  voice?: "openai" | "elevenlabs";
  quality?: "720p" | "1080p";
}

export interface JobStatus {
  job_id: string;
  status:
    | "queued"
    | "analyzing"
    | "scripting"
    | "diagramming"
    | "voiceover"
    | "rendering"
    | "complete"
    | "failed";
  progress: number;
  details: Record<string, unknown>;
  error?: string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
  repo_name?: string;
  repo_owner?: string;
}

export interface VideoRecord {
  id: string;
  repo_url: string;
  repo_name: string;
  repo_owner: string;
  repo_description: string;
  repo_stars: number;
  repo_language: string;
  status: JobStatus["status"];
  progress: number;
  video_url: string;
  thumbnail_url: string;
  duration_seconds: number;
  video_quality: string;
  has_watermark: boolean;
  voice_provider: string;
  view_count: number;
  created_at: string | null;
  completed_at: string | null;
  script_data?: {
    title?: string;
    hook?: string;
    sections?: {
      id: string;
      narration: string;
      duration_seconds: number;
      audio_duration_seconds?: number;
    }[];
    /** Canonical chapter list computed by video_assembler.compute_chapters.
     *  Frontend prefers this over its local math — it's the same math as the
     *  Remotion Sequence placement, computed exactly once at render time. */
    chapters?: { id: string; title: string; start_seconds: number }[];
    why_it_matters?: string;
    key_takeaways?: string[];
  } | null;
  analysis_data?: Record<string, unknown> | null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${response.status}: ${text || response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export async function startGeneration(
  repoUrl: string,
  options: GenerateOptions = {},
): Promise<{ job_id: string; status: string }> {
  return request("/api/v1/generate", {
    method: "POST",
    body: JSON.stringify({ repo_url: repoUrl, options }),
  });
}

export async function getStatus(jobId: string): Promise<JobStatus> {
  return request(`/api/v1/status/${jobId}`);
}

export async function listVideos(): Promise<{ videos: VideoRecord[] }> {
  return request("/api/v1/videos");
}

export async function getVideo(id: string): Promise<{ video: VideoRecord }> {
  return request(`/api/v1/videos/${id}`);
}
