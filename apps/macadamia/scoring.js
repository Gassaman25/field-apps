/**
 * Block scoring from the Hoods weighted-block workbook, which is the method
 * behind the Horsley due-diligence report.
 *
 * Site parameter rating (Excel on each block sheet):
 *   IF(SUMIF(ratings, ">0", shares) = 0, "",
 *      SUMPRODUCT(shares, ratings) / SUMIF(ratings, ">0", shares))
 * Ratings that are blank or not greater than zero drop out, and the remaining
 * site shares are renormalised. Cultivar and irrigation infrastructure are
 * entered once for the block, not per site.
 *
 * Contribution = rating / 5 × weight.
 * A blank current rating contributes nothing (Excel returns "").
 * A blank potential rating contributes 0, matching Excel's `D/5*B` on an empty cell.
 * Current condition and management potential are the sums of the contributions.
 * Management uplift (percentage points) = (potential − current) × 100.
 *
 * The block sheets, not the Summary sheet's 20/20/20/10/30 table, are the weights:
 * canopy 0.10, cultivar 0.10, orchard floor 0.20, soil physical 0.15,
 * drainage 0.10, irrigation infrastructure 0.15, and the other six at 0.033 each.
 * Those six sum to 0.198, so the weight check is 0.998 rather than 1.
 *
 * Final conditional potential = MIN(1, management potential + (R1 + R2 + R3) / 100).
 * Default uplifts are 12, 8 and 6 percentage points, and they are editable.
 */

export const PARAMETERS = [
  { id: "canopy", name: "Canopy health", weight: 0.1, level: "site" },
  { id: "cultivar", name: "Cultivar", weight: 0.1, level: "block" },
  { id: "floor", name: "Orchard floor", weight: 0.2, level: "site" },
  { id: "soil", name: "Soil physical condition", weight: 0.15, level: "site" },
  { id: "drainage", name: "Drainage", weight: 0.1, level: "site" },
  { id: "irrigation", name: "Irrigation infrastructure", weight: 0.15, level: "block" },
  { id: "crop", name: "Crop condition", weight: 0.033, level: "site" },
  { id: "pest", name: "Pest damage", weight: 0.033, level: "site" },
  { id: "disease", name: "Disease symptoms", weight: 0.033, level: "site" },
  { id: "roots", name: "Feeder roots", weight: 0.033, level: "site" },
  { id: "water", name: "Water supply", weight: 0.033, level: "site" },
  { id: "nutrition", name: "Nutritional condition", weight: 0.033, level: "site" },
];

/** Row order of the section 4.1 improvement profile, matching the reference report. */
export const GRID_ORDER = [
  "cultivar",
  "canopy",
  "crop",
  "pest",
  "disease",
  "roots",
  "soil",
  "drainage",
  "irrigation",
  "floor",
  "water",
  "nutrition",
];

export const SITE_PARAMETER_IDS = PARAMETERS.filter((p) => p.level === "site").map((p) => p.id);

export const DEFAULT_UPLIFTS = { r1: 12, r2: 8, r3: 6 };

export const CAPITAL_ITEMS = [
  { id: "r1", risk: "R1", name: "Canopy redevelopment or tree replacement" },
  { id: "r2", risk: "R2", name: "Irrigation upgrade or redesign" },
  { id: "r3", risk: "R3", name: "Orchard-floor and root-zone rehabilitation" },
];

export const METHOD_NOTE =
  "Site ratings are area-weighted before the parameter weights are applied. Unassessed ratings are excluded and the assessed site shares are normalised for that parameter. The 70:30 weighting is project-specific. Conditional capital potential adds the separate R1, R2 and R3 allowances after management potential and caps the result at 100%.";

export const IOM_CITATION =
  "Bright, J., Alt, S. & Commens, R. (2016). Macadamia integrated orchard management practice guide 2016 (2nd ed.). NSW Department of Primary Industries.";

export const SOURCE_NOTE = `IOM framework source: ${IOM_CITATION}`;

export const CALC_NOTE =
  "Calculation: parameter rating ÷ 5 × parameter weight. Management uplift equals management potential minus current condition and is reported in percentage points.";

export const CAPITAL_NOTE =
  "Apply only where the relevant works are additional to routine management, fully funded, completed and verified. Final scores are capped at 100%.";

