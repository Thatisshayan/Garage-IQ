export function reportError(error: unknown, context: Record<string, unknown> = {}) {
  console.error("[GarageIQ Error]", error, context);
}
