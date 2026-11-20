import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import jpeg from "jpeg-js";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function serve(dir) {
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg" };
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let pathname = decodeURIComponent(req.url.split("?")[0]);
      if (pathname.endsWith("/")) pathname += "index.html";
      const file = path.join(dir, pathname);
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

function jpegFile(file, width, height) {
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = (i * 13) & 255;
    data[i + 1] = (i * 7) & 255;
    data[i + 2] = 90;
    data[i + 3] = 255;
  }
  fs.writeFileSync(file, jpeg.encode({ data, width, height }, 82).data);
}

function docxTexts(docx) {
  const xml = execFileSync("unzip", ["-p", docx, "word/document.xml"], { encoding: "utf8" });
  return [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((match) => match[1]);
}

function section6(texts) {
  const joined = texts.join("\n");
  const marker = "6. Field photographic evidence";
  const at = joined.lastIndexOf(marker);
  if (at < 0) return "";
  return joined.slice(at + marker.length).split("\n7. Final agronomic opinion")[0];
}

test("desktop file picker and drag-drop photos survive an immediate export", { timeout: 120000 }, async () => {
  const dir = fs.mkdtempSync("/tmp/field-photo-test-");
  const big = path.join(dir, "orchard-large.jpg");
  const profile = path.join(dir, "horizon-a.jpg");
  const heic = path.join(dir, "from-iphone.heic");
  jpegFile(big, 2400, 1800);
  jpegFile(profile, 640, 480);
  fs.writeFileSync(heic, Buffer.from("not a decodable heic image"));
  const server = await serve(path.join(root, "site"));
  const browser = await chromium.launch({ executablePath: "/usr/local/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
  try {
    const page = await (await browser.newContext({
      acceptDownloads: true,
      viewport: { width: 1440, height: 900 },
      hasTouch: false,
      isMobile: false,
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    })).newPage();
    page.setDefaultTimeout(30000);
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.getByTestId("new-property").click();
    await page.locator('[data-path="cover.propertyName"]').fill("195 Pashleys Road, Medowvale");
    await page.locator('[data-section="evidence"]').click();

    const input = page.getByTestId("photo-input");
    if (await input.getAttribute("capture")) throw new Error("photo input still requests the camera on desktop");
    if ((await input.getAttribute("multiple")) == null) throw new Error("desktop photo input does not accept a multi-file selection");
    const label = input.locator("xpath=ancestor::label");
    const chooserPromise = page.waitForEvent("filechooser");
    await label.click();
    const chooser = await chooserPromise;
    if (!chooser.isMultiple()) throw new Error("file chooser was not opened as a multi-file desktop picker");
    await chooser.setFiles(big);
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("export-docx").click(),
    ]);
    const docx = path.join(dir, "immediate.docx");
    await download.saveAs(docx);
    const texts = docxTexts(docx);
    const section = section6(texts);
    if (!section) throw new Error("section 6 missing");
    if (section.includes("No field photographs recorded")) throw new Error(`immediate export dropped the file-picker photo: ${section.slice(0, 300)}`);
    if (!section.includes("orchard-large.jpg")) throw new Error(`section 6 has no file-picker photo: ${section.slice(0, 300)}`);
    const figures = texts.filter((text) => text.startsWith("Figure "));
    if (!figures[0]?.includes("Visual confirmation")) throw new Error(`with no farm map the chart should be Figure 1, got ${figures.join(" | ")}`);
    if (!figures[1]?.includes("orchard-large.jpg")) throw new Error(`field photo should be the next figure, got ${figures.join(" | ")}`);
    const media = execFileSync("unzip", ["-l", docx], { encoding: "utf8" }).split("\n").filter((line) => line.includes("word/media")).length;
    if (media < 5) throw new Error(`expected the compressed photo in the docx, media count ${media}`);

    await page.locator('[data-section="blocks"]').click();
    const dropped = await page.evaluate(async (b64) => {
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      const file = new File([bytes], "horizon-a.jpg", { type: "image/jpeg" });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      const zone = document.querySelector('label[data-label="A"]');
      const event = new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer });
      zone.dispatchEvent(event);
      return { capture: zone.querySelector("input").getAttribute("capture"), prevented: event.defaultPrevented };
    }, fs.readFileSync(profile).toString("base64"));
    if (dropped.capture) throw new Error("profile input still has capture");
    if (!dropped.prevented) throw new Error("dropping a photo was not accepted");
    await page.locator(".photo-grid img").waitFor();
    const [download2] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("export-docx").click(),
    ]);
    const docx2 = path.join(dir, "with-profile.docx");
    await download2.saveAs(docx2);
    const section2 = section6(docxTexts(docx2));
    if (section2.includes("No field photographs recorded")) throw new Error("section 6 dropped photos after drag-drop");
    if (!section2.includes("A —") && !section2.includes("horizon-a.jpg")) throw new Error(`section 6 missing the dropped profile photo: ${section2.slice(0, 400)}`);
    if (!section2.includes("orchard-large.jpg")) throw new Error("section 6 lost the file-picker photo");

    await page.reload();
    await page.locator('[data-section="evidence"]').click();
    await page.locator(".photo-grid img").waitFor();
    const stored = await page.evaluate(async () => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("field-apps");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const photos = await new Promise((resolve, reject) => {
        const query = db.transaction("photos").objectStore("photos").getAll();
        query.onsuccess = () => resolve(query.result);
        query.onerror = () => reject(query.error);
      });
      db.close();
      return photos.map((photo) => photo.category + ":" + (photo.label || photo.name));
    });
    if (!stored.includes("evidence:orchard-large.jpg") || !stored.includes("profile:A")) {
      throw new Error(`photos did not survive reload: ${stored.join(", ")}`);
    }

    const before = stored.length;
    await page.locator('[data-section="evidence"]').click();
    const heicChooser = page.waitForEvent("filechooser");
    await page.getByTestId("photo-input").locator("xpath=ancestor::label").click();
    await (await heicChooser).setFiles(heic);
    await page.locator("#toast").waitFor();
    const toast = await page.locator("#toast").innerText();
    if (!/could not be read|could not be saved/i.test(toast)) throw new Error(`undecodable photo failed silently: ${toast}`);
    await page.waitForTimeout(300);
    const after = await page.evaluate(async () => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("field-apps");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const photos = await new Promise((resolve, reject) => {
        const query = db.transaction("photos").objectStore("photos").getAll();
        query.onsuccess = () => resolve(query.result);
        query.onerror = () => reject(query.error);
      });
      db.close();
      return photos.length;
    });
    if (after !== before) throw new Error("an undecodable HEIC was stored");
  } finally {
    await browser.close();
    server.close();
  }
});
