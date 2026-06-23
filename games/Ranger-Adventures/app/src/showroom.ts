// Charactershowroom — a standalone cast gallery (dev/demo tool, BUILD-PLAN capstone
// "Demo Sandbox" precursor). Loads every staged model from /models, plays its baked
// animation if one exists (Meshy / Anything World rig), else a calm procedural idle,
// and lets you tap any character to focus the camera + hear its real call.
//
// DELIBERATELY DECOUPLED from the game's evolving modules: it imports only `three`
// and reads /models/manifest.json + /audio/manifest.json. So the autonomous run can
// keep changing game code without breaking this page, and this page can never break
// the run's build gate. Open it with `npm run dev` → http://localhost:5173/showroom.html
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

type ModelEntry = { file: string; category: string; animated?: boolean; clips?: number };
type AudioEntry = { file: string; kind?: string };

interface Tile {
  id: string;
  category: string;
  group: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  home: THREE.Vector3;
  top: number;
  label: HTMLDivElement;
  sound: string | null;
  visible: boolean;
}

const TILE = 3;            // grid spacing (world units)
const NORM = 1.7;          // every model normalized to this max dimension
const CAT_ORDER = ['human', 'animal', 'bird', 'prop', 'vehicle'];

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const bar = document.getElementById('bar') as HTMLDivElement;
const labelLayer = document.getElementById('labels') as HTMLDivElement;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#f4ecdd');
scene.fog = new THREE.Fog('#f4ecdd', 28, 70);

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
camera.position.set(0, 9, 16);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 3;
controls.maxDistance = 60;

// Warm, even, golden-hour-ish light — never harsh (matches the game's calm tone).
scene.add(new THREE.HemisphereLight('#fff4e0', '#6b6048', 1.1));
const key = new THREE.DirectionalLight('#ffe6c0', 1.2);
key.position.set(6, 12, 8);
scene.add(key);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400),
  new THREE.MeshStandardMaterial({ color: '#d8caa8', roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.01;
scene.add(ground);

const draco = new DRACOLoader();
draco.setDecoderPath('/draco/');
const loader = new GLTFLoader();
loader.setDRACOLoader(draco);

const tiles: Tile[] = [];
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
let activeFilter = 'all';
let focusId: string | null = null;
const camTarget = new THREE.Vector3();
const camWant = new THREE.Vector3();
let focusing = false;

function normalize(obj: THREE.Object3D): { top: number } {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const s = NORM / maxDim;
  obj.scale.setScalar(s);
  // recenter on origin, sit on the ground
  obj.position.set(-center.x * s, -box.min.y * s, -center.z * s);
  return { top: size.y * s };
}

function audioFor(id: string, audio: Record<string, AudioEntry>): string | null {
  for (const [keyName, entry] of Object.entries(audio)) {
    if (entry.kind === 'call' && id.includes(keyName)) return `/audio/${entry.file}`;
  }
  return null;
}

function playSound(url: string): void {
  const a = new Audio(url);
  a.volume = 0.9;
  void a.play().catch(() => {});
}

function makeLabel(id: string, category: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'label';
  el.textContent = id.replace(/^(animal|bird|prop|figure|vehicle|ranger)-/, '');
  el.title = `${id} · ${category}`;
  labelLayer.appendChild(el);
  return el;
}

async function build(): Promise<void> {
  const manifest = (await fetch('/models/manifest.json').then((r) => r.json())) as Record<string, ModelEntry>;
  const audio = (await fetch('/audio/manifest.json').then((r) => r.json()).catch(() => ({}))) as Record<string, AudioEntry>;

  const ids = Object.keys(manifest).sort((a, b) => {
    const ca = CAT_ORDER.indexOf(manifest[a].category);
    const cb = CAT_ORDER.indexOf(manifest[b].category);
    return ca === cb ? a.localeCompare(b) : ca - cb;
  });

  const cols = Math.ceil(Math.sqrt(ids.length));
  const offset = ((cols - 1) * TILE) / 2;

  ids.forEach((id, i) => {
    const entry = manifest[id];
    const cell = new THREE.Group();
    const x = (i % cols) * TILE - offset;
    const z = Math.floor(i / cols) * TILE - offset;
    cell.position.set(x, 0, z);

    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1, 0.12, 24),
      new THREE.MeshStandardMaterial({ color: '#cdbf9c', roughness: 0.9 }),
    );
    pedestal.position.y = 0.06;
    cell.add(pedestal);

    const holder = new THREE.Group();
    holder.position.y = 0.12;
    cell.add(holder);
    scene.add(cell);

    const tile: Tile = {
      id, category: entry.category, group: cell, mixer: null,
      home: cell.position.clone(), top: 1.6, label: makeLabel(id, entry.category),
      sound: audioFor(id, audio), visible: true,
    };
    tiles.push(tile);

    loader.load(
      `/models/${entry.file}`,
      (gltf: GLTF) => {
        const root = gltf.scene;
        const { top } = normalize(root);
        tile.top = top + 0.12;
        holder.add(root);
        if (gltf.animations.length > 0) {
          tile.mixer = new THREE.AnimationMixer(root);
          tile.mixer.clipAction(gltf.animations[0]).play();
        }
      },
      undefined,
      () => { tile.label.textContent = `⚠ ${id}`; },
    );
  });

  buildBar(ids.length);
}

