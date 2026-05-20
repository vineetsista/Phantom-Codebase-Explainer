"use client";

import { motion, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * Soft cursor follower that expands when hovering interactive elements.
 * Disabled on touch / coarse-pointer devices via a media query in globals.css
 * (which is what hides the native cursor too).
 */
export function CursorFollower() {
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const springX = useSpring(x, { stiffness: 350, damping: 32, mass: 0.4 });
  const springY = useSpring(y, { stiffness: 350, damping: 32, mass: 0.4 });

  const [variant, setVariant] = useState<"default" | "interactive" | "text">("default");
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const supports =
      window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!supports) return;
    document.documentElement.classList.add("has-custom-cursor");
    setEnabled(true);

    function onMove(event: MouseEvent) {
      x.set(event.clientX);
      y.set(event.clientY);
    }
    function onOver(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const interactive = target.closest(
        'a, button, [role="button"], input, textarea, select, [data-cursor="interactive"]',
      );
      const text = target.closest('[data-cursor="text"]');
      if (interactive) setVariant("interactive");
      else if (text) setVariant("text");
      else setVariant("default");
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseover", onOver);
    return () => {
      document.documentElement.classList.remove("has-custom-cursor");
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseover", onOver);
    };
  }, [x, y]);

  if (!enabled) return null;

  const size = variant === "interactive" ? 48 : variant === "text" ? 4 : 14;
  const ring = variant === "interactive" ? 1.5 : 1;
  const fill =
    variant === "interactive" ? "rgba(0,240,255,0.10)" : "rgba(0,240,255,0)";

  return (
    <>
      <motion.div
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[10000] rounded-full"
        style={{
          x: springX,
          y: springY,
          width: size,
          height: size,
          translateX: "-50%",
          translateY: "-50%",
          border: `${ring}px solid rgba(0,240,255,0.7)`,
          background: fill,
          mixBlendMode: "difference",
          transition: "width 250ms cubic-bezier(0.16,1,0.3,1), height 250ms cubic-bezier(0.16,1,0.3,1), background-color 250ms",
        }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[10001] rounded-full bg-electric"
        style={{
          x,
          y,
          width: 4,
          height: 4,
          translateX: "-50%",
          translateY: "-50%",
          opacity: variant === "text" ? 0 : 0.9,
        }}
      />
    </>
  );
}
