"use client";

/**
 * An animated progress ring.
 *
 * Used for the four growth pillars, where a ring reads better than a bar: four
 * rings in a row are comparable at a glance, and each carries its pillar's
 * colour as a full circle rather than a thin stripe.
 *
 * The percentage is the accessible value on the wrapper; the SVG is hidden from
 * assistive tech, so a screen reader hears "Mind: 60 percent" and not a pile of
 * path data.
 */

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";

export function Ring({
  value,
  label,
  emoji,
  size = 72,
  stroke = 7,
}: {
  value: number;
  label: string;
  emoji?: string;
  size?: number;
  stroke?: number;
}) {
  const still = useReducedMotion();
  const pct = Math.max(0, Math.min(100, value));
  const [shown, setShown] = useState(still ? pct : 0);

  // Animate from zero on mount by letting the CSS transition run one frame
  // after the initial paint. Starting at the final value would show no motion.
  useEffect(() => {
    if (still) {
      setShown(pct);
      return;
    }
    const id = requestAnimationFrame(() => setShown(pct));
    return () => cancelAnimationFrame(id);
  }, [pct, still]);

  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      className="ring-wrap"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${label}: ${pct} percent`}
    >
      <svg className="ring" width={size} height={size} aria-hidden="true">
        <circle
          className="ring-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - shown / 100)}
        />
      </svg>
      <span className="ring-label" style={{ fontSize: size * 0.24 }} aria-hidden="true">
        {emoji ?? `${pct}%`}
      </span>
    </div>
  );
}
