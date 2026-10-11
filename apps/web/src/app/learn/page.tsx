"use client";

import Link from "next/link";
import { LESSON_CATEGORY_LABELS } from "@teenbuddy/contracts";
import { lessonsGrouped } from "@teenbuddy/content";
import { useStore } from "../../lib/store.tsx";
import { Page, Reveal } from "../../components/motion.tsx";
import { Pressable } from "../../components/Pressable.tsx";
import { Ring } from "../../components/Ring.tsx";
import { CATEGORY_HUE, hue } from "../../lib/palette.ts";

export default function LearnPage() {
  const { records } = useStore();
  const done = new Set(records.lessons.map((l) => l.lessonSlug));
  const groups = lessonsGrouped();
  const total = groups.reduce((n, g) => n + g.lessons.length, 0);
  const readCount = groups.reduce(
    (n, g) => n + g.lessons.filter((l) => done.has(l.slug)).length,
    0,
  );

  return (
    <Page>
      <header>
        <h1>Learn</h1>
        <p className="muted" style={{ marginTop: 4 }}>
          Short things worth knowing. Two minutes each, not twenty.
        </p>
      </header>

      {/* One ring per category, so a teen can see which corners of the library
          they have never opened without reading a single label. */}
      <div className="card">
        <div className="spread" style={{ marginBottom: 14 }}>
          <span style={{ fontWeight: 600 }}>Your progress</span>
          <span className="muted tabular">{readCount} of {total}</span>
        </div>
        <div className="grid" style={{ gridTemplateColumns: `repeat(${groups.length}, 1fr)` }}>
          {groups.map(({ category, lessons }) => {
            const read = lessons.filter((l) => done.has(l.slug)).length;
            return (
              <div key={category} style={{ ...hue(CATEGORY_HUE[category]), textAlign: "center" }}>
                <Ring
                  size={54}
                  stroke={6}
                  value={lessons.length ? (read / lessons.length) * 100 : 0}
                  label={`${LESSON_CATEGORY_LABELS[category].label}: ${read} of ${lessons.length} read`}
                  emoji={LESSON_CATEGORY_LABELS[category].emoji}
                />
                <div className="muted tabular" style={{ fontSize: "0.68rem", marginTop: 4 }}>
                  {read}/{lessons.length}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sections reveal on scroll rather than all at once, so a 25-item list
          does not arrive as a single wall of movement. */}
      {groups.map(({ category, lessons }) => (
        <section key={category} style={hue(CATEGORY_HUE[category])}>
          <h2 className="tinted-fg">
            <span aria-hidden="true">{LESSON_CATEGORY_LABELS[category].emoji}</span>{" "}
            {LESSON_CATEGORY_LABELS[category].label}
          </h2>
          <div className="stack">
            {lessons.map((lesson, i) => (
              <Reveal key={lesson.slug} delay={Math.min(i * 0.04, 0.16)}>
                <Pressable className="card card-link" href={`/learn/${lesson.slug}`}>
                  <div className="spread" style={{ marginBottom: 6 }}>
                    <strong>{lesson.title}</strong>
                    <span className={done.has(lesson.slug) ? "pill done" : "pill tinted tinted-fg"}>
                      {done.has(lesson.slug) ? "✓ Read" : `${lesson.minutes} min`}
                    </span>
                  </div>
                  <p className="muted" style={{ margin: 0 }}>{lesson.hook}</p>
                </Pressable>
              </Reveal>
            ))}
          </div>
        </section>
      ))}
    </Page>
  );
}
