import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const DOC_TYPES = [
  "invoice",
  "receipt",
  "purchase_order",
  "release_form",
  "insurance_document",
  "other",
  "unclassified",
] as const;

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
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows;
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
        extracted_data: z.any().optional(),
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
