/**
 * Field photos are stored as JPEG. The long edge is kept at about 1800 px
 * (inside the 1600–2000 px band) and encoded at quality 0.8. A small thumbnail
 * is stored for the on-screen grid. Exports use the compressed JPEG.
 */
export async function compressPhoto(file, { maxEdge = 1800, quality = 0.8, thumbEdge = 360, thumbQuality = 0.72 } = {}) {
  const bitmap = await createImageBitmap(file);
  try {
    const originalWidth = bitmap.width;
    const originalHeight = bitmap.height;
    const originalBytes = file.size;
    const longEdge = Math.max(originalWidth, originalHeight);
    const scale = longEdge > maxEdge ? maxEdge / longEdge : 1;
    const width = Math.max(1, Math.round(originalWidth * scale));
    const height = Math.max(1, Math.round(originalHeight * scale));
    const blob = await renderJpeg(bitmap, width, height, quality);
    const thumbScale = Math.min(1, thumbEdge / Math.max(width, height));
    const thumb = await renderJpeg(
      bitmap,
      Math.max(1, Math.round(width * thumbScale)),
      Math.max(1, Math.round(height * thumbScale)),
      thumbQuality,
    );
    return {
      blob,
      thumb,
      width,
      height,
      bytes: blob.size,
      originalWidth,
      originalHeight,
      originalBytes,
    };
  } finally {
    bitmap.close?.();
  }
}

function renderJpeg(bitmap, width, height, quality) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not compress the photo"));
    }, "image/jpeg", quality);
  });
}

export async function imageSize(blob) {
  const bitmap = await createImageBitmap(blob);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close?.();
  return size;
}
