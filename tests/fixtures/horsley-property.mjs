import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const narratives = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "horsley-narratives.json"), "utf8"));

const CHANGE = {
  cultivar: "Cultivar and cross pollination potential",
  canopy: "Phase canopy renewal and height reduction to improve light, spray access and productive wood.",
  crop: "Confirm yield history; improve retention through balanced canopy, irrigation and nutrition.",
  pest: "Use monitoring-led timing, verify coverage and rotate effective registered modes of action.",
  disease: "Confirm cause; improve protection timing, coverage, sanitation and contributing site conditions.",
  roots: "Stabilise moisture, retain organic cover and avoid surface erosion.",
  soil: "Maintain structure; address local compaction or restrictive layers only where confirmed.",
  drainage: "Correct concentrated flow, protect flow paths and verify performance after substantial rain.",
  irrigation: "Correct pressure, emitter-flow, flush lines.",
  floor: "Maintain cover, protect exposed soil and preserve a trafficable, harvestable surface.",
  water: "Maintaining soil moisture and scheduling.",
  nutrition: "Use representative soil and leaf tests; correct confirmed limitations without imbalance.",
};

function obs(id, code, share, siteType, position, gps, selection, ratings, notes) {
  return {
    id,
    code,
    share: String(share),
    siteType,
    position,
    gps,
    selection,
    ratings,
    notes,
    soil: { method: "Auger", depth: "", classification: "", surface: "", subsoil: "", rooting: "", drainage: "", constraints: "", interpretation: "" },
    finding: "",
    implication: "",
  };
}

const canopy = { canopy: 2, crop: 2, pest: 3, disease: 2 };
const ground = { roots: 3, soil: 4, drainage: 4, floor: 2, water: 2, nutrition: 3 };

