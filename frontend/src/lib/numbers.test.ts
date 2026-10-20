import { describe, it, expect } from "vitest";
import { parseWholeNumber } from "@/lib/numbers";

describe("parseWholeNumber", () => {
  it.each([
    ["-1", -1],
    ["0", 0],
    [" 1400 ", 1400],
  ])("parses %j", (raw, expected) => {
    expect(parseWholeNumber(raw)).toBe(expected);
  });

  it.each(["", "-", "1.5", "abc", "1e3", "99999999999999999999"])("rejects %j", (raw) => {
    expect(parseWholeNumber(raw)).toBeNull();
  });
});
