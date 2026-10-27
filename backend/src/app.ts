import express, { type Request, type Response, type NextFunction } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { z } from "zod";
import { Prisma } from "./generated/prisma/client.js";
import { db } from "./db.js";
import { sendEmail } from "./email.js";
import { uploadListingPhotos, removeUploadedPhotos } from "./cloudinary.js";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const production = process.env["NODE_ENV"] === "production";
const cookieName = production ? "__Host-doinggood" : "doinggood_session";
const cookieOptions = { httpOnly: true, secure: production, sameSite: "lax" as const, path: "/" };
const emailInput = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((v) => v.toLowerCase());
const uuid = z.string().uuid();
const phoneInput = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s()-]/g, ""))
  .pipe(
    z
      .string()
      .regex(
        /^\+[1-9]\d{7,14}$/,
        "Use an international WhatsApp number, for example +2348012345678.",
      ),
  );
const listingInput = z.object({
  whatsapp: phoneInput,
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().min(10).max(5000),
  category: z.enum([
    "furniture",
    "clothing",
    "appliances",
    "kitchen",
    "books",
    "baby",
    "electronics",
    "other",
  ]),
  condition: z.enum(["like-new", "good", "gently-used", "needs-repair"]),
  location: z.string().trim().min(2).max(150),
  photos: z
    .array(
      z
        .string()
        .max(1500000)
        .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/),
    )
    .min(1)
    .max(5),
});
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
async function user(req: Request) {
  const token = req.cookies?.[cookieName];
  if (typeof token !== "string") return null;
  const session = await db.session.findUnique({
    where: { id: hash(token) },
    include: { user: true },
  });
  return session && session.expires_at > new Date() ? session.user : null;
}
async function requireUser(req: Request) {
  const profile = await user(req);
  if (!profile) throw new HttpError(401, "Sign in to continue.");
  return profile;
}
const itemView = (item: {
  owner: { full_name: string; phone: string };
  [key: string]: unknown;
}) => {
  const { owner, ...rest } = item;
  return { ...rest, donor_name: owner.full_name, donor_whatsapp: owner.phone };
};
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  if (process.env["TRUST_PROXY"] === "1") app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: production
        ? {
            directives: {
              "img-src": ["'self'", "data:", "blob:", "https://res.cloudinary.com"],
              "script-src": ["'self'"],
            },
          }
        : false,
    }),
  );
  app.use(cookieParser());
  app.use(
    "/api",
    rateLimit({ windowMs: 60000, limit: 120, standardHeaders: "draft-8", legacyHeaders: false }),
  );
  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const origin = req.get("origin");
      const expected = new URL(process.env["APP_URL"] || "http://localhost:5173").origin;
      if (origin && origin !== expected)
        return next(new HttpError(403, "Request origin is not allowed."));
      if (req.get("sec-fetch-site") === "cross-site")
        return next(new HttpError(403, "Request origin is not allowed."));
      if (!req.is("application/json")) return next(new HttpError(415, "Send JSON data."));
    }
    next();
  });
  app.use(express.json({ limit: "8mb" }));
  const authLimit = rateLimit({
    windowMs: 15 * 60000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
  app.get("/", (_req, res) => {
    res.json({ service: "DoingGood API", health: "/api/health" });
  });
  app.get("/api/health", async (_req, res) => {
    await db.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  });
  app.get("/api/auth/me", async (req, res) => {
    res.json(await user(req));
  });
  app.post("/api/auth/code", authLimit, async (req, res) => {
    const input = z
      .object({ email: emailInput, full_name: z.string().trim().min(2).max(100).optional() })
      .parse(req.body);
    const existing = await db.user.findUnique({ where: { email: input.email } });
    const code = String(randomInt(100000, 1000000));
    const challenge = await db.loginCode.upsert({
      where: { email: input.email },
      create: {
        email: input.email,
        full_name: existing?.full_name || input.full_name || input.email.split("@")[0]!,
        code_hash: hash(code),
        expires_at: new Date(Date.now() + 10 * 60000),
      },
      update: {
        code_hash: hash(code),
        attempts: 0,
        expires_at: new Date(Date.now() + 10 * 60000),
        full_name: existing?.full_name || input.full_name || input.email.split("@")[0]!,
      },
    });
    try {
      await sendEmail(
        input.email,
        "Your DoingGood sign-in code",
        `Your sign-in code is ${code}. It expires in 10 minutes. If you did not request this code, ignore this email.`,
      );
    } catch {
      await db.loginCode.deleteMany({ where: { id: challenge.id, code_hash: hash(code) } });
      throw new HttpError(503, "Could not send your sign-in email. Please try again later.");
    }
    res.json({ ok: true });
  });
  app.post("/api/auth/verify", authLimit, async (req, res) => {
    const input = z
      .object({ email: emailInput, code: z.string().regex(/^\d{6}$/) })
      .parse(req.body);
    const token = randomBytes(32).toString("hex");
    const expires_at = new Date(Date.now() + 30 * 86400000);
    const profile = await db.$transaction(async (tx) => {
      const attempts = await tx.loginCode.updateMany({
        where: { email: input.email, expires_at: { gt: new Date() }, attempts: { lt: 5 } },
        data: { attempts: { increment: 1 } },
      });
      if (!attempts.count) return null;
      const challenge = await tx.loginCode.findUnique({ where: { email: input.email } });
      if (!challenge || challenge.code_hash !== hash(input.code)) return null;
      await tx.loginCode.delete({ where: { id: challenge.id } });
      const profile = await tx.user.upsert({
        where: { email: input.email },
        create: { email: input.email, full_name: challenge.full_name },
        update: {},
      });
      await tx.session.deleteMany({ where: { expires_at: { lt: new Date() } } });
      await tx.session.create({ data: { id: hash(token), user_id: profile.id, expires_at } });
      return profile;
    });
    if (!profile)
      throw new HttpError(400, "Invalid or expired code. Request a new code after five attempts.");
    res.cookie(cookieName, token, { ...cookieOptions, expires: expires_at }).json(profile);
  });
  app.post("/api/auth/logout", async (req, res) => {
    const token = req.cookies?.[cookieName];
    if (typeof token === "string") await db.session.deleteMany({ where: { id: hash(token) } });
    res.clearCookie(cookieName, cookieOptions).json({ ok: true });
  });
  app.get("/api/items", async (req, res) => {
    const page = z.coerce.number().int().min(0).max(10000).default(0).parse(req.query["page"]);
    const items = await db.item.findMany({
      where: { status: { in: ["available", "pending"] } },
      include: { owner: { select: { full_name: true, phone: true } } },
      orderBy: [{ created_at: "desc" }, { id: "asc" }],
      take: 50,
      skip: page * 50,
    });
    res.json(items.map(itemView));
  });
  app.get("/api/items/:id", async (req, res) => {
    if (!uuid.safeParse(req.params["id"]).success)
      return void res.status(404).json({ error: "Item not found." });
    const item = await db.item.findUnique({
      where: { id: String(req.params["id"]) },
      include: { owner: { select: { full_name: true, phone: true } } },
    });
    res.json(item ? itemView(item) : null);
  });
  app.post(
    "/api/items",
    rateLimit({
      windowMs: 15 * 60000,
      limit: 15,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
    async (req, res) => {
      const profile = await requireUser(req);
      const { whatsapp, photos, ...data } = listingInput.parse(req.body);
      let assets: Awaited<ReturnType<typeof uploadListingPhotos>>;
      try {
        assets = await uploadListingPhotos(photos, profile.id);
      } catch {
        throw new HttpError(503, "Photo upload failed. Please try again.");
      }
      try {
        const item = await db.$transaction(async (tx) => {
          await tx.user.update({ where: { id: profile.id }, data: { phone: whatsapp } });
          return tx.item.create({
            data: { ...data, photos: assets.map((asset) => asset.url), owner_id: profile.id },
            include: { owner: { select: { full_name: true, phone: true } } },
          });
        });
        res.status(201).json(itemView(item));
      } catch (error) {
        await removeUploadedPhotos(assets.map((asset) => asset.publicId));
        throw error;
      }
    },
  );
  app.get("/api/dashboard", async (req, res) => {
    const profile = await requireUser(req);
    const listings = await db.item.findMany({
      where: { owner_id: profile.id },
      include: { owner: { select: { full_name: true, phone: true } } },
      orderBy: { created_at: "desc" },
    });
    res.json({ profile, listings: listings.map(itemView) });
  });
  app.patch("/api/profile", async (req, res) => {
    const profile = await requireUser(req);
    const data = z
      .object({
        full_name: z.string().trim().min(2).max(100),
        phone: phoneInput,
      })
      .parse(req.body);
    res.json(await db.user.update({ where: { id: profile.id }, data }));
  });
  app.patch("/api/items/:id/status", async (req, res) => {
    const profile = await requireUser(req);
    const id = uuid.parse(req.params["id"]);
    const { status } = z
      .object({ status: z.enum(["available", "pending", "matched", "given"]) })
      .parse(req.body);
    const updated = await db.item.updateMany({
      where: { id, owner_id: profile.id },
      data: { status },
    });
    if (!updated.count) throw new HttpError(404, "Listing not found.");
    res.json({ ok: true });
  });
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Endpoint not found." });
  });
  app.use((_req, res) => {
    res.status(404).json({ error: "Endpoint not found." });
  });
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof z.ZodError)
      return void res.status(400).json({ error: error.issues[0]?.message || "Invalid input." });
    if (error instanceof HttpError)
      return void res.status(error.status).json({ error: error.message });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      return void res.status(409).json({ error: "This record already exists." });
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      (error.status === 413 || error.status === 400)
    )
      return void res
        .status(Number(error.status))
        .json({ error: "Invalid or oversized JSON request." });
    console.error("API request failed", { type: error instanceof Error ? error.name : "Unknown" });
    res
      .status(500)
      .json({ error: "The server could not complete your request. Please try again." });
  });
  return app;
}
