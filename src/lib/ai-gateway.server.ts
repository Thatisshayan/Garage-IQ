import { createGoogleGenerativeAI } from "@ai-sdk/google";

export function getAiGateway() {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) throw new Error("Missing GOOGLE_GENERATIVE_AI_API_KEY — set it in your .env");
  const google = createGoogleGenerativeAI({ apiKey: key });
  return (model: string) => google(model);
}
