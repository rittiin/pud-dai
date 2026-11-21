import type { NextConfig } from "next";
import path from "path";
import { loadEnvConfig } from "@next/env";

// Also read .env.local from the parent "Codex Hackthon" folder, so the key works in either place.
// Values in pud-dai/.env.local take priority.
loadEnvConfig(path.resolve(process.cwd(), ".."));

const nextConfig: NextConfig = {};

export default nextConfig;
