# Field apps

Offline-first field reports. Shared browser code lives in `core/` (IndexedDB, photo compression, backup, storage persistence, and the cache-first service worker). Each report type is an app under `apps/`.

## Macadamia Acquisition Field Report

`apps/macadamia/` is the pre-purchase orchard report. It runs entirely in the browser. IndexedDB holds properties and photographs. `docx` is bundled into the page, so export does not use a CDN.

```bash
npm ci
npm test
npm run build
npx serve site
```

The built site is `site/`. GitHub Pages publishes that folder from `main`.

### Scoring

Block scores follow the Hoods weighted-block workbook (the same method as the Horsley report), not the old app and not the workbook’s Summary sheet.

- Site ratings are combined with `SUMPRODUCT(shares, ratings) / SUMIF(ratings, ">0", shares)`. Blank ratings drop out and the remaining shares are renormalised.
- Cultivar and irrigation infrastructure are rated once per block.
- Contribution = rating / 5 × weight.
- Weights from the block sheets: canopy 0.10, cultivar 0.10, orchard floor 0.20, soil physical 0.15, drainage 0.10, irrigation infrastructure 0.15, and crop, pest, disease, feeder roots, water supply and nutrition at 0.033 each. The weight check is 0.998.
- The Summary sheet’s 20/20/20/10/30 table is older and is not used. The Horsley report groups canopy with cultivar as 20% and the six small parameters as 20% combined; the workbook stores those six as 0.033, so they total 19.8%.
- Management uplift is potential minus current, in percentage points.
- Final conditional potential is `MIN(100%, management potential + R1 + R2 + R3)`. The default uplifts are 12, 8 and 6 percentage points and can be edited.
- The yield chart (the reference’s Figure 13) draws only the risks that apply to that block. Their allowances share the points left before 100%, using the largest-remainder method so the bar totals exactly 100. With all three risks, 52% current and 82% management potential leaves 18 points and 12:8:6 becomes 8, 6 and 4. A block with only R1 at 55% current and 80% potential is `55 + 25 + 20 = 100%`. Risks no block uses are left off the legend.
- The method and source notes from the workbook are included in the Word export.

`npm test` recalculates the workbook with LibreOffice and checks Block 1 against those values. It also checks that a 4.1 grid marks a C range when sites differ, P at the management potential, and R1/R2/R3 where a risk applies.

### Section 4.1

Each block’s improvement profile is a Word table generated with the export. C marks the recorded rating, or every point from the lowest to the highest rating when sites differ. P marks the management potential. R1, R2 and R3 come from the risk register: each risk lists the domains it applies to and the rating column for its mark. There is no manual layout step after export.

### Offline behaviour

Photographs are resized so the long edge is about 1800 px and stored as JPEG at quality 0.8, with a thumbnail for the screen. The Word file uses those compressed images. Backup is one JSON file containing every property and every image. The service worker is cache-first and versioned on each build. When a new version is waiting, the app asks you to reload.
