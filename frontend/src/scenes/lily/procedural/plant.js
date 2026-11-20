import * as THREE from 'three'
import {bend, clamp, leafGeometry, mix, smooth, sweep, tepalGeometry} from './plant-surfaces.js'
import pigmentUrl from './assets/lily-pigment.webp'
import cuticleUrl from './assets/lily-cuticle.webp'
import leafUrl from './assets/lily-leaf.webp'

const {sin, cos, exp, pow, PI} = Math
const TAU = PI * 2
const v = (x, y, z) => new THREE.Vector3(x, y, z)

function stemPoint(s) {
  return v(.119 * sin(s * 5.65) - .054 * s + .03*sin(s*11), 2.644 * 1.25 * s,
    .105 * sin(s * 3.9) + .155 * s*s)
}

function makeMesh(parent, geometry, material, name) {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = name
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

function paintVertices(geometry, paint) {
  const color = new THREE.Color()
  const {position, uv} = geometry.attributes
  const rgb = new Float32Array(position.count * 3)
  for (let i = 0; i < position.count; ++i) {
    paint(uv.getX(i), uv.getY(i), i, color)
    color.toArray(rgb, i * 3)
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(rgb, 3))
  return geometry
}

// The thin margins forward-scatter a small amount of the real scene lighting.
// Interior relief still takes normal PBR light, specular highlights and shadows.
function petalMaterial() {
  const material = new THREE.MeshPhysicalMaterial({
    roughness: .54, metalness: 0, clearcoat: .19, clearcoatRoughness: .43,
    sheen: .34, sheenRoughness: .69, sheenColor: 0xffd5c6,
    specularIntensity: .43, bumpScale: .013,
  })
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
      #include <roughnessmap_fragment>
      #ifdef USE_MAP
        vec2 bladeUV = fract(vMapUv * vec2(3.0,4.0));
        float midrib = abs(bladeUV.x * 2.0 - 1.0);
        float nectary = exp(-midrib*midrib*19.0) * (1.0-smoothstep(0.10,0.64,bladeUV.y));
        float strand = sin((midrib*49.0 + 1.1*sin(bladeUV.y*8.0)*midrib)*3.14159);
        roughnessFactor += .098 * smoothstep(.49,.98,midrib) - .18 * nectary + .034*strand;
      #endif
    `)
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `
      #include <lights_fragment_end>
      #if NUM_DIR_LIGHTS > 0 && defined(USE_MAP)
        float across = abs(fract(vMapUv.x * 3.0) * 2.0 - 1.0);
        float transfer = 0.075 + 0.175 * smoothstep(0.34, 1.0, across);
        float lightBehind;
        #pragma unroll_loop_start
        for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
          lightBehind = max(dot(-geometryNormal, directionalLights[i].direction), 0.0);
          reflectedLight.directDiffuse += diffuseColor.rgb * vec3(1.0,0.86,0.80) *
            directionalLights[i].color * (lightBehind * transfer * RECIPROCAL_PI);
        }
        #pragma unroll_loop_end
      #endif
    `)
  }
  return material
}

function addFlowerCenter(head) {
  const center = new THREE.Group()
  center.name = 'Flower_Interior'
  head.add(center)
  const filament = new THREE.MeshPhysicalMaterial({
    roughness: .49, vertexColors: true, clearcoat: .10, specularIntensity: .44,
  })
  const pollen = new THREE.MeshStandardMaterial({roughness: .94, vertexColors: true})
  const nectary = new THREE.Color(0x88a23e), thread = new THREE.Color(0xefdda7)
  const garnet = new THREE.Color(0x73391c), ochre = new THREE.Color(0xc47939)
  const length = [.49,.715,.69,.56,.645,.55]
  const radius = [.34,.286,.326,.264,.329,.28]
  const angles = [.42,1.32,2.37,3.65,4.48,5.41]
  const tilt = [-.32,.54,-.45,.67,-.09,-.71]
  for (let i = 0; i < 6; ++i) {
    const a = angles[i]
    function path(s) {
      const r = .044 + radius[i] * pow(s, 1.52)
      const az = a + .28 * s * sin(i + 2) + .085*sin(s*PI+i)*s
      return v(r * sin(az), .037 + length[i] * s + .050 * sin(s * PI), r * cos(az))
    }
    const stalk = sweep(22, 10, path, t => {
      const rad = mix(.017, .006, t) + .004 * exp(-pow(t * 7, 2))
      return [rad, rad]
    })
    paintVertices(stalk, (u, s, i, color) => color.copy(nectary).lerp(thread, smooth(.02,.65,s)))
    makeMesh(center, stalk, filament, 'Filament ' + (i + 1))

    // Versatile anthers pivot across the end of the filament. Two pollen
    // sacs follow a common curved connective and split along a narrow groove.
    const anther = new THREE.Group()
    anther.position.copy(path(1))
    anther.rotation.order = 'YXZ'
    anther.rotation.set(tilt[(i + 2) % 6], a + .31 + .77 * sin(i * 3.8), tilt[i])
    center.add(anther)
    for (const lobe of [-1, 1]) {
      const span = .207 + .026 * sin(i * 1.75)
      const sac = sweep(32, 12, t => v((t - .5) * span,
        .011 * sin(t * PI) - .012 * t, lobe * .0065 + (.016 + .012 * sin(i * 2.1)) * sin(PI * t)),
      (s, u) => {
        const profile = .001 + .013 * pow(sin(s * PI), .54)
        const grain = 1 + .084 * sin(u * 92 + s * 211) * cos(s * 159 - u * 141)
        return [profile * grain, profile * 1.28 * grain]
      })
      paintVertices(sac, (u, t, k, c) => {
        const grain = .5 + .5 * sin(k * 34.17 + lobe) * sin(k * 14.93 + i)
        c.copy(garnet).lerp(ochre, .20 + grain * .74)
      })
      makeMesh(anther, sac, pollen, 'Pollen sac')
    }
  }
  const stylePath = t => v(.093 * t * t - .033 * sin(t * PI), .025 + .855 * t,
    .044 * t - .193 * t * t)
  const styleGeo = sweep(28, 14, stylePath, t => {
    const r = .014 + .027 * exp(-t * 7.1) + .005 * smooth(.77, 1, t)
    return [r, r]
  })
  const styleTip = new THREE.Color(0xc7c494)
  paintVertices(styleGeo, (u,s,i,c) => c.copy(nectary).lerp(styleTip,s))
  makeMesh(center, styleGeo, filament, 'Style')
  const stigmaMat = new THREE.MeshPhysicalMaterial({
    color: 0xa3ab6b, roughness: .52, clearcoat: .22, clearcoatRoughness: .42,
  })
  const stigma = new THREE.Group()
  stigma.position.copy(stylePath(1))
  stigma.rotation.z = .13
  center.add(stigma)
  const lobeGeo = new THREE.SphereGeometry(1, 18, 12)
  for (let i = 0; i < 3; ++i) {
    const a = .28 + i * TAU / 3
    const lobe = makeMesh(stigma, lobeGeo, stigmaMat, 'Stigma lobe')
    lobe.position.set(.019 * sin(a), 0, .019 * cos(a))
    lobe.rotation.y = a
    lobe.scale.set(.026,.019,.032)
  }
  return center
}

const leafStations = [
  // Node on stem, azimuth, blade length, half-width, tip droop.
  [.082, -1.07, .62, .077, .63], [.158, 2.12, .84, .108, .58],
  [.241, .39, .63, .086, .81], [.334, -1.54, .95, .102, .66],
  [.475, .985, .88, .105, .77], [.517, -2.91, .685, .078, .53],
  [.651, -1.18, .78, .088, .565], [.719, 1.61, .63, .085, .39],
  [.837, -.34, .45, .065, .53], [.904, -2.28, .35, .054, .31],
]

export function createProceduralLily(options = {}) {
  const object = new THREE.Group()
  object.name = 'Lilium orientale'
  const petal = petalMaterial()
  const leafMat = new THREE.MeshPhysicalMaterial({
    roughness: .63, clearcoat: .07, clearcoatRoughness: .61, side: THREE.DoubleSide,
    specularIntensity: .36, color: 0xf6f6eb,
  })
  if (options.textures === false || typeof document === 'undefined') leafMat.color.setHex(0x456039)
  const textures = []
  const loads = []
  let disposed = false
  function load(url, target, slot, isColor) {
    if (options.textures === false || typeof document === 'undefined') return
    const loader = new THREE.TextureLoader()
    loads.push(loader.loadAsync(url).then(texture => {
      if (disposed) { texture.dispose(); return }
      if (isColor) texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = 4
      textures.push(texture)
      target[slot] = texture
      target.needsUpdate = true
    }).catch(() => {
      if (slot === 'map' && target === leafMat) target.color.setHex(0x456039)
    }))
  }
  load(pigmentUrl, petal, 'map', true)
  load(cuticleUrl, petal, 'bumpMap', false)
  load(leafUrl, leafMat, 'map', true)

  const shootMat = new THREE.MeshStandardMaterial({roughness: .60, vertexColors: true})
  const stemGeo = sweep(62, 14, stemPoint, (t, u) => {
    const radius = (.032 - .014 * t + .006 * smooth(.91, 1, t)) * (1 + .037 * sin(u * 6 * PI))
    return [radius, radius]
  })
  const moss = new THREE.Color(0x48643c), celadon = new THREE.Color(0x9bad76)
  paintVertices(stemGeo, (u,t,i,c) => c.copy(moss).lerp(celadon,
    .14 + .29 * t + .13 * sin(6 * PI * u + t * 4) + .06 * cos(14 * PI * u)))
  const stem = makeMesh(object, stemGeo, shootMat, 'Stem')
  // Reveal the curved mature centerline from its base. The final ring follows
  // the growing tip between segments so a camera close to the shoot sees no steps.
  const originals = stemGeo.attributes.position.array.slice()
  let previousRing = -1, previousGrowth = -1
  const rings = 62, sides = 14
  function extendStem(progress) {
    const cut = Math.max(.0001, progress) * rings
    const ring = Math.min(rings, Math.max(1, Math.ceil(cut)))
    const stride = (sides + 1) * 3
    const pos = stemGeo.attributes.position
    const taperRings = 3
    if (previousRing !== -1) {
      const from = Math.max(0, previousRing - taperRings) * stride
      pos.array.set(originals.subarray(from, (previousRing + 1) * stride), from)
    }
    const f = cut - (ring - 1)
    for (let k = 0; k < stride; ++k) {
      const index = ring * stride + k
      pos.array[index] = mix(originals[index - stride], originals[index], f)
    }
    const maturity = smooth(.79, 1, progress)
    for (let j = Math.max(0, ring - taperRings); j <= ring; ++j) {
      const fraction = Math.min(j, cut) / rings
      const pivot = stemPoint(fraction)
      const distance = cut - Math.min(j, cut)
      const radius = mix(.22 + .78 * smooth(0, taperRings, distance), 1, maturity)
      for (let k = j * stride; k < (j + 1) * stride; k += 3) {
        pos.array[k] = mix(pivot.x, pos.array[k], radius)
        pos.array[k + 2] = mix(pivot.z, pos.array[k + 2], radius)
      }
    }
    pos.needsUpdate = true
    stemGeo.setDrawRange(0, ring * sides * 6)
    previousRing = ring
    previousGrowth = progress
  }
  const leaves = leafStations.map(([node, angle, length, width, droop], i) => {
    const mesh = makeMesh(object, leafGeometry(length, width, droop, .3 + i * 2.4), leafMat, i === 0 ? 'Leaf_A' : i === 1 ? 'Leaf_B' : 'Leaf_' + (i + 1))
    mesh.position.copy(stemPoint(node))
    mesh.rotation.y = angle
    return mesh
  })
  const spear = makeMesh(object, leafGeometry(.22, .034, .05, .1), leafMat, 'Apical shoot')
  spear.rotation.y = -.87
  const head = new THREE.Group()
  head.name = 'Head_Root'
  object.add(head)
  const collarGeo = sweep(13, 24, t => v(0, -.052 + .13 * t, 0), (t, u) => {
    const r = (.019 + .048 * smooth(.10,1,t)) * (1 + .07 * sin(6 * PI * u))
    return [r, r]
  })
  paintVertices(collarGeo, (u, t, i, c) => c.copy(moss).lerp(celadon, .28 + .60 * t))
  makeMesh(head, collarGeo, shootMat, 'Receptacle')
  const tepals = Array.from({length: 6}, (_, i) =>
    makeMesh(head, tepalGeometry(i), petal, 'Petals_' + (i % 2 ? 'Outer_' : 'Inner_') + (1 + Math.floor(i / 2))))
  const reproductive = addFlowerCenter(head)
  const green = new THREE.Color(0x97b376), ripe = new THREE.Color(0xf1e5ed)
  const delay = [.029, .005, .047, .013, .043, .0]
  function setPose(growthValue, bloomValue) {
    const growth = clamp(growthValue)
    const bloom = clamp(bloomValue)
    // Prototype's growth and blossom occupy distinct portions of its timeline.
    // Keep those shapes while letting the film control both independently.
    const t = mix(.045, .535, growth)
    const bud = smooth(.285, .535, t)
    const opening = smooth(0, 1, bloom)
    stem.visible = growth > .0001
    if (stem.visible && growth !== previousGrowth) extendStem(growth)
    const girth = .49 + .51 * smooth(.065,.335,t)
    stem.scale.set(girth,1,girth)
    spear.position.copy(stemPoint(growth))
    spear.position.y -= .012 * smooth(.04,.09,t)
    spear.position.x *= girth; spear.position.z *= girth
    const sprout = smooth(.044,.101,t) * (1 - smooth(.29,.36,t))
    spear.visible = sprout > .001
    spear.scale.setScalar(Math.max(.001,sprout))
    bend(spear,.12 + .21 * growth)
    leaves.forEach((leaf,i) => {
      const station = leafStations[i][0]
      const age = smooth(station - .018, station + .25, growth + .17 * smooth(.32,.47,t))
      leaf.visible = age > .002
      leaf.position.x = stemPoint(station).x * girth
      leaf.position.z = stemPoint(station).z * girth
      leaf.scale.set(Math.max(.001, .93 * age + .07 * age * age), Math.max(.001,age), Math.max(.001,age))
      bend(leaf, age)
    })

    head.visible = bud > .0003
    head.position.copy(stemPoint(growth))
    head.rotation.order = 'ZXY'
    head.rotation.set(.13 + .082 * bud + .45 * opening, -.04 - .07 * opening,
      .088 + .13 * sin(bud * PI) + .21 * opening)
    head.scale.set(bud * (.58 + .42 * bud), bud, bud * (.58 + .42 * bud))
    petal.color.copy(green).lerp(ripe, smooth(.285,.535,t))
    for (let i = 0; i < 6; ++i) {
      const start = delay[i] / .331
      const progress = smooth(start, (.876 + delay[i] * .62 - .571) / .331, bloom)
      const settling = sin(PI * smooth(.867,1,bloom)) * .013 * sin(i * 1.7 + .5)
      bend(tepals[i], progress * (1 - .014 + settling) + .014 * smooth(.93,1,bloom))
    }
    reproductive.scale.set(.17 + .83 * opening, .81 + .19 * opening, .17 + .83 * opening)
  }
  setPose(0, 0)
  // Retain ownership even if a consumer temporarily swaps a mesh material.
  const ownedGeometries = new Set(), ownedMaterials = new Set()
  object.traverse(node => {
    if (node.geometry) ownedGeometries.add(node.geometry)
    if (node.material) {
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) ownedMaterials.add(material)
    }
  })
  function dispose() {
    disposed = true
    ownedGeometries.forEach(g => g.dispose())
    ownedMaterials.forEach(m => m.dispose())
    textures.forEach(tex => tex.dispose())
    object.clear()
  }
  return {object, head, leaves, tepals, setPose, dispose, ready: Promise.all(loads)}
}
