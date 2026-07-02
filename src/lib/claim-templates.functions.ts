import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listClaimTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("claim_templates")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const getClaimTemplate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: tpl, error } = await context.supabase
      .from("claim_templates").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    const { data: signed } = await context.supabase.storage
      .from("workshop-documents")
      .createSignedUrl(tpl.storage_path, 60 * 30);
    return { ...tpl, signed_url: signed?.signedUrl ?? null };
  });

export const createClaimTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      name: z.string().min(1).max(120),
      insurer: z.string().max(120).optional().nullable(),
      storage_path: z.string().min(1),
      notes: z.string().max(2000).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("claim_templates")
      .insert({
        name: data.name,
        insurer: data.insurer ?? null,
        storage_path: data.storage_path,
        notes: data.notes ?? null,
        created_by: context.userId,
      })
      .select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const saveTemplateFieldMap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      field_map: z.record(z.string(), z.string()),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("claim_templates")
      .update({ field_map: data.field_map })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteClaimTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: tpl } = await context.supabase
      .from("claim_templates").select("storage_path").eq("id", data.id).single();
    if (tpl?.storage_path) {
      await context.supabase.storage.from("workshop-documents").remove([tpl.storage_path]);
    }
    const { error } = await context.supabase
      .from("claim_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Fetch job + related data used to fill a claim template. */
export const getClaimFillContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ job_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const [{ data: job }, { data: claim }, { data: invoices }] = await Promise.all([
      sb.from("jobs")
        .select("*, customer:customers(*), vehicle:vehicles(*)")
        .eq("id", data.job_id).single(),
      sb.from("insurance_claims").select("*").eq("job_id", data.job_id).maybeSingle(),
      sb.from("invoices").select("total,currency").eq("job_id", data.job_id),
    ]);
    const invoice_total = (invoices ?? []).reduce((s, i: any) => s + Number(i.total || 0), 0);
    return { job, claim, invoice_total };
  });
