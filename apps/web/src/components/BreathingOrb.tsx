"use client";

/**
 * The 4-4-6 breathing guide.
 *
 * This is the one place in the app where the animation *is* the feature rather
 * than decoration. Someone mid-panic cannot reliably count seconds, so the orb
 * counts for them: it expands for four, holds for four, and contracts for six,
 * and the contraction is visibly the longest phase because the long out-breath
 * is what actually calms the nervous system.
 *
 * The scale transition duration is driven from the phase table, not hardcoded
 * in CSS, so the ring and the number can never drift apart.
 *
 * Under `prefers-reduced-motion` the orb holds still and the countdown alone
 * carries the exercise, which works: the numbers were always the instruction.
 */

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

type Phase = { name: string; seconds: number; scale: number };

const PHASES: readonly Phase[] = [
  { name: "Breathe in", seconds: 4, scale: 1 },
  { name: "Hold", seconds: 4, scale: 1 },
  { name: "Breathe out", seconds: 6, scale: 0.6 },
];

const CYCLES = 3;

export function BreathingOrb({ onComplete }: { onComplete?: () => void }) {
  const still = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(PHASES[0]!.seconds);
  const [running, setRunning] = useState(true);
  const [done, setDone] = useState(false);
  const completed = useRef(false);

  const phase = PHASES[index % PHASES.length]!;
  const cycle = Math.floor(index / PHASES.length);

  useEffect(() => {
    if (!running || done) return;
    const timer = setInterval(() => {
      setRemaining((left) => {
        if (left > 1) return left - 1;
        setIndex((current) => {
          const next = current + 1;
          if (next >= PHASES.length * CYCLES) {
            setDone(true);
            setRunning(false);
            return current;
          }
          return next;
        });
        return PHASES[(index + 1) % PHASES.length]!.seconds;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [running, done, index]);

  useEffect(() => {
    if (done && !completed.current) {
      completed.current = true;
      onComplete?.();
    }
  }, [done, onComplete]);

  return (
    <div className="stack" style={{ alignItems: "center" }}>
      <div className="breath">
        <motion.div
          className="breath-orb"
          aria-hidden="true"
          animate={still ? undefined : { scale: done ? 0.82 : phase.scale }}
          transition={
            still
              ? { duration: 0 }
              : { duration: done ? 1 : phase.seconds, ease: phase.name === "Hold" ? "linear" : "easeInOut" }
          }
          initial={{ scale: 0.6 }}
        />
        <div className="breath-count">
          {/* One live region for the whole exercise: a screen reader hears the
              phase change, not a stream of individual second announcements. */}
          <div className="phase" aria-live="polite">{done ? "Done" : phase.name}</div>
          {!done && (
            <div className="secs" aria-hidden="true">
              {remaining}
            </div>
          )}
        </div>
      </div>

      {/* Round count and the pause control share a row: two stacked blocks cost
          ~40px of height, which is the difference between this exercise fitting
          a 640px phone and needing to scroll. */}
      <div className="row" style={{ justifyContent: "center", gap: "var(--sp-3)" }}>
        <p className="muted" style={{ margin: 0 }} aria-hidden="true">
          {done ? `${CYCLES} rounds finished` : `Round ${cycle + 1} of ${CYCLES}`}
        </p>
        {!done && (
          <button className="btn btn-ghost btn-sm" onClick={() => setRunning((r) => !r)}>
            {running ? "Pause" : "Resume"}
          </button>
        )}
      </div>
    </div>
  );
}
