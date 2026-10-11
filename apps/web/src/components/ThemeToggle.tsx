"use client";

/**
 * The day/night switch: a three-way segmented control with a sliding indicator.
 *
 * `auto` is offered and is the default, because a teenager who has set their
 * whole phone to dark should not have to set this app separately. The other two
 * exist because plenty of people want this one app to differ.
 */

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { THEMES, THEME_LABELS, applyTheme, readTheme, writeTheme, type Theme } from "../lib/theme.ts";
import { buzz } from "../lib/haptics.ts";

export function ThemeToggle() {
  const still = useReducedMotion();
  // Starts at the server-rendered default and corrects on mount. Reading
  // localStorage during render would mismatch the server HTML and warn.
  const [theme, setTheme] = useState<Theme>("auto");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readTheme();
    setTheme(stored);
    // Re-apply on mount as well as in the inline script: belt and braces for
    // the case where the script is blocked by a strict CSP.
    applyTheme(stored);
    setReady(true);
  }, []);

  // While on `auto`, follow the device if it flips at sunset mid-session.
  useEffect(() => {
    if (theme !== "auto" || typeof window === "undefined") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => applyTheme("auto");
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [theme]);

  function choose(next: Theme) {
    buzz("select");
    setTheme(next);
    applyTheme(next);
    writeTheme(next);
  }

  return (
    <div className="card">
      <h3 style={{ marginBottom: 4 }}>
        <span aria-hidden="true">🌗</span> Day or night
      </h3>
      <p className="muted" style={{ marginBottom: 14 }}>
        {THEME_LABELS[theme].hint}.
      </p>

      <div className="segmented" role="radiogroup" aria-label="Colour theme">
        {THEMES.map((option) => {
          const active = ready && theme === option;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={active}
              className="segment"
              onClick={() => choose(option)}
            >
              {active && !still && (
                <motion.span
                  layoutId="theme-indicator"
                  className="segment-indicator"
                  aria-hidden="true"
                  transition={{ type: "spring", stiffness: 480, damping: 38 }}
                />
              )}
              {active && still && <span className="segment-indicator" aria-hidden="true" />}
              <span className="segment-label">
                <span aria-hidden="true">{THEME_LABELS[option].emoji}</span>
                {THEME_LABELS[option].label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
