import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("invoices")
      .select("*, job:jobs(id, description)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const markInvoicePaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: inv } = await context.supabase
      .from("invoices")
      .select("job_id")
      .eq("id", data.id)
      .single();
    await context.supabase
      .from("invoices")
      .update({ payment_status: "paid", paid_at: new Date().toISOString() })
      .eq("id", data.id);
    if (inv?.job_id) {
      const { applyJobEvent } = await import("./state-machine.server");
      await applyJobEvent(context.supabase, {
        jobId: inv.job_id,
        event: "invoice_paid",
        actorId: context.userId,
      });
    }
    return { ok: true };
  });
