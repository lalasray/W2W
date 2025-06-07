import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import Stats from 'three/addons/libs/stats.module.js'
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'
import { GUI } from 'dat.gui'
import Chart from 'chart.js/auto'

// --- Container Setup ---
const root = document.createElement('div')
root.style.display = 'flex'
root.style.flexDirection = 'row-reverse'
root.style.height = '100vh'
root.style.margin = '0'
document.body.style.margin = '0'
document.body.appendChild(root)

// --- Three.js Canvas Container ---
const threeContainer = document.createElement('div')
threeContainer.style.flex = '1'
threeContainer.style.position = 'relative'
root.appendChild(threeContainer)

// --- Charts Container ---
const chartsContainer = document.createElement('div')
chartsContainer.style.width = '400px'
chartsContainer.style.display = 'grid'
chartsContainer.style.gridTemplateRows = '1fr 1fr'
chartsContainer.style.gridGap = '10px'
chartsContainer.style.padding = '10px'
chartsContainer.style.boxSizing = 'border-box'
chartsContainer.style.background = '#f0f0f0'
root.appendChild(chartsContainer)

// Create canvases
const posCanvas = document.createElement('canvas')
const orientCanvas = document.createElement('canvas')
const velCanvas = document.createElement('canvas')
const accCanvas = document.createElement('canvas')
chartsContainer.append(posCanvas, orientCanvas, velCanvas, accCanvas)

// --- Renderer Setup ---
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth - 400, window.innerHeight)
renderer.setPixelRatio(window.devicePixelRatio)
threeContainer.appendChild(renderer.domElement)

// --- Scene Setup ---
const scene = new THREE.Scene()
scene.add(new THREE.AxesHelper(5))
const light = new THREE.PointLight(0xffffff, 1000)
light.position.set(2.5, 7.5, 15)
scene.add(light)
scene.add(new THREE.AmbientLight(0xffffff, 0.3))

const camera = new THREE.PerspectiveCamera(
  75,
  (window.innerWidth - 400) / window.innerHeight,
  0.1,
  1000
)
camera.position.set(0.8, 1.4, 1.0)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.target.set(0, 1, 0)

const stats = new Stats()
stats.dom.style.position = 'absolute'
stats.dom.style.top = '0'
stats.dom.style.left = '0'
threeContainer.appendChild(stats.dom)

// --- Raycaster & Marker ---
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
const marker = new THREE.Mesh(
  new THREE.SphereGeometry(0.01, 12, 12),
  new THREE.MeshBasicMaterial({ color: 0xff0000 })
)
marker.visible = false
scene.add(marker)

// --- Data Arrays ---
const frameData: number[] = []
// Position
const xData: number[] = []
const yData: number[] = []
const zData: number[] = []
// Orientation
const eulerX: number[] = []
const eulerY: number[] = []
const eulerZ: number[] = []
// Angular velocity components
const angVelX: number[] = []
const angVelY: number[] = []
const angVelZ: number[] = []
// Linear acceleration components
const linAccX: number[] = []
const linAccY: number[] = []
const linAccZ: number[] = []

let frame = 0
let lastPos = new THREE.Vector3()
let lastVel = new THREE.Vector3()
let lastEuler = new THREE.Euler()

// --- Chart.js Instances ---
const posChart = new Chart(posCanvas.getContext('2d')!, {
  type: 'line',
  data: {
    labels: frameData,
    datasets: [
      { label: 'X', data: xData },
      { label: 'Y', data: yData },
      { label: 'Z', data: zData },
    ],
  },
  options: {
    animation: false,
    responsive: true,
    scales: {
      x: { title: { display: true, text: 'Frame' } },
      y: { title: { display: true, text: 'Position' } },
    },
  },
})

const orientChart = new Chart(orientCanvas.getContext('2d')!, {
  type: 'line',
  data: {
    labels: frameData,
    datasets: [
      { label: 'Euler X', data: eulerX },
      { label: 'Euler Y', data: eulerY },
      { label: 'Euler Z', data: eulerZ },
    ],
  },
  options: {
    animation: false,
    responsive: true,
    scales: {
      x: { title: { display: true, text: 'Frame' } },
      y: { title: { display: true, text: 'Orientation (rad)' } },
    },
  },
})

const angVelChart = new Chart(velCanvas.getContext('2d')!, {
  type: 'line',
  data: {
    labels: frameData,
    datasets: [
      { label: 'ωₓ', data: angVelX },
      { label: 'ωᵧ', data: angVelY },
      { label: 'ω_z', data: angVelZ },
    ],
  },
  options: {
    animation: false,
    responsive: true,
    scales: {
      x: { title: { display: true, text: 'Frame' } },
      y: { title: { display: true, text: 'Angular velocity (rad/s)' } },
    },
  },
})

