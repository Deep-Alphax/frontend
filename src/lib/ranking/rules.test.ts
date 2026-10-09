import { describe, expect, it } from "vitest";

import {
  accuracyWidth,
  avatarSkin,
  countdown,
  fmtPoints,
  fmtPrize,
  initials,
  parsePrizes,
  seasonClock,
} from "./rules";

describe("ranking rules", () => {
  it("countdown em 2 dígitos e nunca negativo", () => {
    const now = new Date("2026-10-01T00:00:00Z");
    const target = new Date(now.getTime() + ((3 * 24 + 14) * 3600 + 22 * 60 + 7) * 1000);
    expect(countdown(target, now)).toEqual({ days: "03", hours: "14", min: "22", sec: "07" });
    expect(countdown(new Date(0), now)).toEqual({ days: "00", hours: "00", min: "00", sec: "00" });
  });

  it("seasonClock por status", () => {
    const s = { id: "s", name: "Season 1", startsAt: "2026-10-01T00:00:00Z", endsAt: "2026-11-01T00:00:00Z" };
    expect(seasonClock({ ...s, status: "active" })).toEqual({
      label: "Season 1 ends in",
      target: new Date(s.endsAt),
    });
    expect(seasonClock({ ...s, status: "upcoming" })?.label).toBe("Season 1 starts in");
    expect(seasonClock({ ...s, status: "ended" })).toBeNull();
  });

  it("formatos", () => {
    expect(fmtPoints(37920)).toBe("37,920");
    expect(fmtPrize(10000)).toBe("$10,000");
    expect(accuracyWidth(120)).toBe("100%");
    expect(accuracyWidth(-3)).toBe("0%");
  });

  it("iniciais", () => {
    expect(initials("reefcalls")).toBe("RE");
    expect(initials("Frank DeGods")).toBe("FD");
    expect(initials("  @x ")).toBe("X");
    expect(initials("")).toBe("?");
  });

  it("degradê do avatar é determinístico", () => {
    expect(avatarSkin("k1")).toBe(avatarSkin("k1"));
  });

  it("prêmios do admin", () => {
    expect(parsePrizes("10000\n5000\n2500")).toEqual([10000, 5000, 2500]);
    expect(parsePrizes("$10,000; $5,000; 200")).toEqual([10000, 5000, 200]);
    expect(parsePrizes("200, 100, 10")).toEqual([200, 100, 10]);
    expect(parsePrizes("")).toEqual([]);
    expect(parsePrizes("12.5")).toBeNull();
    expect(parsePrizes("-5")).toBeNull();
    expect(parsePrizes("2000000")).toBeNull();
  });
});
