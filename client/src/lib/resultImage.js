/**
 * Renders the end-of-cycle result card to a PNG and downloads it.
 * Pure Canvas 2D: no DOM screenshots, no dependencies.
 */

import { money, signedMoney } from "../utils";

/**
 * @typedef {Object} ResultCardData
 * @property {string}  gameCode
 * @property {number}  cycle
 * @property {boolean} isFinal          true when phase === "finished"
 * @property {string}  myPlayerId       highlighted as "YOU"
 * @property {{
 *   rank: number, rankBefore: number|null, playerId: string, name: string, color: string,
 *   netWorth: number, cash: number, holdings: number, change: number, changePercent: number
 * }[]} standings                        sorted by netWorth, highest first
 * @property {{ ticker: string, newPrice: number, percent: number, isClosed: boolean }[]} stocks
 */

// ---------------------------------------------------------------------------
// Layout constants (CSS pixels; the canvas is drawn at SCALE×)
// ---------------------------------------------------------------------------

const WIDTH = 1200;
const SCALE = 2;
const PAD = 56;
const CONTENT_W = WIDTH - PAD * 2;

const HEADER_H = 176;
const PODIUM_H = 290;
const SECTION_GAP = 32;
const TITLE_H = 36;

const TABLE_HEAD_H = 44;
const ROW_H = 52;
const BAR_ROW_H = 44;

const FOOTER_H = 64;

const FONT_FAMILY = '"JetBrains Mono", "SFMono-Regular", Consolas, monospace';

// Matches the app's final theme (styles.css :root).
const COLORS = {
  bg: "#050906",
  panel: "#0d1711",
  panelAlt: "#122019",
  line: "#24382c",
  text: "#e2eee6",
  muted: "#83968a",
  green: "#35d48a",
  red: "#fb647c",
  amber: "#f3bd58",
  dark: "#0a0f0c"
};

// Gold, silver, bronze.
const MEDALS = ["#f3bd58", "#c5cbc7", "#d08b5b"];

// ---------------------------------------------------------------------------
// Small drawing helpers
// ---------------------------------------------------------------------------

const font = (weight, size) => `${weight} ${size}px ${FONT_FAMILY}`;

const toneColor = (value) =>
  value > 0 ? COLORS.green : value < 0 ? COLORS.red : COLORS.muted;

const signedPercent = (value) =>
  `${value > 0 ? "+" : ""}${Number(value || 0).toFixed(1)}%`;

/** Shorten text with "…" so it fits in maxWidth. */
function fitText(ctx, value, maxWidth) {
  let text = String(value ?? "");

  if (!maxWidth || ctx.measureText(text).width <= maxWidth) return text;

  while (text.length > 1 && ctx.measureText(`${text}…`).width > maxWidth) {
    text = text.slice(0, -1);
  }

  return `${text}…`;
}

function drawText(ctx, value, x, y, {
  size = 15,
  weight = 400,
  color = COLORS.text,
  align = "left",
  maxWidth
} = {}) {
  ctx.font = font(weight, size);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(fitText(ctx, value, maxWidth), x, y);
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function drawPanel(ctx, x, y, width, height) {
  roundRect(ctx, x, y, width, height, 14);
  ctx.fillStyle = COLORS.panel;
  ctx.fill();
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawAvatar(ctx, cx, cy, radius, name, color) {
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = color || COLORS.muted;
  ctx.fill();

  drawText(ctx, String(name || "?").slice(0, 1).toUpperCase(), cx, cy + 1, {
    size: Math.round(radius * 0.9),
    weight: 700,
    color: COLORS.dark,
    align: "center"
  });
}

function drawSectionTitle(ctx, title, y) {
  drawText(ctx, title, PAD, y + 14, { size: 13, weight: 700, color: COLORS.muted });
}

// ---------------------------------------------------------------------------
// Section heights (shared by layout and drawing so they never disagree)
// ---------------------------------------------------------------------------

const tablePanelHeight = (rows) => TABLE_HEAD_H + rows * ROW_H + 16;
const barsPanelHeight = (rows) => 24 + rows * BAR_ROW_H;

function canvasHeight(data) {
  const rows = data.standings.length;

  return (
    HEADER_H +
    (rows >= 2 ? PODIUM_H : 0) +
    TITLE_H + tablePanelHeight(rows) + SECTION_GAP +
    TITLE_H + barsPanelHeight(rows) + SECTION_GAP +
    FOOTER_H
  );
}

// ---------------------------------------------------------------------------
// Sections. Each takes the top y and returns the next section's top y.
// ---------------------------------------------------------------------------

function drawBackground(ctx, height) {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, WIDTH, height);

  // Soft green glow behind the header.
  const glow = ctx.createRadialGradient(WIDTH * 0.2, 0, 0, WIDTH * 0.2, 0, 700);
  glow.addColorStop(0, "rgba(53, 212, 138, 0.14)");
  glow.addColorStop(1, "rgba(53, 212, 138, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, height);
}

function drawHeader(ctx, data, y) {
  drawText(ctx, "STOCKS O7 GAME", PAD, y + 56, { size: 16, weight: 700, color: COLORS.green });

  const title = "Final Leaderboard";
  drawText(ctx, title, PAD, y + 104, { size: 38, weight: 700 });

  const date = new Date().toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric"
  });
  const players = data.standings.length;

  drawText(
    ctx,
    `${date} · ${players} ${players === 1 ? "player" : "players"} · cycle ${data.cycle}`,
    PAD, y + 142,
    { size: 16, color: COLORS.muted }
  );

  return y + HEADER_H;
}

