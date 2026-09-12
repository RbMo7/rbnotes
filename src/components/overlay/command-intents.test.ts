import { describe, it, expect } from "vitest";
import {
  normalize,
  bigramDice,
  diceTokenScore,
  searchCommandIntents,
  searchCheatsheet,
  type CommandIntentEntry,
} from "@/components/overlay/command-intents";

// An isolated fixture, deliberately not the real COMMAND_INTENTS seed --
// these tests verify the matching/ranking algorithm itself, independent of
// whatever intent phrases happen to be curated for the real command set.
const fixture: CommandIntentEntry[] = [
  { label: ":w", full: "w", desc: "save", intents: ["save", "write"] },
  { label: ":b", full: "b", desc: "toggle sidebar", intents: ["browse notes", "sidebar"] },
  { label: ":pin", full: "pin", desc: "toggle pin", intents: ["favorite", "bookmark"] },
];

describe("normalize", () => {
  it("lowercases and splits on whitespace", () => {
    expect(normalize("Save Note")).toEqual(["save", "note"]);
  });

  it("strips punctuation and collapses repeated whitespace", () => {
    expect(normalize("don't lose my work!!  please")).toEqual([
      "dont",
      "lose",
      "my",
      "work",
      "please",
    ]);
  });

  it("returns an empty array for blank input", () => {
    expect(normalize("   ")).toEqual([]);
  });
});

describe("bigramDice", () => {
  it("scores identical words as 1", () => {
    expect(bigramDice("sidebar", "sidebar")).toBe(1);
  });

  it("scores a plural against its singular highly (near-miss tolerance)", () => {
    // "sidebar" bigrams: si id de eb ba ar (6); "sidebars" bigrams: si id de
    // eb ba ar rs (7); intersection 6 -> 2*6/(6+7) = 12/13.
    expect(bigramDice("sidebar", "sidebars")).toBeCloseTo(12 / 13, 5);
  });

  it("scores completely different words near 0", () => {
    expect(bigramDice("pin", "logout")).toBeLessThan(0.2);
  });
});

describe("diceTokenScore", () => {
  it("scores a single exact match out of a 2-word phrase as 2/3 (the spec's own worked example)", () => {
    expect(diceTokenScore(["browse"], ["browse", "notes"])).toBeCloseTo(2 / 3, 5);
  });

  it("scores an exact single-word match as 1", () => {
    expect(diceTokenScore(["save"], ["save"])).toBe(1);
  });

  it("scores no overlap at all as 0", () => {
    expect(diceTokenScore(["pin"], ["logout", "account"])).toBe(0);
  });

  it("gives partial (0.7) credit for a near-miss bigram match instead of a full match", () => {
    // "sidebars" isn't an exact token in ["sidebar"], but bigramDice(0.923) clears
    // the 0.6 fallback threshold -> matched = 0.7, score = 2*0.7 / (1+1) = 0.7.
    expect(diceTokenScore(["sidebars"], ["sidebar"])).toBeCloseTo(0.7, 5);
  });

  it("returns 0 when either token list is empty", () => {
    expect(diceTokenScore([], ["save"])).toBe(0);
    expect(diceTokenScore(["save"], [])).toBe(0);
  });
});

describe("searchCommandIntents", () => {
  it("finds a command by an intent phrase that shares no words with its label or desc", () => {
    const results = searchCommandIntents("browse", fixture);
    expect(results[0]?.entry.full).toBe("b");
  });

  it("still finds a command by a literal word in its desc, even if not in intents[]", () => {
    // "toggle" appears in both :b's and :pin's desc but neither's intents --
    // desc/label must be part of the searchable surface too.
    const results = searchCommandIntents("toggle pin", fixture);
    expect(results[0]?.entry.full).toBe("pin");
  });

  it("excludes commands scoring below minScore", () => {
    const results = searchCommandIntents("logout", fixture);
    expect(results).toEqual([]);
  });

  it("respects the limit option", () => {
    const results = searchCommandIntents("save write", fixture, { limit: 1 });
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it("finds the real :w and :b commands by plain intent phrases (the motivating scenario)", () => {
    expect(searchCommandIntents("save a note")[0]?.entry.full).toBe("w");
    expect(searchCommandIntents("browse notes")[0]?.entry.full).toBe("b");
    expect(searchCommandIntents("pin this")[0]?.entry.full).toBe("pin");
  });

  it("respects a custom minScore", () => {
    // "notes" alone only partially overlaps :b's "browse notes" phrase
    // (diceTokenScore(["notes"], ["browse","notes"]) = 2/3 ≈ 0.667, well
    // above the default 0.35) -- raise the bar past that to prove the
    // option is actually threaded through, not just defaulted.
    expect(searchCommandIntents("notes", fixture, { minScore: 0.9 })).toEqual([]);
    expect(searchCommandIntents("notes", fixture, { minScore: 0.5 }).length).toBeGreaterThan(0);
  });
});

describe("searchCheatsheet", () => {
  // A small fixture mirroring HelpBuffer's real SECTIONS shape, deliberately
  // not the full real table -- these tests verify the merge/substring
  // behavior, independent of the actual shortcut list's current content.
  const sections = [
    {
      title: "GLOBAL",
      keys: [["Ctrl+/", "search every note"]] as [string, string][],
    },
    {
      title: "COMMAND",
      keys: [
        [":w", "save"],
        [":set", "open settings"],
      ] as [string, string][],
    },
  ];

  it("finds a row by a literal word in its description, even outside the `:` command intents table", () => {
    // Regression: typing "search" found nothing, because only :`command`
    // intents were searched -- "search" only ever appears in a *keybind's*
    // description (Ctrl+/), which searchCommandIntents alone never sees.
    const results = searchCheatsheet("search", sections, fixture);
    expect(results).toContainEqual({ key: "Ctrl+/", desc: "search every note" });
  });

  it("does plain substring/prefix filtering for short queries, across every row", () => {
    const results = searchCheatsheet("se", sections, fixture);
    const keys = results.map((r) => r.key);
    // "se" is a substring of "search" (Ctrl+/'s desc) and of ":set"'s key.
    expect(keys).toContain("Ctrl+/");
    expect(keys).toContain(":set");
  });

  it("still finds a `:` command by an intent synonym not literally present anywhere in `sections`", () => {
    const withPin = [
      ...sections,
      { title: "COMMAND", keys: [[":pin", "toggle pin"]] as [string, string][] },
    ];
    const results = searchCheatsheet("bookmark", withPin, fixture);
    expect(results).toContainEqual({ key: ":pin", desc: "toggle pin" });
  });

  it("de-duplicates a row that matches both literally and by intent", () => {
    const results = searchCheatsheet("save", sections, fixture);
    expect(results.filter((r) => r.key === ":w")).toHaveLength(1);
  });

  it("returns nothing for a blank query", () => {
    expect(searchCheatsheet("   ", sections, fixture)).toEqual([]);
  });
});
