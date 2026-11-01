/** Bounded local effects; no full-screen pass, textures or postprocessing. */
export const surfaceVertex = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vec4 p = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-p.xyz);
    gl_Position = projectionMatrix * p;
  }
`
export const seedFragment = `
  uniform float opacity;
  uniform float time;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.8);
    float grain = sin(vUv.y * 21.0 + sin(vUv.x * 19.4) * 0.5);
    float vein = pow(0.5 + 0.5 * cos(vUv.x * 50.265 + sin(vUv.y * 4.0) * 0.8), 24.0);
    float fine = pow(0.5 + 0.5 * cos(vUv.x * 106.23 + vUv.y * 2.0), 38.0);
    float tips = pow(abs(vUv.y - 0.5) * 2.0, 8.0);
    vec3 pearl = mix(vec3(0.97, 0.81, 0.84), vec3(1.0, 0.96, 0.94), smoothstep(0.08, 0.92, vUv.y));
    float shimmer = 0.99 + 0.01 * sin(time * 2.2) + grain * 0.006;
    float body = 0.55 + rim * 0.22 + vein * 0.06 + fine * 0.02 + tips * 0.1;
    gl_FragColor = vec4(pearl * shimmer, opacity * body);
  }
`
export const haloFragment = `
  uniform float opacity;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float r = dot(p, p);
    float glow = exp(-r * 6.0) * 0.42 + exp(-r * 25.0) * 0.4;
    gl_FragColor = vec4(1.0, 0.78, 0.78, glow * opacity * (1.0 - smoothstep(0.5, 1.0, r)));
  }
`
export const coreFragment = `
  uniform float opacity;
  uniform float time;
  uniform float intensity;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float r = dot(p, p);
    float heart = exp(-r * 5.2);
    float hot = exp(-r * 22.0);
    float breathe = 0.95 + 0.05 * sin(time * 2.1);
    vec3 color = mix(vec3(1.0, 0.56, 0.24), vec3(1.0, 0.82, 0.55), hot);
    gl_FragColor = vec4(color, (heart * 0.55 + hot * 0.12) * opacity * intensity * breathe);
  }
`
export const moonFragment = `
  uniform float opacity;
  varying vec2 vUv;
  void main() {
    float width = mix(0.46, 0.19, vUv.y);
    float across = (vUv.x - 0.5) / width;
    float shaft = exp(-across * across * 3.6);
    float strands = 0.88 + 0.12 * sin(vUv.x * 81.0 + vUv.y * 2.0);
    float foot = smoothstep(0.0, 0.14, vUv.y);
    float edge = 1.0 - smoothstep(0.65, 1.0, abs(across));
    gl_FragColor = vec4(0.60, 0.72, 1.0, shaft * strands * foot * edge * opacity * 0.055);
  }
`
export const particleVertex = `
  uniform float time;
  uniform float mode;
  uniform float opacity;
  uniform float dpr;
  uniform float height;
  uniform float reduced;
  uniform vec2 fallRange;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    float id = position.x;
    float r = position.y;
    float s = position.z;
    float angle = id * 2.399963;
    vec3 p = vec3(0.0);
    float alpha = opacity;
    if (mode < 0.5) {
      float birth = 0.06 + s * 0.85;
      float age = clamp((time - birth) / (1.2 + r * 0.7), 0.0, 1.0);
      float eased = age * age * (3.0 - 2.0 * age);
      float radius = mix((0.32 + r * 0.64) * height / 3.85, 0.025, eased);
      angle += (time * 1.5 + age * 2.7) * (1.0 - reduced);
      p = vec3(cos(angle) * radius, 1.45 + sin(angle * 0.83 + s * 6.28) * radius * 0.8, sin(angle) * radius * 0.55);
      alpha *= smoothstep(0.0, 0.18, time - birth) * (1.0 - smoothstep(0.75, 1.0, age));
      if (reduced > 0.5) p = vec3(cos(angle) * 0.28, 1.45 + sin(angle) * 0.28, 0.0);
    } else if (mode < 1.5) {
      float delay = r * 0.48;
      float past = clamp((time - delay - fallRange.x) / (fallRange.y - fallRange.x), 0.0, 1.0);
      p = vec3(sin(angle) * 0.024 * r, 1.45 * (1.0 - past * past) + height * 0.065 * (0.84 * past * past + 0.56), cos(angle) * 0.025);
      alpha *= (1.0 - r * 0.65) * smoothstep(fallRange.x, fallRange.x + 0.15, time - delay);
    } else {
      float age = max(0.0, time - fallRange.y);
      float speed = 0.55 + r * 1.35;
      p = vec3(cos(angle) * speed * age, 0.035 + (0.45 + s * 1.25) * age - 1.8 * age * age, sin(angle) * speed * age);
      alpha *= (1.0 - smoothstep(0.2 + r * 0.25, 0.5 + r * 0.35, age)) * smoothstep(-0.06, 0.02, p.y);
    }
    vAlpha = alpha;
    vColor = mix(vec3(1.0, 0.64, 0.30), vec3(1.0, 0.89, 0.80), s);
    vec4 view = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = (3.0 + s * 5.5) * dpr * (5.6 / max(1.0, -view.z));
  }
`
export const particleFragment = `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float light = exp(-r * r * 5.0) * 0.48 + exp(-r * r * 40.0) * 0.65;
    gl_FragColor = vec4(vColor, light * vAlpha * (1.0 - smoothstep(0.7, 1.0, r)));
  }
`
