import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import * as esbuild from "esbuild";

execSync("node scripts/make-icons.mjs", { stdio: "inherit" });

const site = path.resolve("site");
fs.rmSync(site, { recursive: true, force: true });
fs.mkdirSync(site, { recursive: true });

await esbuild.build({
  entryPoints: ["apps/macadamia/main.js"],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2022"],
  outfile: "site/app.js",
  legalComments: "none",
});

for (const file of ["index.html", "app.css", "manifest.webmanifest"]) {
  fs.copyFileSync(path.join("apps/macadamia", file), path.join(site, file));
}
fs.cpSync("apps/macadamia/icons", path.join(site, "icons"), { recursive: true });
fs.cpSync("apps/macadamia/logos", path.join(site, "logos"), { recursive: true });

const version = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const assets = [
  "./",
  "./index.html",
  "./app.js",
  "./app.css",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
  "./logos/client.jpg",
  "./logos/assessor.jpg",
  "./logos/signature.png",
];
const sw = fs.readFileSync("core/sw.js", "utf8")
  .replaceAll("__CACHE_VERSION__", version)
  .replace("__ASSET_LIST__", JSON.stringify(assets, null, 2));
fs.writeFileSync(path.join(site, "sw.js"), sw);
console.log(`built site (${version})`);
