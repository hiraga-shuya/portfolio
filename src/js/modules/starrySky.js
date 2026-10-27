// kv.js
export function starrySky() {
  // =====================================================
  // Basic Setup
  // =====================================================
  const canvas = document.getElementById("kvCanvas");
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    3000
  );
  camera.position.set(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x000000, 0);

  // =====================================================
  // Stars
  // =====================================================
  const STAR_COUNT = 24000;
  const starGroup = new THREE.Group();
  scene.add(starGroup);

  const geometry = new THREE.SphereGeometry(0.35, 8, 8);
  const material = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
  });
  const stars = new THREE.InstancedMesh(geometry, material, STAR_COUNT);
  stars.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const dummy = new THREE.Object3D();
  const baseScales = [];
  const phaseOffsets = [];

  const MIN_R = 300;
  const MAX_R = 700;
  const STAR_SIZE_OPTIONS = [0.3, 0.45, 0.6, 0.8];

  for (let i = 0; i < STAR_COUNT; i++) {
    const radius = THREE.MathUtils.randFloat(MIN_R, MAX_R);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(THREE.MathUtils.randFloat(-1, 1));

    dummy.position.set(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );

    const scale =
      STAR_SIZE_OPTIONS[Math.floor(Math.random() * STAR_SIZE_OPTIONS.length)];
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    stars.setMatrixAt(i, dummy.matrix);

    baseScales.push(scale);
    phaseOffsets.push(Math.random() * Math.PI * 2);
  }

  starGroup.add(stars);

  // =====================================================
  // Mouse
  // =====================================================
  let mouseX = 0,
    mouseY = 0;
  let currentRotX = 0,
    currentRotY = 0;
  const ROT_LERP = 0.008;

  window.addEventListener("mousemove", (e) => {
    mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseY = (e.clientY / window.innerHeight) * 2 - 1;
  });

  // =====================================================
  // Fade
  // =====================================================
  let fadeOpacity = 0;

  // =====================================================
  // Planets
  // =====================================================
  const planetGroup = new THREE.Group();
  scene.add(planetGroup);

  const PLANET_COUNT = 3;
  const planets = [];

  const PLANET_POS_IDLE = [
    new THREE.Vector3(-180, -100, -500),
    new THREE.Vector3(0, -100, -500),
    new THREE.Vector3(180, -100, -500),
  ];

  const PLANET_POS_ACTIVE = new THREE.Vector3(-250, 0, -500);

  // ★修正：惑星ごとの吸い込み先
  const PLANET_POS_ABYSS = PLANET_POS_IDLE.map(
    (pos) => new THREE.Vector3(pos.x, pos.y, -2200)
  );

  const planetGeometry = new THREE.SphereGeometry(40, 64, 64);
  const textureLoader = new THREE.TextureLoader();

  for (let i = 0; i < PLANET_COUNT; i++) {
    const texturePath = `/wp-content/themes/portfolio/assets/img/top/planet_texture${String(
      i + 1
    ).padStart(2, "0")}.jpg`;

    const planetMaterial = new THREE.MeshStandardMaterial({
      map: textureLoader.load(texturePath),
    });

    const planet = new THREE.Mesh(planetGeometry, planetMaterial);
    planet.position.copy(PLANET_POS_IDLE[i]);
    planet.scale.setScalar(1);

    planetGroup.add(planet);
    planets.push(planet);
  }

  // =====================================================
  // Light
  // =====================================================
  const light = new THREE.DirectionalLight(0xffffff, 1.2);
  light.position.set(-300, 200, 300);
  scene.add(light);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(ambientLight);

  // =====================================================
  // Sections & State
  // =====================================================
  const sections = [
    { el: document.querySelector(".modSectionLv02--about"), planetIndex: 0 },
    { el: document.querySelector(".modSectionLv02--skill"), planetIndex: 1 },
    { el: document.querySelector(".modSectionLv02--career"), planetIndex: 2 },
  ];

  let state = "idle";
  let transitionStart = 0;
  let fromIndex = -1;
  let toIndex = -1;

  const STAR_SPEED_NORMAL = 0.0002;
  const STAR_SPEED_WARP = 0.02;
  let starSpeed = STAR_SPEED_NORMAL;

  const PLANET_SCALE_ACTIVE = 3;
  const PLANET_SCALE_HIDDEN = 0.3;

  const ROT_SPEED_IDLE = 0.3;
  const ROT_SPEED_ACTIVE = 1.2;
  const ROT_SPEED_WARP = 3.5;

  const FLOAT_AMPLITUDE = 12;
  const FLOAT_SPEED = 0.002;

  function updateSectionVisibility(activeIndex) {
    sections.forEach((section, i) => {
      if (!section.el) return;
      if (i === activeIndex) {
        section.el.classList.add("is-visible");
      } else {
        section.el.classList.remove("is-visible");
      }
    });
  }

  // =====================================================
  // Animation
  // =====================================================
  let lastTime = performance.now();

  function animate() {
    requestAnimationFrame(animate);

    const now = performance.now();
    const delta = (now - lastTime) / 1000;
    lastTime = now;

    if (fadeOpacity < 1) {
      fadeOpacity += 0.005;
      material.opacity = fadeOpacity;
    }

    for (let i = 0; i < STAR_COUNT; i++) {
      stars.getMatrixAt(i, dummy.matrix);
      dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
      dummy.scale.setScalar(
        baseScales[i] *
          (1 + Math.sin(now * 0.002 + phaseOffsets[i]) * 0.5)
      );
      dummy.updateMatrix();
      stars.setMatrixAt(i, dummy.matrix);
    }
    stars.instanceMatrix.needsUpdate = true;

    // =================================================
    // Section Detection
    // =================================================
    let enterIndex = -1;
    let anySectionVisible = false;

    sections.forEach((section, index) => {
      if (!section.el) return;
      const rect = section.el.getBoundingClientRect();
      const inView =
        rect.top < window.innerHeight && rect.bottom > 0;

      if (inView) anySectionVisible = true;

      if (
        rect.top < window.innerHeight * 0.5 &&
        rect.bottom > 0 &&
        index !== fromIndex
      ) {
        enterIndex = index;
      }
    });

    // =================================================
    // Active → Idle
    // =================================================
    if (state === "active" && !anySectionVisible) {
      state = "idle";
      fromIndex = -1;
      updateSectionVisibility(-1);
    }

    // =================================================
    // Idle → Enter Warp
    // =================================================
    if (state === "idle" && enterIndex !== -1) {
      state = "enter-warp";
      transitionStart = now;
      toIndex = enterIndex;
    }

    // =================================================
    // Active → Cross Warp
    // =================================================
    if (state === "active" && enterIndex !== -1 && enterIndex !== fromIndex) {
      state = "cross-warp";
      transitionStart = now;
      toIndex = enterIndex;
    }

    // =================================================
    // Enter Warp
    // =================================================
    if (state === "enter-warp") {
      const t = THREE.MathUtils.clamp((now - transitionStart) / 1000, 0, 1);
      starSpeed = STAR_SPEED_WARP;

      planets.forEach((planet, i) => {
        planet.rotation.y += delta * ROT_SPEED_WARP;

        if (i === toIndex) {
          planet.position.lerpVectors(
            PLANET_POS_IDLE[i],
            PLANET_POS_ACTIVE,
            t
          );
          planet.scale.setScalar(
            THREE.MathUtils.lerp(1, PLANET_SCALE_ACTIVE, t)
          );
        } else {
          planet.position.lerpVectors(
            PLANET_POS_IDLE[i],
            PLANET_POS_ABYSS[i],
            t
          );
          planet.scale.setScalar(
            THREE.MathUtils.lerp(1, PLANET_SCALE_HIDDEN, t)
          );
        }
      });

      if (t >= 1) {
        state = "active";
        fromIndex = toIndex;
        updateSectionVisibility(fromIndex);
      }
    }

    // =================================================
    // Cross Warp
    // =================================================
    if (state === "cross-warp") {
      const t = THREE.MathUtils.clamp((now - transitionStart) / 1000, 0, 1);
      starSpeed = STAR_SPEED_WARP;

      planets.forEach((planet, i) => {
        planet.rotation.y += delta * ROT_SPEED_WARP;

        if (i === fromIndex) {
          planet.position.lerpVectors(
            PLANET_POS_ACTIVE,
            PLANET_POS_ABYSS[i],
            t
          );
          planet.scale.setScalar(
            THREE.MathUtils.lerp(PLANET_SCALE_ACTIVE, PLANET_SCALE_HIDDEN, t)
          );
        } else if (i === toIndex) {
          planet.position.lerpVectors(
            PLANET_POS_IDLE[i],
            PLANET_POS_ACTIVE,
            t
          );
          planet.scale.setScalar(
            THREE.MathUtils.lerp(PLANET_SCALE_HIDDEN, PLANET_SCALE_ACTIVE, t)
          );
        }
      });

      if (t >= 1) {
        state = "active";
        fromIndex = toIndex;
        updateSectionVisibility(fromIndex);
      }
    }

    // =================================================
    // Active
    // =================================================
    if (state === "active") {
      starSpeed += (STAR_SPEED_NORMAL - starSpeed) * delta * 2;
      planets[fromIndex].rotation.y += delta * ROT_SPEED_ACTIVE;
    }

    // =================================================
    // Idle
    // =================================================
    if (state === "idle") {
      starSpeed += (STAR_SPEED_NORMAL - starSpeed) * delta * 3;

      planets.forEach((planet, i) => {
        const floatY =
          Math.sin(now * FLOAT_SPEED + i) * FLOAT_AMPLITUDE;

        planet.position.lerp(PLANET_POS_IDLE[i], delta * 2);
        planet.position.y = PLANET_POS_IDLE[i].y + floatY;

        planet.scale.lerp(new THREE.Vector3(1, 1, 1), delta * 2);
        planet.rotation.y += delta * ROT_SPEED_IDLE;
      });
    }

    starGroup.rotation.y += starSpeed;

    currentRotY += (mouseX * 0.15 - currentRotY) * ROT_LERP;
    currentRotX += (mouseY * 0.1 - currentRotX) * ROT_LERP;
    camera.rotation.y = currentRotY;
    camera.rotation.x = currentRotX;

    renderer.render(scene, camera);
  }

  animate();

  // =====================================================
  // Resize
  // =====================================================
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}
