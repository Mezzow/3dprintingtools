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

// Connection detection: scan full text height, trace ink in both directions
// A real connection has ink extending into BOTH adjacent letters from boundary
var connBandH = Math.max(10, Math.round(fontSize * 0.9));
var connBandTop = Math.max(0, Math.round(ecy - connBandH / 2));
var connBandActH = Math.min(ch - connBandTop, connBandH);
var connBandData = ctx.getImageData(0, connBandTop, cw, connBandActH);
// Flood-fill connected component analysis
// Build binary grid from connBand: 1 = ink, 0 = white
var connGrid = new Uint8Array(cw * connBandActH);
for (var gi = 0; gi < cw * connBandActH; gi++) {
  connGrid[gi] = connBandData.data[gi * 4] < 128 ? 1 : 0;
}

// Flood fill from a seed point, return set of visited pixel indices
function floodFillFrom(seedX, seedY) {
  var labels = new Int32Array(cw * connBandActH);
  if (seedX < 0 || seedX >= cw || seedY < 0 || seedY >= connBandActH) return labels;
  if (!connGrid[seedY * cw + seedX]) return labels;
  var stack = [seedX, seedY];
  labels[seedY * cw + seedX] = 1;
  while (stack.length > 0) {
    var sy = stack.pop();
    var sx = stack.pop();
    var neighbors = [[-1,0],[1,0],[0,-1],[0,1]];
    for (var ni = 0; ni < 4; ni++) {
      var nx = sx + neighbors[ni][0];
      var ny = sy + neighbors[ni][1];
      if (nx >= 0 && nx < cw && ny >= 0 && ny < connBandActH && connGrid[ny * cw + nx] && !labels[ny * cw + nx]) {
        labels[ny * cw + nx] = 1;
        stack.push(nx, ny);
      }
    }
  }
  return labels;
}

// Find a seed point inside a character: scan columns near the char center
function findSeed(centerX) {
  var x = Math.round(centerX);
  for (var dx = 0; dx <= 30; dx++) {
    for (var sign = -1; sign <= 1; sign += 2) {
      var px = x + sign * dx;
      if (px < 0 || px >= cw) continue;
      for (var r = 0; r < connBandActH; r++) {
        if (connGrid[r * cw + px]) return [px, r];
      }
    }
  }
  return null;
}

// Compute character center positions
var charCenters = [];
var cumW = 0;
for (var ci2 = 0; ci2 < text.length; ci2++) {
  var cw2 = ctx.measureText(text[ci2]).width;
  charCenters.push(textStartX + cumW + cw2 / 2);
  cumW += cw2;
}

// Flood fill from first character's seed
var seed0 = findSeed(charCenters[0]);
var reachable = seed0 ? floodFillFrom(seed0[0], seed0[1]) : new Int32Array(cw * connBandActH);
console.log("Seed from '" + text[0] + "' at (" + (seed0 ? seed0[0] + "," + seed0[1] : "none") + ")");

var gapBridges = [];

for (var ci = 1; ci < text.length; ci++) {
  var prefW = ctx.measureText(text.substring(0, ci)).width;
  var bndX = Math.round(textStartX + prefW);

  // Check if right character is reachable from the first character's component
  var rightSeed = findSeed(charCenters[ci]);
  var isConnected = false;
  if (rightSeed) {
    isConnected = reachable[rightSeed[1] * cw + rightSeed[0]] === 1;
  }

  if (isConnected) {
    console.log("'" + text[ci-1] + "|" + text[ci] + "' bnd=" + bndX + " -> CONNECTED via flood fill, skip");
    continue;
  }
  // Not connected — flood fill from this char and merge reachable set
  if (rightSeed) {
    var newReach = floodFillFrom(rightSeed[0], rightSeed[1]);
    for (var pi = 0; pi < newReach.length; pi++) {
      if (newReach[pi]) reachable[pi] = 1;
    }
  }
  console.log("'" + text[ci-1] + "|" + text[ci] + "' bnd=" + bndX + " NOT connected");
  // Find the gap at bridge height. If boundary is inside ink, walk right
  // to exit the left letter, then find start of right letter.
  var leftInk, rightInk;
  if (hasInkAt(bndX)) {
    // Walk right past left letter body
    leftInk = bndX;
    while (leftInk < cw - 1 && hasInkAt(leftInk)) leftInk++;
    // leftInk is now at first white pixel; walk right to find right letter
    rightInk = leftInk;
    while (rightInk < cw - 1 && !hasInkAt(rightInk)) rightInk++;
    // leftInk should point to the last ink pixel of left letter
    leftInk--;
  } else {
    leftInk = bndX;
    while (leftInk > 0 && !hasInkAt(leftInk)) leftInk--;
    rightInk = bndX;
    while (rightInk < cw - 1 && !hasInkAt(rightInk)) rightInk++;
  }
  var bx = leftInk - inkOverlap;
  var bx2 = rightInk + inkOverlap;
  var bwidth = bx2 - bx;
  if (bwidth > 0) {
    ctx.fillRect(bx, bY, bwidth, bridgeH);
    gapBridges.push([bx, bY, bwidth, bridgeH]);
    console.log("  -> BRIDGE (" + bwidth + "px) ink=" + leftInk + ".." + rightInk);
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
