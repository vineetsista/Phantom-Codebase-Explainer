"use client";

import { forwardRef } from "react";

import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "outline" | "ember";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-electric text-ink hover:brightness-110 hover:shadow-[0_0_28px_-4px_rgba(0,240,255,0.6)]",
  ghost:
    "bg-white/[0.04] text-bone hover:bg-white/[0.08] border border-white/10 backdrop-blur",
  outline:
    "border border-electric/40 text-electric hover:bg-electric/10",
  ember:
    "bg-ember text-ink hover:brightness-110 hover:shadow-[0_0_28px_-4px_rgba(255,107,53,0.6)]",
};

const SIZE: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-12 px-6 text-sm",
  lg: "h-16 px-8 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-tight transition-all duration-300 ease-luxe",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric/70",
          "disabled:cursor-not-allowed disabled:opacity-50",
          VARIANT[variant],
          SIZE[size],
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