const linAccChart = new Chart(accCanvas.getContext('2d')!, {
  type: 'line',
  data: {
    labels: frameData,
    datasets: [
      { label: 'aₓ', data: linAccX },
      { label: 'aᵧ', data: linAccY },
      { label: 'a_z', data: linAccZ },
    ],
  },
  options: {
    animation: false,
    responsive: true,
    scales: {
      x: { title: { display: true, text: 'Frame' } },
      y: { title: { display: true, text: 'Linear acceleration' } },
    },
  },
})

// --- Helpers & FBX setup (unchanged) ---
function computeSkinnedWorldPosition(
  mesh: THREE.SkinnedMesh,
  index: number,
  target: THREE.Vector3
): THREE.Vector3 {
  const geom = mesh.geometry as THREE.BufferGeometry
  const posAttr = geom.attributes.position as THREE.BufferAttribute
  const skinIndexAttr = geom.attributes.skinIndex as THREE.BufferAttribute
  const skinWeightAttr = geom.attributes.skinWeight as THREE.BufferAttribute
  mesh.skeleton.update()
  const pos = new THREE.Vector3().fromBufferAttribute(posAttr, index)
  const skinIndices = new THREE.Vector4().fromBufferAttribute(skinIndexAttr, index)
  const skinWeights = new THREE.Vector4().fromBufferAttribute(skinWeightAttr, index)
  target.set(0, 0, 0)
  const tmp = new THREE.Vector3(),
    mat = new THREE.Matrix4(),
    boneMatrices = mesh.skeleton.boneMatrices
  for (let i = 0; i < 4; i++) {
    const w = skinWeights.getComponent(i)
    if (!w) continue
    const b = skinIndices.getComponent(i)
    mat.fromArray(boneMatrices, b * 16)
    tmp.copy(pos).applyMatrix4(mat).multiplyScalar(w)
    target.add(tmp)
  }
  return target.applyMatrix4(mesh.matrixWorld)
}

interface MarkerData {
  mesh: THREE.SkinnedMesh
  indices: [number, number, number]
  barycoord: THREE.Vector3
}
;(marker.userData as any)._data = null as MarkerData | null

window.addEventListener('pointerdown', event => {
    // get the true canvas bounds on screen
    const rect = renderer.domElement.getBoundingClientRect()
  
    // map mouse into Normalized Device Coordinates [-1…+1]
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    mouse.y = -((event.clientY - rect.top)  / rect.height) * 2 + 1
  
    raycaster.setFromCamera(mouse, camera)
    const hits = raycaster.intersectObjects(scene.children, true)
  for (const hit of hits) {
    if ((hit.object as any).isSkinnedMesh) {
      const mesh = hit.object as THREE.SkinnedMesh,
        face = hit.face!
      const inv = new THREE.Matrix4()
        .copy(mesh.matrixWorld)
        .invert()
        .multiply(mesh.bindMatrix)
      const localHit = hit.point.clone().applyMatrix4(inv)
      const posAttr = (mesh.geometry as THREE.BufferGeometry)
        .attributes.position as THREE.BufferAttribute
      const v0 = new THREE.Vector3().fromBufferAttribute(posAttr, face.a)
      const v1 = new THREE.Vector3().fromBufferAttribute(posAttr, face.b)
      const v2 = new THREE.Vector3().fromBufferAttribute(posAttr, face.c)
      const bary = new THREE.Vector3()
      THREE.Triangle.getBarycoord(localHit, v0, v1, v2, bary)
      ;(marker.userData as any)._data = {
        mesh,
        indices: [face.a, face.b, face.c],
        barycoord: bary,
      }
      marker.visible = true
      return
    }
  }
})

// --- GUI & Animation Loader (unchanged) ---
const gui = new GUI(),
  animationsFolder = gui.addFolder('Animations')
animationsFolder.open()

const fbxLoader = new FBXLoader()
let mixer: THREE.AnimationMixer,
  modelReady = false
const animationActions: THREE.AnimationAction[] = []
const playback = { progress: 0, isPlaying: true },
  speed = { timeScale: 1 }
const fileNames = ['model', 'jump', 'cover', 'idle'],
  labels = ['default', 'jump', 'turn_back', 'idle']
const clips: THREE.AnimationClip[] = []
let activeAction: THREE.AnimationAction | null = null

function setAction(idx: number): void {
  const toAction = animationActions[idx]
  if (toAction !== activeAction) {
    activeAction?.fadeOut(1)
    activeAction = toAction
    activeAction.reset().fadeIn(1).play()
  }
}
labels.forEach((l) =>
  animationsFolder.add({ [l]: () => setAction(labels.indexOf(l)) }, l)
)

