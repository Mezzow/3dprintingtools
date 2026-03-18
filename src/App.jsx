import { useState, useRef, useEffect, useCallback } from "react";
import * as THREE from "three";

// =================== CONTOUR EXTRACTION ===================

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

// Douglas-Peucker simplification - reduces to key shape points
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

// DP on a closed polygon - split at opposite points to avoid seam artifacts
function simplifyClosedContour(pts, epsilon) {
  if (pts.length < 6) return pts;
  // Split at index 0 and n/2 (opposite sides of contour)
  var half = Math.floor(pts.length / 2);
  var seg1 = pts.slice(0, half + 1);
  var seg2 = pts.slice(half).concat([pts[0]]);
  var s1 = douglasPeucker(seg1, epsilon);
  var s2 = douglasPeucker(seg2, epsilon);
  // Merge, removing duplicate junction points
  var result = s1.slice(0, -1).concat(s2.slice(0, -1));
  return result;
}

// Compute angle (in degrees) at vertex i in a closed polygon
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

// Weighted Laplacian smoothing: each point moves toward its neighbors
// but the amount depends on the angle - sharp corners barely move, gentle curves move a lot
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

      // weight: 0 at sharp corners, ramps to 0.5 for gentle curves
      // smooth transition zone between sharp and 180
      var w;
      if (angle < sharp) {
        w = 0; // sharp corner - don't move
      } else if (angle < sharp + 40) {
        w = 0.5 * (angle - sharp) / 40; // transition zone
      } else {
        w = 0.5; // gentle curve - full smoothing
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

// Chaikin subdivision (adds points for resolution, no corner cutting on sharp verts)
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
        // Sharp corner: keep the original point, add midpoint to next
        newPts.push(p0);
        newPts.push([(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2]);
      } else {
        // Gentle curve: standard Chaikin quarter-points
        newPts.push([0.75 * p0[0] + 0.25 * p1[0], 0.75 * p0[1] + 0.25 * p1[1]]);
        newPts.push([0.25 * p0[0] + 0.75 * p1[0], 0.25 * p0[1] + 0.75 * p1[1]]);
      }
    }
    pts = newPts;
  }
  return pts;
}

