import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  THEMES, THEME_COLOR, THEME_KEY, THEME_LABELS, THEME_SCRIPT,
  isTheme, resolveTheme,
} from "../src/lib/theme.ts";

describe("theme vocabulary", () => {
  test("three options, and auto is one of them", () => {
    assert.deepEqual([...THEMES], ["light", "dark", "auto"]);
  });

  test("every option has a label and a hint", () => {
    for (const t of THEMES) {
      assert.ok(THEME_LABELS[t].label.length > 0, t);
      assert.ok(THEME_LABELS[t].hint.length > 0, t);
      assert.ok(THEME_LABELS[t].emoji.length > 0, t);
    }
  });

  test("isTheme rejects anything that is not one of the three", () => {
    for (const t of THEMES) assert.equal(isTheme(t), true, t);
    for (const bad of ["Light", "system", "", null, undefined, 1, {}])
      assert.equal(isTheme(bad), false, JSON.stringify(bad));
  });

  test("an explicit theme resolves to itself", () => {
    assert.equal(resolveTheme("light"), "light");
    assert.equal(resolveTheme("dark"), "dark");
  });
});

describe("the no-flash inline script", () => {
  test("is valid JavaScript", () => {
    assert.doesNotThrow(() => new Function(THEME_SCRIPT));
  });

  test("is wrapped in try/catch, so it can never block the page", () => {
    assert.match(THEME_SCRIPT, /^try\{/);
    assert.match(THEME_SCRIPT, /\}catch\(e\)\{\}$/);
  });

  test("reads the same storage key the app writes", () => {
    assert.ok(THEME_SCRIPT.includes(JSON.stringify(THEME_KEY)));
  });

  test("only ever writes a valid theme attribute", () => {
    // A typo here means a stored theme silently stops applying.
    assert.match(THEME_SCRIPT, /"light"\|\|t==="dark"/);
    assert.match(THEME_SCRIPT, /setAttribute\("data-theme",t\)/);
  });

  test("sets the browser-chrome colour as well as the attribute", () => {
    // Without this a stored Night theme reloads with a light status bar.
    assert.ok(THEME_SCRIPT.includes('meta[name="theme-color"]'));
    assert.ok(THEME_SCRIPT.includes(JSON.stringify(THEME_COLOR.dark)));
    assert.ok(THEME_SCRIPT.includes(JSON.stringify(THEME_COLOR.light)));
  });

  test("stays small enough to inline without cost", () => {
    assert.ok(THEME_SCRIPT.length < 600, `${THEME_SCRIPT.length} bytes is too much for <head>`);
  });

  test("contains no closing script tag that would break out of <script>", () => {
    assert.equal(/<\/script/i.test(THEME_SCRIPT), false);
  });
});

describe("theme colours", () => {
  test("are concrete sRGB hex, matching --bg in each theme", () => {
    // Measured from the rendered page, not eyeballed. If --bg changes these
    // must change with it, or the status bar will not match the page.
    assert.match(THEME_COLOR.light, /^#[0-9a-f]{6}$/);
    assert.match(THEME_COLOR.dark, /^#[0-9a-f]{6}$/);
    assert.notEqual(THEME_COLOR.light, THEME_COLOR.dark);
  });

  test("light is actually light and dark is actually dark", () => {
    const luma = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    assert.ok(luma(THEME_COLOR.light) > 0.8, "light theme colour is not light");
    assert.ok(luma(THEME_COLOR.dark) < 0.15, "dark theme colour is not dark");
  });
});
