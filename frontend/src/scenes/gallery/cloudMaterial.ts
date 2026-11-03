import { BackSide, Color, FrontSide, NormalBlending, ShaderMaterial, Vector3 } from 'three'
import { getGalleryAtmosphereStepCount, getGalleryAtmosphereVisibilityFade, type GalleryAtmosphereLayer, type GalleryQuality } from './world'

export interface GalleryCloudVolumeMaterialOptions {
  kind: 'cloud' | 'haze'
  center: readonly [number, number, number]
  radii: readonly [number, number, number]
  seed: number
  opacity: number
  density?: number
  intensity: number
  softness?: number
  coolTint?: number
  whiteHighlight?: number
  moonPosition: readonly [number, number, number]
  moonColor: string
  moonLightIntensity: number
  driftSpeed: number
  steps: number
  /** Draw the near shell in front of the opaque lunar disc while retaining depth occlusion elsewhere. */
  moonOcclusion?: boolean
}

const cloudVolumeVertexShader = `
  varying vec3 vWorldPosition;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

const cloudVolumeFragmentShader = `
  #ifndef CLOUD_STEPS
    #define CLOUD_STEPS 8
  #endif

  uniform vec3 uCenter;
  uniform vec3 uRadii;
  uniform vec3 uMoonPosition;
  uniform vec3 uMoonColor;
  uniform vec3 uBaseColor;
  uniform float uSeed;
  uniform float uOpacity;
  uniform float uCloudDensity;
  uniform float uCloudIntensity;
  uniform float uSoftness;
  uniform float uCoolTint;
  uniform float uWhiteHighlight;
  uniform float uTime;
  uniform float uDriftSpeed;
  uniform float uMoonLightIntensity;
  uniform float uIsHaze;
  uniform float uStepCount;
  uniform float uVisibilityFade;
  varying vec3 vWorldPosition;

  float hash31(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7)) + uSeed * 19.19) * 43758.5453);
  }

  float noise3(vec3 p) {
    vec3 cell = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n000 = hash31(cell);
    float n100 = hash31(cell + vec3(1.0, 0.0, 0.0));
    float n010 = hash31(cell + vec3(0.0, 1.0, 0.0));
    float n110 = hash31(cell + vec3(1.0, 1.0, 0.0));
    float n001 = hash31(cell + vec3(0.0, 0.0, 1.0));
    float n101 = hash31(cell + vec3(1.0, 0.0, 1.0));
    float n011 = hash31(cell + vec3(0.0, 1.0, 1.0));
    float n111 = hash31(cell + vec3(1.0, 1.0, 1.0));
    float x00 = mix(n000, n100, f.x);
    float x10 = mix(n010, n110, f.x);
    float x01 = mix(n001, n101, f.x);
    float x11 = mix(n011, n111, f.x);
    return mix(mix(x00, x10, f.y), mix(x01, x11, f.y), f.z);
  }

  float smoothMax(float a, float b, float width) {
    float h = max(width - abs(a - b), 0.0) / width;
    return max(a, b) + h * h * width * 0.25;
  }

  void main() {
    if (uVisibilityFade <= 0.001) discard;
    vec3 rayDirection = normalize(vWorldPosition - cameraPosition);
    vec3 inverseRadii = 1.0 / max(uRadii, vec3(0.001));
    vec3 localOrigin = (cameraPosition - uCenter) * inverseRadii;
    vec3 localDirection = rayDirection * inverseRadii;
    float a = dot(localDirection, localDirection);
    float b = dot(localOrigin, localDirection);
    float c = dot(localOrigin, localOrigin) - 1.0;
    float discriminant = b * b - a * c;
    if (discriminant <= 0.0 || a <= 0.0) discard;

    float root = sqrt(discriminant);
    float rayStart = max((-b - root) / a, 0.0);
    float rayEnd = (-b + root) / a;
    if (rayEnd <= rayStart) discard;

    float stepCount = clamp(uStepCount, 2.0, float(CLOUD_STEPS));
    float segmentLength = (rayEnd - rayStart) / stepCount;
    float time = uTime * uDriftSpeed;
    vec3 uvDrift = vec3(time * 0.014, sin(time * 0.09 + uSeed) * 0.032, -time * 0.01);
    float transmittance = 1.0;
    float accumulatedAlpha = 0.0;
    vec3 accumulatedColor = vec3(0.0);

    for (int i = 0; i < CLOUD_STEPS; i++) {
      float sampleWeight = clamp(stepCount - float(i), 0.0, 1.0);
      if (sampleWeight <= 0.0) break;
      // The fractional final segment occupies only sampleWeight of this nominal
      // segment, so place its sample at that partial interval's midpoint.
      float distanceAlongRay = rayStart + (float(i) + sampleWeight * 0.5) * segmentLength;
      vec3 sampleWorld = cameraPosition + rayDirection * distanceAlongRay;
      vec3 localPosition = (sampleWorld - uCenter) * inverseRadii;
    float isHaze = uIsHaze;
    vec3 noisePosition = localPosition + uvDrift;
    float broadFrequency = 2.3;
    float detailFrequency = 7.1;
    vec3 broadOffset = vec3(uSeed * 0.013);
    vec3 detailOffset = vec3(uSeed * 0.027, 6.2, 2.4);
    if (isHaze > 0.5) {
      // Sample one continuous world-space field across every haze volume. The
      // shared domain makes overlapping masses blend instead of revealing shells.
      vec3 eddies = vec3(
        sin(sampleWorld.y * 0.035 + sampleWorld.z * 0.012 + time * 0.13),
        sin(sampleWorld.z * 0.032 + sampleWorld.x * 0.016 - time * 0.09),
        sin(sampleWorld.x * 0.031 + sampleWorld.y * 0.019 + time * 0.07)
      ) * 0.18;
      vec3 flow = vec3(time * 0.11, sin(time * 0.11) * 0.06, -time * 0.072);
      noisePosition = sampleWorld * 0.045 + eddies + flow;
      broadFrequency = 1.55;
      detailFrequency = 4.4;
      broadOffset = vec3(0.0);
      detailOffset = vec3(0.0);
    }
    float broad = noise3(noisePosition * broadFrequency + broadOffset);
    float detail = noise3(noisePosition * detailFrequency + detailOffset);

    float radius = length(localPosition);
    float softBoundary;
    float density;
    if (isHaze > 0.5) {
      // Let density taper to zero at the proxy boundary and fade each sample
      // near the camera, avoiding a visible shell when the camera enters fog.
      softBoundary = 1.0 - smoothstep(0.5, 1.0, radius);
      float coverage = smoothstep(0.24, 0.72, broad * 0.72 + detail * 0.28);
      float sampleDepthFade = smoothstep(3.0, 16.0, distanceAlongRay);
      density = softBoundary * (0.22 + coverage * 0.58) * (0.8 + broad * 0.2) * sampleDepthFade;
    } else {
      // A soft, noise-warped 3D boundary leaves darker gaps inside each cloud mass.
      float edgeWarp = (broad - 0.5) * 0.88 + (detail - 0.5) * 0.72;
      float rotation = uSeed * 0.137;
      mat2 rotationXZ = mat2(cos(rotation), -sin(rotation), sin(rotation), cos(rotation));
      vec2 rotatedXZ = rotationXZ * localPosition.xz;
      vec3 shapePosition = vec3(rotatedXZ.x, localPosition.y, rotatedXZ.y);
      shapePosition -= vec3(sin(uSeed * 0.31) * 0.07, cos(uSeed * 0.19) * 0.045, sin(uSeed * 0.11) * 0.07);
      float edgeSoftness = mix(0.12, 0.38, clamp(uSoftness, 0.0, 1.0));
      float lobeA = 1.0 - smoothstep(0.46 + edgeWarp * 0.2, 0.91 + edgeWarp * 0.2 + edgeSoftness,
        length((shapePosition - vec3(-0.24, 0.02, -0.08)) * vec3(1.42, 1.32, 1.2)));
      float lobeB = 1.0 - smoothstep(0.48 + edgeWarp * 0.2, 0.9 + edgeWarp * 0.2 + edgeSoftness,
        length((shapePosition - vec3(0.23, 0.1, 0.04)) * vec3(1.48, 1.28, 1.34)));
      float lobeC = 1.0 - smoothstep(0.42 + edgeWarp * 0.2, 0.87 + edgeWarp * 0.2 + edgeSoftness,
        length((shapePosition - vec3(-0.02, -0.19, 0.18)) * vec3(1.28, 1.48, 1.32)));
      softBoundary = smoothMax(smoothMax(lobeA, lobeB, edgeSoftness), lobeC, edgeSoftness);
      float cloudTexture = broad * 0.52 + detail * 0.48;
      float interior = smoothstep(mix(0.52, 0.34, uSoftness) - uCloudDensity * 0.18, mix(0.7, 0.84, uSoftness), cloudTexture);
      density = softBoundary * interior * (0.46 + broad * 0.22 + detail * 0.32) * uCloudDensity;
    }

      vec3 localMoonDirection = normalize((uMoonPosition - sampleWorld) * inverseRadii);
      vec3 outward = normalize(localPosition + vec3(0.0001));
      float moonFacing = max(dot(outward, localMoonDirection), 0.0);
      float silverEdge = smoothstep(0.2, 0.56, softBoundary) * (1.0 - smoothstep(0.62, 0.96, softBoundary)) * moonFacing;
      float moonNearby = 1.0 - smoothstep(18.0, 76.0, distance(sampleWorld, uMoonPosition));
      float whiteStrength = clamp(uWhiteHighlight, 0.0, 1.5);
      float lightResponse = 0.045 + moonFacing * 0.11 + silverEdge * 0.24 * whiteStrength + moonNearby * 0.075;
      if (isHaze > 0.5) lightResponse = 0.012 + moonNearby * 0.065 * whiteStrength;
      float lightBreath = 0.96 + 0.04 * sin(time * 0.22 + uSeed * 0.07);
      float lunarLift = clamp(lightResponse * uMoonLightIntensity * lightBreath * 0.95, 0.0, 0.32);
      float innerShade = 0.48 + broad * 0.34 + detail * 0.2 + (1.0 - radius) * 0.1;
      vec3 blueAir = vec3(0.025, 0.11, 0.28);
      vec3 coolBase = mix(uBaseColor, blueAir, clamp(uCoolTint / 1.5, 0.0, 1.0));
      vec3 sampleColor = mix(coolBase * innerShade, uMoonColor, lunarLift) * uCloudIntensity;

      // Brightness changes cloud radiance; opacity and density alone control coverage.
      float opticalDepth = density * uOpacity * segmentLength * 0.16 * sampleWeight;
      float sampleAlpha = 1.0 - exp(-max(opticalDepth, 0.0));
      float contribution = transmittance * sampleAlpha;
      accumulatedColor += sampleColor * contribution;
      accumulatedAlpha += contribution;
      transmittance *= 1.0 - sampleAlpha;
      if (transmittance < 0.025) break;
    }

    float entryDistance = rayStart > 0.001 ? rayStart : rayEnd;
    float depthFade = smoothstep(1.5, 8.0, entryDistance);
    float alpha = accumulatedAlpha * depthFade * uVisibilityFade;
    if (alpha < 0.004) discard;
    vec3 color = accumulatedColor / max(accumulatedAlpha, 0.0001);
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`

export function createGalleryCloudVolumeMaterial(options: GalleryCloudVolumeMaterialOptions) {
  const steps = Math.max(3, Math.min(12, Math.round(options.steps)))
  return new ShaderMaterial({
    uniforms: {
      uCenter: { value: new Vector3(...options.center) },
      uRadii: { value: new Vector3(...options.radii) },
      uMoonPosition: { value: new Vector3(...options.moonPosition) },
      uMoonColor: { value: new Color(options.moonColor) },
      uBaseColor: { value: new Color(options.kind === 'haze' ? '#102343' : '#17375c') },
      // Haze samples one shared world-space field; per-mass seeds are only for clouds.
      uSeed: { value: options.kind === 'haze' ? 0 : options.seed },
      uTime: { value: 0 },
      uDriftSpeed: { value: Math.max(0, Math.min(3, options.driftSpeed)) },
      uOpacity: { value: Math.max(0, Math.min(1.5, options.opacity)) },
      uCloudDensity: { value: Math.max(0, Math.min(1.8, options.density ?? 0.9)) },
      uCloudIntensity: { value: Math.max(0, Math.min(2, options.intensity)) },
      uSoftness: { value: Math.max(0, Math.min(1, options.softness ?? 0.78)) },
      uCoolTint: { value: Math.max(0, Math.min(1.5, options.coolTint ?? 1)) },
      uWhiteHighlight: { value: Math.max(0, Math.min(1.5, options.whiteHighlight ?? 0.48)) },
      uMoonLightIntensity: { value: Math.max(0, options.moonLightIntensity) },
      uIsHaze: { value: options.kind === 'haze' ? 1 : 0 },
      uStepCount: { value: steps },
      uVisibilityFade: { value: 1 },
    },
    defines: { CLOUD_STEPS: steps },
    vertexShader: cloudVolumeVertexShader,
    fragmentShader: cloudVolumeFragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: NormalBlending,
    // Most volumes use the exit shell so they remain visible when the camera enters them. Wisps in front of the moon
    // use the near shell, allowing their depth-tested volume to softly overlap the opaque lunar disc.
    side: options.moonOcclusion ? FrontSide : BackSide,
    toneMapped: false,
  })
}

/** Mirrors the shader's near/far fade and stays visible when the camera starts inside a volume. */
export function getGalleryVolumeDepthFade(rayStart: number, rayEnd: number): number {
  if (!Number.isFinite(rayStart) || !Number.isFinite(rayEnd) || rayEnd <= 0) return 0
  const distance = rayStart > 0.001 ? rayStart : rayEnd
  const t = Math.max(0, Math.min(1, (distance - 1.5) / (8 - 1.5)))
  return t * t * (3 - 2 * t)
}

export interface GalleryVolumeRaySample {
  distance: number
  weight: number
}

/** Mirrors the shader's weighted midpoint samples for validating its ray integration. */
export function getGalleryVolumeRaySamples(
  rayStart: number,
  rayEnd: number,
  requestedStepCount: number,
  maxStepCount = 12,
): GalleryVolumeRaySample[] {
  if (!Number.isFinite(rayStart) || !Number.isFinite(rayEnd) || rayEnd <= rayStart) return []
  const stepCount = Math.max(2, Math.min(maxStepCount, requestedStepCount))
  const segmentLength = (rayEnd - rayStart) / stepCount
  const samples: GalleryVolumeRaySample[] = []

  for (let index = 0; index < Math.ceil(stepCount); index += 1) {
    const weight = Math.max(0, Math.min(1, stepCount - index))
    if (weight <= 0) break
    samples.push({
      distance: rayStart + (index + weight * 0.5) * segmentLength,
      weight,
    })
  }

  return samples
}

export function setGalleryAtmosphereTime(materials: readonly ShaderMaterial[], time: number) {
  const safeTime = Number.isFinite(time) ? time : 0
  for (const material of materials) material.uniforms.uTime!.value = safeTime
}

/** Reapply view-dependent uniforms on every pass so mirror LOD cannot persist into the main draw. */
export function setGalleryAtmosphereView(
  material: ShaderMaterial,
  quality: GalleryQuality,
  layer: GalleryAtmosphereLayer,
  cameraDistance: number,
  reflection = false,
  moonInteraction = false,
) {
  material.uniforms.uStepCount!.value = getGalleryAtmosphereStepCount(quality, layer, cameraDistance, reflection)
  const visibilityFade = getGalleryAtmosphereVisibilityFade(cameraDistance, layer, moonInteraction)
  material.uniforms.uVisibilityFade!.value = visibilityFade
  return visibilityFade
}
