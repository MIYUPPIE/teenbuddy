import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { composite, contrast, contrast255, toHex, toSrgb255 } from "../src/lib/oklch.ts";
import { CATEGORY_HUE, CAUSE_HUE, MOOD_HUE, PILLAR_HUE, topicHue } from "../src/lib/palette.ts";
import { HELP_TOPICS } from "@teenbuddy/contracts";

const AA = 4.5;

/** Every hue the app can actually put on screen. */
const ALL_HUES = [
  ...Object.values(MOOD_HUE),
  ...Object.values(CAUSE_HUE),
  ...Object.values(PILLAR_HUE),
  ...Object.values(CATEGORY_HUE),
  ...HELP_TOPICS.map(topicHue).filter((h): h is number => h !== null),
  288, // the accent
];

describe("the converter is correct", () => {
  test("reproduces values measured from a real browser", () => {
    // Both sampled from the rendered page with a canvas readback.
    assert.equal(toHex(0.984, 0.003, 90), "#fafaf7", "--bg in day mode");
    assert.equal(toHex(0.155, 0.008, 265), "#0b0c10", "--bg in night mode");
  });

  test("black on white is the textbook 21:1", () => {
    const ratio = contrast([0, 0, 0], [1, 0, 0]);
    assert.ok(Math.abs(ratio - 21) < 0.1, `got ${ratio.toFixed(2)}`);
  });
});

/**
 * These numbers are read out of globals.css rather than duplicated here, so the
 * test cannot pass while the stylesheet says something else.
 */
function tintLightness(): { dayFill: number[]; nightFill: number[]; dayChroma: number; nightChroma: number } {
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const grad = /--tint-grad: light-dark\(([\s\S]*?)\n\s*\);/.exec(css);
  assert.ok(grad, "could not find --tint-grad in globals.css");
  const stops = [...grad[1]!.matchAll(/oklch\(([\d.]+)%?\s+([\d.]+)\s/g)].map((m) => ({
    L: Number(m[1]!) > 1 ? Number(m[1]!) / 100 : Number(m[1]!),
    C: Number(m[2]!),
  }));
  assert.equal(stops.length, 4, "expected two stops per theme");
  return {
    dayFill: [stops[0]!.L, stops[1]!.L],
    nightFill: [stops[2]!.L, stops[3]!.L],
    dayChroma: stops[0]!.C,
    nightChroma: stops[2]!.C,
  };
}

describe("a tinted button's label is readable at every hue", () => {
  const { dayFill, nightFill, dayChroma, nightChroma } = tintLightness();

  test("day: white label on the gradient, including its lightest stop", () => {
    const white: [number, number, number] = [1, 0, 0];
    for (const h of ALL_HUES) {
      for (const L of dayFill) {
        const ratio = contrast(white, [L, dayChroma, h]);
        assert.ok(
          ratio >= AA,
          `hue ${h} at L=${L}: ${ratio.toFixed(2)}:1 is below ${AA}:1. ` +
            `Lower the --tint-grad day lightness in globals.css.`,
        );
      }
    }
  });

  test("night: dark label on the bright gradient", () => {
    for (const h of ALL_HUES) {
      for (const L of nightFill) {
        // --tint-on in night mode is oklch(18% 0.03 var(--h)).
        const ratio = contrast([0.18, 0.03, h], [L, nightChroma, h]);
        assert.ok(ratio >= AA, `hue ${h} at L=${L}: ${ratio.toFixed(2)}:1 is below ${AA}:1`);
      }
    }
  });

  test("the day fill really is darker than the night fill", () => {
    // The label colour flips with the theme, so the fill must flip too.
    assert.ok(Math.max(...dayFill) < Math.min(...nightFill),
      "day and night fills overlap; one theme's label colour will be wrong");
  });
});

describe("the regression this guards", () => {
  test("the lightness that shipped the invisible button still fails", () => {
    // L=0.58 was the original day gradient start. Teal is the worst hue.
    const ratio = contrast([1, 0, 0], [0.58, 0.19, 195]);
    assert.ok(ratio < AA, "the failing case no longer fails, so this test proves nothing");
  });
});

describe("the pinned action bar stays above the tab bar", () => {
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

  const zIndexOf = (selector: string): number => {
    const rule = new RegExp(`${selector}\\s*\\{[^}]*?z-index:\\s*(\\d+)`, "s").exec(css);
    assert.ok(rule, `no z-index found for ${selector}`);
    return Number(rule[1]);
  };

  test("the action bar sits under the tab bar, not over it", () => {
    // If these invert, the pinned Next button covers the navigation.
    assert.ok(
      zIndexOf("\\.action-bar") < zIndexOf("nav\\.tabs"),
      "action-bar must stack below nav.tabs",
    );
  });

  test("it is offset by the tab bar's own height", () => {
    // A hardcoded offset silently breaks when --tab-h changes.
    const rule = /\.action-bar\s*\{([^}]*)\}/s.exec(css);
    assert.ok(rule, "no .action-bar rule");
    assert.match(rule[1]!, /position:\s*sticky/);
    assert.match(rule[1]!, /bottom:\s*calc\([^)]*--tab-h/,
      "the offset must derive from --tab-h, not a magic number");
  });

  test("body does not use overflow-x: hidden, which would break sticky", () => {
    // `overflow-x: hidden` forces overflow-y to `auto`, turning <body> into a
    // scroll container. Every descendant's `position: sticky` then resolves
    // against a box that never scrolls, so the pinned action bar stops pinning.
    // Desktop Chrome tolerates it; mobile browsers do not. `clip` contains the
    // overflow without creating the container.
    // Comments are stripped first: the rule carries an explanation that names
    // the very declaration being banned, which a naive match would flag.
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const body = /\nbody\s*\{([\s\S]*?)\n\}/.exec(bare);
    assert.ok(body, "no body rule found");
    assert.doesNotMatch(body[1]!, /overflow-x:\s*hidden/,
      "use `overflow-x: clip` instead; `hidden` silently disables position: sticky");
  });

  test("fixed bottom chrome clears the home indicator", () => {
    // env() only resolves once the viewport opts in with viewport-fit=cover.
    const layout = readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
    assert.match(layout, /viewportFit:\s*"cover"/,
      "without viewport-fit=cover, env(safe-area-inset-*) is 0 on iOS");
    const main = /\nmain\s*\{([\s\S]*?)\n\}/.exec(css);
    assert.ok(main, "no main rule found");
    assert.match(main[1]!, /env\(safe-area-inset-bottom\)/,
      "main's bottom padding must clear the tab bar's safe-area extension");
  });

  test("the Help intervention actually uses it", () => {
    // The bug this guards: the script grows a line per tap and the button
    // walked off the bottom of the screen by step five.
    const help = readFileSync(new URL("../src/app/help/page.tsx", import.meta.url), "utf8");
    assert.match(help, /className="action-bar"/, "the intervention lost its pinned action bar");
  });
});