async function loadFBX(url: string): Promise<THREE.Group> {
  return new Promise((res, rej) => fbxLoader.load(url, res, undefined, rej))
}
async function init() {
  const base = await loadFBX('models/model.fbx')
  base.scale.set(0.01, 0.01, 0.01)
  mixer = new THREE.AnimationMixer(base)
  scene.add(base)
  clips.push(base.animations[0])

  for (let i = 1; i < fileNames.length; i++) {
    const obj = await loadFBX(`models/${fileNames[i]}.fbx`)
    let clip = obj.animations[0]
    if (fileNames[i] === 'idle') {
      clip = clip.clone()
      clip.tracks = clip.tracks.filter((t) => !t.name.toLowerCase().includes('position'))
    }
    clips.push(clip)
  }

  clips.forEach((c) => animationActions.push(mixer.clipAction(c)))
  activeAction = animationActions[0]
  activeAction.play()
  modelReady = true

  gui
    .add(speed, 'timeScale', 0, 2, 0.01)
    .name('Speed')
    .onChange((v) => (mixer.timeScale = v))
  gui
    .add(playback, 'isPlaying')
    .name('Play/Pause')
    .onChange((v) => (mixer.timeScale = v ? speed.timeScale : 0))
  gui.add(playback, 'progress', 0, 1).name('Progress').listen()
}
init()

// --- Resize ---
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth - 400, window.innerHeight)
  camera.aspect = (window.innerWidth - 400) / window.innerHeight
  camera.updateProjectionMatrix()
})

// --- Animate Loop ---
const clock = new THREE.Clock()
function animate() {
  requestAnimationFrame(animate)
  const dt = clock.getDelta()

  if (modelReady) {
    mixer.update(dt)
    playback.progress =
      animationActions.find((a) => a.isRunning())!.time /
      animationActions.find((a) => a.isRunning())!.getClip().duration
  }

  const md = (marker.userData as any)._data as MarkerData | null
  if (marker.visible && md) {
    const { mesh, indices, barycoord } = md
    const verts = indices.map((i) =>
      computeSkinnedWorldPosition(mesh, i, new THREE.Vector3())
    ) as [THREE.Vector3, THREE.Vector3, THREE.Vector3]
    const p = new THREE.Vector3()
      .copy(verts[0])
      .multiplyScalar(barycoord.x)
      .add(verts[1].multiplyScalar(barycoord.y))
      .add(verts[2].multiplyScalar(barycoord.z))
      .multiplyScalar(100)
    marker.position.copy(p)

    // Orientation
    const normal = new THREE.Vector3()
    THREE.Triangle.getNormal(verts[0], verts[1], verts[2], normal)
    marker.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      normal.normalize()
    )
    const euler = new THREE.Euler().setFromQuaternion(marker.quaternion)

    // Dynamics
    const vel = new THREE.Vector3()
      .subVectors(p, lastPos)
      .divideScalar(dt)
    const acc = new THREE.Vector3()
      .subVectors(vel, lastVel)
      .divideScalar(dt)
    const angVel = new THREE.Vector3(
      (euler.x - lastEuler.x) / dt,
      (euler.y - lastEuler.y) / dt,
      (euler.z - lastEuler.z) / dt
    )

    // Record
    frame++
    frameData.push(frame)

    // Position
    xData.push(p.x)
    yData.push(p.y)
    zData.push(p.z)

    // Orientation
    eulerX.push(euler.x)
    eulerY.push(euler.y)
    eulerZ.push(euler.z)

    // Angular velocity components
    angVelX.push(angVel.x)
    angVelY.push(angVel.y)
    angVelZ.push(angVel.z)

    // Linear acceleration components
    linAccX.push(acc.x)
    linAccY.push(acc.y)
    linAccZ.push(acc.z)

    // Trim to last 100 frames
    if (frameData.length > 100) {
      frameData.shift()
      xData.shift()
      yData.shift()
      zData.shift()
      eulerX.shift()
      eulerY.shift()
      eulerZ.shift()
      angVelX.shift()
      angVelY.shift()
      angVelZ.shift()
      linAccX.shift()
      linAccY.shift()
      linAccZ.shift()
    }

    // Update charts
    posChart.update()
    orientChart.update()
    angVelChart.update()
    linAccChart.update()

    lastPos.copy(p)
    lastVel.copy(vel)
    lastEuler.copy(euler)
  }

  controls.update()
  renderer.render(scene, camera)
  stats.update()
}
animate()
