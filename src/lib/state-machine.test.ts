import { describe, it, expect } from "vitest";
import { nextStatusFor, type JobStatus, type JobEvent } from "./state-machine.server";

describe("nextStatusFor — state machine transition table", () => {
  // Happy path: full lifecycle
  it("pending + insurance_approved → awaiting_insurance", () => {
    expect(nextStatusFor("pending", "insurance_approved")).toBe("awaiting_insurance");
  });

  it("awaiting_insurance + po_linked → parts_ordered", () => {
    expect(nextStatusFor("awaiting_insurance", "po_linked")).toBe("parts_ordered");
  });

  it("parts_ordered + release_linked → in_progress", () => {
    expect(nextStatusFor("parts_ordered", "release_linked")).toBe("in_progress");
  });

  it("in_progress + invoice_unpaid → awaiting_payment", () => {
    expect(nextStatusFor("in_progress", "invoice_unpaid")).toBe("awaiting_payment");
  });

  it("awaiting_payment + invoice_paid → completed", () => {
    expect(nextStatusFor("awaiting_payment", "invoice_paid")).toBe("completed");
  });

  // Alternate path: po_linked from pending
  it("pending + po_linked → parts_ordered (skip insurance)", () => {
    expect(nextStatusFor("pending", "po_linked")).toBe("parts_ordered");
  });

  // Deny path: insurance_denied resets to pending from ANY status
  it.each<JobStatus>([
    "pending",
    "awaiting_insurance",
    "parts_ordered",
    "in_progress",
    "awaiting_payment",
    "completed",
  ])("insurance_denied from %s → pending", (status) => {
    expect(nextStatusFor(status, "insurance_denied")).toBe("pending");
  });

  // Illegal transitions return null
  it("completed + any event → null (terminal state)", () => {
    expect(nextStatusFor("completed", "invoice_paid")).toBeNull();
    expect(nextStatusFor("completed", "release_linked")).toBeNull();
    expect(nextStatusFor("completed", "insurance_approved")).toBeNull();
  });

  it("pending + release_linked → null (wrong event for state)", () => {
    expect(nextStatusFor("pending", "release_linked")).toBeNull();
  });

  it("awaiting_insurance + invoice_paid → null (wrong event)", () => {
    expect(nextStatusFor("awaiting_insurance", "invoice_paid")).toBeNull();
  });

  it("in_progress + po_linked → null (already past that gate)", () => {
    expect(nextStatusFor("in_progress", "po_linked")).toBeNull();
  });

  it("parts_ordered + invoice_unpaid → null (wrong state for event)", () => {
    expect(nextStatusFor("parts_ordered", "invoice_unpaid")).toBeNull();
  });
});

describe("nextStatusFor — exhaustiveness", () => {
  const transitions: Array<[JobStatus, JobEvent, JobStatus | null]> = [
    ["pending", "insurance_approved", "awaiting_insurance"],
    ["pending", "insurance_denied", "pending"],
    ["pending", "po_linked", "parts_ordered"],
    ["pending", "release_linked", null],
    ["pending", "invoice_unpaid", null],
    ["pending", "invoice_paid", null],

    ["awaiting_insurance", "insurance_approved", null],
    ["awaiting_insurance", "insurance_denied", "pending"],
    ["awaiting_insurance", "po_linked", "parts_ordered"],
    ["awaiting_insurance", "release_linked", null],
    ["awaiting_insurance", "invoice_unpaid", null],
    ["awaiting_insurance", "invoice_paid", null],

    ["parts_ordered", "insurance_approved", null],
    ["parts_ordered", "insurance_denied", "pending"],
    ["parts_ordered", "po_linked", null],
    ["parts_ordered", "release_linked", "in_progress"],
    ["parts_ordered", "invoice_unpaid", null],
    ["parts_ordered", "invoice_paid", null],

    ["in_progress", "insurance_approved", null],
    ["in_progress", "insurance_denied", "pending"],
    ["in_progress", "po_linked", null],
    ["in_progress", "release_linked", null],
    ["in_progress", "invoice_unpaid", "awaiting_payment"],
    ["in_progress", "invoice_paid", null],

    ["awaiting_payment", "insurance_approved", null],
    ["awaiting_payment", "insurance_denied", "pending"],
    ["awaiting_payment", "po_linked", null],
    ["awaiting_payment", "release_linked", null],
    ["awaiting_payment", "invoice_unpaid", null],
    ["awaiting_payment", "invoice_paid", "completed"],

    ["completed", "insurance_approved", null],
    ["completed", "insurance_denied", "pending"],
    ["completed", "po_linked", null],
    ["completed", "release_linked", null],
    ["completed", "invoice_unpaid", null],
    ["completed", "invoice_paid", null],
  ];

  it.each(transitions)("nextStatusFor(%s, %s) → %s", (status, event, expected) => {
    expect(nextStatusFor(status, event)).toBe(expected);
  });
});
