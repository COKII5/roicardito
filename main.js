// === HUD 3D text as Sprites ===
let scoreSprite, timeSprite, crosshairSprite;
const hudGroup = new THREE.Group(); // grupo unido a la cámara

function createHUD() {
  // MATERIAL SCORE
  const scoreCanvas = document.createElement("canvas");
  scoreCanvas.width = 256;
  scoreCanvas.height = 128;
  const ctxScore = scoreCanvas.getContext("2d");
  ctxScore.font = "40px Arial";
  ctxScore.fillStyle = "white";
  ctxScore.fillText("Score: 0", 10, 50);
  const scoreTexture = new THREE.CanvasTexture(scoreCanvas);
  const scoreMaterial = new THREE.SpriteMaterial({ map: scoreTexture });
  scoreSprite = new THREE.Sprite(scoreMaterial);
  scoreSprite.scale.set(2, 1, 1);
  scoreSprite.position.set(-1.5, 1.5, -3);

  // MATERIAL TIME
  const timeCanvas = document.createElement("canvas");
  timeCanvas.width = 256;
  timeCanvas.height = 128;
  const ctxTime = timeCanvas.getContext("2d");
  ctxTime.font = "40px Arial";
  ctxTime.fillStyle = "white";
  ctxTime.fillText("Time: 60", 10, 50);
  const timeTexture = new THREE.CanvasTexture(timeCanvas);
  const timeMaterial = new THREE.SpriteMaterial({ map: timeTexture });
  timeSprite = new THREE.Sprite(timeMaterial);
  timeSprite.scale.set(2, 1, 1);
  timeSprite.position.set(1.5, 1.5, -3);

  // CROSSHAIR
  const crosshairTexture = new THREE.TextureLoader().load("/crosshair.png"); // O un PNG pequeño
  const crossMaterial = new THREE.SpriteMaterial({ map: crosshairTexture, color: 0xffffff });
  crosshairSprite = new THREE.Sprite(crossMaterial);
  crosshairSprite.scale.set(0.2, 0.2, 1);
  crosshairSprite.position.set(0, 0, -2);

  hudGroup.add(scoreSprite, timeSprite, crosshairSprite);
  camera.add(hudGroup);
  scene.add(camera);
}

function updateHUD() {
  // SCORE UPDATE
  const ctxS = scoreSprite.material.map.image.getContext("2d");
  ctxS.clearRect(0,0,256,128);
  ctxS.font = "40px Arial";
  ctxS.fillStyle = "white";
  ctxS.fillText("Score: " + score, 10, 50);
  scoreSprite.material.map.needsUpdate = true;

  // TIME UPDATE
  const ctxT = timeSprite.material.map.image.getContext("2d");
  ctxT.clearRect(0,0,256,128);
  ctxT.font = "40px Arial";
  ctxT.fillStyle = "white";
  ctxT.fillText("Time: " + timeLeft.toFixed(1), 10, 50);
  timeSprite.material.map.needsUpdate = true;
}
