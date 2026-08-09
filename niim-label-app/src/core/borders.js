
/** Decorative border styles for label frames (print-safe mono strokes). No VIP gates. */
const BORDER_CHIPS = ["最新", "热门", "动物", "复古", "节日", "花草", "中式", "线条"];

const BORDER_CATALOG = [
  { id: "simple", label: "细框", chip: "最新", draw: "rect" },
  { id: "double", label: "双线框", chip: "热门", draw: "double" },
  { id: "rounded", label: "圆角框", chip: "最新", draw: "rounded" },
  { id: "thick", label: "粗框", chip: "热门", draw: "thick" },
  { id: "dashed", label: "虚线框", chip: "线条", draw: "dashed" },
  { id: "dash_line", label: "虚线", chip: "线条", draw: "h_dash" },
  { id: "solid_line", label: "实线", chip: "线条", draw: "h_line" },
  { id: "ticket", label: "票根", chip: "复古", draw: "ticket" },
  { id: "badge", label: "铭牌", chip: "复古", draw: "badge" },
  { id: "stamp", label: "邮戳", chip: "复古", draw: "stamp" },
  { id: "ornament", label: "花边", chip: "花草", draw: "ornament" },
  { id: "wave", label: "波浪线", chip: "花草", draw: "wave" },
  { id: "hearts", label: "心形点缀", chip: "节日", draw: "hearts" },
  { id: "circle_dots", label: "圆点环", chip: "节日", draw: "circle_dots" },
  { id: "chinese", label: "中式回纹", chip: "中式", draw: "chinese" },
  { id: "cloud", label: "祥云", chip: "中式", draw: "cloud" },
  { id: "paw", label: "爪印", chip: "动物", draw: "paw" },
  { id: "bone", label: "骨头", chip: "动物", draw: "bone" },
  { id: "corner", label: "角花", chip: "复古", draw: "corner" },
  { id: "inset", label: "内框", chip: "最新", draw: "inset" }
];

function bordersForChip(chip, query) {
  let list = BORDER_CATALOG.slice();
  const c = String(chip || "最新");
  if (c && c !== "搜索" && c !== "全部") {
    list = list.filter((item) => item.chip === c || (c === "热门" && ["double", "thick", "ticket", "rounded"].includes(item.id)));
  }
  const q = String(query || "").trim().toLowerCase();
  if (q) list = list.filter((item) => item.label.includes(q) || item.id.includes(q));
  return list;
}

function borderById(id) {
  return BORDER_CATALOG.find((item) => item.id === id) || BORDER_CATALOG[0];
}

/**
 * Draw border into a rect (x,y,w,h) in canvas pixels. strokeStyle/lineWidth already set by caller optional.
 */
