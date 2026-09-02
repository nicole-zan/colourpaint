const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const statusEl = document.getElementById("status");
const sizeInput = document.getElementById("brush-size");
const sizeLabel = document.getElementById("size-label");
const fgSwatch = document.getElementById("fg-swatch");
const bgSwatch = document.getElementById("bg-swatch");
const paletteEl = document.getElementById("palette");
const customColor = document.getElementById("custom-color");
const fileInput = document.getElementById("file-input");
const titleEl = document.getElementById("window-title");

const COLORS = [
  "#000000", "#808080", "#800000", "#808000", "#008000", "#008080", "#000080",
  "#800080", "#808040", "#004040", "#0080ff", "#004080", "#8000ff", "#804000",
  "#ffffff", "#c0c0c0", "#ff0000", "#ffff00", "#00ff00", "#00ffff", "#0000ff",
  "#ff00ff", "#ffff80", "#00ff80", "#80ffff", "#8080ff", "#ff0080", "#ff8040",
];

const TOOL_NAMES = {
  pencil: "Pencil",
  brush: "Brush",
  eraser: "Eraser",
  fill: "Fill",
  line: "Line",
  rect: "Rectangle",
  ellipse: "Ellipse",
  picker: "Color picker",
};

let tool = "pencil";
let fg = "#000000";
let bg = "#ffffff";
let size = 3;
let drawing = false;
let strokeColor = "#000000";
let strokeButton = 0;
let startX = 0;
let startY = 0;
let snapshot = null;
const APP_NAME = "nicolezan-colourpaint";
let fileName = "untitled";
const undoStack = [];
const redoStack = [];
const MAX_HISTORY = 30;

function fillWhite() {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function pos(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.floor(((event.clientX - rect.left) * canvas.width) / rect.width),
    y: Math.floor(((event.clientY - rect.top) * canvas.height) / rect.height),
  };
}

function colorForButton(button) {
  if (tool === "eraser") return "#ffffff";
  return button === 2 ? bg : fg;
}

function setStroke(color) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = tool === "pencil" ? Math.max(1, size / 2) : size;
  ctx.lineCap = tool === "pencil" ? "butt" : "round";
  ctx.lineJoin = "round";
}

function pushHistory() {
  undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack.length = 0;
}

function restore(data) {
  ctx.putImageData(data, 0, 0);
}

