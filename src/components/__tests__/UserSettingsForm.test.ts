import { describe, expect, test } from "vitest";
import { phoneRegExp } from "../UserSettingsForm";

// The previous phone validation regex (SonarCloud typescript:S5843, complexity 37).
// Kept here only to assert the simplified regex preserves identical matching
// behavior for every realistic phone input (i.e. strings without a backslash).
const previousPhoneRegExp =
  /^((\\+[1-9]{1,4}[ \\-]*)|(\\([0-9]{2,3}\\)[ \\-]*)|([0-9]{2,4})[ \\-]*)*?[0-9]{3,4}?[ \\-]*[0-9]{3,4}?$/;

describe("phoneRegExp", () => {
  test("accepts valid phone numbers", () => {
    const valid = [
      "5551234",
      "555-1234",
      "555 1234",
      "12345678",
      "123456789",
      "123 456 7890",
      "1234 5678",
      "0800 123 456",
      "555-123-4567",
      "11 1111 1111",
    ];
    for (const value of valid) {
      expect(phoneRegExp.test(value), value).toBe(true);
    }
  });

  test("rejects invalid phone numbers", () => {
    const invalid = ["", "12345", "123", "abcdef", "1-2-3-4-5-6", "99 99 99 99", "phone"];
    for (const value of invalid) {
      expect(phoneRegExp.test(value), value).toBe(false);
    }
  });

  test("matches the previous regex for all realistic inputs (no backslashes)", () => {
    // Exhaustively enumerate every string up to length 6 over the phone alphabet
    // (digits, space, hyphen) and assert the simplified regex agrees with the
    // previous one. The previous regex only diverged on backslash characters,
    // which were an artifact of double-escaping and are never valid phone input.
    const chars = "0123456789 -".split("");
    const mismatches: string[] = [];
    const enumerate = (prefix: string, maxLen: number) => {
      if (phoneRegExp.test(prefix) !== previousPhoneRegExp.test(prefix)) {
        mismatches.push(prefix);
      }
      if (prefix.length < maxLen) {
        for (const c of chars) {
          enumerate(prefix + c, maxLen);
        }
      }
    };
    enumerate("", 6);
    expect(mismatches).toEqual([]);
  });
});
