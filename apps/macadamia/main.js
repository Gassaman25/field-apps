import { createBackup, restoreBackup } from "../../core/backup.js";
import { deletePhoto, getProperty, listPhotos, listProperties, putPhoto, saveProperty } from "../../core/db.js";
import { compressPhoto, imageSize } from "../../core/photos.js";
import { formatBytes, storageStatus } from "../../core/quota.js";
import { applyUpdate, watchUpdates } from "../../core/updates.js";
import { paintYieldChart } from "./chart.js";
import { buildDocx } from "./export-docx.js";
import { blankBlock, blankObservation, blankProperty, blankRisk, uid } from "./model.js";
import { editorHtml, esc, homeHtml } from "./render.js";
import { blockIsAssessed, chartRisksForBlock, formatPercent, formatPp, scoreStoredBlock, weightPercentLabel, yieldChartRow } from "./scoring.js";

const ACTIVE_KEY = "field-apps-active";
const state = {
  properties: [],
  property: null,
  photos: [],
  section: "cover",
  blockId: null,
  observationId: null,
  showArchived: false,
  urls: [],
  updateRegistration: null,
};

const app = document.querySelector("#app");
let photosSaving = 0;
const photoSaveWaiters = new Set();

function finishPhotoSave(count = 1) {
  photosSaving = Math.max(0, photosSaving - count);
  if (photosSaving === 0) {
    for (const resolve of [...photoSaveWaiters]) resolve();
    photoSaveWaiters.clear();
  }
}

function whenPhotosSaved() {
  if (photosSaving === 0) return Promise.resolve();
  return new Promise((resolve) => photoSaveWaiters.add(resolve));
}
const storageEl = document.querySelector("#storage");
const toastEl = document.querySelector("#toast");
let saveTimer = 0;

function toast(message) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  clearTimeout(toastEl._timer);
  toastEl._timer = setTimeout(() => { toastEl.hidden = true; }, 2200);
}

function urlFor(blob) {
  if (!blob) return "";
  const url = URL.createObjectURL(blob);
  state.urls.push(url);
  return url;
}

function releaseUrls() {
  state.urls.forEach((url) => URL.revokeObjectURL(url));
  state.urls = [];
}

function setPath(root, path, value) {
  const parts = path.split(".");
  let cursor = root;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    const next = parts[i + 1];
    if (cursor[key] == null) cursor[key] = /^\d+$/.test(next) ? [] : {};
    cursor = cursor[key];
  }
  cursor[parts.at(-1)] = value;
}

function ensureSelection() {
  const property = state.property;
  if (!property.blocks.length) property.blocks.push(blankBlock(1));
  if (!property.blocks.some((block) => block.id === state.blockId)) state.blockId = property.blocks[0].id;
  const block = property.blocks.find((item) => item.id === state.blockId);
  if (!block.observations.length) block.observations.push(blankObservation(1));
  if (!block.observations.some((item) => item.id === state.observationId)) state.observationId = block.observations[0].id;
}

function queueSave() {
  const label = document.querySelector("#saveState");
  if (label) label.textContent = "Saving…";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 250);
}

async function saveNow() {
  if (!state.property) return;
  state.property.updated = new Date().toISOString();
  await saveProperty(state.property);
  const label = document.querySelector("#saveState");
  if (label) label.textContent = "Saved on this device";
}

async function refreshStorage() {
  const status = await storageStatus();
  const persisted = status.persisted ? "persistent" : "not persistent";
  storageEl.textContent = status.quota
    ? `Storage ${formatBytes(status.usage)} of ${formatBytes(status.quota)} · ${persisted}`
    : `Storage ${persisted}`;
}