function drawPodium(ctx, data, y) {
  if (data.standings.length < 2) return y;

  // Display order: 2nd, 1st, 3rd.
  const top = data.standings.slice(0, 3);
  const order = [top[1], top[0], top[2]].filter(Boolean);
  const heights = { 1: 120, 2: 90, 3: 70 };

  const columnW = 220;
  const gap = 30;
  const totalW = order.length * columnW + (order.length - 1) * gap;
  const startX = (WIDTH - totalW) / 2;
  const base = y + 250;

  order.forEach((row, index) => {
    const x = startX + index * (columnW + gap);
    const cx = x + columnW / 2;
    const blockH = heights[row.rank] ?? 60;
    const medal = MEDALS[row.rank - 1] ?? COLORS.muted;

    // Block
    const gradient = ctx.createLinearGradient(0, base - blockH, 0, base);
    gradient.addColorStop(0, medal);
    gradient.addColorStop(1, "rgba(255, 255, 255, 0.05)");
    roundRect(ctx, x, base - blockH, columnW, blockH, [12, 12, 0, 0]);
    ctx.fillStyle = gradient;
    ctx.fill();

    drawText(ctx, `#${row.rank}`, cx, base - blockH + 34, {
      size: 26, weight: 800, color: COLORS.dark, align: "center"
    });

    // Player above the block
    drawAvatar(ctx, cx, base - blockH - 92, 30, row.name, row.color);

    drawText(ctx, row.name, cx, base - blockH - 46, {
      size: 17, weight: 700, align: "center", maxWidth: columnW
    });

    drawText(ctx, money(row.netWorth), cx, base - blockH - 20, {
      size: 15, weight: 700, color: medal, align: "center"
    });
  });

  return y + PODIUM_H;
}

function drawStandings(ctx, data, y) {
  drawSectionTitle(ctx, "STANDINGS", y);

  const top = y + TITLE_H;
  const panelH = tablePanelHeight(data.standings.length);

  drawPanel(ctx, PAD, top, CONTENT_W, panelH);

  const col = {
    rank: PAD + 24,
    player: PAD + 112,
    netWorth: PAD + 580,
    cash: PAD + 720,
    holdings: PAD + 860,
    change: PAD + CONTENT_W - 24
  };

  const head = { size: 12, weight: 700, color: COLORS.muted };
  const headY = top + TABLE_HEAD_H / 2 + 2;

  drawText(ctx, "RANK", col.rank, headY, head);
  drawText(ctx, "PLAYER", col.player, headY, head);
  drawText(ctx, "NET WORTH", col.netWorth, headY, { ...head, align: "right" });
  drawText(ctx, "CASH", col.cash, headY, { ...head, align: "right" });
  drawText(ctx, "HOLDINGS", col.holdings, headY, { ...head, align: "right" });
  drawText(ctx, "CHANGE THIS CYCLE", col.change, headY, { ...head, align: "right" });

  ctx.fillStyle = COLORS.line;
  ctx.fillRect(PAD, top + TABLE_HEAD_H, CONTENT_W, 1);

  data.standings.forEach((row, index) => {
    const rowTop = top + TABLE_HEAD_H + 8 + index * ROW_H;
    const cy = rowTop + ROW_H / 2;
    const isMe = row.playerId === data.myPlayerId;

    if (isMe) {
      roundRect(ctx, PAD + 8, rowTop + 4, CONTENT_W - 16, ROW_H - 8, 8);
      ctx.fillStyle = "rgba(53, 212, 138, 0.08)";
      ctx.fill();
      ctx.fillStyle = COLORS.green;
      ctx.fillRect(PAD + 8, rowTop + 10, 3, ROW_H - 20);
    }

    drawText(ctx, `#${row.rank}`, col.rank, cy, {
      size: 16, weight: 800, color: MEDALS[index] ?? COLORS.text
    });

    // Rank movement since before this market open.
    const moved = row.rankBefore ? row.rankBefore - row.rank : 0;

    if (moved !== 0) {
      drawText(ctx, `${moved > 0 ? "▲" : "▼"}${Math.abs(moved)}`, col.rank + 44, cy, {
        size: 12, weight: 700, color: moved > 0 ? COLORS.green : COLORS.red
      });
    }

    ctx.beginPath();
    ctx.arc(col.player + 6, cy, 7, 0, Math.PI * 2);
    ctx.fillStyle = row.color || COLORS.muted;
    ctx.fill();

    drawText(ctx, row.name, col.player + 22, cy, {
      size: 16, weight: 700, maxWidth: isMe ? 230 : 290
    });

    if (isMe) {
      ctx.font = font(700, 16);
      const nameW = ctx.measureText(fitText(ctx, row.name, 230)).width;

      drawText(ctx, "YOU", col.player + 22 + nameW + 12, cy, {
        size: 11, weight: 800, color: COLORS.green
      });
    }

    drawText(ctx, money(row.netWorth), col.netWorth, cy, {
      size: 16, weight: 700, align: "right"
    });
    drawText(ctx, money(row.cash), col.cash, cy, {
      size: 14, color: COLORS.muted, align: "right"
    });
    drawText(ctx, money(row.holdings), col.holdings, cy, {
      size: 14, color: COLORS.muted, align: "right"
    });
    drawText(
      ctx,
      `${signedMoney(row.change)} (${signedPercent(row.changePercent)})`,
      col.change, cy,
      { size: 14, weight: 700, color: toneColor(row.change), align: "right" }
    );
  });

  return top + panelH + SECTION_GAP;
}

