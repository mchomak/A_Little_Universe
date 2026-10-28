/** Fixed particle identities; no simulation history, random frame state or extra points. */
export function createVortexAttributes(count: number) {
  const orbit = new Float32Array(count * 4)
  const impulse = new Float32Array(count * 4)
  const random = (i: number, salt: number) => {
    const value = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
    return value - Math.floor(value)
  }
  for (let i = 0; i < count; i++) {
    const j = i * 4
    const population = random(i, 1)
    const kind = population < .27 ? 0 : population < .973 ? 1 : 2
    const armSample = random(i, 2)
    const arm = armSample < .49 ? 0 : armSample < .81 ? 1 : 2
    const armPhase = [0, 2.48, 4.76][arm]!
    const core = random(i, 3) < .14
    const radius = core ? .08 + Math.pow(random(i, 4), .7) * .52
      : .38 + Math.pow(random(i, 4), .72) * [2.65, 2.2, 2.45][arm]!
    const width = kind === 0 ? 1.8 : .08 + .18 * random(i, 5)
    // Unequal arms, loose dust and radial knots instead of three uniform ribbons.
    const phase = armPhase + radius * 2.15 + (random(i, 6) - .5) * width
      + .13 * Math.sin(radius * 11 + arm * 2)
    const height = (random(i, 7) - .5) * (kind === 0 ? 1.6 : .22 + radius * .19)
    orbit.set([radius, phase, height, kind], j)
    const azimuth = random(i, 8) * Math.PI * 2
    const vertical = random(i, 9) * 2 - 1
    const planar = Math.sqrt(1 - vertical * vertical)
    const speed = (kind === 0 ? .22 : kind === 1 ? .8 : 2.2) * (.7 + random(i, 10) * .6)
    impulse.set([Math.cos(azimuth) * planar * speed, vertical * speed,
      Math.sin(azimuth) * planar * speed, .22 + random(i, 11) * 1.28], j)
  }
  return { orbit, impulse }
}

/** Shared by points and their short, time-sampled trails. Absolute film seconds only.
 * The existing 04.1 position is exact at 4s. At 8s motion freezes for the unchanged
 * name morph (7.5–10.3s), avoiding an endpoint snap or a second simulation clock. */
export const identityVortexGLSL = `
vec3 legacyIdentityPosition(vec3 origin, vec3 spiral, float time, float motion) {
  float angle = (time - 4.0) * .13 * motion;
  spiral.xy = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * spiral.xy;
  return mix(origin, spiral, smoothstep(1.0, 5.3, time));
}
vec3 identityVortexPosition(vec3 origin, vec3 spiral, vec4 orbit, vec4 impulse, float seed, float time, float motion) {
  vec3 legacy = legacyIdentityPosition(origin, spiral, time, motion);
  if (time <= 4.0 || time >= 10.3) return legacy;
  float age = clamp(time - 4.0, 0.0, 4.0);
  vec3 entry = legacyIdentityPosition(origin, spiral, 4.0, motion);
  vec3 freeFlight = entry + impulse.xyz * (1.0 - exp(-age * 3.2)) * .82 * motion;
  float dust = 1.0 - step(.5, orbit.w);
  float capture = smoothstep(impulse.w, impulse.w + 1.08 + seed * .28, age);
  float radius = orbit.x * (1.08 - capture * .08);
  float speed = (.18 + .52 / (.65 + radius)) * (.94 + seed * .12);
  speed *= mix(1.0, 1.65, step(1.5, orbit.w));
  float angle = orbit.y - age * speed * motion;
  float wave = sin(radius * 4.3 + angle * 2.0 - age * .55);
  vec3 flow = vec3(cos(angle) * radius, sin(angle) * radius * .54,
    sin(angle) * radius * .38 + orbit.z);
  flow.y += wave * .07;
  flow.x *= mix(.9, 1.08, smoothstep(0.0, 3.6, age));
  // Low frequency, spatially coherent curl: no frame-random jitter.
  flow += vec3(sin(flow.y * 2.4 + seed * 7.0 + age * .45),
    sin(flow.z * 2.1 + seed * 9.0 - age * .38),
    cos(flow.x * 1.8 + seed * 6.0 + age * .42)) * (.035 + dust * .055) * motion;
  vec3 captured = mix(freeFlight, flow, capture * (1.0 - dust * .24));
  return mix(legacy, captured, smoothstep(4.0, 4.24, time));
}
float identityVortexEnvelope(float time) {
  return smoothstep(4.0, 4.35, time) * (1.0 - smoothstep(8.0, 10.3, time));
}
`
