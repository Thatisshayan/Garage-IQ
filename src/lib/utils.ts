import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Extract and parse JSON from LLM text output.
 * Handles markdown code fences and finds the first JSON object.
 */
export function parseJson(text: string): any {
  const m = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/i);
  const raw = m ? m[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON in model output");
  return JSON.parse(raw.slice(start, end + 1));
}

/**
 * Sanitize user input for use in Supabase `ilike` queries.
 * Escapes SQL LIKE wildcards (% and _) to prevent unintended pattern matching.
 */
export function sanitizeLike(input: string): string {
  return input.replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * Simple in-memory rate limiter for server functions.
 * Returns true if the request should be blocked (rate limited).
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function isRateLimited(key: string, maxRequests = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  bucket.count++;
  return bucket.count > maxRequests;
}