describe("the hover veil keeps labels readable", () => {
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

  const veilAlpha = (): number => {
    const rule = /\.btn:hover::after\s*\{[^}]*opacity:\s*([\d.]+)/s.exec(css);
    assert.ok(rule, "no hover veil found; hover may have gone back to swapping backgrounds");
    return Number(rule[1]);
  };

  test("hover never sets a background on a button", () => {
    // The bug: `button:hover { background: ... }` outranked every fill class and
    // wiped the gradient, leaving white text on pale grey at 1.07:1.
    const hoverBlocks = [...css.matchAll(/@media \(hover: hover\)\s*\{([\s\S]*?)\n\}/g)].map((m) => m[1]!);
    assert.ok(hoverBlocks.length > 0, "no hover blocks found");
    for (const block of hoverBlocks) {
      if (!/button:hover|\.btn:hover/.test(block)) continue;
      const swaps = [...block.matchAll(/^\s*background(?:-color|-image)?:/gm)]
        .filter((m) => !/::after/.test(block.slice(0, m.index)) || false);
      // The only `background` allowed inside a hover block is the veil's own.
      const outsideVeil = block
        .replace(/::after\s*\{[^}]*\}/gs, "")
        .match(/^\s*background(?:-color|-image)?:/gm);
      assert.equal(outsideVeil, null,
        `a hover rule still swaps background:\n${block.trim().slice(0, 200)}`);
      void swaps;
    }
  });

  test("a white label on the day fill still clears AA once veiled", () => {
    const alpha = veilAlpha();
    const white: [number, number, number] = [255, 255, 255];
    for (const h of ALL_HUES) {
      // The gradient's lightest day stop is the worst case.
      const fill = toSrgb255(0.46, 0.19, h);
      const veiled = composite(fill, white, alpha);
      const ratio = contrast255(white, veiled);
      assert.ok(ratio >= 4.5,
        `hue ${h} hovered: ${ratio.toFixed(2)}:1. Lower the veil opacity or darken the fill.`);
    }
  });

  test("a dark label on the night fill still clears AA once veiled", () => {
    const alpha = veilAlpha();
    for (const h of ALL_HUES) {
      const label = toSrgb255(0.18, 0.03, h);
      const fill = toSrgb255(0.78, 0.16, h);
      const veiled = composite(fill, label, alpha);
      assert.ok(contrast255(label, veiled) >= 4.5, `hue ${h} hovered in night mode`);
    }
  });
});
