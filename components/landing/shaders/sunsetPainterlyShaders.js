export const PAINTERLY_VERT = `
attribute vec2 a_position;
varying vec2 vUv;
void main() {
  vUv = a_position * 0.5 + 0.5;
  vUv.y = 1.0 - vUv.y;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

export const SKY_FRAG = `
precision mediump float;
varying vec2 vUv;
uniform float uTime;
uniform float uScroll;
uniform vec2 uResolution;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.05;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = vUv;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 brushUv = vec2(uv.x * aspect, uv.y);

  float horizon = 0.54 - uScroll * 0.02;
  float t = clamp((uv.y - 0.08) / 0.92, 0.0, 1.0);

  vec3 topCol = vec3(0.231, 0.231, 0.427);
  vec3 midCol = vec3(0.42, 0.26, 0.38);
  vec3 warmCol = vec3(0.98, 0.63, 0.31);
  vec3 goldCol = vec3(1.0, 0.55, 0.22);

  vec3 sky = mix(goldCol, topCol, pow(t, 0.78));
  sky = mix(sky, midCol, smoothstep(0.35, 0.62, t) * 0.55);

  float glow = exp(-pow((uv.y - horizon) * 5.2, 2.0));
  sky += glow * vec3(1.0, 0.62, 0.28) * 0.55;

  float brush = fbm(brushUv * vec2(2.8, 6.5) + vec2(uTime * 0.015, 0.0));
  float streak = fbm(vec2(brushUv.x * 1.2 + brush * 0.4, brushUv.y * 12.0));
  sky *= 0.9 + brush * 0.14 + streak * 0.08;

  float vignette = smoothstep(1.15, 0.25, length((uv - vec2(0.5, 0.45)) * vec2(1.0, 1.1)));
  sky *= mix(0.82, 1.0, vignette);

  gl_FragColor = vec4(sky, 1.0);
}
`

export const SUN_FRAG = `
precision mediump float;
varying vec2 vUv;
uniform float uTime;
uniform float uGlow;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
  vec2 p = vUv - 0.5;
  float dist = length(p);

  float glow = exp(-dist * 2.8) * uGlow;
  vec3 glowCol = vec3(1.0, 0.58, 0.22) * glow * 0.85;

  float edge = smoothstep(0.52, 0.46, dist);
  float core = smoothstep(0.5, 0.0, dist);

  vec3 inner = vec3(1.0, 0.78, 0.42);
  vec3 mid = vec3(1.0, 0.62, 0.26);
  vec3 outer = vec3(0.92, 0.42, 0.14);
  vec3 sun = mix(outer, mid, core);
  sun = mix(sun, inner, pow(core, 1.8));

  float n = noise(vUv * 14.0 + uTime * 0.04) * 0.08;
  sun *= 0.94 + n;

  float alpha = edge;
  vec3 col = sun * alpha + glowCol;
  float outAlpha = clamp(alpha + glow * 0.65, 0.0, 1.0);

  gl_FragColor = vec4(col, outAlpha);
}
`

export const GRAIN_FRAG = `
precision mediump float;
varying vec2 vUv;
uniform float uTime;
uniform vec2 uResolution;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 uv = vUv;
  float n = hash(uv * uResolution * 0.85 + uTime * 0.5);
  float n2 = hash(uv * uResolution * 1.35 - uTime * 0.35);
  float grain = (n + n2) * 0.5;

  float paper = hash(floor(uv * vec2(uResolution.x * 0.004, uResolution.y * 0.004)));
  float v = grain * 0.12 + paper * 0.04;

  gl_FragColor = vec4(vec3(1.0), v);
}
`
