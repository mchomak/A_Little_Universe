import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color('#080914');
const camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, .01, 50);
camera.position.set(1.35, 1.18, 2.35);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
document.body.prepend(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, .54, .1);
controls.update();
scene.add(new THREE.HemisphereLight(0xfff0e8, 0x1d2844, 2));
const key = new THREE.DirectionalLight(0xffe4de, 2.4);
key.position.set(2, 3, 3); scene.add(key);
const rim = new THREE.DirectionalLight(0xb9a4e8, 1.8);
rim.position.set(-2, 2, -3); scene.add(rim);

const select = document.querySelector('#clip');
const slider = document.querySelector('#time');
const label = document.querySelector('#time-label');
const status = document.querySelector('#status');
let model, mixer, clips, action, playing = false;
let last = performance.now();
const names = ['Growth', 'IdleClosed', 'TouchResponse', 'Bloom', 'IdleOpen', 'DissolveReady'];
const assets = { v11: 'lily_004_candidate_v11.glb', v13: 'lily_004_candidate_v13.glb', tiparc: 'lily_004_candidate_v13b.glb', final: 'lily_004_animated.glb' };
const assetName = assets[new URLSearchParams(location.search).get('asset') || 'final'] || assets.final;

function render() { renderer.render(scene, camera); }
function pose(name, seconds) {
  playing = false;
  mixer.stopAllAction();
  const clip = clips.get(name);
  if (!clip) throw new Error(`Missing clip: ${name}`);
  action = mixer.clipAction(clip);
  action.reset().setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  mixer.setTime(Math.max(0, Math.min(seconds, clip.duration)));
  model.updateMatrixWorld(true);
  select.value = name; slider.max = String(clip.duration); slider.value = String(seconds);
  label.textContent = Number(seconds).toFixed(2);
  render();
}
function play(name) {
  pose(name, 0);
  const loop = name === 'IdleClosed' || name === 'IdleOpen';
  action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
  action.clampWhenFinished = !loop;
  playing = true;
  last = performance.now();
}
function capture() {
  model.updateMatrixWorld(true);
  const values = [];
  const box = new THREE.Box3();
  const p = new THREE.Vector3();
  model.traverse((obj) => {
    if (!obj.isMesh) return;
    const count = obj.geometry.attributes.position.count;
    for (let i = 0; i < count; i++) {
      obj.getVertexPosition(i, p);
      p.applyMatrix4(obj.matrixWorld);
      values.push(p.x, p.y, p.z);
      box.expandByPoint(p);
    }
  });
  if (!values.every(Number.isFinite)) throw new Error('Non-finite vertex');
  return { values, bounds: { min: box.min.toArray(), max: box.max.toArray() } };
}
function snapshot(name, seconds) { pose(name, seconds); return capture(); }
function maxDifference(a, b) {
  if (a.values.length !== b.values.length) throw new Error('Vertex counts differ');
  let max = 0;
  for (let i = 0; i < a.values.length; i += 3) {
    max = Math.max(max, Math.hypot(a.values[i]-b.values[i], a.values[i+1]-b.values[i+1], a.values[i+2]-b.values[i+2]));
  }
  return max;
}
function check() {
  const missing = names.filter((n) => !clips.has(n));
  if (missing.length) throw new Error(`Missing animations: ${missing.join(', ')}`);
  const starts = {}, ends = {}, middles = {}, quarters = {};
  for (const name of names) {
    const duration = clips.get(name).duration;
    starts[name] = snapshot(name, 0);
    quarters[name] = snapshot(name, duration / 4);
    middles[name] = snapshot(name, duration / 2);
    ends[name] = snapshot(name, duration);
  }
  const pairs = [
    ['Growth', 'IdleClosed'], ['IdleClosed', 'TouchResponse'],
    ['TouchResponse', 'Bloom'], ['Bloom', 'IdleOpen'], ['IdleOpen', 'DissolveReady'],
  ];
  const boundaries = Object.fromEntries(pairs.map(([a,b]) => [`${a}→${b}`, maxDifference(ends[a], starts[b])]));
  const loops = {
    IdleClosed: maxDifference(starts.IdleClosed, ends.IdleClosed),
    IdleOpen: maxDifference(starts.IdleOpen, ends.IdleOpen),
    DissolveReady: maxDifference(starts.DissolveReady, ends.DissolveReady),
  };
  const motion = Object.fromEntries(names.map((name) => [name, {
    startToQuarter: maxDifference(starts[name], quarters[name]),
    startToMiddle: maxDifference(starts[name], middles[name]),
    startToEnd: maxDifference(starts[name], ends[name]),
    startBounds: starts[name].bounds, endBounds: ends[name].bounds,
  }]));
  pose('DissolveReady', 0);
  return { durations: Object.fromEntries(names.map((n) => [n, clips.get(n).duration])),
    boundaries, loops, motion, sampledVertices: starts.Growth.values.length/3,
    renderCalls: renderer.info.render.calls, renderedTriangles: renderer.info.render.triangles,
    renderer: renderer.getContext().getParameter(renderer.getContext().RENDERER) };
}
function checkCrossfades() {
  playing = false;
  mixer.stopAllAction();
  const trials = [
    ['IdleClosed',2,'TouchResponse'], ['IdleClosed',6,'TouchResponse'],
    ['IdleOpen',2,'DissolveReady'], ['IdleOpen',6,'DissolveReady'],
  ];
  const result = {};
  for (const [from, at, to] of trials) {
    const trial = new THREE.AnimationMixer(model);
    const source = trial.clipAction(clips.get(from));
    source.reset().setLoop(THREE.LoopRepeat, Infinity).play();
    trial.update(at);
    const before = capture();
    const target = trial.clipAction(clips.get(to));
    target.reset().setLoop(THREE.LoopOnce, 1); target.clampWhenFinished = true; target.play();
    source.crossFadeTo(target, .25, false);
    trial.update(0);
    let previous = capture();
    const initialJump = maxDifference(before, previous);
    let maxStep = 0;
    for (let i = 0; i < 18; i++) {
      trial.update(1/60);
      const current = capture();
      maxStep = Math.max(maxStep, maxDifference(previous, current));
      previous = current;
    }
    result[`${from}@${at}s→${to}`] = { initialJump, maxStepAt60Hz: maxStep, fadeSeconds: .25 };
    trial.stopAllAction(); trial.uncacheRoot(model);
  }
  pose('DissolveReady', 0);
  return result;
}
window.lilyDebug = { pose, play, check, checkCrossfades, snapshot,
  setCamera(x,y,z,tx,ty,tz) { camera.position.set(x,y,z); controls.target.set(tx,ty,tz); controls.update(); render(); },
  get model() { return model; }, get clips() { return clips; } };

