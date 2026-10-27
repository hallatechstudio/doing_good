import "dotenv/config";
import { db } from "../src/db.js";
import { uploadListingPhotos, removeUploadedPhotos } from "../src/cloudinary.js";
let migrated = 0;
try {
  let cursor: string | undefined;
  while (true) {
    const items = await db.item.findMany({
      take: 50,
      orderBy: { id: "asc" },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, owner_id: true, photos: true },
    });
    if (!items.length) break;
    for (const item of items) {
      const embedded = item.photos.filter((photo) => photo.startsWith("data:image/"));
      if (!embedded.length) continue;
      const assets = await uploadListingPhotos(embedded, item.owner_id);
      try {
        let index = 0;
        const photos = item.photos.map((photo) =>
          photo.startsWith("data:image/") ? assets[index++]!.url : photo,
        );
        const updated = await db.item.updateMany({
          where: { id: item.id, photos: { equals: item.photos } },
          data: { photos },
        });
        if (updated.count) migrated++;
        else await removeUploadedPhotos(assets.map((asset) => asset.publicId));
      } catch (error) {
        await removeUploadedPhotos(assets.map((asset) => asset.publicId));
        throw error;
      }
    }
    cursor = items[items.length - 1]!.id;
  }
  console.log(JSON.stringify({ migratedListings: migrated }));
} catch {
  console.error(
    "Photo migration failed. Existing photos have been retained for any unfinished listing.",
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
