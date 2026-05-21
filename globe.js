/* ─── GLOBE.JS — Interactive 3D Globe with Three.js ─────────────── */

(function() {
  const canvas = document.getElementById('globe-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = 2.4;

  // GLOBE GEOMETRY
  const sphereGeo = new THREE.SphereGeometry(1, 64, 64);

  // Globe material — dark ocean with grid lines
  const globeMat = new THREE.MeshPhongMaterial({
    color: 0x0a1628,
    emissive: 0x061020,
    shininess: 15,
    transparent: true,
    opacity: 0.95,
  });
  const globe = new THREE.Mesh(sphereGeo, globeMat);
  scene.add(globe);

  // ATMOSPHERE GLOW
  const atmGeo = new THREE.SphereGeometry(1.05, 64, 64);
  const atmMat = new THREE.MeshPhongMaterial({
    color: 0x0044aa,
    transparent: true,
    opacity: 0.06,
    side: THREE.BackSide,
  });
  scene.add(new THREE.Mesh(atmGeo, atmMat));

  // GRATICULE (lat/lon grid lines)
  function addGridLines() {
    const mat = new THREE.LineBasicMaterial({ color: 0x0d2a4a, transparent: true, opacity: 0.5 });
    // Latitude lines
    for (let lat = -75; lat <= 75; lat += 15) {
      const pts = [];
      for (let lon = 0; lon <= 360; lon += 4) {
        const phi = (90 - lat) * Math.PI / 180;
        const theta = lon * Math.PI / 180;
        pts.push(new THREE.Vector3(
          1.001 * Math.sin(phi) * Math.cos(theta),
          1.001 * Math.cos(phi),
          1.001 * Math.sin(phi) * Math.sin(theta)
        ));
      }
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
    }
    // Longitude lines
    for (let lon = 0; lon < 360; lon += 15) {
      const pts = [];
      for (let lat = -90; lat <= 90; lat += 3) {
        const phi = (90 - lat) * Math.PI / 180;
        const theta = lon * Math.PI / 180;
        pts.push(new THREE.Vector3(
          1.001 * Math.sin(phi) * Math.cos(theta),
          1.001 * Math.cos(phi),
          1.001 * Math.sin(phi) * Math.sin(theta)
        ));
      }
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
    }
  }
  addGridLines();

  // LIGHTS
  scene.add(new THREE.AmbientLight(0x223344, 2));
  const sunLight = new THREE.DirectionalLight(0x6699cc, 1.5);
  sunLight.position.set(5, 3, 5);
  scene.add(sunLight);
  const rimLight = new THREE.DirectionalLight(0x0066aa, 0.8);
  rimLight.position.set(-4, -1, -3);
  scene.add(rimLight);

  // MARKERS
  const markers = [];
  const markerGroup = new THREE.Group();
  scene.add(markerGroup);

  const priorityColors = {
    critical: 0xff3b3b,
    high:     0xff8c00,
    medium:   0xffd700,
    low:      0x3ddc84,
  };

  window.updateGlobeMarkers = function(events) {
    // Clear old markers
    while (markerGroup.children.length) markerGroup.remove(markerGroup.children[0]);
    markers.length = 0;

    events.forEach(ev => {
      if (!ev.lat || !ev.lon) return;
      const color = priorityColors[ev.priority] || 0x00c8ff;
      const phi = (90 - ev.lat) * Math.PI / 180;
      const theta = (ev.lon + 180) * Math.PI / 180;
      const r = 1.015;

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.cos(phi);
      const z = r * Math.sin(phi) * Math.sin(theta);

      // Dot
      const dotGeo = new THREE.SphereGeometry(0.018, 8, 8);
      const dotMat = new THREE.MeshBasicMaterial({ color });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.set(x, y, z);
      dot.userData = ev;

      // Pulse ring
      const ringGeo = new THREE.RingGeometry(0.022, 0.03, 16);
      const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(x, y, z);
      ring.lookAt(new THREE.Vector3(0, 0, 0));
      ring.userData = { pulsePhase: Math.random() * Math.PI * 2 };

      markerGroup.add(dot);
      markerGroup.add(ring);
      markers.push({ dot, ring, event: ev });
    });
  };

  // DRAG / ROTATE
  let isDragging = false;
  let prevMouse = { x: 0, y: 0 };
  let rotationVelocity = { x: 0, y: 0 };
  let autoRotate = true;

  canvas.addEventListener('mousedown', e => {
    isDragging = true;
    autoRotate = false;
    prevMouse = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener('mousemove', e => {
    if (!isDragging) return;
    const dx = e.clientX - prevMouse.x;
    const dy = e.clientY - prevMouse.y;
    rotationVelocity.y = dx * 0.01;
    rotationVelocity.x = dy * 0.01;
    globe.rotation.y += rotationVelocity.y;
    globe.rotation.x += rotationVelocity.x;
    markerGroup.rotation.y = globe.rotation.y;
    markerGroup.rotation.x = globe.rotation.x;
    prevMouse = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener('mouseup', () => {
    isDragging = false;
    setTimeout(() => { autoRotate = true; }, 3000);
  });
  canvas.addEventListener('touchstart', e => {
    isDragging = true; autoRotate = false;
    prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  });
  canvas.addEventListener('touchmove', e => {
    if (!isDragging) return;
    const dx = e.touches[0].clientX - prevMouse.x;
    const dy = e.touches[0].clientY - prevMouse.y;
    globe.rotation.y += dx * 0.01;
    globe.rotation.x += dy * 0.01;
    markerGroup.rotation.y = globe.rotation.y;
    markerGroup.rotation.x = globe.rotation.x;
    prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  });
  canvas.addEventListener('touchend', () => {
    isDragging = false;
    setTimeout(() => { autoRotate = true; }, 3000);
  });

  // RESIZE
  function resize() {
    const container = canvas.parentElement;
    const w = container.clientWidth - 24;
    const h = Math.min(240, w);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  // ANIMATE
  let t = 0;
  function animate() {
    requestAnimationFrame(animate);
    t += 0.016;

    if (autoRotate && !isDragging) {
      globe.rotation.y += 0.003;
      markerGroup.rotation.y = globe.rotation.y;
    }

    // Pulse rings
    markers.forEach(({ ring }) => {
      const phase = ring.userData.pulsePhase + t * 2;
      const scale = 1 + 0.5 * Math.abs(Math.sin(phase));
      ring.scale.setScalar(scale);
      ring.material.opacity = 0.7 - 0.5 * Math.abs(Math.sin(phase));
    });

    renderer.render(scene, camera);
  }
  animate();

  // Focus on region
  window.focusGlobeOnRegion = function(lat, lon) {
    autoRotate = false;
    const targetY = (lon + 180) * Math.PI / 180;
    const targetX = -(lat) * Math.PI / 180 * 0.5;
    globe.rotation.y = targetY;
    globe.rotation.x = targetX;
    markerGroup.rotation.y = globe.rotation.y;
    markerGroup.rotation.x = globe.rotation.x;
    setTimeout(() => { autoRotate = true; }, 5000);
  };

})();
