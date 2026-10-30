import * as THREE from 'three';

const PETAL_MESH_NAMES = new Set(['Petals', 'Petals_Outside']);
const CLOSED_TARGET = /^Closed_(\d{2})$/;
const UV_ROOT = 0.039;
const UV_TIP = 0.978;
const UV_ACROSS_CENTER = 0.513;
const UV_HALF_WIDTH = 0.22;

export const DEFAULT_PETAL_SETTINGS = Object.freeze({
  curvature: 0.52,
  tipCurl: 0.38,
  edgeIrregularity: 0.2,
  surfaceDetail: 0.42,
});

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0, edge1, value) {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function samplePetalDisplacement(u, v, normal, petalIndex, settings) {
  const t = clamp01((v - UV_ROOT) / (UV_TIP - UV_ROOT));
  const across = Math.max(-1, Math.min(1, (u - UV_ACROSS_CENTER) / UV_HALF_WIDTH));
  const middleScoop = -settings.curvature * 0.011 * t * t * (1 - across * across);
  const tipTurn = settings.tipCurl * 0.009 * smoothstep(0.72, 1, t) * (0.38 + 0.62 * (1 - across * across));
  const edge = smoothstep(0.72, 1, Math.abs(across));
  const ripple = settings.edgeIrregularity * edge * (
    Math.sin(t * 35 + petalIndex * 1.73) * 0.00055 +
    Math.sin(t * 17 + petalIndex * 2.41) * 0.00025
  );
  const amount = middleScoop + tipTurn + ripple;
  return [normal[0] * amount, normal[1] * amount, normal[2] * amount];
}

function getTargetNames(mesh, count) {
  const names = Array(count).fill('');
  for (const [name, index] of Object.entries(mesh.morphTargetDictionary ?? {})) names[index] = name;
  return names;
}

function makeTriangleNormals(positionArray, indexArray) {
  const normals = new Float32Array(positionArray.length);
  for (let i = 0; i < indexArray.length; i += 3) {
    const a = indexArray[i] * 3;
    const b = indexArray[i + 1] * 3;
    const c = indexArray[i + 2] * 3;
    const abx = positionArray[b] - positionArray[a];
    const aby = positionArray[b + 1] - positionArray[a + 1];
    const abz = positionArray[b + 2] - positionArray[a + 2];
    const acx = positionArray[c] - positionArray[a];
    const acy = positionArray[c + 1] - positionArray[a + 1];
    const acz = positionArray[c + 2] - positionArray[a + 2];
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    for (const vertex of [a, b, c]) {
      normals[vertex] += nx;
      normals[vertex + 1] += ny;
      normals[vertex + 2] += nz;
    }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const length = Math.hypot(normals[i], normals[i + 1], normals[i + 2]);
    if (length > 1e-12) {
      normals[i] /= length;
      normals[i + 1] /= length;
      normals[i + 2] /= length;
    }
  }
  return normals;
}

function absoluteTarget(base, target, relative) {
  const absolute = new Float32Array(base.length);
  for (let i = 0; i < base.length; i += 1) absolute[i] = relative ? base[i] + target[i] : target[i];
  return absolute;
}

function relativeTarget(base, target, relative) {
  const output = new Float32Array(base.length);
  for (let i = 0; i < base.length; i += 1) output[i] = relative ? target[i] - base[i] : target[i];
  return output;
}

function makeDeformedShape(source, offsets, vertexIslands, closedIsland = -1, preserveAll = false) {
  const result = new Float32Array(source.length);
  for (let i = 0; i < source.length; i += 3) {
    const island = vertexIslands[i / 3];
    const strength = preserveAll || island === closedIsland ? 0 : 1;
    result[i] = source[i] + offsets[i] * strength;
    result[i + 1] = source[i + 1] + offsets[i + 1] * strength;
    result[i + 2] = source[i + 2] + offsets[i + 2] * strength;
  }
  return result;
}

function makeOffsetField(innerGeometry, petalIndexByVertex, settings) {
  const uv = innerGeometry.getAttribute('uv');
  const normals = innerGeometry.getAttribute('normal');
  if (!uv || !normals) throw new Error('Petal experiment needs UVs and vertex normals.');
  const offsets = new Float32Array(uv.count * 3);
  for (let i = 0; i < uv.count; i += 1) {
    const normal = [normals.getX(i), normals.getY(i), normals.getZ(i)];
    const offset = samplePetalDisplacement(uv.getX(i), uv.getY(i), normal, petalIndexByVertex[i], settings);
    offsets[i * 3] = offset[0];
    offsets[i * 3 + 1] = offset[1];
    offsets[i * 3 + 2] = offset[2];
  }
  return offsets;
}

function findPetalIndices(geometry) {
  const index = geometry.index;
  const count = geometry.getAttribute('position').count;
  const adjacency = Array.from({ length: count }, () => []);
  if (!index) throw new Error('Petal experiment expects indexed geometry.');
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
    adjacency[a].push(b, c);
    adjacency[b].push(a, c);
    adjacency[c].push(a, b);
  }
  const island = new Int8Array(count).fill(-1);
  let islandCount = 0;
  for (let start = 0; start < count; start += 1) {
    if (island[start] !== -1 || adjacency[start].length === 0) continue;
    const stack = [start];
    island[start] = islandCount;
    while (stack.length) {
      const vertex = stack.pop();
      for (const neighbor of adjacency[vertex]) {
        if (island[neighbor] === -1) {
          island[neighbor] = islandCount;
          stack.push(neighbor);
        }
      }
    }
    islandCount += 1;
  }
  if (islandCount !== 6) throw new Error(`Expected six connected tepals, found ${islandCount}.`);
  return island;
}

