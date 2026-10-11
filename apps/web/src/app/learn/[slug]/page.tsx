"use client";

import { use, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HELP_TOPIC_LABELS, LESSON_CATEGORY_LABELS } from "@teenbuddy/contracts";
import { lessonBySlug } from "@teenbuddy/content";
import { useStore } from "../../../lib/store.tsx";
import { Page, Pop, ReadingProgress, Reveal } from "../../../components/motion.tsx";
import { Pressable } from "../../../components/Pressable.tsx";
import { Confetti } from "../../../components/Confetti.tsx";
import { CATEGORY_HUE, hue } from "../../../lib/palette.ts";

export default function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { records, completeLesson } = useStore();
  const lesson = lessonBySlug(slug);
  const [celebrate, setCelebrate] = useState(0);

  if (!lesson) notFound();

  const done = records.lessons.some((l) => l.lessonSlug === lesson.slug);

  return (
    <>
      <ReadingProgress />
      <Confetti fire={celebrate} originY={0.5} />
      <Page>
        <div style={hue(CATEGORY_HUE[lesson.category])} className="stack">
        <header>
          <p className="muted tinted-fg" style={{ marginBottom: 6 }}>
            <span aria-hidden="true">{LESSON_CATEGORY_LABELS[lesson.category].emoji}</span>{" "}
            {LESSON_CATEGORY_LABELS[lesson.category].label} · {lesson.minutes} min read
          </p>
          <h1>{lesson.title}</h1>
        </header>

        {/* The hook is set larger than the body: it is the sentence that decides
            whether a teenager reads the rest. */}
        <p style={{ fontSize: "var(--step-2)", lineHeight: 1.4, letterSpacing: "-0.018em" }}>
          {lesson.hook}
        </p>

        <hr className="divider" />

        <article className="stack">
          {lesson.body.map((paragraph, i) => (
            <Reveal key={paragraph.slice(0, 40)} delay={Math.min(i * 0.05, 0.2)}>
              <p style={{ fontSize: "var(--step-1)", lineHeight: 1.68, margin: 0 }}>{paragraph}</p>
            </Reveal>
          ))}
        </article>

        <Reveal>
          <div className="card tinted">
            <h3 className="tinted-fg" style={{ marginBottom: 6 }}>Take this away</h3>
            <p style={{ margin: 0, fontSize: "var(--step-1)" }}>{lesson.takeaway}</p>
          </div>
        </Reveal>

        <Pressable
          className={done ? "btn block" : "btn tinted-grad block"}
          disabled={done}
          haptic="success"
          onClick={() => { void completeLesson(lesson.slug); setCelebrate((n) => n + 1); }}
        >
          {done ? <Pop>✓ Read</Pop> : "Mark as read"}
        </Pressable>

        {lesson.relatedTopics.length > 0 && (
          <p className="muted">
            Struggling with this right now?{" "}
            <Link href="/help">
              Help with{" "}
              {lesson.relatedTopics.map((t) => HELP_TOPIC_LABELS[t].label.toLowerCase()).join(", ")}
            </Link>
          </p>
        )}

        <Pressable className="btn btn-ghost" href="/learn">← All lessons</Pressable>
        </div>
      </Page>
    </>
  );
}
