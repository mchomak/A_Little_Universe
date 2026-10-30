import { AdditiveBlending, CanvasTexture, Color, Group, SRGBColorSpace, Sprite, SpriteMaterial, Vector3 } from 'three'
import { createGalaxyRandom } from './generateGalaxy'

const CLOUD_COLORS = ['#7A3CFF', '#C64CFF', '#3F6CFF', '#2BD6C0', '#FF5AA6', '#5A3CFF', '#1F8BFF']

/** Cloud texture/sprite construction adapted from procedural-galaxy/src/nebulaClouds.js. */
export function createNebulaClouds(seed: string, radius: number, count = 9, baseOpacity = 0.34) {
  const group = new Group()
  const textures: CanvasTexture[] = []
  const materials: SpriteMaterial[] = []
  const opacityWeights: number[] = []
  for (let textureIndex = 0; textureIndex < 3; textureIndex += 1) {
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')
    if (!context) continue
    const random = createGalaxyRandom(`nebula-cloud-${textureIndex}`)
    context.globalCompositeOperation = 'lighter'
    for (let puff = 0; puff < 18; puff += 1) {
      const x = random.range(0.2, 0.8) * size
      const y = random.range(0.2, 0.8) * size
      const puffRadius = random.range(0.12, 0.42) * size
      const alpha = random.range(0.04, 0.16)
      const gradient = context.createRadialGradient(x, y, 0, x, y, puffRadius)
      gradient.addColorStop(0, `rgba(255,255,255,${alpha})`)
      gradient.addColorStop(1, 'rgba(255,255,255,0)')
      context.fillStyle = gradient
      context.beginPath()
      context.arc(x, y, puffRadius, 0, Math.PI * 2)
      context.fill()
    }
    context.globalCompositeOperation = 'destination-out'
    const vignette = context.createRadialGradient(size / 2, size / 2, size * 0.32, size / 2, size / 2, size * 0.5)
    vignette.addColorStop(0, 'rgba(0,0,0,0)')
    vignette.addColorStop(1, 'rgba(0,0,0,1)')
    context.fillStyle = vignette
    context.fillRect(0, 0, size, size)
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    textures.push(texture)
  }

  const random = createGalaxyRandom(`${seed}::clouds`)
  for (let index = 0; index < count; index += 1) {
    const texture = textures[random.int(0, Math.max(0, textures.length - 1))]
    if (!texture) continue
    const material = new SpriteMaterial({
      map: texture,
      color: new Color(CLOUD_COLORS[random.int(0, CLOUD_COLORS.length - 1)]).multiplyScalar(random.range(0.5, 0.95)),
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
      opacity: baseOpacity * random.range(0.6, 1),
      rotation: random.range(0, Math.PI * 2),
    })
    const sprite = new Sprite(material)
    const direction = new Vector3(random.gauss(), random.gauss() * 0.65, random.gauss())
    if (direction.lengthSq() < 1e-4) direction.set(1, 0, 0)
    direction.normalize().multiplyScalar(radius * random.range(0.85, 1.15))
    sprite.position.copy(direction)
    sprite.scale.setScalar(radius * random.range(0.4, 0.8))
    sprite.renderOrder = -2
    group.add(sprite)
    materials.push(material)
    opacityWeights.push(material.opacity / baseOpacity)
  }

  return {
    group,
    materials,
    setOpacity(multiplier: number) {
      materials.forEach((material, index) => { material.opacity = baseOpacity * (opacityWeights[index] ?? 1) * multiplier })
    },
    dispose() {
      materials.forEach((material) => material.dispose())
      textures.forEach((texture) => texture.dispose())
      group.clear()
    },
  }
}
