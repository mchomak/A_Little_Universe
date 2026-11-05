import { useLayoutEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { AdditiveBlending, Color, DoubleSide, NormalBlending, Object3D, type DirectionalLight, type HemisphereLight, type PointLight, type ShaderMaterial } from 'three'
import type { FilmRuntime } from '../../engine/runtime'
import type { SceneId } from '../../engine/film'
import {
  getGrowthMoonlightBeamLayout, getGrowthMoonlightLevels, growthContactShadowFragmentShader,
  growthContactShadowVertexShader, growthMoonBeamFragmentShader, type GrowthMoonlightSettings,
} from './moonlight'
import {
  configureGrowthDirectionalShadow, createGrowthShadowSceneController, getGrowthShadowStrength,
  type GrowthShadowSceneController,
} from './sceneShadows'

const noRaycast = () => undefined

/** Scene-local lunar fill, directional key and soft analytic scatter shaft. */
export function GrowthMoonlight({
  settings,
  runtime,
  growthProgress,
  environmentOpacity,
  shadowsEnabled,
  scene,
  bloomDuration,
}: {
  settings: GrowthMoonlightSettings
  runtime: FilmRuntime
  growthProgress: { current: number }
  environmentOpacity: { current: number }
  shadowsEnabled: boolean
  scene: SceneId
  bloomDuration: number
}) {
  const invalidate = useThree(({ invalidate }) => invalidate)
  const renderer = useThree(({ gl }) => gl)
  const key = useRef<DirectionalLight>(null)
  const fill = useRef<HemisphereLight>(null)
  const subjectFill = useRef<PointLight>(null)
  const shadowController = useRef<GrowthShadowSceneController | null>(null)
  const beam = useRef<ShaderMaterial>(null)
  const contactShadow = useRef<ShaderMaterial>(null)
  const lightTarget = useMemo(() => new Object3D(), [])
  const lightColor = useMemo(() => new Color(settings.moonLightColor), [settings.moonLightColor])
  const layout = useMemo(() => getGrowthMoonlightBeamLayout(settings), [settings])
  const uniforms = useMemo(() => ({
    uMoonColor: { value: new Color() },
    uOpacity: { value: 0 },
    uScatteringIntensity: { value: 0 },
    uBeamRadius: { value: 0 },
    uSoftness: { value: 0 },
  }), [])
  const contactShadowUniforms = useMemo(() => ({ uOpacity: { value: 0 } }), [])

  useLayoutEffect(() => {
    if (!shadowsEnabled || !key.current) return
    const light = key.current
    const controller = createGrowthShadowSceneController(light, renderer.shadowMap)
    shadowController.current = controller
    return () => {
      controller.dispose()
      if (shadowController.current === controller) shadowController.current = null
    }
  }, [renderer, shadowsEnabled])

  useLayoutEffect(() => {
    if (key.current) configureGrowthDirectionalShadow(key.current, settings.moonPositionY)
  }, [renderer, settings.moonPositionY])

  useLayoutEffect(() => {
    lightTarget.position.set(0, 0, 0)
    const update = () => {
      const levels = getGrowthMoonlightLevels(
        settings.moonLightIntensity,
        settings.moonBeamIntensity,
        growthProgress.current,
        environmentOpacity.current,
        settings.moonScatteringIntensity,
      )
      if (key.current) {
        if (shadowsEnabled) shadowController.current?.sync(levels, getGrowthShadowStrength(scene, runtime.time, bloomDuration))
        else { key.current.intensity = levels.key; key.current.castShadow = false }
      }
      if (fill.current) fill.current.intensity = levels.fill
      if (subjectFill.current) subjectFill.current.intensity = levels.fill * 2.4
      if (beam.current) {
        beam.current.uniforms.uOpacity!.value = levels.beam
        beam.current.uniforms.uScatteringIntensity!.value = levels.scattering
        ;(beam.current.uniforms.uMoonColor!.value as Color).copy(lightColor)
        beam.current.uniforms.uBeamRadius!.value = layout.radius
        beam.current.uniforms.uSoftness!.value = settings.moonBeamSoftness
      }
      if (contactShadow.current) contactShadow.current.uniforms.uOpacity!.value = levels.shadow
      invalidate()
    }
    update()
    return runtime.subscribePresentation(update)
  }, [
    bloomDuration, environmentOpacity, growthProgress, invalidate, lightColor, lightTarget, renderer, runtime, scene, shadowsEnabled,
    layout.radius, settings.moonBeamIntensity, settings.moonBeamRadius, settings.moonBeamSoftness,
    settings.moonLightIntensity, settings.moonPositionY, settings.moonScatteringIntensity,
  ])

  return <group>
    <primitive object={lightTarget} />
    <hemisphereLight
      ref={fill}
      position={[-2.4, 0.35, 1.6]}
      color={settings.moonLightColor}
      groundColor="#101724"
      intensity={0}
    />
    <pointLight
      ref={subjectFill}
      position={[0.1, 2.55, 1.15]}
      color={settings.moonLightColor}
      intensity={0}
      distance={5.2}
      decay={1.6}
    />
    <directionalLight
      ref={key}
      position={layout.source}
      color={settings.moonLightColor}
      intensity={0}
      target={lightTarget}
      castShadow={false}
    />
    <mesh
      position={layout.position}
      quaternion={layout.quaternion}
      raycast={noRaycast}
      frustumCulled={false}
    >
      <planeGeometry args={[layout.width, layout.height]} />
      <shaderMaterial
        ref={beam}
        vertexShader={`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`}
        fragmentShader={growthMoonBeamFragmentShader}
        uniforms={uniforms}
        transparent
        blending={AdditiveBlending}
        side={DoubleSide}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
    <mesh position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={noRaycast} frustumCulled={false}>
      <planeGeometry args={[1.1, 0.82]} />
      <shaderMaterial
        ref={contactShadow}
        vertexShader={growthContactShadowVertexShader}
        fragmentShader={growthContactShadowFragmentShader}
        uniforms={contactShadowUniforms}
        transparent
        blending={NormalBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  </group>
}
