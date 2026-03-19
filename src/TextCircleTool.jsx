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

// =================== CONTOUR EXTRACTION ===================
// (matching App.jsx function signatures exactly)

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
    var changed = true;
    while (changed) {
      changed = false;
      var endKey = key(chain[chain.length - 1]);
      var neighbors = adj.get(endKey) || [];
      for (var ni = 0; ni < neighbors.length; ni++) {
        if (!used.has(neighbors[ni].idx)) {
          used.add(neighbors[ni].idx);
          chain.push(neighbors[ni].pt);
          changed = true;
          break;
        }
      }
    }
    if (chain.length > 3) contours.push(chain);
  }
  return contours;
}

function douglasPeucker(points, epsilon) {
  if (points.length <= 2) return points;
  var maxDist = 0, maxIdx = 0;
  var sx = points[0][0], sy = points[0][1];
  var ex = points[points.length-1][0], ey = points[points.length-1][1];
  var dx = ex - sx, dy = ey - sy;
  var lenSq = dx * dx + dy * dy;
  for (var i = 1; i < points.length - 1; i++) {
    var dist;
    if (lenSq === 0) {
      dist = Math.hypot(points[i][0] - sx, points[i][1] - sy);
    } else {
      var t = Math.max(0, Math.min(1, ((points[i][0] - sx) * dx + (points[i][1] - sy) * dy) / lenSq));
      dist = Math.hypot(points[i][0] - (sx + t * dx), points[i][1] - (sy + t * dy));
    }
    if (dist > maxDist) { maxDist = dist; maxIdx = i; }
  }
  if (maxDist > epsilon) {
    var left = douglasPeucker(points.slice(0, maxIdx + 1), epsilon);
    var right = douglasPeucker(points.slice(maxIdx), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [points[0], points[points.length - 1]];
}

function simplifyClosedContour(pts, epsilon) {
  if (pts.length < 6) return pts;
  var half = Math.floor(pts.length / 2);
  var seg1 = pts.slice(0, half + 1);
  var seg2 = pts.slice(half).concat([pts[0]]);
  var s1 = douglasPeucker(seg1, epsilon);
  var s2 = douglasPeucker(seg2, epsilon);
  var result = s1.slice(0, -1).concat(s2.slice(0, -1));
  return result;
}

function vertexAngle(pts, i) {
  var n = pts.length;
  var prev = pts[(i - 1 + n) % n];
  var cur = pts[i];
  var next = pts[(i + 1) % n];
  var ax = prev[0] - cur[0], ay = prev[1] - cur[1];
  var bx = next[0] - cur[0], by = next[1] - cur[1];
  var dot = ax * bx + ay * by;
  var cross = ax * by - ay * bx;
  return Math.atan2(Math.abs(cross), dot) * 180 / Math.PI;
}

function smoothWeighted(points, iterations, sharpAngle) {
  if (points.length < 4 || iterations <= 0) return points;
  var pts = points.map(function(p) { return [p[0], p[1]]; });
  var n = pts.length;
  var sharp = sharpAngle || 90;

  for (var iter = 0; iter < iterations; iter++) {
    var newPts = [];
    for (var i = 0; i < n; i++) {
      var prev = pts[(i - 1 + n) % n];
      var cur = pts[i];
      var next = pts[(i + 1) % n];
      var angle = vertexAngle(pts, i);

      var w;
      if (angle < sharp) {
        w = 0;
      } else if (angle < sharp + 40) {
        w = 0.5 * (angle - sharp) / 40;
      } else {
        w = 0.5;
      }

      var midX = (prev[0] + next[0]) / 2;
      var midY = (prev[1] + next[1]) / 2;
      newPts.push([
        cur[0] + (midX - cur[0]) * w,
        cur[1] + (midY - cur[1]) * w
      ]);
    }
    pts = newPts;
  }
  return pts;
}

function subdivide(points, iterations, sharpAngle) {
  if (points.length < 4 || iterations <= 0) return points;
  var pts = points;
  var sharp = sharpAngle || 90;

  for (var iter = 0; iter < iterations; iter++) {
    var newPts = [];
    var n = pts.length;
    for (var i = 0; i < n; i++) {
      var p0 = pts[i];
      var p1 = pts[(i + 1) % n];
      var angle = vertexAngle(pts, i);

      if (angle < sharp) {
        newPts.push(p0);
        newPts.push([(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2]);
      } else {
        newPts.push([0.75 * p0[0] + 0.25 * p1[0], 0.75 * p0[1] + 0.25 * p1[1]]);
        newPts.push([0.25 * p0[0] + 0.75 * p1[0], 0.25 * p0[1] + 0.75 * p1[1]]);
      }
    }
    pts = newPts;
  }
  return pts;
}

function resampleUniform(pts, spacing) {
  if (pts.length < 3) return pts;
  var n = pts.length;
  var dists = [0];
  for (var i = 0; i < n; i++) {
    var j = (i + 1) % n;
    dists.push(dists[i] + Math.hypot(pts[j][0] - pts[i][0], pts[j][1] - pts[i][1]));
  }
  var totalLen = dists[n];
  var numPts = Math.max(12, Math.round(totalLen / spacing));
  var step = totalLen / numPts;

  var result = [];
  var segI = 0;
  for (var pi = 0; pi < numPts; pi++) {
    var targetD = pi * step;
    while (segI < n - 1 && dists[segI + 1] < targetD) segI++;
    var segStart = dists[segI];
    var segEnd = dists[segI + 1];
    var segL = segEnd - segStart;
    var t = segL > 0.0001 ? (targetD - segStart) / segL : 0;
    var ni = (segI + 1) % n;
    result.push([
      pts[segI][0] + (pts[ni][0] - pts[segI][0]) * t,
      pts[segI][1] + (pts[ni][1] - pts[segI][1]) * t
    ]);
  }
  return result;
}

function processContour(rawChain, smoothLevel, imgW, sharpAngle) {
  var epsilon = Math.max(0.3, imgW * 0.002);
  var simplified = simplifyClosedContour(rawChain, epsilon);
  if (simplified.length < 3) return simplified;

  if (smoothLevel <= 0) {
    var targetSpacing = Math.max(0.3, imgW * 0.003);
    return resampleUniform(simplified, targetSpacing);
  }

  var subdivided = subdivide(simplified, 1, sharpAngle);
  var laplacianIter = smoothLevel * 2;
  var smoothed = smoothWeighted(subdivided, laplacianIter, sharpAngle);
  var targetSpacing2 = Math.max(0.3, imgW * 0.003);
  var resampled = resampleUniform(smoothed, targetSpacing2);
  return resampled;
}

// =================== MESH GENERATION ===================

function computeNormals(contour) {
  var n = contour.length;
  var normals = [];
  for (var i = 0; i < n; i++) {
    var prev = (i - 1 + n) % n;
    var next = (i + 1) % n;
    var dx1 = contour[i][0] - contour[prev][0];
    var dy1 = contour[i][1] - contour[prev][1];
    var dx2 = contour[next][0] - contour[i][0];
    var dy2 = contour[next][1] - contour[i][1];
    var l1 = Math.hypot(dx1, dy1) || 1;
    var l2 = Math.hypot(dx2, dy2) || 1;
    var nx = (-dy1 / l1 + -dy2 / l2) / 2;
    var ny = (dx1 / l1 + dx2 / l2) / 2;
    var nl = Math.hypot(nx, ny) || 1;
    normals.push([nx / nl, ny / nl]);
  }
  return normals;
}

function generateFrameMesh(contour, wallThick, height, scale, bevelSteps, bevelBottom) {
  var n = contour.length;
  if (n < 3) return [];
  var normals = computeNormals(contour);
  var tris = [];
  var half = wallThick / (2 * scale);
  var h = height / scale;
  var bevelR = Math.min(wallThick * 0.35, height * 0.35) / scale;
  var steps = bevelSteps || 4;

  var profile = [];
  if (bevelBottom && steps > 0) {
    for (var s = 0; s <= steps; s++) {
      var angle = (s / steps) * Math.PI / 2;
      profile.push({ z: bevelR * (1 - Math.cos(angle)), inset: bevelR * (1 - Math.sin(angle)) });
    }
  } else {
    profile.push({ z: 0, inset: 0 });
  }
  if (steps > 0) {
    for (var s2 = steps; s2 >= 0; s2--) {
      var angle2 = (s2 / steps) * Math.PI / 2;
      profile.push({ z: h - bevelR * (1 - Math.cos(angle2)), inset: bevelR * (1 - Math.sin(angle2)) });
    }
  } else {
    profile.push({ z: h, inset: 0 });
  }

  var mkPt = function(i, outer, profIdx) {
    var ins = profile[profIdx].inset;
    var effectiveHalf = half - ins;
    if (effectiveHalf < 0.01 / scale) effectiveHalf = 0.01 / scale;
    return [
      (contour[i][0] + normals[i][0] * effectiveHalf * (outer ? 1 : -1)) * scale,
      (contour[i][1] + normals[i][1] * effectiveHalf * (outer ? 1 : -1)) * scale,
      profile[profIdx].z * scale
    ];
  };

  for (var i = 0; i < n; i++) {
    var j = (i + 1) % n;
    for (var pi = 0; pi < profile.length - 1; pi++) {
      tris.push([mkPt(i,true,pi), mkPt(j,true,pi), mkPt(j,true,pi+1)]);
      tris.push([mkPt(i,true,pi), mkPt(j,true,pi+1), mkPt(i,true,pi+1)]);
      tris.push([mkPt(j,false,pi), mkPt(i,false,pi), mkPt(i,false,pi+1)]);
      tris.push([mkPt(j,false,pi), mkPt(i,false,pi+1), mkPt(j,false,pi+1)]);
    }
    var topIdx = profile.length - 1;
    tris.push([mkPt(i,true,topIdx), mkPt(j,true,topIdx), mkPt(j,false,topIdx)]);
    tris.push([mkPt(i,true,topIdx), mkPt(j,false,topIdx), mkPt(i,false,topIdx)]);
    tris.push([mkPt(j,true,0), mkPt(i,true,0), mkPt(i,false,0)]);
    tris.push([mkPt(j,true,0), mkPt(i,false,0), mkPt(j,false,0)]);
  }
  return tris;
}

function signedArea(pts) {
  var a = 0;
  for (var i = 0; i < pts.length; i++) {
    var j = (i + 1) % pts.length;
    a += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1];
  }
  return a / 2;
}

function ptInTri(p, a, b, c) {
  var cross = function(o, a2, b2) { return (a2[0]-o[0])*(b2[1]-o[1]) - (a2[1]-o[1])*(b2[0]-o[0]); };
  var d1 = cross(p,a,b), d2 = cross(p,b,c), d3 = cross(p,c,a);
  return !((d1<0||d2<0||d3<0) && (d1>0||d2>0||d3>0));
}

function earClip(polygon) {
  if (polygon.length < 3) return [];
  var pts = polygon.slice();
  if (signedArea(pts) > 0) pts.reverse();
  var tris = [];
  var safety = pts.length * 3;
  while (pts.length > 3 && safety-- > 0) {
    var found = false;
    for (var i = 0; i < pts.length; i++) {
      var p = (i-1+pts.length) % pts.length;
      var nx = (i+1) % pts.length;
      var cross = (pts[i][0]-pts[p][0])*(pts[nx][1]-pts[p][1]) - (pts[i][1]-pts[p][1])*(pts[nx][0]-pts[p][0]);
      if (cross >= 0) continue;
      var ear = true;
      for (var jj = 0; jj < pts.length; jj++) {
        if (jj===p||jj===i||jj===nx) continue;
        if (ptInTri(pts[jj], pts[p], pts[i], pts[nx])) { ear = false; break; }
      }
      if (ear) { tris.push([pts[p], pts[i], pts[nx]]); pts.splice(i,1); found = true; break; }
    }
    if (!found) break;
  }
  if (pts.length === 3) tris.push([pts[0], pts[1], pts[2]]);
  return tris;
}

function generateSolidMesh(contour, height, scale, bevelSteps, bevelBottom) {
  var n = contour.length;
  if (n < 3) return [];
  var tris = [];
  var h = height;
  var normals = computeNormals(contour);
  var bevelR = Math.min(height * 0.3, 1.5);
  var steps = bevelSteps || 4;
  var scaledNormals = normals;

  var profile = [];
  if (bevelBottom && steps > 0) {
    for (var s = 0; s <= steps; s++) {
      var angle = (s / steps) * Math.PI / 2;
      profile.push({ z: bevelR * (1 - Math.cos(angle)), inset: bevelR * (1 - Math.sin(angle)) });
    }
  } else {
    profile.push({ z: 0, inset: 0 });
  }
  if (steps > 0) {
    for (var s2 = steps; s2 >= 0; s2--) {
      var angle2 = (s2 / steps) * Math.PI / 2;
      profile.push({ z: h - bevelR * (1 - Math.cos(angle2)), inset: bevelR * (1 - Math.sin(angle2)) });
    }
  } else {
    profile.push({ z: h, inset: 0 });
  }

  for (var i = 0; i < n; i++) {
    var j = (i + 1) % n;
    for (var pi = 0; pi < profile.length - 1; pi++) {
      var ins0 = profile[pi].inset / scale;
      var ins1 = profile[pi + 1].inset / scale;
      var a0 = [
        (contour[i][0] - scaledNormals[i][0] * ins0) * scale,
        (contour[i][1] - scaledNormals[i][1] * ins0) * scale,
        profile[pi].z
      ];
      var a1 = [
        (contour[j][0] - scaledNormals[j][0] * ins0) * scale,
        (contour[j][1] - scaledNormals[j][1] * ins0) * scale,
        profile[pi].z
      ];
      var b0 = [
        (contour[i][0] - scaledNormals[i][0] * ins1) * scale,
        (contour[i][1] - scaledNormals[i][1] * ins1) * scale,
        profile[pi + 1].z
      ];
      var b1 = [
        (contour[j][0] - scaledNormals[j][0] * ins1) * scale,
        (contour[j][1] - scaledNormals[j][1] * ins1) * scale,
        profile[pi + 1].z
      ];
      tris.push([a0, a1, b1]);
      tris.push([a0, b1, b0]);
    }
  }
  var topInset = profile[profile.length - 1].inset / scale;
  var botInset = profile[0].inset / scale;
  var topZ = profile[profile.length - 1].z;
  var botZ = profile[0].z;
  var topPoly = contour.map(function(p, i) {
    return [(p[0] - scaledNormals[i][0] * topInset) * scale, (p[1] - scaledNormals[i][1] * topInset) * scale];
  });
  var topTris = earClip(topPoly);
  for (var ti = 0; ti < topTris.length; ti++) {
    var t = topTris[ti];
    tris.push([[t[0][0],t[0][1],topZ],[t[1][0],t[1][1],topZ],[t[2][0],t[2][1],topZ]]);
    tris.push([[t[0][0],t[0][1],botZ],[t[2][0],t[2][1],botZ],[t[1][0],t[1][1],botZ]]);
  }
  return tris;
}

// =================== STL EXPORT ===================

function buildSTLBuffer(triangles) {
  var numTris = triangles.length;
  var buf = new ArrayBuffer(84 + numTris * 50);
  var view = new DataView(buf);
  var header = "Text-Circle-STL";
  for (var i = 0; i < 80; i++) view.setUint8(i, i < header.length ? header.charCodeAt(i) : 0);
  view.setUint32(80, numTris, true);
  var off = 84;
  for (var ti = 0; ti < numTris; ti++) {
    var tri = triangles[ti];
    var a = tri[0], b = tri[1], c = tri[2];
    var ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2];
    var vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
    var nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx;
    var nl=Math.hypot(nx,ny,nz)||1;
    view.setFloat32(off,nx/nl,true);off+=4;
    view.setFloat32(off,ny/nl,true);off+=4;
    view.setFloat32(off,nz/nl,true);off+=4;
    var pts = [a,b,c];
    for (var pi = 0; pi < 3; pi++) {
      view.setFloat32(off,pts[pi][0],true);off+=4;
      view.setFloat32(off,pts[pi][1],true);off+=4;
      view.setFloat32(off,pts[pi][2],true);off+=4;
    }
    view.setUint16(off,0,true);off+=2;
  }
  return buf;
}

function arrayBufferToBase64(buffer) {
  var bytes = new Uint8Array(buffer);
  var binary = "";
  var chunk = 8192;
  for (var i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function buildTriangles(contours, mode, targetWidth, imgW, wallThickness, extrudeHeight, bevelSteps, bevelBottom) {
  var scale = targetWidth / (imgW || 100);
  var allTris = [];
  for (var ci = 0; ci < contours.length; ci++) {
    var tris = mode === "frame"
      ? generateFrameMesh(contours[ci], wallThickness, extrudeHeight, scale, bevelSteps, bevelBottom)
      : generateSolidMesh(contours[ci], extrudeHeight, scale, bevelSteps, bevelBottom);
    allTris = allTris.concat(tris);
  }
  return allTris;
}

// =================== 3D PREVIEW ===================

function Preview3D({ triangles }) {
  var mountRef = useRef(null);
  var stateRef = useRef({});

  useEffect(function() {
    var el = mountRef.current;
    if (!el) return;
    var w = el.clientWidth;
    var h = 340;

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5efe6);
    var camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 5000);
    var renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.innerHTML = "";
    el.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    var d1 = new THREE.DirectionalLight(0xffffff, 0.9);
    d1.position.set(1,2,3); scene.add(d1);
    var d2 = new THREE.DirectionalLight(0xffffff, 0.3);
    d2.position.set(-2,-1,1); scene.add(d2);

    var grid = new THREE.GridHelper(300, 30, 0xd4c4b0, 0xe8ddd0);
    grid.position.y = -0.1;
    scene.add(grid);

    var rotX = -0.6, rotY = 0.35, dist = 200;
    var isDragging = false, prevX = 0, prevY = 0;
    var center = new THREE.Vector3(0,0,0);

    var updateCam = function() {
      camera.position.set(
        center.x + dist * Math.sin(rotX) * Math.cos(rotY),
        center.y + dist * Math.sin(rotY),
        center.z + dist * Math.cos(rotX) * Math.cos(rotY)
      );
      camera.lookAt(center);
    };

    var getP = function(e) { return e.touches ? e.touches[0] : e; };
    var onDown = function(e) { isDragging = true; var p = getP(e); prevX = p.clientX; prevY = p.clientY; };
    var onMove = function(e) {
      if (!isDragging) return;
      var p = getP(e);
      rotX += (p.clientX - prevX) * 0.008;
      rotY = Math.max(-1.3, Math.min(1.3, rotY + (p.clientY - prevY) * 0.008));
      prevX = p.clientX; prevY = p.clientY;
      updateCam();
    };
    var onUp = function() { isDragging = false; };
    var onWheel = function(e) { e.preventDefault(); dist = Math.max(30, Math.min(600, dist + e.deltaY * 0.3)); updateCam(); };

    var cvs = renderer.domElement;
    cvs.addEventListener("mousedown", onDown);
    cvs.addEventListener("touchstart", onDown, { passive: true });
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
    cvs.addEventListener("wheel", onWheel, { passive: false });

    stateRef.current = {
      scene: scene, camera: camera, renderer: renderer, center: center, mesh: null, grid: grid,
      updateDist: function(d) { dist = d; updateCam(); },
      updateCenter: function(cx,cy,cz) { center.set(cx,cy,cz); grid.position.set(cx,-0.1,cz); updateCam(); }
    };
    updateCam();

    var animId;
    var animate = function() { animId = requestAnimationFrame(animate); renderer.render(scene, camera); };
    animate();

    return function() {
      cancelAnimationFrame(animId);
      cvs.removeEventListener("mousedown", onDown);
      cvs.removeEventListener("touchstart", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
      cvs.removeEventListener("wheel", onWheel);
      renderer.dispose();
    };
  }, []);

  useEffect(function() {
    var s = stateRef.current;
    if (!s.scene) return;
    if (s.mesh) { s.scene.remove(s.mesh); s.mesh.geometry.dispose(); s.mesh.material.dispose(); }
    if (!triangles || triangles.length === 0) return;

    var geo = new THREE.BufferGeometry();
    var verts = new Float32Array(triangles.length * 9);
    for (var i = 0; i < triangles.length; i++) {
      for (var j = 0; j < 3; j++) {
        verts[i*9+j*3+0] = triangles[i][j][0];
        verts[i*9+j*3+1] = triangles[i][j][2];
        verts[i*9+j*3+2] = -triangles[i][j][1];
      }
    }
    geo.setAttribute("position", new THREE.BufferAttribute(verts, 3));

    var posArr = geo.attributes.position.array;
    var numVerts = posArr.length / 3;
    var vertMap = new Map();
    var uniqueVerts = [];
    var indices = [];
    var precision = 10000;
    for (var vi = 0; vi < numVerts; vi++) {
      var vx = posArr[vi*3], vy = posArr[vi*3+1], vz = posArr[vi*3+2];
      var vkey = (Math.round(vx*precision)) + "," + (Math.round(vy*precision)) + "," + (Math.round(vz*precision));
      if (!vertMap.has(vkey)) {
        vertMap.set(vkey, uniqueVerts.length / 3);
        uniqueVerts.push(vx, vy, vz);
      }
      indices.push(vertMap.get(vkey));
    }
    var indexedGeo = new THREE.BufferGeometry();
    indexedGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(uniqueVerts), 3));
    indexedGeo.setIndex(indices);
    indexedGeo.computeVertexNormals();

    var mat = new THREE.MeshStandardMaterial({
      color: 0xd4a76a, roughness: 0.4, metalness: 0.05, side: THREE.DoubleSide
    });
    var mesh = new THREE.Mesh(indexedGeo, mat);
    s.scene.add(mesh);
    s.mesh = mesh;

    indexedGeo.computeBoundingBox();
    var bb = indexedGeo.boundingBox;
    var ct = new THREE.Vector3(); bb.getCenter(ct);
    var sz = new THREE.Vector3(); bb.getSize(sz);
    var maxDim = Math.max(sz.x, sz.y, sz.z);
    s.updateCenter(ct.x, ct.y, ct.z);
    s.updateDist(maxDim * 2.2);
  }, [triangles]);

  return (
    <div ref={mountRef} style={{
      width: "100%", height: 340, borderRadius: 12, overflow: "hidden",
      border: "2px solid #e0d3c3", cursor: "grab", touchAction: "none"
    }} />
  );
}

