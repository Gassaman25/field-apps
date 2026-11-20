import { IOM_CITATION, PARAMETERS, SITE_PARAMETER_IDS } from "./scoring.js";

export function uid() {
  return crypto.randomUUID();
}

function blankMap(keys) {
  return Object.fromEntries(keys.map((key) => [key, ""]));
}

export function blankObservation(index = 1) {
  return {
    id: uid(),
    code: `S${index}`,
    siteType: "Representative",
    position: "",
    gps: "",
    share: "",
    selection: "",
    ratings: blankMap(SITE_PARAMETER_IDS),
    notes: blankMap(SITE_PARAMETER_IDS),
    soil: {
      method: "",
      depth: "",
      classification: "",
      surface: "",
      subsoil: "",
      rooting: "",
      drainage: "",
      constraints: "",
      interpretation: "",
    },
    finding: "",
    implication: "",
  };
}

export function blankBlock(index = 1) {
  const block = {
    id: uid(),
    name: `Block ${index}`,
    area: "",
    cultivar: "",
    age: "",
    gps: "",
    coverage: "",
    current: { cultivar: "", irrigation: "" },
    potential: blankMap(PARAMETERS.map((p) => p.id)),
    change: blankMap(PARAMETERS.map((p) => p.id)),
    observations: [],
  };
  block.observations.push(blankObservation(1));
  return block;
}

export function blankRisk(index = 1) {
  const presets = {
    1: { id: "R1", domains: ["canopy", "cultivar"], gridRating: 5, likelihood: "Medium", consequence: "High" },
    2: { id: "R2", domains: ["irrigation", "water"], gridRating: 4, likelihood: "Medium", consequence: "Medium" },
    3: { id: "R3", domains: ["floor", "roots"], gridRating: 5, likelihood: "Medium", consequence: "High" },
  };
  const preset = presets[index] || { id: `R${index}`, domains: [], gridRating: 5, likelihood: "Medium", consequence: "Medium" };
  return {
    id: preset.id,
    location: "",
    finding: "",
    likelihood: preset.likelihood,
    consequence: preset.consequence,
    implication: "",
    domains: [...preset.domains],
    gridRating: preset.gridRating,
    blockIds: null,
  };
}

export function blankProperty() {
  const year = String(new Date().getFullYear());
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: uid(),
    archived: false,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    cover: {
      propertyName: "",
      year,
      preparedFor: "Prepared for pre-purchase agronomic due diligence",
      client: { person: "", role: "", organisation: "", website: "", phone: "", email: "" },
      assessorContact: {
        person: "",
        qualifications: "",
        organisation: "",
        address: "",
        phone: "",
        email: "",
      },
      location: "",
      commissionedBy: "",
      inspectionDate: today,
      reportDate: today,
      assessorName: "",
    },
    executive: { condition: "", conclusion: "", summary: "" },
    profile: {
      cropStage: "",
      productionSystem: "",
      totalArea: "",
      bearingArea: "",
      treeCount: "",
      establishedNarrative: "",
      soilNarrative: "",
      soils: [],
      cultivarIntro: "",
      cultivars: [],
      recentConditions: "",
      managementHistory: "",
      inspectionMethod: "",
      recordsReviewed: "",
      limitations: "",
    },
    uplifts: { r1: 12, r2: 8, r3: 6 },
    blocks: [blankBlock(1)],
    comparisonNotes: "",
    risks: [blankRisk(1), blankRisk(2), blankRisk(3)],
    riskDiscussion: "",
    capitalNarrative: "",
    opinion: { benchmark: "4.0", text: "", limitations: "", reliance: "" },
    references: [IOM_CITATION],
    appendix: {
      intro: "Record the surface and subsoil chemistry used in the acquisition assessment. State the acidity method, for example pH(H2O).",
      rows: [{ indicator: "", result: "", finding: "", implication: "" }],
      conclusion: "",
      actions: [""],
      source: "",
    },
  };
}

export const CONDITION_OPTIONS = ["", "Good", "Minor concerns", "Moderate concerns", "Poor", "Critical", "Insufficient evidence"];
export const CONCLUSION_OPTIONS = ["", "Support proceeding", "Proceed with conditions", "Defer pending evidence", "Do not support proceeding"];
export const LIKELIHOOD_OPTIONS = ["Low", "Medium", "High"];
export const SITE_TYPES = ["Representative", "Targeted"];

export const CANOPY_IDS = ["canopy", "crop", "pest", "disease"];
export const GROUND_IDS = ["roots", "soil", "drainage", "floor", "water", "nutrition"];

