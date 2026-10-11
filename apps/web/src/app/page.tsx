"use client";

/**
 * Home.
 *
 * The spec says "Don't overload the screen", and that still governs the
 * layout. What changed is response: every control here does something the
 * moment it is touched - a ripple from the finger, a spring, a buzz, and for
 * anything actually earned, a burst of confetti.
 */

import { useState } from "react";
import Link from "next/link";
import { MOODS, MOOD_LABELS, type Mood } from "@teenbuddy/contracts";
import { dailyChallenge, dailyLesson } from "@teenbuddy/content";
import { useStore } from "../lib/store.tsx";
import { ErrorNote, GrowthBars, Loading, greeting } from "../components/ui.tsx";
import { AnimatePresence, Item, Pop, Pulse, Stagger, motion } from "../components/motion.tsx";
import { Pressable } from "../components/Pressable.tsx";
import { Confetti } from "../components/Confetti.tsx";
import { CATEGORY_HUE, MOOD_HUE, PILLAR_HUE, hue } from "../lib/palette.ts";

export default function HomePage() {
  const { ready, profile, progress, records, error, addMood, completeChallenge } = useStore();
  const [preview, setPreview] = useState<Mood | null>(null);
  const [celebrate, setCelebrate] = useState(0);

  if (!ready || !profile || !progress) return <Loading />;

  const today = progress.today;
  const challenge = dailyChallenge(today);
  const lesson = dailyLesson(today);
  const challengeDone = records.challenges.some((c) => c.localDate === today);
  const name = profile.displayName === "there" ? "" : `, ${profile.displayName}`;
  const streak = progress.snapshot.streakDays;

  return (
    <>
      <Confetti fire={celebrate} />
      <Stagger>
        <Item>
          <header>
            <h1>
              {greeting()}
              {name} <span aria-hidden="true">👋</span>
            </h1>
            <p className="muted" style={{ marginTop: 4 }}>
              {progress.checkedInToday
                ? "You've checked in today. Nothing else is required of you."
                : "How are you feeling today?"}
            </p>
          </header>
        </Item>

        {error && <Item><ErrorNote message={error} /></Item>}

        {/* Hovering or focusing a mood tints the whole card toward it, so the
            choice is felt before it is committed. */}
        <AnimatePresence initial={false}>
          {!progress.checkedInToday && (
            <motion.div
              key="quick-mood"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              style={{ overflow: "hidden" }}
            >
              <div
                className={`card mood-surface${preview ? " active" : ""}`}
                style={preview ? hue(MOOD_HUE[preview]) : undefined}
              >
                <div className="grid four" role="group" aria-label="Quick mood check-in">
                  {MOODS.slice(0, 4).map((mood) => (
                    <div key={mood} style={hue(MOOD_HUE[mood])}>
                      <Pressable
                        className="mood-btn"
                        style={{ width: "100%" }}
                        haptic="select"
                        onClick={() => { setPreview(mood); void addMood({ mood, causes: ["dont_know"] }); }}
                      >
                        <motion.span
                          className="emoji"
                          aria-hidden="true"
                          whileHover={{ scale: 1.18, rotate: -6 }}
                          transition={{ type: "spring", stiffness: 420, damping: 14 }}
                        >
                          {MOOD_LABELS[mood].emoji}
                        </motion.span>
                        <span className="label">{MOOD_LABELS[mood].label}</span>
                      </Pressable>
                    </div>
                  ))}
                </div>
                <p className="muted" style={{ marginTop: 14, marginBottom: 0 }}>
                  <Link href="/check-in">Say more about it →</Link>
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Item>
          <div className="card">
            <div className="spread" style={{ marginBottom: 16 }}>
              <h3>Today&apos;s progress</h3>
              <Pop>
                <span className="pill flame" aria-label={`${streak} day streak`}>
                  <Pulse><span aria-hidden="true">🔥</span></Pulse>
                  {streak} day{streak === 1 ? "" : "s"}
                </span>
              </Pop>
            </div>

            <GrowthBars growth={progress.snapshot.growth} />

            {progress.snapshot.streakAtRisk && (
              <p className="muted" style={{ marginTop: 14, marginBottom: 0 }}>
                Your streak is still going. A check-in today keeps it.
              </p>
            )}
          </div>
        </Item>

        {profile.goal && (
          <Item>
            <div className="card tinted" style={hue(65)}>
              <h3 className="tinted-fg" style={{ marginBottom: 6 }}>
                <span aria-hidden="true">🎯</span> Today&apos;s goal
              </h3>
              <p style={{ margin: 0, fontSize: "var(--step-1)" }}>&ldquo;{profile.goal}&rdquo;</p>
            </div>
          </Item>
        )}

        <Item>
          <div className="card" style={hue(PILLAR_HUE[challenge.pillar])}>
            <div className="spread" style={{ marginBottom: 8 }}>
              <h3><span aria-hidden="true">🎯</span> Today&apos;s challenge</h3>
              <AnimatePresence>
                {challengeDone && <Pop><span className="pill done">✓ Done</span></Pop>}
              </AnimatePresence>
            </div>
            <p style={{ fontSize: "var(--step-1)", marginBottom: 6 }}>{challenge.prompt}</p>
            <p className="muted" style={{ marginBottom: 14 }}>{challenge.why}</p>
            <Pressable
              className={challengeDone ? "btn block" : "btn tinted-grad block"}
              disabled={challengeDone}
              haptic="success"
              onClick={() => { void completeChallenge(challenge.id); setCelebrate((n) => n + 1); }}
            >
              {challengeDone ? "Done today" : `Mark done · ${challenge.minutes} min`}
            </Pressable>
          </div>
        </Item>

        <Item>
          <Pressable
            className="card card-link"
            style={hue(CATEGORY_HUE[lesson.category])}
            href={`/learn/${lesson.slug}`}
          >
            <div className="spread" style={{ marginBottom: 8, width: "100%" }}>
              <h3><span aria-hidden="true">📖</span> Today&apos;s lesson</h3>
              <span className="pill tinted tinted-fg">{lesson.minutes} min</span>
            </div>
            <p style={{ fontSize: "var(--step-1)", marginBottom: 6, width: "100%" }}>{lesson.title}</p>
            <p className="muted" style={{ margin: 0, width: "100%" }}>{lesson.hook}</p>
          </Pressable>
        </Item>

        <Item>
          <Pressable className="btn btn-urgent" href="/help" haptic="warn">
            <span aria-hidden="true">🆘</span> I need help now
          </Pressable>
        </Item>
      </Stagger>
    </>
  );
}
