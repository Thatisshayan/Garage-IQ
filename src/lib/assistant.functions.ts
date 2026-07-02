// AI Assistant: read-only NL → structured query plan over allowed tables.
// We do not let the model generate raw SQL. Instead the model returns a JSON
// query plan and the server executes it via the Supabase client.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText } from "ai";
import { getAiGateway } from "./ai-gateway.server";

const ALLOWED_TABLES = [
  "customers",
  "vehicles",
  "jobs",
  "insurance_claims",
  "documents",
  "invoices",
  "job_status_events",
  "document_review_queue",
] as const;

const PlanSchema = z.object({
  table: z.enum(ALLOWED_TABLES),
  columns: z.string().default("*"),
  filters: z
    .array(
      z.object({
        column: z.string().max(60),
        op: z.enum(["eq", "neq", "ilike", "gt", "gte", "lt", "lte", "in", "is"]),
        value: z.any(),
      }),
    )
    .default([]),
  order: z
    .object({ column: z.string().max(60), ascending: z.boolean().default(false) })
    .optional(),
  limit: z.number().int().min(1).max(100).default(25),
  explanation: z.string().max(500),
});

const SYSTEM = `You are a read-only assistant for a car-garage database. Given a question, output strict JSON describing one safe SELECT query. Tables and key columns:
- customers(id,name,email,phone,address)
- vehicles(id,customer_id,make,model,year,vin,license_plate,color)
- jobs(id,customer_id,vehicle_id,description,status,flagged,created_at) status in (pending,awaiting_insurance,parts_ordered,in_progress,awaiting_payment,completed)
- insurance_claims(id,job_id,claim_number,insurer,policy_number,status,approved_amount) status in (pending,approved,denied,partial)
- documents(id,job_id,customer_id,vehicle_id,type,file_name,processing_status,created_at)
- invoices(id,job_id,vendor,total,payment_status,due_date,paid_at) payment_status in (unpaid,paid,overdue,disputed)
- job_status_events(id,job_id,from_status,to_status,trigger,reason,created_at)
- document_review_queue(id,document_id,reason,resolved_at)

Return JSON of shape: {"table":"...","columns":"*","filters":[{"column":"...","op":"eq|neq|ilike|gt|gte|lt|lte|in|is","value":...}],"order":{"column":"created_at","ascending":false},"limit":25,"explanation":"plain English"}`;

function parseJson(text: string): any {
  const m = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/i);
  const raw = m ? m[1] : text;
  const s = raw.indexOf("{");
  const e = raw.lastIndexOf("}");
  return JSON.parse(raw.slice(s, e + 1));
}

export const aiAssistantQuery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ question: z.string().min(2).max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const gateway = getAiGateway();
    const model = gateway("google/gemini-3-flash-preview");
    const result = await generateText({
      model,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: data.question },
      ],
    });
    let plan;
    try {
      plan = PlanSchema.parse(parseJson(result.text));
    } catch (e: any) {
      return { error: "Could not parse assistant plan", raw: result.text };
    }

    let q: any = context.supabase.from(plan.table).select(plan.columns);
    for (const f of plan.filters) {
      switch (f.op) {
        case "eq":
          q = q.eq(f.column, f.value);
          break;
        case "neq":
          q = q.neq(f.column, f.value);
          break;
        case "ilike":
          q = q.ilike(f.column, String(f.value));
          break;
        case "gt":
          q = q.gt(f.column, f.value);
          break;
        case "gte":
          q = q.gte(f.column, f.value);
          break;
        case "lt":
          q = q.lt(f.column, f.value);
          break;
        case "lte":
          q = q.lte(f.column, f.value);
          break;
        case "in":
          q = q.in(f.column, Array.isArray(f.value) ? f.value : [f.value]);
          break;
        case "is":
          q = q.is(f.column, f.value);
          break;
      }
    }
    if (plan.order) q = q.order(plan.order.column, { ascending: plan.order.ascending });
    q = q.limit(plan.limit);
    const { data: rows, error } = await q;
    if (error) return { error: error.message, plan };
    return { rows: rows ?? [], plan };
  });
