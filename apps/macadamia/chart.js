/** Print-resolution Figure 13. No chart library: one canvas, one PNG. */

import { chartLegendIds } from "./scoring.js";

const COLORS = {
  ink: "#1a3a42",
  muted: "#5c6b66",
  grid: "#e4e0d4",
  paper: "#ffffff",
  current: "#f5a623",
  management: "#1e7a3a",
};
const RISK_COLORS = { R1: "#2bb8c4", R2: "#7cb342", R3: "#d4e157" };
const RISK_LABELS = {
  R1: "R1 canopy capital",
  R2: "R2 irrigation capital",
  R3: "R3 root-zone capital",
};

export function paintYieldChart(canvas, rows) {
  const width = 2400;
  const count = Math.max(rows.length, 1);
  const height = 360 + count * 120 + 70 + 90 + count * 48 + 80;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = COLORS.paper;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = COLORS.ink;
  ctx.font = "bold 54px Arial, sans-serif";
  ctx.fillText("Block condition improvement potential", 64, 78);
  ctx.font = "32px Arial, sans-serif";
  ctx.fillStyle = "#3d5c62";
  ctx.fillText("Current condition, management improvement and recognised capital-intervention gains to the 100% cap", 64, 126);

  const plotLeft = 280;
  const plotRight = 1960;
  const plotWidth = plotRight - plotLeft;
  const labelRight = plotRight + 24;
  let y = 190;

  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 2;
  ctx.fillStyle = COLORS.muted;
  ctx.font = "26px Arial, sans-serif";
  ctx.textAlign = "center";
  for (let tick = 0; tick <= 100; tick += 10) {
    const x = plotLeft + (tick / 100) * plotWidth;
    ctx.beginPath();
    ctx.moveTo(x, y - 10);
    ctx.lineTo(x, y + count * 120 - 20);
    ctx.stroke();
  }

  rows.forEach((row, index) => {
    const top = y + index * 120;
    ctx.textAlign = "right";
    ctx.fillStyle = COLORS.ink;
    ctx.font = "bold 32px Arial, sans-serif";
    ctx.fillText(row.name, plotLeft - 24, top + 58);
    const segments = [
      { value: row.current, color: COLORS.current, label: `Current ${row.current}%`, ink: "#1a1a1a" },
      { value: row.management, color: COLORS.management, label: `+${row.management} pp`, ink: "#ffffff" },
      ...(row.segments || []).map((segment) => ({
        value: segment.value,
        color: RISK_COLORS[segment.id] || "#8d9a78",
        label: `${segment.id} +${segment.value}`,
        ink: segment.id === "R3" ? "#1a1a1a" : "#1a1a1a",
      })),
    ];
    let x = plotLeft;
    for (const segment of segments) {
      if (!segment.value) continue;
      const segWidth = (segment.value / 100) * plotWidth;
      ctx.fillStyle = segment.color;
      ctx.fillRect(x, top + 16, segWidth, 64);
      ctx.font = "bold 26px Arial, sans-serif";
      if (ctx.measureText(segment.label).width + 16 < segWidth) {
        ctx.fillStyle = segment.ink;
        ctx.textAlign = "center";
        ctx.fillText(segment.label, x + segWidth / 2, top + 58);
      }
      x += segWidth;
    }
    ctx.textAlign = "left";
    ctx.fillStyle = COLORS.ink;
    ctx.font = "bold 30px Arial, sans-serif";
    ctx.fillText("100% potential", labelRight, top + 58);
  });

  const axisY = y + count * 120 - 8;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(plotLeft, axisY);
  ctx.lineTo(plotRight, axisY);
  ctx.stroke();
  ctx.fillStyle = COLORS.ink;
  ctx.font = "24px Arial, sans-serif";
  ctx.textAlign = "center";
  for (let tick = 0; tick <= 100; tick += 10) {
    const x = plotLeft + (tick / 100) * plotWidth;
    ctx.fillText(String(tick), x, axisY + 36);
  }
  ctx.font = "28px Arial, sans-serif";
  ctx.fillText("Weighted block condition score (%)", (plotLeft + plotRight) / 2, axisY + 78);

  const legend = [
    [COLORS.current, "Current condition"],
    [COLORS.management, "Management improvement"],
    ...chartLegendIds(rows).map((id) => [RISK_COLORS[id] || "#8d9a78", RISK_LABELS[id] || `${id} capital`]),
  ];
  let legendX = 80;
  let legendY = axisY + 130;
  ctx.textAlign = "left";
  ctx.font = "26px Arial, sans-serif";
  for (const [color, label] of legend) {
    const itemWidth = 40 + ctx.measureText(label).width + 48;
    if (legendX + itemWidth > width - 40) {
      legendX = 80;
      legendY += 48;
    }
    ctx.fillStyle = color;
    ctx.fillRect(legendX, legendY - 22, 28, 28);
    ctx.fillStyle = COLORS.ink;
    ctx.fillText(label, legendX + 40, legendY);
    legendX += itemWidth;
  }

  ctx.font = "bold 30px Arial, sans-serif";
  ctx.fillStyle = COLORS.ink;
  rows.forEach((row, index) => {
    ctx.fillText(row.line, 80, legendY + 70 + index * 46);
  });
  ctx.font = "28px Arial, sans-serif";
  ctx.fillStyle = "#3d4f4a";
  ctx.fillText(
    "Capital gains shown are limited to the remaining percentage points required to reach the 100% cap.",
    80,
    legendY + 70 + rows.length * 46 + 20,
  );
  return canvas;
}

export async function yieldChartPng(rows) {
  const canvas = document.createElement("canvas");
  paintYieldChart(canvas, rows);
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("Could not draw the yield chart"))), "image/png");
  });
  return { blob, width: canvas.width, height: canvas.height, type: "png", name: "yield-potential.png" };
}
