// Public deployments are demos: keep citizen reports read-only and disable LLM calls.
export const PUBLIC_DEMO_MODE = process.env.PUBLIC_DEMO_MODE === "1" || process.env.VERCEL === "1";