function assertMatchingPetalGeometry(inner, outside) {
  const innerPosition = inner.getAttribute('position');
  const outsidePosition = outside.getAttribute('position');
  const innerUv = inner.getAttribute('uv');
  const outsideUv = outside.getAttribute('uv');
  if (!innerPosition || !outsidePosition || !innerUv || !outsideUv || innerPosition.count !== outsidePosition.count) {
    throw new Error('Inner and outer petal meshes have different vertex/UV layouts.');
  }
  const close = (a, b, tolerance = 1e-6) => Math.abs(a - b) <= tolerance;
  for (let i = 0; i < innerPosition.count; i += 1) {
    if (!close(innerPosition.getX(i), outsidePosition.getX(i)) ||
        !close(innerPosition.getY(i), outsidePosition.getY(i)) ||
        !close(innerPosition.getZ(i), outsidePosition.getZ(i)) ||
        !close(innerUv.getX(i), outsideUv.getX(i)) ||
        !close(innerUv.getY(i), outsideUv.getY(i))) {
      throw new Error(`Inner/outer petal vertex mapping differs at vertex ${i}.`);
    }
  }
  const sortedTriangles = (geometry) => {
    const source = geometry.index?.array;
    if (!source || source.length % 3 !== 0) throw new Error('Both petal meshes must have triangle indices.');
    const triangles = [];
    for (let i = 0; i < source.length; i += 3) triangles.push([source[i], source[i + 1], source[i + 2]].sort((a, b) => a - b).join(':'));
    return triangles.sort();
  };
  const innerTriangles = sortedTriangles(inner);
  const outerTriangles = sortedTriangles(outside);
  if (innerTriangles.length !== outerTriangles.length || innerTriangles.some((triangle, i) => triangle !== outerTriangles[i])) {
    throw new Error('Inner and outer petal meshes do not share the same triangle connectivity.');
  }
}

function mapClosedTargets(mesh, base, morphSource, relative, targetNames, vertexIslands) {
  const mapping = {};
  const targetByName = new Map(targetNames.map((name, index) => [name, index]));
  for (let petal = 0; petal < 6; petal += 1) {
    const name = `Closed_${String(petal + 1).padStart(2, '0')}`;
    const targetIndex = targetByName.get(name);
    if (targetIndex == null) throw new Error(`${mesh.name} is missing ${name}.`);
    const absolute = absoluteTarget(base, morphSource[targetIndex], relative);
    const maxByIsland = Array(6).fill(0);
    for (let vertex = 0; vertex < vertexIslands.length; vertex += 1) {
      const i = vertex * 3;
      const displacement = Math.hypot(absolute[i] - base[i], absolute[i + 1] - base[i + 1], absolute[i + 2] - base[i + 2]);
      maxByIsland[vertexIslands[vertex]] = Math.max(maxByIsland[vertexIslands[vertex]], displacement);
    }
    const owner = maxByIsland.indexOf(Math.max(...maxByIsland));
    const outsideMaximum = Math.max(...maxByIsland.filter((_, index) => index !== owner));
    if (maxByIsland[owner] < 0.001 || outsideMaximum > 0.00001 || owner !== petal) {
      throw new Error(`${name} no longer maps exclusively to petal island ${petal}; found ${JSON.stringify(maxByIsland)}.`);
    }
    mapping[name] = owner;
  }
  return mapping;
}

