import { describe, expect, it } from "vitest";
import { checkNationalId, maskNationalId, nationalIdSpec } from "@/config/national-ids";

describe("national ID rules", () => {
  it("validates US SSNs, rejecting never-issued ranges", () => {
    expect(checkNationalId("US", "123-45-6789")).toEqual({ ok: true, value: "123456789" });
    expect(checkNationalId("US", "000-12-3456").ok).toBe(false);
    expect(checkNationalId("US", "666-12-3456").ok).toBe(false);
    expect(checkNationalId("US", "123-00-6789").ok).toBe(false);
  });

  it("validates Canadian SINs with the Luhn checksum", () => {
    expect(checkNationalId("CA", "046 454 286").ok).toBe(true);
    expect(checkNationalId("CA", "046 454 287").ok).toBe(false);
  });

  it("validates other configured formats", () => {
    expect(checkNationalId("GB", "AB123456C").ok).toBe(true);
    expect(checkNationalId("GB", "BG123456C").ok).toBe(false);
    expect(checkNationalId("IN", "abcde1234f").ok).toBe(true);
    expect(checkNationalId("GH", "GHA-123456789-0").ok).toBe(true);
    expect(checkNationalId("KE", "12345678").ok).toBe(true);
  });

  it("falls back to an optional generic field", () => {
    expect(nationalIdSpec("FR").required).toBe(false);
    expect(checkNationalId("FR", "")).toEqual({ ok: true, value: null });
    expect(nationalIdSpec("NG").type).toBe("NIN");
  });

  it("masks all but the last four characters", () => {
    expect(maskNationalId("123456789")).toBe("••••6789");
  });
});
