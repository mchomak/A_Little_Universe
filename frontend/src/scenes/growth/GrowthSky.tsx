import { useEffect, useMemo } from 'react'
import { BackSide, ShaderMaterial } from 'three'

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
  void main() {
    float height = normalize(vWorldPosition).y;
    float lowerHaze = 1.0 - smoothstep(-0.28, 0.42, height);
    vec3 upperNight = vec3(0.031, 0.035, 0.078);
    vec3 midNight = vec3(0.047, 0.082, 0.157);
    vec3 lowAtmosphere = vec3(0.078, 0.137, 0.235);
    vec3 color = mix(upperNight, midNight, smoothstep(-0.05, 0.68, height));
    color = mix(color, lowAtmosphere, lowerHaze * 0.66);
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`

/** Quiet, world-sized night gradient shared by the fall, growth and scene handoff. */
export function GrowthSky() {
  const material = useMemo(() => new ShaderMaterial({
    vertexShader,
    fragmentShader,
    side: BackSide,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  }), [])
  useEffect(() => () => material.dispose(), [material])

  return <mesh scale={90} renderOrder={-100} frustumCulled={false} raycast={() => undefined}>
    <sphereGeometry args={[1, 24, 16]} />
    <primitive object={material} attach="material" />
  </mesh>
}
