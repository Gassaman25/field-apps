import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  Packer,
  PageNumber,
  PageOrientation,
  Paragraph,
  SectionType,
  ShadingType,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import { yieldChartPng } from "./chart.js";
import { CANOPY_IDS, GROUND_IDS } from "./model.js";
import {
  CALC_NOTE,
  CAPITAL_ITEMS,
  CAPITAL_NOTE,
  formatPercent,
  formatPp,
  GRID_INTERPRETATION,
  GRID_LEGEND,
  GRID_RULE,
  IOM_CITATION,
  improvementGrid,
  METHOD_NOTE,
  parameterById,
  PARAMETERS,
  RATINGS_METHODOLOGY,
  scoreStoredBlock,
  SOURCE_NOTE,
  weightPercentLabel,
  blockIsAssessed,
  chartRisksForBlock,
  yieldChartExplanation,
  yieldChartRow,
} from "./scoring.js";

const FONT = "Arial";
const INK = "17342A";
const FOREST = "173D2B";
const LEAF = "477A57";
const LINE = "D7D5C9";
const RATING_FILL = { 1: "B71C1C", 2: "E53935", 3: "F9A825", 4: "43A047", 5: "1B5E20" };
const RATING_INK = { 1: "FFFFFF", 2: "FFFFFF", 3: "1A1A1A", 4: "FFFFFF", 5: "FFFFFF" };

const thin = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const none = { style: BorderStyle.NIL, size: 0, color: "FFFFFF" };
const box = { top: thin, bottom: thin, left: thin, right: thin };
const A4 = { width: 11906, height: 16838 };
const portraitMargin = { top: 902, right: 851, bottom: 902, left: 851, header: 318, footer: 709 };
const coverMargin = { top: 900, right: 850, bottom: 900, left: 850, header: 320, footer: 708 };
const landscapeMargin = { top: 851, right: 902, bottom: 851, left: 902, header: 318, footer: 709 };

let tableNo = 1;
let figureNo = 1;

function resetCounters() {
  tableNo = 1;
  figureNo = 1;
}

function run(text, opts = {}) {
  return new TextRun({
    text: text == null ? "" : String(text),
    font: FONT,
    size: opts.size ?? 20,
    bold: !!opts.bold,
    italics: !!opts.italics,
    color: opts.color || INK,
  });
}

function body(text, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after ?? 160, before: opts.before ?? 0 },
    alignment: opts.align,
    children: [run(text, opts)],
  });
}

function lines(text) {
  const parts = String(text || "").split(/\n/).map((line) => line.trim()).filter(Boolean);
  if (!parts.length) return [body("Not recorded.")];
  return parts.map((line) => body(line));
}

function heading(text, level) {
  const headingLevel = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][level - 1];
  return new Paragraph({ heading: headingLevel, children: [new TextRun(text)] });
}

function caption(text) {
  return new Paragraph({
    style: "Caption",
    spacing: { before: 80, after: 160 },
    children: [run(text, { size: 18, italics: true, color: "44546A" })],
  });
}

function cell(text, opts = {}) {
  const fill = opts.fill;
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: fill ? { type: ShadingType.CLEAR, fill } : undefined,
    margins: opts.margins || { top: 60, bottom: 60, left: 80, right: 80 },
    verticalAlign: VerticalAlign.CENTER,
    borders: opts.borders || box,
    columnSpan: opts.span,
    children: [
      new Paragraph({
        alignment: opts.align || AlignmentType.LEFT,
        children: [run(text, { size: opts.size ?? 18, bold: !!opts.bold, color: opts.color || INK })],
      }),
    ],
  });
}

function headerRow(labels, widths) {
  return new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: labels.map((label, i) => cell(label, {
      fill: FOREST,
      color: "FFFFFF",
      bold: true,
      width: widths?.[i],
      size: 16,
    })),
  });
}

