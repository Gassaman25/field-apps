import { CANOPY_IDS, CONCLUSION_OPTIONS, CONDITION_OPTIONS, GROUND_IDS, LIKELIHOOD_OPTIONS, SITE_TYPES } from "./model.js";
import {
  CAPITAL_ITEMS,
  formatPercent,
  formatPp,
  GRID_INTERPRETATION,
  GRID_LEGEND,
  improvementGrid,
  parameterById,
  PARAMETERS,
  scoreStoredBlock,
  weightPercentLabel,
} from "./scoring.js";

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function field(label, path, value, type = "text", placeholder = "") {
  if (type === "textarea") {
    return `<label class="field"><span>${label}</span><textarea data-path="${path}" placeholder="${esc(placeholder)}">${esc(value)}</textarea></label>`;
  }
  return `<label class="field"><span>${label}</span><input data-path="${path}" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}"></label>`;
}

function select(label, path, value, options) {
  return `<label class="field"><span>${label}</span><select data-path="${path}">${options.map((option) => `<option value="${esc(option)}" ${String(value) === String(option) ? "selected" : ""}>${esc(option || "Select…")}</option>`).join("")}</select></label>`;
}

function scoreButtons(path, value, label) {
  const current = String(value ?? "");
  return `<div class="score-line"><span>${esc(label)}</span><div class="scores">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="score s${n} ${current === String(n) ? "on" : ""}" data-action="score" data-path="${path}" data-value="${n}" aria-label="${esc(label)} ${n}">${n}</button>`).join("")}<button type="button" class="score clear" data-action="score" data-path="${path}" data-value="" aria-label="Clear ${esc(label)}">×</button></div></div>`;
}

function photoCards(photos, urlFor) {
  if (!photos.length) return `<p class="empty">None attached.</p>`;
  return `<div class="photo-grid">${photos.map((photo) => `<figure class="photo"><img src="${urlFor(photo.thumb || photo.blob)}" alt="${esc(photo.caption || photo.name || "Photo")}"><figcaption><input data-photo-caption="${photo.id}" value="${esc(photo.caption || "")}" placeholder="Caption">${photo.label ? `<b>${esc(photo.label)}</b>` : ""}<small>${photo.originalWidth || "?"}×${photo.originalHeight || "?"} · ${Math.round((photo.originalBytes || 0) / 1024)} KB → ${photo.width || "?"}×${photo.height || "?"} · ${Math.round((photo.bytes || photo.blob?.size || 0) / 1024)} KB</small></figcaption><button type="button" data-action="delete-photo" data-id="${photo.id}" aria-label="Remove photo">Remove</button></figure>`).join("")}</div>`;
}

export function homeHtml(properties, showArchived) {
  const rows = properties.filter((property) => showArchived || !property.archived);
  return `<section class="panel">
    <div class="section-head"><div><h2>Properties</h2><p>Each orchard is saved on this device, including its photographs.</p></div>
      <button class="primary" data-action="new-property" data-testid="new-property">New property</button></div>
    <label class="check"><input type="checkbox" data-action="toggle-archived" ${showArchived ? "checked" : ""}> Show archived</label>
    <div class="cards">${rows.length ? rows.map((property) => `<article class="card property-card">
        <h3>${esc(property.cover?.propertyName || "Untitled property")}</h3>
        <p>${esc(property.cover?.location || "Location not set")} · ${esc(property.cover?.inspectionDate || "No inspection date")}</p>
        <div class="row">
          <button class="primary" data-action="open-property" data-id="${property.id}">Open</button>
          <button data-action="duplicate-property" data-id="${property.id}">Duplicate</button>
          <button data-action="archive-property" data-id="${property.id}">${property.archived ? "Unarchive" : "Archive"}</button>
        </div>
      </article>`).join("") : `<p class="empty">No properties yet.</p>`}</div>
    <div class="card"><h3>Backup</h3><p>One file stores every property and every photograph.</p>
      <div class="row"><button class="primary" data-action="backup" data-testid="backup">Download backup</button>
      <label class="file">Restore backup<input data-testid="restore-input" data-action="restore" type="file" accept="application/json"></label></div></div>
  </section>`;
}

const SECTIONS = [
  ["cover", "Cover"],
  ["executive", "Executive"],
  ["orchard", "Orchard"],
  ["blocks", "Blocks"],
  ["condition", "Condition"],
  ["risks", "Risks"],
  ["evidence", "Photos"],
  ["opinion", "Opinion"],
];

function nav(active) {
  return `<nav class="sections">${SECTIONS.map(([id, label]) => `<button type="button" data-section="${id}" class="${id === active ? "on" : ""}">${label}</button>`).join("")}</nav>`;
}

function blockTabs(property, activeId) {
  return `<div class="tabs">${property.blocks.map((block) => `<button type="button" data-action="select-block" data-id="${block.id}" class="${block.id === activeId ? "on" : ""}">${esc(block.name || "Block")}</button>`).join("")}</div>`;
}

function repeatHeader(title, action) {
  return `<div class="row spread"><h3>${title}</h3><button type="button" data-action="${action}">Add</button></div>`;
}

export function editorHtml(state, urlFor) {
  const property = state.property;
  const section = state.section;
  return `${nav(section)}<section class="panel">${sectionBody(state, urlFor, property, section)}</section>
    <div class="bottom"><button type="button" data-action="backup">Backup</button><button type="button" class="primary" data-action="export-docx" data-testid="export-docx">Export Word</button></div>`;
}

function sectionBody(state, urlFor, property, section) {
  if (section === "cover") return coverSection(property, state.photos, urlFor);
  if (section === "executive") return executiveSection(property);
  if (section === "orchard") return orchardSection(property, state.photos, urlFor);
  if (section === "blocks") return blocksSection(state, urlFor);
  if (section === "condition") return conditionSection(state);
  if (section === "risks") return risksSection(property);
  if (section === "evidence") return evidenceSection(state.photos, urlFor);
  return opinionSection(property);
}

function coverSection(property, photos, urlFor) {
  const c = property.cover;
  const logo = (category, label) => {
    const photo = photos.find((item) => item.category === category);
    return `<div class="logo-slot"><span>${label}</span>${photo ? `<img src="${urlFor(photo.blob)}" alt="${esc(label)}">` : `<p class="empty">Default missing</p>`}${photoInput(category, { label: "Replace", action: "replace-logo", multiple: false })}</div>`;
  };
  return `<div class="section-head"><div><h2>Cover</h2><p>Client and assessor blocks, and the three cover logos. Replacing a logo keeps it with this property and in the backup.</p></div>
    <button type="button" data-action="close-property">All properties</button></div>
    <div class="card grid two">
      ${field("Property name", "cover.propertyName", c.propertyName, "text", "136 Horsleys Road")}
      ${field("Report year", "cover.year", c.year)}
      ${field("Location", "cover.location", c.location, "text", "Locality")}
      ${field("Commissioned by", "cover.commissionedBy", c.commissionedBy)}
      ${field("Inspection date", "cover.inspectionDate", c.inspectionDate, "date")}
      ${field("Report date", "cover.reportDate", c.reportDate, "date")}
      ${field("Assessor name on the cover table", "cover.assessorName", c.assessorName)}
      ${field("Prepared-for line", "cover.preparedFor", c.preparedFor, "text")}
    </div>
    <div class="grid two">
      <div class="card"><h3>Client contact</h3>
        ${field("Person", "cover.client.person", c.client.person)}
        ${field("Role", "cover.client.role", c.client.role)}
        ${field("Organisation", "cover.client.organisation", c.client.organisation)}
        ${field("Website", "cover.client.website", c.client.website)}
        ${field("Phone", "cover.client.phone", c.client.phone)}
        ${field("Email", "cover.client.email", c.client.email, "email")}
      </div>
      <div class="card"><h3>Assessor contact</h3>
        ${field("Person", "cover.assessorContact.person", c.assessorContact.person)}
        ${field("Qualifications", "cover.assessorContact.qualifications", c.assessorContact.qualifications)}
        ${field("Organisation", "cover.assessorContact.organisation", c.assessorContact.organisation)}
        ${field("Address", "cover.assessorContact.address", c.assessorContact.address, "textarea")}
        ${field("Phone", "cover.assessorContact.phone", c.assessorContact.phone)}
        ${field("Email", "cover.assessorContact.email", c.assessorContact.email, "email")}
      </div>
    </div>
    <div class="card"><h3>Cover photo</h3><p class="note">The reference cover carries a property photograph under the title.</p>${photoInput("cover-photo", { multiple: false })}
      ${photoCards(photos.filter((photo) => photo.category === "cover-photo"), urlFor)}</div>
    <div class="card"><h3>Logos and signature</h3><p class="note">Client logo on the left, assessor logo on the right, and the assessor’s signature under that contact block.</p><div class="logo-row">${logo("logo-client", "Client logo")}${logo("logo-assessor", "Assessor logo")}${logo("signature", "Assessor signature")}</div></div>`;
}

function executiveSection(property) {
  const e = property.executive;
  return `<div class="section-head"><div><h2>Executive acquisition assessment</h2><p>Condition and conclusion stay separate from the financial and legal work.</p></div></div>
    <div class="card grid two">
      ${select("Overall orchard condition", "executive.condition", e.condition, CONDITION_OPTIONS)}
      ${select("Agronomic conclusion", "executive.conclusion", e.conclusion, CONCLUSION_OPTIONS)}
    </div>
    <div class="card">${field("Decision summary", "executive.summary", e.summary, "textarea", "Principal constraints, area affected, and why the conclusion follows")}</div>`;
}

function orchardSection(property, photos, urlFor) {
  const p = property.profile;
  const soils = p.soils || [];
  const cultivars = p.cultivars || [];
  return `<div class="section-head"><div><h2>Property, orchard profile and inspection scope</h2></div></div>
    <div class="card grid three">
      ${field("Crop stage", "profile.cropStage", p.cropStage, "text", "Nut set")}
      ${field("Production system", "profile.productionSystem", p.productionSystem, "text", "Irrigated – drip")}
      ${field("Total area ha", "profile.totalArea", p.totalArea, "number")}
      ${field("Bearing area ha", "profile.bearingArea", p.bearingArea, "number")}
      ${field("Tree count", "profile.treeCount", p.treeCount, "number")}
    </div>
    <div class="card">${field("Property details", "profile.establishedNarrative", p.establishedNarrative, "textarea", "Establishment years and how the blocks divide")}</div>
    <div class="card">${field("Soil and landscape", "profile.soilNarrative", p.soilNarrative, "textarea")}
      <h3>Farm map</h3>${photoInput("farm-map")}
      ${photoCards(photos.filter((photo) => photo.category === "farm-map"), urlFor)}
      <h3>Soil map</h3>${photoInput("soil-map")}
      ${photoCards(photos.filter((photo) => photo.category === "soil-map"), urlFor)}
    </div>
    <div class="card">${repeatHeader("Soil types", "add-soil")}
      ${soils.map((soil, i) => `<div class="repeat grid two">
        ${field("Code", `profile.soils.${i}.code`, soil.code)}
        ${field("Description", `profile.soils.${i}.description`, soil.description, "textarea")}
        ${field("Landscape", `profile.soils.${i}.landscape`, soil.landscape, "textarea")}
        ${field("ASC", `profile.soils.${i}.asc`, soil.asc)}
        ${field("Major attributes", `profile.soils.${i}.attributes`, soil.attributes, "textarea")}
        ${field("Great Soil Group", `profile.soils.${i}.greatGroup`, soil.greatGroup)}
        <button type="button" data-action="remove-at" data-path="profile.soils" data-index="${i}">Remove soil</button>
      </div>`).join("") || `<p class="empty">No soil types yet.</p>`}
    </div>
    <div class="card">${field("Cultivar introduction", "profile.cultivarIntro", p.cultivarIntro, "textarea")}
      ${repeatHeader("Cultivars", "add-cultivar")}
      ${cultivars.map((row, i) => `<div class="repeat grid two">
        ${field("Cultivar", `profile.cultivars.${i}.name`, row.name)}
        ${field("Tree habit", `profile.cultivars.${i}.habit`, row.habit, "textarea")}
        ${field("Flowering period", `profile.cultivars.${i}.flowering`, row.flowering, "textarea")}
        ${field("Drop pattern", `profile.cultivars.${i}.drop`, row.drop)}
        ${field("Nut / kernel characteristics", `profile.cultivars.${i}.kernel`, row.kernel, "textarea")}
        <button type="button" data-action="remove-at" data-path="profile.cultivars" data-index="${i}">Remove cultivar</button>
      </div>`).join("")}
    </div>
    <div class="card grid two">
      ${field("Recent conditions", "profile.recentConditions", p.recentConditions, "textarea")}
      ${field("Management history", "profile.managementHistory", p.managementHistory, "textarea")}
      ${field("Inspection method and coverage", "profile.inspectionMethod", p.inspectionMethod, "textarea")}
      ${field("Records reviewed", "profile.recordsReviewed", p.recordsReviewed, "textarea")}
      ${field("Inspection limitations", "profile.limitations", p.limitations, "textarea")}
    </div>`;
}

function photoInput(category, { label = "Add photo", action = "add-photo", testId = "", multiple = true, blockId = "", observationId = "", shot = "" } = {}) {
  const attrs = [
    `data-category="${category}"`,
    blockId ? `data-block-id="${blockId}"` : "",
    observationId ? `data-observation-id="${observationId}"` : "",
    shot ? `data-label="${shot}"` : "",
  ].filter(Boolean).join(" ");
  const id = testId ? ` data-testid="${testId}"` : "";
  const many = multiple ? " multiple" : "";
  return `<label class="file drop" data-drop ${attrs} title="Choose a photo, or drop it here">${label}<input type="file" accept="image/*,.heic,.heif"${many}${id} data-action="${action}" ${attrs}></label>`;
}

function blocksSection(state, urlFor) {
  const property = state.property;
  const block = property.blocks.find((item) => item.id === state.blockId) || property.blocks[0];
  const bi = property.blocks.indexOf(block);
  const observation = block.observations.find((item) => item.id === state.observationId) || block.observations[0];
  const oi = block.observations.indexOf(observation);
  const rateGroup = (title, ids) => `<div class="card"><h3>${title}</h3>${ids.map((id) => {
    const param = parameterById(id);
    return `${scoreButtons(`blocks.${bi}.observations.${oi}.ratings.${id}`, observation.ratings?.[id], param.name)}
      <label class="field"><span>Evidence</span><textarea data-path="blocks.${bi}.observations.${oi}.notes.${id}">${esc(observation.notes?.[id] || "")}</textarea></label>`;
  }).join("")}</div>`;
  const profilePhotos = state.photos.filter((photo) => photo.category === "profile" && photo.observationId === observation.id);
  const maps = state.photos.filter((photo) => photo.category === "block-map" && photo.blockId === block.id);
  return `<div class="section-head"><div><h2>Block assessments</h2><p>Record the block once, then each observation site. Site ratings feed the weighted score and the C marks.</p></div>
    <button class="primary" type="button" data-action="add-block" data-testid="add-block">Add block</button></div>
    ${blockTabs(property, block.id)}
    <div class="card"><div class="row spread"><h3>${esc(block.name || "Block")}</h3>${property.blocks.length > 1 ? `<button type="button" data-action="delete-block" data-id="${block.id}">Delete block</button>` : ""}</div>
      <div class="grid three">
        ${field("Block name", `blocks.${bi}.name`, block.name)}
        ${field("Area ha", `blocks.${bi}.area`, block.area, "number")}
        ${field("Cultivar", `blocks.${bi}.cultivar`, block.cultivar)}
        ${field("Tree age / year planted", `blocks.${bi}.age`, block.age)}
        ${field("Map / GPS reference", `blocks.${bi}.gps`, block.gps)}
      </div>
      ${field("Inspection coverage and route", `blocks.${bi}.coverage`, block.coverage, "textarea")}
      <h3>Block-level ratings</h3>
      <p class="note">Cultivar and irrigation infrastructure are rated once for the block. They are not averaged from sites.</p>
      ${scoreButtons(`blocks.${bi}.current.cultivar`, block.current?.cultivar, "Cultivar")}
      ${scoreButtons(`blocks.${bi}.current.irrigation`, block.current?.irrigation, "Irrigation infrastructure")}
      <h3>Block map</h3>${photoInput("block-map", { blockId: block.id })}
      ${photoCards(maps, urlFor)}
    </div>
    <div class="section-head"><div><h2>Sites in ${esc(block.name || "this block")}</h2></div>
      <button class="primary" type="button" data-action="add-observation" data-testid="add-observation">Add site</button></div>
    <div class="tabs">${block.observations.map((item) => `<button type="button" data-action="select-observation" data-id="${item.id}" class="${item.id === observation.id ? "on" : ""}">${esc(item.code || "Site")}</button>`).join("")}</div>
    <div class="card"><div class="row spread"><h3>Observation ${esc(observation.code || "")}</h3>${block.observations.length > 1 ? `<button type="button" data-action="delete-observation" data-id="${observation.id}">Delete site</button>` : ""}</div>
      <div class="grid three">
        ${field("Observation ID", `blocks.${bi}.observations.${oi}.code`, observation.code, "text", "S1")}
        ${select("Site type", `blocks.${bi}.observations.${oi}.siteType`, observation.siteType, SITE_TYPES)}
        ${field("Block share", `blocks.${bi}.observations.${oi}.share`, observation.share, "text", "0.5 or 50%")}
        ${field("Landscape position", `blocks.${bi}.observations.${oi}.position`, observation.position)}
        ${field("GPS reference", `blocks.${bi}.observations.${oi}.gps`, observation.gps)}
      </div>
      ${field("Selection reason", `blocks.${bi}.observations.${oi}.selection`, observation.selection, "textarea")}
      <p class="note">Block share is a weight. 0.5 and 50% are the same ratio. Blank ratings are left out and the remaining shares are renormalised.</p>
    </div>
    ${rateGroup("Canopy and crop condition", CANOPY_IDS)}
    ${rateGroup("Soil, roots and water", GROUND_IDS)}
    <div class="card"><h3>Soil profile</h3><div class="grid three">
      ${field("Method / reference", `blocks.${bi}.observations.${oi}.soil.method`, observation.soil.method, "text", "Auger")}
      ${field("Depth", `blocks.${bi}.observations.${oi}.soil.depth`, observation.soil.depth, "text", "120 cm")}
      ${field("Classification", `blocks.${bi}.observations.${oi}.soil.classification`, observation.soil.classification)}
    </div>
      ${field("Surface horizon", `blocks.${bi}.observations.${oi}.soil.surface`, observation.soil.surface, "textarea")}
      ${field("Subsoil horizon", `blocks.${bi}.observations.${oi}.soil.subsoil`, observation.soil.subsoil, "textarea")}
      ${field("Effective rooting depth", `blocks.${bi}.observations.${oi}.soil.rooting`, observation.soil.rooting, "textarea")}
      ${field("Drainage and wetness", `blocks.${bi}.observations.${oi}.soil.drainage`, observation.soil.drainage, "textarea")}
      ${field("Restrictive layers", `blocks.${bi}.observations.${oi}.soil.constraints`, observation.soil.constraints, "textarea")}
      ${field("Profile interpretation", `blocks.${bi}.observations.${oi}.soil.interpretation`, observation.soil.interpretation, "textarea")}
      <h3>Profile photographs</h3>
      <div class="row">${["A", "B1", "B2"].map((label) => photoInput("profile", { label, blockId: block.id, observationId: observation.id, shot: label, multiple: false })).join("")}</div>
      ${photoCards(profilePhotos, urlFor)}
    </div>
    <div class="card">
      ${field("Observation finding", `blocks.${bi}.observations.${oi}.finding`, observation.finding, "textarea")}
      ${field("Implications", `blocks.${bi}.observations.${oi}.implication`, observation.implication, "textarea")}
    </div>`;
}

function conditionSection(state) {
  const property = state.property;
  const block = property.blocks.find((item) => item.id === state.blockId) || property.blocks[0];
  const bi = property.blocks.indexOf(block);
  const score = scoreStoredBlock(block, property.uplifts);
  const grid = improvementGrid(block, property.risks);
  return `<div class="section-head"><div><h2>Weighted condition</h2><p>The numbers follow the block sheets. The 4.1 grid is built from these ratings and from the risk register.</p></div></div>
    <div class="card"><h3>Conditional capital uplifts (percentage points)</h3>
      <p class="note">Final conditional potential = management potential + R1 + R2 + R3, capped at 100%.</p>
      <div class="grid three">
        ${CAPITAL_ITEMS.map((item) => field(`${item.risk} ${item.name}`, `uplifts.${item.id}`, property.uplifts?.[item.id], "number")).join("")}
      </div>
    </div>
    ${blockTabs(property, block.id)}
    <div id="live">${liveTable(block, score)}</div>
    <div class="card"><h3>Management potential and the change needed</h3>
      <p class="note">P is the management potential you enter here. C is placed from the site ratings (a range when sites differ). R marks come from risks linked to the domain.</p>
      ${PARAMETERS.map((param) => `<div class="param">
        ${scoreButtons(`blocks.${bi}.potential.${param.id}`, block.potential?.[param.id], `${param.name} potential`)}
        <label class="field"><span>Change needed for proposed rating</span><textarea data-path="blocks.${bi}.change.${param.id}">${esc(block.change?.[param.id] || "")}</textarea></label>
      </div>`).join("")}
    </div>
    <div class="card"><h3>4.1 ${esc(block.name || "Block")} improvement profile</h3>
      <p>${esc(GRID_LEGEND)}</p>
      ${gridHtml(grid)}
      <p class="note">${esc(GRID_INTERPRETATION)}</p>
    </div>
    <div class="card"><h3>Yield potential chart</h3>
      <p class="note">Each bar totals 100%. Only the risks ticked for that block are drawn, and they share the points left after management improvement in proportion to their allowances.</p>
      <canvas id="yield-chart"></canvas>
    </div>`;
}

function liveTable(block, score) {
  return `<div class="metrics">
      <div><b>${formatPercent(score.current)}</b><span>Current</span></div>
      <div><b>${formatPercent(score.potential)}</b><span>Management potential</span></div>
      <div><b>${formatPp(score.managementUpliftPp)}</b><span>Uplift (pp)</span></div>
      <div><b>${formatPercent(score.finalConditional)}</b><span>Conditional capital</span></div>
    </div>
    <div class="card"><h3>${esc(block.name || "Block")} calculation</h3>
      <table class="calc"><thead><tr><th>Parameter</th><th>Weight</th><th>Current</th><th>Potential</th><th>Current contribution</th><th>Potential contribution</th></tr></thead>
      <tbody>${score.parameters.map((param) => `<tr><td>${esc(param.name)}</td><td>${weightPercentLabel(param.weight)}</td><td>${param.currentRating == null ? "—" : Number(param.currentRating).toFixed(2)}</td><td>${param.potentialRating == null ? "—" : param.potentialRating}</td><td>${param.currentContribution == null ? "—" : param.currentContribution.toFixed(4)}</td><td>${param.potentialContribution.toFixed(4)}</td></tr>`).join("")}
      <tr><td>Total</td><td>${weightPercentLabel(score.weightSum)}</td><td></td><td></td><td>${score.current.toFixed(4)}</td><td>${score.potential.toFixed(4)}</td></tr></tbody></table>
    </div>`;
}

function gridHtml(grid) {
  const fills = ["", "c1", "c2", "c3", "c4", "c5"];
  return `<div class="grid-wrap"><table class="cpr"><thead><tr><th>Assessment domain</th>${[1, 2, 3, 4, 5].map((n) => `<th class="${fills[n]}">${n}</th>`).join("")}<th>Change needed for proposed rating</th></tr></thead><tbody>
    ${grid.map((row) => `<tr><td>${esc(row.name)}</td>${[1, 2, 3, 4, 5].map((n) => `<td class="${fills[n]}">${esc(row.cells[n] || "")}</td>`).join("")}<td>${esc(row.change)}</td></tr>`).join("")}
  </tbody></table></div>`;
}

function risksSection(property) {
  return `<div class="section-head"><div><h2>Material agronomic risk</h2><p>Tick the domains a risk applies to, and the blocks that carry it. The 4.1 grid marks the risk on those domains. The yield chart splits the points left to 100% across only the risks ticked for that block.</p></div>
    <button type="button" data-action="add-risk">Add risk</button></div>
    ${(property.risks || []).map((risk, i) => `<div class="card">
      <div class="grid three">
        ${field("Risk", `risks.${i}.id`, risk.id, "text", "R1")}
        ${field("Location", `risks.${i}.location`, risk.location)}
        ${select("Likelihood", `risks.${i}.likelihood`, risk.likelihood, LIKELIHOOD_OPTIONS)}
        ${select("Consequence", `risks.${i}.consequence`, risk.consequence, LIKELIHOOD_OPTIONS)}
        <div class="field"><span>R mark column</span><div class="scores">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="score s${n} ${String(risk.gridRating) === String(n) ? "on" : ""}" data-action="score" data-path="risks.${i}.gridRating" data-value="${n}">${n}</button>`).join("")}</div></div>
      </div>
      ${field("Finding and evidence", `risks.${i}.finding`, risk.finding, "textarea")}
      ${field("Purchase implication / condition", `risks.${i}.implication`, risk.implication, "textarea")}
      <div class="domains"><span>Applies to domains</span>${PARAMETERS.map((param) => `<label class="check"><input type="checkbox" data-action="toggle-domain" data-index="${i}" data-domain="${param.id}" ${(risk.domains || []).includes(param.id) ? "checked" : ""}>${esc(param.name)}</label>`).join("")}</div>
      <div class="domains"><span>Blocks on the yield chart</span>${(property.blocks || []).map((block) => `<label class="check"><input type="checkbox" data-action="toggle-risk-block" data-index="${i}" data-block-id="${block.id}" ${risk.blockIds == null || (risk.blockIds || []).includes(block.id) ? "checked" : ""}>${esc(block.name || "Block")}</label>`).join("")}</div>
      <button type="button" data-action="remove-at" data-path="risks" data-index="${i}">Remove risk</button>
    </div>`).join("")}
    <div class="card">${field("Risk discussion", "riskDiscussion", property.riskDiscussion, "textarea")}
      ${field("Capital scenario notes", "capitalNarrative", property.capitalNarrative, "textarea")}</div>`;
}

