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

  // === HYBRID CONNECTOR LOGIC ===
  // 1. Use character boundaries to decide WHERE to place bridges
  //    (avoids internal letter features)
  // 2. Use pixel scanning at bridge height to decide HOW FAR to extend
  //    (guarantees connection to actual letter strokes)
  ctx.font = fontWeight + " " + fontSize + "px " + fontFamily;
  var bridgeH = Math.max(4, Math.round(fontSize * 0.06));
  var bY = Math.round(ecy - bridgeH / 2);
  var textW = ctx.measureText(text).width;
  var textStartX = ecx - textW / 2;
  var overlap = Math.max(3, Math.round(fontSize * 0.03)); // px past ink edge

  // Scan a band at bridge height for ink detection
  // Use multiple rows for robustness
  var scanRows = Math.max(2, Math.round(bridgeH * 0.6));
  var scanTop = Math.round(ecy - scanRows / 2);
  var scanData = ctx.getImageData(0, scanTop, cw, scanRows);

  // Check if a column has ink at bridge height
  function hasInkAt(x) {
    if (x < 0 || x >= cw) return false;
    for (var r = 0; r < scanRows; r++) {
      if (scanData.data[(r * cw + x) * 4] < 128) return true;
    }
    return false;
  }

  var gapBridges = [];
  ctx.fillStyle = "#000000";

  for (var ci = 1; ci < text.length; ci++) {
    var prefW = ctx.measureText(text.substring(0, ci)).width;
    var bndX = Math.round(textStartX + prefW);

    // Walk LEFT from boundary to find left letter's ink at bridge height
    var leftInk = bndX;
    while (leftInk > 0 && !hasInkAt(leftInk)) leftInk--;
    // Walk RIGHT from boundary to find right letter's ink at bridge height
    var rightInk = bndX;
    while (rightInk < cw - 1 && !hasInkAt(rightInk)) rightInk++;

    // Bridge: from overlap pixels past left ink to overlap pixels past right ink
    var bx = leftInk - overlap;
    var bx2 = rightInk + overlap;
    var bwidth = bx2 - bx;

    if (bwidth > 0) {
      ctx.fillRect(bx, bY, bwidth, bridgeH);
      gapBridges.push([bx, bY, bwidth, bridgeH]);
      console.log("'" + text[ci-1] + "|" + text[ci] + "' bnd=" + bndX + " ink=" + leftInk + ".." + rightInk + " -> rect(" + bx + "," + bY + "," + bwidth + "," + bridgeH + ")");
    }
  }

  // Text-to-ring bridges
  var ringInnerLeft = Math.round(ecx - irx);
  var ringInnerRight = Math.round(ecx + irx);

  // Left: find leftmost text ink, bridge to ring
  var leftTextInk = Math.round(textStartX);
  while (leftTextInk < ecx && !hasInkAt(leftTextInk)) leftTextInk++;
  var leftRingInk = ringInnerLeft;
  while (leftRingInk > 0 && !hasInkAt(leftRingInk)) leftRingInk--;
  if (leftTextInk > leftRingInk + 3) {
    var lbx = leftRingInk - overlap;
    var lbw = leftTextInk + overlap - lbx;
    ctx.fillRect(lbx, bY, lbw, bridgeH);
    gapBridges.push([lbx, bY, lbw, bridgeH]);
    console.log("Left ring bridge: ring=" + leftRingInk + " text=" + leftTextInk + " -> rect(" + lbx + "," + bY + "," + lbw + "," + bridgeH + ")");
  }

  // Right: find rightmost text ink, bridge to ring
  var rightTextInk = Math.round(textStartX + textW);
  while (rightTextInk > ecx && !hasInkAt(rightTextInk)) rightTextInk--;
  var rightRingInk = ringInnerRight;
  while (rightRingInk < cw - 1 && !hasInkAt(rightRingInk)) rightRingInk++;
  if (rightTextInk < rightRingInk - 3) {
    var rbx = rightTextInk - overlap;
    var rbw = rightRingInk + overlap - rbx;
    ctx.fillRect(rbx, bY, rbw, bridgeH);
    gapBridges.push([rbx, bY, rbw, bridgeH]);
    console.log("Right ring bridge: text=" + rightTextInk + " ring=" + rightRingInk + " -> rect(" + rbx + "," + bY + "," + rbw + "," + bridgeH + ")");
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
