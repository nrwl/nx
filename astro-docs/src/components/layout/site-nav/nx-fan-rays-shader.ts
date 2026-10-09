// WebGL2 shader for the footer fan rays, ported from the nx.dev (Framer)
// "Nx Fan Rays" code component. Keep in sync with the nx.dev footer.

export const VERTEX_SHADER = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export const FRAGMENT_SHADER = `#version 300 es
#define varying in
out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
precision highp float;

varying vec2 vUv;

uniform vec2 uRes;
uniform float uTime;
uniform vec2 uVanishing;
uniform float uRotation; // radians, clockwise
uniform float uSteps;
uniform float uF1;
uniform float uF2;
uniform float uF3;
uniform float uSp1;
uniform float uSp2;
uniform float uSp3;
uniform float uAngleMin;
uniform float uAngleMax;
uniform float uFalloff;
uniform float uFalloffCurve; // 0 linear, 1 quadratic, 2 exponential
uniform float uEdgeSharp;
uniform float uGap;
uniform float uGradient; // lengthwise ramp travel along each ray
uniform float uSync; // 1 = bands pulse together, 0 = phases scattered
uniform float uGrainAmount;
uniform float uGrainScale;
uniform float uGrainAnimated;
uniform float uTemplate; // 0 fan, 1 hourglass, 2 corridor, 3 network, 4 stream, 5 beam, 6 horn, 7 box
uniform float uCurve;
uniform float uStrokes; // 0 fill, 1 strokes
uniform vec3 uBg;
uniform int uStopCount;
uniform vec3 uStopColors[8];
uniform float uStopPos[8];
uniform float uInterpMode; // 0 RGB, 1 HSL, 2 OKLCH
uniform vec3 uBoxGrad0; // Box tunnel gradient, top stop
uniform vec3 uBoxGrad1; // Box tunnel gradient, middle stop
uniform vec3 uBoxGrad2; // Box tunnel gradient, bottom stop
uniform float uBoxInvertBg; // 1 = background gradient flipped vertically
uniform float uBoxBloomDepth; // ring iteration the core bloom starts from

/** Brand Neutral 700 (#40403E) — casing colour for the outlined pipes. */
const vec3 NEUTRAL_700 = vec3(0.250980, 0.250980, 0.243137);

/**
 * Box only: radius of the outermost ring, in canvas units. Just past the
 * farthest corner of a 16:9 frame from a centred vanishing point, so the
 * frames cover the canvas edge to edge.
 */
const float BOX_OUTER = 0.9;

// ---- Color spaces -----------------------------------------------------------

vec3 rgb2hsl(vec3 c) {
  float maxc = max(c.r, max(c.g, c.b));
  float minc = min(c.r, min(c.g, c.b));
  float l = (maxc + minc) * 0.5;
  float d = maxc - minc;
  if (d < 1e-5) return vec3(0.0, 0.0, l);
  float s = l > 0.5 ? d / (2.0 - maxc - minc) : d / (maxc + minc);
  float h;
  if (maxc == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
  else if (maxc == c.g) h = (c.b - c.r) / d + 2.0;
  else h = (c.r - c.g) / d + 4.0;
  return vec3(h / 6.0, s, l);
}

float hue2rgb(float p, float q, float t) {
  if (t < 0.0) t += 1.0;
  if (t > 1.0) t -= 1.0;
  if (t < 1.0 / 6.0) return p + (q - p) * 6.0 * t;
  if (t < 0.5) return q;
  if (t < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
  return p;
}

vec3 hsl2rgb(vec3 c) {
  if (c.y < 1e-5) return vec3(c.z);
  float q = c.z < 0.5 ? c.z * (1.0 + c.y) : c.z + c.y - c.z * c.y;
  float p = 2.0 * c.z - q;
  return vec3(hue2rgb(p, q, c.x + 1.0 / 3.0), hue2rgb(p, q, c.x), hue2rgb(p, q, c.x - 1.0 / 3.0));
}

// Compact OKLab / OKLCH helpers (Björn Ottosson)
vec3 linearSrgbToOklab(vec3 c) {
  float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
  float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
  float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;
  float l_ = pow(l, 1.0 / 3.0);
  float m_ = pow(m, 1.0 / 3.0);
  float s_ = pow(s, 1.0 / 3.0);
  return vec3(
    0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
  );
}

vec3 oklabToLinearSrgb(vec3 c) {
  float l_ = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m_ = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s_ = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  float l = l_ * l_ * l_;
  float m = m_ * m_ * m_;
  float s = s_ * s_ * s_;
  return vec3(
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  );
}

vec3 srgbToLinear(vec3 c) {
  return pow(max(c, 0.0), vec3(2.2));
}

vec3 linearToSrgb(vec3 c) {
  return pow(max(c, 0.0), vec3(1.0 / 2.2));
}

vec3 rgb2oklch(vec3 rgb) {
  vec3 lab = linearSrgbToOklab(srgbToLinear(rgb));
  float C = length(lab.yz);
  float h = atan(lab.z, lab.y);
  return vec3(lab.x, C, h);
}

vec3 oklch2rgb(vec3 lch) {
  vec3 lab = vec3(lch.x, cos(lch.z) * lch.y, sin(lch.z) * lch.y);
  return clamp(linearToSrgb(oklabToLinearSrgb(lab)), 0.0, 1.0);
}

vec3 mixColors(vec3 a, vec3 b, float t) {
  if (uInterpMode < 0.5) {
    return mix(a, b, t);
  }
  if (uInterpMode < 1.5) {
    vec3 ha = rgb2hsl(a);
    vec3 hb = rgb2hsl(b);
    float dh = hb.x - ha.x;
    if (dh > 0.5) dh -= 1.0;
    if (dh < -0.5) dh += 1.0;
    return hsl2rgb(vec3(fract(ha.x + dh * t), mix(ha.y, hb.y, t), mix(ha.z, hb.z, t)));
  }
  vec3 oa = rgb2oklch(a);
  vec3 ob = rgb2oklch(b);
  float dh = ob.z - oa.z;
  if (dh > 3.14159265) dh -= 6.2831853;
  if (dh < -3.14159265) dh += 6.2831853;
  return oklch2rgb(vec3(mix(oa.x, ob.x, t), mix(oa.y, ob.y, t), oa.z + dh * t));
}

vec3 sampleRamp(float v) {
  v = clamp(v, 0.0, 1.0);
  if (uStopCount <= 1) return uStopColors[0];
  for (int i = 0; i < 7; i++) {
    if (i >= uStopCount - 1) break;
    float a = uStopPos[i];
    float b = uStopPos[i + 1];
    if (v <= b || i == uStopCount - 2) {
      float t = (b - a) < 1e-5 ? 0.0 : clamp((v - a) / (b - a), 0.0, 1.0);
      return mixColors(uStopColors[i], uStopColors[i + 1], t);
    }
  }
  return uStopColors[uStopCount - 1];
}

/** Forced OKLCH mix — the tunnel gradient always interpolates here. */
vec3 mixOklch(vec3 a, vec3 b, float t) {
  vec3 oa = rgb2oklch(a);
  vec3 ob = rgb2oklch(b);
  // A near-neutral stop carries no meaningful hue; borrow the other's so the
  // mix does not sweep through unrelated hues (green) on the way to a colour.
  if (oa.y < 0.02) oa.z = ob.z;
  if (ob.y < 0.02) ob.z = oa.z;
  float dh = ob.z - oa.z;
  if (dh > 3.14159265) dh -= 6.2831853;
  if (dh < -3.14159265) dh += 6.2831853;
  return oklch2rgb(vec3(mix(oa.x, ob.x, t), mix(oa.y, ob.y, t), oa.z + dh * t));
}

/** Three-stop vertical gradient (top → mid → bottom) used by the Box effect. */
vec3 sampleBoxGradient(float g) {
  g = clamp(g, 0.0, 1.0);
  return g < 0.5
      ? mixOklch(uBoxGrad0, uBoxGrad1, g * 2.0)
      : mixOklch(uBoxGrad1, uBoxGrad2, (g - 0.5) * 2.0);
}

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

/**
 * Colour packet travelling along one band, 0 at both ends of its run so the
 * loop wraps seamlessly. \`key\` is the band index: it offsets the phase so the
 * bands run out of step, scaled by uSync. Fully synced reads as one wall of
 * light sweeping the shape; fully scattered reads as independent streams.
 */
float flowPacket(float key, float lengthT, float t) {
  float spread = 1.0 - clamp(uSync, 0.0, 1.0);
  float phase = fract(lengthT - t * uSp1 * 0.45 + hash21(vec2(key, 3.7)) * spread);
  return exp(-pow((phase - 0.5) * 4.0, 2.0));
}

float applyFalloff(float d) {
  float f = uFalloff;
  if (uFalloffCurve < 0.5) return d * f;
  if (uFalloffCurve < 1.5) return d * d * f;
  return (1.0 - exp(-d * 2.5)) * f;
}

/** Folded satin cross-section: dark crease blooming to a bright trailing edge. */
float satinBands(float sn, float steps, float soft) {
  float cell = sn * steps;
  float f = fract(cell);
  float crease = smoothstep(0.0, 0.11, f);
  float trail = pow(clamp(f / 0.84, 0.0, 1.0), 0.58);
  float satin = crease * mix(0.22, 1.0, trail);
  satin *= 1.0 - 0.12 * smoothstep(0.9, 1.0, f);
  if (soft > 0.02) {
    float w = mix(0.02, 0.35, soft);
    satin = mix(satin, smoothstep(0.5 - w, 0.5 + w, f), soft * 0.4);
  }
  return (floor(cell) + satin) / steps;
}

void main() {
  float aspect = uRes.x / max(uRes.y, 1.0);
  vec2 uv = vUv;
  vec2 vp = vec2((uVanishing.x - 0.5) * aspect, uVanishing.y - 0.5);
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
  // Inverse-rotate the sample so the whole composition turns clockwise by
  // uRotation. Shape maths keep working in their native orientation.
  float ca = cos(uRotation);
  float sa = sin(uRotation);
  p = vec2(ca * p.x - sa * p.y, sa * p.x + ca * p.y);
  vec2 d = p - vp;
  float dist = length(d);

  float angle = 0.0;
  float inShape = 1.0;
  float templateId = uTemplate;
  float nodeBoost = 0.0;
  float t = uTime;
  float progress = 0.0;
  float sn = 0.0;
  float hornMode = 0.0;
  float netMode = 0.0;
  float boxMode = 0.0;
  float apexDist = dist;
  /** Horn and network: cross-ribbon position normalised by width, −1…1 edge to edge. */
  float crossU = 0.0;
  /** Network only: index of the link covering this pixel, for per-link phasing. */
  float linkIdx = 0.0;
  /**
   * Network only: stroke casing and interior, built from the perpendicular
   * distance to the winning ribbon. Strokes mode cannot derive these from
   * fract()/fwidth() here — both jump where the nearest link changes, and the
   * seam then floods with casing in blocky patches.
   */
  float netWall = 0.0;
  float netBore = 0.0;
  /** Box only: vertical gradient coordinate inside the frame covering the pixel. */
  float boxGy = 0.5;
  /** Box only: 1 where the pixel sits outside the outer frame. */
  float boxBgMask = 0.0;
  /** Box only: core bloom, active only on the deepest frames. */
  float boxBloom = 0.0;

  if (templateId < 0.5) {
    // Fan — aperture around "down" from the vanishing point
    angle = atan(d.x, -d.y);
    float aMin = min(uAngleMin, uAngleMax);
    float aMax = max(uAngleMin, uAngleMax);
    inShape = step(aMin, angle) * step(angle, aMax);
  } else if (templateId < 1.5) {
    // Hourglass — vertical double fan, mirrored top/bottom
    float ay = max(abs(d.y), 1e-5);
    angle = atan(d.x, ay);
    float halfAp = max(abs(uAngleMin), abs(uAngleMax));
    float fromVert = abs(angle);
    float edge = fwidth(fromVert) * 1.25;
    inShape = 1.0 - smoothstep(halfAp - edge, halfAp + edge, fromVert);
  } else if (templateId < 2.5) {
    // Corridor — perspective path with bowed outer edges
    angle = atan(d.x, -d.y);
    float down = max(-d.y, 0.0);
    float halfAp = max(abs(uAngleMin), abs(uAngleMax));
    float base = tan(clamp(halfAp, 0.05, 1.45));
    float xLimit = down * base * (1.0 + uCurve * down * 1.35);
    float edge = max(fwidth(d.x), fwidth(xLimit)) * 1.5;
    float softMask = 1.0 - smoothstep(xLimit - edge, xLimit + edge, abs(d.x));
    float below = smoothstep(-0.002, 0.01, down);
    inShape = softMask * below;
  } else if (templateId < 3.5) {
    // Network — a port column down each edge, every left port routed to a
    // port opposite. The routing is deliberately not a straight mapping: the
    // ribbons have to cross through the middle, which is what makes this read
    // as one interconnected fabric instead of two mirrored halves.
    netMode = 1.0;
    float links = clamp(floor(uSteps * 0.5 + 0.5), 4.0, 16.0);
    float halfSpan =
        mix(0.26, 0.5, clamp(max(abs(uAngleMin), abs(uAngleMax)) / 1.35, 0.0, 1.0)) * aspect;
    // Capped below half the frame so the outer ports keep a margin.
    float colH = mix(0.18, 0.43, clamp(uCurve, 0.0, 1.2) / 1.2);
    float xL = vp.x - halfSpan;
    float spanW = max(2.0 * halfSpan, 1e-4);
    float x01 = (p.x - xL) / spanW;

    // Ease with zero slope at both ends, so a ribbon leaves its port
    // horizontally and only swings across in the middle third.
    float xt = clamp(x01, 0.0, 1.0);
    float ease = xt * xt * (3.0 - 2.0 * xt);
    float slopeK = 6.0 * xt * (1.0 - xt) / spanW;

    float pitch = 2.0 * colH / links;
    float halfW = pitch * 0.5 * (1.0 - clamp(uGap, 0.0, 0.95) * 0.85);

    float bestD = 1e9;
    float bestSigned = 0.0;
    // Stacking order. Taking the nearest ribbon makes a crossing split along
    // the bisector of the two, fusing them into a blob; letting whichever
    // ribbon covers the pixel with the highest priority win instead makes one
    // pass cleanly over the other.
    float topPri = -1.0;
    float topD = 0.0;
    float topSigned = 0.0;
    float topIdx = 0.0;
    float nodeHit = 0.0;
    float rN = pitch * 0.34;
    // One device pixel in world units. p.y spans exactly 1 over the height, so
    // this is exact and — unlike fwidth here — continuous everywhere.
    float pw = 1.0 / max(uRes.y, 1.0);

    for (int i = 0; i < 16; i++) {
      float fi = float(i);
      if (fi >= links) break;
      float yL = vp.y + ((fi + 0.5) / links - 0.5) * 2.0 * colH;
      // Hashed target port: spreads the ribbons irregularly and lets a few
      // fan into a shared port, which a fixed stride cannot do — a stride
      // sharing a factor with the port count collapses onto a few bundles.
      float j = floor(hash21(vec2(fi, 11.3)) * links);
      float yR = vp.y + ((j + 0.5) / links - 0.5) * 2.0 * colH;

      float dy = p.y - mix(yL, yR, ease);
      // Perpendicular distance, so a steep ribbon is not drawn wider than a
      // flat one just because it covers more vertical space per pixel.
      float slope = (yR - yL) * slopeK;
      float inv = inversesqrt(1.0 + slope * slope);
      float dPerp = abs(dy) * inv;
      if (dPerp < bestD) {
        bestD = dPerp;
        bestSigned = dy * inv;
        linkIdx = fi;
      }
      float pri = hash21(vec2(fi, 5.1));
      if (dPerp <= halfW + pw && pri > topPri) {
        topPri = pri;
        topD = dPerp;
        topSigned = dy * inv;
        topIdx = fi;
      }

      // Both columns get a full set of port discs, including ports the
      // routing happens to leave unconnected.
      float dL = length(p - vec2(xL, yL));
      float dR = length(p - vec2(xL + spanW, yL));
      nodeHit = max(nodeHit, 1.0 - smoothstep(rN - pw, rN, dL));
      nodeHit = max(nodeHit, 1.0 - smoothstep(rN - pw, rN, dR));
      netWall = max(netWall, 1.0 - smoothstep(pw, pw * 2.2, abs(dL - rN)));
      netWall = max(netWall, 1.0 - smoothstep(pw, pw * 2.2, abs(dR - rN)));
      // Disc interiors, inset so the ring around them stays readable.
      netBore = max(netBore, 1.0 - smoothstep(rN - pw * 2.8, rN - pw * 1.4, dL));
      netBore = max(netBore, 1.0 - smoothstep(rN - pw * 2.8, rN - pw * 1.4, dR));
    }

    // Outside every ribbon nothing covers the pixel, so the nearest one still
    // supplies the antialiased fringe.
    if (topPri >= 0.0) {
      bestD = topD;
      bestSigned = topSigned;
      linkIdx = topIdx;
    }

    crossU = clamp(bestSigned / max(halfW, 1e-5), -1.0, 1.0);
    progress = xt;

    float onSpan = smoothstep(-0.004, 0.008, x01) * (1.0 - smoothstep(0.992, 1.004, x01));
    float ribbon = (1.0 - smoothstep(halfW - pw, halfW, bestD)) * onSpan;

    netWall = max(netWall, (1.0 - smoothstep(pw, pw * 2.2, abs(bestD - halfW))) * onSpan);
    netBore = max(
        netBore, (1.0 - smoothstep(halfW - pw * 2.8, halfW - pw * 1.4, bestD)) * onSpan);

    nodeBoost = nodeHit;
    inShape = max(ribbon, nodeHit);
  } else if (templateId < 4.5) {
    // Stream — ribbon bundle converging to a right-side vanishing point
    // Bend sag: whole mouth drops as it opens toward the left
    float leftRaw = max(-(p.x - vp.x), 0.0);
    float bend = uCurve * 0.55;
    vec2 pw = p;
    pw.y -= bend * leftRaw * leftRaw;
    vec2 dw = pw - vp;
    angle = atan(dw.y, -dw.x); // 0 = straight left of VP
    float left = max(-dw.x, 0.0);
    float halfAp = max(abs(uAngleMin), abs(uAngleMax));
    float fromH = abs(angle);
    float edge = fwidth(fromH) * 1.35;
    float inCone = 1.0 - smoothstep(halfAp - edge, halfAp + edge, fromH);
    float toLeft = smoothstep(-0.002, 0.012, left);
    inShape = inCone * toLeft;
  } else if (templateId < 5.5) {
    // Beam — soft isosceles spotlight from a top vanishing point
    angle = atan(d.x, -d.y);
    float halfAp = max(abs(uAngleMin), abs(uAngleMax));
    float fromCenter = abs(angle);
    float feather = mix(0.015, 0.32, clamp(uCurve, 0.0, 1.2));
    float edge = fwidth(fromCenter) * 1.25 + feather;
    float inCone = 1.0 - smoothstep(halfAp - edge, halfAp + edge, fromCenter);
    float below = smoothstep(-0.002, 0.014, max(-d.y, 0.0));
    inShape = inCone * below;
  } else if (templateId < 6.5) {
    // Horn — apex on the left, rays sweep out to the right.
    // Position X nudges the source along the left edge; Y sets height.
    hornMode = 1.0;
    float leftEdge = -0.5 * aspect;
    float apexX = leftEdge - 0.06 + clamp(uVanishing.x, 0.0, 1.0) * aspect * 0.28;
    vec2 apex = vec2(apexX, vp.y);
    vec2 dh = p - apex;
    apexDist = length(dh);
    angle = atan(dh.y, max(dh.x, 1e-5));
    float right = max(dh.x, 0.0);
    float span = max(0.5 * aspect - apex.x, 0.25);
    progress = clamp(right / span, 0.0, 1.0);
    // Envelope curvature: the allowed |angle| grows with progress as a power
    // curve. Below 1 the opening front-loads and the envelope bulges into a
    // dome; above 1 it is held back and pinches into a spire. The knee puts
    // the straight cone at 0.4 so both sides get a usable stretch of travel.
    float halfAp = max(abs(uAngleMin), abs(uAngleMax));
    float cv = clamp(uCurve, 0.0, 1.2);
    float power = cv < 0.4 ? mix(0.35, 1.0, cv / 0.4) : mix(1.0, 4.325, (cv - 0.4) / 0.8);
    float flare = pow(progress, power);
    float openAp = halfAp * mix(0.12, 1.0, flare);
    // Dividing the angle by the local opening gives a coordinate whose
    // iso-lines are the flare profile itself, so bands leave the apex almost
    // horizontal and bend away from the axis exactly as the envelope does.
    // Iso-angle lines would instead be straight and ignore the flare.
    crossU = angle / max(openAp, 1e-4);
    float fromH = abs(angle);
    float angEdge = fwidth(fromH) * 1.35;
    float inFlare = 1.0 - smoothstep(openAp - angEdge, openAp + angEdge, fromH);
    float toRight = smoothstep(-0.001, 0.014, dh.x);
    inShape = inFlare * toRight;
  } else {
    // Box — nested rectangular frames receding into a vanishing point, like a
    // tunnel of boxes seen head-on. Each frame carries the same vertical
    // gradient rescaled into its own box, so the colour bands tighten toward
    // the vanishing point and the core blooms blue.
    boxMode = 1.0;
    // Laid out in canvas space, so the rings trace rectangles of the canvas's
    // own aspect and fill the frame at any size.
    vec2 b = vec2(uv.x - uVanishing.x, uv.y - uVanishing.y);
    b = vec2(ca * b.x - sa * b.y, sa * b.x + ca * b.y);
    // Chebyshev radius: |x| == |y| traces a rectangle rather than a circle.
    float m = max(abs(b.x), abs(b.y));
    // Shrink ratio per ring. Lower crowds the frames toward the vanishing
    // point; uCurve dials it up for a faster rush into the centre.
    float ratio = mix(0.92, 0.6, clamp(uCurve, 0.0, 1.2) / 1.2);
    float rings = max(uSteps, 2.0);
    // Ring index: 0 at the outer reference edge, rising without bound toward
    // the vanishing point. Speed slides the index outward, so frames travel
    // toward the viewer and recycle at the vanishing point. Still at speed 0.
    // The travel also scales the frame's gradient box below, keeping the two in
    // step — otherwise a drifting frame would lose its own rectangle.
    float boxTravel = uTime * uSp1 * 0.45 * rings;
    float rIdx = log(max(m, 1e-5) / BOX_OUTER) / log(ratio) + boxTravel;
    // Offset by half a cell so the outer edge and the clamped centre both land
    // mid-band — a cell boundary there would carve a gap exactly where the
    // frames should be solid, and the centre is where the light pools.
    sn = min((rIdx + 0.5) / rings, (rings - 0.5) / rings);
    progress = sn;
    inShape = 1.0;

    // The frame covering the pixel. Its gradient is scaled to the cell's outer
    // rectangle. Edge sharpness blends between the discrete cell (crisp
    // frames) and the continuous radius (a smooth tunnel gradient). The ring
    // index stays unbounded here; only \`sn\` above is clamped, and only so the
    // centre reads as one solid band rather than a carved gap.
    float softBox = clamp(1.0 - uEdgeSharp, 0.0, 1.0);
    float ringIdx = floor(rIdx + 0.5);
    float ringEff = mix(ringIdx, rIdx, softBox);
    float mOuter = BOX_OUTER * pow(ratio, ringEff - 0.5 - boxTravel);
    boxGy = clamp((uVanishing.y + mOuter - uv.y) / max(2.0 * mOuter, 1e-5), 0.0, 1.0);

    // Background beyond the outer frame, carrying the gradient flipped so the
    // opening reads as a light source.
    float boxPx = 1.0 / max(uRes.y, 1.0);
    boxBgMask = smoothstep(BOX_OUTER - boxPx, BOX_OUTER + boxPx, m);

    // Bloom on the deepest frames only, from the bloom-depth iteration inward.
    float bloomStart = max(uBoxBloomDepth, 0.0);
    boxBloom = exp(-dist * dist * 26.0) * 0.34 *
        smoothstep(bloomStart - 0.5, bloomStart + 0.5, rIdx);
  }

  float steps = max(uSteps, 2.0);
  float soft = clamp(1.0 - uEdgeSharp, 0.0, 1.0);
  float bands;

  if (hornMode > 0.5) {
    // Ray density has to grow with horizontal progress while each ray keeps a
    // clean single sweep. Blending raw octaves cannot do that: the quantised
    // band boundaries sit at levels that drift as the waveform changes shape,
    // so they wander into contour loops. Quantise three fixed densities first
    // — each a function of crossU alone, so each boundary is one clean flare
    // curve — then crossfade the finished band fields. Discontinuities can
    // then only land on a flare curve of one of the three.
    // The 1.15 keeps the band count where it was when this used raw angle.
    float a1 = crossU * uF1 * 1.15;
    float b1 = satinBands(sin(a1) * 0.5 + 0.5, steps, soft);
    float b2 = satinBands(sin(a1 * 2.0) * 0.5 + 0.5, steps, soft);
    float b3 = satinBands(sin(a1 * 4.0) * 0.5 + 0.5, steps, soft);
    float w2 = smoothstep(0.08, 0.42, progress);
    float w3 = smoothstep(0.28, 0.82, progress);
    bands = mix(mix(b1, b2, w2), b3, w3);
    // Mid density drives the gap mask so its strips stay straight too.
    sn = sin(a1 * 2.0) * 0.5 + 0.5;
  } else if (netMode > 0.5) {
    // One band per link: the fold runs across the ribbon so each link reads as
    // a single folded pipe. Sub-dividing it across the width would turn one
    // connection into a stack of stripes and lose the point of the shape.
    sn = crossU * 0.5 + 0.5;
    bands = satinBands(sn, 1.0, soft);
  } else if (boxMode > 0.5) {
    // One band per ring. The ring index already came out of the geometry, so
    // quantising it paints a single flat tone across each frame instead of
    // striping it — sub-dividing would lose the box edges entirely.
    float x = sn * steps;
    if (soft < 0.02) {
      bands = floor(x) / steps;
    } else {
      float f = fract(x);
      float w = mix(0.02, 0.5, soft);
      bands = (floor(x) + smoothstep(0.5 - w, 0.5 + w, f)) / steps;
    }
  } else {
    // No time term: the band boundaries are the pipes and must not drift
    // sideways. All motion happens along the rays, further down.
    float s =
        sin(angle * uF1) +
        sin(angle * uF2) * 0.6 +
        sin(angle * uF3) * 0.35;
    // Normalise the octave stack against its own amplitude (1 + 0.6 + 0.35) so
    // the field spans the ramp instead of overshooting it. Unnormalised, the
    // crests spend most of their width clamped, flattening the palette into
    // black creases and blown white plateaus. The 0.8 factor keeps the extreme
    // stops reachable on narrow crests rather than out of reach entirely.
    sn = clamp(s / 1.56, -1.0, 1.0) * 0.5 + 0.5;
    if (soft < 0.02) {
      bands = floor(sn * steps) / steps;
    } else {
      float x = sn * steps;
      float f = fract(x);
      float w = mix(0.02, 0.5, soft);
      float smoothed = smoothstep(0.5 - w, 0.5 + w, f);
      bands = (floor(x) + smoothed) / steps;
    }
  }

  // Lengthwise progress along a ray: 0 at the source, 1 at the far end.
  float spanRef = 0.5 * length(vec2(aspect, 1.0));
  float lengthT = hornMode + netMode + boxMode > 0.5
      ? progress
      : clamp(dist / max(spanRef, 1e-3), 0.0, 1.0);
  float grad = clamp(uGradient, 0.0, 1.0);

  // Bands sample a fixed-width slice of the ramp that slides toward the light
  // end as the ray travels from its source. Sliding a bounded window rather
  // than lifting toward white keeps every band's contrast identical along its
  // whole length, so a blue ribbon reads blue at the far edge instead of
  // washing out. Radial falloff steepens how fast the window travels.
  // Box reads as a gradient with boxes carved into it, so its ramp travel is
  // not damped the way the band-driven effects damp it — with a full-strength
  // travel the tone slides smoothly toward the vanishing point and the bands
  // only supply the ring separations.
  float travel = grad * (boxMode > 0.5 ? 1.0 : 0.45);
  float depth = clamp(lengthT + applyFalloff(dist), 0.0, 1.0);

  // Colour flowing through a fixed pipe, keyed on the colour band index.
  // Amplitude tracks speed so that speed 0 leaves the static gradient intact.
  float flowAmt = clamp(abs(uSp1) * 3.0, 0.0, 1.0);
  // Network phases per link; every other shape phases per colour band.
  float phaseKey = netMode > 0.5 ? linkIdx : floor(sn * steps);
  float packet = flowPacket(phaseKey, lengthT, t);
  float pulse = packet * flowAmt;

  float slide = clamp(depth + pulse * (1.0 - depth) * 0.9, 0.0, 1.0);
  float v = clamp(slide * travel + bands * (1.0 - travel), 0.0, 1.0);
  // The window alone can only shift v by \`travel\`, so lift the packet as well
  // to make it carry real brightness rather than a faint tint.
  v = mix(v, 1.0, pulse * 0.35);

  // Gap: dark space between ribbons (duty cycle within each band cell).
  // The bounds are hoisted because strokes mode hangs its borders on them.
  float gapAmt = clamp(uGap, 0.0, 0.95);
  float cellG = sn * steps;
  float fG = fract(cellG);
  float duty = 1.0 - gapAmt;
  float bandStart = gapAmt * (1.0 - duty);
  float bandEnd = bandStart + duty;
  float rayMask = 1.0;
  // Network spaces its links geometrically when it lays them out, so a duty
  // cycle here would thin each ribbon a second time.
  if (gapAmt > 0.001 && netMode < 0.5) {
    float ge = max(fwidth(cellG) * 0.7, mix(0.012, 0.07, soft));
    rayMask =
        smoothstep(bandStart, bandStart + ge, fG) *
        (1.0 - smoothstep(bandEnd - ge, bandEnd, fG));
  }

  if (uStrokes < 0.5) {
    if (templateId > 0.5 && templateId < 1.5) {
      float glow = exp(-dist * dist * 22.0) * 0.42;
      v = clamp(v + glow, 0.0, 1.0);
    } else if (templateId > 1.5 && templateId < 2.5) {
      v = clamp(v + smoothstep(0.55, 1.0, v) * 0.12, 0.0, 1.0);
    } else if (netMode > 0.5) {
      // Ports read as bright terminals; the pulse running the link is the
      // shared flow packet, so there is no bespoke sweep here.
      v = clamp(v + nodeBoost * 0.55, 0.0, 1.0);
    } else if (templateId > 3.5 && templateId < 4.5) {
      // Soft tip bloom near the stream vanishing point
      float tip = exp(-dist * dist * 28.0) * 0.32;
      v = clamp(v + tip + smoothstep(0.6, 1.0, v) * 0.08, 0.0, 1.0);
    } else if (templateId > 4.5 && templateId < 5.5) {
      // Hot core + tip bloom for the vertical beam
      float halfAp = max(abs(uAngleMin), abs(uAngleMax));
      float axial = 1.0 - smoothstep(0.0, halfAp * 0.85, abs(angle));
      float tip = exp(-dist * dist * 16.0) * 0.36;
      v = clamp(v + tip + axial * 0.14 + smoothstep(0.55, 1.0, v) * 0.08, 0.0, 1.0);
    } else if (hornMode > 0.5) {
      // Source glow at the left apex. The peak travelling left → right is now
      // the shared per-pipe flow, so there is no bespoke sweep here.
      float tip = exp(-apexDist * apexDist * 26.0) * 0.4;
      v = clamp(v + tip + progress * 0.08 + 0.1, 0.0, 1.0);
    }
  }

  float cover = inShape * rayMask;
  vec3 col;
  float grainMask = 1.0;

  if (uStrokes > 0.5) {
    // Outlined pipes: each band gets a 2px neutral casing, and the colour
    // inside fades to nothing at both ends of its run so the casing reads
    // against the background instead of being swallowed by the fill.
    //
    // The walls are traced from the ray field, not from the colour bands. The
    // colour field is clamped, so it has flat plateaus, and a plateau sits
    // exactly on a band boundary — tracing it would paint whole regions as
    // casing. The ray field is monotone across the shape, so its cell walls
    // are always clean single lines.
    // Network already carved one cell per link, so its field spans a single
    // ribbon end to end and the walls land on the ribbon edges.
    float n = clamp(floor(uSteps * 0.5 + 0.5), 5.0, 16.0);
    float field = netMode > 0.5
        ? (crossU + 1.0) * 0.5
        : (boxMode > 0.5
            ? sn * steps
            : (hornMode > 0.5 ? crossU * n * 1.15 : angle * n));
    float fF = fract(field);
    // Cells per pixel, capped: a pipe narrower than a few pixels cannot hold a
    // casing, and without the cap the walls swallow the bore near the
    // convergence point and flood it with neutral.
    float pxF = min(max(fwidth(field), 1e-5), 0.22);

    // Gap opens space between neighbours so each pipe keeps its own pair of
    // walls rather than sharing one with the pipe next to it. Network spaced
    // its links when laying them out, so insetting here would double it.
    float gapStroke = netMode > 0.5 ? 0.0 : gapAmt;
    float lo = gapStroke * 0.5;
    float hi = 1.0 - gapStroke * 0.5;
    float wall = max(
        1.0 - smoothstep(pxF, pxF * 1.75, abs(fF - lo)),
        1.0 - smoothstep(pxF, pxF * 1.75, abs(fF - hi)));
    float bore = smoothstep(lo, lo + pxF, fF) * (1.0 - smoothstep(hi - pxF, hi, fF));

    // Walls live inside the shape; the silhouette is not masked by \`inside\`,
    // which is zero exactly where the silhouette sits.
    float inside = smoothstep(0.05, 0.2, inShape);
    float silW = max(fwidth(inShape), 1e-4) * 1.05;
    float silhouette =
        smoothstep(0.0, silW, inShape) * (1.0 - smoothstep(silW, silW * 2.1, inShape));
    float border = max(wall * inside, pow(clamp(silhouette, 0.0, 1.0), 1.25));

    if (netMode > 0.5) {
      // Casing and interior already traced from the ribbon geometry, which is
      // the only formulation stable across the crossings.
      border = netWall;
      bore = netBore;
      inside = 1.0;
    }

    // Keyed on the pipe rather than the colour band: the pipes are cut by the
    // ray field here, so a band-keyed phase would drift across a single pipe
    // and break its packet into patches. Network's field spans one ribbon, so
    // its floor is always 0 and the link index is the only usable key.
    float pipeIdx = netMode > 0.5 ? linkIdx : floor(field);
    float packetS = flowPacket(pipeIdx, lengthT, t);

    // Ends transparent: run the colour edge to edge and the casing is only
    // visible where it happens to meet the background. Box's rings close on
    // themselves, so they carry colour the whole way round.
    float ends = boxMode > 0.5
        ? 1.0
        : smoothstep(0.0, 0.16, lengthT) * (1.0 - smoothstep(0.84, 1.0, lengthT));
    // With no flow the whole bore carries colour; with flow it is the packet.
    float inkA = ends * mix(1.0, packetS, flowAmt) * bore * inside;

    // One ramp position per pipe, slid along its length like the fill bands.
    float pipeTone = mix(0.3, 1.0, hash21(vec2(pipeIdx, 1.3)));
    float vS = clamp(depth * travel + pipeTone * (1.0 - travel), 0.0, 1.0);
    vS = mix(vS, 1.0, packetS * flowAmt * 0.35);

    col = mix(uBg, sampleRamp(vS), inkA);
    // Casing painted last so it stays legible wherever colour is present.
    col = mix(col, NEUTRAL_700, border);
    // Grain on the colour only — it would just make the casing look dirty.
    grainMask = inkA;
  } else if (boxMode > 0.5) {
    // Frames are carved out of the tunnel gradient. The ramp only supplies a
    // flat tone per ring when Gradient is pulled back down.
    vec3 flatCol = sampleRamp(clamp(bands, 0.0, 1.0));
    vec3 frameCol = mix(flatCol, sampleBoxGradient(boxGy), clamp(uGradient, 0.0, 1.0));
    frameCol = clamp(frameCol + boxBloom, 0.0, 1.0);
    col = mix(uBg, frameCol, cover);
    // Background outside the outer frame: the same gradient, flipped so the
    // opening reads as a light source.
    float bgG = mix(1.0 - uv.y, uv.y, clamp(uBoxInvertBg, 0.0, 1.0));
    col = mix(col, sampleBoxGradient(bgG), boxBgMask);
  } else {
    col = mix(uBg, sampleRamp(v), cover);
  }

  float gt = uGrainAnimated > 0.5 ? fract(t * 0.37) : 0.0;
  float g =
      (hash21(gl_FragCoord.xy * uGrainScale + gt * 91.0) - 0.5) +
      (hash21(gl_FragCoord.xy * uGrainScale * 0.37 + 7.0 + gt * 17.0) - 0.5) * 0.45;
  col += g * uGrainAmount * (uStrokes > 0.5 ? 0.035 : 0.08) * grainMask;

  float dither = (hash21(gl_FragCoord.xy + vec2(gt, gt * 1.3)) - 0.5) / 255.0;
  col += dither;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export const UNIFORMS: [
  name: string,
  type: string,
  value: number | number[],
][] = [
  ['uVanishing', '2fv', [0.02, 0.91]],
  ['uRotation', '1f', 0.05236],
  ['uSteps', '1f', 15],
  ['uF1', '1f', 7.95],
  ['uF2', '1f', 12.4497],
  ['uF3', '1f', 20.47125],
  ['uSp1', '1f', 0.44],
  ['uSp2', '1f', 0.2772],
  ['uSp3', '1f', -0.17600000000000002],
  ['uAngleMin', '1f', -1.78],
  ['uAngleMax', '1f', 1.78],
  ['uFalloff', '1f', 0.22],
  ['uFalloffCurve', '1f', 1],
  ['uEdgeSharp', '1f', 1],
  ['uGap', '1f', 0],
  ['uGradient', '1f', 0.62],
  ['uSync', '1f', 0.68],
  ['uGrainAmount', '1f', 0],
  ['uGrainScale', '1f', 1],
  ['uGrainAnimated', '1f', 0],
  ['uTemplate', '1f', 0],
  ['uCurve', '1f', 0.35],
  ['uStrokes', '1f', 0],
  ['uBg', '3fv', [0.005605, 0.01033, 0.102242]],
  ['uStopCount', '1i', 5],
  [
    'uStopColors',
    '3fv',
    [
      0.003347, 0.003347, 0.002732, 0.011612, 0.06301, 0.887923, 0.038204,
      0.147027, 0.964686, 0.274677, 0.47932, 1, 0.508881, 0.651406, 1, 0.508881,
      0.651406, 1, 0.508881, 0.651406, 1, 0.508881, 0.651406, 1,
    ],
  ],
  ['uStopPos', '1fv', [0.24, 0.5, 0.55, 0.8, 1, 1, 1, 1]],
  ['uInterpMode', '1f', 0],
  ['uBoxGrad0', '3fv', [0.791298, 0.791298, 0.775822]],
  ['uBoxGrad1', '3fv', [0.011612, 0.06301, 0.887923]],
  ['uBoxGrad2', '3fv', [0.01033, 0.01033, 0.009134]],
  ['uBoxInvertBg', '1f', 1],
  ['uBoxBloomDepth', '1f', 8],
];
