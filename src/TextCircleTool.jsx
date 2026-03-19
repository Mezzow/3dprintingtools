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
    // Grow from the END
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
    // Grow from the START (fixes incomplete loops when starting mid-contour)
    changed = true;
    while (changed) {
      changed = false;
      var startKey = key(chain[0]);
      var neighbors2 = adj.get(startKey) || [];
      for (var ni2 = 0; ni2 < neighbors2.length; ni2++) {
        if (!used.has(neighbors2[ni2].idx)) {
          used.add(neighbors2[ni2].idx);
          chain.unshift(neighbors2[ni2].pt);
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

function pointInPolygon(pt, poly) {
  var x = pt[0], y = pt[1];
  var inside = false;
  for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    var yi = poly[i][1], yj = poly[j][1];
    if ((yi > y) !== (yj > y) &&
        x < (poly[j][0] - poly[i][0]) * (y - yi) / (yj - yi) + poly[i][0]) {
      inside = !inside;
    }
  }
  return inside;
}

function classifyContours(contours) {
  var infos = contours.map(function(c, i) {
    return { idx: i, contour: c, area: signedArea(c), children: [] };
  });

  // Find the largest contour (ring outer boundary) to determine outer sign convention
  var maxAbsArea = 0, outerSign = 1;
  for (var i = 0; i < infos.length; i++) {
    if (Math.abs(infos[i].area) > maxAbsArea) {
      maxAbsArea = Math.abs(infos[i].area);
      outerSign = infos[i].area < 0 ? -1 : 1;
    }
  }

  for (var i2 = 0; i2 < infos.length; i2++) {
    infos[i2].isOuter = (infos[i2].area * outerSign > 0);
  }

  var outers = infos.filter(function(c) { return c.isOuter; });
  var holes = infos.filter(function(c) { return !c.isOuter; });

  // Assign each hole to the smallest enclosing outer contour
  for (var hi = 0; hi < holes.length; hi++) {
    var holePt = holes[hi].contour[0];
    var bestOuter = null;
    var bestArea = Infinity;
    for (var oi = 0; oi < outers.length; oi++) {
      if (pointInPolygon(holePt, outers[oi].contour)) {
        var absArea = Math.abs(outers[oi].area);
        if (absArea < bestArea) {
          bestArea = absArea;
          bestOuter = oi;
        }
      }
    }
    if (bestOuter !== null) {
      outers[bestOuter].children.push(holes[hi]);
    }
  }

  return outers;
}

function bridgeHoleToOuter(outer, hole) {
  // Find rightmost vertex of hole
  var rightIdx = 0;
  for (var i = 1; i < hole.length; i++) {
    if (hole[i][0] > hole[rightIdx][0]) rightIdx = i;
  }
  var hp = hole[rightIdx];

  // Cast ray from hp in +X direction, find nearest intersection with outer edges
  var bestDist = Infinity, bestEdgeIdx = -1, bestPt = null;
  for (var i2 = 0; i2 < outer.length; i2++) {
    var j = (i2 + 1) % outer.length;
    var a = outer[i2], b = outer[j];
    if ((a[1] - hp[1]) * (b[1] - hp[1]) > 0) continue;
    if (a[1] === b[1]) continue;
    var t = (hp[1] - a[1]) / (b[1] - a[1]);
    if (t < 0 || t > 1) continue;
    var ix = a[0] + t * (b[0] - a[0]);
    if (ix < hp[0]) continue;
    var dist = ix - hp[0];
    if (dist < bestDist) {
      bestDist = dist;
      bestEdgeIdx = i2;
      bestPt = [ix, hp[1]];
    }
  }

  if (bestEdgeIdx < 0) return outer;

  // Find the endpoint of the intersected edge closest to intersection
  var ei = bestEdgeIdx;
  var ej = (ei + 1) % outer.length;
  var visIdx = (Math.hypot(outer[ei][0] - bestPt[0], outer[ei][1] - bestPt[1]) <
                Math.hypot(outer[ej][0] - bestPt[0], outer[ej][1] - bestPt[1])) ? ei : ej;

  // Build merged polygon: outer[0..visIdx] + hole[rightIdx..] + hole[..rightIdx] + outer[visIdx..]
  var merged = [];
  for (var m = 0; m <= visIdx; m++) merged.push(outer[m]);
  for (var m2 = 0; m2 < hole.length; m2++) merged.push(hole[(rightIdx + m2) % hole.length]);
  merged.push(hole[rightIdx]); // close hole loop back to bridge
  for (var m3 = visIdx; m3 < outer.length; m3++) merged.push(outer[m3]);

  return merged;
}

function earClipWithHoles(outer, holes) {
  if (!holes || holes.length === 0) return earClip(outer);

  // Sort holes by rightmost X descending (process rightmost first)
  var sortedHoles = holes.slice().sort(function(a, b) {
    var maxXa = -Infinity, maxXb = -Infinity;
    for (var i = 0; i < a.length; i++) if (a[i][0] > maxXa) maxXa = a[i][0];
    for (var i2 = 0; i2 < b.length; i2++) if (b[i2][0] > maxXb) maxXb = b[i2][0];
    return maxXb - maxXa;
  });

  var merged = outer.slice();
  for (var i = 0; i < sortedHoles.length; i++) {
    merged = bridgeHoleToOuter(merged, sortedHoles[i]);
  }

  return earClip(merged);
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

function generateSolidMesh(contour, height, scale, bevelSteps, bevelBottom, holeContours, skipCaps) {
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

  if (!skipCaps) {
    var topInset = profile[profile.length - 1].inset / scale;
    var botInset = profile[0].inset / scale;
    var topZ = profile[profile.length - 1].z;
    var botZ = profile[0].z;
    var topPoly = contour.map(function(p, i) {
      return [(p[0] - scaledNormals[i][0] * topInset) * scale, (p[1] - scaledNormals[i][1] * topInset) * scale];
    });

    // Build hole polygons for cap triangulation (with same inset)
    var holePolys = [];
    if (holeContours) {
      for (var hi = 0; hi < holeContours.length; hi++) {
        var hc = holeContours[hi];
        var hNormals = computeNormals(hc);
        holePolys.push(hc.map(function(p, idx) {
          return [(p[0] - hNormals[idx][0] * topInset) * scale, (p[1] - hNormals[idx][1] * topInset) * scale];
        }));
      }
    }

    var topTris = earClipWithHoles(topPoly, holePolys);
    for (var ti = 0; ti < topTris.length; ti++) {
      var t = topTris[ti];
      tris.push([[t[0][0],t[0][1],topZ],[t[1][0],t[1][1],topZ],[t[2][0],t[2][1],topZ]]);
      tris.push([[t[0][0],t[0][1],botZ],[t[2][0],t[2][1],botZ],[t[1][0],t[1][1],botZ]]);
    }
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

function extractContoursFromCanvas(ctx, cw, ch, smoothIter, sharpAngle) {
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
  return processed.filter(function(c) { return c.length >= 6; });
}


function buildTriangles(contours, targetWidth, imgW, extrudeHeight, bevelSteps, bevelBottom) {
  var scale = targetWidth / (imgW || 100);
  var classified = classifyContours(contours);
  var allTris = [];
  var bevelR = bevelSteps > 0 ? Math.min(extrudeHeight * 0.25, 1.2) : 0;

  for (var oi = 0; oi < classified.length; oi++) {
    var outer = classified[oi];
    var oc = outer.contour;
    if (oc.length < 3) continue;

    // Create THREE.Shape from outer contour (scaled to mm)
    var shape = new THREE.Shape();
    shape.moveTo(oc[0][0] * scale, oc[0][1] * scale);
    for (var i = 1; i < oc.length; i++) {
      shape.lineTo(oc[i][0] * scale, oc[i][1] * scale);
    }

    // Add hole paths
    for (var hi = 0; hi < outer.children.length; hi++) {
      var hc = outer.children[hi].contour;
      if (hc.length < 3) continue;
      var holePath = new THREE.Path();
      holePath.moveTo(hc[0][0] * scale, hc[0][1] * scale);
      for (var j = 1; j < hc.length; j++) {
        holePath.lineTo(hc[j][0] * scale, hc[j][1] * scale);
      }
      shape.holes.push(holePath);
    }

    // Use Three.js ExtrudeGeometry for robust triangulation (earcut-based)
    // This fixes the hollow/outline issue from the broken custom ear clipping
    var geo = new THREE.ExtrudeGeometry(shape, {
      depth: extrudeHeight,
      bevelEnabled: bevelSteps > 0,
      bevelThickness: bevelR,
      bevelSize: bevelR,
      bevelSegments: bevelSteps
    });

    // Extract triangles from geometry
    var posArr = geo.attributes.position.array;
    var idxArr = geo.index ? geo.index.array : null;
    if (idxArr) {
      for (var ti = 0; ti < idxArr.length; ti += 3) {
        var a = idxArr[ti], b = idxArr[ti + 1], c = idxArr[ti + 2];
        allTris.push([
          [posArr[a * 3], posArr[a * 3 + 1], posArr[a * 3 + 2]],
          [posArr[b * 3], posArr[b * 3 + 1], posArr[b * 3 + 2]],
          [posArr[c * 3], posArr[c * 3 + 1], posArr[c * 3 + 2]]
        ]);
      }
    } else {
      for (var vi = 0; vi < posArr.length; vi += 9) {
        allTris.push([
          [posArr[vi], posArr[vi + 1], posArr[vi + 2]],
          [posArr[vi + 3], posArr[vi + 4], posArr[vi + 5]],
          [posArr[vi + 6], posArr[vi + 7], posArr[vi + 8]]
        ]);
      }
    }
    geo.dispose();
  }

  // Shift geometry so minimum z is 0 (bevel may extend below)
  var minZ = Infinity;
  for (var ti2 = 0; ti2 < allTris.length; ti2++) {
    for (var tj = 0; tj < 3; tj++) {
      if (allTris[ti2][tj][2] < minZ) minZ = allTris[ti2][tj][2];
    }
  }
  if (minZ !== 0 && isFinite(minZ)) {
    for (var ti3 = 0; ti3 < allTris.length; ti3++) {
      for (var tj2 = 0; tj2 < 3; tj2++) {
        allTris[ti3][tj2][2] -= minZ;
      }
    }
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

  var sa = _s("Willkommen"), text = sa[0], setText = sa[1];
  var sb = _s(4), fontIdx = sb[0], setFontIdx = sb[1];
  var sc = _s(false), bold = sc[0], setBold = sc[1];
  var sd = _s(150), targetWidth = sd[0], setTargetWidth = sd[1];
  var se = _s(5), extrudeHeight = se[0], setExtrudeHeight = se[1];
  var sh = _s(4), bevelSteps = sh[0], setBevelSteps = sh[1];
  var si = _s(false), bevelBottom = si[0], setBevelBottom = si[1];
  var sj = _s(2), smoothIter = sj[0], setSmoothIter = sj[1];
  var sk = _s(120), sharpAngle = sk[0], setSharpAngle = sk[1];
  var sm = _s(1.3), ellipseRatio = sm[0], setEllipseRatio = sm[1];
  var sn = _s(5.0), borderThickness = sn[0], setBorderThickness = sn[1];
  var so = _s([]), contours = so[0], setContours = so[1];
  var sp = _s([]), previewTris = sp[0], setPreviewTris = sp[1];
  var sq = _s(null), downloadUrl = sq[0], setDownloadUrl = sq[1];
  var sr = _s(false), generating = sr[0], setGenerating = sr[1];
  var ss = _s(""), fileName = ss[0], setFileName = ss[1];
  var st = _s(null), previewDataUrl = st[0], setPreviewDataUrl = st[1];
  var su = _s(""), fontSearch = su[0], setFontSearch = su[1];
  var sv = _s(1.1), textOverlap = sv[0], setTextOverlap = sv[1];
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
    var line = text.trim();
    if (!line) {
      setContours([]);
      setPreviewTris([]);
      setPreviewDataUrl(null);
      return;
    }

    var font = FONTS[fontIdx];
    loadFont(font).then(function() {
      var cv = document.createElement("canvas");
      var fontWeight = bold ? "bold" : "normal";

      var cw = 800;
      var ch = Math.max(400, Math.round(800 / ellipseRatio));
      cv.width = cw;
      cv.height = ch;
      var ctx = cv.getContext("2d");

      var ecx = cw / 2;
      var ecy = ch / 2 + textYOffset * 2;
      var margin = 20;
      var erx = cw / 2 - margin;
      var ery = ch / 2 - margin;
      var borderPx = borderThickness * 4;
      var irx = Math.max(1, erx - borderPx);
      var iry = Math.max(1, ery - borderPx);

      // Compute font size to fit text within inner ellipse width * overlap factor
      var availW = 2 * irx * textOverlap;
      var fontSize = computeFontSizeForWidth(ctx, font.family, fontWeight, line, availW);
      fontSize = Math.max(16, Math.min(fontSize, iry * 1.5));

      // Helper: draw the base shape (ring + text) with given colors
      var drawBase = function(ringColor, textColor) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, cw, ch);
        // Ring: outer ellipse filled, inner ellipse white cutout
        ctx.beginPath();
        ctx.ellipse(ecx, ecy, erx, ery, 0, 0, 2 * Math.PI);
        ctx.fillStyle = ringColor;
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(ecx, ecy, irx, iry, 0, 0, 2 * Math.PI);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        // Filled text
        ctx.fillStyle = textColor;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = fontWeight + " " + fontSize + "px " + font.family;
        ctx.fillText(line, ecx, ecy);
      };

      // === Draw combined shape in black for contour extraction ===
      drawBase("#000000", "#000000");

      // Smart connectors: scan for gaps at text center and bridge only where needed
      var bridgeH = 3;
      ctx.font = fontWeight + " " + fontSize + "px " + font.family;
      var textMW = ctx.measureText(line).width;
      // Scan region spans from outer ring edge to outer ring edge (or text edge, whichever is wider)
      var scanLeft = Math.max(0, Math.floor(Math.min(ecx - erx, ecx - textMW / 2) - 2));
      var scanRight = Math.min(cw, Math.ceil(Math.max(ecx + erx, ecx + textMW / 2) + 2));
      var scanW = scanRight - scanLeft;
      var scanBandH = Math.max(6, Math.round(fontSize * 0.4));
      var scanTop = Math.max(0, Math.round(ecy - scanBandH / 2));
      var scanActualH = Math.min(ch - scanTop, scanBandH);

      var gapBridges = [];
      if (scanW > 0 && scanActualH > 0) {
        var sd = ctx.getImageData(scanLeft, scanTop, scanW, scanActualH);
        var colDark = new Array(scanW);
        for (var c = 0; c < scanW; c++) {
          colDark[c] = false;
          for (var r = 0; r < scanActualH; r++) {
            if (sd.data[(r * scanW + c) * 4] < 128) {
              colDark[c] = true;
              break;
            }
          }
        }

        // Find gaps between dark regions and bridge them
        var seenDark = false, inGap = false, gapStart = 0;
        ctx.fillStyle = "#000000";
        for (var c2 = 0; c2 < scanW; c2++) {
          if (colDark[c2]) {
            if (!seenDark) seenDark = true;
            if (inGap) {
              // Bridge this gap with thin strip, overlapping 2px into dark on each side
              var gX = scanLeft + gapStart - 2;
              var gW = c2 - gapStart + 4;
              ctx.fillRect(gX, ecy - bridgeH / 2, gW, bridgeH);
              gapBridges.push([gX, ecy - bridgeH / 2, gW, bridgeH]);
              inGap = false;
            }
          } else if (seenDark && !inGap) {
            inGap = true;
            gapStart = c2;
          }
        }
      }

      // Single-pass contour extraction from the combined shape
      var allContours = extractContoursFromCanvas(ctx, cw, ch, smoothIter, sharpAngle);
      setContours(allContours);

      // === PREVIEW IMAGE: redraw with visual distinction ===
      drawBase("#555555", "#000000");
      // Show bridges subtly in preview
      ctx.fillStyle = "#888888";
      for (var bi = 0; bi < gapBridges.length; bi++) {
        var b = gapBridges[bi];
        ctx.fillRect(b[0], b[1], b[2], b[3]);
      }
      // Draw ring outline for clarity
      ctx.beginPath();
      ctx.ellipse(ecx, ecy, erx, ery, 0, 0, 2 * Math.PI);
      ctx.strokeStyle = "#444444";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(ecx, ecy, irx, iry, 0, 0, 2 * Math.PI);
      ctx.stroke();

      setPreviewDataUrl(cv.toDataURL());

      setDownloadUrl(null);
      var cleanName = line.replace(/[^a-zA-Z0-9äöüÄÖÜß_]/g, "").substring(0, 30);
      setFileName(cleanName || "text_circle");
    });
  }, [text, fontIdx, bold, ellipseRatio, borderThickness, smoothIter, sharpAngle,
      textOverlap, textYOffset]);

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
      var tris = buildTriangles(contours, targetWidth, ew, extrudeHeight, bevelSteps, bevelBottom);
      setPreviewTris(tris);
    } else {
      setPreviewTris([]);
    }
  }, [contours, targetWidth, extrudeHeight, bevelSteps, bevelBottom]);

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
      var tris = buildTriangles(contours, targetWidth, ew, extrudeHeight, bevelSteps, bevelBottom);
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

      <Section title="Text eingeben" desc="Gib deinen Text ein.">
        <input
          type="text"
          value={text}
          onChange={function(e) { setText(e.target.value); }}
          placeholder="Willkommen"
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
        <SliderRow label="Ellipsen-Form"
          desc="Verhaeltnis Breite zu Hoehe (1 = Kreis, hoeher = breiter)"
          value={ellipseRatio} min={0.8} max={2.5} step={0.05}
          onChange={setEllipseRatio} display={ellipseRatio.toFixed(2) + "x"} />
        <SliderRow label="Rahmen-Staerke"
          desc="Dicke des Ellipsen-Rahmens"
          value={borderThickness} min={1} max={10} step={0.5}
          onChange={setBorderThickness} display={borderThickness.toFixed(1)} />
        <SliderRow label="Text-Ueberlappung"
          desc="Wie weit der Text ueber den Innenrand hinausreicht (>1 = Text kreuzt den Rahmen)"
          value={textOverlap} min={0.7} max={1.5} step={0.05}
          onChange={setTextOverlap} display={textOverlap.toFixed(2) + "x"} />
        <SliderRow label="Text vertikal verschieben"
          desc="Text nach oben oder unten verschieben"
          value={textYOffset} min={-50} max={50} step={1}
          onChange={setTextYOffset} display={textYOffset + " px"} />
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