// Resample contour to evenly spaced points - walk at uniform arc-length steps
function resampleUniform(pts, spacing) {
  if (pts.length < 3) return pts;
  var n = pts.length;
  // Build cumulative distances
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

// Full contour processing pipeline
function processContour(rawChain, smoothLevel, imgW, sharpAngle) {
  // 1. Simplify to key shape points
  var epsilon = Math.max(0.3, imgW * 0.002);
  var simplified = simplifyClosedContour(rawChain, epsilon);
  if (simplified.length < 3) return simplified;

  if (smoothLevel <= 0) {
    // No smoothing - just resample for clean mesh
    var targetSpacing = Math.max(0.3, imgW * 0.003);
    return resampleUniform(simplified, targetSpacing);
  }

  // 2. Subdivide to add resolution (corner-aware)
  var subdivided = subdivide(simplified, 1, sharpAngle);

  // 3. Weighted Laplacian smooth (corners stay, curves round out)
  var laplacianIter = smoothLevel * 2;
  var smoothed = smoothWeighted(subdivided, laplacianIter, sharpAngle);

  // 4. Resample to uniform spacing for clean mesh
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

// Generate frame mesh with beveled (rounded) edges
function generateFrameMesh(contour, wallThick, height, scale, bevelSteps, bevelBottom) {
  var n = contour.length;
  if (n < 3) return [];
  var normals = computeNormals(contour);
  var tris = [];
  var half = wallThick / (2 * scale);
  var h = height / scale;
  var bevelR = Math.min(wallThick * 0.35, height * 0.35) / scale;
  var steps = bevelSteps || 4;

  // Build profile: array of {z, inset} describing the cross-section
  var profile = [];
  if (bevelBottom && steps > 0) {
    // Bottom bevel
    for (var s = 0; s <= steps; s++) {
      var angle = (s / steps) * Math.PI / 2;
      profile.push({ z: bevelR * (1 - Math.cos(angle)), inset: bevelR * (1 - Math.sin(angle)) });
    }
  } else {
    // Flat bottom
    profile.push({ z: 0, inset: 0 });
  }
  if (steps > 0) {
    // Top bevel
    for (var s2 = steps; s2 >= 0; s2--) {
      var angle2 = (s2 / steps) * Math.PI / 2;
      profile.push({ z: h - bevelR * (1 - Math.cos(angle2)), inset: bevelR * (1 - Math.sin(angle2)) });
    }
  } else {
    // Flat top
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

  // Side walls with bevel profile
  for (var i = 0; i < n; i++) {
    var j = (i + 1) % n;
    for (var pi = 0; pi < profile.length - 1; pi++) {
      // Outer wall
      tris.push([mkPt(i,true,pi), mkPt(j,true,pi), mkPt(j,true,pi+1)]);
      tris.push([mkPt(i,true,pi), mkPt(j,true,pi+1), mkPt(i,true,pi+1)]);
      // Inner wall
      tris.push([mkPt(j,false,pi), mkPt(i,false,pi), mkPt(i,false,pi+1)]);
      tris.push([mkPt(j,false,pi), mkPt(i,false,pi+1), mkPt(j,false,pi+1)]);
    }
    // Top cap
    var topIdx = profile.length - 1;
    tris.push([mkPt(i,true,topIdx), mkPt(j,true,topIdx), mkPt(j,false,topIdx)]);
    tris.push([mkPt(i,true,topIdx), mkPt(j,false,topIdx), mkPt(i,false,topIdx)]);
    // Bottom cap
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

// Solid mesh with beveled edges
function generateSolidMesh(contour, height, scale, bevelSteps, bevelBottom) {
  var n = contour.length;
  if (n < 3) return [];
  var tris = [];
  var h = height;
  var normals = computeNormals(contour);
  var bevelR = Math.min(height * 0.3, 1.5);
  var steps = bevelSteps || 4;
  var scaled = contour.map(function(p) { return [p[0] * scale, p[1] * scale]; });
  var scaledNormals = normals;

  // Build bevel profile
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

  // Side walls with bevel
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
  // Top and bottom caps (at the inset positions)
  var topInset = profile[profile.length - 1].inset / scale;
  var botInset = profile[0].inset / scale;
  var topZ = profile[profile.length - 1].z;
  var botZ = profile[0].z;
  var topPoly = contour.map(function(p, i) {
    return [(p[0] - scaledNormals[i][0] * topInset) * scale, (p[1] - scaledNormals[i][1] * topInset) * scale];
  });
  var botPoly = contour.map(function(p, i) {
    return [(p[0] - scaledNormals[i][0] * botInset) * scale, (p[1] - scaledNormals[i][1] * botInset) * scale];
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
  var header = "Image-to-STL";
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

    // Merge coincident vertices so normals get averaged = smooth shading
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

// =================== CROP OVERLAY ===================

function CropOverlay(props) {
  var crop = props.crop;
  var onChange = props.onChange;
  var containerRef = props.containerRef;
  var dragRef = useRef(null);

  var getPos = function(e) {
    var el = containerRef.current;
    if (!el) return null;
    var rect = el.getBoundingClientRect();
    var t = e.touches ? e.touches[0] : e;
    return {
      x: Math.max(0, Math.min(1, (t.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (t.clientY - rect.top) / rect.height))
    };
  };

  var clampCrop = function(c) {
    var x = Math.max(0, Math.min(1 - 0.05, c.x));
    var y = Math.max(0, Math.min(1 - 0.05, c.y));
    var w = Math.max(0.05, Math.min(1 - x, c.w));
    var h = Math.max(0.05, Math.min(1 - y, c.h));
    return { x: x, y: y, w: w, h: h };
  };

  var onDown = function(e, handle) {
    e.stopPropagation();
    e.preventDefault();
    var startPos = getPos(e);
    if (!startPos) return;
    var startCrop = { x: crop.x, y: crop.y, w: crop.w, h: crop.h };
    dragRef.current = { handle: handle, startPos: startPos, startCrop: startCrop };

    var onMoveHandler = function(ev) {
      var pos = ev.touches ? getPos(ev) : getPos(ev);
      if (!pos || !dragRef.current) return;
      var dx = pos.x - dragRef.current.startPos.x;
      var dy = pos.y - dragRef.current.startPos.y;
      var sc = dragRef.current.startCrop;
      var nc;

      if (dragRef.current.handle === "move") {
        nc = { x: sc.x + dx, y: sc.y + dy, w: sc.w, h: sc.h };
      } else if (dragRef.current.handle === "tl") {
        nc = { x: sc.x + dx, y: sc.y + dy, w: sc.w - dx, h: sc.h - dy };
      } else if (dragRef.current.handle === "tr") {
        nc = { x: sc.x, y: sc.y + dy, w: sc.w + dx, h: sc.h - dy };
      } else if (dragRef.current.handle === "bl") {
        nc = { x: sc.x + dx, y: sc.y, w: sc.w - dx, h: sc.h + dy };
      } else if (dragRef.current.handle === "br") {
        nc = { x: sc.x, y: sc.y, w: sc.w + dx, h: sc.h + dy };
      } else {
        nc = sc;
      }
      onChange(clampCrop(nc));
    };
    var onUpHandler = function() {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMoveHandler);
      window.removeEventListener("touchmove", onMoveHandler);
      window.removeEventListener("mouseup", onUpHandler);
      window.removeEventListener("touchend", onUpHandler);
    };
    window.addEventListener("mousemove", onMoveHandler);
    window.addEventListener("touchmove", onMoveHandler, { passive: false });
    window.addEventListener("mouseup", onUpHandler);
    window.addEventListener("touchend", onUpHandler);
  };

  var pct = function(v) { return (v * 100) + "%"; };
  var hSize = 14;
  var hOff = -7;

  var handleStyle = function(top, left) {
    return {
      position: "absolute", width: hSize, height: hSize,
      background: "#fff", border: "2px solid #c97d44", borderRadius: 3,
      top: top, left: left, cursor: "pointer", zIndex: 5,
      boxShadow: "0 1px 4px rgba(0,0,0,0.3)"
    };
  };

  return (
    <div style={{
      position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
      zIndex: 3, borderRadius: 10
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, width: pct(crop.x), height: "100%",
        background: "rgba(0,0,0,0.45)"
      }} />
      <div style={{
        position: "absolute", top: 0, left: pct(crop.x + crop.w), right: 0, height: "100%",
        background: "rgba(0,0,0,0.45)"
      }} />
      <div style={{
        position: "absolute", top: 0, left: pct(crop.x), width: pct(crop.w), height: pct(crop.y),
        background: "rgba(0,0,0,0.45)"
      }} />
      <div style={{
        position: "absolute", top: pct(crop.y + crop.h), left: pct(crop.x), width: pct(crop.w), bottom: 0,
        background: "rgba(0,0,0,0.45)"
      }} />

      <div
        onMouseDown={function(e) { onDown(e, "move"); }}
        onTouchStart={function(e) { onDown(e, "move"); }}
        style={{
          position: "absolute",
          left: pct(crop.x), top: pct(crop.y),
          width: pct(crop.w), height: pct(crop.h),
          border: "2px solid #c97d44",
          cursor: "move", boxSizing: "border-box",
          background: "transparent"
        }}
      >
        <div
          onMouseDown={function(e) { onDown(e, "tl"); }}
          onTouchStart={function(e) { onDown(e, "tl"); }}
          style={handleStyle(hOff, hOff)} />
        <div
          onMouseDown={function(e) { onDown(e, "tr"); }}
          onTouchStart={function(e) { onDown(e, "tr"); }}
          style={handleStyle(hOff, "calc(100% - 7px)")} />
        <div
          onMouseDown={function(e) { onDown(e, "bl"); }}
          onTouchStart={function(e) { onDown(e, "bl"); }}
          style={handleStyle("calc(100% - 7px)", hOff)} />
        <div
          onMouseDown={function(e) { onDown(e, "br"); }}
          onTouchStart={function(e) { onDown(e, "br"); }}
          style={handleStyle("calc(100% - 7px)", "calc(100% - 7px)")} />
      </div>
    </div>
  );
}

// =================== MAIN ===================

var PROCESS_SIZE = 600;

export default function ImageToSTL() {
  var _s = useState, _r = useRef, _e = useEffect, _c = useCallback;
  var sa = _s(null), imgSrc = sa[0], setImgSrc = sa[1];
  var sb = _s(null), imgSize = sb[0], setImgSize = sb[1];
  var sc = _s(128), threshold = sc[0], setThreshold = sc[1];
  var sd = _s(false), invert = sd[0], setInvert = sd[1];
  var se = _s(150), targetWidth = se[0], setTargetWidth = se[1];
  var sf = _s(5), extrudeHeight = sf[0], setExtrudeHeight = sf[1];
  var sg = _s(2.0), wallThickness = sg[0], setWallThickness = sg[1];
  var sh = _s("frame"), mode = sh[0], setMode = sh[1];
  var si = _s(2), smoothIter = si[0], setSmoothIter = si[1];
  var sj = _s([]), contours = sj[0], setContours = sj[1];
  var sk = _s(false), generating = sk[0], setGenerating = sk[1];
  var sl = _s(null), downloadUrl = sl[0], setDownloadUrl = sl[1];
  var sm = _s(false), dragOver = sm[0], setDragOver = sm[1];
  var sn = _s(""), fileName = sn[0], setFileName = sn[1];
  var so = _s([]), previewTris = so[0], setPreviewTris = so[1];
  var sp = _s(4), bevelSteps = sp[0], setBevelSteps = sp[1];
  var sq = _s(null), crop = sq[0], setCrop = sq[1];
  var sr = _s(false), cropActive = sr[0], setCropActive = sr[1];
  var ss = _s(120), sharpAngle = ss[0], setSharpAngle = ss[1];
  var st = _s(false), bevelBottom = st[0], setBevelBottom = st[1];

  var canvasRef = _r(null);
  var overlayRef = _r(null);
  var fileRef = _r(null);
  var rawContoursRef = _r([]);
  var cropContainerRef = _r(null);
  var imgObjRef = _r(null);

  var processImage = _c(function(img) {
    imgObjRef.current = img;
    var iw = img.width, ih = img.height;
    var ratio = Math.min(PROCESS_SIZE / iw, PROCESS_SIZE / ih, 1);
    var w = Math.round(iw * ratio);
    var h = Math.round(ih * ratio);
    setImgSize({ w: w, h: h });

    var cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    var ctx = cv.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    var data = ctx.getImageData(0, 0, w, h);

    // Compute crop bounds in pixel coords
    var cx0 = 0, cy0 = 0, cx1 = w, cy1 = h;
    if (crop) {
      cx0 = Math.round(crop.x * w);
      cy0 = Math.round(crop.y * h);
      cx1 = Math.round((crop.x + crop.w) * w);
      cy1 = Math.round((crop.y + crop.h) * h);
    }

    var binary = new Uint8Array(w * h);
    for (var iy = 0; iy < h; iy++) {
      for (var ix = 0; ix < w; ix++) {
        var i = iy * w + ix;
        // Outside crop = always off
        if (ix < cx0 || ix >= cx1 || iy < cy0 || iy >= cy1) {
          binary[i] = 0;
          continue;
        }
        var r = data.data[i*4], g = data.data[i*4+1], b = data.data[i*4+2], a = data.data[i*4+3];
        var gray = (0.299*r + 0.587*g + 0.114*b) * (a / 255);
        binary[i] = (invert ? gray >= threshold : gray < threshold) ? 1 : 0;
      }
    }

    var pv = canvasRef.current;
    if (pv) {
      pv.width = w; pv.height = h;
      var pc = pv.getContext("2d");
      var pd = pc.createImageData(w, h);
      for (var i2 = 0; i2 < w * h; i2++) {
        var v = binary[i2] ? 40 : 240;
        pd.data[i2*4]=v; pd.data[i2*4+1]=v; pd.data[i2*4+2]=v; pd.data[i2*4+3]=255;
      }
      pc.putImageData(pd, 0, 0);
    }

    var segments = marchingSquares(binary, w, h);
    var chains = chainSegments(segments);
    // Close contours
    chains = chains.map(function(c) {
      var d = Math.hypot(c[0][0]-c[c.length-1][0], c[0][1]-c[c.length-1][1]);
      return d < 2 ? c.slice(0,-1) : c;
    }).filter(function(c) { return c.length >= 6; });

    rawContoursRef.current = chains;
    // Full pipeline: simplify -> smooth -> resample uniformly
    var processed = chains.map(function(c) { return processContour(c, smoothIter, w, sharpAngle); });
    processed = processed.filter(function(c) { return c.length >= 6; });
    setContours(processed);
    setDownloadUrl(null);

    // Draw overlay
    var ov = overlayRef.current;
    if (ov) {
      ov.width = w; ov.height = h;
      var oc = ov.getContext("2d");
      oc.clearRect(0, 0, w, h);
      oc.strokeStyle = "#e07840";
      oc.lineWidth = 1.5;
      for (var ci = 0; ci < processed.length; ci++) {
        var chain = processed[ci];
        oc.beginPath();
        oc.moveTo(chain[0][0], chain[0][1]);
        for (var k = 1; k < chain.length; k++) oc.lineTo(chain[k][0], chain[k][1]);
        oc.closePath();
        oc.stroke();
      }
    }
  }, [threshold, invert, smoothIter, crop, sharpAngle]);

  // Effective image width for scaling (crop-adjusted)
  var effectiveW = imgSize ? (crop ? imgSize.w * crop.w : imgSize.w) : 100;

  // Rebuild preview when mesh settings change
  _e(function() {
    if (contours.length > 0 && imgSize) {
      var tris = buildTriangles(contours, mode, targetWidth, effectiveW, wallThickness, extrudeHeight, bevelSteps, bevelBottom);
      setPreviewTris(tris);
    } else {
      setPreviewTris([]);
    }
  }, [contours, mode, targetWidth, wallThickness, extrudeHeight, imgSize, bevelSteps, bevelBottom, effectiveW]);

  _e(function() {
    if (!imgSrc) return;
    if (imgObjRef.current && imgObjRef.current.src === imgSrc) {
      processImage(imgObjRef.current);
      return;
    }
    var img = new Image();
    img.onload = function() { processImage(img); };
    img.src = imgSrc;
  }, [imgSrc, processImage]);

  var handleFile = function(file) {
    if (!file) return;
    setFileName(file.name.replace(/\.[^.]+$/, ""));
    var reader = new FileReader();
    reader.onload = function(e) { setImgSrc(e.target.result); };
    reader.readAsDataURL(file);
  };

  var handleDrop = function(e) {
    e.preventDefault(); setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  var generateSTL = function() {
    if (contours.length === 0) return;
    setGenerating(true);
    setDownloadUrl(null);
    setTimeout(function() {
      var tris = buildTriangles(contours, mode, targetWidth, effectiveW, wallThickness, extrudeHeight, bevelSteps, bevelBottom);
      var buf = buildSTLBuffer(tris);
      var b64 = arrayBufferToBase64(buf);
      var dataUri = "data:application/octet-stream;base64," + b64;
      setDownloadUrl(dataUri);
      try {
        var a = document.createElement("a");
        a.href = dataUri;
        a.download = (fileName || "modell") + ".stl";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch(err) {}
      setGenerating(false);
    }, 100);
  };

  var totalPoints = contours.reduce(function(s,c) { return s + c.length; }, 0);
  var hasContours = contours.length > 0;

  return (
      <div style={{ width: "100%", maxWidth: 540, display: "flex", flexDirection: "column", gap: 14 }}>

        <div
          onDragOver={function(e) { e.preventDefault(); setDragOver(true); }}
          onDragLeave={function() { setDragOver(false); }}
          onDrop={handleDrop}
          onClick={function() { if (!imgSrc && !cropActive) fileRef.current && fileRef.current.click(); }}
          style={{
            border: "3px dashed " + (dragOver ? "#c97d44" : "#d4bfa6"),
            borderRadius: 16, padding: imgSrc ? 0 : 44,
            textAlign: "center", cursor: imgSrc ? "default" : "pointer",
            background: dragOver ? "#f5e6d3" : "#fff",
            transition: "all 0.2s ease",
            overflow: "hidden"
          }}
        >
          <input ref={fileRef} type="file" accept="image/*,.svg" style={{ display: "none" }}
            onChange={function(e) { handleFile(e.target.files[0]); }} />

          {!imgSrc ? (
            <div>
              <div style={{ fontSize: 42, marginBottom: 8, opacity: 0.7 }}>+</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#6b4c30" }}>
                Bild hier reinziehen
              </div>
              <div style={{ fontSize: 14, color: "#9a7d5f", marginTop: 4 }}>
                oder antippen um eine Datei zu waehlen (PNG, JPG, SVG)
              </div>
              <div style={{ fontSize: 12, color: "#bba88e", marginTop: 12, lineHeight: 1.6 }}>
                Am besten funktionieren einfache Silhouetten auf hellem Hintergrund.
              </div>
            </div>
          ) : (
            <div ref={cropContainerRef} style={{ position: "relative", display: "inline-block", width: "100%" }}>
              <canvas ref={canvasRef} style={{ width: "100%", display: "block", borderRadius: 10, imageRendering: "pixelated" }} />
              <canvas ref={overlayRef} style={{
                position: "absolute", top: 0, left: 0,
                width: "100%", height: "100%", borderRadius: 10, pointerEvents: "none"
              }} />
              {cropActive && crop && (
                <CropOverlay crop={crop} onChange={setCrop} containerRef={cropContainerRef} />
              )}
            </div>
          )}
        </div>

        {imgSrc && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <PillButton active={cropActive} onClick={function() {
              if (!cropActive) {
                setCrop({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
                setCropActive(true);
              } else {
                setCropActive(false);
              }
            }}>
              {cropActive ? "Bereich-Auswahl aus" : "Bereich auswaehlen"}
            </PillButton>
            {cropActive && (
              <PillButton active={false} onClick={function() {
                setCrop(null);
                setCropActive(false);
              }}>
                Auswahl zuruecksetzen (ganzes Bild)
              </PillButton>
            )}
            <PillButton active={false} onClick={function() { fileRef.current && fileRef.current.click(); }}>
              Anderes Bild
            </PillButton>
          </div>
        )}

        {imgSrc && (
          <>
            <Section title="Schritt 1 - Umriss erkennen"
              desc="Stelle ein, welche Teile des Bildes als Form erkannt werden sollen.">
              <SliderRow label="Helligkeits-Schwelle"
                desc="Ab welcher Helligkeit etwas als Form gilt"
                value={threshold} min={10} max={245} step={1}
                onChange={setThreshold} display={threshold} />
              <SliderRow label="Kurven-Glaettung"
                desc="Rundet Kurven, scharfe Ecken bleiben erhalten (0 = keine Glaettung)"
                value={smoothIter} min={0} max={5} step={1}
                onChange={setSmoothIter} display={smoothIter === 0 ? "Aus" : smoothIter + "x"} />
              {smoothIter > 0 && (
                <SliderRow label="Ecken-Schutz"
                  desc="Welche Ecken beim Glaetten geschuetzt werden (hoeher = mehr Ecken bleiben scharf)"
                  value={sharpAngle} min={60} max={150} step={5}
                  onChange={setSharpAngle} display={sharpAngle + " Grad"} />
              )}
              <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                <PillButton active={!invert} onClick={function() { setInvert(false); }}>Dunkle Formen</PillButton>
                <PillButton active={invert} onClick={function() { setInvert(true); }}>Helle Formen</PillButton>
              </div>
              <div style={{
                fontSize: 13, marginTop: 8, borderRadius: 8, padding: "7px 10px",
                background: hasContours ? "#f0f7ec" : "#fdf2e9",
                color: hasContours ? "#4a6b3a" : "#9a6030"
              }}>
                {!hasContours
                  ? "Kein Umriss gefunden - Schwelle oder Erkennung aendern"
                  : contours.length + " Umriss" + (contours.length !== 1 ? "e" : "") + " erkannt, " + totalPoints + " Punkte"}
              </div>
            </Section>

            <Section title="Schritt 2 - Groesse und Form"
              desc="Wie gross, dick und rund soll dein 3D-Druck werden?">
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
              {bevelSteps > 0 && (
                <div style={{ fontSize: 11, color: "#9a7d5f", marginBottom: 4, lineHeight: 1.4 }}>
                  {bevelBottom
                    ? "Beide Seiten abgerundet - sieht huebscher aus, aber schwieriger zu drucken"
                    : "Flacher Boden = optimale Druckbett-Haftung, einfach zu drucken"}
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
              <div style={{ fontSize: 12, color: "#9a7d5f", marginTop: 8, lineHeight: 1.5 }}>
                {mode === "frame"
                  ? "Rahmen = nur die Kontur - ideal fuer Kraenze, Deko-Rahmen, Verzierungen"
                  : "Massiv = ganze Flaeche gefuellt - ideal fuer Ausstechformen, Schilder, Untersetzer"}
              </div>
            </Section>

            {previewTris.length > 0 && (
              <Section title="Schritt 3 - 3D-Vorschau"
                desc="So wird dein Objekt aussehen. Ziehen zum Drehen, Scrollen zum Zoomen.">
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
                <a href={downloadUrl} download={(fileName || "modell") + ".stl"}
                  style={{
                    display: "inline-block", padding: "12px 32px",
                    background: "#5a9a42", color: "#fff", borderRadius: 10,
                    fontSize: 17, fontWeight: 800, textDecoration: "none",
                    fontFamily: "inherit"
                  }}
                >
                  Hier tippen zum Speichern
                </a>
                <div style={{ fontSize: 12, color: "#6b8a5a", marginTop: 8, lineHeight: 1.5 }}>
                  Falls nichts passiert: lange druecken oder Rechtsklick, dann speichern
                </div>
              </div>
            )}

            <button onClick={function() { setImgSrc(null); setContours([]); setDownloadUrl(null); setPreviewTris([]); setCrop(null); setCropActive(false); imgObjRef.current = null; }}
              style={{
                background: "none", border: "none", color: "#9a7d5f",
                fontSize: 14, cursor: "pointer", fontFamily: "inherit", padding: 8
              }}>
              Neu starten mit anderem Bild
            </button>
          </>
        )}
      </div>
  );
}

// =================== UI COMPONENTS ===================

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
