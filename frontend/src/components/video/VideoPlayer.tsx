"use client";

import {
  Maximize2,
  Minimize2,
  Pause,
  PictureInPicture2,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn, formatDuration } from "@/lib/utils";

export interface Chapter {
  id: string;
  label: string;
  start: number;
}

interface VideoPlayerProps {
  src: string;
  poster?: string;
  chapters?: Chapter[];
  className?: string;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;
const IDLE_MS = 2200;

export function VideoPlayer({ src, poster, chapters = [], className }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const idleTimer = useRef<number | null>(null);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [speed, setSpeed] = useState<number>(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Track ready state so we don't render numbers from a half-loaded video.
  const ready = duration > 0;

  /* --- Playback wiring ---------------------------------------------------- */
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }, []);

  const seek = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || 0, seconds));
  }, []);

  const enterFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void container.requestFullscreen();
    }
  }, []);

  const enterPip = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (document.pictureInPictureElement) {
      void document.exitPictureInPicture();
    } else if (document.pictureInPictureEnabled) {
      void video.requestPictureInPicture();
    }
  }, []);

  /* --- Video event subscriptions ----------------------------------------- */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => setTime(video.currentTime);
    const onMeta = () => setDuration(video.duration || 0);
    const onProgress = () => {
      if (!video.buffered.length || !video.duration) return;
      setBuffered(video.buffered.end(video.buffered.length - 1) / video.duration);
    };
    const onVol = () => {
      setVolume(video.volume);
      setMuted(video.muted);
    };
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("progress", onProgress);
    video.addEventListener("volumechange", onVol);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("progress", onProgress);
      video.removeEventListener("volumechange", onVol);
    };
  }, [src]);

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  /* --- Keyboard shortcuts ------------------------------------------------ */
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      switch (event.key.toLowerCase()) {
        case " ":
        case "k":
          event.preventDefault();
          togglePlay();
          break;
        case "m":
          toggleMute();
          break;
        case "f":
          enterFullscreen();
          break;
        case "j":
          seek(time - 10);
          break;
        case "l":
          seek(time + 10);
          break;
        case "arrowleft":
          seek(time - 5);
          break;
        case "arrowright":
          seek(time + 5);
          break;
        case "?":
          setShowShortcuts((v) => !v);
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, toggleMute, enterFullscreen, seek, time]);

  /* --- Idle auto-hide of controls --------------------------------------- */
  const bumpIdle = useCallback(() => {
    setShowControls(true);
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowControls(false);
      }
    }, IDLE_MS);
  }, []);

  useEffect(() => bumpIdle(), [bumpIdle]);

  /* --- Apply speed ------------------------------------------------------- */
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed]);

  return (
    <div
      ref={containerRef}
      onMouseMove={bumpIdle}
      onMouseLeave={() => playing && setShowControls(false)}
      className={cn(
        "group relative overflow-hidden rounded-3xl border border-white/[0.08] bg-black",
        className,
      )}
      data-cursor="interactive"
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        onClick={togglePlay}
        className="block aspect-video w-full cursor-pointer"
        playsInline
      />

      {/* Center play button overlay (only while paused) */}
      {!playing && (
        <button
          type="button"
          aria-label="Play"
          onClick={togglePlay}
          className="absolute inset-0 grid place-items-center bg-gradient-to-b from-transparent via-transparent to-ink/40"
        >
          <span className="grid h-20 w-20 place-items-center rounded-full bg-electric/20 ring-1 ring-electric/50 backdrop-blur-xl transition-transform duration-300 ease-luxe group-hover:scale-105">
            <Play className="h-8 w-8 fill-electric text-electric" />
          </span>
        </button>
      )}

      {/* Controls */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/95 via-ink/70 to-transparent px-6 pb-5 pt-16 transition-all duration-400 ease-luxe",
          showControls || !playing ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="pointer-events-auto">
          <Timeline
            time={time}
            duration={duration}
            buffered={buffered}
            chapters={chapters}
            onSeek={seek}
          />
          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={togglePlay}
                aria-label={playing ? "Pause" : "Play"}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/5 text-bone transition-colors duration-300 hover:bg-white/15 hover:text-electric"
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleMute}
                  aria-label={muted ? "Unmute" : "Mute"}
                  className="text-fog transition-colors duration-300 hover:text-bone"
                >
                  {muted || volume === 0 ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={muted ? 0 : volume}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setVolume(value);
                    if (videoRef.current) {
                      videoRef.current.volume = value;
                      videoRef.current.muted = value === 0;
                    }
                  }}
                  className="h-1 w-20 accent-electric"
                  aria-label="Volume"
                />
              </div>

              <span className="font-mono text-xs tabular-nums text-fog">
                {formatDuration(time)} {" / "} {ready ? formatDuration(duration) : "—:—"}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <SpeedMenu speed={speed} onSelect={setSpeed} />
              <button
                type="button"
                onClick={enterPip}
                aria-label="Picture in picture"
                className="grid h-8 w-8 place-items-center rounded-full text-fog transition-colors duration-300 hover:text-bone"
              >
                <PictureInPicture2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={enterFullscreen}
                aria-label="Fullscreen"
                className="grid h-8 w-8 place-items-center rounded-full text-fog transition-colors duration-300 hover:text-bone"
              >
                {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showShortcuts && <ShortcutsOverlay onClose={() => setShowShortcuts(false)} />}

      {/* '?' hint, bottom-right */}
      <button
        type="button"
        onClick={() => setShowShortcuts(true)}
        aria-label="Keyboard shortcuts"
        className={cn(
          "absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-ink/60 font-mono text-xs text-fog backdrop-blur transition-opacity duration-400",
          showControls || !playing ? "opacity-100" : "opacity-0",
        )}
      >
        ?
      </button>
    </div>
  );
}

