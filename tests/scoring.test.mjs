import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  improvementGrid,
  PARAMETERS,
  scoreBlock,
  shareWeightedMean,
  blockIsAssessed,
  chartLegendIds,
  chartRisksForBlock,
  yieldChartRow,
} from "../apps/macadamia/scoring.js";
import { createHorsleyProperty } from "./fixtures/horsley-property.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = path.join(root, "tests/fixtures/weighted-block-condition.xlsx");

function close(actual, expected, tolerance = 1e-6) {
  assert.ok(
    actual != null && expected != null && Math.abs(actual - expected) <= tolerance,
    `${actual} is not within ${tolerance} of ${expected}`,
  );
}

test("blank site ratings are excluded and the remaining shares are renormalised", () => {
  const mean = shareWeightedMean([
    { share: 0.25, ratings: { canopy: 2 } },
    { share: 0.75, ratings: { canopy: "" } },
  ], "canopy");
  assert.equal(mean, 2);
  const mixed = shareWeightedMean([
    { share: 0.2, ratings: { floor: 5 } },
    { share: 0.8, ratings: { floor: 1 } },
  ], "floor");
  assert.equal(mixed, 1.8);
});

test("conditional capital potential is capped at 100%", () => {
  const ratings = Object.fromEntries(PARAMETERS.map((param) => [param.id, 5]));
  const result = scoreBlock({
    sites: [{ share: 1, ratings }],
    blockRatings: { cultivar: 5, irrigation: 5 },
    potentialRatings: ratings,
    uplifts: { r1: 12, r2: 8, r3: 6 },
  });
  close(result.potential, 0.998);
  close(result.weightSum, 0.998);
  assert.equal(result.finalConditional, 1);
});

test("Block 1 matches the LibreOffice recalculation of the workbook", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "block-score-"));
  const profile = path.join(dir, "profile");
  execFileSync("soffice", [
    `-env:UserInstallation=file://${profile}`,
    "--headless",
    "--norestore",
    "--convert-to",
    "xlsx",
    "--outdir",
    dir,
    fixture,
  ], { stdio: "pipe" });
  const converted = path.join(dir, "weighted-block-condition.xlsx");
  const raw = execFileSync("python3", [path.join(root, "tests/extract_block1.py"), converted], { encoding: "utf8" });
  const sheet = JSON.parse(raw);
  const result = scoreBlock(sheet);
  const computed = sheet.computed;
  close(result.weightSum, computed.weightSum);
  close(result.current, computed.current);
  close(result.potential, computed.potential);
  close(result.managementUpliftPp, computed.managementUpliftPp, 1e-4);
  close(result.finalConditional, computed.finalConditional);
  for (const param of result.parameters) {
    close(param.currentRating, computed.currentRatings[param.id]);
    close(param.currentContribution, computed.contributions[param.id]);
    close(param.potentialContribution, computed.potentialContributions[param.id]);
    close(param.upliftPp, computed.upliftPp[param.id], 1e-4);
  }
});

test("Figure 13 bars total 100% with 1, 2 or 3 applicable risks", () => {
  const three = [
    { id: "R1", allowance: 12 },
    { id: "R2", allowance: 8 },
    { id: "R3", allowance: 6 },
  ];
  const horsley = [
    [0.52, 0.82, 52, 30, 8, 6, 4],
    [0.51, 0.81, 51, 30, 9, 6, 4],
    [0.53, 0.81, 53, 28, 9, 6, 4],
  ];
  const threeRows = horsley.map(([current, potential, shownCurrent, management, r1, r2, r3], index) => {
    const row = yieldChartRow(`Block ${index + 1}`, { current, potential }, three);
    assert.deepEqual(row.segments.map((segment) => [segment.id, segment.value]), [["R1", r1], ["R2", r2], ["R3", r3]]);
    assert.equal(row.total, 100);
    assert.equal(row.line, `Block ${index + 1}: ${shownCurrent} + ${management} + ${r1} + ${r2} + ${r3} = 100%`);
    return row;
  });
  assert.deepEqual(chartLegendIds(threeRows), ["R1", "R2", "R3"]);

  const onlyR1 = yieldChartRow("Block 2", { current: 0.55, potential: 0.80 }, [{ id: "R1", allowance: 12 }]);
  assert.deepEqual(onlyR1.segments, [{ id: "R1", value: 20 }]);
  assert.equal(onlyR1.total, 100);
  assert.equal(onlyR1.line, "Block 2: 55 + 25 + 20 = 100%");

  const r2AndR3 = yieldChartRow("Block 1", { current: 0.40, potential: 0.70 }, [
    { id: "R3", allowance: 6 },
    { id: "R2", allowance: 8 },
  ]);
  assert.deepEqual(r2AndR3.segments, [{ id: "R2", value: 17 }, { id: "R3", value: 13 }]);
  assert.equal(r2AndR3.total, 100);
  assert.equal(r2AndR3.line, "Block 1: 40 + 30 + 17 + 13 = 100%");
  assert.deepEqual(chartLegendIds([onlyR1, r2AndR3]), ["R1", "R2", "R3"]);
  assert.deepEqual(chartLegendIds([onlyR1]), ["R1"]);
});

