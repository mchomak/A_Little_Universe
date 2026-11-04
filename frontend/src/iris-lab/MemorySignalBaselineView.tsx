/* Three.js controls, cameras and uniforms are mutable renderer-owned objects. */
/* eslint-disable react-hooks/immutability */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { memorySignalBaselineDefaults, memorySignalBaselineDimensions, memorySignalBaselineFragmentShader, memorySignalBaselineVertexShader, processMemorySignalBaselinePixels } from './memorySignalBaseline'

function BaselineCamera({ fitDistance }: { fitDistance: number }) {
  const { camera, gl } = useThree()
  const controls = useMemo(() => new OrbitControls(camera, gl.domElement), [camera, gl])
  useEffect(() => {
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.target.set(0, 0, 0)
    controls.update()
    return () => controls.dispose()
  }, [controls])
  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = 60
      camera.near = 1
      camera.far = 3000
      camera.position.set(0, 0, fitDistance || 500)
      camera.lookAt(0, 0, 0)
      camera.updateProjectionMatrix()
      controls.target.set(0, 0, 0)
      controls.update()
    }
  }, [camera, controls, fitDistance])
  useFrame(() => controls.update())
  return null
}

type MemorySignalBaselineProps = { imageSource?: string | null; onCount: (count: number) => void; onStatus: (status: string) => void }

/** Isolated view of the original Memory Signal image-to-particles pipeline. */
export function MemorySignalBaseline(props: MemorySignalBaselineProps) {
  // A source change disposes the previous geometry through unmount cleanup, even if loading fails.
  return <MemorySignalBaselineSource key={props.imageSource || 'no-source'} {...props} />
}

function MemorySignalBaselineSource({ imageSource, onCount, onStatus }: MemorySignalBaselineProps) {
  const [imageState, setImageState] = useState<{ source: string; geometry: THREE.BufferGeometry } | null>(null)
  const geometry = imageState && imageSource && imageState.source === imageSource ? imageState.geometry : null
  const [fitDistance, setFitDistance] = useState(500)
  const material = useRef<THREE.ShaderMaterial | null>(null)
  const points = useRef<THREE.Points | null>(null)
  const elapsed = useRef(0)
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uParticleSize: { value: memorySignalBaselineDefaults.particleSize },
    uZRelief: { value: memorySignalBaselineDefaults.zRelief },
    uNoiseStrength: { value: memorySignalBaselineDefaults.noiseStrength },
  }), [])

  useEffect(() => {
    onCount(0)
    if (!imageSource) {
      onStatus('No source photo is available. Load an eye image to run the baseline.')
      return
    }
    onStatus('Reading image with the original 300 px Memory Signal sampler…')
    let active = true
    const image = new Image()
    image.onload = () => {
      if (!active) return
      try {
        const { width, height } = memorySignalBaselineDimensions(image.naturalWidth, image.naturalHeight)
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Canvas pixel sampling is unavailable')
        context.drawImage(image, 0, 0, width, height)
        const sample = processMemorySignalBaselinePixels(context.getImageData(0, 0, width, height).data, width, height)
        const next = new THREE.BufferGeometry()
        next.setAttribute('position', new THREE.Float32BufferAttribute(sample.positions, 3))
        next.setAttribute('customColor', new THREE.Float32BufferAttribute(sample.colors, 3))
        next.setAttribute('brightness', new THREE.Float32BufferAttribute(sample.brightness, 1))
        next.setAttribute('random', new THREE.Float32BufferAttribute(sample.random, 1))
        next.setAttribute('edgeFactor', new THREE.Float32BufferAttribute(sample.edgeFactor, 1))
        setImageState({ source: imageSource, geometry: next })
        setFitDistance(sample.fitDistance)
        onCount(sample.count)
        onStatus(`Memory Signal Baseline · ${sample.count.toLocaleString()} points · ${width} × ${height}`)
      } catch (error) {
        onStatus(error instanceof Error ? `Memory Signal Baseline failed: ${error.message}` : 'Memory Signal Baseline failed')
      }
    }
    image.onerror = () => { if (active) { setImageState(null); onCount(0); onStatus('Could not read this image. Try a PNG, JPEG, or WebP file.') } }
    image.src = imageSource
    return () => { active = false; image.onload = null; image.onerror = null }
  }, [imageSource, onCount, onStatus])
  useEffect(() => () => imageState?.geometry.dispose(), [imageState])
  useFrame((_, delta) => {
    elapsed.current += delta
    if (material.current) material.current.uniforms.uTime!.value = elapsed.current
    if (points.current) {
      points.current.rotation.y = Math.sin(elapsed.current * 0.2) * 0.1
      points.current.rotation.x = Math.sin(elapsed.current * 0.15) * 0.05
    }
  })

  return <>
    <BaselineCamera fitDistance={fitDistance} />
    {geometry && <points ref={points} geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={material}
        vertexShader={memorySignalBaselineVertexShader}
        fragmentShader={memorySignalBaselineFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>}
  </>
}
