import { useState, useRef, useEffect, useCallback } from "react";
import * as THREE from "three";

// =================== GOOGLE FONTS LIST ===================

var FONTS = [
  // Sans-Serif
  { name: "Roboto", family: "'Roboto', sans-serif", url: "Roboto:wght@400;700" },
  { name: "Open Sans", family: "'Open Sans', sans-serif", url: "Open+Sans:wght@400;700" },
  { name: "Montserrat", family: "'Montserrat', sans-serif", url: "Montserrat:wght@400;700;800" },
  { name: "Poppins", family: "'Poppins', sans-serif", url: "Poppins:wght@400;600;700" },
  { name: "Nunito", family: "'Nunito', sans-serif", url: "Nunito:wght@400;700;800" },
  { name: "Raleway", family: "'Raleway', sans-serif", url: "Raleway:wght@400;700" },
  { name: "Oswald", family: "'Oswald', sans-serif", url: "Oswald:wght@400;700" },
  { name: "Lato", family: "'Lato', sans-serif", url: "Lato:wght@400;700" },
  { name: "Inter", family: "'Inter', sans-serif", url: "Inter:wght@400;700" },
  { name: "Quicksand", family: "'Quicksand', sans-serif", url: "Quicksand:wght@400;700" },
  { name: "Comfortaa", family: "'Comfortaa', sans-serif", url: "Comfortaa:wght@400;700" },
  { name: "Josefin Sans", family: "'Josefin Sans', sans-serif", url: "Josefin+Sans:wght@400;700" },
  { name: "Bebas Neue", family: "'Bebas Neue', sans-serif", url: "Bebas+Neue" },
  { name: "Archivo Black", family: "'Archivo Black', sans-serif", url: "Archivo+Black" },
  // Serif
  { name: "Playfair Display", family: "'Playfair Display', serif", url: "Playfair+Display:wght@400;700" },
  { name: "Merriweather", family: "'Merriweather', serif", url: "Merriweather:wght@400;700" },
  { name: "Lora", family: "'Lora', serif", url: "Lora:wght@400;700" },
  { name: "Cinzel", family: "'Cinzel', serif", url: "Cinzel:wght@400;700" },
  { name: "EB Garamond", family: "'EB Garamond', serif", url: "EB+Garamond:wght@400;700" },
  // Display / Decorative
  { name: "Pacifico", family: "'Pacifico', cursive", url: "Pacifico" },
  { name: "Lobster", family: "'Lobster', cursive", url: "Lobster" },
  { name: "Dancing Script", family: "'Dancing Script', cursive", url: "Dancing+Script:wght@400;700" },
  { name: "Caveat", family: "'Caveat', cursive", url: "Caveat:wght@400;700" },
  { name: "Satisfy", family: "'Satisfy', cursive", url: "Satisfy" },
  { name: "Great Vibes", family: "'Great Vibes', cursive", url: "Great+Vibes" },
  { name: "Sacramento", family: "'Sacramento', cursive", url: "Sacramento" },
  { name: "Permanent Marker", family: "'Permanent Marker', cursive", url: "Permanent+Marker" },
  { name: "Bangers", family: "'Bangers', cursive", url: "Bangers" },
  { name: "Righteous", family: "'Righteous', sans-serif", url: "Righteous" },
  { name: "Orbitron", family: "'Orbitron', sans-serif", url: "Orbitron:wght@400;700" },
  { name: "Abril Fatface", family: "'Abril Fatface', serif", url: "Abril+Fatface" },
  { name: "Alfa Slab One", family: "'Alfa Slab One', serif", url: "Alfa+Slab+One" },
  // Handwriting
  { name: "Indie Flower", family: "'Indie Flower', cursive", url: "Indie+Flower" },
  { name: "Shadows Into Light", family: "'Shadows Into Light', cursive", url: "Shadows+Into+Light" },
  { name: "Kalam", family: "'Kalam', cursive", url: "Kalam:wght@400;700" },
  // Monospace
  { name: "Fira Code", family: "'Fira Code', monospace", url: "Fira+Code:wght@400;700" },
  { name: "JetBrains Mono", family: "'JetBrains Mono', monospace", url: "JetBrains+Mono:wght@400;700" },
  { name: "Source Code Pro", family: "'Source Code Pro', monospace", url: "Source+Code+Pro:wght@400;700" },
];

// Load a Google Font dynamically
var loadedFonts = new Set();
function loadFont(font) {
  if (loadedFonts.has(font.name)) return Promise.resolve();
  loadedFonts.add(font.name);
  return new Promise(function(resolve) {
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=" + font.url + "&display=swap";
    link.onload = function() { setTimeout(resolve, 100); };
    link.onerror = resolve;
    document.head.appendChild(link);
  });
}

// =================== CONTOUR EXTRACTION (reused from image tool) ===================

var EDGE_COORDS = function(cx, cy, edge) {
  if (edge === 0) return [cx + 0.5, cy];
  if (edge === 1) return [cx + 1, cy + 0.5];
  if (edge === 2) return [cx + 0.5, cy + 1];
  return [cx, cy + 0.5];
};

var SEG_TABLE = [
  [], [[3,2]], [[2,1]], [[3,1]], [[1,0]], [[3,0],[1,2]], [[2,0]], [[3,0]],
  [[0,3]], [[0,2]], [[0,1],[2,3]], [[0,1]], [[1,3]], [[1,2]], [[2,3]], []
];

