import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jpeg from "jpeg-js";
import { chromium } from "playwright";
import { createHorsleyProperty, HORSLEY_PHOTOS } from "./fixtures/horsley-property.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = path.join(root, "site");
const artifacts = "/opt/cursor/artifacts";
fs.mkdirSync(artifacts, { recursive: true });

function serve(dir) {
  const types = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".webmanifest": "application/manifest+json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".json": "application/json",
  };
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let pathname = decodeURIComponent(req.url.split("?")[0]);
      if (pathname.endsWith("/")) pathname += "index.html";
      const file = path.join(dir, pathname);
      if (!file.startsWith(dir)) {
        res.writeHead(403);
        res.end();
        return;
      }
      fs.readFile(file, (error, data) => {
        if (error) {
          res.writeHead(404);
          res.end("missing");
          return;
        }
        res.setHeader("content-type", types[path.extname(file)] || "application/octet-stream");
        res.end(data);
      });
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function bigJpeg(file) {
  const width = 4000;
  const height = 3000;
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      data[i] = (x * 255) / width;
      data[i + 1] = (y * 255) / height;
      data[i + 2] = 80;
      data[i + 3] = 255;
    }
  }
  fs.writeFileSync(file, jpeg.encode({ data, width, height }, 90).data);
  return { width, height, bytes: fs.statSync(file).size };
}