function drawBorderStyle(ctx, styleId, x, y, w, h, linePx) {
  const lw = Math.max(1, linePx || 2);
  ctx.save();
  ctx.strokeStyle = ctx.strokeStyle || "#000";
  ctx.fillStyle = ctx.fillStyle || "#000";
  ctx.lineWidth = lw;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const style = styleId || "simple";
  const inset = lw * 1.5;

  if (style === "h_line" || style === "solid_line") {
    const mid = y + h / 2;
    ctx.beginPath();
    ctx.moveTo(x, mid);
    ctx.lineTo(x + w, mid);
    ctx.stroke();
  } else if (style === "h_dash" || style === "dash_line") {
    const mid = y + h / 2;
    ctx.setLineDash([lw * 3, lw * 2]);
    ctx.beginPath();
    ctx.moveTo(x, mid);
    ctx.lineTo(x + w, mid);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (style === "double") {
    ctx.strokeRect(x + lw, y + lw, w - lw * 2, h - lw * 2);
    ctx.strokeRect(x + lw * 3.5, y + lw * 3.5, Math.max(1, w - lw * 7), Math.max(1, h - lw * 7));
  } else if (style === "thick") {
    ctx.lineWidth = lw * 2.2;
    ctx.strokeRect(x + lw, y + lw, w - lw * 2, h - lw * 2);
  } else if (style === "dashed") {
    ctx.setLineDash([lw * 3, lw * 2]);
    ctx.strokeRect(x + lw, y + lw, w - lw * 2, h - lw * 2);
    ctx.setLineDash([]);
  } else if (style === "rounded") {
    const r = Math.min(w, h) * 0.12;
    roundRect(ctx, x + lw, y + lw, w - lw * 2, h - lw * 2, r);
    ctx.stroke();
  } else if (style === "ticket") {
    const r = Math.min(w, h) * 0.08;
    roundRect(ctx, x + lw, y + lw, w - lw * 2, h - lw * 2, r);
    ctx.stroke();
    const notch = Math.min(h * 0.12, 8);
    ctx.beginPath();
    ctx.arc(x + lw, y + h / 2, notch, -Math.PI / 2, Math.PI / 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + w - lw, y + h / 2, notch, Math.PI / 2, -Math.PI / 2);
    ctx.fill();
    ctx.stroke();
  } else if (style === "badge") {
    ctx.strokeRect(x + lw, y + lw, w - lw * 2, h - lw * 2);
    ctx.fillRect(x + lw, y + lw, w - lw * 2, Math.min(h * 0.22, 14));
  } else if (style === "stamp") {
    ctx.setLineDash([lw * 2, lw]);
    ctx.strokeRect(x + lw * 2, y + lw * 2, w - lw * 4, h - lw * 4);
    ctx.setLineDash([]);
    ctx.strokeRect(x + lw, y + lw, w - lw * 2, h - lw * 2);
  } else if (style === "ornament") {
    ctx.strokeRect(x + inset * 2, y + inset * 2, w - inset * 4, h - inset * 4);
    // corner flourishes
    const c = Math.min(w, h) * 0.18;
    drawCornerFlourish(ctx, x + inset, y + inset, c, 0);
    drawCornerFlourish(ctx, x + w - inset, y + inset, c, 1);
    drawCornerFlourish(ctx, x + w - inset, y + h - inset, c, 2);
    drawCornerFlourish(ctx, x + inset, y + h - inset, c, 3);
  } else if (style === "wave") {
    const mid = y + h * 0.55;
    ctx.beginPath();
    ctx.moveTo(x, mid);
    const amp = h * 0.15;
    const periods = 4;
    for (let i = 0; i <= 40; i += 1) {
      const t = i / 40;
      const px = x + t * w;
      const py = mid + Math.sin(t * Math.PI * periods) * amp;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  } else if (style === "hearts") {
    const n = 3;
    for (let i = 0; i < n; i += 1) {
      const cx = x + ((i + 1) / (n + 1)) * w;
      const cy = y + h * 0.45;
      drawHeart(ctx, cx, cy, Math.min(w, h) * 0.12);
    }
  } else if (style === "circle_dots") {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const R = Math.min(w, h) * 0.38;
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * Math.PI * 2;
      const dx = cx + Math.cos(a) * R;
      const dy = cy + Math.sin(a) * R;
      ctx.beginPath();
      ctx.arc(dx, dy, Math.max(1.2, lw * 0.9), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (style === "chinese") {
    ctx.strokeRect(x + lw, y + lw, w - lw * 2, h - lw * 2);
    const m = Math.min(w, h) * 0.18;
    // simple meander corners
    for (const [ox, oy, sx, sy] of [[1,1,1,1],[0,1,-1,1],[0,0,-1,-1],[1,0,1,-1]]) {
      const cx = ox ? x + w - lw : x + lw;
      const cy = oy ? y + h - lw : y + lw;
      ctx.beginPath();
      ctx.moveTo(cx, cy + sy * m);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + sx * m, cy);
      ctx.stroke();
    }
  } else if (style === "cloud") {
    const cy = y + h / 2;
    ctx.beginPath();
    for (let i = 0; i <= 24; i += 1) {
      const t = i / 24;
      const px = x + t * w;
      const py = cy + Math.sin(t * Math.PI * 3) * (h * 0.12) - Math.abs(Math.sin(t * Math.PI * 1.5)) * (h * 0.08);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  } else if (style === "paw") {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const s = Math.min(w, h) * 0.2;
    ctx.beginPath();
    ctx.ellipse(cx, cy + s * 0.3, s * 0.9, s * 0.7, 0, 0, Math.PI * 2);
    ctx.stroke();
    for (const [dx, dy] of [[-s, -s * 0.6], [-s * 0.35, -s], [s * 0.35, -s], [s, -s * 0.6]]) {
      ctx.beginPath();
      ctx.ellipse(cx + dx, cy + dy, s * 0.28, s * 0.35, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (style === "bone") {
    const mid = y + h / 2;
    ctx.lineWidth = lw * 1.5;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.2, mid);
    ctx.lineTo(x + w * 0.8, mid);
    ctx.stroke();
    for (const side of [0.18, 0.82]) {
      const bx = x + w * side;
      ctx.beginPath();
      ctx.arc(bx, mid - lw * 2, lw * 2.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(bx, mid + lw * 2, lw * 2.2, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (style === "corner") {
    const c = Math.min(w, h) * 0.22;
    drawCornerFlourish(ctx, x + inset, y + inset, c, 0);
    drawCornerFlourish(ctx, x + w - inset, y + inset, c, 1);
    drawCornerFlourish(ctx, x + w - inset, y + h - inset, c, 2);
    drawCornerFlourish(ctx, x + inset, y + h - inset, c, 3);
  } else if (style === "inset") {
    ctx.strokeRect(x + lw, y + lw, w - lw * 2, h - lw * 2);
    ctx.strokeRect(x + lw * 4, y + lw * 4, Math.max(1, w - lw * 8), Math.max(1, h - lw * 8));
  } else {
    // simple
    ctx.strokeRect(x + lw, y + lw, w - lw * 2, h - lw * 2);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawCornerFlourish(ctx, x, y, size, corner) {
  // corner: 0 TL 1 TR 2 BR 3 BL
  ctx.beginPath();
  if (corner === 0) {
    ctx.moveTo(x, y + size);
    ctx.lineTo(x, y);
    ctx.lineTo(x + size, y);
  } else if (corner === 1) {
    ctx.moveTo(x - size, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + size);
  } else if (corner === 2) {
    ctx.moveTo(x, y - size);
    ctx.lineTo(x, y);
    ctx.lineTo(x - size, y);
  } else {
    ctx.moveTo(x + size, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y - size);
  }
  ctx.stroke();
}

function drawHeart(ctx, cx, cy, s) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.35);
  ctx.bezierCurveTo(cx - s, cy - s * 0.2, cx - s * 0.5, cy - s, cx, cy - s * 0.45);
  ctx.bezierCurveTo(cx + s * 0.5, cy - s, cx + s, cy - s * 0.2, cx, cy + s * 0.35);
  ctx.stroke();
}

module.exports = {
  BORDER_CATALOG,
  BORDER_CHIPS,
  borderById,
  bordersForChip,
  drawBorderStyle
};
