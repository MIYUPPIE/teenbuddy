"use client";

import { PILLARS, PILLAR_LABELS, type Growth } from "@teenbuddy/contracts";
import { CountUp, Item, Stagger } from "./motion.tsx";
import { Ring } from "./Ring.tsx";
import { PILLAR_HUE, hue } from "../lib/palette.ts";

/**
 * Four rings, one per pillar, each in its own colour.
 *
 * Rings rather than bars: four of them in a row are comparable at a glance, and
 * a ring carries its pillar's colour as a whole shape instead of a thin stripe.
 */
export function GrowthBars({ growth }: { growth: Growth }) {
  return (
    <Stagger className="grid four">
      {PILLARS.map((pillar) => (
        <Item key={pillar}>
          <div style={{ ...hue(PILLAR_HUE[pillar]), textAlign: "center" }}>
            <Ring
              value={growth[pillar]}
              label={PILLAR_LABELS[pillar].label}
              emoji={PILLAR_LABELS[pillar].emoji}
            />
            <div style={{ fontSize: "0.72rem", fontWeight: 600, marginTop: 6 }}>
              {PILLAR_LABELS[pillar].label}
            </div>
            <div className="muted tabular" style={{ fontSize: "0.7rem" }} aria-hidden="true">
              <CountUp value={growth[pillar]} suffix="%" />
            </div>
          </div>
        </Item>
      ))}
    </Stagger>
  );
}

/** Shimmer placeholders shaped like the content they replace, so nothing jumps. */
export function Loading() {
  return (
    <div className="stack" aria-busy="true" aria-live="polite">
      <span style={{ position: "absolute", left: -9999 }}>Loading</span>
      <div className="skeleton" style={{ height: 34, width: "58%" }} />
      <div className="skeleton" style={{ height: 132, borderRadius: "var(--radius-md)" }} />
      <div className="skeleton" style={{ height: 168, borderRadius: "var(--radius-md)" }} />
      <div className="skeleton" style={{ height: 108, borderRadius: "var(--radius-md)" }} />
    </div>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="err" role="alert">{message}</p>;
}

/** The greeting from the spec: time-aware, no name required. */
export function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
