import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText } from "ai";
import { getAiGateway } from "./ai-gateway.server";
import { IntakeInput } from "./schemas";
import { sanitizeLike, isRateLimited } from "./utils";

// Use AI vision to extract a VIN and/or license plate from a photo.
// Input: base64 data URL of the image.
export const extractVinFromPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        image_data_url: z.string().min(20),
        kind: z.enum(["vin", "plate", "odometer"]).default("vin"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (isRateLimited(`intake:${context.user.id}`, 15, 60_000)) {
      return { error: "Rate limit exceeded. Try again in a minute." };
    }
    const provider = getAiGateway();
    const model = provider("google/gemini-2.5-flash");

    const prompts: Record<string, string> = {
      vin: 'Read the VIN (17-character vehicle identification number) from this photo. VINs never use the letters I, O, or Q. Return STRICT JSON only: {"vin":"<17 chars or null>","confidence":0..1}. No prose.',
      plate:
        'Read the license plate number from this photo. Return STRICT JSON only: {"plate":"<text or null>","confidence":0..1}. No prose.',
      odometer:
        'Read the odometer reading (whole kilometers/miles) from this photo. Return STRICT JSON only: {"odometer":<integer or null>,"confidence":0..1}. No prose.',
    };

    const result = await generateText({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompts[data.kind] },
            { type: "image", image: data.image_data_url },
          ],
        },
      ],
    });

    let parsed: any = {};
    try {
      const match = result.text.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : {};
    } catch {
      parsed = {};
    }
    return parsed;
  });

// Free NHTSA VIN decoder - no API key, no auth needed (public).
export const decodeVin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ vin: z.string().min(11).max(17) }).parse(d))
  .handler(async ({ data }) => {
    const res = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(data.vin)}?format=json`,
    );
    if (!res.ok) return { ok: false, error: `NHTSA ${res.status}` };
    const json = (await res.json()) as { Results?: any[] };
    const r = json.Results?.[0] ?? {};
    return {
      ok: true,
      make: r.Make || null,
      model: r.Model || null,
      year: r.ModelYear ? Number(r.ModelYear) : null,
      body: r.BodyClass || null,
      engine: r.EngineConfiguration || null,
      fuel: r.FuelTypePrimary || null,
    };
  });

// Duplicate guard: returns possible existing customers (fuzzy on name, exact on phone).
export const findDuplicateCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().min(1).max(200).optional(),
        phone: z.string().max(50).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!data.name && !data.phone) return [];
    let q = context.supabase.from("customers").select("id,name,phone,email").limit(8);
    if (data.phone) q = q.eq("phone", data.phone);
    else if (data.name) q = q.ilike("name", `%${sanitizeLike(data.name)}%`);
    const { data: rows } = await q;
    return rows ?? [];
  });

export const findVehicleByVin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ vin: z.string().min(8).max(17) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("vehicles")
      .select("*, customer:customers(id,name,phone)")
      .ilike("vin", data.vin)
      .limit(3);
    return rows ?? [];
  });

// One-shot mobile intake: creates (or reuses) customer + vehicle + job and links uploaded photos.
export const submitMobileIntake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IntakeInput.parse(d))
  .handler(async ({ data, context }) => {
    // 1. Customer
    let customerId = data.customer.id;
    if (!customerId) {
      const { data: c, error } = await context.supabase
        .from("customers")
        .insert({
          name: data.customer.name,
          phone: data.customer.phone || null,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      customerId = c.id;
    }

    // 2. Vehicle
    let vehicleId = data.vehicle.id;
    if (!vehicleId) {
      const { data: v, error } = await context.supabase
        .from("vehicles")
        .insert({
          customer_id: customerId,
          vin: data.vehicle.vin || null,
          license_plate: data.vehicle.license_plate || null,
          make: data.vehicle.make || null,
          model: data.vehicle.model || null,
          year: data.vehicle.year || null,
          color: data.vehicle.color || null,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      vehicleId = v.id;
    }

    // 3. Job
    const { data: job, error: jerr } = await context.supabase
      .from("jobs")
      .insert({
        customer_id: customerId,
        vehicle_id: vehicleId,
        description: data.job.reported_problem || "Mobile intake",
        reported_problem: data.job.reported_problem || null,
        odometer: data.job.odometer ?? null,
        status: "pending",
        assigned_to: context.userId,
      })
      .select()
      .single();
    if (jerr) throw new Error(jerr.message);

    await context.supabase.from("job_status_events").insert({
      job_id: job.id,
      from_status: null,
      to_status: "pending",
      trigger: "manual",
      reason: "Mobile intake",
      actor_id: context.userId,
    });

    // 4. Link photo documents
    for (const path of data.photo_paths) {
      await context.supabase.from("documents").insert({
        storage_path: path,
        file_name: path.split("/").pop() ?? path,
        mime_type: "image/jpeg",
        type: "other",
        processing_status: "linked",
        job_id: job.id,
        customer_id: customerId,
        vehicle_id: vehicleId,
        uploaded_by: context.userId,
      });
    }

    return { ok: true, jobId: job.id, customerId, vehicleId };
  });
