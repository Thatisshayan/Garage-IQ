import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const JOB_STATUSES = [
  "pending",
  "awaiting_insurance",
  "parts_ordered",
  "in_progress",
  "awaiting_payment",
  "completed",
] as const;

const JobInput = z.object({
  customer_id: z.string().uuid(),
  vehicle_id: z.string().uuid(),
  description: z.string().max(2000).optional().or(z.literal("")),
});

export const listJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("jobs")
      .select("*, customer:customers(name), vehicle:vehicles(make,model,license_plate,vin)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const getJob = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: job, error } = await context.supabase
      .from("jobs")
      .select(
        "*, customer:customers(*), vehicle:vehicles(*)",
      )
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    const { data: documents } = await context.supabase
      .from("documents")
      .select("*")
      .eq("job_id", data.id)
      .order("created_at", { ascending: false });
    const { data: claims } = await context.supabase
      .from("insurance_claims")
      .select("*")
      .eq("job_id", data.id);
    const { data: invoices } = await context.supabase
      .from("invoices")
      .select("*")
      .eq("job_id", data.id);
    const { data: events } = await context.supabase
      .from("job_status_events")
      .select("*")
      .eq("job_id", data.id)
      .order("created_at", { ascending: false });
    return {
      job,
      documents: documents ?? [],
      claims: claims ?? [],
      invoices: invoices ?? [],
      events: events ?? [],
    };
  });

export const createJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => JobInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("jobs")
      .insert({
        customer_id: data.customer_id,
        vehicle_id: data.vehicle_id,
        description: data.description || null,
        status: "pending",
        assigned_to: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await context.supabase.from("job_status_events").insert({
      job_id: row.id,
      from_status: null,
      to_status: "pending",
      trigger: "manual",
      reason: "Job created",
      actor_id: context.userId,
    });
    return row;
  });

export const overrideJobStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(JOB_STATUSES),
        reason: z.string().min(3).max(1000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: current } = await context.supabase
      .from("jobs")
      .select("status")
      .eq("id", data.id)
      .single();
    if (!current) throw new Error("Job not found");
    const { error } = await context.supabase
      .from("jobs")
      .update({ status: data.status, flagged: false })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("job_status_events").insert({
      job_id: data.id,
      from_status: current.status,
      to_status: data.status,
      trigger: "manual",
      reason: data.reason,
      actor_id: context.userId,
    });
    return { ok: true };
  });

export const dashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: jobs } = await context.supabase.from("jobs").select("status,flagged");
    const counts: Record<string, number> = Object.fromEntries(
      JOB_STATUSES.map((s) => [s, 0]),
    );
    let flagged = 0;
    (jobs ?? []).forEach((j) => {
      counts[j.status] = (counts[j.status] ?? 0) + 1;
      if (j.flagged) flagged += 1;
    });
    const { count: reviewCount } = await context.supabase
      .from("document_review_queue")
      .select("*", { count: "exact", head: true })
      .is("resolved_at", null);
    const { count: unpaidCount } = await context.supabase
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .eq("payment_status", "unpaid");
    const { count: pendingClaims } = await context.supabase
      .from("insurance_claims")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");
    return {
      jobsByStatus: counts,
      flagged,
      reviewCount: reviewCount ?? 0,
      unpaidCount: unpaidCount ?? 0,
      pendingClaims: pendingClaims ?? 0,
    };
  });
