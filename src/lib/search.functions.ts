import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const searchAll = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ q: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const q = data.q.trim();
    const like = `%${q}%`;
    const [customers, vehicles, jobs, documents, invoices] = await Promise.all([
      context.supabase
        .from("customers")
        .select("id,name,email,phone")
        .or(`name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
        .limit(10),
      context.supabase
        .from("vehicles")
        .select("id,make,model,vin,license_plate,customer_id")
        .or(`vin.ilike.${like},license_plate.ilike.${like},make.ilike.${like},model.ilike.${like}`)
        .limit(10),
      context.supabase
        .from("jobs")
        .select("id,description,status")
        .ilike("description", like)
        .limit(10),
      context.supabase
        .from("documents")
        .select("id,file_name,type,processing_status")
        .or(`file_name.ilike.${like},ocr_text.ilike.${like}`)
        .limit(10),
      context.supabase
        .from("invoices")
        .select("id,vendor,total,payment_status,job_id")
        .ilike("vendor", like)
        .limit(10),
    ]);
    return {
      customers: customers.data ?? [],
      vehicles: vehicles.data ?? [],
      jobs: jobs.data ?? [],
      documents: documents.data ?? [],
      invoices: invoices.data ?? [],
    };
  });
