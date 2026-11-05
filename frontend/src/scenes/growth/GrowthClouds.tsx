import { useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useThree } from '@react-three/fiber'
import { Color, Group, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from 'three'
import type { FilmRuntime } from '../../engine/runtime'
import { DEFAULT_GROWTH_CLOUD_LAYERS } from '../../systems/scene-config/growthCloudLayers'
import {
  createGrowthCloudVolumeMaterial, getGrowthCloudDrift, getGrowthCloudLunarLight, getGrowthCloudMasses, MAX_GROWTH_CLOUD_MASSES,
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
  nightEstablished = false,
}: {
  runtime: FilmRuntime
  reducedMotion: boolean
  frames: GrowthFrames
  environmentOpacity: MutableRefObject<number>
  settings: GrowthSettings
  nightEstablished?: boolean
}) {
  const invalidate = useThree(({ invalidate }) => invalidate)
  const viewportHeight = useThree(({ size }) => getGrowthViewportHeight(size.width, size.height))
  const root = useRef<Group>(null)
  const meshes = useRef<Array<Mesh | null>>([])
  const materialRefs = useRef<Array<ShaderMaterial | null>>([])
  const geometries = useMemo(() => ({
    detail: new SphereGeometry(1, 20, 14),
    mid: new SphereGeometry(1, 16, 10),
    far: new SphereGeometry(1, 12, 8),
  }), [])
  const materials = useMemo(() => new Map(getGrowthCloudMasses(CLOUD_RENDER_LIMIT, 1, {
    cloudLayers: DEFAULT_GROWTH_CLOUD_LAYERS,
  }).map((mass) => [mass.id, createGrowthCloudVolumeMaterial({
    seed: mass.seed,
    ...(mass.raySteps === undefined ? {} : { raySteps: mass.raySteps }),
  })])), [])
  const effectiveFallHeight = getSeedFallHeightMultiplier(settings.seedFallHeight, reducedMotion)
  const fallDistance = getSeedFallDistance(viewportHeight) * effectiveFallHeight
  const masses = useMemo(() => getGrowthCloudMasses(settings.cloudCount, settings.cloudScale, {
    fallDistance,
    viewportHeight,
    sizeVariation: settings.cloudSizeVariation,
    lightVariation: settings.cloudLightVariation,
    pathDensity: reducedMotion ? 0 : settings.cloudPathDensity,
    depthVariation: settings.cloudDepthVariation,
    cloudLayers: settings.cloudLayers,
  }), [
    fallDistance, reducedMotion, settings.cloudCount, settings.cloudDepthVariation, settings.cloudLightVariation,
    settings.cloudLayers, settings.cloudPathDensity, settings.cloudScale, settings.cloudSizeVariation, viewportHeight,
  ])
  const rootOrigin = useMemo(() => new Vector3(), [])
  const moonPosition = useMemo(() => new Vector3(), [])
  const moonColor = useMemo(() => new Color(), [])
  const center = useMemo(() => new Vector3(), [])

  useLayoutEffect(() => () => {
    Object.values(geometries).forEach((geometry) => geometry.dispose())
    materials.forEach((material) => material.dispose())
  }, [geometries, materials])

  useLayoutEffect(() => {
    const update = (time: number) => {
      const safeTime = Number.isFinite(time) ? time : 0
      const motionTime = getGrowthCloudMotionTime(safeTime, reducedMotion)
      const motionSpeed = reducedMotion ? 0 : settings.cloudDriftSpeed
      root.current?.getWorldPosition(rootOrigin)
      setGrowthCloudMoonPosition(moonPosition, rootOrigin, settings.moonPositionY)
      moonColor.set(settings.moonLightColor)

      for (let index = 0; index < CLOUD_RENDER_LIMIT; index++) {
        const mesh = meshes.current[index]
        const mass = masses[index]
        const material = materialRefs.current[index]
        if (!material) continue
        const groupSettings = mass?.cloudLayer ? settings.cloudLayers[mass.cloudLayer] : undefined
        const opacity = getGrowthCloudVisibility(
          safeTime, frames, settings.cloudOpacity, environmentOpacity.current, mass?.persistent, reducedMotion,
          mass?.pathCrossing ? mass.fallProgress : undefined, nightEstablished,
        )
        const settledSea = mass?.persistent ?? false
        material.uniforms.uOpacity!.value = opacity * (groupSettings?.opacity ?? 1) * (settledSea ? 0.5 : 1)
        material.uniforms.uDensity!.value = settings.cloudDensity * (groupSettings?.density ?? 1) * (mass?.densityScale ?? 1) * (settledSea ? 0.72 : 1)
        material.uniforms.uLightIntensity!.value = getGrowthCloudLunarLight(safeTime, frames, settings.cloudLightIntensity, settings.moonLightIntensity, mass?.lightScale ?? 1) * (groupSettings?.brightness ?? 1) * (settledSea ? 0.4 : 1)
        material.uniforms.uShapeVariation!.value = settings.cloudShapeVariation
        material.uniforms.uSeaEdgeFade!.value = settledSea ? 1 : 0
        material.uniforms.uMoonColor!.value.copy(moonColor)
        material.uniforms.uMoonPosition!.value.copy(moonPosition)
        material.uniforms.uTime!.value = motionTime * motionSpeed
        material.uniforms.uSeed!.value = mass?.seed ?? 0

        if (!mesh || !mass) continue
        const drift = getGrowthCloudDrift(mass, motionTime, motionSpeed)
        mesh.position.set(mass.position[0] + drift[0], mass.position[1] + drift[1], mass.position[2] + drift[2])
        mesh.scale.set(...mass.radii)
        mesh.getWorldPosition(center)
        material.uniforms.uCenter!.value.copy(center)
        material.uniforms.uRadii!.value.set(...mass.radii)
        mesh.visible = opacity > 0 && settings.cloudDensity > 0 && (groupSettings?.opacity ?? 1) > 0 && (groupSettings?.density ?? 1) > 0
      }
      invalidate()
    }

    update(runtime.time)
    return runtime.subscribeFrame(update)
  }, [
    center, environmentOpacity, frames, invalidate, masses, materials, moonColor, moonPosition,
    reducedMotion, rootOrigin, runtime, settings.cloudDensity, settings.cloudDriftSpeed,
    settings.cloudLightIntensity, settings.cloudOpacity, settings.moonLightColor,
    settings.cloudLayers, settings.moonPositionY, settings.moonLightIntensity, settings.cloudShapeVariation, nightEstablished,
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
      <primitive object={mass.raySteps !== undefined ? (mass.raySteps <= 5 ? geometries.far : geometries.mid) : geometries.detail} attach="geometry" />
      <primitive
        object={materials.get(mass.id)!}
        attach="material"
        ref={(material: ShaderMaterial | null) => { materialRefs.current[index] = material }}
      />
    </mesh>)}
  </group>
}
