import { describe, it, expect } from "vitest";
import { settingsSchema, defaultSettings } from "@/lib/schemas";

describe("settingsSchema theme field", () => {
  it("defaults to hacker when absent", () => {
    expect(defaultSettings.theme).toBe("hacker");
    expect(settingsSchema.parse({}).theme).toBe("hacker");
  });

  it("accepts every named theme", () => {
    expect(settingsSchema.parse({ theme: "hacker" }).theme).toBe("hacker");
    expect(settingsSchema.parse({ theme: "dark" }).theme).toBe("dark");
    expect(settingsSchema.parse({ theme: "light" }).theme).toBe("light");
  });

  it("rejects an unknown theme", () => {
    expect(() => settingsSchema.parse({ theme: "solarized" })).toThrow();
  });
});