function prepareMesh(mesh, vertexIslands) {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute('position');
  const index = geometry.index.array;
  const relative = geometry.morphTargetsRelative;
  const baseSource = position.array.slice();
  const morphSource = (geometry.morphAttributes.position ?? []).map((attribute) => attribute.array.slice());
  const targetNames = getTargetNames(mesh, morphSource.length);
  if (targetNames.filter((name) => name.startsWith('Closed_')).length !== 6) {
    throw new Error(`${mesh.name} needs six named Closed_* morph targets.`);
  }
  const closedIslandByTarget = mapClosedTargets(mesh, baseSource, morphSource, relative, targetNames, vertexIslands);
  const morphPositionAttributes = morphSource.map((source, i) => {
    const attribute = new THREE.BufferAttribute(new Float32Array(source.length), 3);
    attribute.name = targetNames[i];
    return attribute;
  });
  const morphNormalAttributes = morphSource.map((source, i) => {
    const attribute = new THREE.BufferAttribute(new Float32Array(source.length), 3);
    attribute.name = targetNames[i];
    return attribute;
  });
  geometry.morphAttributes.position = morphPositionAttributes;
  geometry.morphAttributes.normal = morphNormalAttributes;
  function apply(offsets) {
    const deformedBase = new Float32Array(baseSource.length);
    for (let i = 0; i < baseSource.length; i += 3) {
      deformedBase[i] = baseSource[i] + offsets[i];
      deformedBase[i + 1] = baseSource[i + 1] + offsets[i + 1];
      deformedBase[i + 2] = baseSource[i + 2] + offsets[i + 2];
    }
    const baseNormals = makeTriangleNormals(deformedBase, index);
    position.array.set(deformedBase);
    position.needsUpdate = true;

    const deformedTargets = morphSource.map((target, targetIndex) => {
      const sourceTarget = absoluteTarget(baseSource, target, relative);
      const targetName = targetNames[targetIndex] ?? '';
      const closedMatch = CLOSED_TARGET.exec(targetName);
      const closedIsland = closedMatch ? closedIslandByTarget[targetName] : -1;
      const preserveAll = targetName === 'GrowthBudForm';
      const deformed = makeDeformedShape(sourceTarget, offsets, vertexIslands, closedIsland, preserveAll);
      const targetNormals = makeTriangleNormals(deformed, index);
      return { positions: deformed, normals: targetNormals };
    });

    deformedTargets.forEach(({ positions }, i) => {
      const output = relativeTarget(deformedBase, positions, relative);
      morphPositionAttributes[i].array.set(output);
      morphPositionAttributes[i].needsUpdate = true;
    });
    deformedTargets.forEach(({ normals }, i) => {
      const output = relativeTarget(baseNormals, normals, relative);
      morphNormalAttributes[i].array.set(output);
      morphNormalAttributes[i].needsUpdate = true;
    });
    geometry.getAttribute('normal').array.set(baseNormals);
    geometry.getAttribute('normal').needsUpdate = true;
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }

  // Keep original arrays available to the parameter controls without reloading the GLB.
  return apply;
}

function createDetailBumpTexture() {
  const size = 256;
  const data = new Uint8Array(size * size);
  for (let y = 0; y < size; y += 1) {
    const v = y / (size - 1);
    for (let x = 0; x < size; x += 1) {
      const u = x / (size - 1);
      const across = (u - UV_ACROSS_CENTER) / UV_HALF_WIDTH;
      const noise = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const grain = (noise - Math.floor(noise) - 0.5) * 4.5;
      const veins = [0, -0.2, 0.2, -0.38, 0.38].reduce((sum, center, index) => {
        const width = index === 0 ? 0.018 : 0.012;
        return sum + Math.exp(-Math.pow((across - center) / width, 2)) * (index === 0 ? 7 : 2.4);
      }, 0);
      const fine = Math.sin(v * 280 + across * 8) * 1.1;
      data[y * size + x] = Math.max(0, Math.min(255, Math.round(128 + grain + veins + fine)));
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RedFormat);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function createPetalExperiment(root, settings = DEFAULT_PETAL_SETTINGS) {
  const meshes = new Map();
  root.traverse((object) => {
    if (object.isMesh && PETAL_MESH_NAMES.has(object.name)) {
      object.geometry = object.geometry.clone();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      const cloned = materials.map((material) => material.clone());
      object.material = Array.isArray(object.material) ? cloned : cloned[0];
      meshes.set(object.name, object);
    }
  });
  const inner = meshes.get('Petals');
  const outside = meshes.get('Petals_Outside');
  if (!inner || !outside) throw new Error('Expected Petals and Petals_Outside meshes.');
  assertMatchingPetalGeometry(inner.geometry, outside.geometry);
  const sourceInnerGeometry = inner.geometry.clone();
  const islands = findPetalIndices(sourceInnerGeometry);
  const updateInner = prepareMesh(inner, islands);
  const updateOutside = prepareMesh(outside, islands);
  const detailTexture = createDetailBumpTexture();

  for (const mesh of meshes.values()) {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      material.bumpMap = detailTexture;
      material.roughness = Math.max(material.roughness ?? 0.72, 0.78);
      material.needsUpdate = true;
    }
  }

  function update(nextSettings) {
    settings = { ...settings, ...nextSettings };
    const offsets = makeOffsetField(sourceInnerGeometry, islands, settings);
    updateInner(offsets);
    updateOutside(offsets);
    for (const mesh of meshes.values()) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) material.bumpScale = settings.surfaceDetail * 0.0015;
    }
  }
  update(settings);
  const closedIslandMapping = mapClosedTargets(inner, sourceInnerGeometry.getAttribute('position').array, (sourceInnerGeometry.morphAttributes.position ?? []).map((attribute) => attribute.array), sourceInnerGeometry.morphTargetsRelative, getTargetNames(inner, sourceInnerGeometry.morphAttributes.position.length), islands);
  return { update, detailTexture, meshes, closedIslandMapping };
}
