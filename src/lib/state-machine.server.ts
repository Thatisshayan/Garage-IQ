// Job status state machine. All transitions write a job_status_events row.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type JobStatus = Database["public"]["Enums"]["job_status"];
export type StatusTrigger = Database["public"]["Enums"]["status_trigger"];

// Event names emitted by the document pipeline / invoice flow
export type JobEvent =
  | "insurance_approved"
  | "insurance_denied"
  | "po_linked"
  | "release_linked"
  | "invoice_unpaid"
  | "invoice_paid";

// Returns the target status given current status + event, or null if no transition.
export function nextStatusFor(current: JobStatus, event: JobEvent): JobStatus | null {
  if (event === "insurance_denied") return "pending";
  if (event === "insurance_approved" && current === "pending") return "awaiting_insurance";
  if (event === "po_linked" && (current === "pending" || current === "awaiting_insurance"))
    return "parts_ordered";
  if (event === "release_linked" && current === "parts_ordered") return "in_progress";
  if (event === "invoice_unpaid" && current === "in_progress") return "awaiting_payment";
  if (event === "invoice_paid" && current === "awaiting_payment") return "completed";
  return null;
}

export async function applyJobEvent(
  supabase: SupabaseClient<Database>,
  params: {
    jobId: string;
    event: JobEvent;
    sourceDocumentId?: string | null;
    actorId?: string | null;
  },
) {
  const { data: job, error } = await supabase
    .from("jobs")
    .select("id, status")
    .eq("id", params.jobId)
    .single();
  if (error || !job) return { transitioned: false, reason: "job_not_found" };

  const next = nextStatusFor(job.status as JobStatus, params.event);
  if (!next) return { transitioned: false, reason: "no_transition" };

  const flagged = params.event === "insurance_denied";

  const { error: updErr } = await supabase
    .from("jobs")
    .update({ status: next, flagged: flagged ? true : undefined })
    .eq("id", params.jobId);
  if (updErr) return { transitioned: false, reason: updErr.message };

  await supabase.from("job_status_events").insert({
    job_id: params.jobId,
    from_status: job.status,
    to_status: next,
    trigger: "event",
    source_document_id: params.sourceDocumentId ?? null,
    actor_id: params.actorId ?? null,
    reason: `event:${params.event}`,
  });

  return { transitioned: true, from: job.status, to: next };
}

export async function manualTransition(
  supabase: SupabaseClient<Database>,
  params: { jobId: string; toStatus: JobStatus; reason: string; actorId: string },
) {
  const { data: job } = await supabase
    .from("jobs")
    .select("status")
    .eq("id", params.jobId)
    .single();
  if (!job) throw new Error("Job not found");

  await supabase.from("jobs").update({ status: params.toStatus }).eq("id", params.jobId);
  await supabase.from("job_status_events").insert({
    job_id: params.jobId,
    from_status: job.status,
    to_status: params.toStatus,
    trigger: "manual",
    reason: params.reason,
    actor_id: params.actorId,
  });
  return { ok: true };
}
