var { createCanvas, registerFont } = require("canvas");
var fs = require("fs");
registerFont("/tmp/GreatVibes-Regular.ttf", { family: "Great Vibes" });

var text = "Willkommen";
var fontFamily = "Great Vibes";
var cw = 800, ch = Math.round(800 / 1.3);
var cv = createCanvas(cw, ch);
var ctx = cv.getContext("2d");
var ecx = cw / 2, ecy = ch / 2;
var erx = cw / 2 - 20, ery = ch / 2 - 20;
var borderPx = 5.0 * 4;
var irx = erx - borderPx, iry = ery - borderPx;

var availW = 2 * irx * 1.1;
var lo = 8, hi = 500;
for (var i = 0; i < 25; i++) {
  var mid = (lo + hi) / 2;
  ctx.font = "normal " + mid + "px Great Vibes";
  if (ctx.measureText(text).width < availW) lo = mid; else hi = mid;
}
var fontSize = Math.max(16, Math.min((lo+hi)/2, iry*1.5));

// Draw with red bridges
ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, cw, ch);
ctx.beginPath(); ctx.ellipse(ecx, ecy, erx, ery, 0, 0, 2*Math.PI);
ctx.fillStyle = "#000000"; ctx.fill();
ctx.beginPath(); ctx.ellipse(ecx, ecy, irx, iry, 0, 0, 2*Math.PI);
ctx.fillStyle = "#ffffff"; ctx.fill();
ctx.fillStyle = "#000000"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
ctx.font = "normal " + fontSize + "px Great Vibes";
ctx.fillText(text, ecx, ecy);

// Zoom: left and right edges
var zoom = 3;
var cropH = Math.round(fontSize * 1.4);
var cropY = Math.round(ecy - fontSize * 0.7);

var cv1 = createCanvas(250 * zoom, cropH * zoom);
var c1 = cv1.getContext("2d"); c1.imageSmoothingEnabled = false;
c1.drawImage(cv, 0, cropY, 250, cropH, 0, 0, 250*zoom, cropH*zoom);
fs.writeFileSync("debug_gv_left.png", cv1.toBuffer("image/png"));

var cv2 = createCanvas(250 * zoom, cropH * zoom);
var c2 = cv2.getContext("2d"); c2.imageSmoothingEnabled = false;
c2.drawImage(cv, 550, cropY, 250, cropH, 0, 0, 250*zoom, cropH*zoom);
fs.writeFileSync("debug_gv_right.png", cv2.toBuffer("image/png"));

// Middle section with the 2 bridges
var cv3 = createCanvas(300 * zoom, cropH * zoom);
var c3 = cv3.getContext("2d"); c3.imageSmoothingEnabled = false;
c3.drawImage(cv, 250, cropY, 300, cropH, 0, 0, 300*zoom, cropH*zoom);
fs.writeFileSync("debug_gv_middle.png", cv3.toBuffer("image/png"));

console.log("Saved zoom images");
