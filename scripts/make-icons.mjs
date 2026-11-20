import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const outDir = path.resolve("apps/macadamia/icons");
fs.mkdirSync(outDir, { recursive: true });

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const name = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([name, data])) >>> 0);
  return Buffer.concat([length, name, data, crc]);
}

function png(width, height, pixel) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = pixel(x, y, width, height);
      const i = row + 1 + x * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function icon(maskable) {
  const scale = maskable ? 0.58 : 0.74;
  return (x, y, w, h) => {
    const nx = (x + 0.5 - w / 2) / (w * scale);
    const ny = (y + 0.5 - h / 2) / (h * scale);
    let color = [0x17, 0x3d, 0x2b, 255];
    if (nx * nx + (ny + 0.02) * (ny + 0.02) < 0.28) color = [0xf3, 0xf1, 0xe8, 255];
    if (nx * nx + (ny + 0.02) * (ny + 0.02) < 0.16) color = [0x17, 0x3d, 0x2b, 255];
    const leafX = nx / 0.22;
    const leafY = (ny + 0.42) / 0.34;
    if (leafX * leafX + leafY * leafY < 1 && ny < -0.02) color = [0xb7, 0xcf, 0x70, 255];
    return color;
  };
}

const files = [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["icon-maskable-192.png", 192, true],
  ["icon-maskable-512.png", 512, true],
  ["apple-touch-icon.png", 180, false],
  ["favicon-32.png", 32, false],
];
for (const [name, size, maskable] of files) {
  fs.writeFileSync(path.join(outDir, name), png(size, size, icon(maskable)));
}
console.log(`wrote ${files.length} icons`);
