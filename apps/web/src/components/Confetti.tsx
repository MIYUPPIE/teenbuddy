"use client";

/**
 * A one-shot confetti burst, on a canvas, with no dependency.
 *
 * Used only where something is genuinely earned: an achievement unlocking, a
 * streak milestone, a challenge completed. Never on a plain page load. An app
 * that celebrates constantly is an app whose celebrations mean nothing, and
 * this one is used by people who can tell when they are being managed.
 *
 * Draws in the accent + pillar hues so it belongs to the product rather than
 * looking like a stock party effect, and it is skipped entirely under
 * `prefers-reduced-motion`.
 */

import { useEffect, useRef } from "react";

type Piece = {
  x: number; y: number; vx: number; vy: number;
  size: number; hue: number; spin: number; angle: number;
};

const HUES = [288, 330, 200, 145, 65];
const GRAVITY = 0.24;
const DRAG = 0.992;
const LIFETIME_MS = 1900;

export function Confetti({ fire, originY = 0.35 }: { fire: number; originY?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  // `fire` is a counter, not a boolean: re-earning something must re-trigger,
  // and a boolean that is already true cannot.
  const lastFired = useRef(0);

  useEffect(() => {
    if (fire === 0 || fire === lastFired.current) return;
    lastFired.current = fire;

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    el.width = width * dpr;
    el.height = height * dpr;
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    const pieces: Piece[] = Array.from({ length: 90 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 7;
      return {
        x: width / 2,
        y: height * originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        size: 5 + Math.random() * 6,
        hue: HUES[Math.floor(Math.random() * HUES.length)]!,
        spin: (Math.random() - 0.5) * 0.3,
        angle: Math.random() * Math.PI,
      };
    });

    const started = performance.now();
    let frame = 0;

    const draw = (now: number) => {
      const elapsed = now - started;
      const fade = Math.max(0, 1 - elapsed / LIFETIME_MS);
      ctx.clearRect(0, 0, width, height);

      for (const p of pieces) {
        p.vy += GRAVITY;
        p.vx *= DRAG;
        p.vy *= DRAG;
        p.x += p.vx;
        p.y += p.vy;
        p.angle += p.spin;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.globalAlpha = fade;
        ctx.fillStyle = `oklch(66% 0.2 ${p.hue})`;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }

      if (elapsed < LIFETIME_MS) {
        frame = requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [fire, originY]);

  return <canvas ref={canvas} className="confetti-layer" aria-hidden="true" />;
}