async function seedLogos(propertyId) {
  const existing = await listPhotos(propertyId);
  if (existing.some((photo) => String(photo.category || "").startsWith("logo-"))) return;
  const files = [
    ["logo-client", "./logos/client.jpg"],
    ["logo-assessor", "./logos/assessor.jpg"],
    ["signature", "./logos/signature.png"],
  ];
  for (const [category, href] of files) {
    try {
      const response = await fetch(href);
      if (!response.ok) continue;
      const blob = await response.blob();
      const size = await imageSize(blob);
      await putPhoto({
        id: uid(),
        propertyId,
        category,
        name: href.split("/").pop(),
        created: new Date().toISOString(),
        blob,
        thumb: blob,
        width: size.width,
        height: size.height,
        bytes: blob.size,
        originalWidth: size.width,
        originalHeight: size.height,
        originalBytes: blob.size,
        caption: "",
      });
    } catch (error) {
      console.warn("logo seed failed", href, error);
    }
  }
}

async function loadProperties() {
  state.properties = await listProperties();
}

async function openProperty(id) {
  state.property = await getProperty(id);
  state.photos = await listPhotos(id);
  state.section = "cover";
  ensureSelection();
  localStorage.setItem(ACTIVE_KEY, id);
  render();
}

function render() {
  releaseUrls();
  if (!state.property) {
    app.innerHTML = homeHtml(state.properties, state.showArchived);
    return;
  }
  ensureSelection();
  app.innerHTML = `<p class="save-line" id="saveState">Saved on this device</p>${editorHtml(state, urlFor)}`;
  const chart = document.querySelector("#yield-chart");
  if (chart) {
    paintYieldChart(chart, state.property.blocks.filter(blockIsAssessed).map((block) => yieldChartRow(
      block.name || "Block",
      scoreStoredBlock(block, state.property.uplifts),
      chartRisksForBlock(block, state.property.risks, state.property.uplifts),
    )));
  }
}

async function addPhotos(files, meta) {
  const list = [...files].filter(Boolean);
  if (!list.length || !state.property) return;
  photosSaving += list.length;
  try {
    for (const file of list) {
      try {
        await savePhotoFile(file, meta);
      } catch (error) {
        console.error(error);
        const undecodable = error?.name === "InvalidStateError" || /decode|could not be read/i.test(error?.message || "");
        toast(undecodable ? `${file.name || "This photo"} could not be read. Save it as a JPEG and add it again.` : "The photo could not be saved.");
      }
    }
  } finally {
    finishPhotoSave(list.length);
  }
}

async function savePhotoFile(file, meta) {
  const compressed = meta.category.startsWith("logo-") ? null : await compressPhoto(file);
  const blob = compressed ? compressed.blob : file;
  const thumb = compressed ? compressed.thumb : file;
  const size = compressed || { ...await imageSize(file), bytes: file.size, originalWidth: 0, originalHeight: 0, originalBytes: file.size };
  if (!compressed) {
    const measured = await imageSize(file);
    size.width = measured.width;
    size.height = measured.height;
    size.originalWidth = measured.width;
    size.originalHeight = measured.height;
    size.originalBytes = file.size;
    size.bytes = file.size;
  }
  const record = {
    id: uid(),
    propertyId: state.property.id,
    category: meta.category,
    blockId: meta.blockId || "",
    observationId: meta.observationId || "",
    label: meta.label || "",
    caption: file.name || "",
    name: file.name || "photo",
    created: new Date().toISOString(),
    blob,
    thumb,
    width: size.width,
    height: size.height,
    bytes: size.bytes,
    originalWidth: size.originalWidth,
    originalHeight: size.originalHeight,
    originalBytes: size.originalBytes,
  };
  if (meta.category.startsWith("logo-")) {
    for (const photo of state.photos.filter((item) => item.category === meta.category)) {
      await deletePhoto(photo.id);
    }
    state.photos = state.photos.filter((item) => item.category !== meta.category);
  }
  await putPhoto(record);
  state.photos.push(record);
  if (compressed) {
    console.info("photo-compressed", {
      name: file.name,
      originalWidth: compressed.originalWidth,
      originalHeight: compressed.originalHeight,
      originalBytes: compressed.originalBytes,
      width: compressed.width,
      height: compressed.height,
      bytes: compressed.bytes,
    });
  }
  await refreshStorage();
  render();
  toast(compressed ? "Photo compressed and saved" : "Logo saved");
}

