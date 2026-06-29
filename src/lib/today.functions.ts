import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Active jobs grouped by blocker for the day-of view.
export const todayBoard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: jobs, error } = await context.supabase
      .from("jobs")
      .select(
        "id,status,description,flagged,reported_problem,odometer,created_at,total_owed,customer:customers(id,name,phone),vehicle:vehicles(id,make,model,year,license_plate,vin)",
      )
      .neq("status", "completed")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    // Compute payment totals per active job
    const ids = (jobs ?? []).map((j) => j.id);
    let payMap = new Map<string, number>();
    if (ids.length) {
      const { data: pays } = await context.supabase
        .from("payments")
        .select("job_id,amount")
        .in("job_id", ids);
      (pays ?? []).forEach((p: any) => {
        payMap.set(p.job_id, (payMap.get(p.job_id) ?? 0) + Number(p.amount));
      });
    }

    const buckets: Record<string, any[]> = {
      awaiting_insurance: [],
      parts_ordered: [],
      in_progress: [],
      awaiting_payment: [],
      pending: [],
    };
    (jobs ?? []).forEach((j: any) => {
      const totalPaid = payMap.get(j.id) ?? 0;
      const outstanding = j.total_owed ? Number(j.total_owed) - totalPaid : null;
      const enriched = { ...j, totalPaid, outstanding };
      (buckets[j.status] ??= []).push(enriched);
    });

    return {
      buckets,
      counts: {
        active: jobs?.length ?? 0,
        flagged: (jobs ?? []).filter((j: any) => j.flagged).length,
      },
    };
  });