function drawNetWorthBars(ctx, data, y) {
  drawSectionTitle(ctx, "NET WORTH", y);

  const top = y + TITLE_H;
  const panelH = barsPanelHeight(data.standings.length);

  drawPanel(ctx, PAD, top, CONTENT_W, panelH);

  const labelW = 180;
  const valueW = 150;
  const barX = PAD + 24 + labelW + 16;
  const barMaxW = CONTENT_W - 24 - labelW - 16 - valueW - 24;
  const maxWorth = Math.max(1, ...data.standings.map((row) => row.netWorth));

  data.standings.forEach((row, index) => {
    const cy = top + 12 + index * BAR_ROW_H + BAR_ROW_H / 2;
    const barW = Math.max(6, (row.netWorth / maxWorth) * barMaxW);

    drawText(ctx, row.name, PAD + 24, cy, { size: 14, weight: 700, maxWidth: labelW });

    // Track
    roundRect(ctx, barX, cy - 11, barMaxW, 22, 6);
    ctx.fillStyle = COLORS.panelAlt;
    ctx.fill();

    // Bar
    roundRect(ctx, barX, cy - 11, barW, 22, 6);
    ctx.fillStyle = row.color || COLORS.green;
    ctx.fill();

    drawText(ctx, money(row.netWorth), PAD + CONTENT_W - 24, cy, {
      size: 14, weight: 700, align: "right"
    });
  });

  return top + panelH + SECTION_GAP;
}

function drawFooter(ctx, y) {
  const generated = new Date().toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });

  ctx.fillStyle = COLORS.line;
  ctx.fillRect(PAD, y, CONTENT_W, 1);

  drawText(ctx, `${generated}`, PAD, y + 32, {
    size: 13, color: COLORS.muted
  });
  drawText(ctx, "Think you can beat this? Start a new game!", WIDTH - PAD, y + 32, {
    size: 13, color: COLORS.muted, align: "right"
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Draw the result card.
 *
 * @param {ResultCardData} data
 * @returns {HTMLCanvasElement}
 */
export function renderResultCard(data) {
  const height = canvasHeight(data);
  const canvas = document.createElement("canvas");

  canvas.width = WIDTH * SCALE;
  canvas.height = height * SCALE;

  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = "middle";

  drawBackground(ctx, height);

  let y = 0;
  y = drawHeader(ctx, data, y);
  y = drawPodium(ctx, data, y);
  y = drawStandings(ctx, data, y);
  y = drawNetWorthBars(ctx, data, y);
  drawFooter(ctx, y);

  return canvas;
}

/**
 * Canvas only uses a web font once it has loaded.
 * JetBrains Mono is imported by styles.css, so this is usually instant.
 */
async function ensureFontsLoaded() {
  if (!document.fonts?.load) return;

  try {
    await Promise.all([
      document.fonts.load(font(400, 16)),
      document.fonts.load(font(700, 16)),
      document.fonts.load(font(800, 16))
    ]);
  } catch {
    // Fall back to the system monospace font.
  }
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not create the image."))),
      "image/png"
    );
  });
}

/**
 * Render the card and download it as a PNG.
 *
 * @param {ResultCardData} data
 * @param {string} filename
 */
export async function downloadResultCard(data, filename) {
  await ensureFontsLoaded();

  const blob = await canvasToBlob(renderResultCard(data));
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Give the browser time to start the download before releasing the blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
