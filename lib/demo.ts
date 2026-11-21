// Public deployments are demos: keep citizen reports read-only and disable LLM calls.
export const PUBLIC_DEMO_MODE = process.env.PUBLIC_DEMO_MODE === "1" || process.env.VERCEL === "1";
// AI symptom reading stays opt-in per user; on public demos it is on unless PUBLIC_AI=0.
export const AI_ALLOWED = !PUBLIC_DEMO_MODE || process.env.PUBLIC_AI !== "0";
