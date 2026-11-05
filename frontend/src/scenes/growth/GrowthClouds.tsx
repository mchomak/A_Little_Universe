import { useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useThree } from '@react-three/fiber'
import { Color, Group, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from 'three'
import type { FilmRuntime } from '../../engine/runtime'
import {
  createGrowthCloudVolumeMaterial, getGrowthCloudLunarLight, getGrowthCloudMasses, getGrowthCloudPosition, MAX_GROWTH_CLOUD_MASSES,
  getGrowthCloudMotionTime, getGrowthCloudVisibility, setGrowthCloudMoonPosition,
} from './growthCloudMath'
import {
  getGrowthViewportHeight, getSeedFallDistance, getSeedFallHeightMultiplier, type GrowthFrames, type GrowthSettings,
} from './seedProcedure'

const CLOUD_RENDER_LIMIT = MAX_GROWTH_CLOUD_MASSES
const noRaycast = () => undefined

/** Small moonlit volumes attached to the shared Scene 02 world and FilmRuntime. */
export function GrowthClouds({
  runtime,
  reducedMotion,
  frames,
  environmentOpacity,
  settings,
}: {
  runtime: FilmRuntime
  reducedMotion: boolean
  frames: GrowthFrames
  environmentOpacity: MutableRefObject<number>
  settings: GrowthSettings
}) {
  const invalidate = useThree(({ invalidate }) => invalidate)
  const viewportHeight = useThree(({ size }) => getGrowthViewportHeight(size.width, size.height))
  const root = useRef<Group>(null)
  const meshes = useRef<Array<Mesh | null>>([])
  const materialRefs = useRef<Array<ShaderMaterial | null>>([])
  const geometry = useMemo(() => new SphereGeometry(1, 20, 14), [])
  const materials = useMemo(() => getGrowthCloudMasses(CLOUD_RENDER_LIMIT, 1)
    .map(({ seed }) => createGrowthCloudVolumeMaterial({ seed })), [])
  const effectiveFallHeight = getSeedFallHeightMultiplier(settings.seedFallHeight, reducedMotion)
  const fallDistance = getSeedFallDistance(viewportHeight) * effectiveFallHeight
  const masses = useMemo(() => getGrowthCloudMasses(settings.cloudCount, settings.cloudScale, {
    fallDistance,
    viewportHeight,
    sizeVariation: settings.cloudSizeVariation,
    lightVariation: settings.cloudLightVariation,
    pathDensity: reducedMotion ? 0 : settings.cloudPathDensity,
    depthVariation: settings.cloudDepthVariation,
  }), [
    fallDistance, reducedMotion, settings.cloudCount, settings.cloudDepthVariation, settings.cloudLightVariation,
    settings.cloudPathDensity, settings.cloudScale, settings.cloudSizeVariation, viewportHeight,
  ])
  const rootOrigin = useMemo(() => new Vector3(), [])
  const moonPosition = useMemo(() => new Vector3(), [])
  const moonColor = useMemo(() => new Color(), [])
  const center = useMemo(() => new Vector3(), [])

  useLayoutEffect(() => () => {
    geometry.dispose()
    materials.forEach((material) => material.dispose())
  }, [geometry, materials])

  useLayoutEffect(() => {
    const update = (time: number) => {
      const safeTime = Number.isFinite(time) ? time : 0
      const motionTime = getGrowthCloudMotionTime(safeTime, reducedMotion)
      const motionSpeed = reducedMotion ? 0 : settings.cloudDriftSpeed
      root.current?.getWorldPosition(rootOrigin)
      setGrowthCloudMoonPosition(moonPosition, rootOrigin, settings.moonPositionY, settings.moonPositionX, settings.moonPositionZ)
      moonColor.set(settings.moonLightColor)

      for (let index = 0; index < CLOUD_RENDER_LIMIT; index++) {
        const mesh = meshes.current[index]
        const mass = masses[index]
        const material = materialRefs.current[index]
        if (!material) continue
        const opacity = getGrowthCloudVisibility(
          safeTime, frames, settings.cloudOpacity, environmentOpacity.current, mass?.persistent, reducedMotion,
          settings.seedFallAcceleration,
        )
        material.uniforms.uOpacity!.value = opacity
        material.uniforms.uDensity!.value = settings.cloudDensity * (mass?.densityScale ?? 1)
        material.uniforms.uLightIntensity!.value = getGrowthCloudLunarLight(safeTime, frames, settings.cloudLightIntensity, settings.moonLightIntensity, mass?.lightScale ?? 1)
        material.uniforms.uShapeVariation!.value = settings.cloudShapeVariation
        material.uniforms.uMoonColor!.value.copy(moonColor)
        material.uniforms.uMoonPosition!.value.copy(moonPosition)
        material.uniforms.uTime!.value = motionTime * motionSpeed
        material.uniforms.uSeed!.value = mass?.seed ?? 0

        if (!mesh || !mass) continue
        mesh.position.set(...getGrowthCloudPosition(mass, motionTime, motionSpeed))
        mesh.scale.set(...mass.radii)
        mesh.getWorldPosition(center)
        material.uniforms.uCenter!.value.copy(center)
        material.uniforms.uRadii!.value.set(...mass.radii)
        mesh.visible = opacity > 0 && settings.cloudDensity > 0
      }
      invalidate()
    }

    update(runtime.time)
    return runtime.subscribeFrame(update)
  }, [
    center, environmentOpacity, frames, invalidate, masses, materials, moonColor, moonPosition,
    reducedMotion, rootOrigin, runtime, settings.cloudDensity, settings.cloudDriftSpeed,
    settings.cloudLightIntensity, settings.cloudOpacity, settings.moonLightColor,
    settings.moonPositionX, settings.moonPositionY, settings.moonPositionZ, settings.seedFallAcceleration,
    settings.moonLightIntensity, settings.cloudShapeVariation,
  ])

  return <group ref={root} dispose={null}>
    {masses.map((mass, index) => <mesh
      key={mass.id}
      ref={(mesh) => { meshes.current[index] = mesh }}
      position={mass.position}
      scale={mass.radii}
      visible={false}
      raycast={noRaycast}
      renderOrder={-4}
    >
      <primitive object={geometry} attach="geometry" />
      <primitive
        object={materials[index]!}
        attach="material"
        ref={(material: ShaderMaterial | null) => { materialRefs.current[index] = material }}
      />
    </mesh>)}
  </group>
}
