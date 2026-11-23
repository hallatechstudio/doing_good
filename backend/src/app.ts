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
import { HttpError } from "./errors.js";
import { mountCommerce, paymentWebhook } from "./commerce.js";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const production = process.env["NODE_ENV"] === "production";
const cookieName = production ? "__Host-doinggood" : "doinggood_session";
const cookieOptions = { httpOnly: true, secure: production, sameSite: "lax" as const, path: "/" };
const allowedOrigins = new Set([
  new URL(process.env["APP_URL"] || "http://localhost:5173").origin,
  "https://doinggood-one.vercel.app",
]);
const emailInput = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((v) => v.toLowerCase());
const uuid = z.string().uuid();
const passwordInput = z.string().min(8, "Use a password with at least 8 characters.").max(128);
const profileSelect = {
  id: true,
  email: true,
  full_name: true,
  phone: true,
  created_at: true,
  payout_name: true,
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
  quantity: z.number().int().min(0).max(10000).default(1),
  price_kobo: z.union([z.literal(0), z.number().int().min(10000).max(100_000_000)]).default(0),
  pickup_available: z.boolean().default(true),
  delivery_fee_kobo: z.number().int().min(0).max(10_000_000).nullable().default(null),
  delivery_area: z.string().trim().min(2).max(150).nullable().default(null),
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
const photoEntry = z.union([
  z.string().url(),
  z
    .string()
    .max(1500000)
    .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/),
]);
const updateListingInput = z.object({
  quantity: z.number().int().min(0).max(10000).default(1),
  price_kobo: z.union([z.literal(0), z.number().int().min(10000).max(100_000_000)]).default(0),
  pickup_available: z.boolean().default(true),
  delivery_fee_kobo: z.number().int().min(0).max(10_000_000).nullable().default(null),
  delivery_area: z.string().trim().min(2).max(150).nullable().default(null),
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
  photos: z.array(photoEntry).min(1).max(5),
});
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
const completedSales = {
  where: {
    paid_at: { not: null },
    status: {
      in: [
        "paid_direct",
        "paid",
        "delivery_pending",
        "delivered",
        "disputed",
        "release_pending",
        "payout_processing",
        "payout_review",
        "released",
      ],
    },
  },
  select: { id: true },
  take: 1,
};
const itemView = (
  item: {
    owner: { full_name: string; phone: string };
    [key: string]: unknown;
  },
  includeFreeContact = false,
) => {
  const { owner, ...rest } = item;
  delete rest["orders"];
  const quantity = Number(rest["quantity"]);
  return {
    ...rest,
    status:
      quantity <= 0 ? "out_of_stock" : rest["status"] === "reserved" ? "available" : rest["status"],
    donor_name: owner.full_name,
    donor_whatsapp: includeFreeContact && !(Number(rest["price_kobo"]) > 0) ? owner.phone : "",
  };
};
const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
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
  app.use((req, res, next) => {
    const origin = req.get("origin");
    if (origin && allowedOrigins.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,POST,PATCH,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    }
    if (req.method === "OPTIONS") return void res.sendStatus(204);
    next();
  });
  app.post(
    "/api/payments/webhook",
    express.raw({ type: "application/json", limit: "1mb" }),
    paymentWebhook,
  );
  app.use(
    "/api",
    rateLimit({ windowMs: 60000, limit: 120, standardHeaders: "draft-8", legacyHeaders: false }),
  );
  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const origin = req.get("origin");
      if (origin && !allowedOrigins.has(origin))
        return next(new HttpError(403, "Request origin is not allowed."));
      if (!origin && req.get("sec-fetch-site") === "cross-site")
        return next(new HttpError(403, "Request origin is not allowed."));
      if (!req.is("application/json")) return next(new HttpError(415, "Send JSON data."));
    }
    next();
  });
  app.use(express.json({ limit: "8mb" }));
  mountCommerce(app, requireUser);
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
  // Social apps do not execute the React application, so they need an HTML response with
  // item-specific Open Graph metadata before the visitor is redirected to the product page.
  app.get("/api/share/items/:id", async (req, res) => {
    if (!uuid.safeParse(req.params["id"]).success)
      return void res.status(404).type("html").send("<title>Item not found</title>");
    const item = await db.item.findUnique({
      where: { id: String(req.params["id"]) },
      select: { id: true, title: true, description: true, photos: true },
    });
    if (!item) return void res.status(404).type("html").send("<title>Item not found</title>");
    const appUrl = new URL(process.env["APP_URL"] || "http://localhost:5173");
    const itemUrl = new URL(`/items/${item.id}`, appUrl).toString();
    const shareUrl = new URL(`/api/share/items/${item.id}`, appUrl).toString();
    const title = `${item.title} | DoingGood`;
    const description = item.description.replace(/\s+/g, " ").trim().slice(0, 300);
    const image = item.photos[0] || new URL("/favicon.svg", appUrl).toString();
    res.type("html").send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta property="og:type" content="product"><meta property="og:site_name" content="DoingGood"><meta property="og:url" content="${escapeHtml(shareUrl)}"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:image" content="${escapeHtml(image)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${escapeHtml(image)}"><meta http-equiv="refresh" content="0;url=${escapeHtml(itemUrl)}"></head><body><p>Opening <a href="${escapeHtml(itemUrl)}">${escapeHtml(item.title)}</a>…</p><script>location.replace(${JSON.stringify(itemUrl)})</script></body></html>`);
  });
  app.get("/api/items", async (req, res) => {
    const profile = await user(req);
    const page = z.coerce.number().int().min(0).max(10000).default(0).parse(req.query["page"]);
    const items = await db.item.findMany({
      where: {
        OR: [
          { status: { in: ["available", "pending"] }, quantity: { gt: 0 } },
          { status: "reserved", quantity: { gt: 0 } },
        ],
      },
      include: { owner: { select: { full_name: true, phone: true } } },
      orderBy: [{ created_at: "desc" }, { id: "asc" }],
      take: 50,
      skip: page * 50,
    });
    res.json(items.map((item) => itemView(item, Boolean(profile))));
  });
  app.get("/api/items/:id", async (req, res) => {
    const profile = await user(req);
    if (!uuid.safeParse(req.params["id"]).success)
      return void res.status(404).json({ error: "Item not found." });
    const item = await db.item.findUnique({
      where: { id: String(req.params["id"]) },
      include: { owner: { select: { full_name: true, phone: true } }, orders: completedSales },
    });
    res.json(item ? itemView(item, Boolean(profile)) : null);
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
      if (data.price_kobo === 0) {
        data.pickup_available = true;
        data.delivery_fee_kobo = null;
        data.delivery_area = null;
      } else if (
        (data.delivery_fee_kobo === null &&
          (!data.pickup_available || data.delivery_area !== null)) ||
        (data.delivery_fee_kobo !== null && data.delivery_area === null)
      ) {
        throw new HttpError(400, "Choose pickup or provide a delivery area and fee.");
      }
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
      include: { owner: { select: { full_name: true, phone: true } }, orders: completedSales },
      orderBy: { created_at: "desc" },
    });
    res.json({ profile, listings: listings.map((item) => itemView(item)) });
  });
  app.patch("/api/profile", async (req, res) => {
    const profile = await requireUser(req);
    const data = z
      .object({
        phone: phoneInput,
      })
      .parse(req.body);
    res.json(await db.user.update({ where: { id: profile.id }, data, select: profileSelect }));
  });
  app.patch("/api/items/:id/status", async (req, res) => {
    const profile = await requireUser(req);
    const id = uuid.parse(req.params["id"]);
    const { status } = z
      .object({ status: z.enum(["available", "sold", "pending", "matched", "given"]) })
      .parse(req.body);
    await db.$transaction(async (tx) => {
      // Serialize seller edits with checkout's inventory reservation.
      const owned = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "Item" WHERE id = ${id}::uuid AND owner_id = ${profile.id}::uuid FOR UPDATE`;
      if (!owned.length) throw new HttpError(404, "Listing not found.");
      const activeOrder = await tx.order.findFirst({
        where: { item_id: id, status: { notIn: ["refunded", "payment_expired"] } },
      });
      if (activeOrder) throw new HttpError(409, "This item's status is managed through its order.");
      await tx.item.update({ where: { id }, data: { status } });
    });
    res.json({ ok: true });
  });
  app.patch(
    "/api/items/:id",
    rateLimit({
      windowMs: 15 * 60000,
      limit: 30,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
    async (req, res) => {
      const profile = await requireUser(req);
      const id = uuid.parse(req.params["id"]);
      const data = updateListingInput.parse(req.body);
      if (data.price_kobo === 0) {
        data.pickup_available = true;
        data.delivery_fee_kobo = null;
        data.delivery_area = null;
      } else if (
        (data.delivery_fee_kobo === null &&
          (!data.pickup_available || data.delivery_area !== null)) ||
        (data.delivery_fee_kobo !== null && data.delivery_area === null)
      ) {
        throw new HttpError(400, "Choose pickup or provide a delivery area and fee.");
      }
      const current = await db.$transaction(async (tx) => {
        const owned = await tx.$queryRaw<
          { id: string; photos: string[] }[]
        >`SELECT id, photos FROM "Item" WHERE id = ${id}::uuid AND owner_id = ${profile.id}::uuid FOR UPDATE`;
        if (!owned.length) throw new HttpError(404, "Listing not found.");
        const activeOrder = await tx.order.findFirst({
          where: { item_id: id, status: { notIn: ["refunded", "payment_expired"] } },
        });
        if (activeOrder)
          throw new HttpError(409, "This listing has an active order and cannot be edited.");
        return owned[0]!;
      });
      const existingPhotos = new Set(current.photos);
      const keepUrls = data.photos.filter((p) => existingPhotos.has(p));
      const newUploads = data.photos.filter((p) => !existingPhotos.has(p));
      let uploaded: { url: string; publicId: string }[] = [];
      if (newUploads.length) {
        try {
          uploaded = await uploadListingPhotos(newUploads, profile.id);
        } catch {
          throw new HttpError(503, "Photo upload failed. Please try again.");
        }
      }
      const removedPublicIds = current.photos
        .filter((url) => !keepUrls.includes(url))
        .map((url) => {
          const match = /\/v\d+\/([^/]+(?:\/[^/]+)*)\.[a-z]+$/i.exec(url);
          return match?.[1] ?? url;
        });
      try {
        await db.item.update({
          where: { id },
          data: {
            ...data,
            status: data.quantity > 0 ? "available" : "sold",
            photos: [...keepUrls, ...uploaded.map((a) => a.url)],
          },
        });
        if (removedPublicIds.length) void removeUploadedPhotos(removedPublicIds).catch(() => {});
        res.json({ ok: true });
      } catch (error) {
        if (uploaded.length)
          void removeUploadedPhotos(uploaded.map((a) => a.publicId)).catch(() => {});
        throw error;
      }
    },
  );
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
