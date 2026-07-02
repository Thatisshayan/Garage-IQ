// AI classification + extraction. Async, called by processDocument server fn.
import { generateText } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getAiGateway } from "./ai-gateway.server";
import { applyJobEvent } from "./state-machine.server";

type DocType = Database["public"]["Enums"]["doc_type"];

const CLASSIFY_PROMPT = `You are a garage document classifier. Read the document and decide its type.
Return strict JSON: {"type":"invoice|receipt|purchase_order|release_form|insurance_document|other","confidence":0..1,"reasoning":"..."}
- invoice: bill from vendor with line items, tax, total
- receipt: simple proof of purchase
- purchase_order: order for parts/supplies
- release_form: customer authorization/release/completion form with signature
- insurance_document: claim form, approval/denial letter, policy doc
- other: anything else`;

const ExtractSchemas = {
  invoice: z.object({
    vendor: z.string().nullable(),
    invoice_date: z.string().nullable(),
    due_date: z.string().nullable(),
    line_items: z
      .array(
        z.object({
          description: z.string(),
          quantity: z.number().nullable(),
          unit_price: z.number().nullable(),
          total: z.number().nullable(),
        }),
      )
      .default([]),
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
    line_items: z
      .array(
        z.object({
          description: z.string(),
          quantity: z.number().nullable(),
          unit_price: z.number().nullable(),
        }),
      )
      .default([]),
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
} as const;

type ExtractedFor<T extends keyof typeof ExtractSchemas> = z.infer<(typeof ExtractSchemas)[T]>;
type ExtractedData = ExtractedFor<keyof typeof ExtractSchemas> & {
  _parse_error?: string;
  _raw?: string;
};

const MODEL = "google/gemini-3-flash-preview";
const CLASSIFY_AUTO = 0.9;
const CLASSIFY_REVIEW = 0.7;
const LINK_AUTO = 0.5;

import { parseJson } from "./utils";

async function callModelWithFile(
  prompt: string,
  fileBase64: string,
  mimeType: string,
  isImage: boolean,
) {
  const gateway = getAiGateway();
  const model = gateway(MODEL);
  const dataUrl = `data:${mimeType};base64,${fileBase64}`;
  const result = await generateText({
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          isImage
            ? { type: "image", image: dataUrl }
            : ({ type: "file", data: dataUrl, mediaType: mimeType } as any),
        ] as any,
      },
    ],
  });
  return result.text;
}

