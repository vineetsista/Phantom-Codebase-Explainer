"use client";

import { useEffect, useRef, useState } from "react";

import { getStatus, JobStatus } from "@/lib/api";

const POLL_INTERVAL_MS = 1500;
const TERMINAL: JobStatus["status"][] = ["complete", "failed"];

export function useGenerationStatus(jobId: string | null) {
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (!jobId) return;
    stoppedRef.current = false;

    async function poll() {
      while (!stoppedRef.current) {
        try {
          const next = await getStatus(jobId as string);
          setStatus(next);
          setError(null);
          if (TERMINAL.includes(next.status)) return;
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to fetch status");
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    }

    poll();
    return () => {
      stoppedRef.current = true;
    };
  }, [jobId]);

  return { status, error };
}