function Timeline({
  time,
  duration,
  buffered,
  chapters,
  onSeek,
}: {
  time: number;
  duration: number;
  buffered: number;
  chapters: Chapter[];
  onSeek: (s: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hoverPct, setHoverPct] = useState<number | null>(null);
  const percent = duration ? (time / duration) * 100 : 0;

  function pctFromEvent(event: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  }

  return (
    <div className="relative">
      <div
        ref={ref}
        onClick={(event) => {
          const p = pctFromEvent(event);
          if (p !== null && duration) onSeek(p * duration);
        }}
        onMouseMove={(event) => {
          const p = pctFromEvent(event);
          if (p !== null) setHoverPct(p);
        }}
        onMouseLeave={() => setHoverPct(null)}
        className="relative h-2 cursor-pointer rounded-full bg-white/[0.08]"
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-white/15"
          style={{ width: `${buffered * 100}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-electric"
          style={{ width: `${percent}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 rounded-full bg-electric ring-1 ring-electric/40 transition-transform duration-200"
          style={{
            left: `calc(${percent}% - 6px)`,
            width: 12,
            height: 12,
            boxShadow: "0 0 18px rgba(0,240,255,0.7)",
          }}
        />
        {/* Chapter dots */}
        {duration > 0 &&
          chapters.map((chapter) => {
            const left = (chapter.start / duration) * 100;
            return (
              <button
                key={chapter.id}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onSeek(chapter.start);
                }}
                className="group/dot absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-bone p-0 ring-2 ring-ink"
                style={{ left: `${left}%`, width: 8, height: 8 }}
                aria-label={`Jump to ${chapter.label}`}
              >
                <span className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 rounded-md bg-ink px-2 py-1 font-mono text-[10px] uppercase tracking-[0.32em] text-bone opacity-0 ring-1 ring-white/10 transition-opacity duration-200 group-hover/dot:opacity-100">
                  {chapter.label}
                </span>
              </button>
            );
          })}
      </div>

      {hoverPct !== null && duration > 0 && (
        <div
          className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded-md bg-ink px-2 py-1 font-mono text-[10px] text-fog ring-1 ring-white/10"
          style={{ left: `${hoverPct * 100}%` }}
        >
          {formatDuration(hoverPct * duration)}
        </div>
      )}
    </div>
  );
}

function SpeedMenu({ speed, onSelect }: { speed: number; onSelect: (s: number) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-full bg-white/5 px-3 py-1 font-mono text-xs text-fog transition-colors duration-300 hover:bg-white/15 hover:text-bone"
      >
        {speed}×
      </button>
      {open && (
        <div
          role="menu"
          className="absolute bottom-10 right-0 min-w-[120px] rounded-xl border border-white/10 bg-graphite p-1 shadow-2xl"
        >
          {SPEEDS.map((s) => (
            <button
              key={s}
              role="menuitem"
              onClick={() => {
                onSelect(s);
                setOpen(false);
              }}
              className={cn(
                "block w-full rounded-md px-3 py-1.5 text-left font-mono text-xs transition-colors duration-200",
                s === speed
                  ? "bg-electric/10 text-electric"
                  : "text-fog hover:bg-white/5 hover:text-bone",
              )}
            >
              {s}×
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  const rows: [string, string][] = [
    ["Space / K", "Play · Pause"],
    ["J · L", "Jump back · forward 10s"],
    ["← · →", "Step back · forward 5s"],
    ["M", "Mute"],
    ["F", "Fullscreen"],
    ["?", "Toggle this overlay"],
  ];
  return (
    <button
      type="button"
      onClick={onClose}
      className="absolute inset-0 grid place-items-center bg-ink/80 backdrop-blur"
    >
      <div className="surface-1 max-w-md rounded-2xl p-8 text-left">
        <div className="kicker">Keyboard</div>
        <h3 className="mt-3 font-display text-2xl font-bold text-bone">Shortcuts</h3>
        <dl className="mt-6 grid grid-cols-[140px_1fr] gap-y-3 text-sm">
          {rows.map(([key, label]) => (
            <div key={key} className="contents">
              <dt className="font-mono text-fog">{key}</dt>
              <dd className="text-bone">{label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </button>
  );
}
