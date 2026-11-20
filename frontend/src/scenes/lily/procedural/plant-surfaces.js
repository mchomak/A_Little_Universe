import * as THREE from 'three'

export const clamp = x => Math.max(0, Math.min(1, x))
export const mix = (a, b, t) => a + (b - a) * t
export const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
const {sin, cos, PI, abs, exp, pow} = Math
const TAU = PI * 2

// Each ring has two faces and a joined margin. The inside and outside occupy
// separate squares of the pigment atlas, including along the closed bud.
function bladeGeometry(rows, cols, poseCount, sample, textureUV, solid) {
  const count = (rows + 1) * (cols + 1)
  const surfaces = solid ? 2 : 1
  const indices = []
  const uvs = []
  for (let side = 0; side < surfaces; ++side) {
    const offset = side * count
    for (let j = 0; j <= rows; ++j) {
      for (let i = 0; i <= cols; ++i) {
        uvs.push(...textureUV(i / cols, j / rows, side))
        if (j === rows || i === cols) continue
        const a = offset + j * (cols + 1) + i
        const b = a + cols + 1
        if (side === 0) indices.push(a, b, a + 1, a + 1, b, b + 1)
        else indices.push(a, a + 1, b, a + 1, b + 1, b)
      }
    }
  }
  if (solid) {
    const join = (a, b) => indices.push(a, b + count, b, a, a + count, b + count)
    for (let j = 0; j < rows; ++j) {
      const a = j * (cols + 1)
      join(a + cols + 1, a)
      join(a + cols, a + cols * 2 + 1)
    }
    for (let i = 0; i < cols; ++i) {
      join(i, i + 1)
      join(count - i - 1, count - i - 2)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setIndex(indices)
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  const positions = [], normals = []
  const vector = new THREE.Vector3()
  for (let pose = 0; pose <= poseCount; ++pose) {
    const data = new Float32Array(count * surfaces * 3)
    for (let side = 0; side < surfaces; ++side) {
      for (let j = 0; j <= rows; ++j) {
        const row = sample(j / rows, pose / poseCount)
        for (let i = 0; i <= cols; ++i) {
          row(i / cols * 2 - 1, side, vector)
          vector.toArray(data, (side * count + j * (cols + 1) + i) * 3)
        }
      }
    }
    const temp = new THREE.BufferGeometry()
    temp.setIndex(geometry.index)
    temp.setAttribute('position', new THREE.BufferAttribute(data, 3))
    temp.computeVertexNormals()
    positions.push(temp.attributes.position)
    normals.push(temp.attributes.normal)
  }
  geometry.setAttribute('position', positions.shift())
  geometry.setAttribute('normal', normals.shift())
  geometry.morphAttributes.position = positions
  geometry.morphAttributes.normal = normals
  geometry.computeBoundingSphere()
  return geometry
}

export function bend(mesh, amount) {
  const weights = mesh.morphTargetInfluences
  const stage = clamp(amount) * weights.length
  const i = Math.floor(stage)
  weights.fill(0)
  if (i > 0) weights[i - 1] = 1 - (stage - i)
  if (i < weights.length) weights[i] = stage - i
}

// Individual midribs are sculpted in floral coordinates (lateral, axial, radial).
// The hooks turn sideways as well as back so their rolled tips retain a silhouette.
const tepals = [
  {angle: .17, width: .352, widest: .53, roll: -.73, fold: .48, wave: .69,
    spine: [[0,0,.032],[-.012,.175,.080],[.021,.305,.326],[.056,.336,.622],[.090,.269,.896],[.032,.089,1.044],[-.12,.015,1.088]]},
  {angle: 1.22, width: .255, widest: .47, roll: 1.04, fold: .68, wave: 1.06,
    spine: [[0,0,.030],[.013,.114,.128],[-.035,.184,.374],[-.080,.190,.648],[-.009,.115,.932],[.153,-.042,1.053],[.275,-.153,.990],[.263,-.171,.892]]},
  {angle: 2.31, width: .365, widest: .52, roll: -.91, fold: .42, wave: .97,
    spine: [[0,.017,.031],[-.005,.196,.086],[.018,.353,.295],[.075,.457,.572],[.084,.486,.803],[.038,.392,.979],[-.096,.207,1.039],[-.192,.174,1.016]]},
  {angle: 3.28, width: .230, widest: .49, roll: .96, fold: .79, wave: .86,
    spine: [[0,0,.030],[.014,.195,.106],[.020,.337,.312],[-.048,.381,.644],[-.070,.353,.916],[.025,.198,1.061],[.175,.053,1.038],[.223,.052,.942]]},
  {angle: 4.39, width: .345, widest: .56, roll: -.88, fold: .39, wave: 1.16,
    spine: [[0,.014,.031],[.014,.169,.088],[.058,.306,.323],[.096,.355,.614],[.123,.263,.864],[.113,.123,1.032],[-.004,-.030,1.082],[-.162,-.064,1.011]]},
  {angle: 5.43, width: .250, widest: .45, roll: -.98, fold: .64, wave: .80,
    spine: [[0,0,.032],[.020,.106,.124],[.037,.180,.359],[.035,.147,.663],[-.054,.036,.910],[-.132,-.179,.983],[-.176,-.286,.896]]},
]

function curveThrough(points) {
  return new THREE.CatmullRomCurve3(points.map(([x,y,z]) => new THREE.Vector3(x,y,z)))
}

export function tepalGeometry(index) {
  const p = tepals[index]
  const inner = index % 2 === 0
  const spine = curveThrough(p.spine)
  const rows = 68
  const frames = []
  const transport = new THREE.Quaternion()
  let previous = spine.getTangentAt(0)
  const widthAxis = new THREE.Vector3(1,0,0).addScaledVector(previous,-previous.x).normalize()
  for (let row = 0; row <= rows; row++) {
    const fraction = row / rows
    const tangent = spine.getTangentAt(fraction)
    // Parallel transport keeps a rolled end continuous when it turns across
    // the blade's original transverse direction.
    widthAxis.applyQuaternion(transport.setFromUnitVectors(previous,tangent))
    frames.push({center: spine.getPointAt(fraction), tangent, across: widthAxis.clone()})
    previous = tangent
  }
  const tileUV = (u, v, side) => [
    (index % 3 + .003 + u * .994) / 3,
    (3 - Math.floor(index / 3) - 2 * side + .002 + v * .996) / 4,
  ]
  function sample(s, pose) {
    const frame = frames[Math.round(s * rows)]
    const {center, tangent} = frame
    const across = frame.across.clone()
    const roll = p.roll * (.18 * sin(PI * s) + smooth(.48,1,s)) + .09 * sin(6*s + index) * s
    across.applyAxisAngle(tangent, roll)
    const normal = new THREE.Vector3().crossVectors(tangent,across)
    const q = clamp(pose + sin(PI * pose) * (.19 * s - .053))
    const budR = (.039 * (1-s) + .004 + .2 * pow(sin(PI * pow(s,.97)),.8)) * (inner ? .89 : 1)
    const budY = (1.116 - (inner ? .029 : 0) + .008 * sin(index)) * s
    const az = p.angle + (1-q) * (.32*s - .05) + q * .045 * sin(index*2.7) * s
    const arc = s < p.widest ? s / p.widest : (1 - s) / (1 - p.widest)
    const contour = pow(sin(PI * .5 * arc), inner ? .72 : .86)
    const taper = (.76 + .24*smooth(.025,.34,s)) * (1 - .31*smooth(.68,.96,s))
    const width = .016 * (1-s) + .0018 + p.width * contour * taper
    const envelope = sin(PI*s)
    const fold = p.fold + .32 * (1-s) + .25 * smooth(.66,.93,s)
    const channel = clamp(1 - s/.61)
    const grooveU = .10 + .12 * (1-s)
    const lobe = pow(envelope,.64)
    return (u, side, out) => {
      const edge = abs(u)
      const sidePhase = u > 0 ? .44 + .95 * index : 2.63 + 1.26 * index
      const wave = .79 * sin((24 + 1.13*index)*s + 2.8*s*s + sidePhase) +
        .33 * sin((45-index)*s + 2.31*sidePhase) + .17 * sin(65*s+sidePhase)
      const profile = width * (1 + .082*u*sin(6.7*s+index) + .043*u)
      const around = sin(u * fold) / fold * profile * (1 + .063*wave*edge*s)
      const edgeFold = (1 - cos(u * fold)) / fold * profile
      const ruffle = .076 * p.wave * wave * pow(edge,2.15) * lobe
      const lip = exp(-pow((edge-grooveU)*14,2))
      const nectar = (.048 * lip - .035 * exp(-u*u*68)) * channel * smooth(0,.095,s)
      const ribPhase = edge*(4.1+.47*s) + .14*sin(5.3*s+index)*edge
      const ribs = .0041 * (pow(cos(PI*ribPhase),8) - .24) * (1-.56*edge) * lobe
      const thickness = .0024 + .014*(1-edge)*lobe + .011*lip*channel
      const relief = edgeFold + ruffle + nectar + ribs - side * thickness
      const pull = -.027 * edge*edge * lobe * (1+.56*wave)
      const ox = center.x + around*across.x + relief*normal.x + pull*tangent.x
      const oy = center.y + around*across.y + relief*normal.y + pull*tangent.y
      const oz = center.z + around*across.z + relief*normal.z + pull*tangent.z
      const alpha = u * (inner ? 1.05 : 1.20) * (.95+.05*envelope)
      const keel = .017*exp(-u*u*24)*pow(envelope,.65)
      const shell = budR + keel + side * (.0022+.006*(1-edge)*envelope)
      const x = mix(shell*sin(alpha), ox, q)
      const y = mix(budY, oy, q) + .115*sin(PI*q)*pow(s,1.4)
      const z = mix(shell*cos(alpha), oz, q) + .046*sin(PI*q)*envelope
      out.set(cos(az)*x+sin(az)*z, y, -sin(az)*x+cos(az)*z)
    }
  }
  return bladeGeometry(rows, 40, 5, sample, tileUV, true)
}

export function leafGeometry(length, width, droop, phase) {
  const lean = sin(phase*1.7)
  const bow = .28 + .12*cos(phase)
  const open = curveThrough([
    [0,-.012,0], [.006,.115,.060],
    [.043*lean,bow+.038,.31], [.105*lean,bow+.086-.20*droop,.63],
    [.160*lean+.065*sin(phase),.49-.85*droop,.87],
    [.19*lean+.105*sin(phase),.47-1.15*droop,.96],
  ])
  function sample(s, pose) {
    const q = smooth(0,1,pose + sin(pose*PI)*(.23-.32*s))
    const point = open.getPointAt(s)
    const mid = new THREE.Vector3(
      mix(.010*sin(4*s+phase)*s, point.x, q),
      mix(.90*s-.13*s*s, point.y, q),
      mix(.12*s, point.z, q),
    ).multiplyScalar(length)
    const tangent = open.getTangentAt(s).lerp(new THREE.Vector3(0,.98,.15),1-q).normalize()
    const across = new THREE.Vector3(1,0,0).addScaledVector(tangent,-tangent.x).normalize()
    across.applyAxisAngle(tangent, q*(.68*sin(phase)*sin(PI*s) + 1.32*cos(phase*1.37)*s*s))
    const normal = new THREE.Vector3().crossVectors(tangent,across)
    const halfWidth = width*(.21*(1-s) + pow(sin(PI*pow(s,1.13)), .89))
    const fold = mix(1.30,.25+.22*(1-s),q)
    return (u, side, out) => {
      const edge = abs(u)
      const lateral = u*halfWidth*cos(fold)*(1+.06*u*sin(s*5+phase))
      const relief = edge*halfWidth*sin(fold) + .0045*exp(-u*u*95)*sin(PI*s)
        + .0065*edge*edge*sin(20*s+phase+1.7*u)*sin(PI*s)
      out.copy(mid).addScaledVector(across,lateral).addScaledVector(normal,relief)
    }
  }
  return bladeGeometry(36,14,2,sample,(u,v) => [u,v],false)
}

// A tapered swept section, used for stems, filaments and pollen sacs.
export function sweep(rows, sides, curve, section) {
  const positions = [], uv = [], indices = []
  const pos = new THREE.Vector3(), tangent = new THREE.Vector3()
  const a = new THREE.Vector3(), b = new THREE.Vector3()
  const reference = new THREE.Vector3(1, 0, 0)
  for (let j = 0; j <= rows; ++j) {
    const s = j / rows
    pos.copy(curve(s))
    tangent.subVectors(curve(Math.min(1, s + .0005)), curve(Math.max(0, s - .0005))).normalize()
    a.crossVectors(tangent, abs(tangent.x) < .9 ? reference : new THREE.Vector3(0, 0, 1)).normalize()
    b.crossVectors(tangent, a).normalize()
    for (let i = 0; i <= sides; ++i) {
      const u = i / sides
      const [ra, rb] = section(s, u)
      const x = ra * cos(TAU * u), y = rb * sin(TAU * u)
      positions.push(pos.x + a.x * x + b.x * y, pos.y + a.y * x + b.y * y, pos.z + a.z * x + b.z * y)
      uv.push(u, s)
      if (j === rows || i === sides) continue
      const at = j * (sides + 1) + i, next = at + sides + 1
      indices.push(at, at + 1, next, at + 1, next + 1, next)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setIndex(indices)
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.computeVertexNormals()
  return geo
}