export function createHorsleyProperty() {
  const block1 = {
    id: "b1",
    name: "Block 1",
    area: "5.47",
    cultivar: "268",
    age: "20 - 2006",
    gps: "Western block",
    coverage: "One site was selected to represent the average condition of 268 cultivars in the block.",
    current: { cultivar: 2, irrigation: 2 },
    // Irrigation potential is 4 so the workbook score rounds to the published 82% (52 + 30 on Figure 13). The hand grid had placed P in column 3.
    potential: { canopy: 3, cultivar: 3, floor: 4, soil: 5, drainage: 5, irrigation: 4, crop: 5, pest: 5, disease: 4, roots: 4, water: 3, nutrition: 5 },
    change: { ...CHANGE },
    observations: [
      obs("s1", "S1", 1, "Representative", "Top of block", "24°48'15.06\"S 152°16'33.52\"E", "The observation site represents the uniformity present within the 268 cultivar in block 1.",
        { ...canopy, ...ground },
        {
          canopy: "Active shoot growth is present. Tree form is somewhat irregular and asymmetric, with upright extension.",
          crop: "Crop load low to average. Moderate sticktight nuts.",
          pest: "Minor fruitspotting bug and low leafminer damage.",
          disease: "Residual Botrytis raceme blight on some racemes.",
          roots: "Feeder roots sparse to moderate, with new white root growth.",
          soil: "Sandy topsoil, compaction at 60 cm, effective root depth 120 cm.",
          drainage: "No prolonged waterlogging. Subsurface drainage is good.",
          floor: "Inter-row 70% grass. Under-tree bare with 40% leaf litter. High root exposure.",
          water: "Topsoil moisture good. Subsoil average. No canopy water stress.",
          nutrition: "Green foliage. Magnesium and phosphorus deficiency may be present.",
        }),
    ],
  };
  block1.observations[0].soil = { method: "Auger", depth: "120 cm", classification: "Red Dermosol", surface: "A horizon 0-60 cm, dark brown sandy loam, infield pH 6.5.", subsoil: "B1 60-80 cm brown sandy clay loam, infield pH 5.", rooting: "Current active root depth is 30 cm.", drainage: "Brown/red colours indicate a free-draining soil.", constraints: "Compaction", interpretation: "Sandy loam topsoil allows fast infiltration. Rooting is concentrated in the surface." };

  const block2 = {
    id: "b2",
    name: "Block 2",
    area: "7.93",
    cultivar: "A203",
    age: "20 - 2006",
    gps: "Central Block",
    coverage: "2 sites - 1 as a soil sample and the other as an inspection point.",
    current: { cultivar: 2, irrigation: 2 },
    potential: { canopy: 3, cultivar: 4, floor: 4, soil: 5, drainage: 5, irrigation: 3, crop: 5, pest: 5, disease: 4, roots: 4, water: 3, nutrition: 5 },
    change: { ...CHANGE },
    observations: [
      obs("s2", "S2", 0.8, "Representative", "Centre of block", "24°48'17.76\"S 152°16'39.95\"E", "A203 site selection - representative sample in A203.",
        { canopy: 2, crop: 2, pest: 3, disease: 2, roots: 3, soil: 4, drainage: 4, floor: 2, water: 2, nutrition: 4 },
        { canopy: "Branched, tall trees with uneven foliage and limited lower canopy.", floor: "Minimal inter-row cover. Under-tree 100% leaf litter.", nutrition: "Green foliage with minimal deficiency symptoms." }),
      obs("in1", "In1", 0.2, "Targeted", "Patchy spot", "24°48'19.87\"S 152°16'47.47\"E", "Infield decision is based on the change in cultivar and the condition of the trees.",
        { canopy: 2, crop: 2, pest: 3, disease: 2, roots: 2, soil: 3, drainage: 3, floor: 2, water: 2, nutrition: 3 },
        { canopy: "Tall, strongly upright multi-leader growth with internal congestion.", soil: "Sandy clay loam over clay. Rooting restricted to 40 cm.", drainage: "Mottles indicate a fluctuating water table." }),
    ],
  };
  block2.observations[0].soil.classification = "Red Dermosol";
  block2.observations[0].soil.depth = "120 cm";
  block2.observations[1].soil = { method: "Auger", depth: "60 cm", classification: "Mottled Red Dermosol", surface: "A horizon 0-40 cm sandy clay loam, infield pH 6.", subsoil: "Clay below 40 cm, infield pH 5.", rooting: "Rooting depth restricted to 40 cm.", drainage: "Mottles present.", constraints: "Heavy clay, mottling and stone fragments.", interpretation: "Subsoil clay restricts rooting and drainage." };

  const block3 = {
    id: "b3",
    name: "Block 3",
    area: "17.42",
    cultivar: "816/741/268",
    age: "20 - 2006",
    gps: "Eastern Block",
    coverage: "4 randomly assigned sites, spread to cover the cultivars present within the block.",
    current: { cultivar: 2, irrigation: 2 },
    // Canopy potential is 4 so the workbook score rounds to the published 81% (53 + 28 on Figure 13). The hand grid had placed P in column 3.
    potential: { canopy: 4, cultivar: 4, floor: 4, soil: 5, drainage: 5, irrigation: 3, crop: 3, pest: 4, disease: 3, roots: 4, water: 3, nutrition: 5 },
    change: { ...CHANGE },
    observations: [
      obs("s3", "S3", 0.25, "Representative", "Top of block", "24°48'09.05\"S 152°16'45.06\"E", "Representative sample of 741 covering the top portion of the block.",
        { canopy: 2, crop: 2, pest: 3, disease: 2, roots: 3, soil: 4, drainage: 4, floor: 2, water: 2, nutrition: 3 }, {}),
      obs("s4", "S4", 0.25, "Representative", "Bottom of block", "24°48'16.44\"S 152°16'45.78\"E", "Representative sample of 741 covering the bottom portion of the block.",
        { canopy: 2, crop: 2, pest: 3, disease: 2, roots: 3, soil: 4, drainage: 4, floor: 3, water: 2, nutrition: 3 }, {}),
      obs("s5", "S5", 0.25, "Representative", "Middle of block", "24°48'09.89\"S 152°16'53.12\"E", "Representative sample of 816 covering the top/middle portion of the block.",
        { canopy: 2, crop: 3, pest: 3, disease: 2, roots: 3, soil: 4, drainage: 4, floor: 2, water: 2, nutrition: 3 }, {}),
      obs("s6", "S6", 0.25, "Representative", "Bottom of block", "24°48'16.26\"S 152°16'53.42\"E", "Representative sample of 816 covering the bottom portion of the block.",
        { canopy: 2, crop: 3, pest: 3, disease: 2, roots: 3, soil: 4, drainage: 4, floor: 2, water: 2, nutrition: 3 }, {}),
    ],
  };
  for (const observation of block3.observations) {
    observation.soil.classification = "Red Dermosol";
    observation.soil.depth = observation.code === "S5" ? "90 cm" : "120 cm";
  }

  return {
    id: "horsley-136",
    archived: false,
    created: "2026-11-09T00:00:00.000Z",
    updated: "2026-11-09T00:00:00.000Z",
    cover: {
      propertyName: "136 Horsleys Road",
      year: "2026",
      preparedFor: "Prepared for pre-purchase agronomic due diligence",
      client: {
        person: "David Temple",
        role: "General Manager",
        organisation: "Wollemi Farms",
        website: "wollemifarms.com.au",
        phone: "+61 474 443 578",
        email: "david.temple@wollemi.com.au",
      },
      assessorContact: {
        person: "Jonathan McDonald",
        qualifications: "B Ag Sci (Plant and soil studies)",
        organisation: "Agronica Pty Ltd",
        address: "4468 Goodwood Road,\nQueensland 4670, Australia.",
        phone: "+61 408 206 601",
        email: "Jonathan@agronicaag.com",
      },
      location: "Meadowvale",
      commissionedBy: "Gunn Agri Partners",
      inspectionDate: "2026-11-03",
      reportDate: "2026-11-09",
      assessorName: "Gareth Glasspool",
    },
    executive: {
      condition: "Moderate concerns",
      conclusion: "Support proceeding",
      summary: narratives.decision,
    },
    profile: {
      cropStage: "Nut Set - BBCH 73",
      productionSystem: "Irrigated – drip irrigation system",
      totalArea: "35.75",
      bearingArea: "31.18",
      treeCount: "9790",
      establishedNarrative: "The orchard was established in 2006 and 2007 and can be divided into three distinct blocks based on the cultivars present. The cultivar composition of each block is detailed below.",
      soilNarrative: "A desktop review of soil and land-resource information available through Queensland Globe indicates that the property is mapped as predominantly comprising Kp (Kepnock), Gb (Gooburrum), and Ot (Otoo). The primary soil types are Dermosols, red or yellow. This is regional-scale mapping and should be treated as indicative.",
      soils: [
        { code: "Gb", description: "Deeply weathered coarse grained sedimentary rocks", landscape: "Plains and crests, upper and midslopes of rises", asc: "Red Dermosol", attributes: "0.05 to 0.35 m brown to black loamy sand to sandy clay loam", greatGroup: "Non-calcic brown soil / Red podzolic soil" },
        { code: "Ot", description: "Deeply weathered fine grained sedimentary rocks", landscape: "Plains and crests, upper and midslopes of rises", asc: "Red Dermosol", attributes: "0.25 to 0.45 m black to brown fine sandy clay loam", greatGroup: "Red podzolic soil" },
        { code: "Kp", description: "Deeply weathered fine grained sedimentary rocks", landscape: "Plains and crests, upper and midslopes of rises", asc: "Yellow Dermosol", attributes: "0.05 to 0.35 m grey to black loam fine sandy to clay loam", greatGroup: "Yellow podzolic soil" },
      ],
      cultivarIntro: "The property consists of four cultivars.",
      cultivars: [
        { name: "741", habit: "Large, upright to vertical tree", flowering: "Early, concentrated flowering", drop: "Early", kernel: "Kernel recovery 31-36%" },
        { name: "A203", habit: "Medium, slight upright tree", flowering: "Mid to late flowering", drop: "Mid-season", kernel: "Kernel recovery 33-38%" },
        { name: "816", habit: "Medium to large, moderately upright tree", flowering: "Late flowering", drop: "Early to mid-season", kernel: "Kernel recovery 44-47%" },
        { name: "268", habit: "Medium to large spreading tree", flowering: "Short, mid-season flowering", drop: "Mid to late season", kernel: "Kernel recovery 35-40%" },
      ],
      recentConditions: narratives["Recent conditions"],
      managementHistory: narratives["Management history"],
      inspectionMethod: narratives["Inspection method and coverage"],
      recordsReviewed: narratives["Records reviewed"],
      limitations: narratives["Inspection limitations"],
    },
    uplifts: { r1: 12, r2: 8, r3: 6 },
    blocks: [block1, block2, block3],
    comparisonNotes: "The current weighted condition is broadly consistent across the three blocks. The potential ratings assume the identified interventions are implemented and that enough time is allowed for recovery.",
    risks: [
      { id: "R1", location: "Widespread (Blocks 1-3)", finding: narratives.risks[0][2], likelihood: "Medium", consequence: "High", implication: narratives.risks[0][5], domains: ["canopy", "cultivar"], gridRating: 5, blockIds: null },
      { id: "R2", location: "Widespread (Blocks 1-3)", finding: narratives.risks[1][2], likelihood: "Medium", consequence: "Medium", implication: narratives.risks[1][5], domains: ["irrigation", "water"], gridRating: 4, blockIds: null },
      { id: "R3", location: "Widespread (Blocks 1-3)", finding: narratives.risks[2][2], likelihood: "Medium", consequence: "High", implication: narratives.risks[2][5], domains: ["floor", "roots"], gridRating: 5, blockIds: null },
    ],
    riskDiscussion: "R1 – Inefficient canopy structure: tall, upright and congested trees, with productive foliage concentrated around the canopy perimeter.\nR2 – Inadequate irrigation wetting pattern: the narrow wetted area of the drip system may restrict feeder-root distribution.\nR3 – Degraded orchard floor and root zone: widespread exposed roots and bare, locally compacted soil.",
    capitalNarrative: "Achieving the conditional improvement would require purchaser-funded works: irrigation redesign or replacement (R2), staged canopy redevelopment (R1), and orchard-floor and root-zone rehabilitation (R3). The conditional capital potential is not an expected outcome under the existing operating budget.",
    opinion: {
      benchmark: "4.0",
      text: "The orchard presents a moderate agronomic concern. Proceeding is supportable only where the purchase allows for the canopy, irrigation and root-zone works identified in the risk register.",
      limitations: "A single inspection records the conditions visible on 3 November 2026. It does not establish seasonal yield reliability.",
      reliance: "Prepared for Gunn Agri Partners. Reassess if irrigation, canopy or orchard-floor works change the condition observed at inspection.",
    },
    references: ["Bright, J., Alt, S. & Commens, R. (2016). Macadamia integrated orchard management practice guide 2016 (2nd ed.). NSW Department of Primary Industries."],
    appendix: {
      intro: "The assessment is based on six surface samples collected at 0-15 cm and one subsoil sample collected at 30-60 cm. All acidity results are reported as pH(H2O).",
      rows: [
        { indicator: "pH H2O", result: "Surface 4.92-6.28; median 5.86. Three of six below 6.0. Subsoil 4.59.", finding: "Surface acidity is spatially variable; the sampled subsoil is strongly acidic.", implication: "Use block-specific lime assessment and investigate the acidic subsoil around S3." },
        { indicator: "Organic carbon and CEC", result: "OC 0.72-1.22%; CEC 1.12-3.20 meq/100 g.", finding: "Low organic carbon and very low nutrient-holding capacity.", implication: "Build surface organic matter and use smaller, carefully timed nutrient applications." },
      ],
      conclusion: "The results represent a moderate chemical constraint with a potentially material localised subsoil risk.",
      actions: ["Extend subsoil sampling around S3 and across the remaining blocks.", "Test irrigation-water EC and sodium adsorption ratio.", "Confirm buffer pH and lime requirement before selecting amendments."],
      source: "Soil laboratory results reported 18 November 2026.",
    },
  };
}

