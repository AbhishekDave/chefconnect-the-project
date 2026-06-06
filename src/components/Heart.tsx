import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Variant = "quiet" | "interactive" | "pulse";
type Size = "sm" | "md" | "lg";

const sizes: Record<Size, { icon: string; text: string; pad: string }> = {
  sm: { icon: "h-4 w-4", text: "text-xs", pad: "px-2 py-1" },
  md: { icon: "h-5 w-5", text: "text-sm", pad: "px-2.5 py-1.5" },
  lg: { icon: "h-8 w-8", text: "text-2xl", pad: "px-3 py-2" },
};

function HeartGlyph({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={cn("transition-colors", className)}
      fill={filled ? "var(--heart)" : "none"}
      stroke="var(--heart)"
      strokeOpacity={filled ? 1 : 0.55}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

export interface HeartProps {
  variant?: Variant;
  size?: Size;
  count?: number | null;
  hearted?: boolean;
  label?: string;
  pulseKey?: number;
  onHeart?: () => void | Promise<void>;
  className?: string;
  hideCount?: boolean;
}

export function Heart({
  variant = "quiet",
  size = "md",
  count,
  hearted = false,
  label,
  pulseKey = 0,
  onHeart,
  className,
  hideCount = false,
}: HeartProps) {
  const s = sizes[size];
  const [bloom, setBloom] = useState(false);
  const [pulse, setPulse] = useState(false);
  const firstPulse = useRef(true);

  // pulse variant: play a one-shot halo on each pulseKey change (skip first mount)
  useEffect(() => {
    if (variant !== "pulse") return;
    if (firstPulse.current) {
      firstPulse.current = false;
      return;
    }
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 1500);
    return () => clearTimeout(t);
  }, [pulseKey, variant]);

  const countNode = hideCount ? null : (
    <span className={cn("tabular-nums text-ink/70", s.text)}>
      {count === null || count === undefined ? "—" : count}
    </span>
  );

  if (variant === "interactive") {
    const handle = async () => {
      if (hearted) return;
      setBloom(true);
      setTimeout(() => setBloom(false), 600);
      await onHeart?.();
    };
    return (
      <button
        type="button"
        onClick={handle}
        aria-label={label ?? "Give a heart"}
        aria-pressed={hearted}
        disabled={hearted}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-cream/70 backdrop-blur-sm",
          s.pad,
          "border border-border/60 transition-all",
          hearted ? "cursor-default" : "hover:border-ember/40 hover:bg-cream active:scale-95",
          className,
        )}
      >
        <HeartGlyph filled={hearted} className={cn(s.icon, bloom && "animate-ember-bloom")} />
        {countNode}
      </button>
    );
  }

  if (variant === "pulse") {
    return (
      <span
        className={cn(
          "relative inline-flex items-center gap-1.5 rounded-full",
          s.pad,
          pulse && "animate-pulse-ember",
          className,
        )}
      >
        <HeartGlyph filled className={s.icon} />
        {countNode}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <HeartGlyph filled className={s.icon} />
      {countNode}
    </span>
  );
}

export default Heart;