async function onClick(event) {
  const target = event.target.closest("[data-action], [data-section]");
  if (!target || target.matches("input, select, textarea")) return;
  if (target.dataset.section) {
    state.section = target.dataset.section;
    render();
    window.scrollTo(0, 0);
    return;
  }
  const action = target.dataset.action;
  if (action === "score") {
    setPath(state.property, target.dataset.path, target.dataset.value);
    queueSave();
    render();
    return;
  }
  if (action === "new-property") {
    const property = blankProperty();
    await saveProperty(property);
    await seedLogos(property.id);
    await loadProperties();
    await openProperty(property.id);
    toast("Property created");
    return;
  }
  if (action === "open-property") {
    await openProperty(target.dataset.id);
    return;
  }
  if (action === "close-property") {
    await saveNow();
    await loadProperties();
    state.property = null;
    localStorage.removeItem(ACTIVE_KEY);
    render();
    return;
  }
  if (action === "duplicate-property") {
    await duplicate(target.dataset.id);
    return;
  }
  if (action === "archive-property") {
    const property = await getProperty(target.dataset.id);
    property.archived = !property.archived;
    await saveProperty(property);
    await loadProperties();
    render();
    return;
  }
  if (action === "add-block") {
    const block = blankBlock(state.property.blocks.length + 1);
    state.property.blocks.push(block);
    state.blockId = block.id;
    state.observationId = block.observations[0].id;
    queueSave();
    render();
    return;
  }
  if (action === "delete-block") {
    state.property.blocks = state.property.blocks.filter((block) => block.id !== target.dataset.id);
    ensureSelection();
    queueSave();
    render();
    return;
  }
  if (action === "select-block") {
    state.blockId = target.dataset.id;
    state.observationId = null;
    ensureSelection();
    render();
    return;
  }
  if (action === "add-observation") {
    const block = state.property.blocks.find((item) => item.id === state.blockId);
    const observation = blankObservation(block.observations.length + 1);
    block.observations.push(observation);
    state.observationId = observation.id;
    queueSave();
    render();
    return;
  }
  if (action === "delete-observation") {
    const block = state.property.blocks.find((item) => item.id === state.blockId);
    block.observations = block.observations.filter((item) => item.id !== target.dataset.id);
    ensureSelection();
    queueSave();
    render();
    return;
  }
  if (action === "select-observation") {
    state.observationId = target.dataset.id;
    render();
    return;
  }
  if (action === "add-soil") {
    state.property.profile.soils.push({ code: "", description: "", landscape: "", asc: "", attributes: "", greatGroup: "" });
    queueSave();
    render();
    return;
  }
  if (action === "add-cultivar") {
    state.property.profile.cultivars.push({ name: "", habit: "", flowering: "", drop: "", kernel: "" });
    queueSave();
    render();
    return;
  }
  if (action === "add-risk") {
    state.property.risks.push(blankRisk(state.property.risks.length + 1));
    queueSave();
    render();
    return;
  }
  if (action === "add-reference") {
    state.property.references.push("");
    queueSave();
    render();
    return;
  }
  if (action === "add-chemistry") {
    state.property.appendix.rows.push({ indicator: "", result: "", finding: "", implication: "" });
    queueSave();
    render();
    return;
  }
  if (action === "add-action") {
    state.property.appendix.actions.push("");
    queueSave();
    render();
    return;
  }
  if (action === "remove-at") {
    const list = pathValue(state.property, target.dataset.path);
    list.splice(Number(target.dataset.index), 1);
    queueSave();
    render();
    return;
  }
  if (action === "delete-photo") {
    await deletePhoto(target.dataset.id);
    state.photos = state.photos.filter((photo) => photo.id !== target.dataset.id);
    await refreshStorage();
    render();
    return;
  }
  if (action === "backup") {
    const blob = await createBackup();
    download(blob, "macadamia-field-backup.json");
    toast("Backup downloaded");
    return;
  }
  if (action === "export-docx") {
    const button = target;
    button.disabled = true;
    button.textContent = photosSaving ? "Saving photos…" : "Building Word…";
    try {
      do {
        await whenPhotosSaved();
        await saveNow();
        state.photos = await listPhotos(state.property.id);
      } while (photosSaving > 0);
      if (button.isConnected) button.textContent = "Building Word…";
      const blob = await buildDocx(state.property, state.photos);
      const safe = (state.property.cover.propertyName || "macadamia-report").replace(/[^\w.-]+/g, "-");
      download(blob, `${safe}-due-diligence.docx`);
      toast("Word report exported");
    } catch (error) {
      console.error(error);
      toast("The Word report could not be built");
    } finally {
      button.disabled = false;
      button.textContent = "Export Word";
    }
    return;
  }
  if (action === "reload-update") applyUpdate(state.updateRegistration);
}

