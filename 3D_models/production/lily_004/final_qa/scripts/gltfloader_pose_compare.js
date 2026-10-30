// Run via Chrome DevTools evaluate_script on the existing viewer page after
// window.lilyDebug.variants contains both Original and Final.
// The viewer and this check use the production three.js GLTFLoader.
(async () => {
  const names = ["Growth", "IdleClosed", "TouchResponse", "Bloom", "IdleOpen", "DissolveReady"];
  const sampleFractions = {
    Growth: [0, 0.5, 1],
    IdleClosed: [0, 0.5, 1],
    TouchResponse: [0, 0.5, 1],
    Bloom: [0, 0.25, 0.5, 0.75, 1],
    IdleOpen: [0, 0.5, 1],
    DissolveReady: [0, 0.5, 1],
  };
  const variants = window.lilyDebug?.variants;
  if (!variants?.has("original") || !variants?.has("final")) {
    throw new Error("Both GLTFLoader variants must finish loading before QA runs.");
  }

  function snapshot(root) {
    root.updateMatrixWorld(true);
    const meshes = new Map();
    const issues = [];
    root.traverse((object) => {
      if (!object.isMesh || !object.geometry?.attributes?.position) return;
      const position = object.geometry.attributes.position;
      const world = new Float32Array(position.count * 3);
      const point = object.position.clone();
      const getVertex = typeof object.getVertexPosition === "function";
      const morphs = object.morphTargetInfluences ?? [];
      const morphNames = object.geometry.morphAttributes.position?.map((_, i) => object.geometry.morphTargetsRelative
        ? String(i)
        : String(i)) ?? [];
      for (let i = 0; i < position.count; i += 1) {
        if (getVertex) object.getVertexPosition(i, point);
        else {
          point.fromBufferAttribute(position, i);
          for (let m = 0; m < morphs.length; m += 1) {
            const attribute = object.geometry.morphAttributes.position?.[m];
            if (!attribute || !morphs[m]) continue;
            const target = object.position.clone().fromBufferAttribute(attribute, i);
            if (object.geometry.morphTargetsRelative) point.addScaledVector(target, morphs[m]);
            else point.addScaledVector(target.sub(point), morphs[m]);
          }
        }
        point.applyMatrix4(object.matrixWorld);
        const offset = i * 3;
        world[offset] = point.x;
        world[offset + 1] = point.y;
        world[offset + 2] = point.z;
        if (!Number.isFinite(point.x + point.y + point.z)) issues.push(`nonfinite position: ${object.name}[${i}]`);
      }
      const normal = object.geometry.attributes.normal;
      if (normal && normal.count !== position.count) issues.push(`normal count mismatch: ${object.name}`);
      if (normal) {
        for (let i = 0; i < normal.count * 3; i += 1) {
          if (!Number.isFinite(normal.array[i])) { issues.push(`nonfinite normal: ${object.name}[${i}]`); break; }
        }
      }
      if (meshes.has(object.name)) issues.push(`duplicate mesh name: ${object.name}`);
      meshes.set(object.name, { world, count: position.count, morphs: Array.from(morphs), morphNames });
    });
    return { meshes, issues };
  }

  function takeSample(variantId, clipName, fraction) {
    const variant = variants.get(variantId);
    const clip = variant.clips.get(clipName);
    if (!clip) throw new Error(`${variantId} missing animation ${clipName}`);
    const seconds = clip.duration * fraction;
    window.lilyDebug.switchVariant(variantId);
    window.lilyDebug.pose(clipName, seconds, false);
    const frame = snapshot(variant.root);
    return { seconds, duration: clip.duration, ...frame };
  }

  function compare(left, right) {
    const namesLeft = [...left.meshes.keys()].sort();
    const namesRight = [...right.meshes.keys()].sort();
    const differences = [];
    let maxDistance = 0;
    let sumSquared = 0;
    let vertexCount = 0;
    if (JSON.stringify(namesLeft) !== JSON.stringify(namesRight)) {
      differences.push({ kind: "meshNames", original: namesLeft, final: namesRight });
    }
    for (const name of namesLeft) {
      const a = left.meshes.get(name);
      const b = right.meshes.get(name);
      if (!b) continue;
      if (a.count !== b.count) {
        differences.push({ kind: "vertexCount", mesh: name, original: a.count, final: b.count });
        continue;
      }
      if (JSON.stringify(a.morphs.map((v) => +v.toFixed(6))) !== JSON.stringify(b.morphs.map((v) => +v.toFixed(6)))) {
        differences.push({ kind: "morphWeights", mesh: name, original: a.morphs, final: b.morphs });
      }
      for (let i = 0; i < a.world.length; i += 3) {
        const dx = a.world[i] - b.world[i];
        const dy = a.world[i + 1] - b.world[i + 1];
        const dz = a.world[i + 2] - b.world[i + 2];
        const distance = Math.hypot(dx, dy, dz);
        maxDistance = Math.max(maxDistance, distance);
        sumSquared += distance * distance;
        vertexCount += 1;
      }
    }
    return {
      meshCount: namesLeft.length,
      vertexCount,
      maxWorldVertexDistance: maxDistance,
      rmsWorldVertexDistance: vertexCount ? Math.sqrt(sumSquared / vertexCount) : 0,
      structuralDifferences: differences,
      issues: [...left.issues, ...right.issues],
    };
  }

  const durations = {};
  for (const variantId of ["original", "final"]) {
    const variant = variants.get(variantId);
    const clipNames = [...variant.clips.keys()];
    if (JSON.stringify(clipNames) !== JSON.stringify(names)) {
      throw new Error(`${variantId} animation names/order differ: ${clipNames.join(", ")}`);
    }
    durations[variantId] = Object.fromEntries(names.map((name) => [name, variant.clips.get(name).duration]));
  }

  const sampleResults = [];
  const snapshots = { original: new Map(), final: new Map() };
  for (const clip of names) {
    for (const fraction of sampleFractions[clip]) {
      const key = `${clip}@${fraction}`;
      const original = takeSample("original", clip, fraction);
      const final = takeSample("final", clip, fraction);
      snapshots.original.set(key, original);
      snapshots.final.set(key, final);
      sampleResults.push({
        clip,
        fraction,
        originalSeconds: original.seconds,
        finalSeconds: final.seconds,
        comparison: compare(original, final),
      });
    }
  }

  const seams = [
    ["Growth", 1, "IdleClosed", 0],
    ["IdleClosed", 1, "IdleClosed", 0],
    ["IdleClosed", 1, "TouchResponse", 0],
    ["TouchResponse", 1, "Bloom", 0],
    ["Bloom", 1, "IdleOpen", 0],
    ["IdleOpen", 1, "DissolveReady", 0],
  ].map(([fromClip, fromFraction, toClip, toFraction]) => {
    const results = {};
    for (const variantId of ["original", "final"]) {
      const from = takeSample(variantId, fromClip, fromFraction);
      const to = takeSample(variantId, toClip, toFraction);
      results[variantId] = compare(from, to);
    }
    return { from: `${fromClip}@${fromFraction}`, to: `${toClip}@${toFraction}`, results };
  });

  const materialSummary = {};
  for (const variantId of ["original", "final"]) {
    const rows = [];
    variants.get(variantId).root.traverse((object) => {
      if (!object.isMesh) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        rows.push({
          mesh: object.name,
          material: material.name,
          color: material.color?.getHexString?.() ?? null,
          metalness: material.metalness ?? null,
          roughness: material.roughness ?? null,
          baseColorTexture: material.map ? {
            width: material.map.image?.width ?? null,
            height: material.map.image?.height ?? null,
          } : null,
          roughnessTexture: material.roughnessMap ? {
            width: material.roughnessMap.image?.width ?? null,
            height: material.roughnessMap.image?.height ?? null,
          } : null,
        });
      }
    });
    materialSummary[variantId] = rows;
  }

  const report = {
    test: "Three.js GLTFLoader scene/animation verification through existing Lily test page",
    date: new Date().toISOString(),
    positionToleranceMeters: 0.0001,
    passed: sampleResults.every((sample) => sample.comparison.vertexCount > 0
      && sample.comparison.maxWorldVertexDistance < 0.0001
      && sample.comparison.structuralDifferences.length === 0
      && sample.comparison.issues.length === 0),
    animations: durations,
    samples: sampleResults,
    clipSeams: seams,
    materialSummary,
  };
  window.lilyPoseQaReport = report;
  document.querySelector("#status").textContent = `GLTFLoader QA: ${report.passed ? "PASS" : "FAIL"} · ${sampleResults.length} clip poses compared`;
  return report;
})()
