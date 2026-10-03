// Renders the share image (1200x630) and the Apple touch icon into app/. Run: node scripts/make-brand-images.mjs
import { createCanvas } from "@napi-rs/canvas";
import { writeFileSync } from "node:fs";

function mark(ctx, x, y, s) {
  const k = s / 64;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  const g = ctx.createLinearGradient(0, 0, 64, 64);
  g.addColorStop(0, "#4f46e5");
  g.addColorStop(1, "#7c8cff");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(0, 0, 64, 64, 15);
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineCap = "round";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(29, 29, 14, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(39.5, 39.5);
  ctx.lineTo(52, 52);
  ctx.stroke();
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(23, 29);
  ctx.lineTo(35, 23);
  ctx.moveTo(23, 29);
  ctx.lineTo(35, 35);
  ctx.stroke();
  for (const [cx, cy, r, c] of [[23, 29, 3.2, "#f0b04a"], [35, 23, 3, "#fff"], [35, 35, 3, "#fff"]]) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Share image
{
  const W = 1200, H = 630;
  const c = createCanvas(W, H);
  const ctx = c.getContext("2d");
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0f1218");
  bg.addColorStop(1, "#1a2040");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  for (const [x, y, r, hue] of [[1050, 80, 380, 232], [1100, 560, 320, 268], [700, 650, 260, 172]]) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `hsla(${hue}, 80%, 60%, 0.35)`);
    g.addColorStop(1, `hsla(${hue}, 80%, 60%, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  mark(ctx, 80, 80, 96);
  ctx.fillStyle = "#e6eaf2";
  ctx.font = "bold 92px Segoe UI, Arial, sans-serif";
  ctx.fillText("architectlens", 80, 300);
  ctx.fillStyle = "#a3adc2";
  ctx.font = "38px Segoe UI, Arial, sans-serif";
  ctx.fillText("System design and AI systems, from first", 80, 372);
  ctx.fillText("principles to current enterprise practice.", 80, 422);
  let x = 80;
  for (const [label, hue] of [["System Design", 232], ["AI Systems", 172], ["AI System Design", 268], ["Frameworks", 335]]) {
    ctx.font = "28px Segoe UI, Arial, sans-serif";
    const w = ctx.measureText(label).width + 64;
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.beginPath();
    ctx.roundRect(x, 500, w, 56, 28);
    ctx.fill();
    ctx.fillStyle = `hsl(${hue}, 80%, 65%)`;
    ctx.beginPath();
    ctx.arc(x + 28, 528, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e6eaf2";
    ctx.fillText(label, x + 46, 538);
    x += w + 16;
  }
  const png = c.toBuffer("image/png");
  writeFileSync("app/opengraph-image.png", png);
  writeFileSync("app/twitter-image.png", png);
}

// Apple touch icon
{
  const c = createCanvas(180, 180);
  const ctx = c.getContext("2d");
  mark(ctx, 0, 0, 180);
  writeFileSync("app/apple-icon.png", c.toBuffer("image/png"));
}
console.log("brand images written");
