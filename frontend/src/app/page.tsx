import { BuiltFor } from "@/components/landing/BuiltFor";
import { FAQ } from "@/components/landing/FAQ";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Pricing } from "@/components/landing/Pricing";
import { SocialProof } from "@/components/landing/SocialProof";
import { WatchItWork } from "@/components/landing/WatchItWork";
import { WhatYouGet } from "@/components/landing/WhatYouGet";

export default function HomePage() {
  return (
    <>
      <Hero />
      <WatchItWork />
      <HowItWorks />
      <WhatYouGet />
      <BuiltFor />
      <Pricing />
      <SocialProof />
      <FAQ />
      <FinalCTA />
    </>
  );
}