function evidenceSection(photos, urlFor) {
  const rows = photos.filter((photo) => photo.category === "evidence");
  return `<div class="section-head"><div><h2>Field photographic evidence</h2><p>Photos are compressed on this device before they are stored or exported.</p></div>
    ${photoInput("evidence", { testId: "photo-input" })}<p class="note">On a computer, use the file picker or drop photos here. They are compressed on this device before they are stored.</p></div>
    ${photoCards(rows, urlFor)}`;
}

function opinionSection(property) {
  const o = property.opinion;
  const rows = property.appendix.rows || [];
  return `<div class="section-head"><div><h2>Final opinion, references and Appendix A</h2></div></div>
    <div class="card">
      ${field("Benchmark yield t/ha", "opinion.benchmark", o.benchmark, "number")}
      ${field("Agronomic opinion", "opinion.text", o.text, "textarea")}
      ${field("Scope and limitations", "opinion.limitations", o.limitations, "textarea")}
      ${field("Reliance and changed circumstances", "opinion.reliance", o.reliance, "textarea")}
      ${field("Comparison notes for section 4", "comparisonNotes", property.comparisonNotes, "textarea")}
    </div>
    <div class="card">${repeatHeader("References", "add-reference")}
      ${(property.references || []).map((item, i) => `<div class="repeat">${field(`Reference ${i + 1}`, `references.${i}`, item, "textarea")}<button type="button" data-action="remove-at" data-path="references" data-index="${i}">Remove</button></div>`).join("")}
    </div>
    <div class="card"><h3>Appendix A Soil chemistry</h3>
      ${field("Introduction", "appendix.intro", property.appendix.intro, "textarea")}
      ${repeatHeader("Chemistry rows", "add-chemistry")}
      ${rows.map((row, i) => `<div class="repeat grid two">
        ${field("Indicator", `appendix.rows.${i}.indicator`, row.indicator)}
        ${field("Result", `appendix.rows.${i}.result`, row.result, "textarea")}
        ${field("Finding", `appendix.rows.${i}.finding`, row.finding, "textarea")}
        ${field("Due diligence implication", `appendix.rows.${i}.implication`, row.implication, "textarea")}
        <button type="button" data-action="remove-at" data-path="appendix.rows" data-index="${i}">Remove row</button>
      </div>`).join("")}
      ${field("Conclusion", "appendix.conclusion", property.appendix.conclusion, "textarea")}
      ${repeatHeader("Purchaser actions", "add-action")}
      ${(property.appendix.actions || []).map((item, i) => `<div class="repeat">${field(`Action ${i + 1}`, `appendix.actions.${i}`, item, "text")}<button type="button" data-action="remove-at" data-path="appendix.actions" data-index="${i}">Remove</button></div>`).join("")}
      ${field("Source", "appendix.source", property.appendix.source, "text", "Laboratory results and date")}
    </div>`;
}