function pathValue(root, path) {
  return path.split(".").reduce((cursor, key) => cursor?.[key], root);
}

function onInput(event) {
  const target = event.target;
  if (target.dataset.path && state.property) {
    setPath(state.property, target.dataset.path, target.value);
    queueSave();
  }
  if (target.dataset.photoCaption) {
    const photo = state.photos.find((item) => item.id === target.dataset.photoCaption);
    if (!photo) return;
    photo.caption = target.value;
    clearTimeout(photo._timer);
    photo._timer = setTimeout(() => putPhoto(photo), 300);
  }
}

async function onChange(event) {
  const target = event.target;
  if (target.dataset.action === "restore") {
    const file = target.files?.[0];
    target.value = "";
    if (!file) return;
    try {
      await restoreBackup(file);
      await loadProperties();
      state.property = null;
      render();
      toast("Backup restored");
    } catch (error) {
      console.error(error);
      toast("Backup could not be read");
    }
    return;
  }
  if (target.dataset.action === "add-photo" || target.dataset.action === "replace-logo") {
    const files = [...(target.files || [])];
    target.value = "";
    if (!files.length || !state.property) return;
    await addPhotos(files, photoMeta(target));
    return;
  }
  if (target.dataset.action === "toggle-archived") {
    state.showArchived = target.checked;
    render();
    return;
  }
  if (target.dataset.action === "toggle-risk-block") {
    const risk = state.property.risks[Number(target.dataset.index)];
    const allIds = state.property.blocks.map((block) => block.id);
    const selected = new Set(risk.blockIds == null ? allIds : risk.blockIds);
    if (target.checked) selected.add(target.dataset.blockId);
    else selected.delete(target.dataset.blockId);
    risk.blockIds = allIds.length && allIds.every((id) => selected.has(id)) ? null : [...selected];
    queueSave();
    render();
    return;
  }
  if (target.dataset.action === "toggle-domain") {
    const risk = state.property.risks[Number(target.dataset.index)];
    const domains = new Set(risk.domains || []);
    if (target.checked) domains.add(target.dataset.domain);
    else domains.delete(target.dataset.domain);
    risk.domains = [...domains];
    queueSave();
    return;
  }
  if (target.dataset.path && state.property) onInput(event);
}

function download(blob, name) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 2000);
}

async function duplicate(id) {
  const source = await getProperty(id);
  const copy = structuredClone(source);
  copy.id = uid();
  copy.archived = false;
  copy.created = new Date().toISOString();
  copy.cover.propertyName = `${copy.cover.propertyName || "Property"} copy`;
  const map = new Map();
  for (const block of copy.blocks) {
    const nextBlock = uid();
    map.set(block.id, nextBlock);
    block.id = nextBlock;
    for (const observation of block.observations) {
      const nextObservation = uid();
      map.set(observation.id, nextObservation);
      observation.id = nextObservation;
    }
  }
  for (const risk of copy.risks || []) {
    if (Array.isArray(risk.blockIds)) risk.blockIds = risk.blockIds.map((id) => map.get(id)).filter(Boolean);
  }
  await saveProperty(copy);
  const photos = await listPhotos(id);
  for (const photo of photos) {
    await putPhoto({
      ...photo,
      id: uid(),
      propertyId: copy.id,
      blockId: map.get(photo.blockId) || "",
      observationId: map.get(photo.observationId) || "",
    });
  }
  await loadProperties();
  render();
  toast("Property duplicated");
}

