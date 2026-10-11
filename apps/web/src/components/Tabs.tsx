"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";

/** The six screens from the spec. Nothing else gets a tab. */
const TABS = [
  { href: "/", icon: "🏠", label: "Home" },
  { href: "/check-in", icon: "❤️", label: "Check-in" },
  { href: "/help", icon: "🆘", label: "Help" },
  { href: "/learn", icon: "📚", label: "Learn" },
  { href: "/journal", icon: "📓", label: "Journal" },
  { href: "/profile", icon: "👤", label: "Profile" },
] as const;

export function Tabs() {
  const pathname = usePathname();
  const still = useReducedMotion();

  return (
    <nav className="tabs" aria-label="Main">
      {TABS.map((tab) => {
        const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
          <Link key={tab.href} href={tab.href} aria-current={active ? "page" : undefined}>
            {/* A single shared element slides between tabs rather than six
                elements fading in and out, so the eye tracks one object. */}
            {active && !still && (
              <motion.span
                layoutId="tab-indicator"
                aria-hidden="true"
                transition={{ type: "spring", stiffness: 480, damping: 38 }}
                style={{
                  position: "absolute",
                  inset: "6px 10px",
                  borderRadius: "var(--radius)",
                  background: "var(--accent-soft)",
                  zIndex: 0,
                }}
              />
            )}
            <motion.span
              className="icon"
              aria-hidden="true"
              style={{ zIndex: 1 }}
              animate={still ? undefined : { y: active ? -1 : 0, scale: active ? 1.08 : 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              {tab.icon}
            </motion.span>
            <span style={{ zIndex: 1 }}>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
