import { v2 as cloudinary } from "cloudinary";
import { randomUUID } from "node:crypto";
export { cloudinary };
export function configureCloudinary() {
  const cloud_name = process.env["CLOUDINARY_CLOUD_NAME"];
  const api_key = process.env["CLOUDINARY_API_KEY"];
  const api_secret = process.env["CLOUDINARY_API_SECRET"];
  if (!cloud_name || !api_key || !api_secret) throw new Error("Cloudinary is not configured.");
  cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
}
export async function removeUploadedPhotos(publicIds: string[]) {
  const results = await Promise.allSettled(
    publicIds.map((id) =>
      cloudinary.uploader.destroy(id, { resource_type: "image", invalidate: true }),
    ),
  );
  if (results.some((result) => result.status === "rejected"))
    console.error("Cloudinary upload cleanup needs retry", { publicIds });
}
export async function uploadListingPhotos(photos: string[], ownerId: string) {
  configureCloudinary();
  const assets: { url: string; publicId: string }[] = [];
  try {
    for (const photo of photos) {
      const result = await cloudinary.uploader.upload(photo, {
        resource_type: "image",
        folder: `doinggood/${ownerId}`,
        public_id: randomUUID(),
        overwrite: false,
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
        timeout: 60000,
      });
      assets.push({ url: result.secure_url, publicId: result.public_id });
    }
    return assets;
  } catch {
    await removeUploadedPhotos(assets.map((asset) => asset.publicId));
    throw new Error("Photo upload failed. Please try again.");
  }
}
