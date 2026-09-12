import { describe, it, expect } from "vitest";
import {
  searchVimCombos,
  comboSteps,
  VIM_COMBO_INTENTS,
  type VimComboEntry,
} from "@/components/overlay/vim-combo-intents";

// An isolated fixture, deliberately not the real VIM_COMBO_INTENTS seed --
// these tests verify the matching/ranking algorithm itself, independent of
// whatever combos happen to be curated for the real seed data (same
// convention as command-intents.test.ts's own fixture).
const fixture: VimComboEntry[] = [
  {
    combo: 'di"',
    label: "delete inside double quotes",
    category: "Operator + Text Object",
    intents: ["delete everything inside quotes", "delete inside quotes"],
  },
  {
    combo: "5j",
    label: "down 5 lines",
    category: "Count-Prefixed Motion",
    intents: ["move down 5 lines", "go down five"],
  },
  {
    combo: "yy",
    label: "yank whole line",
    category: "Operator + Motion",
    intents: ["copy the whole line", "yank this line"],
  },
];

describe("searchVimCombos", () => {
  it("finds a combo by an intent phrase that shares no words with its label or combo", () => {
    const results = searchVimCombos("delete everything inside quotes", fixture);
    expect(results[0]?.entry.combo).toBe('di"');
  });

  it("still finds a combo by the literal combo string itself", () => {
    const results = searchVimCombos("5j", fixture);
    expect(results[0]?.entry.combo).toBe("5j");
  });

  it("excludes combos scoring below minScore", () => {
    expect(searchVimCombos("logout", fixture)).toEqual([]);
  });

  it("returns nothing for a blank query", () => {
    expect(searchVimCombos("   ", fixture)).toEqual([]);
  });
});

describe("comboSteps", () => {
  it("splits a multi-character combo into individual keystrokes", () => {
    expect(comboSteps('di"')).toEqual(["d", "i", '"']);
  });

  it("splits a single-character combo into one step", () => {
    expect(comboSteps("x")).toEqual(["x"]);
  });
});

describe("VIM_COMBO_INTENTS (real seed data)", () => {
  it("finds di\" for the motivating request: 'delete everything inside quotes'", () => {
    const results = searchVimCombos("delete everything inside quotes");
    expect(results[0]?.entry.combo).toBe('di"');
  });

  it("has no duplicate combo+category pairs (each entry uniquely renderable)", () => {
    const keys = VIM_COMBO_INTENTS.map((e) => `${e.combo}-${e.category}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
