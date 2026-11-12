// The stage's 3D mode ("universe"): the run as a tower of rings in space, one ring per altitude, with bloom.
// After Silvio's Gravity (Fringe _site/universe: three.js 0.147.0 and its UnrealBloomPass from jsdelivr, a hand-made orbit
// camera that drifts when idle, additive halos). Loaded by stage.js the first time the mode is chosen; it draws into #uni
// and follows the stage's state every frame (visibility, highlight, live units, failures). swarm.1.designer may restyle it.
/* global THREE */
(() => {
  'use strict';
  const BASE = 'https://cdn.jsdelivr.net/npm/three@0.147.0/';
  const FILES = ['build/three.min.js', 'examples/js/shaders/CopyShader.js', 'examples/js/shaders/LuminosityHighPassShader.js', 'examples/js/postprocessing/Pass.js',
    'examples/js/postprocessing/EffectComposer.js', 'examples/js/postprocessing/RenderPass.js', 'examples/js/postprocessing/ShaderPass.js', 'examples/js/postprocessing/UnrealBloomPass.js'];
  const load = (src) => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  let ready = false, R, SC, C, comp, bloom, host, graphKey = '', meshes = new Map(), lineGeo, lineMat, lines, starsPts;
  const cam = { ang: 0.6, h: 12, dist: 34, idle: true };

  (async () => {
    try { for (const f of FILES) await load(BASE + f); } catch (e) { window.STAGE && window.STAGE.toast('3D: three.js did not load (network?)'); return; }
    host = document.getElementById('uni');
    const cv = document.createElement('canvas'); host.appendChild(cv);
    R = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); R.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    R.toneMapping = THREE.ACESFilmicToneMapping;
    SC = new THREE.Scene(); C = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
    comp = new THREE.EffectComposer(R); comp.addPass(new THREE.RenderPass(SC, C));
    bloom = new THREE.UnrealBloomPass(new THREE.Vector2(512, 512), 0.9, 0.55, 0.62); comp.addPass(bloom);
    // stars
    const n = 2500, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const r = 120 + Math.random() * 60, a = Math.random() * Math.PI * 2, b = Math.acos(2 * Math.random() - 1); pos.set([r * Math.sin(b) * Math.cos(a), r * Math.cos(b), r * Math.sin(b) * Math.sin(a)], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    starsPts = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.5, color: 0xd9e8e4, transparent: true, opacity: 0.55, depthWrite: false })); SC.add(starsPts);
    lineMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
    // the camera: drag to orbit, wheel to zoom, idle drift (Gravity's)
    let drag = null;
    cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; cam.idle = false; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', (e) => { if (!drag) return; cam.ang -= (e.clientX - drag.x) * 0.005; cam.h = Math.max(-30, Math.min(40, cam.h + (e.clientY - drag.y) * 0.05)); drag = { x: e.clientX, y: e.clientY }; });
    cv.addEventListener('pointerup', () => { drag = null; setTimeout(() => { cam.idle = true; }, 4000); });
    cv.addEventListener('wheel', (e) => { e.preventDefault(); cam.dist = Math.max(8, Math.min(120, cam.dist * Math.exp(e.deltaY * 0.001))); }, { passive: false });
    ready = true;
  })();

  function cssColor(v) { const s = getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#8EADA8'; try { return new THREE.Color(s); } catch { return new THREE.Color('#8EADA8'); } }
  function build(g, ctx) {
    for (const m of meshes.values()) SC.remove(m.group);
    meshes = new Map(); if (lines) SC.remove(lines);
    const alts = ctx.ALT.filter((a) => g.nodes.some((n) => n.alt === a));
    const step = 4.2, top = ((alts.length - 1) * step) / 2;
    for (const a of alts) {
      const row = g.nodes.filter((n) => n.alt === a), rad = row.length === 1 ? 0 : Math.max(2.5, Math.sqrt(row.length) * 1.6), y = top - alts.indexOf(a) * step;
      row.forEach((n, i) => {
        const ang = (i / row.length) * Math.PI * 2 + alts.indexOf(a) * 0.4;
        const col = cssColor('--alt-' + n.alt), sz = 0.12 + 0.035 * ctx.r(n);
        const group = new THREE.Group(); group.position.set(Math.cos(ang) * rad, y, Math.sin(ang) * rad);
        const core = new THREE.Mesh(new THREE.SphereGeometry(sz, 16, 12), new THREE.MeshBasicMaterial({ color: col, transparent: true }));
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); halo.scale.setScalar(sz * 7);
        group.add(core); group.add(halo); SC.add(group);
        meshes.set(n.id, { group, core, halo, n, col });
      });
      // a faint ring per altitude
      if (rad > 0) { const ring = new THREE.Mesh(new THREE.RingGeometry(rad - 0.02, rad + 0.02, 96), new THREE.MeshBasicMaterial({ color: cssColor('--alt-' + a), transparent: true, opacity: 0.12, side: THREE.DoubleSide })); ring.rotation.x = Math.PI / 2; ring.position.y = y; SC.add(ring); meshes.set('ring:' + a, { group: ring, ring: true }); }
    }
    const pts = [], cols = [];
    for (const l of g.links) { const a = meshes.get(typeof l.source === 'object' ? l.source.id : l.source), b = meshes.get(typeof l.target === 'object' ? l.target.id : l.target); if (!a || !b) continue; pts.push(...a.group.position.toArray(), ...b.group.position.toArray()); cols.push(...a.col.toArray(), ...b.col.toArray()); }
    lineGeo = new THREE.BufferGeometry(); lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); lineGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    lines = new THREE.LineSegments(lineGeo, lineMat); SC.add(lines);
    cam.dist = Math.max(22, alts.length * step * 2.4);
  }
  let _tex = null;
  function haloTex() { if (_tex) return _tex; const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(0.25, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); _tex = new THREE.CanvasTexture(c); return _tex; }

  let lastT = performance.now();
  window.STAGE_UNIVERSE = {
    render(g, st, ctx) {
      if (!ready) return;
      host.style.display = 'block';
      const key = (st.scene && st.scene.id) + '|' + g.nodes.length + '|' + document.documentElement.dataset.theme;
      if (key !== graphKey) { graphKey = key; build(g, ctx); }
      const w = host.clientWidth, h = host.clientHeight;
      if (R.domElement.width !== Math.floor(w * R.getPixelRatio()) || R.domElement.height !== Math.floor(h * R.getPixelRatio())) { R.setSize(w, h, false); comp.setSize(w, h); C.aspect = w / Math.max(1, h); C.updateProjectionMatrix(); }
      const now = performance.now(), dt = (now - lastT) / 1000; lastT = now;
      for (const m of meshes.values()) {
        if (m.ring) continue;
        const v = ctx.visible(m.n), dim = st.highlight && !(st.highlight.includes(m.n.alt) || st.highlight.includes(m.n.kind)) ? 0.12 : 1;
        const fail = st.fail === m.n.id && st.failP > 0.05;
        m.group.visible = v > 0.01; m.group.scale.setScalar(0.3 + 0.7 * v + (fail ? 1.2 * st.failP : 0));
        m.core.material.opacity = dim; m.halo.material.opacity = dim * (fail ? 1 : 0.55);
        m.core.material.color.copy(fail ? new THREE.Color('#FF4D6D') : m.col); m.halo.material.color.copy(fail ? new THREE.Color('#FF4D6D') : m.col);
      }
      lineMat.opacity = st.highlight ? 0.18 : 0.45;
      if (cam.idle) cam.ang += 0.08 * dt;
      C.position.set(Math.cos(cam.ang) * cam.dist, cam.h * (cam.dist / 34), Math.sin(cam.ang) * cam.dist); C.lookAt(0, 0, 0);
      comp.render();
    },
    hide() { if (host) host.style.display = 'none'; },
  };
})();
