// ...existing code...
import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";
import { GLTFLoader } from "https://unpkg.com/three@0.165.0/examples/jsm/loaders/GLTFLoader.js";
import { PointerLockControls } from "https://unpkg.com/three@0.165.0/examples/jsm/controls/PointerLockControls.js";
import { VRButton } from "https://unpkg.com/three@0.165.0/examples/jsm/webxr/VRButton.js";

let scene, camera, renderer, controls, clock, player;
let spheres = [];
let raycaster = new THREE.Raycaster();
let score = 0;
let loadedModel = null;

let gameDuration = 60;
let timeLeft = gameDuration;
let gameOver = false;

// altura de la cámara (valor local dentro del grupo "player")
// Reducido a una altura humana por defecto para evitar sensación de "volar"
const CAMERA_START_Y = 1.6; // 1.6 metros (altura de ojos típica)

// HUD SCORE
const scoreEl = document.createElement("div");
scoreEl.style.position = "fixed";
scoreEl.style.top = "10px";
scoreEl.style.left = "10px";
scoreEl.style.padding = "8px 12px";
scoreEl.style.background = "rgba(0,0,0,0.6)";
scoreEl.style.color = "#fff";
scoreEl.style.fontFamily = "sans-serif";
scoreEl.style.borderRadius = "4px";
scoreEl.style.zIndex = "10";
scoreEl.textContent = "Score: 0";
document.body.appendChild(scoreEl);

// HUD TIME
const timeEl = document.createElement("div");
timeEl.style.position = "fixed";
timeEl.style.top = "10px";
timeEl.style.right = "10px";
timeEl.style.padding = "8px 12px";
timeEl.style.background = "rgba(0,0,0,0.6)";
timeEl.style.color = "#fff";
timeEl.style.fontFamily = "sans-serif";
timeEl.style.borderRadius = "4px";
timeEl.style.zIndex = "10";
timeEl.textContent = "Time: 60.0";
document.body.appendChild(timeEl);

// GAME OVER TEXT
const gameOverEl = document.createElement("div");
gameOverEl.style.position = "fixed";
gameOverEl.style.left = "50%";
gameOverEl.style.top = "50%";
gameOverEl.style.transform = "translate(-50%, -50%)";
gameOverEl.style.padding = "16px 24px";
gameOverEl.style.background = "rgba(0,0,0,0.7)";
gameOverEl.style.color = "#fff";
gameOverEl.style.fontFamily = "sans-serif";
gameOverEl.style.fontSize = "32px";
gameOverEl.style.borderRadius = "8px";
gameOverEl.style.zIndex = "20";
gameOverEl.style.display = "none";
gameOverEl.textContent = "¡Tiempo terminado!";
document.body.appendChild(gameOverEl);

// CROSSHAIR
const crosshair = document.createElement("div");
crosshair.style.position = "fixed";
crosshair.style.left = "50%";
crosshair.style.top = "50%";
crosshair.style.transform = "translate(-50%, -50%)";
crosshair.style.width = "14px";
crosshair.style.height = "14px";
crosshair.style.pointerEvents = "none";
crosshair.style.zIndex = "11";
crosshair.style.display = "flex";
crosshair.style.alignItems = "center";
crosshair.style.justifyContent = "center";
crosshair.innerHTML = `
  <div style="width:2px;height:14px;background:white;position:absolute;"></div>
  <div style="width:14px;height:2px;background:white;position:absolute;"></div>
`;
document.body.appendChild(crosshair);