new GLTFLoader().load(`../export/${assetName}`, (gltf) => {
  model = gltf.scene; scene.add(model); mixer = new THREE.AnimationMixer(model);
  clips = new Map(gltf.animations.map((clip) => [clip.name, clip]));
  for (const name of names) {
    const option = document.createElement('option'); option.value = name; option.textContent = name; select.append(option);
  }
  status.textContent = `${assetName} загружен · клипы: ${[...clips.keys()].join(', ')}`;
  window.lilyReady = true;
  pose('DissolveReady', 0);
}, undefined, (error) => { window.lilyError = String(error); status.textContent = `Ошибка: ${error}`; });
document.querySelector('#play').addEventListener('click', () => play(select.value));
document.querySelector('#pause').addEventListener('click', () => { playing = false; });
select.addEventListener('change', () => pose(select.value, 0));
slider.addEventListener('input', () => pose(select.value, Number(slider.value)));
addEventListener('resize', () => { camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); });
function tick(now) {
  requestAnimationFrame(tick);
  if (playing && mixer) {
    mixer.update(Math.min((now-last)/1000, .1));
    slider.value = String(action.time); label.textContent = action.time.toFixed(2);
    if (action.paused) playing = false;
  }
  last = now;
  render();
}
requestAnimationFrame(tick);
