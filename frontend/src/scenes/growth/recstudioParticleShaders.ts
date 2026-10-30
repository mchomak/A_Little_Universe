import { BITANGENT_NOISE_GLSL } from './bitangentNoise'

/** GLSL3 fullscreen pass shared by the position and velocity ping-pong steps. */
export const simulationVertexShader = /* glsl */ `
in vec3 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

/** RecStudio's curl drift, spring, containment, spin and exponential drag. */
export const recstudioVelocityShader = /* glsl */ `
precision highp float;
precision highp int;
${BITANGENT_NOISE_GLSL}

in vec2 vUv;
layout(location = 0) out vec4 fragColor;
uniform sampler2D uPosition;
uniform sampler2D uVelocity;
uniform sampler2D uTarget;
uniform float uDt;
uniform float uTime;
uniform float uMorph;
uniform float uNoiseStrength;
uniform float uSpring;
uniform float uDamping;
uniform float uMorphDamping;
uniform float uCloudRadius;

void main() {
  vec3 pos = texture(uPosition, vUv).xyz;
  vec4 vel4 = texture(uVelocity, vUv);
  vec3 vel = vel4.xyz;
  float seed = vel4.w;
  vec4 target = texture(uTarget, vUv);

  float variance = 0.65 + seed * 0.7;
  vec3 curl = BitangentNoise4D(vec4(pos * 2.7, uTime * 0.72));
  float freeDrift = mix(0.45, 0.025, target.w);
  vel += curl * uNoiseStrength * variance * mix(1.0, freeDrift, uMorph) * uDt;

  vec3 toTarget = target.xyz - pos;
  float stagger = 0.55 + 0.9 * seed;
  vel += toTarget * uSpring * stagger * uMorph * target.w * uDt;

  float shellDist = length(pos) + 1e-6;
  vec3 shellDir = normalize(pos + vec3(1e-6));
  float outside = max(0.0, shellDist - uCloudRadius);
  vel -= shellDir * outside * 2.2 * (1.0 - uMorph) * uDt;
  vel += cross(vec3(0.0, 1.0, 0.0), pos) * 0.12 * (1.0 - uMorph) * uDt;

  float settledDamping = mix(1.15, uMorphDamping, target.w);
  float damping = mix(uDamping, settledDamping, uMorph);
  vel *= exp(-damping * uDt);
  fragColor = vec4(vel, seed);
}
`

export const simulationPositionShader = /* glsl */ `
precision highp float;
in vec2 vUv;
layout(location = 0) out vec4 fragColor;
uniform sampler2D uPosition;
uniform sampler2D uVelocity;
uniform float uDt;
void main() {
  vec3 positionNow = texture(uPosition, vUv).xyz;
  vec3 velocityNow = texture(uVelocity, vUv).xyz;
  fragColor = vec4(positionNow + velocityNow * uDt, 1.0);
}
`

export const simulationCopyShader = /* glsl */ `
precision highp float;
in vec2 vUv;
layout(location = 0) out vec4 fragColor;
uniform sampler2D uSource;
void main() { fragColor = texture(uSource, vUv); }
`

/** One point per simulation texel; RecStudio's perspective and speed lighting retained. */
export const seedPointsVertexShader = /* glsl */ `
precision highp float;
in vec3 position;
in vec2 aRef;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform sampler2D uPosition;
uniform sampler2D uVelocity;
uniform sampler2D uTarget;
uniform float uSize;
uniform float uPixelRatio;
uniform float uTime;
uniform float uFormationProgress;
out float vSpeed;
out float vSeed;
out float vBirth;
out float vFree;
void main() {
  vec3 particlePosition = texture(uPosition, aRef).xyz;
  vec4 velocity = texture(uVelocity, aRef);
  vSeed = velocity.w;
  vFree = 1.0 - texture(uTarget, aRef).w;
  vSpeed = clamp(length(velocity.xyz) / 1.7, 0.0, 1.0);
  vBirth = smoothstep(vSeed * 0.42, vSeed * 0.42 + 0.22, uTime);
  vec4 mv = modelViewMatrix * vec4(particlePosition, 1.0);
  gl_PointSize = min(10.0, uSize * uPixelRatio * (0.78 + 0.42 * vSeed) / max(-mv.z, 0.1));
  gl_Position = projectionMatrix * mv;
}
`

export const seedPointsFragmentShader = /* glsl */ `
precision highp float;
in float vSpeed;
in float vSeed;
in float vBirth;
in float vFree;
uniform vec3 uPearlColor;
uniform vec3 uRoseColor;
uniform vec3 uLavenderColor;
uniform float uOpacity;
uniform float uFormationProgress;
uniform float uFormationDuration;
uniform float uTime;
layout(location = 0) out vec4 fragColor;
void main() {
  vec2 point = (gl_PointCoord - 0.5) * 2.0;
  float radius = length(point);
  float falloff = pow(max(0.0, 1.0 - radius), 2.2);
  if (falloff < 0.003) discard;

  float bodyFade = 1.0 - smoothstep(0.72, 1.02, uFormationProgress);
  float tailFade = 1.0 - smoothstep(uFormationDuration + 0.14, uFormationDuration + 0.95, uTime);
  float reveal = mix(bodyFade, tailFade, vFree);
  vec3 color = mix(uPearlColor, uRoseColor, smoothstep(0.42, 0.9, vSeed));
  color = mix(color, uLavenderColor, step(0.925, vSeed) * 0.76);
  color = mix(color, uRoseColor, smoothstep(0.32, 0.95, vSpeed) * (1.0 - vFree) * 0.45);
  color *= 0.8 + 0.35 * vSeed;
  vec3 encoded = pow(max(color, vec3(0.0)), vec3(1.0 / 2.2));
  fragColor = vec4(encoded, falloff * uOpacity * reveal * vBirth);
}
`
