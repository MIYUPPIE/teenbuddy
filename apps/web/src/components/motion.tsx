"use client";

/**
 * Shared motion primitives.
 *
 * Three rules govern everything in this file.
 *
 * 1. **Entrances are CSS; JavaScript animates only what CSS cannot.** Content
 *    must never be invisible because a script did not run. Exits, the
 *    shared-element tab indicator, gesture springs and the breathing orb are
 *    genuinely beyond CSS and live here; fade-and-rise does not.
 *
 * 2. **Reduced motion is a first-class layout, not a degradation.** Every
 *    primitive checks `useReducedMotion()` and renders the *finished* state
 *    with no transition. Nothing fades in from invisible and stays invisible,
 *    which is the usual way this gets broken.
 *
 * 3. **Motion carries meaning or it does not ship.** Entrances orient, springs
 *    confirm a tap landed, and the breathing orb *is* the exercise. Decoration
 *    for its own sake is noise in an app someone opens at 1am.
 */

import { AnimatePresence, motion, useReducedMotion, useSpring, useTransform } from "motion/react";
import type { Transition } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** A spring that settles quickly without overshooting into bounciness. */
export const SPRING: Transition = { type: "spring", stiffness: 420, damping: 34, mass: 0.85 };
/** Softer, for larger surfaces where a fast spring reads as a jolt. */
export const SPRING_SOFT: Transition = { type: "spring", stiffness: 260, damping: 30 };
export const EASE: Transition = { duration: 0.34, ease: [0.22, 1, 0.36, 1] };

export { AnimatePresence, motion };

/* --- page entrance --------------------------------------------------------
   These are class wrappers, not motion components. See the "entrance
   animation" note in globals.css: entrances must not depend on JavaScript
   running, because the failure mode is a blank screen for someone who came
   here for help.                                                           */

/**
 * Wraps a screen. `calm` swaps the upward travel for a slow fade and is used on
 * the crisis path, where a screen that slides reads as software being pleased
 * with itself.
 */
export function Page({ children, calm = false }: { children: ReactNode; calm?: boolean }) {
  return <div className={calm ? "stack page-enter calm" : "stack page-enter"}>{children}</div>;
}

/** Children arrive in reading order. Delays come from CSS `nth-child`. */
export function Stagger({
  children,
  className = "stack",
}: {
  children: ReactNode;
  className?: string;
  /** Retained for call-site compatibility; the element is always a div. */
  as?: "div" | "section" | "ul";
}) {
  return <div className={`${className} stagger`}>{children}</div>;
}

/**
 * A passthrough wrapper. It exists so a `Stagger` child is a single element
 * (which the nth-child delays key off) and so grid children stay direct
 * children of the grid.
 */
export function Item({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

/**
 * Content that animates in where it sits. Now a plain wrapper: the lists that
 * used this are long enough that everything below the fold has finished
 * animating before it is scrolled to, so an IntersectionObserver bought
 * nothing and added a way for content to stay hidden.
 */
export function Reveal({ children }: { children: ReactNode; delay?: number }) {
  return <>{children}</>;
}

/* --- press feedback ------------------------------------------------------- */

/**
 * A spring press on tap. Deliberately subtle: 0.96, not 0.9. On a screen full
 * of choices, a big squash reads as a toy.
 */
export function Tap({
  children,
  className,
  disabled = false,
}: {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const still = useReducedMotion();
  if (still || disabled) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} whileTap={{ scale: 0.96 }} transition={SPRING}>
      {children}
    </motion.div>
  );
}

/* --- numbers and meters --------------------------------------------------- */

/** Counts up to `value`. The number is the accessible content the whole time. */
export function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const still = useReducedMotion();
  const [shown, setShown] = useState(still ? value : 0);
  const spring = useSpring(still ? value : 0, { stiffness: 90, damping: 20 });
  const rounded = useTransform(spring, (v) => Math.round(v));

  useEffect(() => {
    if (still) {
      setShown(value);
      return;
    }
    spring.set(value);
    return rounded.on("change", (v) => setShown(v as number));
  }, [value, spring, rounded, still]);

  return <span className="tabular">{shown}{suffix}</span>;
}

/**
 * An animated progress bar.
 *
 * The filled `<span>` is `aria-hidden`; the accessible value lives on the
 * wrapper as a real progressbar role, so a screen reader hears "80 percent"
 * rather than nothing at all.
 */
export function Meter({ value, label }: { value: number; label: string }) {
  const still = useReducedMotion();
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className="meter"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <motion.span
        aria-hidden="true"
        initial={{ width: still ? `${pct}%` : 0 }}
        animate={{ width: `${pct}%` }}
        transition={still ? { duration: 0 } : { type: "spring", stiffness: 60, damping: 18, delay: 0.12 }}
      />
    </div>
  );
}

/* --- swappable content ---------------------------------------------------- */

/**
 * Cross-fades between steps of a flow. `motionKey` changing triggers the swap;
 * `mode="wait"` keeps the outgoing and incoming content from overlapping, which
 * matters on a small screen where they would otherwise collide mid-transition.
 */
export function Swap({
  motionKey,
  children,
  direction = 1,
}: {
  motionKey: string;
  children: ReactNode;
  direction?: 1 | -1;
}) {
  const still = useReducedMotion();
  if (still) return <div className="stack">{children}</div>;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={motionKey}
        className="stack"
        initial={{ opacity: 0, x: 18 * direction }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -14 * direction }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/* --- one-off flourishes --------------------------------------------------- */

/**
 * A single celebratory pop, used when something is genuinely earned. Fires once
 * per mount and never loops: a looping celebration is a distraction, and this
 * app is not trying to hold anyone's attention.
 */
export function Pop({ children, play = true }: { children: ReactNode; play?: boolean }) {
  const still = useReducedMotion();
  if (still || !play) return <>{children}</>;
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 18 }}
    >
      {children}
    </motion.div>
  );
}

/** A slow, shallow breath. Used on the streak flame and nowhere busy. */
export function Pulse({ children }: { children: ReactNode }) {
  const still = useReducedMotion();
  if (still) return <>{children}</>;
  return (
    <motion.span
      style={{ display: "inline-block" }}
      animate={{ scale: [1, 1.14, 1] }}
      transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
    >
      {children}
    </motion.span>
  );
}

/** Tracks scroll through the element it is placed after. Used on lesson pages. */
export function ReadingProgress() {
  const still = useReducedMotion();
  const [pct, setPct] = useState(0);
  const raf = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        setPct(max > 0 ? Math.min(1, window.scrollY / max) : 0);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  if (still) return null;
  return <div className="reading-progress" style={{ transform: `scaleX(${pct})` }} aria-hidden="true" />;
}