function marchingSquares(binary, w, h) {
  var segments = [];
  for (var y = 0; y < h - 1; y++) {
    for (var x = 0; x < w - 1; x++) {
      var tl = binary[y * w + x] ? 1 : 0;
      var tr = binary[y * w + x + 1] ? 1 : 0;
      var br = binary[(y + 1) * w + x + 1] ? 1 : 0;
      var bl = binary[(y + 1) * w + x] ? 1 : 0;
      var idx = (tl << 3) | (tr << 2) | (br << 1) | bl;
      var segs = SEG_TABLE[idx];
      for (var k = 0; k < segs.length; k++) {
        segments.push([EDGE_COORDS(x, y, segs[k][0]), EDGE_COORDS(x, y, segs[k][1])]);
      }
    }
  }
  return segments;
}

function chainSegments(segments) {
  var key = function(p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); };
  var adj = new Map();
  for (var i = 0; i < segments.length; i++) {
    var s = segments[i];
    var k0 = key(s[0]), k1 = key(s[1]);
    if (!adj.has(k0)) adj.set(k0, []);
    if (!adj.has(k1)) adj.set(k1, []);
    adj.get(k0).push({ pt: s[1], idx: i });
    adj.get(k1).push({ pt: s[0], idx: i });
  }
  var used = new Set();
  var contours = [];
  for (var si = 0; si < segments.length; si++) {
    if (used.has(si)) continue;
    var chain = [segments[si][0], segments[si][1]];
    used.add(si);
    var extended = true;
    while (extended) {
      extended = false;
      var tail = key(chain[chain.length - 1]);
      if (adj.has(tail)) {
        var nbrs = adj.get(tail);
        for (var ni = 0; ni < nbrs.length; ni++) {
          if (!used.has(nbrs[ni].idx)) {
            used.add(nbrs[ni].idx);
            chain.push(nbrs[ni].pt);
            extended = true;
            break;
          }
        }
      }
    }
    if (chain.length >= 4) contours.push(chain);
  }
  return contours;
}

function simplifyClosedContour(pts, tol) {
  if (pts.length < 6) return pts;
  var n = pts.length;
  var maxD = 0, maxI = 0;
  for (var i = 0; i < n; i++) {
    var d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]);
    if (d > maxD) { maxD = d; maxI = i; }
  }
  var a1 = pts.slice(0, maxI + 1);
  var a2 = pts.slice(maxI).concat([pts[0]]);
  return douglasPeucker(a1, tol).slice(0, -1).concat(douglasPeucker(a2, tol).slice(0, -1));
}

