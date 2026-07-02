import { describe, it, expect } from "vitest";
import { z } from "zod";

// Re-define the PaymentInput schema from payments.functions.ts for testing
const PaymentInput = z.object({
  job_id: z.string().uuid(),
  payer_type: z.enum(["insurance", "client", "other"]),
  payer_name: z.string().max(200).optional().or(z.literal("")),
  amount: z.coerce.number().nonnegative().max(10_000_000),
  currency: z.string().max(8).default("CAD"),
  method: z.string().max(60).optional().or(z.literal("")),
  note: z.string().max(500).optional().or(z.literal("")),
  paid_at: z.string().optional(),
});

describe("PaymentInput schema", () => {
  const validPayment = {
    job_id: "550e8400-e29b-41d4-a716-446655440000",
    payer_type: "client" as const,
    amount: 150.00,
  };

  it("accepts minimal valid payment", () => {
    const result = PaymentInput.parse(validPayment);
    expect(result.currency).toBe("CAD"); // default applied
    expect(result.amount).toBe(150);
  });

  it("rejects negative amounts", () => {
    expect(() =>
      PaymentInput.parse({ ...validPayment, amount: -100 }),
    ).toThrow();
  });

  it("rejects amounts over 10M", () => {
    expect(() =>
      PaymentInput.parse({ ...validPayment, amount: 10_000_001 }),
    ).toThrow();
  });

  it("accepts zero amount", () => {
    const result = PaymentInput.parse({ ...validPayment, amount: 0 });
    expect(result.amount).toBe(0);
  });

  it("rejects invalid UUID for job_id", () => {
    expect(() =>
      PaymentInput.parse({ ...validPayment, job_id: "not-a-uuid" }),
    ).toThrow();
  });

  it("rejects invalid payer_type", () => {
    expect(() =>
      PaymentInput.parse({ ...validPayment, payer_type: "employer" }),
    ).toThrow();
  });

  it("accepts all valid payer types", () => {
    for (const pt of ["insurance", "client", "other"]) {
      const result = PaymentInput.parse({ ...validPayment, payer_type: pt });
      expect(result.payer_type).toBe(pt);
    }
  });

  it("coerces string amount to number", () => {
    const result = PaymentInput.parse({ ...validPayment, amount: "250.50" });
    expect(result.amount).toBe(250.5);
  });
});

// Re-define the extracted_data schemas from document-ai.server.ts for testing
const ExtractSchemas = {
  invoice: z.object({
    vendor: z.string().nullable(),
    invoice_date: z.string().nullable(),
    due_date: z.string().nullable(),
    line_items: z.array(z.object({ description: z.string(), quantity: z.number().nullable(), unit_price: z.number().nullable(), total: z.number().nullable() })).default([]),
    subtotal: z.number().nullable(),
    tax: z.number().nullable(),
    total: z.number().nullable(),
    currency: z.string().nullable(),
    customer_name: z.string().nullable(),
    vin: z.string().nullable(),
    payment_status: z.enum(["unpaid", "paid", "overdue", "disputed"]).nullable(),
    field_confidence: z.record(z.string(), z.number()).default({}),
  }),
  insurance_document: z.object({
    claim_number: z.string().nullable(),
    insurer: z.string().nullable(),
    policy_number: z.string().nullable(),
    claim_status: z.enum(["pending", "approved", "denied", "partial"]).nullable(),
    approved_amount: z.number().nullable(),
    effective_date: z.string().nullable(),
    customer_name: z.string().nullable(),
    vin: z.string().nullable(),
    field_confidence: z.record(z.string(), z.number()).default({}),
  }),
  purchase_order: z.object({
    vendor: z.string().nullable(),
    po_number: z.string().nullable(),
    date: z.string().nullable(),
    line_items: z.array(z.object({ description: z.string(), quantity: z.number().nullable(), unit_price: z.number().nullable() })).default([]),
    total: z.number().nullable(),
    vin: z.string().nullable(),
    field_confidence: z.record(z.string(), z.number()).default({}),
  }),
  release_form: z.object({
    signer_name: z.string().nullable(),
    signature_date: z.string().nullable(),
    authorization_status: z.enum(["signed", "unsigned", "declined"]).nullable(),
    vin: z.string().nullable(),
    customer_name: z.string().nullable(),
    field_confidence: z.record(z.string(), z.number()).default({}),
  }),
  receipt: z.object({
    vendor: z.string().nullable(),
    date: z.string().nullable(),
    total: z.number().nullable(),
    category: z.string().nullable(),
    field_confidence: z.record(z.string(), z.number()).default({}),
  }),
};

describe("ExtractSchemas — invoice", () => {
  it("accepts a complete invoice extraction", () => {
    const result = ExtractSchemas.invoice.parse({
      vendor: "AutoZone",
      invoice_date: "2026-01-15",
      due_date: "2026-02-15",
      line_items: [{ description: "Brake pads", quantity: 2, unit_price: 45.99, total: 91.98 }],
      subtotal: 91.98,
      tax: 11.96,
      total: 103.94,
      currency: "CAD",
      customer_name: "John Doe",
      vin: "1HGBH41JXMN109186",
      payment_status: "unpaid",
      field_confidence: { vendor: 0.95, total: 0.88 },
    });
    expect(result.vendor).toBe("AutoZone");
    expect(result.line_items).toHaveLength(1);
  });

  it("accepts minimal invoice (all nullable fields null)", () => {
    const result = ExtractSchemas.invoice.parse({
      vendor: null,
      invoice_date: null,
      due_date: null,
      line_items: [],
      subtotal: null,
      tax: null,
      total: null,
      currency: null,
      customer_name: null,
      vin: null,
      payment_status: null,
    });
    expect(result.line_items).toEqual([]);
  });

  it("rejects invoice with wrong payment_status", () => {
    expect(() =>
      ExtractSchemas.invoice.parse({
        vendor: null, invoice_date: null, due_date: null, line_items: [],
        subtotal: null, tax: null, total: null, currency: null,
        customer_name: null, vin: null, payment_status: "bogus",
      }),
    ).toThrow();
  });
});

describe("ExtractSchemas — insurance_document", () => {
  it("accepts a complete insurance document", () => {
    const result = ExtractSchemas.insurance_document.parse({
      claim_number: "CLM-2026-001",
      insurer: "Intact",
      policy_number: "POL-123",
      claim_status: "approved",
      approved_amount: 5000,
      effective_date: "2026-01-01",
      customer_name: "Jane Smith",
      vin: "2HGBH41JXMN109186",
      field_confidence: { claim_number: 0.92 },
    });
    expect(result.claim_status).toBe("approved");
    expect(result.approved_amount).toBe(5000);
  });

  it("rejects invalid claim_status", () => {
    expect(() =>
      ExtractSchemas.insurance_document.parse({
        claim_number: null, insurer: null, policy_number: null,
        claim_status: "invalid", approved_amount: null, effective_date: null,
        customer_name: null, vin: null,
      }),
    ).toThrow();
  });
});

describe("ExtractSchemas — rejects arbitrary JSON (AR-5 regression)", () => {
  it("rejects an object with random keys for invoice", () => {
    expect(() =>
      ExtractSchemas.invoice.parse({ random: "data", nested: { key: 1 } }),
    ).toThrow();
  });

  it("rejects a string for extracted_data", () => {
    expect(() => ExtractSchemas.invoice.parse("not an object")).toThrow();
  });

  it("rejects an array for extracted_data", () => {
    expect(() => ExtractSchemas.invoice.parse([1, 2, 3])).toThrow();
  });
});
