import { loadEnv } from "vite";

const env = loadEnv("production", process.cwd(), "");
const backendUrl = process.env["BACKEND_URL"] || env["BACKEND_URL"];
if (!backendUrl) throw new Error("Set BACKEND_URL in Vercel to your Render service URL.");
const backend = new URL(backendUrl);
if (
  backend.protocol !== "https:" ||
  backend.username ||
  backend.password ||
  backend.pathname !== "/" ||
  backend.search ||
  backend.hash
) {
  throw new Error("BACKEND_URL must be an HTTPS origin without a path or credentials.");
}

export const config = {
  framework: "vite",
  buildCommand: "npm run build",
  outputDirectory: "dist",
  rewrites: [
    { source: "/api/:path*", destination: `${backend.origin}/api/:path*` },
    { source: "/(.*)", destination: "/index.html" },
  ],
};
