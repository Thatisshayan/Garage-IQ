import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { isRateLimited } from "./utils";

const DOC_TYPES = [
  "invoice",
  "receipt",
  "purchase_order",
  "release_form",
  "insurance_document",
  "other",
  "unclassified",
] as const;

// Per-type Zod schemas for extracted_data (AR-5 fix)
const lineItemSchema = z.object({
  description: z.string(),
  quantity: z.number().nullable(),
  unit_price: z.number().nullable(),
  total: z.number().nullable(),
});

const extractedInvoice = z.object({
  vendor: z.string().nullable(),
  invoice_date: z.string().nullable(),
  due_date: z.string().nullable(),
  line_items: z.array(lineItemSchema).default([]),
  subtotal: z.number().nullable(),
  tax: z.number().nullable(),
  total: z.number().nullable(),
  currency: z.string().nullable(),
  customer_name: z.string().nullable(),
  vin: z.string().nullable(),
  payment_status: z.enum(["unpaid", "paid", "overdue", "disputed"]).nullable(),
  field_confidence: z.record(z.string(), z.number()).default({}),
});

const extractedInsurance = z.object({
  claim_number: z.string().nullable(),
  insurer: z.string().nullable(),
  policy_number: z.string().nullable(),
  claim_status: z.enum(["pending", "approved", "denied", "partial"]).nullable(),
  approved_amount: z.number().nullable(),
  effective_date: z.string().nullable(),
  customer_name: z.string().nullable(),
  vin: z.string().nullable(),
  field_confidence: z.record(z.string(), z.number()).default({}),
});

const extractedPurchaseOrder = z.object({
  vendor: z.string().nullable(),
  po_number: z.string().nullable(),
  date: z.string().nullable(),
  line_items: z.array(lineItemSchema.omit({ total: true })).default([]),
  total: z.number().nullable(),
  vin: z.string().nullable(),
  field_confidence: z.record(z.string(), z.number()).default({}),
});

const extractedReleaseForm = z.object({
  signer_name: z.string().nullable(),
  signature_date: z.string().nullable(),
  authorization_status: z.enum(["signed", "unsigned", "declined"]).nullable(),
  vin: z.string().nullable(),
  customer_name: z.string().nullable(),
  field_confidence: z.record(z.string(), z.number()).default({}),
});

const extractedReceipt = z.object({
  vendor: z.string().nullable(),
  date: z.string().nullable(),
  total: z.number().nullable(),
  category: z.string().nullable(),
  field_confidence: z.record(z.string(), z.number()).default({}),
});

const ExtractedDataSchema = z.discriminatedUnion("type", [
  extractedInvoice.extend({ type: z.literal("invoice") }),
  extractedInsurance.extend({ type: z.literal("insurance_document") }),
  extractedPurchaseOrder.extend({ type: z.literal("purchase_order") }),
  extractedReleaseForm.extend({ type: z.literal("release_form") }),
  extractedReceipt.extend({ type: z.literal("receipt") }),
]).nullable();

export const createDocumentRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        storage_path: z.string().min(1),
        file_name: z.string().min(1).max(500),
        mime_type: z.string().max(200).optional(),
        size_bytes: z.number().int().nonnegative().optional(),
        job_id: z.string().uuid().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("documents")
      .insert({
        storage_path: data.storage_path,
        file_name: data.file_name,
        mime_type: data.mime_type ?? null,
        size_bytes: data.size_bytes ?? null,
        job_id: data.job_id ?? null,
        uploaded_by: context.userId,
        processing_status: "pending",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// Triggers AI processing pipeline. Returns immediately, runs synchronously here for simplicity.
export const processDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    if (isRateLimited(`process:${context.user.id}`, 10, 60_000)) {
      return { ok: false, error: "Rate limit exceeded. Try again in a minute." };
    }
    const { processDocumentNow } = await import("./document-ai.server");
    try {
      await processDocumentNow(context.supabase, data.id);
    } catch (e: any) {
      return { ok: false, error: String(e?.message ?? e) };
    }
    return { ok: true };
  });

export const listDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        type: z.enum(DOC_TYPES).optional(),
        status: z
          .enum(["pending", "processing", "extracted", "linked", "review", "error"])
          .optional(),
        archived: z.boolean().optional(),
        historical: z.boolean().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("documents")
      .select("*, job:jobs(id,description), customer:customers(name), vehicle:vehicles(vin,license_plate)")
      .order("created_at", { ascending: false });
    if (data.type) q = q.eq("type", data.type);
    if (data.status) q = q.eq("processing_status", data.status);
    if (data.archived === true) q = q.not("archived_at", "is", null);
    else if (data.archived === false) q = q.is("archived_at", null);
    if (data.historical !== undefined) q = q.eq("is_historical", data.historical);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows;
  });

export const archiveDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), archived: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("documents")
      .update({ archived_at: data.archived ? new Date().toISOString() : null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Ingest a historical document: run AI pipeline AND auto-create customer/vehicle/job
// from extracted data when no existing match is found. Backfills past invoices/claims.
export const ingestHistoricalDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("documents")
      .update({ is_historical: true })
      .eq("id", data.id);
    try {
      const { processDocumentNow, backfillFromDocument } = await import("./document-ai.server");
      await processDocumentNow(context.supabase, data.id);
      const result = await backfillFromDocument(context.supabase, data.id, context.userId);
      return { ok: true, ...result };
    } catch (e: any) {
      return { ok: false, error: String(e?.message ?? e) };
    }
  });

export const getDocument = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: doc, error } = await context.supabase
      .from("documents")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    const { data: signed } = await context.supabase.storage
      .from("workshop-documents")
      .createSignedUrl(doc.storage_path, 3600);
    return { document: doc, signedUrl: signed?.signedUrl ?? null };
  });

export const updateDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        type: z.enum(DOC_TYPES).optional(),
        extracted_data: ExtractedDataSchema.optional(),
        job_id: z.string().uuid().nullable().optional(),
        customer_id: z.string().uuid().nullable().optional(),
        vehicle_id: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const update: Record<string, any> = {};
    for (const [k, v] of Object.entries(rest)) if (v !== undefined) update[k] = v;
    const { error } = await context.supabase.from("documents").update(update as any).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listReviewQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("document_review_queue")
      .select("*, document:documents(*)")
      .is("resolved_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const resolveReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("document_review_queue")
      .update({ resolved_at: new Date().toISOString(), resolved_by: context.userId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Returns a signed upload URL for direct client upload to storage.
export const getUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ file_name: z.string().min(1).max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const safe = data.file_name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${context.userId}/${Date.now()}-${safe}`;
    const { data: signed, error } = await context.supabase.storage
      .from("workshop-documents")
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, signedUrl: signed.signedUrl, token: signed.token };
  });
