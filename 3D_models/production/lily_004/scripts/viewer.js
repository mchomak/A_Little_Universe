import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color('#080a16');
const camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, .01, 50);
camera.position.set(1.35, 1.18, 2.35);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = .9;
document.body.prepend(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, .54, .1);
controls.update();
scene.add(new THREE.HemisphereLight(0xfff7f3, 0x27344b, 1.3));
const key = new THREE.DirectionalLight(0xffe9df, 1.7);
key.position.set(2, 3, 3);
scene.add(key);
const fill = new THREE.DirectionalLight(0xd6ddf3, .9);
fill.position.set(-3, 1, 2);
scene.add(fill);
const cameraFill = new THREE.DirectionalLight(0xfff0e8, .8);
cameraFill.position.set(1.5, 2.2, 3.5);
scene.add(cameraFill);
const rim = new THREE.DirectionalLight(0xbba9e4, .95);
rim.position.set(-2, 2, -3);
scene.add(rim);
const heart = new THREE.PointLight(0xffc47e, .42, .55, 2);
heart.position.set(0, .92, 0);
scene.add(heart);

const names = ['Growth', 'IdleClosed', 'TouchResponse', 'Bloom', 'IdleOpen', 'DissolveReady'];
const paths = {
  original: '../bloom_interior_early/baseline/before_interior.glb',
  final: '../bloom_interior_early/candidate/lily_004_early_interior.glb',
};
const select = document.querySelector('#clip');
const slider = document.querySelector('#time');
const timeLabel = document.querySelector('#time-label');
const durationLabel = document.querySelector('#duration-label');
const status = document.querySelector('#status');
const finalButton = document.querySelector('#final-variant');
const transport = ['#clip', '#time', '#play', '#pause', '#restart'].map((selector) => document.querySelector(selector));
const variants = new Map();
let active = 'original';
let playing = false;
let last = performance.now();
let action = null;

function render() { renderer.render(scene, camera); }
function setStatus(message, state = '') {
  status.textContent = message;
  status.dataset.state = state;
}
function setEnabled(enabled) { transport.forEach((element) => { element.disabled = !enabled; }); }
function readTime() { return Number(slider.value) || 0; }
function activeVariant() { return variants.get(active); }

function pose(name, seconds, resume = false) {
  const current = activeVariant();
  if (!current) return;
  const clip = current.clips.get(name);
  if (!clip) throw new Error(`Missing ${name} clip in ${active}.`);
  const bounded = Math.max(0, Math.min(seconds, clip.duration));
  current.mixer.stopAllAction();
  action = current.mixer.clipAction(clip);
  const isLoop = name === 'IdleClosed' || name === 'IdleOpen';
  action.reset().setLoop(isLoop ? THREE.LoopRepeat : THREE.LoopOnce, isLoop ? Infinity : 1);
  action.clampWhenFinished = !isLoop;
  action.play();
  current.mixer.setTime(bounded);
  current.root.updateMatrixWorld(true);
  select.value = name;
  slider.max = String(clip.duration);
  slider.value = String(bounded);
  timeLabel.textContent = bounded.toFixed(2);
  durationLabel.textContent = clip.duration.toFixed(2);
  playing = resume;
  last = performance.now();
  render();
}

function switchVariant(next) {
  if (!variants.has(next) || next === active) return;
  const old = activeVariant();
  const name = select.value || names[0];
  const seconds = readTime();
  const shouldResume = playing;
  old.root.visible = false;
  active = next;
  const current = activeVariant();
  current.root.visible = true;
  const targetClip = current.clips.get(name);
  if (!targetClip) {
    setStatus(`${next === 'final' ? 'Новая' : 'Предыдущая'} не содержит клип ${name}.`, 'error');
    setEnabled(false);
    return;
  }
  pose(name, seconds, shouldResume);
  document.querySelector('#original-variant').setAttribute('aria-pressed', String(next === 'original'));
  finalButton.setAttribute('aria-pressed', String(next === 'final'));
  const actual = Math.min(seconds, targetClip.duration);
  const clamped = actual < seconds;
  setStatus(`${next === 'final' ? 'Новая' : 'Предыдущая'} загружена${clamped ? ` · позиция ограничена ${actual.toFixed(2)} с` : ' · клип и позиция сохранены'}`, 'ready');
}

function load(path, id) {
  return new Promise((resolve, reject) => {
    new GLTFLoader().load(path, (gltf) => {
      const clips = new Map(gltf.animations.map((clip) => [clip.name, clip]));
      const missing = names.filter((name) => !clips.has(name));
      if (missing.length) {
        reject(new Error(`${id}: отсутствуют клипы ${missing.join(', ')}`));
        return;
      }
      gltf.scene.visible = id === 'original';
      scene.add(gltf.scene);
      resolve({ root: gltf.scene, clips, mixer: new THREE.AnimationMixer(gltf.scene), bytes: gltf.parser.json?.asset?.version ?? '2.0' });
    }, undefined, reject);
  });
}

function play() {
  const current = activeVariant();
  if (!current) return;
  const name = select.value || names[0];
  const clip = current.clips.get(name);
  if (!action || action.getClip().name !== name || (action.time >= clip.duration && name !== 'IdleClosed' && name !== 'IdleOpen')) {
    pose(name, 0);
  }
  if (action) action.paused = false;
  playing = true;
  last = performance.now();
}

