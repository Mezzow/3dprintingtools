// Debug script: renders the TextCircleTool preview to a PNG file
var { createCanvas } = require("canvas");
var fs = require("fs");

async function main() {
  var outputFile = process.argv[2] || "debug_preview.png";

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
  console.log("fontSize:", fontSize.toFixed(1));

  var drawBase = function(ringColor, textColor) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cw, ch);
    ctx.beginPath();
    ctx.ellipse(ecx, ecy, erx, ery, 0, 0, 2 * Math.PI);
    ctx.fillStyle = ringColor;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(ecx, ecy, irx, iry, 0, 0, 2 * Math.PI);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.fillStyle = textColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = fontWeight + " " + fontSize + "px " + fontFamily;
    ctx.fillText(text, ecx, ecy);
  };

  drawBase("#000000", "#000000");

  // === CONNECTOR LOGIC ===
  var bridgeH = Math.max(4, Math.round(fontSize * 0.06));
  // Generous overlap — since bridges are same color as letters, overlap is invisible
  var bridgeOverlap = Math.max(6, Math.round(fontSize * 0.25));

  var fullLeft = Math.max(0, Math.floor(ecx - erx - 5));
  var fullRight = Math.min(cw, Math.ceil(ecx + erx + 5));
  var fullW = fullRight - fullLeft;
  // Tall band (90% font height): internal features like "o" holes have dark pixels
  // at top/bottom arcs, so those columns stay dark and don't create false gaps
  var bandH = Math.max(10, Math.round(fontSize * 0.9));
  var bandTop = Math.max(0, Math.round(ecy - bandH / 2));
  var bandActH = Math.min(ch - bandTop, bandH);

  console.log("bridgeH:", bridgeH, "bridgeOverlap:", bridgeOverlap);

  var gapBridges = [];
  if (fullW > 0 && bandActH > 0) {
    var fd = ctx.getImageData(fullLeft, bandTop, fullW, bandActH);
    var colDark = new Uint8Array(fullW);
    for (var c = 0; c < fullW; c++) {
      for (var r = 0; r < bandActH; r++) {
        if (fd.data[(r * fullW + c) * 4] < 128) { colDark[c] = 1; break; }
      }
    }

    ctx.fillStyle = "#000000";
    var inGap = false, gapStart = 0;
    for (var c = 0; c <= fullW; c++) {
      var dark = c < fullW ? colDark[c] : 1;
      if (!dark && !inGap) { inGap = true; gapStart = c; }
      else if (dark && inGap) {
        inGap = false;
        if (gapStart > 0 && c < fullW) {
          var gX = fullLeft + gapStart - bridgeOverlap;
          var gW = (c - gapStart) + bridgeOverlap * 2;
          var gY = Math.round(ecy - bridgeH / 2);
          ctx.fillRect(gX, gY, gW, bridgeH);
          gapBridges.push([gX, gY, gW, bridgeH]);
          console.log("Gap col " + gapStart + "-" + (c-1) + " (w=" + (c-gapStart) + ") -> rect(" + gX + "," + gY + "," + gW + "," + bridgeH + ")");
        }
      }
    }
  }

  console.log("Total bridges:", gapBridges.length);

  // === PREVIEW ===
  drawBase("#555555", "#000000");
  ctx.fillStyle = "#000000";
  for (var bi = 0; bi < gapBridges.length; bi++) {
    var b = gapBridges[bi];
    ctx.fillRect(b[0], b[1], b[2], b[3]);
  }
  ctx.beginPath();
  ctx.ellipse(ecx, ecy, erx, ery, 0, 0, 2 * Math.PI);
  ctx.strokeStyle = "#444444";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(ecx, ecy, irx, iry, 0, 0, 2 * Math.PI);
  ctx.stroke();

  fs.writeFileSync(outputFile, cv.toBuffer("image/png"));
  console.log("Saved:", outputFile);
}

main().catch(function(e) { console.error(e); process.exit(1); });
