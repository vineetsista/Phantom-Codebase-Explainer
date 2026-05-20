"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { GenerationLayout } from "@/components/generate/GenerationLayout";

function GenerationContent() {
  const params = useSearchParams();
  return (
    <GenerationLayout
      initialJob={params.get("job")}
      initialUrl={params.get("url") || ""}
    />
  );
}

export default function GeneratePage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl px-6 py-24" />}>
      <GenerationContent />
    </Suspense>
  );
}
