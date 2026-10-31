import { describe, expect, it } from "vitest";
import { addPeriod, addMonthsClamped, startOfDayUTC } from "./dates";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const ymd = (date: Date) => date.toISOString().slice(0, 10);

describe("addPeriod", () => {
  it("adds days and weeks", () => {
    expect(ymd(addPeriod(d("2026-11-01"), "DAY", 3))).toBe("2026-11-04");
    expect(ymd(addPeriod(d("2026-11-01"), "WEEK", 2))).toBe("2026-11-15");
  });

  it("adds months and years", () => {
    expect(ymd(addPeriod(d("2026-11-15"), "MONTH", 1))).toBe("2026-12-15");
    expect(ymd(addPeriod(d("2026-11-15"), "MONTH", 3))).toBe("2027-02-15");
    expect(ymd(addPeriod(d("2026-11-15"), "YEAR", 1))).toBe("2027-11-15");
  });

  it("clamps to the last day of a shorter month", () => {
    expect(ymd(addPeriod(d("2027-01-31"), "MONTH", 1))).toBe("2027-02-28");
    expect(ymd(addPeriod(d("2028-01-31"), "MONTH", 1))).toBe("2028-02-29");
  });

  it("does not drift when the anchor day is passed", () => {
    const feb = addPeriod(d("2027-01-31"), "MONTH", 1, 31);
    expect(ymd(feb)).toBe("2027-02-28");
    expect(ymd(addPeriod(feb, "MONTH", 1, 31))).toBe("2027-03-31");
  });

  it("keeps Feb 29 anchors across leap and non-leap years", () => {
    const y1 = addPeriod(d("2028-02-29"), "YEAR", 1, 29);
    expect(ymd(y1)).toBe("2029-02-28");
    expect(ymd(addPeriod(y1, "YEAR", 3, 29))).toBe("2032-02-29");
  });

  it("rolls over the year boundary", () => {
    expect(ymd(addPeriod(d("2026-12-31"), "MONTH", 2, 31))).toBe("2027-02-28");
  });

  it("rejects a non-positive period count", () => {
    expect(() => addPeriod(d("2026-11-01"), "MONTH", 0)).toThrow();
  });
});

describe("helpers", () => {
  it("addMonthsClamped handles negative months", () => {
    expect(ymd(addMonthsClamped(d("2026-03-31"), -1))).toBe("2026-02-28");
  });

  it("startOfDayUTC strips the time", () => {
    expect(startOfDayUTC(new Date("2026-11-01T17:45:10Z")).toISOString()).toBe(
      "2026-11-01T00:00:00.000Z",
    );
  });
});