function init() {
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x440000, 200, 2000);

  const width = window.innerWidth;
  const height = window.innerHeight;

  camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 5000);

  // Crear un "player" (grupo) que contendrá la cámara.
  // Moviendo el grupo elevamos/descendemos al jugador frente al mundo/modelo.
  player = new THREE.Group();
  player.name = "player";
  player.add(camera);
  scene.add(player);

  // Posición local de la cámara dentro del grupo (altura relativa).
  // Ahora se usa CAMERA_START_Y (1.6m) para evitar sensación de volar.
  camera.position.set(0, CAMERA_START_Y, 5);
  camera.lookAt(new THREE.Vector3(0, CAMERA_START_Y, 0));

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.xr.enabled = true;

  // Forzar "local-floor" para que WebXR ubique el suelo en y=0
  renderer.xr.setReferenceSpaceType("local-floor");

  document.body.appendChild(renderer.domElement);
  document.body.appendChild(VRButton.createButton(renderer));

  // Cuando la sesión VR empieza, sólo alineamos el grupo "player" con el suelo calculado.
  renderer.xr.addEventListener("sessionstart", () => {
    // Si ya cargó el mapa, la variable player.position.y se habrá calculado.
    // Si no, mantenemos el player en y=0 (suelo local).
    if (!isFinite(player.position.y)) player.position.y = 0;
    console.log("VR session started; player.position.y =", player.position.y);
  });

  controls = new PointerLockControls(camera, document.body);
  document.body.addEventListener("click", () => {
    if (!controls.isLocked && !gameOver) controls.lock();
  });

  // LUCES
  const hemiLight = new THREE.HemisphereLight(0xff6644, 0x331100, 0.8);
  hemiLight.position.set(0, 80, 0);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xff5533, 1.2);
  dirLight.position.set(15, 50, 10);
  scene.add(dirLight);

  const ambientRed = new THREE.AmbientLight(0xff3322, 0.35);
  scene.add(ambientRed);

  // Suelo base invisible en y=0 (referencia)
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  scene.add(ground);

  // MAPA
  const loader = new GLTFLoader();
  loader.load(
    "/map 79p3.glb",
    (gltf) => {
      loadedModel = gltf.scene;
      // Alinear el modelo al y=0 (suelo)
      loadedModel.position.y = 0;
      scene.add(loadedModel);

      // Calcular bounding box del modelo.
      const bbox = new THREE.Box3().setFromObject(loadedModel);
      // Usar bbox.min.y como referencia de "suelo" del modelo (evita subir por el punto más alto)
      const floorY = typeof bbox.min.y === "number" ? bbox.min.y : 0;

      // Deseado: que la cámara quede aproximadamente desiredHeadY por encima del suelo del mapa.
      const desiredHeadY = 1.6; // altura de "ojos" sobre el suelo del mapa

      // player.position.y se ajusta de modo que camera.world.y = floorY + desiredHeadY
      const playerY = floorY - (CAMERA_START_Y - desiredHeadY);

      // Evitar posiciones absurdas: no dejar al player demasiado alto o extremadamente bajo.
      // Ajuste opcional: si quieres asegurar que el player nunca quede por debajo de -10 o por encima de 200:
      const clampedPlayerY = Math.min(Math.max(playerY, -10), 200);

      player.position.y = clampedPlayerY;

      console.log(
        "Modelo cargado. floorY:",
        floorY,
        "bbox.max.y:",
        bbox.max.y,
        "player.position.y set to:",
        player.position.y,
        "=> camara mundo Y:",
        player.position.y + CAMERA_START_Y
      );
    },
    undefined,
    (err) => console.error("Error cargando modelo:", err)
  );

  // LUNA / MODELO EXTRA
  loader.load(
    "/moon.glb",
    (gltf) => {
      const model2 = gltf.scene;
      model2.position.set(5, 50, 100);
      model2.scale.set(5, 5, 5);
      scene.add(model2);
      console.log("Segundo modelo cargado");
    },
    undefined,
    (err) => console.error("Error cargando segundo modelo:", err)
  );

  clock = new THREE.Clock();

  window.addEventListener("resize", onResize);
  window.addEventListener("mousedown", aimShoot);

  renderer.setAnimationLoop(animate);
}

function spawnSphere() {
  const radius = THREE.MathUtils.randFloat(0.6, 1.5);
  const geo = new THREE.SphereGeometry(radius, 32, 32);
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(Math.random(), 0.7, 0.5),
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(
    THREE.MathUtils.randFloatSpread(40),
    THREE.MathUtils.randFloat(10, 30),
    THREE.MathUtils.randFloatSpread(40)
  );

  mesh.userData.velocity = new THREE.Vector3(
    THREE.MathUtils.randFloatSpread(0.5),
    -THREE.MathUtils.randFloat(3, 6),
    THREE.MathUtils.randFloatSpread(0.5)
  );

  scene.add(mesh);
  spheres.push(mesh);
}

function updateSpheres(delta) {
  for (let i = spheres.length - 1; i >= 0; i--) {
    const s = spheres[i];
    s.position.addScaledVector(s.userData.velocity, delta);
    if (s.position.y < -50) {
      scene.remove(s);
      spheres.splice(i, 1);
    }
  }
}

function aimShoot(e) {
  if (e.button !== 0) return;
  if (!controls.isLocked) return;
  if (gameOver) return;

  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  const ray = raycaster.ray;

  let bestSphere = null;
  let bestScore = Infinity;

  spheres.forEach((s) => {
    const center = new THREE.Vector3();
    s.getWorldPosition(center);

    const distToRay = ray.distanceToPoint(center);
    const distance = camera.position.distanceTo(center);

    const baseRadius = s.geometry.boundingSphere?.radius || 1;
    const effectiveRadius = baseRadius + distance * 0.015;

    if (distToRay < effectiveRadius && distToRay < bestScore) {
      bestSphere = s;
      bestScore = distToRay;
    }
  });

  if (bestSphere) {
    scene.remove(bestSphere);
    spheres.splice(spheres.indexOf(bestSphere), 1);
    score++;
    scoreEl.textContent = "Score: " + score;
  }
}

function animate() {
  const delta = clock.getDelta();

  if (!gameOver) {
    timeLeft -= delta;
    if (timeLeft <= 0) {
      timeLeft = 0;
      gameOverEl.style.display = "block";
      gameOver = true;
      controls.unlock();
    }

    timeEl.textContent = "Time: " + timeLeft.toFixed(1);

    updateSpheres(delta);

    if (Math.random() < 0.02) spawnSphere();
  }

  renderer.render(scene, camera);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

init();
// ...existing code...