// =================== MAIN COMPONENT ===================

export default function TextCircleTool() {
  var _s = useState, _r = useRef, _e = useEffect, _c = useCallback;

  var sa = _s("Hand\nin\nHand"), text = sa[0], setText = sa[1];
  var sb = _s(4), fontIdx = sb[0], setFontIdx = sb[1];
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
  var st = _s(null), previewDataUrl = st[0], setPreviewDataUrl = st[1];
  var su = _s(""), fontSearch = su[0], setFontSearch = su[1];
  var sv = _s(1.1), textOverlap = sv[0], setTextOverlap = sv[1];
  var sw = _s(true), enableConnectors = sw[0], setEnableConnectors = sw[1];
  var sx = _s(2.0), connectorThickness = sx[0], setConnectorThickness = sx[1];
  var sy = _s(0), textYOffset = sy[0], setTextYOffset = sy[1];

  _e(function() {
    loadFont(FONTS[fontIdx]);
  }, []);

  var computeFontSizeForWidth = function(ctx, fontFamily, fontWeight, txt, targetWidth) {
    var lo = 8, hi = 500;
    for (var i = 0; i < 25; i++) {
      var mid = (lo + hi) / 2;
      ctx.font = fontWeight + " " + mid + "px " + fontFamily;
      if (ctx.measureText(txt).width < targetWidth) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  };

  var renderAndExtract = _c(function() {
    var lines = text.split("\n").filter(function(l) { return l.trim(); });
    if (lines.length === 0) {
      setContours([]);
      setPreviewTris([]);
      setPreviewDataUrl(null);
      return;
    }

    var font = FONTS[fontIdx];
    loadFont(font).then(function() {
      var cv = document.createElement("canvas");
      var ctx = cv.getContext("2d");
      var fontWeight = bold ? "bold" : "normal";

      // Fixed canvas size — ellipse fills the canvas
      var cw = 800;
      var ch = Math.max(400, Math.round(800 / ellipseRatio));
      cv.width = cw;
      cv.height = ch;
      ctx = cv.getContext("2d");

      var ecx = cw / 2;
      var ecy = ch / 2 + textYOffset * 2;
      var margin = 20;
      var erx = cw / 2 - margin;
      var ery = ch / 2 - margin;
      var borderPx = borderThickness * 3;
      var irx = Math.max(1, erx - borderPx);
      var iry = Math.max(1, ery - borderPx);

      // 1. White background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, cw, ch);

      // 2. Black outer ellipse
      ctx.beginPath();
      ctx.ellipse(ecx, ecy, erx, ery, 0, 0, 2 * Math.PI);
      ctx.fillStyle = "#000000";
      ctx.fill();

      // 3. White inner ellipse (creates the ring)
      ctx.beginPath();
      ctx.ellipse(ecx, ecy, irx, iry, 0, 0, 2 * Math.PI);
      ctx.fillStyle = "#ffffff";
      ctx.fill();

      // 4. Compute line positions and font sizes
      var numLines = lines.length;
      var lineSpacing = padding * 2;
      var totalTextHeight;
      // Estimate line height with a test font size
      ctx.font = fontWeight + " 100px " + font.family;
      var testMetrics = ctx.measureText("Mg");
      var lineHeightRatio = 1.2; // approximate line height to font size ratio

      // Distribute lines vertically centered in the ellipse
      var lineInfos = [];
      // First pass: compute rough font sizes to estimate total height
      var roughSizes = [];
      for (var li = 0; li < numLines; li++) {
        // Assume even vertical distribution for first pass
        var roughY = ecy + ((li - (numLines - 1) / 2) * 100);
        var dy = roughY - ecy;
        var availW = 2 * irx * Math.sqrt(Math.max(0.01, 1 - (dy * dy) / (iry * iry)));
        var fs = computeFontSizeForWidth(ctx, font.family, fontWeight, lines[li], availW * textOverlap);
        roughSizes.push(Math.min(fs, iry * 2 / numLines));
      }

      // Compute total height and spacing
      var avgSize = roughSizes.reduce(function(a, b) { return a + b; }, 0) / roughSizes.length;
      var lineStep = avgSize * lineHeightRatio + lineSpacing;
      totalTextHeight = lineStep * (numLines - 1);

      // Second pass: compute actual positions and font sizes
      for (var li2 = 0; li2 < numLines; li2++) {
        var lineY = ecy + (li2 - (numLines - 1) / 2) * lineStep;
        var dy2 = lineY - ecy;
        // Available width at this y-position from ellipse equation
        var ratioSq = (dy2 * dy2) / (iry * iry);
        var availW2 = ratioSq >= 1 ? irx * 0.5 : 2 * irx * Math.sqrt(1 - ratioSq);
        var fontSize = computeFontSizeForWidth(ctx, font.family, fontWeight, lines[li2], availW2 * textOverlap);
        fontSize = Math.max(16, Math.min(fontSize, iry * 1.5));
        lineInfos.push({ text: lines[li2], y: lineY, fontSize: fontSize });
      }

      // 5. Draw text lines in black
      ctx.fillStyle = "#000000";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (var li3 = 0; li3 < lineInfos.length; li3++) {
        var info = lineInfos[li3];
        ctx.font = fontWeight + " " + info.fontSize + "px " + font.family;
        ctx.fillText(info.text, ecx, info.y);
      }

      // 6. Draw connector bars (bridges from text to ring)
      if (enableConnectors) {
        var connH = connectorThickness * 3;
        ctx.fillStyle = "#000000";
        for (var li4 = 0; li4 < lineInfos.length; li4++) {
          var inf = lineInfos[li4];
          ctx.font = fontWeight + " " + inf.fontSize + "px " + font.family;
          var measuredW = ctx.measureText(inf.text).width;
          var dy3 = inf.y - ecy;
          var ratioSq2 = (dy3 * dy3) / (iry * iry);
          if (ratioSq2 >= 1) continue;
          var ringInnerHalfW = irx * Math.sqrt(1 - ratioSq2);
          var textHalfW = measuredW / 2;

          // Left connector: from ring inner edge to text left edge
          var leftRingX = ecx - ringInnerHalfW;
          var leftTextX = ecx - textHalfW;
          if (leftTextX > leftRingX + 2) {
            ctx.fillRect(leftRingX - borderPx * 0.5, inf.y - connH / 2,
              leftTextX - leftRingX + borderPx * 0.5 + 2, connH);
          }

          // Right connector: from text right edge to ring inner edge
          var rightRingX = ecx + ringInnerHalfW;
          var rightTextX = ecx + textHalfW;
          if (rightTextX < rightRingX - 2) {
            ctx.fillRect(rightTextX - 2, inf.y - connH / 2,
              rightRingX - rightTextX + borderPx * 0.5 + 2, connH);
          }
        }
      }

      setPreviewDataUrl(cv.toDataURL());

      // 7. Extract contours via marching squares
      var data = ctx.getImageData(0, 0, cw, ch);
      var binary = new Uint8Array(cw * ch);
      for (var i = 0; i < cw * ch; i++) {
        var r = data.data[i*4], g = data.data[i*4+1], b2 = data.data[i*4+2];
        var gray = 0.299*r + 0.587*g + 0.114*b2;
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
      var cleanName = lines.join("_").replace(/[^a-zA-Z0-9äöüÄÖÜß_]/g, "").substring(0, 30);
      setFileName(cleanName || "text_circle");
    });
  }, [text, fontIdx, bold, padding, ellipseRatio, borderThickness, smoothIter, sharpAngle,
      textOverlap, enableConnectors, connectorThickness, textYOffset]);

  _e(function() {
    renderAndExtract();
  }, [renderAndExtract]);

  _e(function() {
    if (contours.length > 0) {
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

      <Section title="Text eingeben" desc="Gib den Text ein (Enter fuer neue Zeile, bis zu 3 Zeilen).">
        <textarea
          value={text}
          onChange={function(e) { setText(e.target.value); }}
          rows={3}
          placeholder={"Zeile 1\nZeile 2 (optional)\nZeile 3 (optional)"}
          style={{
            width: "100%", padding: "12px 16px", fontSize: 18, fontFamily: "inherit",
            border: "2px solid #d4bfa6", borderRadius: 12, background: "#fff",
            color: "#3d2e1f", outline: "none", resize: "vertical", lineHeight: 1.5
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
        <SliderRow label="Ellipsen-Form"
          desc="Verhaeltnis Breite zu Hoehe (1 = Kreis, hoeher = breiter)"
          value={ellipseRatio} min={0.8} max={2.5} step={0.05}
          onChange={setEllipseRatio} display={ellipseRatio.toFixed(2) + "x"} />
        <SliderRow label="Rahmen-Staerke"
          desc="Dicke des Ellipsen-Rahmens"
          value={borderThickness} min={0.5} max={6} step={0.25}
          onChange={setBorderThickness} display={borderThickness.toFixed(1)} />
        <SliderRow label="Text-Ueberlappung"
          desc="Wie weit Text ueber den Innenrand hinausreicht (>1 = Text kreuzt den Ring)"
          value={textOverlap} min={0.7} max={1.5} step={0.05}
          onChange={setTextOverlap} display={textOverlap.toFixed(2) + "x"} />
        <SliderRow label="Zeilen-Abstand"
          desc="Abstand zwischen den Textzeilen"
          value={padding} min={0} max={60} step={1}
          onChange={setPadding} display={padding + " px"} />
        <SliderRow label="Text vertikal verschieben"
          desc="Text nach oben oder unten verschieben"
          value={textYOffset} min={-50} max={50} step={1}
          onChange={setTextYOffset} display={textYOffset + " px"} />
        <div style={{ marginTop: 6, marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <PillButton active={enableConnectors} onClick={function() { setEnableConnectors(true); }}>
              Verbindungs-Stege an
            </PillButton>
            <PillButton active={!enableConnectors} onClick={function() { setEnableConnectors(false); }}>
              Verbindungs-Stege aus
            </PillButton>
          </div>
        </div>
        {enableConnectors && (
          <SliderRow label="Steg-Staerke"
            desc="Dicke der Verbindungsstege zwischen Text und Ring"
            value={connectorThickness} min={0.5} max={5} step={0.25}
            onChange={setConnectorThickness} display={connectorThickness.toFixed(1)} />
        )}
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
