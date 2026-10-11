/**
 * Day / night / auto.
 *
 * The whole theme is one CSS property. Every colour token is declared once as
 * `light-dark(day, night)` and resolves off `color-scheme` on `:root`, so
 * switching themes changes a single declaration and the two palettes cannot
 * drift apart the way parallel `@media` blocks do.
 *
 *   (nothing)            -> color-scheme: light dark  -> follows the device
 *   data-theme="light"   -> color-scheme: light
 *   data-theme="dark"    -> color-scheme: dark
 */

export const THEMES = ["light", "dark", "auto"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_KEY = "teenbuddy:v1:theme";

export const THEME_LABELS: Record<Theme, { emoji: string; label: string; hint: string }> = {
  light: { emoji: "☀️", label: "Day", hint: "Always light" },
  dark: { emoji: "🌙", label: "Night", hint: "Always dark" },
  auto: { emoji: "📱", label: "Auto", hint: "Follow my device" },
};

/**
 * The browser-chrome colour for each theme. These are the sRGB values `--bg`
 * actually resolves to (oklch(98.4% .003 90) and oklch(15.5% .008 265)),
 * measured rather than eyeballed, so the status bar matches the page exactly.
 */
export const THEME_COLOR = { light: "#fafaf7", dark: "#0b0c10" } as const;

export const isTheme = (value: unknown): value is Theme =>
  typeof value === "string" && (THEMES as readonly string[]).includes(value);

export function readTheme(): Theme {
  if (typeof localStorage === "undefined") return "auto";
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return isTheme(stored) ? stored : "auto";
  } catch {
    return "auto";
  }
}

/** What `auto` currently resolves to. */
export function systemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export const resolveTheme = (theme: Theme): "light" | "dark" =>
  theme === "auto" ? systemTheme() : theme;

/**
 * Applies a theme to the document.
 *
 * `auto` removes the attribute rather than writing "auto", so the CSS falls
 * back to `color-scheme: light dark` and the device decides - including when
 * the device flips at sunset while the app is open.
 */
export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  if (theme === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);

  // Keeps the browser chrome (status bar, address bar) in step with the page.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLOR[resolveTheme(theme)]);
}

export function writeTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Private window or storage disabled. The theme still applies for this
    // session; it just will not be remembered.
  }
}

/**
 * Runs before first paint, inlined into <head>.
 *
 * Without this the server sends no `data-theme`, so a teen who chose Night
 * gets a full-brightness white flash before hydration swaps it - at 1am, which
 * is exactly when this app gets opened. Kept to one statement and wrapped in
 * try/catch, because a throw here would block the whole page.
 */
export const THEME_SCRIPT = [
  "try{",
  `var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});`,
  'if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}',
  "else{t=matchMedia(\"(prefers-color-scheme: dark)\").matches?\"dark\":\"light\"}",
  // The attribute alone leaves the status bar on the previous theme until the
  // user next touches the control, so the meta tag is set here as well.
  'var m=document.querySelector(\'meta[name="theme-color"]\');',
  `if(m){m.setAttribute("content",t==="dark"?${JSON.stringify(THEME_COLOR.dark)}:${JSON.stringify(THEME_COLOR.light)})}`,
  "}catch(e){}",
].join("");
