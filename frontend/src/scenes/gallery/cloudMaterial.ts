import { Color, FrontSide, NormalBlending, ShaderMaterial, Vector3 } from 'three'

export interface GalleryCloudVolumeMaterialOptions {
  kind: 'cloud' | 'haze'
  center: readonly [number, number, number]
  radii: readonly [number, number, number]
  seed: number
  opacity: number
  intensity: number
  moonPosition: readonly [number, number, number]
  moonColor: string
  moonLightIntensity: number
  driftSpeed: number
  steps: number
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
  uniform float uCloudIntensity;
  uniform float uTime;
  uniform float uDriftSpeed;
  uniform float uMoonLightIntensity;
  uniform float uIsHaze;
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

    float segmentLength = (rayEnd - rayStart) / float(CLOUD_STEPS);
    float time = uTime * uDriftSpeed;
    vec3 uvDrift = vec3(time * 0.003, sin(time * 0.035 + uSeed) * 0.014, -time * 0.002);
    float transmittance = 1.0;
    float accumulatedAlpha = 0.0;
    vec3 accumulatedColor = vec3(0.0);

    for (int i = 0; i < CLOUD_STEPS; i++) {
      float distanceAlongRay = rayStart + (float(i) + 0.5) * segmentLength;
      vec3 sampleWorld = cameraPosition + rayDirection * distanceAlongRay;
      vec3 localPosition = (sampleWorld - uCenter) * inverseRadii;
      vec3 noisePosition = localPosition + uvDrift;
      float broad = noise3(noisePosition * 2.15 + vec3(uSeed * 0.013));
      float detail = noise3(noisePosition * 5.3 + vec3(uSeed * 0.027, 6.2, 2.4));

      // A soft, noise-warped 3D boundary leaves darker gaps inside each large mass.
      float radius = length(localPosition);
      float edgeWarp = (broad - 0.5) * 0.75 + (detail - 0.5) * 0.42;
      float rotation = uSeed * 0.137;
      mat2 rotationXZ = mat2(cos(rotation), -sin(rotation), sin(rotation), cos(rotation));
      vec2 rotatedXZ = rotationXZ * localPosition.xz;
      vec3 shapePosition = vec3(rotatedXZ.x, localPosition.y, rotatedXZ.y);
      shapePosition -= vec3(sin(uSeed * 0.31) * 0.07, cos(uSeed * 0.19) * 0.045, sin(uSeed * 0.11) * 0.07);
      float lobeA = 1.0 - smoothstep(0.46 + edgeWarp * 0.2, 0.91 + edgeWarp * 0.2,
        length((shapePosition - vec3(-0.24, 0.02, -0.08)) * vec3(1.42, 1.32, 1.2)));
      float lobeB = 1.0 - smoothstep(0.48 + edgeWarp * 0.2, 0.9 + edgeWarp * 0.2,
        length((shapePosition - vec3(0.23, 0.1, 0.04)) * vec3(1.48, 1.28, 1.34)));
      float lobeC = 1.0 - smoothstep(0.42 + edgeWarp * 0.2, 0.87 + edgeWarp * 0.2,
        length((shapePosition - vec3(-0.02, -0.19, 0.18)) * vec3(1.28, 1.48, 1.32)));
      float cloudShape = smoothMax(smoothMax(lobeA, lobeB, 0.2), lobeC, 0.2);
      float softBoundary = cloudShape;
      float interior = smoothstep(0.27, 0.64, broad * 0.68 + detail * 0.32);
      float density = softBoundary * interior * (0.74 + detail * 0.26);
      if (uIsHaze > 0.5) {
        softBoundary = 1.0 - smoothstep(0.65, 1.3, radius);
        density = softBoundary * (0.25 + broad * 0.35 + detail * 0.2);
      }

      vec3 localMoonDirection = normalize((uMoonPosition - sampleWorld) * inverseRadii);
      vec3 outward = normalize(localPosition + vec3(0.0001));
      float moonFacing = max(dot(outward, localMoonDirection), 0.0);
      float silverEdge = smoothstep(0.2, 0.56, softBoundary) * (1.0 - smoothstep(0.62, 0.96, softBoundary)) * moonFacing;
      float moonNearby = 1.0 - smoothstep(18.0, 76.0, distance(sampleWorld, uMoonPosition));
      float lightResponse = 0.024 + moonFacing * 0.13 + silverEdge * 0.21 + moonNearby * 0.075;
      if (uIsHaze > 0.5) lightResponse = 0.018 + moonNearby * 0.12;
      float lunarLift = clamp(lightResponse * uMoonLightIntensity * 0.86, 0.0, 0.38);
      float innerShade = 0.68 + broad * 0.22 + (1.0 - radius) * 0.11;
      vec3 sampleColor = mix(uBaseColor * innerShade, uMoonColor, lunarLift);

      // Integrate density through the ellipsoid instead of shading its surface.
      float opticalDepth = density * uOpacity * uCloudIntensity * segmentLength * 0.09;
      float sampleAlpha = 1.0 - exp(-max(opticalDepth, 0.0));
      float contribution = transmittance * sampleAlpha;
      accumulatedColor += sampleColor * contribution;
      accumulatedAlpha += contribution;
      transmittance *= 1.0 - sampleAlpha;
      if (transmittance < 0.025) break;
    }

    float entryDistance = rayStart > 0.001 ? rayStart : rayEnd;
    float depthFade = smoothstep(1.5, 8.0, entryDistance);
    float alpha = accumulatedAlpha * depthFade;
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
      uBaseColor: { value: new Color(options.kind === 'haze' ? '#253450' : '#1a2438') },
      uSeed: { value: options.seed },
      uTime: { value: 0 },
      uDriftSpeed: { value: Math.max(0, Math.min(2, options.driftSpeed)) },
      uOpacity: { value: Math.max(0, Math.min(1.5, options.opacity)) },
      uCloudIntensity: { value: Math.max(0, Math.min(2, options.intensity)) },
      uMoonLightIntensity: { value: Math.max(0, options.moonLightIntensity) },
      uIsHaze: { value: options.kind === 'haze' ? 1 : 0 },
    },
    defines: { CLOUD_STEPS: steps },
    vertexShader: cloudVolumeVertexShader,
    fragmentShader: cloudVolumeFragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: NormalBlending,
    side: FrontSide,
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

export function setGalleryAtmosphereTime(materials: readonly ShaderMaterial[], time: number) {
  const safeTime = Number.isFinite(time) ? time : 0
  for (const material of materials) material.uniforms.uTime!.value = safeTime
}