test("a risk applies to a block only when the register says so", () => {
  const block = { id: "b2", name: "Block 2" };
  const risks = [
    { id: "R1", blockIds: ["b1"] },
    { id: "R2", blockIds: ["b2"] },
    { id: "R3", blockIds: null },
  ];
  const uplifts = { r1: 12, r2: 8, r3: 6 };
  assert.deepEqual(chartRisksForBlock(block, risks, uplifts).map((risk) => risk.id), ["R2", "R3"]);
  const row = yieldChartRow(block.name, { current: 0.55, potential: 0.80 }, chartRisksForBlock(block, risks, uplifts));
  assert.equal(row.total, 100);
  assert.equal(row.segments.reduce((sum, segment) => sum + segment.value, 0), 20);
  assert.deepEqual(row.segments.map((segment) => segment.id), ["R2", "R3"]);
});

test("Horsley blocks produce the published Figure 13 bars and are not scored as zero", () => {
  const property = createHorsleyProperty();
  const lines = property.blocks.filter(blockIsAssessed).map((block) => yieldChartRow(
    block.name,
    scoreBlock({
      sites: block.observations,
      blockRatings: block.current,
      potentialRatings: block.potential,
      uplifts: property.uplifts,
    }),
    chartRisksForBlock(block, property.risks, property.uplifts),
  ).line);
  assert.deepEqual(lines, [
    "Block 1: 52 + 30 + 8 + 6 + 4 = 100%",
    "Block 2: 51 + 30 + 9 + 6 + 4 = 100%",
    "Block 3: 53 + 28 + 9 + 6 + 4 = 100%",
  ]);
  assert.equal(blockIsAssessed({ observations: [{ ratings: {} }], current: {}, potential: {} }), false);
});

test("the 4.1 grid marks a C range, P, and risks linked to a domain", () => {
  const block = {
    current: { cultivar: 3, irrigation: 2 },
    potential: { canopy: 3, cultivar: 4, floor: 4, irrigation: 3 },
    change: { canopy: "Lower the canopy" },
    observations: [
      { share: 0.5, ratings: { canopy: 2, floor: 2 } },
      { share: 0.5, ratings: { canopy: 4, floor: 2 } },
    ],
  };
  const risks = [
    { id: "R1", domains: ["canopy", "cultivar"], gridRating: 5 },
    { id: "R2", domains: ["irrigation", "water"], gridRating: 4 },
  ];
  const grid = improvementGrid(block, risks);
  const canopy = grid.find((row) => row.id === "canopy");
  assert.equal(canopy.cells[1], "");
  assert.equal(canopy.cells[2], "C");
  assert.equal(canopy.cells[3], "C P");
  assert.equal(canopy.cells[4], "C");
  assert.equal(canopy.cells[5], "R1");
  assert.equal(canopy.change, "Lower the canopy");
  const floor = grid.find((row) => row.id === "floor");
  assert.equal(floor.cells[2], "C");
  assert.equal(floor.cells[4], "P");
  const irrigation = grid.find((row) => row.id === "irrigation");
  assert.equal(irrigation.cells[2], "C");
  assert.equal(irrigation.cells[3], "P");
  assert.equal(irrigation.cells[4], "R2");
  assert.equal(grid.map((row) => row.id).join(","), "cultivar,canopy,crop,pest,disease,roots,soil,drainage,irrigation,floor,water,nutrition");
});