function douglasPeucker(pts, tol) {
  if (pts.length <= 2) return pts;
  var first = pts[0], last = pts[pts.length - 1];
  var dx = last[0] - first[0], dy = last[1] - first[1];
  var lenSq = dx * dx + dy * dy;
  var maxD = 0, maxI = 0;
  for (var i = 1; i < pts.length - 1; i++) {
    var d;
    if (lenSq === 0) {
      d = Math.hypot(pts[i][0] - first[0], pts[i][1] - first[1]);
    } else {
      var t = ((pts[i][0] - first[0]) * dx + (pts[i][1] - first[1]) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      d = Math.hypot(pts[i][0] - (first[0] + t * dx), pts[i][1] - (first[1] + t * dy));
    }
    if (d > maxD) { maxD = d; maxI = i; }
  }
  if (maxD > tol) {
    var left = douglasPeucker(pts.slice(0, maxI + 1), tol);
    var right = douglasPeucker(pts.slice(maxI), tol);
    return left.slice(0, -1).concat(right);
  }
  return [first, last];
}

function vertexAngle(prev, curr, next) {
  var ax = prev[0]-curr[0], ay = prev[1]-curr[1];
  var bx = next[0]-curr[0], by = next[1]-curr[1];
  var dot = ax*bx+ay*by;
  var cross = ax*by-ay*bx;
  return Math.abs(Math.atan2(cross, dot)) * 180 / Math.PI;
}

function smoothWeighted(pts, sharpAngle) {
  var n = pts.length;
  var out = [];
  for (var i = 0; i < n; i++) {
    var prev = pts[(i - 1 + n) % n];
    var next = pts[(i + 1) % n];
    var angle = vertexAngle(prev, pts[i], next);
    if (angle < sharpAngle) { out.push(pts[i]); continue; }
    out.push([(prev[0]+pts[i][0]+next[0])/3, (prev[1]+pts[i][1]+next[1])/3]);
  }
  return out;
}

function subdivide(pts, sharpAngle) {
  var n = pts.length;
  var out = [];
  for (var i = 0; i < n; i++) {
    var next = pts[(i + 1) % n];
    out.push(pts[i]);
    var angle = vertexAngle(pts[(i-1+n)%n], pts[i], next);
    var angle2 = vertexAngle(pts[i], next, pts[(i+2)%n]);
    if (angle >= sharpAngle && angle2 >= sharpAngle) {
      out.push([0.75*pts[i][0]+0.25*next[0], 0.75*pts[i][1]+0.25*next[1]]);
      out.push([0.25*pts[i][0]+0.75*next[0], 0.25*pts[i][1]+0.75*next[1]]);
    }
  }
  return out;
}

function resampleUniform(pts, spacing) {
  var n = pts.length;
  var perimeter = 0;
  for (var i = 0; i < n; i++) {
    var next = pts[(i+1)%n];
    perimeter += Math.hypot(next[0]-pts[i][0], next[1]-pts[i][1]);
  }
  var count = Math.max(6, Math.round(perimeter / spacing));
  var step = perimeter / count;
  var out = [pts[0]];
  var seg = 0, segOff = 0, acc = 0;
  for (var ci = 1; ci < count; ci++) {
    var target = ci * step;
    while (acc + segLen() - segOff < target && seg < n) {
      acc += segLen() - segOff;
      seg = (seg + 1) % n;
      segOff = 0;
    }
    var rem = target - acc;
    var sl = segLen();
    var t = sl > 0 ? (segOff + rem) / sl : 0;
    var a = pts[seg], b = pts[(seg+1)%n];
    out.push([a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t]);
    segOff += rem;
    acc = target;
  }
  function segLen() {
    var a = pts[seg], b = pts[(seg+1)%n];
    return Math.hypot(b[0]-a[0], b[1]-a[1]);
  }
  return out;
}

function processContour(pts, iters, canvasW, sharpAngle) {
  pts = simplifyClosedContour(pts, 1.2);
  for (var i = 0; i < iters; i++) {
    pts = subdivide(pts, sharpAngle);
    pts = smoothWeighted(pts, sharpAngle);
  }
  var spacing = Math.max(1.5, canvasW / 300);
  pts = resampleUniform(pts, spacing);
  return pts;
}

// =================== MESH GENERATION ===================

function computeNormals(ring) {
  var n = ring.length;
  var normals = [];
  for (var i = 0; i < n; i++) {
    var prev = ring[(i - 1 + n) % n];
    var next = ring[(i + 1) % n];
    var dx = next[0] - prev[0], dy = next[1] - prev[1];
    var len = Math.hypot(dx, dy) || 1;
    normals.push([-dy / len, dx / len]);
  }
  return normals;
}

function generateFrameMesh(contour, scale, wallT, extH, bevelSteps, bevelBottom) {
  var n = contour.length;
  var normals = computeNormals(contour);
  var bevelR = Math.min(wallT * 0.5, extH * 0.45);
  var topZ = extH;
  var halfWall = wallT / 2;

  function bevelProfile(steps) {
    var pts = [];
    for (var i = 0; i <= steps; i++) {
      var a = (Math.PI / 2) * (i / steps);
      pts.push({ dr: bevelR * (1 - Math.cos(a)), dz: bevelR * Math.sin(a) });
    }
    return pts;
  }
  var topBevel = bevelSteps > 0 ? bevelProfile(bevelSteps) : [];
  var botBevel = (bevelSteps > 0 && bevelBottom) ? bevelProfile(bevelSteps) : [];

  var tris = [];
  function tri(a, b, c) { tris.push(a, b, c); }
  function quad(a, b, c, d) { tri(a, b, c); tri(a, c, d); }

  function makeRing(offset, z) {
    var ring = [];
    for (var i = 0; i < n; i++) {
      ring.push([
        (contour[i][0] + normals[i][0] * offset) * scale,
        (contour[i][1] + normals[i][1] * offset) * scale,
        z
      ]);
    }
    return ring;
  }

  function bandRings(r1, r2) {
    for (var i = 0; i < n; i++) {
      var j = (i + 1) % n;
      quad(r1[i], r1[j], r2[j], r2[i]);
    }
  }

  // Build layers for outer wall
  var outerLayers = [];
  if (botBevel.length > 0) {
    for (var bi = botBevel.length - 1; bi >= 0; bi--) {
      outerLayers.push(makeRing(halfWall - botBevel[bi].dr, botBevel[bi].dz));
    }
  } else {
    outerLayers.push(makeRing(halfWall, 0));
  }
  if (topBevel.length > 0) {
    for (var ti = 0; ti < topBevel.length; ti++) {
      outerLayers.push(makeRing(halfWall - topBevel[ti].dr, topZ - bevelR + topBevel[ti].dz));
    }
  } else {
    outerLayers.push(makeRing(halfWall, topZ));
  }

  // Build layers for inner wall
  var innerLayers = [];
  if (botBevel.length > 0) {
    for (var bi2 = botBevel.length - 1; bi2 >= 0; bi2--) {
      innerLayers.push(makeRing(-halfWall + botBevel[bi2].dr, botBevel[bi2].dz));
    }
  } else {
    innerLayers.push(makeRing(-halfWall, 0));
  }
  if (topBevel.length > 0) {
    for (var ti2 = 0; ti2 < topBevel.length; ti2++) {
      innerLayers.push(makeRing(-halfWall + topBevel[ti2].dr, topZ - bevelR + topBevel[ti2].dz));
    }
  } else {
    innerLayers.push(makeRing(-halfWall, topZ));
  }

  // Connect outer layers
  for (var li = 0; li < outerLayers.length - 1; li++) bandRings(outerLayers[li], outerLayers[li + 1]);
  // Connect inner layers (reversed winding)
  for (var li2 = 0; li2 < innerLayers.length - 1; li2++) bandRings(innerLayers[li2 + 1], innerLayers[li2]);
  // Top cap (connect outer top to inner top)
  bandRings(outerLayers[outerLayers.length - 1], innerLayers[innerLayers.length - 1]);
  // Bottom cap
  bandRings(innerLayers[0], outerLayers[0]);

  return tris;
}

function generateSolidMesh(contour, scale, extH, bevelSteps, bevelBottom) {
  var n = contour.length;
  var normals = computeNormals(contour);
  var bevelR = Math.min(extH * 0.45, 2.0);

  function bevelProfile(steps) {
    var pts = [];
    for (var i = 0; i <= steps; i++) {
      var a = (Math.PI / 2) * (i / steps);
      pts.push({ dr: bevelR * (1 - Math.cos(a)), dz: bevelR * Math.sin(a) });
    }
    return pts;
  }
  var topBevel = bevelSteps > 0 ? bevelProfile(bevelSteps) : [];
  var botBevel = (bevelSteps > 0 && bevelBottom) ? bevelProfile(bevelSteps) : [];

  var tris = [];
  function tri(a, b, c) { tris.push(a, b, c); }
  function quad(a, b, c, d) { tri(a, b, c); tri(a, c, d); }

  function makeRing(offset, z) {
    var ring = [];
    for (var i = 0; i < n; i++) {
      ring.push([
        (contour[i][0] + normals[i][0] * offset) * scale,
        (contour[i][1] + normals[i][1] * offset) * scale,
        z
      ]);
    }
    return ring;
  }

  function bandRings(r1, r2) {
    for (var i = 0; i < n; i++) {
      var j = (i + 1) % n;
      quad(r1[i], r1[j], r2[j], r2[i]);
    }
  }

  var layers = [];
  if (botBevel.length > 0) {
    for (var bi = botBevel.length - 1; bi >= 0; bi--) {
      layers.push(makeRing(-botBevel[bi].dr, botBevel[bi].dz));
    }
  } else {
    layers.push(makeRing(0, 0));
  }
  if (topBevel.length > 0) {
    for (var ti = 0; ti < topBevel.length; ti++) {
      layers.push(makeRing(-topBevel[ti].dr, extH - bevelR + topBevel[ti].dz));
    }
  } else {
    layers.push(makeRing(0, extH));
  }

  for (var li = 0; li < layers.length - 1; li++) bandRings(layers[li], layers[li + 1]);

  // Top and bottom faces via ear clipping
  var topRing = layers[layers.length - 1];
  var botRing = layers[0];
  var topZ = topRing[0][2], botZ = botRing[0][2];
  var pts2d = [];
  for (var i = 0; i < n; i++) pts2d.push([topRing[i][0], topRing[i][1]]);
  var earTris = earClip(pts2d);
  for (var ei = 0; ei < earTris.length; ei += 3) {
    var a = earTris[ei], b = earTris[ei+1], c = earTris[ei+2];
    tri([pts2d[a][0], pts2d[a][1], topZ], [pts2d[b][0], pts2d[b][1], topZ], [pts2d[c][0], pts2d[c][1], topZ]);
    tri([pts2d[c][0], pts2d[c][1], botZ], [pts2d[b][0], pts2d[b][1], botZ], [pts2d[a][0], pts2d[a][1], botZ]);
  }
  return tris;
}

function earClip(polygon) {
  var n = polygon.length;
  if (n < 3) return [];
  var indices = [];
  for (var i = 0; i < n; i++) indices.push(i);
  var tris = [];
  var iter = 0;
  while (indices.length > 2 && iter < n * n) {
    iter++;
    var found = false;
    for (var i2 = 0; i2 < indices.length; i2++) {
      var prev = indices[(i2 - 1 + indices.length) % indices.length];
      var curr = indices[i2];
      var next = indices[(i2 + 1) % indices.length];
      var ax = polygon[prev][0], ay = polygon[prev][1];
      var bx = polygon[curr][0], by = polygon[curr][1];
      var cx = polygon[next][0], cy = polygon[next][1];
      var cross = (bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
      if (cross <= 0) continue;
      var earOk = true;
      for (var j = 0; j < indices.length; j++) {
        if (j === (i2-1+indices.length)%indices.length || j === i2 || j === (i2+1)%indices.length) continue;
        var p = polygon[indices[j]];
        if (pointInTri(p, [ax,ay],[bx,by],[cx,cy])) { earOk = false; break; }
      }
      if (earOk) {
        tris.push(prev, curr, next);
        indices.splice(i2, 1);
        found = true;
        break;
      }
    }
    if (!found) break;
  }
  return tris;
}

function pointInTri(p, a, b, c) {
  var d1 = (p[0]-b[0])*(a[1]-b[1])-(a[0]-b[0])*(p[1]-b[1]);
  var d2 = (p[0]-c[0])*(b[1]-c[1])-(b[0]-c[0])*(p[1]-c[1]);
  var d3 = (p[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(p[1]-a[1]);
  var hasNeg = (d1<0)||(d2<0)||(d3<0);
  var hasPos = (d1>0)||(d2>0)||(d3>0);
  return !(hasNeg && hasPos);
}

// =================== STL EXPORT ===================

function buildSTLBuffer(tris) {
  var nTris = tris.length / 3;
  var buf = new ArrayBuffer(84 + nTris * 50);
  var view = new DataView(buf);
  view.setUint32(80, nTris, true);
  var off = 84;
  for (var i = 0; i < tris.length; i += 3) {
    var a = tris[i], b = tris[i+1], c = tris[i+2];
    var ux = b[0]-a[0], uy = b[1]-a[1], uz = b[2]-a[2];
    var vx = c[0]-a[0], vy = c[1]-a[1], vz = c[2]-a[2];
    var nx = uy*vz-uz*vy, ny = uz*vx-ux*vz, nz = ux*vy-uy*vx;
    var nl = Math.hypot(nx,ny,nz) || 1;
    view.setFloat32(off,nx/nl,true); view.setFloat32(off+4,ny/nl,true); view.setFloat32(off+8,nz/nl,true);
    off += 12;
    view.setFloat32(off,a[0],true); view.setFloat32(off+4,a[1],true); view.setFloat32(off+8,a[2],true); off+=12;
    view.setFloat32(off,b[0],true); view.setFloat32(off+4,b[1],true); view.setFloat32(off+8,b[2],true); off+=12;
    view.setFloat32(off,c[0],true); view.setFloat32(off+4,c[1],true); view.setFloat32(off+8,c[2],true); off+=12;
    view.setUint16(off,0,true); off+=2;
  }
  return buf;
}

function arrayBufferToBase64(buf) {
  var bytes = new Uint8Array(buf);
  var str = "";
  for (var i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str);
}

function buildTriangles(contours, mode, targetWidth, effectiveW, wallThickness, extrudeHeight, bevelSteps, bevelBottom) {
  var scale = targetWidth / effectiveW;
  var allTris = [];
  for (var ci = 0; ci < contours.length; ci++) {
    var c = contours[ci];
    var mesh;
    if (mode === "frame") {
      mesh = generateFrameMesh(c, scale, wallThickness, extrudeHeight, bevelSteps, bevelBottom);
    } else {
      mesh = generateSolidMesh(c, scale, extrudeHeight, bevelSteps, bevelBottom);
    }
    for (var i = 0; i < mesh.length; i++) allTris.push(mesh[i]);
  }
  return allTris;
}

// =================== 3D PREVIEW ===================

function Preview3D(props) {
  var mountRef = useRef(null);
  var stateRef = useRef(null);

  useEffect(function() {
    var el = mountRef.current;
    if (!el) return;
    var w = el.clientWidth, h = Math.min(w * 0.7, 400);
    var scene = new THREE.Scene();
    scene.background = new THREE.Color("#faf5ef");
    var camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 2000);
    var renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    var dl = new THREE.DirectionalLight(0xffffff, 0.8);
    dl.position.set(5, 5, 10);
    scene.add(dl);

    var grid = new THREE.GridHelper(200, 20, 0xd4bfa6, 0xe8dcc8);
    grid.rotation.x = Math.PI / 2;
    scene.add(grid);

    stateRef.current = { scene: scene, camera: camera, renderer: renderer, mesh: null, el: el, h: h };

    var theta = 0.6, phi = 0.8, dist = 150;
    function updateCam() {
      camera.position.set(
        dist * Math.sin(phi) * Math.cos(theta),
        dist * Math.sin(phi) * Math.sin(theta),
        dist * Math.cos(phi)
      );
      camera.up.set(0, 0, 1);
      camera.lookAt(0, 0, 0);
    }
    updateCam();

    var dragging = false, lastX = 0, lastY = 0;
    var onDown = function(e) {
      dragging = true;
      var p = e.touches ? e.touches[0] : e;
      lastX = p.clientX; lastY = p.clientY;
    };
    var onMove = function(e) {
      if (!dragging) return;
      var p = e.touches ? e.touches[0] : e;
      theta += (p.clientX - lastX) * 0.01;
      phi = Math.max(0.1, Math.min(Math.PI - 0.1, phi - (p.clientY - lastY) * 0.01));
      lastX = p.clientX; lastY = p.clientY;
      updateCam();
    };
    var onUp = function() { dragging = false; };
    var onWheel = function(e) {
      e.preventDefault();
      dist = Math.max(20, Math.min(500, dist + e.deltaY * 0.3));
      updateCam();
    };

    var dom = renderer.domElement;
    dom.addEventListener("mousedown", onDown);
    dom.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    dom.addEventListener("wheel", onWheel, { passive: false });
    dom.addEventListener("touchstart", onDown, { passive: true });
    dom.addEventListener("touchmove", onMove, { passive: true });
    dom.addEventListener("touchend", onUp);

    var animId;
    function animate() {
      animId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    }
    animate();

    return function() {
      cancelAnimationFrame(animId);
      dom.removeEventListener("mousedown", onDown);
      dom.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      dom.removeEventListener("wheel", onWheel);
      dom.removeEventListener("touchstart", onDown);
      dom.removeEventListener("touchmove", onMove);
      dom.removeEventListener("touchend", onUp);
      renderer.dispose();
      if (el.contains(dom)) el.removeChild(dom);
    };
  }, []);

  useEffect(function() {
    var st = stateRef.current;
    if (!st) return;
    if (st.mesh) { st.scene.remove(st.mesh); st.mesh.geometry.dispose(); st.mesh.material.dispose(); }
    var tris = props.triangles;
    if (!tris || tris.length === 0) return;
    var geo = new THREE.BufferGeometry();
    var verts = new Float32Array(tris.length * 3);
    for (var i = 0; i < tris.length; i++) {
      verts[i * 3] = tris[i][0];
      verts[i * 3 + 1] = tris[i][1];
      verts[i * 3 + 2] = tris[i][2];
    }
    geo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
    geo.computeVertexNormals();
    geo.center();
    var mat = new THREE.MeshStandardMaterial({ color: 0xc97d44, roughness: 0.4, metalness: 0.1, side: THREE.DoubleSide });
    var mesh = new THREE.Mesh(geo, mat);
    st.scene.add(mesh);
    st.mesh = mesh;
  }, [props.triangles]);

  return <div ref={mountRef} style={{ width: "100%", borderRadius: 12, overflow: "hidden", background: "#faf5ef" }} />;
}

// =================== ELLIPSE GENERATION ===================

function generateEllipseContour(cx, cy, rx, ry, numPoints) {
  var pts = [];
  for (var i = 0; i < numPoints; i++) {
    var angle = (2 * Math.PI * i) / numPoints;
    pts.push([cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)]);
  }
  return pts;
}

// =================== MAIN COMPONENT ===================

export default function TextCircleTool() {
  var _s = useState, _r = useRef, _e = useEffect, _c = useCallback;

  var sa = _s("Christian"), text = sa[0], setText = sa[1];
  var sb = _s(4), fontIdx = sb[0], setFontIdx = sb[1]; // Default to Nunito
  var sc = _s(false), bold = sc[0], setBold = sc[1];
  var sd = _s(150), targetWidth = sd[0], setTargetWidth = sd[1];
  var se = _s(5), extrudeHeight = se[0], setExtrudeHeight = se[1];
  var sf = _s(2.0), wallThickness = sf[0], setWallThickness = sf[1];
  var sg = _s("frame"), mode = sg[0], setMode = sg[1];
  var sh = _s(4), bevelSteps = sh[0], setBevelSteps = sh[1];
  var si = _s(false), bevelBottom = si[0], setBevelBottom = si[1];
  var sj = _s(2), smoothIter = sj[0], setSmoothIter = sj[1];
  var sk = _s(120), sharpAngle = sk[0], setSharpAngle = sk[1];
  var sl = _s(20), padding = sl[0], setPadding = sl[1];
  var sm = _s(1.3), ellipseRatio = sm[0], setEllipseRatio = sm[1];
  var sn = _s(2.0), borderThickness = sn[0], setBorderThickness = sn[1];
  var so = _s([]), contours = so[0], setContours = so[1];
  var sp = _s([]), previewTris = sp[0], setPreviewTris = sp[1];
  var sq = _s(null), downloadUrl = sq[0], setDownloadUrl = sq[1];
  var sr = _s(false), generating = sr[0], setGenerating = sr[1];
  var ss = _s(""), fileName = ss[0], setFileName = ss[1];
  var st = _s(false), fontLoaded = st[0], setFontLoaded = st[1];
  var su = _s(null), previewDataUrl = su[0], setPreviewDataUrl = su[1];
  var sv = _s(false), fontSearchOpen = sv[0], setFontSearchOpen = sv[1];
  var sw = _s(""), fontSearch = sw[0], setFontSearch = sw[1];

  var canvasRef = _r(null);

  var selectedFont = FONTS[fontIdx];

  // Load initial font
  _e(function() {
    loadFont(FONTS[fontIdx]).then(function() { setFontLoaded(true); });
  }, []);

  // Render text + ellipse to canvas and extract contours
  var renderAndExtract = _c(function() {
    if (!text.trim()) {
      setContours([]);
      setPreviewTris([]);
      setPreviewDataUrl(null);
      return;
    }

    var font = FONTS[fontIdx];
    loadFont(font).then(function() {
      var cv = document.createElement("canvas");
      var ctx = cv.getContext("2d");

      // Measure text at a base size
      var fontSize = 120;
      var fontWeight = bold ? "bold" : "normal";
      ctx.font = fontWeight + " " + fontSize + "px " + font.family;
      var metrics = ctx.measureText(text);
      var textW = metrics.width;
      var textH = fontSize;

      // Canvas size with padding for the ellipse
      var pad = padding * 3;
      var cw = Math.ceil(textW + pad * 2 + borderThickness * 6);
      var ch = Math.ceil(textH * ellipseRatio + pad * 2 + borderThickness * 6);
      cv.width = cw;
      cv.height = ch;

      ctx = cv.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, cw, ch);

      // Draw ellipse border
      var ecx = cw / 2;
      var ecy = ch / 2;
      var erx = textW / 2 + pad;
      var ery = (textH * ellipseRatio) / 2 + pad;

      ctx.beginPath();
      ctx.ellipse(ecx, ecy, erx, ery, 0, 0, 2 * Math.PI);
      ctx.fillStyle = "#000000";
      ctx.fill();

      // Cut out inner ellipse to make border
      ctx.beginPath();
      ctx.ellipse(ecx, ecy, Math.max(1, erx - borderThickness * 3), Math.max(1, ery - borderThickness * 3), 0, 0, 2 * Math.PI);
      ctx.fillStyle = "#ffffff";
      ctx.fill();

      // Draw text
      ctx.fillStyle = "#000000";
      ctx.font = fontWeight + " " + fontSize + "px " + font.family;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, ecx, ecy);

      // Save preview image
      setPreviewDataUrl(cv.toDataURL());

      // Extract contours using marching squares
      var data = ctx.getImageData(0, 0, cw, ch);
      var binary = new Uint8Array(cw * ch);
      for (var i = 0; i < cw * ch; i++) {
        var r = data.data[i*4], g = data.data[i*4+1], b = data.data[i*4+2];
        var gray = 0.299*r + 0.587*g + 0.114*b;
        binary[i] = gray < 128 ? 1 : 0;
      }

      var segments = marchingSquares(binary, cw, ch);
      var chains = chainSegments(segments);
      chains = chains.map(function(c) {
        var d = Math.hypot(c[0][0]-c[c.length-1][0], c[0][1]-c[c.length-1][1]);
        return d < 2 ? c.slice(0,-1) : c;
      }).filter(function(c) { return c.length >= 6; });

      var processed = chains.map(function(c) { return processContour(c, smoothIter, cw, sharpAngle); });
      processed = processed.filter(function(c) { return c.length >= 6; });

      setContours(processed);
      setDownloadUrl(null);
      setFileName(text.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, "_").substring(0, 30));
    });
  }, [text, fontIdx, bold, padding, ellipseRatio, borderThickness, smoothIter, sharpAngle]);

  // Re-render when params change
  _e(function() {
    renderAndExtract();
  }, [renderAndExtract]);

  // Effective canvas width for scaling
  var effectiveW = 400; // base reference
  _e(function() {
    if (previewDataUrl) {
      var img = new Image();
      img.onload = function() {
        effectiveW = img.width;
      };
      img.src = previewDataUrl;
    }
  }, [previewDataUrl]);

  // Rebuild preview when mesh settings change
  _e(function() {
    if (contours.length > 0) {
      // Compute effective width from contour bounds
      var minX = Infinity, maxX = -Infinity;
      for (var ci = 0; ci < contours.length; ci++) {
        for (var pi = 0; pi < contours[ci].length; pi++) {
          if (contours[ci][pi][0] < minX) minX = contours[ci][pi][0];
          if (contours[ci][pi][0] > maxX) maxX = contours[ci][pi][0];
        }
      }
      var ew = maxX - minX || 100;
      var tris = buildTriangles(contours, mode, targetWidth, ew, wallThickness, extrudeHeight, bevelSteps, bevelBottom);
      setPreviewTris(tris);
    } else {
      setPreviewTris([]);
    }
  }, [contours, mode, targetWidth, wallThickness, extrudeHeight, bevelSteps, bevelBottom]);

  var generateSTL = function() {
    if (contours.length === 0) return;
    setGenerating(true);
    setDownloadUrl(null);
    setTimeout(function() {
      var minX = Infinity, maxX = -Infinity;
      for (var ci = 0; ci < contours.length; ci++) {
        for (var pi = 0; pi < contours[ci].length; pi++) {
          if (contours[ci][pi][0] < minX) minX = contours[ci][pi][0];
          if (contours[ci][pi][0] > maxX) maxX = contours[ci][pi][0];
        }
      }
      var ew = maxX - minX || 100;
      var tris = buildTriangles(contours, mode, targetWidth, ew, wallThickness, extrudeHeight, bevelSteps, bevelBottom);
      var buf = buildSTLBuffer(tris);
      var b64 = arrayBufferToBase64(buf);
      var dataUri = "data:application/octet-stream;base64," + b64;
      setDownloadUrl(dataUri);
      try {
        var a = document.createElement("a");
        a.href = dataUri;
        a.download = (fileName || "text_circle") + ".stl";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch(err) {}
      setGenerating(false);
    }, 100);
  };

  var totalPoints = contours.reduce(function(s,c) { return s + c.length; }, 0);
  var hasContours = contours.length > 0;

  var filteredFonts = FONTS.map(function(f, i) { return { font: f, idx: i }; });
  if (fontSearch.trim()) {
    var q = fontSearch.toLowerCase();
    filteredFonts = filteredFonts.filter(function(item) {
      return item.font.name.toLowerCase().indexOf(q) >= 0;
    });
  }

  return (
    <div style={{ width: "100%", maxWidth: 540, display: "flex", flexDirection: "column", gap: 14 }}>

      <Section title="Text eingeben" desc="Gib den Text ein, der als 3D-Schriftzug mit Ellipse erstellt werden soll.">
        <input
          type="text"
          value={text}
          onChange={function(e) { setText(e.target.value); }}
          placeholder="Dein Text hier..."
          style={{
            width: "100%", padding: "12px 16px", fontSize: 18, fontFamily: "inherit",
            border: "2px solid #d4bfa6", borderRadius: 12, background: "#fff",
            color: "#3d2e1f", outline: "none"
          }}
        />
      </Section>

      <Section title="Schriftart" desc="Waehle eine Schriftart fuer deinen Text.">
        <div style={{ marginBottom: 10 }}>
          <input
            type="text"
            value={fontSearch}
            onChange={function(e) { setFontSearch(e.target.value); }}
            placeholder="Schriftart suchen..."
            style={{
              width: "100%", padding: "8px 12px", fontSize: 14, fontFamily: "inherit",
              border: "2px solid #d4bfa6", borderRadius: 10, background: "#fff",
              color: "#3d2e1f", outline: "none", marginBottom: 8
            }}
          />
          <div style={{
            maxHeight: 200, overflowY: "auto", border: "1px solid #e8dcc8",
            borderRadius: 10, background: "#fff"
          }}>
            {filteredFonts.map(function(item) {
              var f = item.font;
              var idx = item.idx;
              var isActive = idx === fontIdx;
              return (
                <div
                  key={f.name}
                  onClick={function() {
                    setFontIdx(idx);
                    loadFont(f);
                  }}
                  onMouseEnter={function() { loadFont(f); }}
                  style={{
                    padding: "8px 14px", cursor: "pointer",
                    background: isActive ? "#fdf0e2" : "transparent",
                    borderBottom: "1px solid #f0e8dd",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    transition: "background 0.15s"
                  }}
                >
                  <span style={{ fontWeight: isActive ? 700 : 400, color: isActive ? "#8b5a2b" : "#6b4c30", fontSize: 14 }}>
                    {f.name}
                  </span>
                  <span style={{ fontFamily: f.family, fontSize: 16, color: "#3d2e1f" }}>
                    {text || "Beispiel"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <PillButton active={!bold} onClick={function() { setBold(false); }}>Normal</PillButton>
          <PillButton active={bold} onClick={function() { setBold(true); }}>Fett</PillButton>
        </div>
      </Section>

      <Section title="Ellipse anpassen" desc="Passe die Ellipse um den Text an.">
        <SliderRow label="Abstand Text-Rand"
          desc="Wie viel Platz zwischen Text und Ellipse"
          value={padding} min={5} max={60} step={1}
          onChange={setPadding} display={padding + " px"} />
        <SliderRow label="Ellipsen-Hoehe"
          desc="Verhaeltnis der Hoehe zur Texthoehe (hoeher = rundere Ellipse)"
          value={ellipseRatio} min={0.8} max={2.5} step={0.05}
          onChange={setEllipseRatio} display={ellipseRatio.toFixed(2) + "x"} />
        <SliderRow label="Rahmen-Staerke"
          desc="Dicke des Ellipsen-Rahmens"
          value={borderThickness} min={0.5} max={6} step={0.25}
          onChange={setBorderThickness} display={borderThickness.toFixed(1)} />
      </Section>

      {previewDataUrl && (
        <Section title="Vorschau" desc="So sieht dein Text mit Ellipse aus.">
          <div style={{ textAlign: "center" }}>
            <img src={previewDataUrl} style={{
              maxWidth: "100%", borderRadius: 10,
              border: "1px solid #e8dcc8"
            }} />
          </div>
          <div style={{
            fontSize: 13, marginTop: 8, borderRadius: 8, padding: "7px 10px",
            background: hasContours ? "#f0f7ec" : "#fdf2e9",
            color: hasContours ? "#4a6b3a" : "#9a6030"
          }}>
            {!hasContours
              ? "Kein Umriss gefunden - Text eingeben"
              : contours.length + " Umriss" + (contours.length !== 1 ? "e" : "") + " erkannt, " + totalPoints + " Punkte"}
          </div>
        </Section>
      )}

      <Section title="Konturen-Glaettung" desc="Feineinstellungen fuer die Kontur-Erkennung.">
        <SliderRow label="Kurven-Glaettung"
          desc="Rundet Kurven, scharfe Ecken bleiben erhalten"
          value={smoothIter} min={0} max={5} step={1}
          onChange={setSmoothIter} display={smoothIter === 0 ? "Aus" : smoothIter + "x"} />
        {smoothIter > 0 && (
          <SliderRow label="Ecken-Schutz"
            desc="Welche Ecken beim Glaetten geschuetzt werden"
            value={sharpAngle} min={60} max={150} step={5}
            onChange={setSharpAngle} display={sharpAngle + " Grad"} />
        )}
      </Section>

      <Section title="Groesse und Form" desc="Wie gross und dick soll dein 3D-Druck werden?">
        <SliderRow label="Breite"
          desc="Gesamtbreite des gedruckten Objekts"
          value={targetWidth} min={20} max={300} step={5}
          onChange={setTargetWidth} display={targetWidth + " mm"} />
        <SliderRow label="Dicke (Hoehe)"
          desc="So dick/hoch wird das Objekt"
          value={extrudeHeight} min={1} max={20} step={0.5}
          onChange={setExtrudeHeight} display={extrudeHeight + " mm"} />
        {mode === "frame" && (
          <SliderRow label="Wandstaerke"
            desc="Breite der Rahmenwand"
            value={wallThickness} min={0.5} max={8} step={0.25}
            onChange={setWallThickness} display={wallThickness + " mm"} />
        )}
        <SliderRow label="Kanten-Rundung"
          desc="Wie stark die obere Kante abgerundet wird"
          value={bevelSteps} min={0} max={8} step={1}
          onChange={setBevelSteps} display={bevelSteps === 0 ? "Keine" : bevelSteps + " Stufen"} />
        {bevelSteps > 0 && (
          <div style={{ display: "flex", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
            <PillButton active={!bevelBottom} onClick={function() { setBevelBottom(false); }}>
              Nur oben rund (flacher Boden)
            </PillButton>
            <PillButton active={bevelBottom} onClick={function() { setBevelBottom(true); }}>
              Oben und unten rund
            </PillButton>
          </div>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
          <PillButton active={mode === "frame"} onClick={function() { setMode("frame"); }}>
            Rahmen (nur Umriss)
          </PillButton>
          <PillButton active={mode === "solid"} onClick={function() { setMode("solid"); }}>
            Massiv (ausgefuellt)
          </PillButton>
        </div>
      </Section>

      {previewTris.length > 0 && (
        <Section title="3D-Vorschau" desc="So wird dein Objekt aussehen. Ziehen zum Drehen, Scrollen zum Zoomen.">
          <Preview3D triangles={previewTris} />
          <div style={{ fontSize: 12, color: "#9a7d5f", marginTop: 6, textAlign: "center" }}>
            Maus ziehen = Drehen | Mausrad = Zoomen | {previewTris.length} Dreiecke
          </div>
        </Section>
      )}

      <button
        onClick={generateSTL}
        disabled={!hasContours || generating}
        style={{
          width: "100%", padding: "16px 24px",
          background: hasContours ? "linear-gradient(135deg, #c97d44, #a05e2c)" : "#ccc",
          color: "#fff", border: "none", borderRadius: 14,
          fontSize: 18, fontWeight: 800, cursor: hasContours ? "pointer" : "default",
          fontFamily: "inherit",
          boxShadow: hasContours ? "0 4px 16px rgba(169,94,44,0.35)" : "none",
          transition: "all 0.2s"
        }}
      >
        {generating ? "STL wird erstellt..." : "STL-Datei herunterladen"}
      </button>

      {downloadUrl && (
        <div style={{
          background: "#edf7e8", borderRadius: 12, padding: "14px 20px",
          textAlign: "center", border: "2px solid #8cb87a"
        }}>
          <div style={{ fontSize: 15, color: "#3d6b2a", marginBottom: 8, fontWeight: 700 }}>
            Deine STL-Datei ist fertig!
          </div>
          <a href={downloadUrl} download={(fileName || "text_circle") + ".stl"}
            style={{
              display: "inline-block", padding: "12px 32px",
              background: "#5a9a42", color: "#fff", borderRadius: 10,
              fontSize: 17, fontWeight: 800, textDecoration: "none",
              fontFamily: "inherit"
            }}
          >
            Hier tippen zum Speichern
          </a>
        </div>
      )}
    </div>
  );
}

// =================== SHARED UI COMPONENTS ===================

function Section(props) {
  return (
    <div style={{
      background: "#fff", borderRadius: 14, padding: "16px 20px",
      boxShadow: "0 2px 8px rgba(80,50,20,0.06)"
    }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: "#6b4c30", marginBottom: 2 }}>{props.title}</div>
      {props.desc && <div style={{ fontSize: 12, color: "#b09a7e", marginBottom: 12, lineHeight: 1.5 }}>{props.desc}</div>}
      {props.children}
    </div>
  );
}

function SliderRow(props) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 1 }}>
        <span style={{ color: "#6b4c30", fontWeight: 600 }}>{props.label}</span>
        <span style={{ fontWeight: 700, color: "#a05e2c", minWidth: 50, textAlign: "right" }}>{props.display}</span>
      </div>
      {props.desc && <div style={{ fontSize: 11, color: "#b09a7e", marginBottom: 4 }}>{props.desc}</div>}
      <input type="range" min={props.min} max={props.max} step={props.step} value={props.value}
        onChange={function(e) { props.onChange(Number(e.target.value)); }}
        style={{ width: "100%", accentColor: "#c97d44", height: 6 }} />
    </div>
  );
}

function PillButton(props) {
  return (
    <button onClick={props.onClick} style={{
      padding: "7px 16px", borderRadius: 20,
      border: "2px solid " + (props.active ? "#c97d44" : "#d4c4b0"),
      background: props.active ? "#fdf0e2" : "#fff",
      color: props.active ? "#8b5a2b" : "#9a7d5f",
      fontWeight: 700, fontSize: 13, cursor: "pointer",
      fontFamily: "inherit", transition: "all 0.15s"
    }}>{props.children}</button>
  );
}