export const RATINGS_METHODOLOGY =
  "Condition ratings are assigned using a five-point field assessment scale, where 5 represents a healthy condition with no material concern; 4 a minor concern; 3 moderate impairments; 2 severe impairment; and 1 critical decline or failure. NA is used where an assessment domain is not applicable and NI where it was not inspected. Ratings reflect the assessor’s professional judgement of conditions observed on the inspection date, considered relative to the block’s age, cultivar and crop stage. The scale provides a consistent framework for documenting orchard condition and identifying potential acquisition risks; however, it is not a statistically validated diagnostic or predictive index and does not independently confirm the cause of a condition or quantify its effect on yield or future performance.";

export const GRID_LEGEND =
  "C = current recorded rating or range. P = proposed achievable rating after the stated management change. R = material risk rating (R1-3). Proposed ratings are management objectives, not guaranteed outcomes.";

export const GRID_INTERPRETATION =
  "Interpretation: 5 = healthy, no material concern; 4 = minor concern; 3 = moderate impairment; 2 = severe impairment; 1 = critical decline or failure.";

export const GRID_RULE =
  "On each improvement profile, C marks the recorded rating. When assessed sites differ, C is marked on every point from the lowest to the highest recorded rating. The condition percentage uses the share-weighted mean of those same ratings. P marks the management potential rating entered for the block. R1, R2 and R3 are marked on the rating column of each risk-register entry that applies to that domain.";

export function parameterById(id) {
  return PARAMETERS.find((p) => p.id === id);
}

/** Excel treats blank and non-positive ratings as unassessed (`SUMIF > 0`). */
export function positiveRating(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n) || !(n > 0)) return null;
  return n;
}

function shareOf(value) {
  if (value === null || value === undefined || value === "") return 0;
  const raw = String(value).trim().replace(/%$/, "");
  const n = typeof value === "number" ? value : Number(raw);
  if (!Number.isFinite(n)) return 0;
  return n;
}

/**
 * Share-weighted mean. Blank shares count as zero, matching SUMPRODUCT / SUMIF.
 * Returns null when no assessed site has a positive share.
 */
export function shareWeightedMean(sites, key) {
  let numerator = 0;
  let denominator = 0;
  for (const site of sites || []) {
    const rating = positiveRating(site?.ratings?.[key]);
    if (rating === null) continue;
    const share = shareOf(site?.share);
    numerator += share * rating;
    denominator += share;
  }
  if (denominator === 0) return null;
  return numerator / denominator;
}

