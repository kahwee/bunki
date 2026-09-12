import { expect, test } from "bun:test";
import { getPacificYear, toPacificTime } from "../../src/utils/date-utils";

test("Pacific years respect the UTC year boundary", () => {
  expect(getPacificYear("2026-01-01T07:59:59Z")).toBe(2025);
  expect(getPacificYear("2026-01-01T08:00:00Z")).toBe(2026);
  expect(getPacificYear(new Date("2026-07-01T00:00:00Z"))).toBe(2026);
});

test("Pacific wall-clock conversion matches locale conversion through DST changes", () => {
  for (const date of [
    "2026-03-08T09:59:59Z",
    "2026-03-08T10:00:00Z",
    "2026-11-01T08:59:59Z",
    "2026-11-01T09:00:00Z",
  ]) {
    const expected = new Date(
      new Date(date).toLocaleString("en-US", { timeZone: "America/Los_Angeles" }),
    );
    expect(toPacificTime(date).getTime()).toBe(expected.getTime());
  }
  expect(toPacificTime("invalid").getTime()).toBeNaN();
  expect(getPacificYear("invalid")).toBeNaN();
});
