// Debug: zoomed crop with RED bridges
var { createCanvas } = require("canvas");
var fs = require("fs");

async function main() {
  var text = "Willkommen";
  var fontFamily = "DejaVu Sans";
  var fontWeight = "normal";
  var ellipseRatio = 1.3;
  var borderThickness = 5.0;
  var textOverlap = 1.1;

  var cw = 800, ch = Math.max(400, Math.round(800 / ellipseRatio));
  var cv = createCanvas(cw, ch);
  var ctx = cv.getContext("2d");
  var ecx = cw / 2, ecy = ch / 2;
  var margin = 20;
  var erx = cw / 2 - margin, ery = ch / 2 - margin;
  var borderPx = borderThickness * 4;
  var irx = Math.max(1, erx - borderPx), iry = Math.max(1, ery - borderPx);

  var availW = 2 * irx * textOverlap;
  var lo = 8, hi = 500;
  for (var i = 0; i < 25; i++) {
    var mid = (lo + hi) / 2;
    ctx.font = fontWeight + " " + mid + "px " + fontFamily;
    if (ctx.measureText(text).width < availW) lo = mid; else hi = mid;
  }
  var fontSize = (lo + hi) / 2;
  fontSize = Math.max(16, Math.min(fontSize, iry * 1.5));

  // Draw base
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, cw, ch);
  ctx.beginPath(); ctx.ellipse(ecx, ecy, erx, ery, 0, 0, 2 * Math.PI);
  ctx.fillStyle = "#000000"; ctx.fill();
  ctx.beginPath(); ctx.ellipse(ecx, ecy, irx, iry, 0, 0, 2 * Math.PI);
  ctx.fillStyle = "#ffffff"; ctx.fill();
  ctx.fillStyle = "#000000"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = fontWeight + " " + fontSize + "px " + fontFamily;
  ctx.fillText(text, ecx, ecy);

  var bridgeH = Math.max(4, Math.round(fontSize * 0.06));
  var bY = Math.round(ecy - bridgeH / 2);
  var textW = ctx.measureText(text).width;
  var textStartX = ecx - textW / 2;
  var overlap = Math.max(3, Math.round(fontSize * 0.03));

  var scanRows = Math.max(2, Math.round(bridgeH * 0.6));
  var scanTop = Math.round(ecy - scanRows / 2);
  var scanData = ctx.getImageData(0, scanTop, cw, scanRows);
  function hasInkAt(x) {
    if (x < 0 || x >= cw) return false;
    for (var r = 0; r < scanRows; r++) {
      if (scanData.data[(r * cw + x) * 4] < 128) return true;
    }
    return false;
  }

  ctx.fillStyle = "#ff0000";
  for (var ci = 1; ci < text.length; ci++) {
    var prefW = ctx.measureText(text.substring(0, ci)).width;
    var bndX = Math.round(textStartX + prefW);
    var leftInk = bndX;
    while (leftInk > 0 && !hasInkAt(leftInk)) leftInk--;
    var rightInk = bndX;
    while (rightInk < cw - 1 && !hasInkAt(rightInk)) rightInk++;
    var bx = leftInk - overlap;
    var bx2 = rightInk + overlap;
    ctx.fillRect(bx, bY, bx2 - bx, bridgeH);
  }

  // Zoom crops
  var zoom = 4;
  var cropH = Math.round(fontSize * 1.2);
  var cropY = Math.round(ecy - fontSize * 0.6);
  var cv1 = createCanvas(400 * zoom, cropH * zoom);
  var c1 = cv1.getContext("2d"); c1.imageSmoothingEnabled = false;
  c1.drawImage(cv, 0, cropY, 400, cropH, 0, 0, 400 * zoom, cropH * zoom);
  fs.writeFileSync("debug_zoom_left.png", cv1.toBuffer("image/png"));
  var cv2 = createCanvas(400 * zoom, cropH * zoom);
  var c2 = cv2.getContext("2d"); c2.imageSmoothingEnabled = false;
  c2.drawImage(cv, 400, cropY, 400, cropH, 0, 0, 400 * zoom, cropH * zoom);
  fs.writeFileSync("debug_zoom_right.png", cv2.toBuffer("image/png"));
  console.log("Saved zoom images");
}

main().catch(function(e) { console.error(e); process.exit(1); });
