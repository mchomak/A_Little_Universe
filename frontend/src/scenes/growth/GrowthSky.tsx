import { useEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { BackSide, ShaderMaterial } from 'three'
import type { FilmRuntime } from '../../engine/runtime'
import { getPhoneBackgroundProgress } from '../../components/phoneBackgroundMotion'

interface GrowthSkyProps {
  runtime: FilmRuntime
  fallRange: readonly [number, number]
  nightEstablished: boolean
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function getAtmosphereOpacity(progress: number): number {
  const blend = clamp((progress - 0.2) / (0.75 - 0.2), 0, 1)
  return blend * blend * (3 - 2 * blend)
}

const vertexShader = `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

const fragmentShader = `
  varying vec3 vWorldPosition;
  uniform float uOpacity;
  void main() {
    float height = normalize(vWorldPosition).y;
    vec3 upperNight = vec3(0.002125, 0.006512, 0.019382);
    vec3 midNight = vec3(0.003035, 0.015209, 0.059511);
    vec3 lowAtmosphere = vec3(0.008568, 0.028426, 0.070360);
    vec3 color = mix(lowAtmosphere, midNight, smoothstep(-0.92, 0.24, height));
    color = mix(color, upperNight, smoothstep(0.22, 0.92, height));
    float lowerHaze = 1.0 - smoothstep(-0.98, -0.28, height);
    color = mix(color, lowAtmosphere, lowerHaze * 0.18);
    gl_FragColor = vec4(color, uOpacity);
    #include <colorspace_fragment>
  }
`

/** Quiet, world-sized night gradient shared by the fall, growth and scene handoff. */
export function GrowthSky({ runtime, fallRange, nightEstablished }: GrowthSkyProps) {
  const invalidate = useThree(({ invalidate }) => invalidate)
  const material = useMemo(() => new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: { uOpacity: { value: 0 } },
    side: BackSide,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
  }), [])
  const materialRef = useRef(material)
  useEffect(() => () => material.dispose(), [material])
  useEffect(() => {
    const update = (time: number) => {
      const progress = nightEstablished ? 1 : getPhoneBackgroundProgress(time, fallRange)
      materialRef.current.uniforms.uOpacity!.value = getAtmosphereOpacity(progress)
      invalidate()
    }
    update(runtime.time)
    if (nightEstablished) return
    return runtime.subscribeFrame(update)
  }, [fallRange, invalidate, nightEstablished, runtime])

  return <mesh scale={90} renderOrder={-100} frustumCulled={false} raycast={() => undefined}>
    <sphereGeometry args={[1, 24, 16]} />
    <primitive object={material} attach="material" />
  </mesh>
}
