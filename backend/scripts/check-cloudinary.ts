import "dotenv/config";
import { readFile } from "node:fs/promises";
import { uploadListingPhotos, cloudinary } from "../src/cloudinary.js";
let publicIds: string[] = [];
try {
  const image = await readFile(new URL("../../frontend/public/images/sofa.jpg", import.meta.url));
  const assets = await uploadListingPhotos(
    [`data:image/jpeg;base64,${image.toString("base64")}`],
    "configuration-check",
  );
  publicIds = assets.map((asset) => asset.publicId);
  for (const asset of assets) {
    const response = await fetch(asset.url, { method: "HEAD", signal: AbortSignal.timeout(15000) });
    if (!response.ok || !response.headers.get("content-type")?.startsWith("image/"))
      throw new Error("Uploaded image could not be served.");
  }
  console.log("Cloudinary upload and HTTPS image delivery passed.");
} catch {
  console.error("Cloudinary configuration check failed.");
  process.exitCode = 1;
} finally {
  for (const id of publicIds) {
    try {
      const result = await cloudinary.uploader.destroy(id, { invalidate: true });
      if (result.result !== "ok") {
        console.error("Temporary image cleanup needs attention", { publicId: id });
        process.exitCode = 1;
      } else console.log("Temporary test image removed.");
    } catch {
      console.error("Temporary image cleanup needs attention", { publicId: id });
      process.exitCode = 1;
    }
  }
}
