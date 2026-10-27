import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiPath = (env["VITE_API_URL"] || "/api").replace(/\/+$/, "");
  if (mode === "production" && apiPath !== "/api") {
    throw new Error(
      "Set VITE_API_URL=/api in Vercel. The Render API is reached through vercel.json rewrites.",
    );
  }
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    server: {
      host: "0.0.0.0",
      port: 5173,
      proxy: { "/api": env["DEV_API_PROXY_TARGET"] || "http://127.0.0.1:3001" },
    },
  };
});