function hexFromPixel(r, g, b) {
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

function colorsMatch(data, i, r, g, b) {
  return data[i] === r && data[i + 1] === g && data[i + 2] === b;
}

function floodFill(x, y, hex) {
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = image;
  const start = (y * width + x) * 4;
  const tr = data[start];
  const tg = data[start + 1];
  const tb = data[start + 2];
  const fillR = parseInt(hex.slice(1, 3), 16);
  const fillG = parseInt(hex.slice(3, 5), 16);
  const fillB = parseInt(hex.slice(5, 7), 16);
  if (tr === fillR && tg === fillG && tb === fillB) return;

  const stack = [[x, y]];
  while (stack.length) {
    const [cx, cy] = stack.pop();
    if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
    const i = (cy * width + cx) * 4;
    if (!colorsMatch(data, i, tr, tg, tb)) continue;
    data[i] = fillR;
    data[i + 1] = fillG;
    data[i + 2] = fillB;
    data[i + 3] = 255;
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  ctx.putImageData(image, 0, 0);
}

function drawShape(x, y, color) {
  if (!snapshot) return;
  ctx.putImageData(snapshot, 0, 0);
  setStroke(color);
  if (tool === "line") {
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(x, y);
    ctx.stroke();
    return;
  }
  const w = x - startX;
  const h = y - startY;
  if (tool === "rect") {
    ctx.strokeRect(startX + 0.5, startY + 0.5, w, h);
  } else if (tool === "ellipse") {
    ctx.beginPath();
    ctx.ellipse(startX + w / 2, startY + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function updateStatus() {
  statusEl.textContent = `${TOOL_NAMES[tool]} · left click draws, right click uses the background color`;
}

function setFg(color) {
  fg = color;
  fgSwatch.style.background = color;
  customColor.value = color;
}

function setBg(color) {
  bg = color;
  bgSwatch.style.background = color;
}

function setTitle(name) {
  fileName = name;
  const label = fileName === "untitled" ? APP_NAME : `${fileName} — ${APP_NAME}`;
  titleEl.textContent = label;
  document.title = label;
}

paletteEl.innerHTML = COLORS.map(
  (c) => `<button type="button" style="background:${c}" data-color="${c}" title="${c}"></button>`
).join("");

paletteEl.addEventListener("mousedown", (event) => {
  const btn = event.target.closest("button");
  if (!btn) return;
  event.preventDefault();
  if (event.button === 2) setBg(btn.dataset.color);
  else setFg(btn.dataset.color);
});
paletteEl.addEventListener("contextmenu", (e) => e.preventDefault());

document.querySelectorAll(".tool").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelector(".tool.active").classList.remove("active");
    btn.classList.add("active");
    tool = btn.dataset.tool;
    updateStatus();
  });
});

sizeInput.addEventListener("input", () => {
  size = Number(sizeInput.value);
  sizeLabel.textContent = String(size);
});

customColor.addEventListener("input", () => setFg(customColor.value));
fgSwatch.addEventListener("click", () => customColor.click());

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

canvas.addEventListener("pointerdown", (event) => {
  if (drawing) return;

  canvas.setPointerCapture(event.pointerId);
  const { x, y } = pos(event);
  const color = colorForButton(event.button);

  if (tool === "picker") {
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const hex = hexFromPixel(pixel[0], pixel[1], pixel[2]);
    if (event.button === 2) setBg(hex);
    else setFg(hex);
    return;
  }

  if (tool === "fill") {
    pushHistory();
    floodFill(x, y, color);
    return;
  }

  drawing = true;
  strokeButton = event.button;
  strokeColor = color;
  startX = x;
  startY = y;
  pushHistory();

  if (tool === "line" || tool === "rect" || tool === "ellipse") {
    snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return;
  }

  setStroke(strokeColor);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 0.01, y + 0.01);
  ctx.stroke();
});

canvas.addEventListener("pointermove", (event) => {
  if (!drawing) return;
  const { x, y } = pos(event);
  if (tool === "line" || tool === "rect" || tool === "ellipse") {
    drawShape(x, y, strokeColor);
    return;
  }
  setStroke(strokeColor);
  ctx.lineTo(x, y);
  ctx.stroke();
});

function endStroke(event) {
  if (!drawing) return;
  if (event && event.type === "pointerup" && event.button !== strokeButton) return;
  drawing = false;
  snapshot = null;
  if (event) {
    try {
      canvas.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
  }
}

canvas.addEventListener("pointerup", endStroke);
canvas.addEventListener("pointercancel", endStroke);

document.getElementById("btn-undo").addEventListener("click", () => {
  if (!undoStack.length) return;
  redoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  restore(undoStack.pop());
});

document.getElementById("btn-redo").addEventListener("click", () => {
  if (!redoStack.length) return;
  undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  restore(redoStack.pop());
});

document.getElementById("btn-clear").addEventListener("click", () => {
  pushHistory();
  fillWhite();
});

document.getElementById("btn-new").addEventListener("click", () => {
  pushHistory();
  fillWhite();
  setTitle("untitled");
});

document.getElementById("btn-save").addEventListener("click", () => {
  const link = document.createElement("a");
  const name = fileName.endsWith(".png") ? fileName : `${fileName}.png`;
  link.download = name;
  link.href = canvas.toDataURL("image/png");
  link.click();
});

document.getElementById("btn-open").addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  const bitmap = await createImageBitmap(file);
  pushHistory();
  fillWhite();
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  setTitle(file.name.replace(/\.[^.]+$/, "") || "untitled");
  fileInput.value = "";
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    document.getElementById(event.shiftKey ? "btn-redo" : "btn-undo").click();
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    document.getElementById("btn-save").click();
  }
});

fillWhite();
setFg("#000000");
setBg("#ffffff");
updateStatus();
