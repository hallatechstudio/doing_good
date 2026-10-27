import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import request from "supertest";
import { ServerClient } from "postmark";
import { cloudinary } from "./cloudinary.js";
import { createApp } from "./app.js";
import { db } from "./db.js";

test("Neon integration: sign-in, WhatsApp profiles, Cloudinary listings and owner permissions", async (t) => {
  const app = createApp();
  const marker = `backend-test-${randomBytes(8).toString("hex")}`;
  const emails: string[] = [];
  let code = "";
  let uploads = 0;
  let failAfter = Infinity;
  const destroyed: string[] = [];
  t.mock.method(ServerClient.prototype, "sendEmail", async (mail: { TextBody: string }) => {
    code = mail.TextBody.match(/\b\d{6}\b/)?.[0] || "";
    return { ErrorCode: 0, Message: "OK", MessageID: "test" };
  });
  t.mock.method(cloudinary.uploader, "upload", async () => {
    uploads++;
    if (uploads > failAfter) throw new Error("Simulated upload outage");
    return {
      secure_url: `https://res.cloudinary.com/dacmb5ncl/image/upload/doinggood/${marker}-${uploads}.jpg`,
      public_id: `doinggood/${marker}-${uploads}`,
    };
  });
  t.mock.method(cloudinary.uploader, "destroy", async (id: string) => {
    destroyed.push(id);
    return { result: "ok" };
  });
  async function identity(name: string) {
    const email = `${marker}-${name}@example.com`;
    emails.push(email);
    const profile = await db.user.create({ data: { email, full_name: name } });
    const token = randomBytes(32).toString("hex");
    await db.session.create({
      data: {
        id: createHash("sha256").update(token).digest("hex"),
        user_id: profile.id,
        expires_at: new Date(Date.now() + 120000),
      },
    });
    return { profile, cookie: `doinggood_session=${token}` };
  }
  try {
    assert.equal((await request(app).get("/api/health")).status, 200);
    assert.equal((await request(app).get("/")).body.service, "DoingGood API");
    const missingPage = await request(app).get("/dashboard");
    assert.equal(missingPage.status, 404);
    assert.equal(missingPage.body.error, "Endpoint not found.");
    const owner = await identity("Owner");
    const stranger = await identity("Stranger");
    const email = `${marker}-login@example.com`;
    emails.push(email);
    assert.equal(
      (await request(app).post("/api/auth/code").send({ email, full_name: "Login tester" })).status,
      200,
    );
    assert.match(code, /^\d{6}$/);
    assert.equal(
      (await request(app).post("/api/auth/verify").send({ email, code: "000000" })).status,
      400,
    );
    const verified = await request(app).post("/api/auth/verify").send({ email, code });
    assert.equal(verified.status, 200);
    assert.equal(verified.body.phone, "");
    const cookie = verified.headers["set-cookie"]?.[0];
    assert.ok(cookie);
    assert.ok(cookie.includes("HttpOnly"));
    assert.equal((await request(app).post("/api/auth/verify").send({ email, code })).status, 400);
    assert.equal(
      (
        await request(app)
          .patch("/api/profile")
          .set("Cookie", cookie)
          .send({ full_name: "Login tester", phone: "08012345678" })
      ).status,
      400,
    );
    const onboarding = await request(app)
      .patch("/api/profile")
      .set("Cookie", cookie)
      .send({ full_name: "Login tester", phone: "+234 801 234 5678" });
    assert.equal(onboarding.status, 200);
    assert.equal(onboarding.body.phone, "+2348012345678");
    assert.equal(
      (await request(app).get("/api/auth/me").set("Cookie", cookie)).body.phone,
      "+2348012345678",
    );
    assert.equal(
      (await request(app).post("/api/auth/logout").set("Cookie", cookie).send({})).status,
      200,
    );
    assert.equal((await request(app).get("/api/auth/me").set("Cookie", cookie)).body, null);
    const item = {
      title: "Integration test chair",
      description: "A sturdy chair for integration testing.",
      category: "furniture",
      condition: "good",
      location: "Yaba, Lagos",
      photos: ["data:image/jpeg;base64,/9j/2Q=="],
      whatsapp: "+2348012345678",
    };
    assert.equal((await request(app).post("/api/items").send(item)).status, 401);
    assert.equal(
      (
        await request(app)
          .post("/api/items")
          .set("Cookie", owner.cookie)
          .set("Origin", "https://evil.example")
          .send(item)
      ).status,
      403,
    );
    assert.equal(
      (
        await request(app)
          .post("/api/items")
          .set("Cookie", owner.cookie)
          .send({ ...item, whatsapp: "08012345678" })
      ).status,
      400,
    );
    assert.equal(
      (
        await request(app)
          .post("/api/items")
          .set("Cookie", owner.cookie)
          .send({ ...item, photos: ["https://evil.example/image.jpg"] })
      ).status,
      400,
    );
    assert.equal(uploads, 0);
    const listing = await request(app)
      .post("/api/items")
      .set("Cookie", owner.cookie)
      .send({ ...item, owner_id: stranger.profile.id });
    assert.equal(listing.status, 201);
    const id = listing.body.id;
    assert.equal(listing.body.owner_id, owner.profile.id);
    assert.equal(listing.body.donor_whatsapp, item.whatsapp);
    assert.match(listing.body.photos[0], /^https:\/\/res\.cloudinary\.com\//);
    assert.deepEqual(
      (await db.item.findUniqueOrThrow({ where: { id } })).photos,
      listing.body.photos,
    );
    const publicListing = (await request(app).get(`/api/items/${id}`)).body;
    assert.equal(publicListing.donor_whatsapp, item.whatsapp);
    assert.equal(publicListing.owner, undefined);
    assert.equal(
      (
        await request(app)
          .patch(`/api/items/${id}/status`)
          .set("Cookie", stranger.cookie)
          .send({ status: "given" })
      ).status,
      404,
    );
    assert.equal(
      (
        await request(app)
          .patch(`/api/items/${id}/status`)
          .set("Cookie", owner.cookie)
          .send({ status: "matched" })
      ).status,
      200,
    );
    assert.equal(
      (
        await request(app)
          .patch(`/api/items/${id}/status`)
          .set("Cookie", owner.cookie)
          .send({ status: "given" })
      ).status,
      200,
    );
    const dashboard = (await request(app).get("/api/dashboard").set("Cookie", owner.cookie)).body;
    assert.equal(dashboard.listings.length, 1);
    assert.equal(dashboard.incoming, undefined);
    assert.equal(dashboard.outgoing, undefined);
    assert.equal(
      (await request(app).get("/api/dashboard").set("Cookie", stranger.cookie)).body.listings
        .length,
      0,
    );
    assert.equal(
      (await request(app).post("/api/requests").set("Cookie", owner.cookie).send({})).status,
      404,
    );
    // A partial batch is removed if a later image fails; no listing is published.
    failAfter = uploads + 1;
    const failed = await request(app)
      .post("/api/items")
      .set("Cookie", owner.cookie)
      .send({ ...item, photos: [...item.photos, ...item.photos] });
    assert.equal(failed.status, 503);
    assert.equal(destroyed.length, 1);
    assert.equal(await db.item.count({ where: { owner_id: owner.profile.id } }), 1);
    // Expired and exhausted challenges never establish sessions.
    const lockEmail = `${marker}-locked@example.com`;
    emails.push(lockEmail);
    await db.loginCode.create({
      data: {
        email: lockEmail,
        full_name: "Locked",
        code_hash: createHash("sha256").update("123456").digest("hex"),
        expires_at: new Date(Date.now() + 60000),
      },
    });
    for (let i = 0; i < 5; i++)
      assert.equal(
        (await request(app).post("/api/auth/verify").send({ email: lockEmail, code: "000000" }))
          .status,
        400,
      );
    assert.equal(
      (await request(app).post("/api/auth/verify").send({ email: lockEmail, code: "123456" }))
        .status,
      400,
    );
  } finally {
    await db.loginCode.deleteMany({ where: { email: { in: emails } } });
    await db.user.deleteMany({ where: { email: { in: emails } } });
    await db.$disconnect();
  }
});
