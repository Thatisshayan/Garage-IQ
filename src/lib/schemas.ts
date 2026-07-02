import { z } from "zod";

export const CustomerInput = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Invalid email address").max(255).optional().or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
});

export type CustomerInput = z.infer<typeof CustomerInput>;

export const VehicleInput = z.object({
  customer_id: z.string().uuid("Select a customer"),
  make: z.string().max(100).optional().or(z.literal("")),
  model: z.string().max(100).optional().or(z.literal("")),
  year: z.coerce.number().int().min(1900, "Invalid year").max(2100, "Invalid year").optional().nullable(),
  vin: z.string().max(50).optional().or(z.literal("")),
  license_plate: z.string().max(20).optional().or(z.literal("")),
  color: z.string().max(50).optional().or(z.literal("")),
});

export type VehicleInput = z.infer<typeof VehicleInput>;

export const JobInput = z.object({
  customer_id: z.string().uuid("Select a customer"),
  vehicle_id: z.string().uuid("Select a vehicle"),
  description: z.string().max(2000).optional().or(z.literal("")),
});

export type JobInput = z.infer<typeof JobInput>;

export const PaymentInput = z.object({
  job_id: z.string().uuid(),
  payer_type: z.enum(["insurance", "client", "other"]),
  payer_name: z.string().max(200).optional().or(z.literal("")),
  amount: z.coerce.number().nonnegative("Amount must be positive").max(10_000_000),
  currency: z.string().max(8).default("CAD"),
  method: z.string().max(60).optional().or(z.literal("")),
  note: z.string().max(500).optional().or(z.literal("")),
  paid_at: z.string().optional(),
});

export type PaymentInput = z.infer<typeof PaymentInput>;

export const IntakeInput = z.object({
  customer: z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1, "Name is required").max(200),
    phone: z.string().max(50).optional().or(z.literal("")),
  }),
  vehicle: z.object({
    id: z.string().uuid().optional(),
    vin: z.string().max(17).optional().or(z.literal("")),
    license_plate: z.string().max(20).optional().or(z.literal("")),
    make: z.string().max(100).optional().or(z.literal("")),
    model: z.string().max(100).optional().or(z.literal("")),
    year: z.coerce.number().int().min(1900, "Invalid year").max(2100, "Invalid year").optional().nullable(),
    color: z.string().max(50).optional().or(z.literal("")),
  }),
  job: z.object({
    reported_problem: z.string().max(2000).optional().or(z.literal("")),
    odometer: z.coerce.number().int().nonnegative().optional().nullable(),
  }),
  photo_paths: z.array(z.string().min(1)).max(20).default([]),
});

export type IntakeInput = z.infer<typeof IntakeInput>;
