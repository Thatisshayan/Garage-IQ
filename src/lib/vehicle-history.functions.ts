import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getVehicleHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: vehicle, error } = await sb
      .from("vehicles")
      .select("*, customer:customers(*)")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);

    const [jobs, docs, invoices, claims] = await Promise.all([
      sb
        .from("jobs")
        .select("id,description,status,total_owed,reported_problem,odometer,created_at,updated_at")
        .eq("vehicle_id", data.id)
        .order("created_at", { ascending: false }),
      sb
        .from("documents")
        .select("id,file_name,type,processing_status,created_at,is_historical,archived_at,job_id")
        .eq("vehicle_id", data.id)
        .order("created_at", { ascending: false }),
      sb
        .from("invoices")
        .select("id,vendor,total,currency,payment_status,invoice_date,job_id")
        .in(
          "job_id",
          (await sb.from("jobs").select("id").eq("vehicle_id", data.id)).data?.map((j) => j.id) ?? [
            "00000000-0000-0000-0000-000000000000",
          ],
        )
        .order("invoice_date", { ascending: false, nullsFirst: false }),
      sb
        .from("insurance_claims")
        .select(
          "id,claim_number,insurer,policy_number,status,approved_amount,effective_date,job_id",
        )
        .in(
          "job_id",
          (await sb.from("jobs").select("id").eq("vehicle_id", data.id)).data?.map((j) => j.id) ?? [
            "00000000-0000-0000-0000-000000000000",
          ],
        )
        .order("effective_date", { ascending: false, nullsFirst: false }),
    ]);

    return {
      vehicle,
      jobs: jobs.data ?? [],
      documents: docs.data ?? [],
      invoices: invoices.data ?? [],
      claims: claims.data ?? [],
    };
  });

export const quickLookup = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ q: z.string().min(1).max(60) }).parse(d))
  .handler(async ({ data, context }) => {
    const q = data.q.trim();
    const like = `%${q}%`;
    const [vehicles, customers] = await Promise.all([
      context.supabase
        .from("vehicles")
        .select("id,make,model,year,vin,license_plate,customer:customers(id,name)")
        .or(`vin.ilike.${like},license_plate.ilike.${like}`)
        .limit(8),
      context.supabase
        .from("customers")
        .select("id,name,phone")
        .or(`name.ilike.${like},phone.ilike.${like}`)
        .limit(6),
    ]);
    return {
      vehicles: vehicles.data ?? [],
      customers: customers.data ?? [],
    };
  });
