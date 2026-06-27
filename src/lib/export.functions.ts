import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const EXPORTABLE = [
  "customers",
  "vehicles",
  "jobs",
  "insurance_claims",
  "documents",
  "invoices",
  "job_status_events",
] as const;

function toCsv(rows: any[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: any) => {
    if (v == null) return "";
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

export const exportEntity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ entity: z.enum(EXPORTABLE), format: z.enum(["csv", "json"]) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from(data.entity).select("*");
    if (error) throw new Error(error.message);
    if (data.format === "json")
      return { filename: `${data.entity}.json`, content: JSON.stringify(rows, null, 2), mime: "application/json" };
    return { filename: `${data.entity}.csv`, content: toCsv(rows ?? []), mime: "text/csv" };
  });
