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
/** Low-frequency vertex deformation keeps the seed from reading as a perfect lathe. */
export const seedSurfaceVertex = `
  uniform float time;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vUv = uv;
    float angle = atan(position.z, position.x);
    float mid = sin(clamp((position.y + 0.72) / 1.44, 0.0, 1.0) * 3.14159265);
    float irregular = sin(angle * 3.0 + position.y * 2.3 + time * 0.16) * 0.055
      + cos(angle * 5.0 - position.y * 3.1) * 0.021;
    vec3 organic = position;
    organic.x *= 1.0 + irregular;
    organic.z *= 1.0 + irregular * 0.78;
    organic.x += 0.024 * sin(angle * 2.0 + position.y * 3.0) * mid;
    organic.z += 0.018 * cos(angle * 3.0 - position.y * 2.0) * mid;
    organic.y += 0.014 * sin(angle * 2.0 + position.y * 4.0 + time * 0.18) * mid;
    vec4 p = modelViewMatrix * vec4(organic, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-p.xyz);
    gl_Position = projectionMatrix * p;
  }
`

export const impactWaveFragment = `
  uniform float uOpacity;
  uniform float uImpactProgress;
  uniform float uImpactStrength;
  varying vec2 vUv;
  void main() {
    float radius = length((vUv - 0.5) * 2.0);
    float waveRadius = mix(0.05, 0.98, uImpactProgress);
    float width = mix(0.095, 0.025, uImpactProgress);
    float wave = 1.0 - smoothstep(width, width * 1.75, abs(radius - waveRadius));
    float envelope = smoothstep(0.0, 0.12, uImpactProgress) * (1.0 - smoothstep(0.7, 1.0, uImpactProgress));
    float heart = exp(-radius * radius * 24.0) * (1.0 - uImpactProgress) * 0.18;
    vec3 color = mix(vec3(1.0, 0.48, 0.3), vec3(1.0, 0.86, 0.68), uImpactProgress);
    gl_FragColor = vec4(color, (wave * 0.6 + heart) * envelope * uOpacity * uImpactStrength);
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
uniform float impactRadius;
uniform float impactStrength;
uniform float impactLifetime;
uniform float orbitCount;
uniform float orbitRadius;
uniform float orbitTilt;
uniform float orbitSpeed;
uniform float formationDuration;
uniform float orbitAbsorption;
uniform float seedFallAcceleration;
uniform float seedFallHeight;
uniform float seedTrailSpread;
uniform float seedTrailLifetime;
uniform float seedTrailLiftSpeed;
  varying float vAlpha;
  varying vec3 vColor;
  varying float vTrailAge;
  float seedFallProgress(float u, float acceleration) {
    float t = clamp(u, 0.0, 1.0);
    float a = clamp(acceleration, 1.0, 4.0);
    return clamp(1.0 - pow(1.0 - pow(t, a), 3.0), 0.0, 1.0);
  }
  void main() {
    float id = position.x;
    float r = position.y;
    float s = position.z;
    float angle = id * 2.399963;
    float trailAgeProgress = 0.0;
    vec3 p = vec3(0.0);
    float alpha = opacity;
    if (mode < 0.5) {
      float lanes = max(1.0, orbitCount);
      float lane = mod(id, lanes);
      float phase = id * 2.399963 + s * 6.28318;
      float formation = clamp(time / max(0.1, formationDuration), 0.0, 1.0);
      float absorption = orbitAbsorption;
      float laneSpeed = orbitSpeed * (0.68 + r * 0.56 + mod(lane, 3.0) * 0.09);
      angle = phase + time * laneSpeed * (1.0 - reduced);
      float irregular = 1.0 + 0.12 * sin(angle * 2.0 + lane * 1.71) + 0.06 * cos(angle * 3.0 - s * 6.28);
      float radius = orbitRadius * (0.68 + r * 0.35) * irregular * (1.0 - absorption) + 0.012 * absorption;
      float x = cos(angle) * radius;
      float y = sin(angle) * radius * (0.48 + mod(lane, 2.0) * 0.11) + 0.06 * radius * sin(angle * 3.0 + phase);
      float z = sin(angle + phase * 0.31) * radius * (0.54 + mod(lane, 3.0) * 0.09);
      float tiltX = orbitTilt * (0.68 + mod(lane, 3.0) * 0.13);
      float tiltZ = orbitTilt * (0.24 + mod(lane, 2.0) * 0.16);
      float tiltedY = y * cos(tiltX) - z * sin(tiltX);
      float tiltedZ = y * sin(tiltX) + z * cos(tiltX);
      p = vec3(x * cos(tiltZ) - tiltedY * sin(tiltZ), tiltedY * cos(tiltZ) + x * sin(tiltZ), tiltedZ);
      float fallProgress = clamp((time - fallRange.x) / (fallRange.y - fallRange.x), 0.0, 1.0);
      float fallEase = seedFallProgress(fallProgress, seedFallAcceleration);
      p.y += max(1.45, height * 0.62) * seedFallHeight * (1.0 - fallEase);
      alpha *= smoothstep(0.0, 0.16, time) * (1.0 - smoothstep(0.84, 1.0, formation));
    } else if (mode < 1.5) {
      float fallDuration = max(0.1, fallRange.y - fallRange.x);
      float emission = mix(0.04, 0.84, clamp(r, 0.0, 1.0));
      float emissionTime = fallRange.x + emission * fallDuration;
      float ageSeconds = time - emissionTime;
      float age = max(0.0, ageSeconds);
      float lifetime = max(0.12, seedTrailLifetime);
      float ageProgress = clamp(age / lifetime, 0.0, 1.0);
      trailAgeProgress = ageProgress;
      float alive = step(0.0, ageSeconds) * (1.0 - smoothstep(0.76, 1.0, ageProgress));
      float emissionFall = seedFallProgress(emission, seedFallAcceleration);
      float fallDistance = max(1.45, height * 0.62) * seedFallHeight;
      float emissionY = fallDistance * (1.0 - emissionFall);
      float spread = seedTrailSpread * (0.18 + r * 1.15) * pow(ageProgress, 1.15);
      float direction = angle + s * 6.28318;
      float flicker = sin(age * (5.0 + s * 4.0) + id * 1.7) * seedTrailSpread * 0.08;
      p = vec3(cos(direction) * spread + flicker,
        emissionY + age * seedTrailLiftSpeed * (0.72 + s * 0.56),
        sin(direction) * spread * 0.68 + cos(age * 3.5 + id) * flicker);
      alpha *= alive * (1.0 - r * 0.45) * (1.0 - reduced) * 1.4
        * smoothstep(fallRange.x, fallRange.x + 0.12, time);
    } else {
      float age = max(0.0, time - fallRange.y);
      float lifetime = max(0.15, impactLifetime);
      float progress = clamp(age / lifetime, 0.0, 1.0);
      float travel = impactRadius * (0.28 + r * 0.82) * progress;
      float lift = impactStrength * (0.28 + s * 0.34);
      p = vec3(cos(angle) * travel, 0.025 + lift * (progress - progress * progress * 0.72), sin(angle) * travel * 0.88);
      alpha *= (1.0 - smoothstep(lifetime * 0.35, lifetime, age)) * impactStrength
        * smoothstep(-0.06, 0.02, p.y);
    }
    vAlpha = alpha;
    vTrailAge = mode >= 0.5 && mode < 1.5 ? trailAgeProgress : -1.0;
    vColor = mode < 0.5
      ? mix(vec3(1.0, 0.83, 0.86), vec3(0.78, 0.72, 0.98), s)
      : mode < 1.5
        ? mix(vec3(1.0, 0.42, 0.12), vec3(1.0, 0.86, 0.56), s)
        : mix(vec3(1.0, 0.64, 0.30), vec3(1.0, 0.89, 0.80), s);
    vec4 view = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * view;
    float pointScale = mode >= 0.5 && mode < 1.5
      ? (6.0 + s * 9.0) * (1.0 - trailAgeProgress * 0.32)
      : 3.0 + s * 5.5;
    gl_PointSize = pointScale * dpr * (5.6 / max(1.0, -view.z));
  }
`
export const particleFragment = `
  varying float vAlpha;
  varying vec3 vColor;
  varying float vTrailAge;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float light = exp(-r * r * 5.0) * 0.48 + exp(-r * r * 40.0) * 0.65;
    float edge = 1.0 - smoothstep(0.7, 1.0, r);
    float meteorHalo = 1.0;
    if (vTrailAge >= 0.0) {
      light = exp(-r * r * 4.0) * 0.52 + exp(-r * r * 24.0) * 0.7;
      edge = 1.0 - smoothstep(0.72, 1.0, r);
      meteorHalo = mix(1.0, 1.12, 1.0 - vTrailAge);
    }
    gl_FragColor = vec4(vColor, light * vAlpha * edge * meteorHalo);
  }
`
