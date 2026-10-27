import express, { type Request, type Response, type NextFunction } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { Prisma } from "./generated/prisma/client.js";
import { db } from "./db.js";
import { sendEmail } from "./email.js";
import { hashPassword, verifyPassword } from "./passwords.js";
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
const passwordInput = z.string().min(12, "Use a password with at least 12 characters.").max(128);
const profileSelect = {
  id: true,
  email: true,
  full_name: true,
  phone: true,
  created_at: true,
} satisfies Prisma.UserSelect;
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
    include: { user: { select: profileSelect } },
  });
  return session && session.expires_at > new Date() ? session.user : null;
}
async function requireUser(req: Request) {
  const profile = await user(req);
  if (!profile) throw new HttpError(401, "Sign in to continue.");
  return profile;
}
const itemView = (
  item: {
    owner: { full_name: string; phone: string };
    [key: string]: unknown;
  },
  signedIn: boolean,
) => {
  const { owner, ...rest } = item;
  return {
    ...rest,
    donor_name: owner.full_name,
    donor_whatsapp: signedIn ? owner.phone : "",
  };
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
    limit: 20,
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
  async function sessionResponse(res: Response, profileId: string, expectedHash: string) {
    const token = randomBytes(32).toString("hex");
    const expires_at = new Date(Date.now() + 30 * 86400000);
    const profile = await db.$transaction(async (tx) => {
      // Serialize against reset so old credentials cannot create a session after a password change.
      const current = await tx.user.updateMany({
        where: { id: profileId, password_hash: expectedHash },
        data: { password_hash: expectedHash },
      });
      if (!current.count)
        throw new HttpError(401, "Your credentials changed. Please sign in again.");
      await tx.session.deleteMany({ where: { expires_at: { lt: new Date() } } });
      await tx.session.create({ data: { id: hash(token), user_id: profileId, expires_at } });
      return tx.user.findUniqueOrThrow({ where: { id: profileId }, select: profileSelect });
    });
    return res.cookie(cookieName, token, { ...cookieOptions, expires: expires_at }).json(profile);
  }
  app.post("/api/auth/register", authLimit, async (req, res) => {
    const input = z
      .object({
        email: emailInput,
        password: passwordInput,
        full_name: z.string().trim().min(2).max(100),
      })
      .parse(req.body);
    const password_hash = await hashPassword(input.password);
    const profile = await db.user.create({
      data: { email: input.email, full_name: input.full_name, password_hash },
      select: { id: true },
    });
    await sessionResponse(res.status(201), profile.id, password_hash);
  });
  app.post("/api/auth/login", authLimit, async (req, res) => {
    const input = z
      .object({ email: emailInput, password: z.string().min(1).max(128) })
      .parse(req.body);
    const existing = await db.user.findUnique({
      where: { email: input.email },
      select: { id: true, password_hash: true },
    });
    const valid = await verifyPassword(input.password, existing?.password_hash || null);
    if (!valid || !existing?.password_hash)
      throw new HttpError(401, "Incorrect email or password.");
    await sessionResponse(res, existing.id, existing.password_hash);
  });
  const resetLimit = rateLimit({
    windowMs: 60 * 60000,
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
  app.post("/api/auth/forgot-password", resetLimit, async (req, res) => {
    const { email } = z.object({ email: emailInput }).parse(req.body);
    const profile = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (profile) {
      const token = randomBytes(32).toString("hex");
      const token_hash = hash(token);
      await db.passwordReset.upsert({
        where: { user_id: profile.id },
        create: { user_id: profile.id, token_hash, expires_at: new Date(Date.now() + 30 * 60000) },
        update: { token_hash, expires_at: new Date(Date.now() + 30 * 60000) },
      });
      const link = new URL("/auth", process.env["APP_URL"] || "http://localhost:5173");
      link.searchParams.set("reset", token);
      try {
        await sendEmail(
          email,
          "Set your DoingGood password",
          "Choose a new password using this link: " +
            link.toString() +
            "\n\nThis link expires in 30 minutes and can only be used once. If you did not request this, ignore this email.",
        );
      } catch {
        await db.passwordReset.deleteMany({ where: { token_hash } });
        console.error("Password reset email delivery failed.");
      }
    }
    res.json({
      ok: true,
      message: "If an account exists for this email, a password reset link has been sent.",
    });
  });
  app.post("/api/auth/reset-password", authLimit, async (req, res) => {
    const { token, password } = z
      .object({ token: z.string().regex(/^[a-f0-9]{64}$/), password: passwordInput })
      .parse(req.body);
    const token_hash = hash(token);
    const challenge = await db.passwordReset.findUnique({ where: { token_hash } });
    if (!challenge || challenge.expires_at <= new Date())
      throw new HttpError(400, "This reset link is invalid or expired. Request a new one.");
    const password_hash = await hashPassword(password);
    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: challenge.user_id }, data: { password_hash } });
      const consumed = await tx.passwordReset.deleteMany({
        where: { token_hash, expires_at: { gt: new Date() } },
      });
      if (!consumed.count)
        throw new HttpError(400, "This reset link is invalid or expired. Request a new one.");
      await tx.session.deleteMany({ where: { user_id: challenge.user_id } });
    });
    res.clearCookie(cookieName, cookieOptions).json({ ok: true });
  });

  app.post("/api/auth/logout", async (req, res) => {
    const token = req.cookies?.[cookieName];
    if (typeof token === "string") await db.session.deleteMany({ where: { id: hash(token) } });
    res.clearCookie(cookieName, cookieOptions).json({ ok: true });
  });
  app.get("/api/items", async (req, res) => {
    const page = z.coerce.number().int().min(0).max(10000).default(0).parse(req.query["page"]);
    const signedIn = Boolean(await user(req));
    const items = await db.item.findMany({
      where: { status: { in: ["available", "pending"] } },
      include: { owner: { select: { full_name: true, phone: true } } },
      orderBy: [{ created_at: "desc" }, { id: "asc" }],
      take: 50,
      skip: page * 50,
    });
    res.json(items.map((item) => itemView(item, signedIn)));
  });
  app.get("/api/items/:id", async (req, res) => {
    if (!uuid.safeParse(req.params["id"]).success)
      return void res.status(404).json({ error: "Item not found." });
    const signedIn = Boolean(await user(req));
    const item = await db.item.findUnique({
      where: { id: String(req.params["id"]) },
      include: { owner: { select: { full_name: true, phone: true } } },
    });
    res.json(item ? itemView(item, signedIn) : null);
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
        res.status(201).json(itemView(item, true));
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
    res.json({ profile, listings: listings.map((item) => itemView(item, true)) });
  });
  app.patch("/api/profile", async (req, res) => {
    const profile = await requireUser(req);
    const data = z
      .object({
        full_name: z.string().trim().min(2).max(100),
        phone: phoneInput,
      })
      .parse(req.body);
    res.json(await db.user.update({ where: { id: profile.id }, data, select: profileSelect }));
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
      return void res.status(409).json({
        error: "An account with this email already exists. Sign in or reset your password.",
      });
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