function photoMeta(source) {
  return {
    category: source.dataset.category,
    blockId: source.dataset.blockId,
    observationId: source.dataset.observationId,
    label: source.dataset.label,
  };
}

function draggedFiles(event) {
  return [...(event.dataTransfer?.types || [])].includes("Files");
}

function dropZone(event) {
  const el = event.target instanceof Element ? event.target : event.target?.parentElement;
  return el?.closest?.("[data-drop]") || null;
}

app.addEventListener("click", (event) => { onClick(event).catch((error) => console.error(error)); });
app.addEventListener("input", onInput);
app.addEventListener("change", (event) => { onChange(event).catch((error) => console.error(error)); });
document.addEventListener("dragover", (event) => {
  if (!draggedFiles(event)) return;
  event.preventDefault();
  const zone = dropZone(event);
  document.querySelectorAll(".drop.over").forEach((el) => { if (el !== zone) el.classList.remove("over"); });
  zone?.classList.add("over");
});
document.addEventListener("drop", (event) => {
  if (!draggedFiles(event)) return;
  event.preventDefault();
  document.querySelectorAll(".drop.over").forEach((el) => el.classList.remove("over"));
  const zone = dropZone(event);
  const files = [...(event.dataTransfer?.files || [])];
  if (!zone) {
    if (files.length) toast("Drop the photo on an Add photo button.");
    return;
  }
  addPhotos(files, photoMeta(zone)).catch((error) => console.error(error));
});

document.querySelector("#update button")?.addEventListener("click", () => applyUpdate(state.updateRegistration));

async function boot() {
  await refreshStorage();
  await loadProperties();
  const active = localStorage.getItem(ACTIVE_KEY);
  if (active && state.properties.some((property) => property.id === active)) await openProperty(active);
  else render();
  watchUpdates((registration) => {
    state.updateRegistration = registration;
    document.querySelector("#update").hidden = false;
  });
}

boot().catch((error) => {
  console.error(error);
  app.innerHTML = `<p class="empty">The report could not open. ${esc(error.message || "")}</p>`;
});

function paintLive() {
  const live = document.querySelector("#live");
  if (!live || !state.property || state.section !== "condition") return;
  const block = state.property.blocks.find((item) => item.id === state.blockId) || state.property.blocks[0];
  const score = scoreStoredBlock(block, state.property.uplifts);
  const metrics = live.querySelector(".metrics");
  if (!metrics) return;
  const values = [formatPercent(score.current), formatPercent(score.potential), formatPp(score.managementUpliftPp), formatPercent(score.finalConditional)];
  metrics.querySelectorAll("b").forEach((node, index) => { node.textContent = values[index]; });
  const body = live.querySelector("tbody");
  if (!body) return;
  const rows = [...body.querySelectorAll("tr")];
  score.parameters.forEach((param, index) => {
    const cells = rows[index]?.querySelectorAll("td");
    if (!cells) return;
    cells[1].textContent = weightPercentLabel(param.weight);
    cells[2].textContent = param.currentRating == null ? "—" : Number(param.currentRating).toFixed(2);
    cells[3].textContent = param.potentialRating == null ? "—" : String(param.potentialRating);
    cells[4].textContent = param.currentContribution == null ? "—" : param.currentContribution.toFixed(4);
    cells[5].textContent = param.potentialContribution.toFixed(4);
  });
  const total = rows.at(-1)?.querySelectorAll("td");
  if (total) {
    total[4].textContent = score.current.toFixed(4);
    total[5].textContent = score.potential.toFixed(4);
  }
}

const originalOnInput = onInput;
app.removeEventListener("input", onInput);
app.addEventListener("input", (event) => {
  originalOnInput(event);
  paintLive();
});
