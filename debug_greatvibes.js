// Debug: test with Great Vibes cursive font
var { createCanvas, registerFont } = require("canvas");
var fs = require("fs");

registerFont("/tmp/GreatVibes-Regular.ttf", { family: "Great Vibes" });

var text = "Willkommen";
var fontFamily = "Great Vibes";
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
console.log("fontSize:", fontSize.toFixed(1));

// Draw base
ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, cw, ch);
ctx.beginPath(); ctx.ellipse(ecx, ecy, erx, ery, 0, 0, 2 * Math.PI);
ctx.fillStyle = "#000000"; ctx.fill();
ctx.beginPath(); ctx.ellipse(ecx, ecy, irx, iry, 0, 0, 2 * Math.PI);
ctx.fillStyle = "#ffffff"; ctx.fill();
ctx.fillStyle = "#000000"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
ctx.font = fontWeight + " " + fontSize + "px " + fontFamily;
ctx.fillText(text, ecx, ecy);

// Hybrid connector logic with connection skip
var bridgeH = Math.max(4, Math.round(fontSize * 0.06));
var bY = Math.round(ecy - bridgeH / 2);
var textMW = ctx.measureText(text).width;
var textStartX = ecx - textMW / 2;
var inkOverlap = Math.max(3, Math.round(fontSize * 0.03));

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

var connScanH = Math.max(6, Math.round(fontSize * 0.2));
var connScanTop = Math.max(0, Math.round(ecy - connScanH / 2));
var connScanActH = Math.min(ch - connScanTop, connScanH);
var connScanData = ctx.getImageData(0, connScanTop, cw, connScanActH);
function isConnectedAt(x) {
  if (x < 0 || x >= cw) return false;
  for (var r = 0; r < connScanActH; r++) {
    if (connScanData.data[(r * cw + x) * 4] < 128) return true;
  }
  return false;
}

var gapBridges = [];

for (var ci = 1; ci < text.length; ci++) {
  var prefW = ctx.measureText(text.substring(0, ci)).width;
  var bndX = Math.round(textStartX + prefW);

  if (isConnectedAt(bndX)) {
    console.log("'" + text[ci-1] + "|" + text[ci] + "' bnd=" + bndX + " -> CONNECTED, skip");
    continue;
  }

  var leftInk = bndX;
  while (leftInk > 0 && !hasInkAt(leftInk)) leftInk--;
  var rightInk = bndX;
  while (rightInk < cw - 1 && !hasInkAt(rightInk)) rightInk++;
  var bx = leftInk - inkOverlap;
  var bx2 = rightInk + inkOverlap;
  var bwidth = bx2 - bx;
  if (bwidth > 0) {
    ctx.fillRect(bx, bY, bwidth, bridgeH);
    gapBridges.push([bx, bY, bwidth, bridgeH]);
    console.log("'" + text[ci-1] + "|" + text[ci] + "' bnd=" + bndX + " ink=" + leftInk + ".." + rightInk + " -> BRIDGE (" + bwidth + "px)");
  }
}

// Ring bridges
var ringInnerLeft = Math.round(ecx - irx);
var ringInnerRight = Math.round(ecx + irx);
var leftTextInk = Math.round(textStartX);
while (leftTextInk < ecx && !hasInkAt(leftTextInk)) leftTextInk++;
var leftRingInk = ringInnerLeft;
while (leftRingInk > 0 && !hasInkAt(leftRingInk)) leftRingInk--;
if (leftTextInk > leftRingInk + 3) {
  var lbx = leftRingInk - inkOverlap;
  var lbw = leftTextInk + inkOverlap - lbx;
  ctx.fillRect(lbx, bY, lbw, bridgeH);
  gapBridges.push([lbx, bY, lbw, bridgeH]);
  console.log("Left ring bridge (" + lbw + "px)");
}
var rightTextInk = Math.round(textStartX + textMW);
while (rightTextInk > ecx && !hasInkAt(rightTextInk)) rightTextInk--;
var rightRingInk = ringInnerRight;
while (rightRingInk < cw - 1 && !hasInkAt(rightRingInk)) rightRingInk++;
if (rightTextInk < rightRingInk - 3) {
  var rbx = rightTextInk - inkOverlap;
  var rbw = rightRingInk + inkOverlap - rbx;
  ctx.fillRect(rbx, bY, rbw, bridgeH);
  gapBridges.push([rbx, bY, rbw, bridgeH]);
  console.log("Right ring bridge (" + rbw + "px)");
}

console.log("Total bridges:", gapBridges.length);

// Save with RED bridges for visibility
ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, cw, ch);
ctx.beginPath(); ctx.ellipse(ecx, ecy, erx, ery, 0, 0, 2 * Math.PI);
ctx.fillStyle = "#555555"; ctx.fill();
ctx.beginPath(); ctx.ellipse(ecx, ecy, irx, iry, 0, 0, 2 * Math.PI);
ctx.fillStyle = "#ffffff"; ctx.fill();
ctx.fillStyle = "#000000"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
ctx.font = fontWeight + " " + fontSize + "px " + fontFamily;
ctx.fillText(text, ecx, ecy);
ctx.fillStyle = "#ff0000";
for (var bi = 0; bi < gapBridges.length; bi++) {
  var b = gapBridges[bi];
  ctx.fillRect(b[0], b[1], b[2], b[3]);
}

fs.writeFileSync("debug_greatvibes.png", cv.toBuffer("image/png"));
console.log("Saved debug_greatvibes.png");
