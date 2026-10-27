// kv.js
import { STAR_PARAMS, PLANET_PARAMS, ANIMATION_PARAMS, LIGHT_PARAMS } from './three_parameter.js';

export function three_process() {
  // =====================================================
  // Basic Setup
  // =====================================================
  const canvas = document.getElementById("kvCanvas");
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    ANIMATION_PARAMS.camera.fov,
    window.innerWidth / window.innerHeight,
    ANIMATION_PARAMS.camera.near,
    ANIMATION_PARAMS.camera.far
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
  const starGroup = new THREE.Group();
  scene.add(starGroup);

  const geometry = new THREE.SphereGeometry(
    STAR_PARAMS.geometry.radius,
    STAR_PARAMS.geometry.widthSegments,
    STAR_PARAMS.geometry.heightSegments
  );
  const material = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
  });
  const stars = new THREE.InstancedMesh(geometry, material, STAR_PARAMS.count);
  stars.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const dummy = new THREE.Object3D();
  const baseScales = [];
  const phaseOffsets = [];

  for (let i = 0; i < STAR_PARAMS.count; i++) {
    const radius = THREE.MathUtils.randFloat(STAR_PARAMS.range.min, STAR_PARAMS.range.max);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(THREE.MathUtils.randFloat(-1, 1));

    dummy.position.set(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );

    const scale = STAR_PARAMS.sizeOptions[Math.floor(Math.random() * STAR_PARAMS.sizeOptions.length)];
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
  let mouseX = 0, mouseY = 0;
  let currentRotX = 0, currentRotY = 0;

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

  const planets = [];
  const PLANET_POS_IDLE = PLANET_PARAMS.positions.idle.map(p => new THREE.Vector3(p.x, p.y, p.z));
  const PLANET_POS_ACTIVE = new THREE.Vector3(
    PLANET_PARAMS.positions.active.x,
    PLANET_PARAMS.positions.active.y,
    PLANET_PARAMS.positions.active.z
  );
  const PLANET_POS_ABYSS = PLANET_POS_IDLE.map(pos => new THREE.Vector3(pos.x, pos.y, PLANET_PARAMS.positions.abyssZ));

  const planetGeometry = new THREE.SphereGeometry(
    PLANET_PARAMS.geometry.radius,
    PLANET_PARAMS.geometry.widthSegments,
    PLANET_PARAMS.geometry.heightSegments
  );
  const textureLoader = new THREE.TextureLoader();

  for (let i = 0; i < PLANET_PARAMS.count; i++) {
    const texturePath = `/wp-content/themes/portfolio/assets/img/top/planet_texture${String(i + 1).padStart(2, "0")}.jpg`;
    const planetMaterial = new THREE.MeshStandardMaterial({
      map: textureLoader.load(texturePath),
    });

    const planet = new THREE.Mesh(planetGeometry, planetMaterial);
    planet.position.copy(PLANET_POS_IDLE[i]);
    planet.scale.setScalar(PLANET_PARAMS.scales.idle);

    planetGroup.add(planet);
    planets.push(planet);
  }

  // =====================================================
  // Light
  // =====================================================
  const light = new THREE.DirectionalLight(LIGHT_PARAMS.directional.color, LIGHT_PARAMS.directional.intensity);
  light.position.set(LIGHT_PARAMS.directional.pos.x, LIGHT_PARAMS.directional.pos.y, LIGHT_PARAMS.directional.pos.z);
  scene.add(light);

  const ambientLight = new THREE.AmbientLight(LIGHT_PARAMS.ambient.color, LIGHT_PARAMS.ambient.intensity);
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
  let starSpeed = ANIMATION_PARAMS.starSpeed.normal;

  function updateSectionVisibility(activeIndex) {
    sections.forEach((section, i) => {
      if (!section.el) return;
      section.el.classList.toggle("is-visible", i === activeIndex);
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
      fadeOpacity += STAR_PARAMS.fadeSpeed;
      material.opacity = fadeOpacity;
    }

    for (let i = 0; i < STAR_PARAMS.count; i++) {
      stars.getMatrixAt(i, dummy.matrix);
      dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
      dummy.scale.setScalar(
        baseScales[i] * (1 + Math.sin(now * STAR_PARAMS.pulseSpeed + phaseOffsets[i]) * STAR_PARAMS.pulseIntensity)
      );
      dummy.updateMatrix();
      stars.setMatrixAt(i, dummy.matrix);
    }
    stars.instanceMatrix.needsUpdate = true;

    // Section Detection
    let enterIndex = -1;
    let anySectionVisible = false;

    sections.forEach((section, index) => {
      if (!section.el) return;
      const rect = section.el.getBoundingClientRect();
      const inView = rect.top < window.innerHeight && rect.bottom > 0;
      if (inView) anySectionVisible = true;
      if (rect.top < window.innerHeight * 0.5 && rect.bottom > 0 && index !== fromIndex) {
        enterIndex = index;
      }
    });

    if (state === "active" && !anySectionVisible) {
      state = "idle";
      fromIndex = -1;
      updateSectionVisibility(-1);
    }
    if (state === "idle" && enterIndex !== -1) {
      state = "enter-warp";
      transitionStart = now;
      toIndex = enterIndex;
    }
    if (state === "active" && enterIndex !== -1 && enterIndex !== fromIndex) {
      state = "cross-warp";
      transitionStart = now;
      toIndex = enterIndex;
    }

    // Warp Logic
    if (state === "enter-warp") {
      const t = THREE.MathUtils.clamp((now - transitionStart) / 1000, 0, 1);
      starSpeed = ANIMATION_PARAMS.starSpeed.warp;

      planets.forEach((planet, i) => {
        planet.rotation.y += delta * ANIMATION_PARAMS.rotationSpeed.warp;
        if (i === toIndex) {
          planet.position.lerpVectors(PLANET_POS_IDLE[i], PLANET_POS_ACTIVE, t);
          planet.scale.setScalar(THREE.MathUtils.lerp(PLANET_PARAMS.scales.idle, PLANET_PARAMS.scales.active, t));
        } else {
          planet.position.lerpVectors(PLANET_POS_IDLE[i], PLANET_POS_ABYSS[i], t);
          planet.scale.setScalar(THREE.MathUtils.lerp(PLANET_PARAMS.scales.idle, PLANET_PARAMS.scales.hidden, t));
        }
      });

      if (t >= 1) {
        state = "active";
        fromIndex = toIndex;
        updateSectionVisibility(fromIndex);
      }
    }

    if (state === "cross-warp") {
      const t = THREE.MathUtils.clamp((now - transitionStart) / 1000, 0, 1);
      starSpeed = ANIMATION_PARAMS.starSpeed.warp;

      planets.forEach((planet, i) => {
        planet.rotation.y += delta * ANIMATION_PARAMS.rotationSpeed.warp;
        if (i === fromIndex) {
          planet.position.lerpVectors(PLANET_POS_ACTIVE, PLANET_POS_ABYSS[i], t);
          planet.scale.setScalar(THREE.MathUtils.lerp(PLANET_PARAMS.scales.active, PLANET_PARAMS.scales.hidden, t));
        } else if (i === toIndex) {
          planet.position.lerpVectors(PLANET_POS_IDLE[i], PLANET_POS_ACTIVE, t);
          planet.scale.setScalar(THREE.MathUtils.lerp(PLANET_PARAMS.scales.hidden, PLANET_PARAMS.scales.active, t));
        }
      });

      if (t >= 1) {
        state = "active";
        fromIndex = toIndex;
        updateSectionVisibility(fromIndex);
      }
    }

    if (state === "active") {
      starSpeed += (ANIMATION_PARAMS.starSpeed.normal - starSpeed) * delta * ANIMATION_PARAMS.starSpeed.lerpActive;
      planets[fromIndex].rotation.y += delta * ANIMATION_PARAMS.rotationSpeed.active;
    }

    if (state === "idle") {
      starSpeed += (ANIMATION_PARAMS.starSpeed.normal - starSpeed) * delta * ANIMATION_PARAMS.starSpeed.lerpIdle;
      planets.forEach((planet, i) => {
        const floatY = Math.sin(now * ANIMATION_PARAMS.floating.speed + i) * ANIMATION_PARAMS.floating.amplitude;
        planet.position.lerp(PLANET_POS_IDLE[i], delta * 2);
        planet.position.y = PLANET_POS_IDLE[i].y + floatY;
        planet.scale.lerp(new THREE.Vector3(1, 1, 1), delta * 2);
        planet.rotation.y += delta * ANIMATION_PARAMS.rotationSpeed.idle;
      });
    }

    starGroup.rotation.y += starSpeed;

    currentRotY += (mouseX * ANIMATION_PARAMS.camera.mouseIntensityX - currentRotY) * ANIMATION_PARAMS.camera.lerp;
    currentRotX += (mouseY * ANIMATION_PARAMS.camera.mouseIntensityY - currentRotX) * ANIMATION_PARAMS.camera.lerp;
    camera.rotation.y = currentRotY;
    camera.rotation.x = currentRotX;

    renderer.render(scene, camera);
  }

  animate();

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}