import { afterEach, describe, expect, it, vi } from "vitest";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});
describe("API environment configuration", () => {
  it("uses the configured API path and keeps session cookies on the frontend origin", async () => {
    vi.stubEnv("VITE_API_URL", "/gateway/api/");
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response("null", { status: 200, headers: { "Content-Type": "application/json" } }),
      );
    vi.stubGlobal("fetch", fetch);
    const { currentUser } = await import("@/lib/api");
    expect(await currentUser()).toBeNull();
    expect(fetch).toHaveBeenCalledWith(
      "/gateway/api/auth/me",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });
  it("defaults to the same-origin API and preserves backend errors", async () => {
    vi.stubEnv("VITE_API_URL", "");
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Sign in to continue." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetch);
    const { getDashboard } = await import("@/lib/api");
    await expect(getDashboard()).rejects.toMatchObject({
      status: 401,
      message: "Sign in to continue.",
    });
    expect(fetch).toHaveBeenCalledWith("/api/dashboard", expect.any(Object));
  });
});