export async function processDocumentNow(supabase: SupabaseClient<Database>, documentId: string) {
  const { data: doc, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .single();
  if (error || !doc) throw new Error("Document not found");

  await supabase.from("documents").update({ processing_status: "processing" }).eq("id", documentId);

  try {
    // Download file from storage
    const { data: blob, error: dErr } = await supabase.storage
      .from("workshop-documents")
      .download(doc.storage_path);
    if (dErr || !blob) throw new Error("Could not download document");
    const buf = Buffer.from(await blob.arrayBuffer());
    const base64 = buf.toString("base64");
    const mime = doc.mime_type || "application/octet-stream";
    const isImage = mime.startsWith("image/");
    const isPdf = mime === "application/pdf";
    if (!isImage && !isPdf) {
      // Fallback: mark as extracted with no data
      await supabase
        .from("documents")
        .update({
          processing_status: "review",
          processing_error: "Unsupported MIME type for AI",
          type: "unclassified",
        })
        .eq("id", documentId);
      await supabase.from("document_review_queue").insert({
        document_id: documentId,
        reason: "unclassified",
        details: { mime },
      });
      return;
    }

    // 1. Classify
    const classifyOut = await callModelWithFile(CLASSIFY_PROMPT, base64, mime, isImage);
    let classification: { type: string; confidence: number; reasoning?: string };
    try {
      classification = parseJson(classifyOut);
    } catch {
      classification = { type: "other", confidence: 0 };
    }

    const validTypes = [
      "invoice",
      "receipt",
      "purchase_order",
      "release_form",
      "insurance_document",
      "other",
    ];
    if (!validTypes.includes(classification.type)) classification.type = "other";

    const conf = Number(classification.confidence) || 0;
    let docType: DocType = classification.type as DocType;
    let needsReview = false;
    let reviewReason: Database["public"]["Enums"]["review_reason"] | null = null;
    if (conf < CLASSIFY_REVIEW) {
      docType = "unclassified";
      needsReview = true;
      reviewReason = "unclassified";
    } else if (conf < CLASSIFY_AUTO) {
      needsReview = true;
      reviewReason = "low_confidence";
    }

    // 2. Extract per type
    let extracted: ExtractedData = {};
    if (docType !== "unclassified" && docType !== "other" && docType in ExtractSchemas) {
      const schema = ExtractSchemas[docType as keyof typeof ExtractSchemas];
      const extractPrompt = `Extract structured data for a ${docType}. Return strict JSON matching this schema (field_confidence is 0..1 per field):\n${JSON.stringify(schema._def, null, 0).slice(0, 800)}\nReturn only the JSON object.`;
      const extractOut = await callModelWithFile(extractPrompt, base64, mime, isImage);
      try {
        const raw = parseJson(extractOut);
        extracted = schema.parse(raw);
      } catch (e) {
        extracted = { _parse_error: String(e), _raw: extractOut };
        needsReview = true;
        reviewReason = reviewReason ?? "low_confidence";
      }
    }

    // 3. Update document
    await supabase
      .from("documents")
      .update({
        type: docType,
        confidence_score: conf,
        extracted_data: { classification, extracted },
        processing_status: needsReview ? "review" : "extracted",
        processing_error: null,
      })
      .eq("id", documentId);

    // 4. Linking (rule-based)
    if (conf >= LINK_AUTO) {
      await autoLink(supabase, documentId, docType, extracted);
    }

    if (needsReview && reviewReason) {
      await supabase.from("document_review_queue").insert({
        document_id: documentId,
        reason: reviewReason,
        details: { confidence: conf, classification_reason: classification.reasoning ?? null },
      });
    }
  } catch (e: unknown) {
    await supabase
      .from("documents")
      .update({
        processing_status: "error",
        processing_error: String(e instanceof Error ? e.message : e),
      })
      .eq("id", documentId);
  }
}

async function autoLink(
  supabase: SupabaseClient<Database>,
  documentId: string,
  docType: DocType,
  extracted: ExtractedData,
) {
  const { data: doc } = await supabase.from("documents").select("*").eq("id", documentId).single();
  if (!doc) return;

  let vehicleId = doc.vehicle_id;
  let customerId = doc.customer_id;
  let jobId = doc.job_id;

  // VIN -> vehicle
  const vin = (extracted?.vin || "").toString().trim();
  if (vin && !vehicleId) {
    const { data: matches } = await supabase
      .from("vehicles")
      .select("id, customer_id")
      .ilike("vin", vin)
      .limit(5);
    if (matches?.length === 1) {
      vehicleId = matches[0].id;
      if (!customerId) customerId = matches[0].customer_id;
    } else if ((matches?.length ?? 0) > 1) {
      await supabase.from("document_review_queue").insert({
        document_id: documentId,
        reason: "multi_match",
        details: { vin, matches: matches?.map((m) => m.id) },
      });
    }
  }

  // Name -> customer
  const customerName = (extracted?.customer_name || "").toString().trim();
  if (customerName && !customerId) {
    const { data: matches } = await supabase
      .from("customers")
      .select("id")
      .ilike("name", `%${customerName}%`)
      .limit(5);
    if (matches?.length === 1) customerId = matches[0].id;
  }

  // Pick latest open job for that customer/vehicle
  if (!jobId && (vehicleId || customerId)) {
    let q = supabase.from("jobs").select("id").order("created_at", { ascending: false }).limit(2);
    if (vehicleId) q = q.eq("vehicle_id", vehicleId);
    else if (customerId) q = q.eq("customer_id", customerId);
    const { data: jobs } = await q;
    if (jobs?.length === 1) jobId = jobs[0].id;
  }

  if (vehicleId !== doc.vehicle_id || customerId !== doc.customer_id || jobId !== doc.job_id) {
    await supabase
      .from("documents")
      .update({
        vehicle_id: vehicleId,
        customer_id: customerId,
        job_id: jobId,
        processing_status: jobId ? "linked" : doc.processing_status,
      })
      .eq("id", documentId);
  }

  if (!jobId) {
    await supabase.from("document_review_queue").insert({
      document_id: documentId,
      reason: "no_match",
      details: { vin, customer_name: customerName },
    });
    return;
  }

  // Type-specific side effects
  if (docType === "insurance_document") {
    const claimStatus = extracted?.claim_status;
    await supabase.from("insurance_claims").insert({
      job_id: jobId,
      claim_number: extracted?.claim_number ?? null,
      insurer: extracted?.insurer ?? null,
      policy_number: extracted?.policy_number ?? null,
      status: claimStatus ?? "pending",
      approved_amount: extracted?.approved_amount ?? null,
      effective_date: extracted?.effective_date ?? null,
    });
    if (claimStatus === "approved" || claimStatus === "partial") {
      await applyJobEvent(supabase, {
        jobId,
        event: "insurance_approved",
        sourceDocumentId: documentId,
      });
    } else if (claimStatus === "denied") {
      await applyJobEvent(supabase, {
        jobId,
        event: "insurance_denied",
        sourceDocumentId: documentId,
      });
    }
  } else if (docType === "purchase_order") {
    await applyJobEvent(supabase, { jobId, event: "po_linked", sourceDocumentId: documentId });
  } else if (docType === "release_form") {
    await applyJobEvent(supabase, { jobId, event: "release_linked", sourceDocumentId: documentId });
  } else if (docType === "invoice") {
    const paid = extracted?.payment_status === "paid";
    await supabase.from("invoices").insert({
      document_id: documentId,
      job_id: jobId,
      vendor: extracted?.vendor ?? null,
      invoice_date: extracted?.invoice_date ?? null,
      amount: extracted?.subtotal ?? null,
      tax: extracted?.tax ?? null,
      total: extracted?.total ?? null,
      currency: extracted?.currency ?? "USD",
      due_date: extracted?.due_date ?? null,
      payment_status: paid ? "paid" : "unpaid",
      paid_at: paid ? new Date().toISOString() : null,
      created_by: doc.uploaded_by,
    });
    await applyJobEvent(supabase, {
      jobId,
      event: paid ? "invoice_paid" : "invoice_unpaid",
      sourceDocumentId: documentId,
    });
  }
}

// Backfill: for historical docs, create customer/vehicle/job from extracted data
// when no existing match was found by autoLink.
export async function backfillFromDocument(
  supabase: SupabaseClient<Database>,
  documentId: string,
  userId: string,
): Promise<{ created: { customer?: string; vehicle?: string; job?: string } }> {
  const created: { customer?: string; vehicle?: string; job?: string } = {};
  const { data: doc } = await supabase.from("documents").select("*").eq("id", documentId).single();
  if (!doc || doc.job_id) return { created };

  const ex =
    (doc.extracted_data as { extracted?: ExtractedData })?.extracted ?? ({} as ExtractedData);
  const customerName = (ex.customer_name || "").toString().trim();
  const vin = (ex.vin || "").toString().trim();

  let customerId = doc.customer_id;
  let vehicleId = doc.vehicle_id;

  if (!customerId && customerName) {
    const { data: cust } = await supabase
      .from("customers")
      .insert({ name: customerName, created_by: userId })
      .select("id")
      .single();
    if (cust) {
      customerId = cust.id;
      created.customer = cust.id;
    }
  }

  if (!vehicleId && vin && customerId) {
    const { data: veh } = await supabase
      .from("vehicles")
      .insert({ vin, customer_id: customerId, created_by: userId })
      .select("id")
      .single();
    if (veh) {
      vehicleId = veh.id;
      created.vehicle = veh.id;
    }
  }

  let jobId: string | null = null;
  if (customerId && vehicleId) {
    const { data: job } = await supabase
      .from("jobs")
      .insert({
        customer_id: customerId,
        vehicle_id: vehicleId,
        description: `Historical: ${doc.file_name}`,
        status: "completed",
        assigned_to: userId,
      })
      .select("id")
      .single();
    if (job) {
      jobId = job.id;
      created.job = job.id;
      await supabase.from("job_status_events").insert({
        job_id: job.id,
        from_status: null,
        to_status: "completed",
        trigger: "ai",
        reason: "Historical backfill from document",
        source_document_id: documentId,
        actor_id: userId,
      });
    }
  }

  if (customerId || vehicleId || jobId) {
    await supabase
      .from("documents")
      .update({
        customer_id: customerId,
        vehicle_id: vehicleId,
        job_id: jobId,
        processing_status: jobId ? "linked" : doc.processing_status,
      })
      .eq("id", documentId);

    // Create side-effect records (invoice/claim) now that we have a job
    if (jobId) {
      if (doc.type === "invoice") {
        await supabase.from("invoices").insert({
          document_id: documentId,
          job_id: jobId,
          vendor: ex.vendor ?? null,
          invoice_date: ex.invoice_date ?? null,
          amount: ex.subtotal ?? null,
          tax: ex.tax ?? null,
          total: ex.total ?? null,
          currency: ex.currency ?? "USD",
          due_date: ex.due_date ?? null,
          payment_status: ex.payment_status === "paid" ? "paid" : "unpaid",
          paid_at: ex.payment_status === "paid" ? new Date().toISOString() : null,
          created_by: userId,
        });
      } else if (doc.type === "insurance_document") {
        await supabase.from("insurance_claims").insert({
          job_id: jobId,
          claim_number: ex.claim_number ?? null,
          insurer: ex.insurer ?? null,
          policy_number: ex.policy_number ?? null,
          status: ex.claim_status ?? "pending",
          approved_amount: ex.approved_amount ?? null,
          effective_date: ex.effective_date ?? null,
        });
      }
    }
  }

  return { created };
}