/** Reference media files, in export order, so the yield chart is Figure 13. */
export const HORSLEY_PHOTOS = [
  ["image1.jpeg", "cover-photo", "", "", "", "Cover photograph"],
  ["image2.jpeg", "logo-client", "", "", "", "Wollemi Farms"],
  ["image3.jpeg", "logo-assessor", "", "", "", "Agronica"],
  ["image4.png", "signature", "", "", "", "Assessor signature"],
  ["image5.png", "farm-map", "", "", "", "Map of farm – 136 Horsleys Road"],
  ["image6.png", "soil-map", "", "", "", "Blocks and soil type"],
  ["image7.jpeg", "block-map", "b1", "", "", "Map highlighting S1 position in the block."],
  ["image8.jpeg", "profile", "b1", "s1", "A", "Profile picture of S1"],
  ["image9.jpeg", "block-map", "b2", "", "", "Map highlighting S2 and In1 position in Block 2"],
  ["image10.jpeg", "profile", "b2", "s2", "A", "Profile picture of S2"],
  ["image11.jpeg", "profile", "b2", "s2", "B1", "Profile picture of S2"],
  ["image12.jpeg", "profile", "b2", "in1", "A", "Profile picture of In1"],
  ["image13.jpeg", "profile", "b2", "in1", "B", "Profile picture of In1"],
  ["image14.jpeg", "block-map", "b3", "", "", "Map highlighting the four sampling points in Block 3"],
  ["image15.jpeg", "profile", "b3", "s3", "A", "Profile picture of S3"],
  ["image16.jpeg", "profile", "b3", "s4", "A", "Profile picture of S4"],
  ["image17.jpeg", "profile", "b3", "s5", "A", "Profile picture of S5"],
  ["image18.jpeg", "profile", "b3", "s6", "A", "Profile picture of S6"],
  ["image20.jpeg", "evidence", "", "", "", "Residual botrytis blight on racemes"],
  ["image23.jpeg", "evidence", "", "", "", "Strong AVG characteristics"],
  ["image24.jpeg", "evidence", "", "", "", "Evaluation of root exposure."],
  ["image25.jpeg", "evidence", "", "", "", "Evaluation of feeder-roots – white tips indicating root flushing"],
  ["image26.jpeg", "evidence", "", "", "", "Evaluation of canopy density and structure – unproductive lower canopy"],
];
