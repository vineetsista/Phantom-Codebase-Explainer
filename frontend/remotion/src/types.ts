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
}

export interface AudioSegment {
  section_id: string;
  audio_path: string;
  duration_seconds: number;
}

export interface CompositionProps {
  script: VideoScript;
  audio: AudioSegment[];
  diagramSvgPath: string;
}

export const FPS = 30;

export const COLORS = {
  bg: "#0A0A0B",
  text: "#F5F5F0",
  cyan: "#00F0FF",
  violet: "#7B61FF",
  grid: "rgba(255,255,255,0.05)",
};
