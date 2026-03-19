// Debug: produces a zoomed crop of the connector area
var { createCanvas } = require("canvas");
var fs = require("fs");

async function main() {
  var text = "Willkommen";
  var fontFamily = "DejaVu Sans";
  var fontWeight = "normal";
  var ellipseRatio = 1.3;
  var borderThickness = 5.0;
  var textOverlap = 1.1;
  var textYOffset = 0;

  var cw = 800;
  var ch = Math.max(400, Math.round(800 / ellipseRatio));
  var cv = createCanvas(cw, ch);
  var ctx = cv.getContext("2d");

  var ecx = cw / 2;
  var ecy = ch / 2 + textYOffset * 2;
  var margin = 20;
  var erx = cw / 2 - margin;
  var ery = ch / 2 - margin;
  var borderPx = borderThickness * 4;
  var irx = Math.max(1, erx - borderPx);
  var iry = Math.max(1, ery - borderPx);

  var availW = 2 * irx * textOverlap;
  var lo = 8, hi = 500;
  for (var i = 0; i < 25; i++) {
    var mid = (lo + hi) / 2;
    ctx.font = fontWeight + " " + mid + "px " + fontFamily;
    if (ctx.measureText(text).width < availW) lo = mid; else hi = mid;
  }
  var fontSize = (lo + hi) / 2;
  fontSize = Math.max(16, Math.min(fontSize, iry * 1.5));

  // Draw just the black version with bridges
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, cw, ch);
  ctx.beginPath();
  ctx.ellipse(ecx, ecy, erx, ery, 0, 0, 2 * Math.PI);
  ctx.fillStyle = "#000000";
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(ecx, ecy, irx, iry, 0, 0, 2 * Math.PI);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = fontWeight + " " + fontSize + "px " + fontFamily;
  ctx.fillText(text, ecx, ecy);

  // Run connector logic
  var bridgeH = Math.max(4, Math.round(fontSize * 0.06));
  var bridgeOverlap = Math.max(6, Math.round(fontSize * 0.25));
  var fullLeft = Math.max(0, Math.floor(ecx - erx - 5));
  var fullRight = Math.min(cw, Math.ceil(ecx + erx + 5));
  var fullW = fullRight - fullLeft;
  var bandH = Math.max(10, Math.round(fontSize * 0.9));
  var bandTop = Math.max(0, Math.round(ecy - bandH / 2));
  var bandActH = Math.min(ch - bandTop, bandH);
  var bY = Math.round(ecy - bridgeH / 2);

  var fd = ctx.getImageData(fullLeft, bandTop, fullW, bandActH);
  var colDark = new Uint8Array(fullW);
  for (var c = 0; c < fullW; c++) {
    for (var r = 0; r < bandActH; r++) {
      if (fd.data[(r * fullW + c) * 4] < 128) { colDark[c] = 1; break; }
    }
  }

  // Draw bridges in RED so they're clearly visible
  var gapBridges = [];
  var inGap = false, gapStart = 0;
  for (var c = 0; c <= fullW; c++) {
    var dark = c < fullW ? colDark[c] : 1;
    if (!dark && !inGap) { inGap = true; gapStart = c; }
    else if (dark && inGap) {
      inGap = false;
      if (gapStart > 0 && c < fullW) {
        var gX = fullLeft + gapStart - bridgeOverlap;
        var gW = (c - gapStart) + bridgeOverlap * 2;
        ctx.fillStyle = "#ff0000";
        ctx.fillRect(gX, bY, gW, bridgeH);
        gapBridges.push([gX, bY, gW, bridgeH]);
      }
    }
  }

  // Crop around the k-o area (approximately 40-65% of canvas width, vertically centered)
  var cropX = Math.round(cw * 0.35);
  var cropW = Math.round(cw * 0.35);
  var cropY = Math.round(ecy - fontSize * 0.6);
  var cropH = Math.round(fontSize * 1.2);

  // Create zoomed output (4x)
  var zoom = 4;
  var outCv = createCanvas(cropW * zoom, cropH * zoom);
  var outCtx = outCv.getContext("2d");
  outCtx.imageSmoothingEnabled = false;
  outCtx.drawImage(cv, cropX, cropY, cropW, cropH, 0, 0, cropW * zoom, cropH * zoom);

  fs.writeFileSync("debug_zoom.png", outCv.toBuffer("image/png"));
  console.log("Saved debug_zoom.png (4x zoom of k-o-m area)");
  console.log("Bridge Y:", bY, "to", bY + bridgeH);
  console.log("Bridges (red):", gapBridges.length);
}

main().catch(function(e) { console.error(e); process.exit(1); });
