import { clearAll, listPhotos, listProperties, putPhoto, saveProperty, getProperty } from "./db.js";

/**
 * One JSON file holds every property and every image (compressed field photos,
 * thumbnails and logos). Restoring it replaces the local database.
 */
export async function createBackup() {
  const summaries = await listProperties();
  const properties = [];
  for (const summary of summaries) {
    const property = await getProperty(summary.id);
    const photos = await listPhotos(property.id);
    const encoded = [];
    for (const photo of photos) {
      encoded.push({
        id: photo.id,
        propertyId: photo.propertyId,
        category: photo.category,
        blockId: photo.blockId || "",
        observationId: photo.observationId || "",
        label: photo.label || "",
        caption: photo.caption || "",
        name: photo.name || "",
        created: photo.created || "",
        width: photo.width || 0,
        height: photo.height || 0,
        bytes: photo.bytes || 0,
        originalWidth: photo.originalWidth || 0,
        originalHeight: photo.originalHeight || 0,
        originalBytes: photo.originalBytes || 0,
        mime: photo.blob?.type || "image/jpeg",
        data: await blobToBase64(photo.blob),
        thumb: photo.thumb ? await blobToBase64(photo.thumb) : "",
      });
    }
    properties.push({ property, photos: encoded });
  }
  const payload = {
    format: "field-apps-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    properties,
  };
  return new Blob([JSON.stringify(payload)], { type: "application/json" });
}

export async function restoreBackup(file) {
  const data = JSON.parse(await file.text());
  if (!data || data.format !== "field-apps-backup" || !Array.isArray(data.properties)) {
    throw new Error("This file is not a field-apps backup.");
  }
  await clearAll();
  for (const entry of data.properties) {
    if (!entry?.property?.id) continue;
    await saveProperty(entry.property);
    for (const photo of entry.photos || []) {
      if (!photo?.data || !photo.id) continue;
      const mime = photo.mime || "image/jpeg";
      const blob = base64ToBlob(photo.data, mime);
      const thumb = photo.thumb ? base64ToBlob(photo.thumb, "image/jpeg") : blob;
      await putPhoto({
        id: photo.id,
        propertyId: photo.propertyId,
        category: photo.category,
        blockId: photo.blockId || "",
        observationId: photo.observationId || "",
        label: photo.label || "",
        caption: photo.caption || "",
        name: photo.name || "",
        created: photo.created || "",
        width: photo.width || 0,
        height: photo.height || 0,
        bytes: photo.bytes || blob.size,
        originalWidth: photo.originalWidth || 0,
        originalHeight: photo.originalHeight || 0,
        originalBytes: photo.originalBytes || 0,
        blob,
        thumb,
      });
    }
  }
  return data.properties.length;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(b64, type) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}