function pause() {
  playing = false;
  if (action) action.paused = true;
}

function restart() { pose(select.value || names[0], 0, true); }
function seek(seconds) { pose(select.value || names[0], seconds, playing); }

function capture() {
  const current = activeVariant();
  current.root.updateMatrixWorld(true);
  const coordinates = [];
  const point = new THREE.Vector3();
  current.root.traverse((object) => {
    if (!object.isMesh) return;
    for (let i = 0; i < object.geometry.attributes.position.count; i += 1) {
      object.getVertexPosition(i, point);
      point.applyMatrix4(object.matrixWorld);
      coordinates.push(point.x, point.y, point.z);
    }
  });
  if (!coordinates.every(Number.isFinite)) throw new Error('Model contains non-finite vertex coordinates.');
  return coordinates;
}

function maxDifference(a, b) {
  if (a.length !== b.length) throw new Error('Vertex counts differ between poses.');
  let max = 0;
  for (let i = 0; i < a.length; i += 3) {
    max = Math.max(max, Math.hypot(a[i] - b[i], a[i + 1] - b[i + 1], a[i + 2] - b[i + 2]));
  }
  return max;
}

function check() {
  const current = activeVariant();
  const savedName = select.value || 'DissolveReady';
  const savedTime = readTime();
  const savedPlaying = playing;
  const poses = {};
  for (const name of names) {
    const duration = current.clips.get(name).duration;
    poses[name] = {
      start: (pose(name, 0), capture()),
      quarter: (pose(name, duration / 4), capture()),
      middle: (pose(name, duration / 2), capture()),
      threeQuarter: (pose(name, duration * 3 / 4), capture()),
      end: (pose(name, duration), capture()),
      duration,
    };
  }
  const boundaries = {};
  for (const [from, to] of [['Growth','IdleClosed'], ['IdleClosed','TouchResponse'], ['TouchResponse','Bloom'], ['Bloom','IdleOpen'], ['IdleOpen','DissolveReady']]) {
    boundaries[`${from}→${to}`] = maxDifference(poses[from].end, poses[to].start);
  }
  const loops = Object.fromEntries(['IdleClosed', 'IdleOpen'].map((name) => [name, maxDifference(poses[name].start, poses[name].end)]));
  const bloom = poses.Bloom;
  pose(savedName, savedTime, savedPlaying);
  return { variant: active, durations: Object.fromEntries(names.map((name) => [name, poses[name].duration])), boundaries, loops,
    bloomMaxDisplacement: { zero: maxDifference(bloom.start, bloom.start), quarter: maxDifference(bloom.start, bloom.quarter), middle: maxDifference(bloom.start, bloom.middle), threeQuarter: maxDifference(bloom.start, bloom.threeQuarter), end: maxDifference(bloom.start, bloom.end) } };
}

window.lilyDebug = {
  pose,
  play,
  pause,
  restart,
  seek,
  switchVariant,
  check,
  capture,
  get variants() { return variants; },
  get active() { return active; },
  get camera() { return camera; },
};

document.querySelector('#original-variant').addEventListener('click', () => switchVariant('original'));
finalButton.addEventListener('click', () => switchVariant('final'));
document.querySelector('#play').addEventListener('click', play);
document.querySelector('#pause').addEventListener('click', pause);
document.querySelector('#restart').addEventListener('click', restart);
select.addEventListener('change', () => pose(select.value, 0));
slider.addEventListener('input', () => seek(readTime()));

load(paths.original, 'original').then((original) => {
  variants.set('original', original);
  select.replaceChildren(...names.map((name) => new Option(name, name)));
  select.value = 'DissolveReady';
  setEnabled(true);
  pose('DissolveReady', 0);
  window.lilyReady = true;
  setStatus(`Предыдущая версия загружена · ${[...original.clips.keys()].join(', ')} · ${renderer.getContext().getParameter(renderer.getContext().RENDERER)}`, 'ready');
  load(paths.final, 'final').then((final) => {
    variants.set('final', final);
    finalButton.disabled = false;
    const mismatches = names.filter((name) => Math.abs(final.clips.get(name).duration - original.clips.get(name).duration) > 1e-4);
    setStatus(mismatches.length
      ? `Предыдущая и новая версии загружены. Отличается длительность: ${mismatches.join(', ')}; при сравнении используется абсолютное время.`
      : 'Предыдущая и новая версии загружены · длительности клипов совпадают.', mismatches.length ? '' : 'ready');
  }).catch((error) => {
    window.lilyFinalError = String(error);
    finalButton.disabled = true;
    setStatus(`Предыдущая версия загружена. Новая версия пока недоступна: ${error.message ?? error}`, 'error');
  });
}).catch((error) => {
  window.lilyError = String(error);
  setEnabled(false);
  setStatus(`Не удалось загрузить предыдущую версию: ${error.message ?? error}`, 'error');
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

function tick(now) {
  requestAnimationFrame(tick);
  const current = activeVariant();
  if (playing && current && action) {
    current.mixer.update(Math.min((now - last) / 1000, .1));
    slider.value = String(action.time);
    timeLabel.textContent = action.time.toFixed(2);
    if (action.paused) playing = false;
  }
  last = now;
  render();
}
requestAnimationFrame(tick);