function imageSize(buf) {
  if (buf[0] === 0x89 && buf.toString("ascii", 1, 4) === "PNG") {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  let offset = 2;
  while (offset + 8 < buf.length) {
    if (buf[offset] !== 0xff) break;
    const marker = buf[offset + 1];
    const length = buf.readUInt16BE(offset + 2);
    if (marker === 0xc0 || marker === 0xc2) {
      return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  return { width: 800, height: 600 };
}

function horsleyBackup() {
  const property = createHorsleyProperty();
  const media = "/tmp/refdocx/word/media";
  const photos = HORSLEY_PHOTOS.map(([file, category, blockId, observationId, label, caption], index) => {
    const buf = fs.readFileSync(path.join(media, file));
    const size = imageSize(buf);
    const mime = file.endsWith(".png") ? "image/png" : "image/jpeg";
    return {
      id: `horsley-photo-${index}`,
      propertyId: property.id,
      category,
      blockId,
      observationId,
      label,
      caption,
      name: file,
      created: "2026-11-03T00:00:00.000Z",
      width: size.width,
      height: size.height,
      bytes: buf.length,
      originalWidth: size.width,
      originalHeight: size.height,
      originalBytes: buf.length,
      mime,
      data: buf.toString("base64"),
      thumb: "",
    };
  });
  return {
    format: "field-apps-backup",
    version: 1,
    exportedAt: "2026-11-09T00:00:00.000Z",
    properties: [{ property, photos }],
  };
}

const server = await serve(site);
const port = server.address().port;
const base = `http://127.0.0.1:${port}/`;
const photoPath = path.join(artifacts, "source-photo.jpg");
const sourcePhoto = bigJpeg(photoPath);
console.log("source photo", sourcePhoto);

const browser = await chromium.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({ acceptDownloads: true, serviceWorkers: "allow" });
const page = await context.newPage();
page.setDefaultTimeout(120000);
const logs = [];
page.on("console", (msg) => {
  const text = msg.text();
  if (text.includes("photo-compressed") || msg.type() === "error") logs.push(`${msg.type()}: ${text}`);
});

await page.goto(base);
await page.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 15000 });
await context.setOffline(true);
await page.reload();
await page.getByTestId("new-property").waitFor();
console.log("offline reload ok");

await page.getByTestId("new-property").click();
await page.locator('[data-path="cover.propertyName"]').fill("Verification Orchard");
await page.locator('[data-section="blocks"]').click();
await page.locator('[data-path="blocks.0.observations.0.share"]').fill("0.5");
await page.locator('[data-path="blocks.0.observations.0.ratings.canopy"][data-value="2"]').click();
await page.locator('[data-path="blocks.0.observations.0.ratings.floor"][data-value="2"]').click();
await page.getByTestId("add-observation").click();
await page.locator('[data-path="blocks.0.observations.1.share"]').fill("0.5");
await page.locator('[data-path="blocks.0.observations.1.ratings.canopy"][data-value="4"]').click();
await page.locator('[data-path="blocks.0.observations.1.code"]').fill("S2");
await page.locator('[data-section="condition"]').click();
await page.locator('[data-path="blocks.0.potential.canopy"][data-value="5"]').click();
await page.locator('[data-path="blocks.0.potential.floor"][data-value="4"]').click();
await page.locator('[data-path="blocks.0.change.canopy"]').fill("Open the canopy and keep the lower wood.");
await page.locator("#yield-chart").waitFor();
await page.locator('[data-section="blocks"]').click();
await page.getByTestId("add-block").click();
await page.locator('[data-section="evidence"]').click();
await page.getByTestId("photo-input").setInputFiles(photoPath);
await page.locator(".photo small").waitFor();
const caption = await page.locator(".photo small").innerText();
console.log("ui compression line:", caption);

const [backup] = await Promise.all([
  page.waitForEvent("download"),
  page.locator('[data-action="backup"]').first().click(),
]);
const backupPath = path.join(artifacts, "backup.json");
await backup.saveAs(backupPath);
const backupJson = JSON.parse(fs.readFileSync(backupPath, "utf8"));
const evidence = backupJson.properties.flatMap((entry) => entry.photos).filter((photo) => photo.category === "evidence");
if (!evidence.length) throw new Error("backup is missing the evidence photo");
console.log("backup photo", {
  originalWidth: evidence[0].originalWidth,
  originalHeight: evidence[0].originalHeight,
  originalBytes: evidence[0].originalBytes,
  width: evidence[0].width,
  height: evidence[0].height,
  bytes: evidence[0].bytes,
});

await page.evaluate(async () => {
  const names = (await indexedDB.databases()).map((db) => db.name);
  await Promise.all(names.map((name) => new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  })));
  localStorage.clear();
});
await page.reload();
await page.getByTestId("new-property").waitFor();
await page.getByTestId("restore-input").setInputFiles(backupPath);
await page.getByRole("button", { name: "Open" }).waitFor();
await page.getByRole("button", { name: "Open" }).click();
await page.locator('[data-section="evidence"]').click();
await page.locator(".photo img").waitFor();
const restored = await page.evaluate(async () => {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open("field-apps");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const photos = await new Promise((resolve, reject) => {
    const request = db.transaction("photos", "readonly").objectStore("photos").getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const properties = await new Promise((resolve, reject) => {
    const request = db.transaction("properties", "readonly").objectStore("properties").getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return {
    name: properties[0]?.cover?.propertyName,
    blocks: properties[0]?.blocks?.length,
    canopy: properties[0]?.blocks?.[0]?.observations?.map((obs) => obs.ratings?.canopy),
    photos: photos.filter((photo) => photo.category === "evidence").map((photo) => ({
      width: photo.width,
      height: photo.height,
      bytes: photo.bytes,
      originalWidth: photo.originalWidth,
      originalHeight: photo.originalHeight,
      originalBytes: photo.originalBytes,
    })),
  };
});
console.log("restored", JSON.stringify(restored));
if (restored.name !== "Verification Orchard" || restored.blocks < 2) throw new Error("restore did not bring the property back");
if (!restored.photos.length || restored.photos[0].width !== 1800) throw new Error(`photo was not compressed: ${JSON.stringify(restored.photos)}`);
if (!(restored.photos[0].bytes < restored.photos[0].originalBytes)) throw new Error("compressed photo is not smaller");
const compressionBackupBytes = fs.statSync(backupPath).size;
console.log("compression backup bytes", compressionBackupBytes);

await page.evaluate(async () => {
  const names = (await indexedDB.databases()).map((db) => db.name);
  await Promise.all(names.map((name) => new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  })));
  localStorage.clear();
});
await page.reload();
await page.getByTestId("new-property").waitFor();
const horsleyPath = path.join(artifacts, "horsley-backup.json");
fs.writeFileSync(horsleyPath, JSON.stringify(horsleyBackup()));
console.log("horsley backup bytes", fs.statSync(horsleyPath).size);
await page.getByTestId("restore-input").setInputFiles(horsleyPath);
await page.getByRole("button", { name: "Open" }).waitFor();
const horsleyCounts = await page.evaluate(async () => {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open("field-apps");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const read = (store) => new Promise((resolve, reject) => {
    const request = db.transaction(store, "readonly").objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const properties = await read("properties");
  const photos = await read("photos");
  db.close();
  return {
    properties: properties.length,
    name: properties[0]?.cover?.propertyName,
    blocks: properties[0]?.blocks?.length,
    sites: properties[0]?.blocks?.reduce((sum, block) => sum + block.observations.length, 0),
    photos: photos.length,
  };
});
console.log("horsley restored", horsleyCounts);
if (horsleyCounts.properties !== 1 || horsleyCounts.blocks !== 3 || horsleyCounts.photos < 20) {
  throw new Error(`Horsley restore counts wrong: ${JSON.stringify(horsleyCounts)}`);
}

await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: path.join(artifacts, "ui-phone-property-list.png"), fullPage: true });
await page.getByRole("button", { name: "Open" }).click();
await page.locator("text=Storage").waitFor();
await page.screenshot({ path: path.join(artifacts, "ui-phone-storage.png"), fullPage: false });
await page.locator('[data-section="blocks"]').click();
await page.locator("text=Block 1").first().waitFor();
await page.screenshot({ path: path.join(artifacts, "ui-phone-block-form.png"), fullPage: true });
await page.setViewportSize({ width: 1280, height: 900 });

const [docxDownload] = await Promise.all([
  page.waitForEvent("download"),
  page.getByTestId("export-docx").click(),
]);
const docxPath = path.join(artifacts, "sample-report.docx");
await docxDownload.saveAs(docxPath);
console.log("docx bytes", fs.statSync(docxPath).size);
console.log("browser logs", logs.join("\n"));
await browser.close();
server.close();

const report = JSON.parse(execFileSync("python3", [path.join(root, "tests/inspect_docx.py"), docxPath], { encoding: "utf8" }));
fs.writeFileSync(path.join(artifacts, "docx-inspection.json"), JSON.stringify(report, null, 2));
const headings = report.sections.flatMap((section) => section.headings.map((heading) => ({ ...heading, orientation: section.orientation })));
const headingText = headings.map((heading) => heading.text);
const required = [
  "1. Executive acquisition assessment",
  "2. Property, orchard profile and inspection scope",
  "3. Block assessments",
  "4. Weighted block condition summary",
  "4.1 Block condition improvement profiles",
  "5. Material agronomic risk",
  "6. Field photographic evidence",
  "7. Final agronomic opinion",
  "8. References",
  "Appendix A Soil chemistry assessment",
];
let cursor = 0;
for (const title of required) {
  const found = headingText.findIndex((text, index) => index >= cursor && text.startsWith(title));
  if (found < 0) throw new Error(`missing heading ${title}`);
  cursor = found + 1;
}
const orient = (title) => headings.find((heading) => heading.text.startsWith(title))?.orientation;
if (orient("1. Executive") !== "portrait") throw new Error("section 1 is not portrait");
if (orient("3. Block") !== "portrait") throw new Error("section 3 is not portrait");
if (orient("4. Weighted") !== "landscape") throw new Error("section 4 is not landscape");
if (orient("5. Material") !== "landscape") throw new Error("section 5 is not landscape");
if (orient("6. Field") !== "portrait") throw new Error("section 6 is not portrait");
if (!report.fields.some((field) => field.includes("TOC"))) throw new Error("TOC field missing");
if (!report.hasGridLegend || !report.hasChangeColumn) throw new Error("4.1 grid legend or change column missing");
const footerFields = report.footers.flatMap((footer) => footer.fields).join(" ");
const footerText = report.footers.map((footer) => footer.text).join(" ");
if (!footerText.includes("Due Diligence Report") || !footerFields.includes("PAGE") || !footerFields.includes("NUMPAGES")) {
  throw new Error(`footer fields missing: ${footerText} ${footerFields}`);
}
const allText = report.sections.flatMap((section) => section.text).join("\n");
if (!allText.includes("Figure 13:")) throw new Error(`figure numbering did not reach 13: ${report.captions.filter((c) => c.startsWith("Figure")).join(" | ")}`);
if (!allText.includes("51% to 53%") || !allText.includes("81–82%")) throw new Error("Figure 13 explanation is missing the Horsley ranges");
if (!allText.includes("Phase canopy renewal")) throw new Error("change-needed text missing from the 4.1 grid");
if (!/\bC\b/.test(allText) || !allText.includes("P")) throw new Error("C or P marks missing from the 4.1 grid");
if (report.bytes > 15_000_000) throw new Error(`docx is too large: ${report.bytes}`);
console.log("docx structure ok", report.bytes, "bytes");

const pdfDir = path.join(artifacts, "pdf");
fs.rmSync(pdfDir, { recursive: true, force: true });
fs.mkdirSync(pdfDir);
execFileSync("soffice", [
  `-env:UserInstallation=file://${path.join(pdfDir, "profile")}`,
  "--headless",
  "--norestore",
  "--convert-to",
  "pdf",
  "--outdir",
  pdfDir,
  docxPath,
], { stdio: "inherit" });
const pdf = path.join(pdfDir, "sample-report.pdf");
const info = execFileSync("pdfinfo", ["-f", "1", "-l", "40", pdf], { encoding: "utf8" });
const pages = [];
for (const line of info.split("\n")) {
  const match = line.match(/^Page\s+(\d+) size:\s+([\d.]+)\s+x\s+([\d.]+)/);
  if (match) pages.push({ page: Number(match[1]), width: Number(match[2]), height: Number(match[3]) });
}
function pageText(page) {
  return execFileSync("pdftotext", ["-f", String(page), "-l", String(page), "-layout", pdf, "-"], { encoding: "utf8" });
}
const texts = pages.map((page) => ({ ...page, text: pageText(page.page) }));
const cover = texts[0];
const toc = texts.find((page) => /table of contents/i.test(page.text)) || texts[1];
const grid = texts.find((page) => /Change needed for proposed rating/i.test(page.text) && /Canopy health/i.test(page.text));
const chartPage = texts.find((page) => /Visual confirmation of the yield potential/i.test(page.text));
const blockPage = texts.find((page) => /3\.1\./.test(page.text) || /Observation S1/.test(page.text));
const landscape = texts.find((page) => page.width > page.height);
if (!grid) throw new Error("could not find a 4.1 grid page in the PDF");
if (grid.width <= grid.height) throw new Error("4.1 grid page is not landscape");
if (!chartPage) throw new Error("could not find the Figure 13 yield chart page");

function snap(pageNumber, name) {
  for (const file of fs.readdirSync(artifacts)) {
    if (file === `${name}.png` || file.startsWith(`${name}-`)) fs.rmSync(path.join(artifacts, file));
  }
  execFileSync("pdftoppm", ["-png", "-r", "110", "-f", String(pageNumber), "-l", String(pageNumber), pdf, path.join(artifacts, name)]);
  const generated = fs.readdirSync(artifacts).find((file) => file.startsWith(`${name}-`) && file.endsWith(".png"));
  if (generated) fs.renameSync(path.join(artifacts, generated), path.join(artifacts, `${name}.png`));
}
snap(cover.page, "cover");
snap(toc.page, "toc");
snap((landscape || grid).page, "section-4-landscape");
snap(grid.page, "section-4-1-grid");
snap(chartPage.page, "figure-13-yield-chart");
if (blockPage) snap(blockPage.page, "block-page");
console.log(JSON.stringify({
  pages: texts.map((page) => ({ page: page.page, landscape: page.width > page.height, sample: page.text.slice(0, 80).replace(/\s+/g, " ") })),
  gridPage: grid.page,
  artifacts: fs.readdirSync(artifacts),
}, null, 2));
