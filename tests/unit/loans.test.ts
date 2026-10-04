import { describe, expect, it } from "vitest";
import {
  allocatePayments,
  buildFlatSchedule,
  dueDateFor,
  flatInterestCents,
  installmentCount,
  reminderKindFor,
  summarizeLoan,
  toCents,
} from "@/lib/loans/schedule";

describe("flat-rate schedule", () => {
  it("computes flat interest per annum on the original principal", () => {
    // 10,000 at 12% p.a. for 12 months = 1,200 interest
    expect(flatInterestCents(toCents("10000"), 12, 12)).toBe(120_000);
    // 6 months = half
    expect(flatInterestCents(toCents("10000"), 12, 6)).toBe(60_000);
  });

  it("builds equal instalments that sum exactly to the total", () => {
    const s = buildFlatSchedule({ principal: "10000", annualRatePct: 12, termMonths: 12, frequency: "MONTHLY", firstDueDate: "2026-11-15" });
    expect(s.installmentCount).toBe(12);
    expect(s.totalInterest).toBe("1200.00");
    expect(s.totalRepayable).toBe("11200.00");
    expect(s.regularInstallment).toBe("933.33");
    const sum = s.installments.reduce((a, i) => a + toCents(i.amountDue), 0);
    expect(sum).toBe(toCents(s.totalRepayable));
    expect(s.installments.at(-1)!.amountDue).toBe("933.37"); // last absorbs rounding
    expect(s.installments[1]!.dueDate).toBe("2026-12-15");
  });

  it("supports weekly and biweekly frequencies", () => {
    expect(installmentCount(12, "WEEKLY")).toBe(52);
    expect(installmentCount(6, "BIWEEKLY")).toBe(13);
    const s = buildFlatSchedule({ principal: "1300", annualRatePct: 0, termMonths: 6, frequency: "BIWEEKLY", firstDueDate: "2026-01-01" });
    expect(s.installments[1]!.dueDate).toBe("2026-01-15");
    expect(s.installments.every((i) => i.amountDue === "100.00")).toBe(true);
  });

  it("clamps monthly due dates to the end of short months", () => {
    expect(dueDateFor("2026-01-31", "MONTHLY", 1)).toBe("2026-02-28");
    expect(dueDateFor("2026-01-31", "MONTHLY", 2)).toBe("2026-03-31");
    expect(dueDateFor("2027-12-15", "MONTHLY", 1)).toBe("2028-01-15");
  });

  it("rejects invalid input", () => {
    expect(() => buildFlatSchedule({ principal: "0", annualRatePct: 10, termMonths: 12, frequency: "MONTHLY", firstDueDate: "2026-01-01" })).toThrow();
    expect(() => buildFlatSchedule({ principal: "100", annualRatePct: 10, termMonths: 0, frequency: "MONTHLY", firstDueDate: "2026-01-01" })).toThrow();
  });
});

describe("payment allocation", () => {
  const due = ["100.00", "100.00", "100.00"];

  it("pays the oldest instalments first", () => {
    expect(allocatePayments(due, "150")).toEqual([
      { amountPaid: "100.00", status: "PAID" },
      { amountPaid: "50.00", status: "PARTIAL" },
      { amountPaid: "0.00", status: "PENDING" },
    ]);
  });

  it("rejects overpayment", () => {
    expect(allocatePayments(due, "300.01")).toBeNull();
    expect(allocatePayments(due, "300")?.every((r) => r.status === "PAID")).toBe(true);
  });
});

describe("loan summary and reminders", () => {
  const inst = [
    { dueDate: "2026-01-01", amountDue: "100.00", amountPaid: "100.00", status: "PAID" as const },
    { dueDate: "2026-02-01", amountDue: "100.00", amountPaid: "40.00", status: "PARTIAL" as const },
    { dueDate: "2026-03-01", amountDue: "100.00", amountPaid: "0.00", status: "PENDING" as const },
  ];

  it("summarises outstanding, overdue and next due", () => {
    const s = summarizeLoan(inst, "2026-02-10");
    expect(s.outstanding).toBe("160.00");
    expect(s.overdueAmount).toBe("60.00");
    expect(s.overdueCount).toBe(1);
    expect(s.nextDue).toEqual({ dueDate: "2026-03-01", amount: "100.00", daysUntil: 19 });
  });

  it("picks the right reminder for the day", () => {
    expect(reminderKindFor("2026-03-04", "2026-03-01")).toBe("UPCOMING");
    expect(reminderKindFor("2026-03-05", "2026-03-01")).toBeNull();
    expect(reminderKindFor("2026-03-01", "2026-03-01")).toBe("DUE_TODAY");
    expect(reminderKindFor("2026-02-28", "2026-03-01")).toBe("OVERDUE_1");
    expect(reminderKindFor("2026-02-20", "2026-03-01")).toBe("OVERDUE_7");
  });
});
