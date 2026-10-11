"use client";

/**
 * Check-in: mood, then cause, then a short reflection.
 *
 * The order matters. Asking "what caused it" before the mood is named makes
 * people rationalise; asking after gives a feeling a shape.
 *
 * The three steps swap rather than stack, so the screen never shows a wall of
 * unanswered questions. A teen who is struggling to answer the first one should
 * not be able to see the other two.
 */

import { useState } from "react";
import Link from "next/link";
import {
  CAUSES, CAUSE_LABELS, MOODS, MOOD_LABELS, type Cause, type Mood,
} from "@teenbuddy/contracts";
import { useStore } from "../../lib/store.tsx";
import { ErrorNote, Loading } from "../../components/ui.tsx";
import { Item, Page, Pop, Stagger, Swap, motion } from "../../components/motion.tsx";
import { Pressable } from "../../components/Pressable.tsx";
import { Confetti } from "../../components/Confetti.tsx";
import { CAUSE_HUE, MOOD_HUE, hue } from "../../lib/palette.ts";

export default function CheckInPage() {
  const { ready, progress, records, addMood, error } = useStore();
  const [mood, setMood] = useState<Mood | null>(null);
  const [causes, setCauses] = useState<Cause[]>([]);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const [celebrate, setCelebrate] = useState(0);

  if (!ready || !progress) return <Loading />;

  const alreadyToday = progress.checkedInToday;
  const todaysMood = records.moods.find((m) => m.localDate === progress.today);

  function toggleCause(cause: Cause) {
    setCauses((current) => {
      if (current.includes(cause)) return current.filter((c) => c !== cause);
      // The schema forbids mixing "don't know" with a specific cause, so the UI
      // makes that unreachable rather than letting a save fail.
      if (cause === "dont_know") return ["dont_know"];
      const rest = current.filter((c) => c !== "dont_know");
      return rest.length >= 5 ? rest : [...rest, cause];
    });
  }

  const needsNote = causes.includes("other") && note.trim().length === 0;
  const canSave = mood !== null && causes.length > 0 && !needsNote;

  async function save() {
    if (!mood || !canSave) return;
    await addMood({ mood, causes, ...(note.trim() ? { note: note.trim() } : {}) });
    setCelebrate((n) => n + 1);
    setSaved(true);
  }

  if (saved || (alreadyToday && !mood)) {
    return (
      <Page>
        <Confetti fire={celebrate} originY={0.28} />
        <Pop>
          <div
            className="card tinted"
            style={{ ...(todaysMood ? hue(MOOD_HUE[todaysMood.mood]) : {}), textAlign: "center", paddingBlock: "var(--sp-6)" }}
          >
            <motion.div
              aria-hidden="true"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 16, delay: 0.06 }}
              style={{ fontSize: "2.6rem", lineHeight: 1 }}
            >
              {todaysMood ? MOOD_LABELS[todaysMood.mood].emoji : "✓"}
            </motion.div>
            <h1 style={{ marginTop: 14 }}>Checked in</h1>
            {todaysMood && (
              <p className="muted" style={{ marginTop: 6, marginBottom: 0 }}>
                You felt {MOOD_LABELS[todaysMood.mood].label.toLowerCase()} ·{" "}
                {todaysMood.causes.map((c) => CAUSE_LABELS[c]).join(", ")}
              </p>
            )}
          </div>
        </Pop>

        <div className="card quiet">
          <p style={{ margin: 0 }}>
            One check-in a day is enough. Noticing how you feel is the whole point,
            not doing it repeatedly.
          </p>
        </div>

        <div className="row">
          <Pressable className="btn" href="/journal">Write more</Pressable>
          <Pressable className="btn" href="/">Home</Pressable>
        </div>
      </Page>
    );
  }

  const step = mood === null ? "mood" : "cause";

  return (
    <Page>
      <ErrorNote message={error} />

      <Swap motionKey={step}>
        {step === "mood" ? (
          <>
            <header>
              <h1>How are you feeling?</h1>
              <p className="muted" style={{ marginTop: 4 }}>
                There&apos;s no right answer. Pick the closest one.
              </p>
            </header>

            <Stagger className="grid four">
              {MOODS.map((m) => (
                <Item key={m}>
                  <div style={hue(MOOD_HUE[m])}>
                    <Pressable
                      className="mood-btn"
                      style={{ width: "100%" }}
                      haptic="select"
                      onClick={() => setMood(m)}
                    >
                      <motion.span
                        className="emoji"
                        aria-hidden="true"
                        whileHover={{ scale: 1.2, rotate: -7 }}
                        transition={{ type: "spring", stiffness: 420, damping: 13 }}
                      >
                        {MOOD_LABELS[m].emoji}
                      </motion.span>
                      <span className="label">{MOOD_LABELS[m].label}</span>
                    </Pressable>
                  </div>
                </Item>
              ))}
            </Stagger>
          </>
        ) : (
          <>
            <header>
              <div className="spread">
                <h1>What caused it?</h1>
                <Pressable
                  className="btn btn-ghost btn-sm"
                  onClick={() => { setMood(null); setCauses([]); setNote(""); }}
                >
                  ← Change
                </Pressable>
              </div>
              <p className="muted" style={{ marginTop: 4 }}>
                <span aria-hidden="true">{mood && MOOD_LABELS[mood].emoji}</span>{" "}
                Feeling {mood && MOOD_LABELS[mood].label.toLowerCase()}. Pick anything that fits.
              </p>
            </header>

            <motion.div layout className="row" role="group" aria-label="Causes">
              {CAUSES.map((c) => (
                <motion.div key={c} layout style={hue(CAUSE_HUE[c])}>
                  <Pressable
                    className="btn chip"
                    haptic="select"
                    aria-pressed={causes.includes(c)}
                    onClick={() => toggleCause(c)}
                  >
                    {CAUSE_LABELS[c]}
                  </Pressable>
                </motion.div>
              ))}
            </motion.div>

            <motion.div
              layout
              transition={{ type: "spring", stiffness: 340, damping: 32 }}
              className="stack"
            >
              {causes.length > 0 && (
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={causes.includes("other") ? 2 : 3}
                  maxLength={500}
                  placeholder={
                    causes.includes("other") ? "What was it?" : "Anything you want to add? (optional)"
                  }
                  aria-label={causes.includes("other") ? "What was it?" : "Anything you want to add"}
                />
              )}

              <Pressable
                className="btn tinted-grad block"
                style={mood ? hue(MOOD_HUE[mood]) : undefined}
                disabled={!canSave}
                haptic="success"
                onClick={() => void save()}
              >
                Save check-in
              </Pressable>

              {needsNote && <p className="muted">Add a word or two about what it was.</p>}
            </motion.div>
          </>
        )}
      </Swap>
    </Page>
  );
}