function readUplift(uplifts, key) {
  if (uplifts == null) return DEFAULT_UPLIFTS[key];
  const value = uplifts[key];
  if (value === undefined || value === null || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function scoreBlock({ sites = [], blockRatings = {}, potentialRatings = {}, uplifts = null } = {}) {
  const parameters = PARAMETERS.map((param) => {
    const currentRating = param.level === "site"
      ? shareWeightedMean(sites, param.id)
      : positiveRating(blockRatings[param.id]);
    const potentialRating = positiveRating(potentialRatings[param.id]);
    const potentialNumber = potentialRating === null ? 0 : potentialRating;
    const currentContribution = currentRating === null ? null : (currentRating / 5) * param.weight;
    const potentialContribution = (potentialNumber / 5) * param.weight;
    const upliftPp = currentContribution === null ? null : (potentialContribution - currentContribution) * 100;
    return {
      ...param,
      currentRating,
      potentialRating,
      currentContribution,
      potentialContribution,
      upliftPp,
    };
  });

  const weightSum = parameters.reduce((sum, p) => sum + p.weight, 0);
  const current = parameters.reduce((sum, p) => sum + (p.currentContribution ?? 0), 0);
  const potential = parameters.reduce((sum, p) => sum + p.potentialContribution, 0);
  const managementUpliftPp = (potential - current) * 100;
  const r1 = readUplift(uplifts, "r1");
  const r2 = readUplift(uplifts, "r2");
  const r3 = readUplift(uplifts, "r3");
  const capitalPp = r1 + r2 + r3;
  const finalConditional = Math.min(1, potential + capitalPp / 100);

  return {
    parameters,
    weightSum,
    current,
    potential,
    managementUpliftPp,
    capital: { r1, r2, r3, totalPp: capitalPp },
    finalConditional,
  };
}

export function scoreStoredBlock(block, uplifts) {
  return scoreBlock({
    sites: block?.observations || [],
    blockRatings: block?.current || {},
    potentialRatings: block?.potential || {},
    uplifts,
  });
}

/** A block with no recorded current rating is unassessed and must not be treated as zero. */
export function blockIsAssessed(block) {
  const score = scoreStoredBlock(block, { r1: 0, r2: 0, r3: 0 });
  return score.parameters.some((param) => param.currentRating != null);
}

function markColumn(value) {
  const n = positiveRating(value);
  if (n === null) return null;
  return Math.min(5, Math.max(1, Math.round(n)));
}

/** Integer columns that receive a C. A single rating is one column; differing sites fill the inclusive range. */
export function currentMarkColumns(block, paramId) {
  const param = parameterById(paramId);
  if (!param) return [];
  if (param.level === "block") {
    const col = markColumn(block?.current?.[paramId]);
    return col === null ? [] : [col];
  }
  const values = [];
  for (const site of block?.observations || []) {
    const col = markColumn(site?.ratings?.[paramId]);
    if (col !== null) values.push(col);
  }
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const cols = [];
  for (let c = min; c <= max; c += 1) cols.push(c);
  return cols;
}

export function potentialMarkColumn(block, paramId) {
  return markColumn(block?.potential?.[paramId]);
}

/** R marks from the risk register. A linked risk with no column still marks column 5. */
export function riskMarksFor(risks, paramId) {
  const marks = [];
  for (const risk of risks || []) {
    if (!(risk?.domains || []).includes(paramId)) continue;
    const id = String(risk.id || "").trim();
    if (!id) continue;
    marks.push({ id, column: markColumn(risk.gridRating) ?? 5 });
  }
  return marks;
}

/**
 * One row per domain for the 4.1 table. Cell text is C, P and any R labels
 * that land on that rating column.
 */
export function improvementGrid(block, risks) {
  return GRID_ORDER.map((id) => {
    const param = parameterById(id);
    const cCols = currentMarkColumns(block, id);
    const pCol = potentialMarkColumn(block, id);
    const marks = riskMarksFor(risks, id);
    const cells = {};
    for (let column = 1; column <= 5; column += 1) {
      const parts = [];
      if (cCols.includes(column)) parts.push("C");
      if (pCol === column) parts.push("P");
      for (const mark of marks) {
        if (mark.column === column) parts.push(mark.id);
      }
      cells[column] = parts.join(" ");
    }
    return {
      id,
      name: param.name,
      weight: param.weight,
      cells,
      change: block?.change?.[id] || "",
      currentColumns: cCols,
      potentialColumn: pCol,
    };
  });
}

export function weightPercentLabel(weight) {
  const pct = Math.round(weight * 1000) / 10;
  return `${Number.isInteger(pct) ? pct.toFixed(0) : pct.toFixed(1)}%`;
}

export function formatPercent(fraction) {
  if (fraction === null || fraction === undefined || Number.isNaN(fraction)) return "–";
  return `${(fraction * 100).toFixed(2)}%`;
}

export function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  return Number(value).toFixed(digits);
}

export function formatPp(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  return Number(value).toFixed(2);
}

/**
 * Split `total` integer points across weights using the largest-remainder method.
 * This is how Figure 13 turns the 12:8:6 capital allowances into the smaller
 * segments that fill only the points left before 100%. For a block at 52%
 * current and 82% management potential, 18 points remain and 12:8:6 becomes 8, 6 and 4.
 */
export function allocateLargestRemainder(total, weights) {
  const safe = weights.map((weight) => Math.max(0, Number(weight) || 0));
  const sum = safe.reduce((acc, weight) => acc + weight, 0);
  const points = Math.max(0, Math.round(total));
  if (points <= 0 || sum <= 0) return safe.map(() => 0);
  const exact = safe.map((weight) => (points * weight) / sum);
  const base = exact.map((value) => Math.floor(value));
  let left = points - base.reduce((acc, value) => acc + value, 0);
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (const item of order) {
    if (left <= 0) break;
    base[item.index] += 1;
    left -= 1;
  }
  return base;
}

function shownPercent(fraction) {
  if (!Number.isFinite(fraction)) return 0;
  return Math.min(100, Math.max(0, Math.round(fraction * 100)));
}

const RISK_ORDER = ["R1", "R2", "R3"];

function riskSort(a, b) {
  const ia = RISK_ORDER.indexOf(a);
  const ib = RISK_ORDER.indexOf(b);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || String(a).localeCompare(String(b));
}

/** Allowance edited on the property for R1, R2 and R3. Any other risk can carry its own allowance. */
export function riskAllowance(risk, uplifts) {
  const id = String(risk?.id || "").trim();
  const key = id.toLowerCase();
  if (uplifts && uplifts[key] !== undefined && uplifts[key] !== null && uplifts[key] !== "") {
    const value = Number(uplifts[key]);
    if (Number.isFinite(value)) return Math.max(0, value);
  }
  const own = Number(risk?.allowance);
  return Number.isFinite(own) ? Math.max(0, own) : 0;
}

/**
 * A risk applies to a block when blockIds is null (every block) or lists that block.
 * Only risks with a positive allowance take a share of the bar.
 */
export function chartRisksForBlock(block, risks, uplifts) {
  return (risks || [])
    .filter((risk) => {
      if (!String(risk?.id || "").trim()) return false;
      if (risk.blockIds == null) return true;
      return (risk.blockIds || []).includes(block?.id);
    })
    .map((risk) => ({ id: String(risk.id).trim(), allowance: riskAllowance(risk, uplifts) }))
    .filter((risk) => risk.allowance > 0)
    .sort((a, b) => riskSort(a.id, b.id));
}

/**
 * One stacked bar. Current and management improvement come from the rounded
 * condition scores. The points left to 100% are split across only the risks
 * that apply to this block, in proportion to their allowances, then rounded
 * so the segments sum to exactly 100.
 */
export function yieldChartRow(name, score, risks) {
  const current = shownPercent(score?.current);
  const potential = shownPercent(score?.potential);
  const management = Math.max(0, potential - current);
  const remaining = Math.max(0, 100 - current - management);
  const applicable = (risks || [])
    .map((risk) => ({ id: String(risk.id || "").trim(), allowance: Math.max(0, Number(risk.allowance) || 0) }))
    .filter((risk) => risk.id && risk.allowance > 0)
    .sort((a, b) => riskSort(a.id, b.id));
  const parts = allocateLargestRemainder(remaining, applicable.map((risk) => risk.allowance));
  const segments = applicable
    .map((risk, index) => ({ id: risk.id, value: parts[index] || 0 }))
    .filter((segment) => segment.value > 0);
  const total = current + management + segments.reduce((sum, segment) => sum + segment.value, 0);
  const shown = [current, management, ...segments.map((segment) => segment.value)];
  return {
    name: name || "Block",
    current,
    management,
    segments,
    total,
    line: `${name || "Block"}: ${shown.join(" + ")} = ${total}%`,
  };
}

/** Legend entries for risks that actually appear on at least one block. */
export function chartLegendIds(rows) {
  const seen = [];
  for (const row of rows || []) {
    for (const segment of row.segments || []) {
      if (segment.value > 0 && !seen.includes(segment.id)) seen.push(segment.id);
    }
  }
  return seen.sort(riskSort);
}

export function yieldChartExplanation(figureNumber, rows, benchmark) {
  if (!rows.length) return "";
  const currents = rows.map((row) => row.current);
  const potentials = rows.map((row) => row.current + row.management);
  const span = (values, dash) => {
    const min = Math.min(...values);
    const max = Math.max(...values);
    return min === max ? `${min}%` : `${min}${dash}${max}%`;
  };
  const benchmarkNumber = Number(benchmark);
  const benchmarkSentence = Number.isFinite(benchmarkNumber) && benchmarkNumber > 0
    ? ` Using ${benchmarkNumber.toFixed(1)} t/ha as the benchmark, the rounded current condition corresponds to about ${(benchmarkNumber * (currents.reduce((sum, value) => sum + value, 0) / currents.length) / 100).toFixed(1)} t/ha and the management potential to about ${(benchmarkNumber * (potentials.reduce((sum, value) => sum + value, 0) / potentials.length) / 100).toFixed(1)} t/ha.`
    : "";
  return `Figure ${figureNumber} highlights the staged improvement potential for each block, separating gains achievable through routine management from those dependent on major capital intervention. Current weighted condition ranges from ${span(currents, "% to ")}, with recommended management actions increasing the blocks to approximately ${span(potentials, "–")}. The remaining improvement to the 100% cap is allocated across the capital risks that apply to that block (canopy redevelopment under R1, irrigation upgrades under R2, and orchard-floor and root-zone rehabilitation under R3, where each is recorded). Each applicable risk is assigned a conditional percentage-point uplift, scaled from its allowance to the points still available and rounded so each bar sums to exactly 100%. When combined with the management potential, the resulting condition score can be converted to an indicative production potential in t/ha using the stated benchmark yield assumption.${benchmarkSentence} This represents a scenario estimate rather than a guaranteed yield outcome.`;
}
