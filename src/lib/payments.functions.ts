import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { PaymentInput } from "./schemas";

export const listJobPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ job_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: payments, error } = await context.supabase
      .from("payments")
      .select("*")
      .eq("job_id", data.job_id)
      .order("paid_at", { ascending: false });
    if (error) throw new Error(error.message);
    const { data: job } = await context.supabase
      .from("jobs")
      .select("total_owed")
      .eq("id", data.job_id)
      .single();
    const totalPaid = (payments ?? []).reduce((s, p: any) => s + Number(p.amount ?? 0), 0);
    const byInsurance = (payments ?? [])
      .filter((p: any) => p.payer_type === "insurance")
      .reduce((s, p: any) => s + Number(p.amount ?? 0), 0);
    const byClient = (payments ?? [])
      .filter((p: any) => p.payer_type === "client")
      .reduce((s, p: any) => s + Number(p.amount ?? 0), 0);
    return {
      payments: payments ?? [],
      totalOwed: job?.total_owed ? Number(job.total_owed) : null,
      totalPaid,
      byInsurance,
      byClient,
      outstanding: job?.total_owed ? Number(job.total_owed) - totalPaid : null,
    };
  });

export const addPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PaymentInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("payments").insert({
      job_id: data.job_id,
      payer_type: data.payer_type,
      payer_name: data.payer_name || null,
      amount: data.amount,
      currency: data.currency || "CAD",
      method: data.method || null,
      note: data.note || null,
      paid_at: data.paid_at ? new Date(data.paid_at).toISOString() : new Date().toISOString(),
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("payments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setJobTotalOwed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ job_id: z.string().uuid(), total_owed: z.coerce.number().nonnegative() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("jobs")
      .update({ total_owed: data.total_owed })
      .eq("id", data.job_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
