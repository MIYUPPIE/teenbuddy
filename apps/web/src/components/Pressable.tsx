"use client";

/**
 * A button that responds to being pressed.
 *
 * Three layers of feedback fire together, which is what separates "a link" from
 * "a control that felt good to tap":
 *   - a spring scale, so the surface yields;
 *   - a ripple originating at the finger, so the feedback is about *that* tap;
 *   - a haptic buzz on hardware that has one.
 *
 * It renders a real `<button>` (or an `<a>` via `href`), so keyboard, focus
 * ring, disabled state and screen-reader semantics are the platform's, not
 * a reimplementation.
 */

import Link from "next/link";
import { useCallback, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { buzz } from "../lib/haptics.ts";

type Ripple = { id: number; x: number; y: number; size: number };

type Props = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  haptic?: "tap" | "select" | "success" | "warn" | "none";
  "aria-pressed"?: boolean;
  "aria-label"?: string;
  role?: string;
  "aria-checked"?: boolean;
};

export function Pressable({
  children,
  className = "",
  style,
  onClick,
  href,
  disabled = false,
  haptic = "tap",
  ...aria
}: Props) {
  const still = useReducedMotion();
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const nextId = useRef(0);

  const spawn = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (disabled) return;
      if (haptic !== "none") buzz(haptic);
      if (still) return;

      const box = event.currentTarget.getBoundingClientRect();
      const size = Math.max(box.width, box.height) * 2.2;
      const id = nextId.current++;
      setRipples((current) => [
        ...current,
        { id, x: event.clientX - box.left, y: event.clientY - box.top, size },
      ]);
      // Matches the 520ms ripple keyframe; the node is gone before it can pile up.
      setTimeout(() => setRipples((current) => current.filter((r) => r.id !== id)), 560);
    },
    [disabled, haptic, still],
  );

  const inner = (
    <>
      {children}
      {ripples.map((r) => (
        <span
          key={r.id}
          className="ripple"
          aria-hidden="true"
          style={{ left: r.x, top: r.y, width: r.size, height: r.size }}
        />
      ))}
    </>
  );

  const classes = `${className} pressable`.trim();
  const press = still || disabled ? undefined : { scale: 0.965 };

  if (href && !disabled) {
    return (
      <motion.span whileTap={press} transition={{ type: "spring", stiffness: 460, damping: 30 }} style={{ display: "contents" }}>
        <Link href={href} className={classes} style={style} onPointerDown={spawn} onClick={onClick} {...aria}>
          {inner}
        </Link>
      </motion.span>
    );
  }

  return (
    <motion.button
      type="button"
      className={classes}
      style={style}
      disabled={disabled}
      onPointerDown={spawn}
      onClick={onClick}
      whileTap={press}
      transition={{ type: "spring", stiffness: 460, damping: 30 }}
      {...aria}
    >
      {inner}
    </motion.button>
  );
}