function fieldTable(rows) {
  const widths = [32, 68];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: box,
    rows: [
      headerRow(["Field", "Recorded information"], widths),
      ...rows.map(([label, value]) => new TableRow({
        cantSplit: true,
        children: [
          cell(label, { bold: true, width: widths[0], size: 18 }),
          cell(value || "Not recorded", { width: widths[1], size: 18 }),
        ],
      })),
    ],
  });
}

function dataTable(headers, data, widths) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: box,
    rows: [
      headerRow(headers, widths),
      ...data.map((row) => new TableRow({
        cantSplit: true,
        children: row.map((value, i) => cell(value || "—", { width: widths?.[i], size: 16 })),
      })),
    ],
  });
}

function reportFooter() {
  const top = { style: BorderStyle.SINGLE, size: 8, color: "000000" };
  const edge = { top, bottom: none, left: none, right: none };
  const style = { font: FONT, size: 18, color: "000000" };
  return new Footer({
    children: [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: edge,
                children: [new Paragraph({ children: [new TextRun({ ...style, text: "Due Diligence Report" })] })],
              }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: edge,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new TextRun({ ...style, text: "Page " }),
                      new TextRun({ ...style, children: [PageNumber.CURRENT] }),
                      new TextRun({ ...style, text: " of " }),
                      new TextRun({ ...style, children: [PageNumber.TOTAL_PAGES] }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function emptyFooter() {
  return new Footer({ children: [new Paragraph("")] });
}

function emptyHeader() {
  return new Header({ children: [new Paragraph("")] });
}

function portrait(children, opts = {}) {
  return {
    properties: {
      type: opts.first ? undefined : SectionType.NEXT_PAGE,
      page: {
        size: { ...A4 },
        margin: opts.cover ? coverMargin : portraitMargin,
        pageNumbers: opts.startAt != null ? { start: opts.startAt } : undefined,
      },
    },
    headers: { default: emptyHeader() },
    footers: { default: opts.cover ? emptyFooter() : reportFooter() },
    children,
  };
}

function landscape(children) {
  return {
    properties: {
      type: SectionType.NEXT_PAGE,
      page: {
        size: { ...A4, orientation: PageOrientation.LANDSCAPE },
        margin: landscapeMargin,
      },
    },
    headers: { default: emptyHeader() },
    footers: { default: reportFooter() },
    children,
  };
}

async function toBytes(blob) {
  if (!blob) return null;
  if (blob instanceof Uint8Array) return blob;
  return new Uint8Array(await blob.arrayBuffer());
}

function fit(width, height, maxW, maxH) {
  const w = width || maxW;
  const h = height || maxH;
  const scale = Math.min(maxW / w, maxH / h, 1);
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

async function imageParagraph(photo, maxW, maxH) {
  const data = await toBytes(photo?.blob);
  if (!data) return null;
  const type = photo.type || ((photo.blob?.type || "").includes("png") || /\.png$/i.test(photo.name || "") ? "png" : "jpg");
  const size = fit(photo.width, photo.height, maxW, maxH);
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 40 },
    children: [
      new ImageRun({
        type,
        data,
        transformation: size,
        altText: { name: photo.caption || photo.name || "Figure", description: photo.caption || photo.name || "Field photograph", title: photo.caption || "Photograph" },
      }),
    ],
  });
}

function photosOf(photos, category, extra = {}) {
  return (photos || []).filter((photo) => {
    if (photo.category !== category) return false;
    if (extra.blockId && photo.blockId !== extra.blockId) return false;
    if (extra.observationId && photo.observationId !== extra.observationId) return false;
    return true;
  });
}

function nextFigure(text) {
  const n = figureNo;
  figureNo += 1;
  return caption(`Figure ${n}: ${text}`);
}

function nextTable(text) {
  const n = tableNo;
  tableNo += 1;
  return caption(`Table ${n}: ${text}`);
}

async function figureBlock(photos, title, maxW, maxH) {
  const out = [];
  for (const photo of photos) {
    const para = await imageParagraph(photo, maxW, maxH);
    if (para) out.push(para);
  }
  if (out.length) out.push(nextFigure(title));
  return out;
}

function ratingTable(title, ids, observation) {
  const rows = ids.map((id) => {
    const param = parameterById(id);
    const score = observation.ratings?.[id];
    const note = observation.notes?.[id];
    return [param?.name || id, score ? String(score) : "—", note || "—"];
  });
  return [
    heading(title, 3),
    dataTable(["Assessment domain", "Rating (1–5)", "Observation and evidence"], rows, [28, 16, 56]),
  ];
}

function improvementTable(block, risks) {
  const grid = improvementGrid(block, risks);
  const widths = [22, 8, 8, 8, 8, 8, 38];
  const header = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: [
      cell("Assessment domain", { fill: "173F2B", color: "FFFFFF", bold: true, width: widths[0], size: 15, align: AlignmentType.LEFT }),
      ...[1, 2, 3, 4, 5].map((n) => cell(String(n), {
        fill: RATING_FILL[n],
        color: RATING_INK[n],
        bold: true,
        width: widths[n],
        size: 16,
        align: AlignmentType.CENTER,
      })),
      cell("Change needed for proposed rating", { fill: "173F2B", color: "FFFFFF", bold: true, width: widths[6], size: 15 }),
    ],
  });
  const rows = grid.map((row) => new TableRow({
    cantSplit: true,
    children: [
      cell(row.name, { bold: true, width: widths[0], size: 16 }),
      ...[1, 2, 3, 4, 5].map((n) => cell(row.cells[n] || "", {
        fill: RATING_FILL[n],
        color: RATING_INK[n],
        bold: true,
        width: widths[n],
        size: 16,
        align: AlignmentType.CENTER,
      })),
      cell(row.change || "", { width: widths[6], size: 15 }),
    ],
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: box,
    rows: [header, ...rows],
  });
}

function profileRows(observation) {
  const soil = observation.soil || {};
  return [
    ["Observation method / reference", soil.method],
    ["Observation depth", soil.depth],
    ["Soil classification", soil.classification],
    ["Surface horizon", soil.surface],
    ["Subsoil horizon", soil.subsoil],
    ["Effective rooting depth and distribution", soil.rooting],
    ["Drainage and wetness indicators", soil.drainage],
    ["Restrictive layers and constraints", soil.constraints],
    ["Profile interpretation and orchard implication", soil.interpretation],
  ];
}

async function profileFigures(photos, observation) {
  const mine = photosOf(photos, "profile", { blockId: undefined, observationId: observation.id })
    .concat(photos.filter((p) => p.category === "profile" && p.observationId === observation.id));
  const unique = [...new Map(mine.map((p) => [p.id, p])).values()];
  const order = { A: 0, B1: 1, B2: 2 };
  unique.sort((a, b) => (order[a.label] ?? 9) - (order[b.label] ?? 9));
  if (!unique.length) return [body("No profile photographs recorded.")];
  const cells = [];
  for (const photo of unique) {
    const image = await imageParagraph(photo, 220, 280);
    cells.push(new TableCell({
      width: { size: Math.floor(100 / Math.max(unique.length, 1)), type: WidthType.PERCENTAGE },
      borders: { top: none, bottom: none, left: none, right: none },
      children: [
        image || new Paragraph(""),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 40, after: 80 },
          children: [run(photo.label || "", { bold: true, size: 22 })],
        }),
      ],
    }));
  }
  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
      rows: [new TableRow({ cantSplit: true, children: cells })],
    }),
    nextFigure(`Profile picture of ${observation.code || "the observation"}`),
  ];
}

