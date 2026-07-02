import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const VehicleInput = z.object({
  customer_id: z.string().uuid(),
  make: z.string().max(100).optional().or(z.literal("")),
  model: z.string().max(100).optional().or(z.literal("")),
  year: z.coerce.number().int().min(1900).max(2100).optional().nullable(),
  vin: z.string().max(50).optional().or(z.literal("")),
  license_plate: z.string().max(20).optional().or(z.literal("")),
  color: z.string().max(50).optional().or(z.literal("")),
});

export const listVehicles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(200).default(50),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const offset = (data.page - 1) * data.limit;
    const { data: rows, error, count } = await context.supabase
      .from("vehicles")
      .select("*, customer:customers(name)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + data.limit - 1);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0, page: data.page, limit: data.limit };
  });

export const createVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => VehicleInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("vehicles")
      .insert({
        customer_id: data.customer_id,
        make: data.make || null,
        model: data.model || null,
        year: data.year || null,
        vin: data.vin || null,
        license_plate: data.license_plate || null,
        color: data.color || null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("vehicles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => VehicleInput.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error } = await context.supabase
      .from("vehicles")
      .update({
        make: rest.make || null,
        model: rest.model || null,
        year: rest.year || null,
        vin: rest.vin || null,
        license_plate: rest.license_plate || null,
        color: rest.color || null,
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