function buildBar(total: number): void {
  const cats = ['all', ...CAT_ORDER];
  bar.innerHTML = '<span class="title">🦌 Charactershowroom</span>';
  for (const c of cats) {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.textContent = c === 'all' ? 'alles' : c;
    chip.setAttribute('aria-pressed', String(c === activeFilter));
    chip.onclick = () => {
      activeFilter = c;
      for (const b of bar.querySelectorAll('.chip')) b.setAttribute('aria-pressed', String(b === chip));
      applyFilter();
    };
    bar.appendChild(chip);
  }
  const count = document.createElement('span');
  count.className = 'count';
  count.textContent = `${total} modellen`;
  bar.appendChild(count);
}

function applyFilter(): void {
  for (const t of tiles) {
    t.visible = activeFilter === 'all' || t.category === activeFilter;
    t.group.visible = t.visible;
    t.label.style.display = t.visible ? '' : 'none';
  }
}

function focusTile(t: Tile): void {
  focusId = t.id;
  focusing = true;
  camTarget.copy(t.home);
  camWant.copy(t.home).add(new THREE.Vector3(0, t.top * 0.8 + 1.2, 4.2));
  if (t.sound) playSound(t.sound);
}

function onPointer(ev: PointerEvent): void {
  const rect = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((ev.clientX - rect.left) / rect.width) * 2 - 1,
    -((ev.clientY - rect.top) / rect.height) * 2 + 1,
  );
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(
    tiles.filter((t) => t.visible).map((t) => t.group),
    true,
  );
  if (hits.length === 0) return;
  let obj: THREE.Object3D | null = hits[0].object;
  while (obj && !tiles.some((t) => t.group === obj)) obj = obj.parent;
  const tile = tiles.find((t) => t.group === obj);
  if (tile) focusTile(tile);
}
canvas.addEventListener('pointerdown', onPointer);

function resize(): void {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const v = new THREE.Vector3();
function tick(): void {
  const dt = clock.getDelta();
  for (const t of tiles) {
    if (!t.visible) continue;
    if (t.mixer) t.mixer.update(dt);
    else t.group.children[1].rotation.y += dt * 0.5; // gentle turntable for un-rigged models
  }
  if (focusing) {
    controls.target.lerp(camTarget, 0.08);
    camera.position.lerp(camWant, 0.08);
    if (camera.position.distanceTo(camWant) < 0.05) focusing = false;
  }
  controls.update();

  // project labels to screen
  for (const t of tiles) {
    if (!t.visible) { continue; }
    v.copy(t.home); v.y += t.top;
    v.project(camera);
    const behind = v.z > 1;
    t.label.style.display = behind ? 'none' : '';
    if (!behind) {
      t.label.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`;
      t.label.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`;
      t.label.classList.toggle('focus', t.id === focusId);
    }
  }
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

void build().then(() => { applyFilter(); tick(); });