function orDash(value, suffix = "") {
  const text = String(value || "").trim();
  return text ? `${text}${suffix}` : "Not recorded";
}

export async function buildDocx(property, photos) {
  resetCounters();
  const cover = property.cover || {};
  const profile = property.profile || {};
  const name = cover.propertyName || "Untitled property";
  const year = cover.year || "";
  const blocks = property.blocks?.length ? property.blocks : [];
  const uplifts = property.uplifts || { r1: 12, r2: 8, r3: 6 };
  const risks = property.risks || [];
  const scores = blocks.map((block) => ({ block, score: scoreStoredBlock(block, uplifts) }));

  const clientLogo = photosOf(photos, "logo-client")[0];
  const assessorLogo = photosOf(photos, "logo-assessor")[0];
  const signature = photosOf(photos, "signature")[0];
  const coverPhoto = photosOf(photos, "cover-photo")[0];

  const coverChildren = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 40 },
      children: [run(`${name} Due Diligence Report`, { size: 48, bold: true, color: FOREST })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [run(year, { size: 32, color: LEAF })],
    }),
  ];
  if (coverPhoto) {
    const photo = await imageParagraph(coverPhoto, 620, 340);
    if (photo) coverChildren.push(photo);
  }
  const leftBits = [];
  const rightBits = [];
  const clientImg = await imageParagraph(clientLogo, 200, 90);
  const assessorImg = await imageParagraph(assessorLogo, 220, 80);
  if (clientImg) leftBits.push(clientImg);
  leftBits.push(body("Contact details", { bold: true, size: 22, color: FOREST, after: 60 }));
  leftBits.push(body([cover.client?.person, cover.client?.role, cover.client?.organisation].filter(Boolean).join(", ") || "Client contact not recorded"));
  if (cover.client?.website) leftBits.push(body(cover.client.website));
  if (cover.client?.phone) leftBits.push(body(`M: ${cover.client.phone}`));
  if (cover.client?.email) leftBits.push(body(`E: ${cover.client.email}`));
  if (assessorImg) rightBits.push(assessorImg);
  rightBits.push(body("Contact details", { bold: true, size: 22, color: FOREST, after: 60 }));
  const assessor = cover.assessorContact || {};
  rightBits.push(body(assessor.person || cover.assessorName || "Assessor not recorded"));
  if (assessor.qualifications) rightBits.push(body(assessor.qualifications));
  if (assessor.organisation) rightBits.push(body(assessor.organisation));
  if (assessor.address) rightBits.push(...lines(assessor.address));
  if (assessor.phone) rightBits.push(body(`M: ${assessor.phone}`));
  if (assessor.email) rightBits.push(body(`E: ${assessor.email}`));
  if (signature) {
    const signed = await imageParagraph(signature, 200, 70);
    if (signed) rightBits.push(signed);
  }
  coverChildren.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
    rows: [new TableRow({
      children: [
        new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, borders: { top: none, bottom: none, left: none, right: none }, children: leftBits }),
        new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, borders: { top: none, bottom: none, left: none, right: none }, children: rightBits }),
      ],
    })],
  }));
  coverChildren.push(body(""));
  coverChildren.push(fieldTable([
    ["Location", cover.location],
    ["Commissioned by", cover.commissionedBy],
    ["Inspection date", cover.inspectionDate],
    ["Report date", cover.reportDate],
    ["Assessor", cover.assessorName],
  ]));
  coverChildren.push(body(cover.preparedFor || "Prepared for pre-purchase agronomic due diligence", { before: 200, italics: true }));
  coverChildren.push(new Paragraph({
    spacing: { before: 360, after: 120 },
    children: [run("Table of contents", { size: 32, bold: true, color: FOREST })],
  }));
  coverChildren.push(new TableOfContents("Table of contents", { hyperlink: true, headingStyleRange: "1-3" }));

  const section12 = [
    heading("1. Executive acquisition assessment", 1),
    fieldTable([
      ["Overall orchard condition", property.executive?.condition],
      ["Agronomic conclusion", property.executive?.conclusion],
    ]),
    body("Decision summary", { bold: true, before: 200 }),
    ...lines(property.executive?.summary),
    heading("2. Property, orchard profile and inspection scope", 1),
    fieldTable([
      ["Property", name],
      ["Location", cover.location],
      ["Crop stage", profile.cropStage],
      ["Production system", profile.productionSystem],
      ["Total area", profile.totalArea ? `${profile.totalArea} ha` : ""],
      ["Bearing area", profile.bearingArea ? `${profile.bearingArea} ha` : ""],
      ["Tree count", profile.treeCount],
    ]),
    heading("Farm map", 2),
    ...(await figureBlock(photosOf(photos, "farm-map"), `Map of farm – ${name}`, 620, 420)),
    ...(photosOf(photos, "farm-map").length ? [] : [body("No farm map attached.")]),
    heading("Property details", 2),
    ...lines(profile.establishedNarrative),
    heading("Soil and landscape", 2),
    ...lines(profile.soilNarrative),
    ...(await figureBlock(photosOf(photos, "soil-map"), "Blocks and soil type", 620, 420)),
    nextTable("Soil type description"),
    dataTable(
      ["Soil type", "Description", "Landscape"],
      (profile.soils || []).length
        ? profile.soils.map((soil) => [soil.code, soil.description, soil.landscape])
        : [["—", "Not recorded", "—"]],
      [18, 42, 40],
    ),
    nextTable("Soil type classification"),
    dataTable(
      ["Soil type", "ASC", "Major attributes", "Great Soil Group"],
      (profile.soils || []).length
        ? profile.soils.map((soil) => [soil.code, soil.asc, soil.attributes, soil.greatGroup])
        : [["—", "Not recorded", "—", "—"]],
      [16, 22, 40, 22],
    ),
    body("ASC = Australian Soil Classification.", { italics: true, size: 18 }),
    heading("Macadamia cultivars", 2),
    ...lines(profile.cultivarIntro),
    nextTable("Macadamia cultivars"),
    dataTable(
      ["Cultivar", "Tree habit", "Flowering period", "Drop pattern", "Nut / kernel characteristics"],
      (profile.cultivars || []).length
        ? profile.cultivars.map((row) => [row.name, row.habit, row.flowering, row.drop, row.kernel])
        : [["—", "Not recorded", "—", "—", "—"]],
      [14, 22, 22, 18, 24],
    ),
    heading("Recent conditions", 2),
    ...lines(profile.recentConditions),
    heading("Management history", 2),
    ...lines(profile.managementHistory),
    heading("Inspection method and coverage", 2),
    ...lines(profile.inspectionMethod),
    heading("Records reviewed", 2),
    ...lines(profile.recordsReviewed),
    heading("Inspection limitations", 2),
    ...lines(profile.limitations),
    heading("Condition ratings methodology", 2),
    body(RATINGS_METHODOLOGY),
    heading("3. Block assessments", 1),
  ];

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    section12.push(heading(`3.${index + 1}. ${block.name || `Block ${index + 1}`}`, 2));
    section12.push(fieldTable([
      ["Area", block.area ? `${block.area} ha` : ""],
      ["Cultivar", block.cultivar],
      ["Tree age / year planted", block.age],
      ["Map / GPS reference", block.gps],
      ["Inspection coverage and route", block.coverage],
      ["Observation sites", String(block.observations?.length || 0)],
      ["Cultivar rating", block.current?.cultivar],
      ["Irrigation infrastructure rating", block.current?.irrigation],
    ]));
    const maps = photosOf(photos, "block-map", { blockId: block.id });
    const codes = (block.observations || []).map((obs) => obs.code).filter(Boolean).join(", ");
    section12.push(...(await figureBlock(maps, `Map highlighting ${codes || "the observation sites"} in ${block.name || "the block"}`, 620, 420)));
    if (!maps.length) section12.push(body("No block map attached."));
    for (const observation of block.observations || []) {
      section12.push(heading(`Observation ${observation.code || ""}`.trim(), 3));
      section12.push(fieldTable([
        ["Site type", observation.siteType],
        ["Landscape position / location", observation.position],
        ["GPS reference", observation.gps],
        ["Block share", observation.share],
        ["Selection reason and representativeness", observation.selection],
      ]));
      section12.push(...ratingTable("Canopy and crop condition", CANOPY_IDS, observation));
      section12.push(...ratingTable("Soil, roots and water", GROUND_IDS, observation));
      section12.push(heading("Soil profile description", 3));
      section12.push(fieldTable(profileRows(observation)));
      section12.push(heading("Soil profile photographs", 3));
      section12.push(...(await profileFigures(photos, observation)));
      section12.push(heading("Observation finding and implication", 3));
      section12.push(body("Observation finding", { bold: true, after: 60 }));
      section12.push(...lines(observation.finding));
      section12.push(body("Implications", { bold: true, before: 80, after: 60 }));
      section12.push(...lines(observation.implication));
    }
  }

  const weightRows = PARAMETERS.map((param) => [param.name, weightPercentLabel(param.weight), param.level === "block" ? "Rated once per block" : "Share-weighted across sites"]);
  weightRows.push(["Weight check", weightPercentLabel(PARAMETERS.reduce((sum, param) => sum + param.weight, 0)), "0.033 × 6 = 0.198, so the six parameters are 19.8% combined"]);

  const section4 = [
    heading("4. Weighted block condition summary", 1),
    body("The weighted block condition assessment combines the block-sheet parameters into one condition score for each block. Canopy health and cultivar are 0.10 each (20% together). Orchard floor is 0.20, soil physical condition 0.15, irrigation infrastructure 0.15 and drainage 0.10. Crop condition, pest damage, disease symptoms, feeder roots, water supply and nutritional condition are 0.033 each. The Horsley report describes those six as 20% combined; the workbook stores 0.033 rather than a recurring one-sixth, so together they are 19.8% and the weight check is 99.8%. The Summary sheet’s 20/20/20/10/30 table is not used."),
    nextTable("Weighting basis"),
    dataTable(["Parameter", "Weight", "How it is rated"], weightRows, [40, 18, 42]),
    body(CALC_NOTE),
    body(METHOD_NOTE),
    body(SOURCE_NOTE),
    body(GRID_RULE),
    body("Individual condition and potential improvement", { bold: true, size: 24, color: FOREST, before: 200 }),
    body("The block condition improvement profiles show the current recorded rating and a management potential rating for each parameter. C, P and the risk marks are written by the assessment, not drawn after export. Potential ratings are management objectives, not guaranteed outcomes."),
    heading("4.1 Block condition improvement profiles", 3),
  ];
  for (const block of blocks.filter(blockIsAssessed)) {
    section4.push(heading(block.name || "Block", 3));
    section4.push(body(GRID_LEGEND));
    section4.push(improvementTable(block, risks));
    section4.push(body(GRID_INTERPRETATION, { before: 80 }));
  }

  const assessed = scores.filter(({ block }) => blockIsAssessed(block));
  const currents = assessed.map((row) => row.score.current);
  const potentials = assessed.map((row) => row.score.potential);
  const minPct = currents.length ? Math.min(...currents) : 0;
  const maxPct = currents.length ? Math.max(...currents) : 0;
  const minPot = potentials.length ? Math.min(...potentials) : 0;
  const maxPot = potentials.length ? Math.max(...potentials) : 0;
  const section5portraitLead = [
    nextTable("Current weighted block condition compared with potential condition following implementation of the recommended management interventions"),
    dataTable(
      ["Block", "Current weighted condition", "Potential condition"],
      assessed.length
        ? assessed.map(({ block, score }) => [block.name || "Block", formatPercent(score.current), formatPercent(score.potential)])
        : [["—", "—", "—"]],
      [40, 30, 30],
    ),
    body(`The current weighted condition is ${formatPercent(minPct)} to ${formatPercent(maxPct)}. Management potential is ${formatPercent(minPot)} to ${formatPercent(maxPot)}. Management uplift is the difference in percentage points.`),
    body(property.comparisonNotes || "These figures are management scenarios, not guaranteed outcomes. Improvement that depends on major infrastructure or redevelopment is the conditional capital potential below."),
    body("Conditional capital potential", { bold: true, size: 24, color: FOREST, before: 160 }),
    dataTable(
      ["Risk", "Intervention", "Uplift (pp)"],
      CAPITAL_ITEMS.map((item) => [item.risk, item.name, String(uplifts[item.id] ?? 0)]),
      [16, 64, 20],
    ),
    body(CAPITAL_NOTE),
    dataTable(
      ["Block", "Management potential", "Capital uplift (pp)", "Final conditional potential"],
      assessed.length
        ? assessed.map(({ block, score }) => [block.name || "Block", formatPercent(score.potential), formatPp(score.capital.totalPp), formatPercent(score.finalConditional)])
        : [["—", "—", "—", "—"]],
      [28, 24, 24, 24],
    ),
  ];

  const section5 = [
    heading("5. Material agronomic risk", 1),
    body("Material agronomic risks are constraints requiring capital works beyond routine management."),
    body("Purchase implications should identify the supporting evidence and appropriate capital or production-loss allowances."),
    nextTable("Material agronomic risks, supporting evidence and potential purchaser-funded capital requirements."),
    dataTable(
      ["Risk", "Location", "Finding and evidence", "Likelihood", "Consequence", "Purchase implication / condition"],
      risks.length
        ? risks.map((risk) => [risk.id, risk.location, risk.finding, risk.likelihood, risk.consequence, risk.implication])
        : [["—", "—", "Not recorded", "—", "—", "—"]],
      [10, 14, 28, 14, 14, 20],
    ),
  ];

  const chartRows = assessed.map(({ block, score }) => yieldChartRow(
    block.name || "Block",
    score,
    chartRisksForBlock(block, risks, uplifts),
  ));
  const chart = await yieldChartPng(chartRows);
  const chartPara = await imageParagraph(chart, 640, 820);
  const discussion = [
    ...lines(property.riskDiscussion || risks.map((risk) => `${risk.id || "Risk"}: ${risk.finding || "Not recorded"}`).join("\n")),
    body("Conditional capital-intervention scenario", { bold: true, size: 24, color: FOREST, before: 200 }),
    body(`Final conditional potential adds the R1 canopy uplift (${uplifts.r1 ?? 0} pp), the R2 irrigation uplift (${uplifts.r2 ?? 0} pp) and the R3 root-zone uplift (${uplifts.r3 ?? 0} pp) and caps the result at 100%. On the figure, only the risks that apply to a block are drawn. Their allowances share the points left after management improvement, rounded so that block’s bar totals exactly 100%.`),
    ...lines(property.capitalNarrative),
    body(CAPITAL_NOTE),
  ];
  if (chartPara) {
    const figureNumber = figureNo;
    discussion.push(chartPara, nextFigure("Visual confirmation of the yield potential with timely orchard management and additional capital investment"));
    discussion.push(body(yieldChartExplanation(figureNumber, chartRows, property.opinion?.benchmark)));
  }

  const evidence = [heading("6. Field photographic evidence", 1)];
  const evidencePhotos = photosOf(photos, "evidence");
  if (!evidencePhotos.length) evidence.push(body("No field photographs recorded."));
  for (const photo of evidencePhotos) {
    const para = await imageParagraph(photo, 520, 380);
    if (!para) continue;
    evidence.push(para, nextFigure(photo.caption || photo.name || "Field photograph"));
  }

  const benchmark = Number(property.opinion?.benchmark);
  const areaWeights = scores.map(({ block, score }) => ({
    area: Number(block.area) > 0 ? Number(block.area) : 0,
    score,
  }));
  const weighted = areaWeights.filter((row) => row.area > 0);
  const basis = weighted.length ? weighted : areaWeights.map((row) => ({ area: 1, score: row.score }));
  const areaSum = basis.reduce((sum, row) => sum + row.area, 0) || 1;
  const meanCurrent = basis.reduce((sum, row) => sum + row.area * row.score.current, 0) / areaSum;
  const meanPotential = basis.reduce((sum, row) => sum + row.area * row.score.potential, 0) / areaSum;
  const opinionParas = [heading("7. Final agronomic opinion", 1)];
  if (Number.isFinite(benchmark) && benchmark > 0 && scores.length) {
    opinionParas.push(body(`Using ${benchmark.toFixed(1)} tonnes per hectare as a benchmark average crop, the area-weighted current condition of ${formatPercent(meanCurrent)} indicates current average production potential of about ${(benchmark * meanCurrent).toFixed(1)} t/ha. If management potential of ${formatPercent(meanPotential)} is achieved, average production potential is about ${(benchmark * meanPotential).toFixed(1)} t/ha. This is a scenario estimate, not a guaranteed yield.`));
  }
  opinionParas.push(...lines(property.opinion?.text));
  opinionParas.push(body("Scope and limitations", { bold: true, before: 120 }));
  opinionParas.push(...lines(property.opinion?.limitations));
  opinionParas.push(body("Reliance and changed circumstances", { bold: true, before: 120 }));
  opinionParas.push(...lines(property.opinion?.reliance));

  const references = [heading("8. References", 1)];
  const cites = (property.references || []).map((item) => String(item || "").trim()).filter(Boolean);
  references.push(...(cites.length ? cites : [IOM_CITATION]).map((item) => body(item)));

  const appendix = property.appendix || {};
  const appendixChildren = [
    heading("Appendix A Soil chemistry assessment", 1),
    ...lines(appendix.intro),
    dataTable(
      ["Indicator", "Result", "Finding", "Due diligence implication"],
      (appendix.rows || []).some((row) => row.indicator || row.result || row.finding || row.implication)
        ? appendix.rows.map((row) => [row.indicator, row.result, row.finding, row.implication])
        : [["—", "Not recorded", "—", "—"]],
      [22, 26, 26, 26],
    ),
    body("Due diligence conclusion", { bold: true, before: 160 }),
    ...lines(appendix.conclusion),
    body("Purchaser actions", { bold: true, before: 120 }),
    ...((appendix.actions || []).map((item) => String(item || "").trim()).filter(Boolean).map((item) => body(`• ${item}`))),
    ...((appendix.actions || []).every((item) => !String(item || "").trim()) ? [body("Not recorded.")] : []),
    ...lines(appendix.source ? `Source: ${appendix.source}` : ""),
  ];

  const doc = new Document({
    title: `${name} Due Diligence Report`,
    creator: cover.assessorName || assessor.organisation || "Agronica",
    description: "Macadamia acquisition field report",
    features: { updateFields: true },
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 20, color: INK },
          paragraph: { spacing: { after: 120 } },
        },
      },
      paragraphStyles: [
        { id: "Heading1", name: "heading 1", basedOn: "Normal", next: "Normal", quickStyle: true, run: { font: FONT, size: 30, bold: true, color: FOREST }, paragraph: { spacing: { before: 300, after: 150 }, outlineLevel: 0 } },
        { id: "Heading2", name: "heading 2", basedOn: "Normal", next: "Normal", quickStyle: true, run: { font: FONT, size: 25, bold: true, color: LEAF }, paragraph: { spacing: { before: 220, after: 100 }, outlineLevel: 1 } },
        { id: "Heading3", name: "heading 3", basedOn: "Normal", next: "Normal", quickStyle: true, run: { font: FONT, size: 22, bold: true, color: FOREST }, paragraph: { spacing: { before: 180, after: 80 }, outlineLevel: 2 } },
        { id: "Caption", name: "caption", basedOn: "Normal", quickStyle: true, run: { font: FONT, size: 18, italics: true, color: "44546A" }, paragraph: { spacing: { after: 200 } } },
      ],
    },
    sections: [
      portrait(coverChildren, { first: true, cover: true }),
      portrait(section12, { startAt: 1 }),
      landscape(section4),
      portrait(section5portraitLead),
      landscape(section5),
      portrait([...discussion, ...evidence, ...opinionParas, ...references, ...appendixChildren]),
    ],
  });
  return Packer.toBlob(doc);
}
