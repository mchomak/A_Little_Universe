import { useEffect, useMemo } from 'react'
import { DoubleSide, ShaderMaterial } from 'three'
import type { SceneComposerConfig } from '../../systems/scene-config/config'
import { GALLERY_WORLD } from './world'
import { getMoonReflectionDepthSpan } from './moonLighting'

type GallerySettings = SceneComposerConfig['scenes']['gallery']

const vertexShader = `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

const fragmentShader = `
  uniform float uReflectionStrength;
  uniform float uReflectionBlur;
  uniform float uColdLightIntensity;
  uniform float uMoonLightIntensity;
  uniform vec2 uMoonPosition;
  uniform vec2 uMoonTarget;
  uniform float uMoonDepthSpan;
  varying vec3 vWorldPosition;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 cell = floor(p);
    vec2 part = fract(p);
    vec2 fade = part * part * (3.0 - 2.0 * part);
    float a = hash(cell);
    float b = hash(cell + vec2(1.0, 0.0));
    float c = hash(cell + vec2(0.0, 1.0));
    float d = hash(cell + vec2(1.0, 1.0));
    return mix(mix(a, b, fade.x), mix(c, d, fade.x), fade.y);
  }

  void main() {
    vec2 world = vWorldPosition.xz;
    float broadVariation = noise(world * vec2(0.12, 0.045));
    float fineVariation = noise(world * vec2(1.7, 0.72));
    float microVariation = noise(world * vec2(5.1, 2.1));
    float textureValue = broadVariation * 0.48 + fineVariation * 0.36 + microVariation * 0.16;

    float xFade = 1.0 - smoothstep(56.0, 70.0, abs(world.x));
    float nearFade = 1.0 - smoothstep(24.0, 44.0, world.y);
    float farFade = smoothstep(-420.0, -325.0, world.y);
    float edgeFade = xFade * nearFade * farFade;

    float reflectionWidth = mix(0.18, 1.35, uReflectionBlur);
    float trailProgress = abs(uMoonDepthSpan) < 0.0001 ? 0.5
      : clamp((world.y - uMoonPosition.y) / uMoonDepthSpan, 0.0, 1.0);
    float trailCenter = mix(uMoonPosition.x, uMoonTarget.x, trailProgress);
    float reflectionPath = exp(-abs(world.x - trailCenter) / reflectionWidth);
    float reflectionGlow = exp(-abs(world.x - trailCenter) / (reflectionWidth * 3.8));
    float farPath = smoothstep(-280.0, -130.0, world.y);
    float nearPath = 1.0 - smoothstep(8.0, 24.0, world.y);
    float staticBreakup = 0.5 + fineVariation * 0.28 + microVariation * 0.22;
    float reflection = (reflectionPath * 0.62 + reflectionGlow * 0.14) * farPath * nearPath * staticBreakup
      * uReflectionStrength * uColdLightIntensity * uMoonLightIntensity * 1.2;

    vec3 deepWater = vec3(0.002, 0.006, 0.022);
    vec3 coolWater = vec3(0.006, 0.018, 0.052);
    vec3 base = mix(deepWater, coolWater, 0.12 + textureValue * 0.42);
    vec3 silverPath = vec3(0.42, 0.62, 0.9) * reflection;
    vec3 color = (base + silverPath) * edgeFade;
    gl_FragColor = vec4(color, edgeFade * 0.97);
    #include <colorspace_fragment>
  }
`

export function WetFloor({ settings }: { settings: GallerySettings }) {
  const floorMaterial = useMemo(() => new ShaderMaterial({
    uniforms: {
      uReflectionStrength: { value: settings.reflectionStrength },
      uReflectionBlur: { value: settings.reflectionBlur },
      uColdLightIntensity: { value: settings.coldLightIntensity },
      uMoonLightIntensity: { value: settings.moonLightIntensity },
      uMoonPosition: { value: [settings.moonPositionX, settings.moonPositionZ] },
      uMoonTarget: { value: [settings.moonTargetX, settings.moonTargetZ] },
      uMoonDepthSpan: { value: getMoonReflectionDepthSpan(settings.moonPositionZ, settings.moonTargetZ) },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
  }), [settings.coldLightIntensity, settings.moonLightIntensity, settings.moonPositionX, settings.moonPositionZ, settings.moonTargetX, settings.moonTargetZ, settings.reflectionBlur, settings.reflectionStrength])

  useEffect(() => () => floorMaterial.dispose(), [floorMaterial])

  return <mesh
    position={[0, GALLERY_WORLD.floor.y, GALLERY_WORLD.floor.centerZ]}
    rotation={[-Math.PI / 2, 0, 0]}
    raycast={() => undefined}
    renderOrder={-1}
  >
    <planeGeometry args={[GALLERY_WORLD.floor.width, GALLERY_WORLD.floor.depth]} />
    <primitive object={floorMaterial} attach="material" />
  </mesh>
}
