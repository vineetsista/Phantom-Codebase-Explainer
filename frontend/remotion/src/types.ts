export interface ScriptModule {
  name: string;
  role: string;
  description?: string;
  file_count?: number;
}

export interface ScriptSection {
  id: "intro" | "architecture" | "code_walkthrough" | "summary" | string;
  narration: string;
  duration_seconds: number;
  /** Real measured audio duration in seconds (ffprobe, ms precision).
   * Used in preference to duration_seconds when set — duration_seconds is the
   * estimate produced before voice synthesis ran. */
  audio_duration_seconds?: number;
  visuals: {
    type: string;
    data: Record<string, unknown>;
  };
}

export interface VideoScript {
  title: string;
  hook: string;
  total_duration_seconds: number;
  sections: ScriptSection[];
  key_takeaways: string[];
  /** Single sentence that ties the takeaways back to the hook. Rendered on
   * the first beat of the OutroScene. */
  why_it_matters?: string;
  /** Canonical chapter list — computed by video_assembler.compute_chapters
   * and embedded in script_data. The frontend player consumes this
   * directly. The Remotion composition doesn't need it but it's part of
   * the same shared object. */
  chapters?: { id: string; title: string; start_seconds: number }[];
}

export interface AudioSegment {
  section_id: string;
  audio_path: string;
  duration_seconds: number;
  /** Real measured audio duration in seconds (ffprobe). */
  audio_duration_seconds?: number;
}

/** Trailing silence appended to each scene so the last word of narration
 *  completes before the visual cut. 1.0 s after testing showed 0.6 s
 *  occasionally clipped the final consonant. Better small silent gaps
 *  than chopped narration. */
export const SCENE_TRAILING_BUFFER_S = 1.0;
/** Length of the visual crossfade between adjacent scenes. 0.3 s = 9 frames. */
export const SCENE_TRANSITION_S = 0.3;

export interface CompositionProps {
  script: VideoScript;
  audio: AudioSegment[];
  diagramSvgPath: string;
  /** Optional background music track. Path is passed to `staticFile()`,
   * so it must be relative to the configured public/ folder. */
  musicSrc?: string | null;
}

export const FPS = 30;

export const COLORS = {
  bg: "#0A0A0B",
  text: "#F5F5F0",
  cyan: "#00F0FF",
  violet: "#7B61FF",
  grid: "rgba(255,255,255,0.05)",
};
