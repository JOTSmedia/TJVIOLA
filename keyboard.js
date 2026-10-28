import * as THREE from './assets/three.module.min.js';

/** A complete three-sided studio station, with 430 individually articulated keys. */
export function createKeyboard(container, { interactive = false, compact = false } = {}) {
  if (!container) throw new Error('A rig container is required.');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const keySpecs = [
    { name: 'JUNO-DS88', kind: 'roland', count: 88, first: 21, width: 24.25, position: [-3, 0, 3], rotation: 0, color: 0xd72d48, patch: 'TJ GRAND' },
    { name: 'JUPITER-X', kind: 'roland', count: 61, first: 36, width: 18.9, position: [-3.2, 3.3, -2.65], rotation: 0, color: 0xe54c38, tier: true, patch: 'JUPITER PAD' },
    { name: 'FANTOM-06', kind: 'roland', count: 61, first: 36, width: 18.9, position: [12.1, 1.4, 5.8], rotation: -Math.PI / 2, color: 0x148bd1, patch: 'STUDIO KEYS' },
    { name: 'JD-XA', kind: 'roland', count: 49, first: 36, width: 16.3, position: [17.85, 4.5, 5.8], rotation: -Math.PI / 2, color: 0xee284d, tier: true, patch: 'ANALOG BRASS' },
    { name: 'Hammond B-3 · Lower', kind: 'hammond', count: 61, first: 36 },
    { name: 'Hammond B-3 · Upper', kind: 'hammond', count: 61, first: 36 },
    { name: 'Roland AX-Edge', kind: 'keytar', count: 49, first: 36 }
  ];
  const totalKeys = keySpecs.reduce((sum, board) => sum + board.count, 0);
  // Follow the visible station from left to right, finishing each upper tier first.
  const loadingOrder = [6, 5, 4, 1, 0, 3, 2];
  function inLoadingOrder(entries) {
    return loadingOrder.flatMap(instrumentIndex => entries
      .filter(key => key.instrumentIndex === instrumentIndex)
      // The upright keytar descends; the perpendicular right-hand keyboards reverse for screen-left to right.
      .sort((a, b) => ([2, 3, 6].includes(instrumentIndex) ? -1 : 1) * (a.midi - b.midi)));
  }
  let disposed = false, progress = -1, frame = 0, renderer, lastTime = 0;
  const resources = new Set();
  const removers = [];
  const held = new Set();
  const pulseTimers = new Set();
  let audio;
  const voices = new Set();
  const keyIsBlack = midi => [1, 3, 6, 8, 10].includes(midi % 12);
  const own = resource => { resources.add(resource); return resource; };
  const on = (target, type, fn, options) => { target.addEventListener(type, fn, options); removers.push(() => target.removeEventListener(type, fn, options)); };
  try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' }); }
  catch (_) { return makeFallback(); }
  renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio || 1, 1.6), 2.5));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;outline:none;touch-action:pan-y';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.append(renderer.domElement);
  container.setAttribute('aria-label', '3D three-sided studio station: four tiered Roland synthesizers, Hammond B-3 with two manuals and Leslie speaker, and an upright Roland AX-Edge keytar. All 430 keys glow in order: AX-Edge from top to bottom, Hammond upper and lower manuals, then the Roland stacks from left to right.');
  container.dataset.keyboardKeys = String(totalKeys);

  const scene = new THREE.Scene();
  const rig = new THREE.Group();
  scene.add(rig);
  const camera = new THREE.OrthographicCamera(-22, 22, 14, -14, .1, 180);
  camera.position.set(23, 36, 47);
  camera.lookAt(-1, .5, 6);
  camera.updateMatrixWorld();
  scene.add(new THREE.HemisphereLight(0xe1edff, 0x252832, 1.65));
  const keyLight = new THREE.DirectionalLight(0xfff3df, 3.7);
  keyLight.position.set(-20, 32, 25);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.left = -36; keyLight.shadow.camera.right = 36;
  keyLight.shadow.camera.top = 32; keyLight.shadow.camera.bottom = -32;
  keyLight.shadow.radius = 4;
  keyLight.shadow.normalBias = .035;
  keyLight.shadow.bias = -.00015;
  scene.add(keyLight);
  const blueRim = new THREE.DirectionalLight(0x447dff, 1.35);
  blueRim.position.set(4, 12, -16); scene.add(blueRim);
  const cyanRim = new THREE.DirectionalLight(0xa1eaff, .9);
  cyanRim.position.set(22, 5, 11); scene.add(cyanRim);

  const fillLight = new THREE.DirectionalLight(0xe2eaff, 1.1); fillLight.position.set(25, 17, 22); scene.add(fillLight);

  const material = (color, roughness = .5, metalness = 0) => own(new THREE.MeshStandardMaterial({ color, roughness, metalness }));
  const graphite = material(0x202631, .39, .58);
  const cheeks = material(0x0d111a, .6, .2);
  const plastic = material(0x070b13, .35, .12);
  const chrome = material(0x7194b9, .24, .84);
  const ivory = own(new THREE.MeshPhysicalMaterial({ color: 0xf4f0e6, roughness: .2, metalness: .02, clearcoat: .55, clearcoatRoughness: .16 }));
  const ivorySide = material(0x929fae, .45);
  const black = own(new THREE.MeshPhysicalMaterial({ color: 0x070a0f, roughness: .18, metalness: .04, clearcoat: .7, clearcoatRoughness: .14 }));
  const activeWhite = material(0x75eaff, .2, .1);
  activeWhite.emissive.set(0x00baff); activeWhite.emissiveIntensity = 2.25;
  const activeBlack = material(0x198eff, .2, .18);
  activeBlack.emissive.set(0x007cff); activeBlack.emissiveIntensity = 3;
  const standbyBlue = material(0x2dd5ff, .3, .1);
  standbyBlue.emissive.set(0x087fae); standbyBlue.emissiveIntensity = .8;
  const geometries = new Map();
  function box(w, h, d, mat, x, y, z, parent = rig) {
    const cacheKey = `${w}/${h}/${d}`;
    if (!geometries.has(cacheKey)) geometries.set(cacheKey, own(new THREE.BoxGeometry(w, h, d)));
    const mesh = new THREE.Mesh(geometries.get(cacheKey), mat);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  }
  function knob(r, h, mat, x, y, z, parent) {
    const geometry = own(new THREE.CylinderGeometry(r, r, h, 16));
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); return mesh;
  }
  function texture(w, h, draw) {
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    draw(canvas.getContext('2d'), w, h);
    const map = own(new THREE.CanvasTexture(canvas));
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    return map;
  }
  function decal(w, d, x, y, z, map, parent, emissive = false) {
    const mat = own(new THREE.MeshStandardMaterial({ map, transparent: true, roughness: .65, emissive: emissive ? 0x4ea4ca : 0x000000, emissiveMap: emissive ? map : null, emissiveIntensity: emissive ? .45 : 0 }));
    const mesh = new THREE.Mesh(own(new THREE.PlaneGeometry(w, d)), mat);
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  }

  function bevelBox(w, h, d, radius, mat, x, y, z, parent = rig) {
    const r = Math.min(radius, w / 4, h / 4, d / 4);
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2 + r, -h / 2 + r); shape.lineTo(w / 2 - r, -h / 2 + r);
    shape.lineTo(w / 2 - r, h / 2 - r); shape.lineTo(-w / 2 + r, h / 2 - r); shape.closePath();
    const geometry = own(new THREE.ExtrudeGeometry(shape, { depth: d - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 3, steps: 1, curveSegments: 1 }));
    geometry.center();
    const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(x, y, z);
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }

  // Broad photographic softboxes create reflections across keys, lacquer and metal edges.
  const studio = new THREE.Scene(); studio.background = new THREE.Color(0x333844);
  function softbox(w, h, position, target, brightness, tint = 0xffffff) {
    const color = new THREE.Color(tint).multiplyScalar(brightness);
    const geometry = own(new THREE.PlaneGeometry(w, h));
    const mat = own(new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    const plane = new THREE.Mesh(geometry, mat); plane.position.fromArray(position); plane.lookAt(...target); studio.add(plane);
  }
  softbox(28, 16, [-10, 25, 12], [0, 0, 0], 4.5, 0xffefdb);
  softbox(20, 18, [25, 8, -10], [0, 0, 0], 2.8, 0xc9e3ff);
  softbox(34, 8, [0, 8, 28], [0, 0, 0], 1.3, 0xffffff);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const studioEnvironment = own(pmrem.fromScene(studio, .05));
  scene.environment = studioEnvironment.texture; scene.environmentIntensity = .65; pmrem.dispose();

  const woodGrain = texture(2048, 1024, (ctx, w, h) => {
    ctx.fillStyle = '#704326'; ctx.fillRect(0, 0, w, h);
    let random = 81734;
    const rand = () => { random = (random * 16807) % 2147483647; return (random - 1) / 2147483646; };
    for (let i = 0; i < 1800; i++) {
      const y = rand() * h, amplitude = 1 + rand() * 12, phase = rand() * 6.28;
      ctx.strokeStyle = i % 4 === 0 ? `rgba(230,170,104,${.025 + rand() * .06})` : `rgba(27,13,6,${.03 + rand() * .09})`;
      ctx.lineWidth = .3 + rand() * 1.8; ctx.beginPath();
      for (let x = 0; x <= w; x += 12) {
        const yy = y + Math.sin(x * .0035 + phase) * amplitude + Math.sin(x * .017 + phase) * 1.5;
        if (!x) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    for (let i = 0; i < 26000; i++) {
      const light = rand() > .5; ctx.fillStyle = light ? 'rgba(255,214,161,.025)' : 'rgba(20,9,3,.035)';
      ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 12, .5);
    }
  });
  woodGrain.wrapS = woodGrain.wrapT = THREE.RepeatWrapping;
  const walnut = own(new THREE.MeshPhysicalMaterial({ map: woodGrain, bumpMap: woodGrain, bumpScale: .028, color: 0xcfa475, roughness: .36, metalness: 0, clearcoat: .65, clearcoatRoughness: .25 }));
  const walnutEdge = own(new THREE.MeshPhysicalMaterial({ map: woodGrain, bumpMap: woodGrain, bumpScale: .023, color: 0x8e5b34, roughness: .31, clearcoat: .6, clearcoatRoughness: .24 }));
  const gold = material(0xd2b984, .3, .7);
  const grilleMap = texture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#29241e'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < w; i += 4) {
      ctx.fillStyle = i % 12 === 0 ? '#695b44' : '#453b2c'; ctx.fillRect(i, 0, 1, h);
      ctx.fillStyle = i % 16 === 0 ? '#66573f' : '#3d3529'; ctx.fillRect(0, i, w, 1);
    }
  });
  const cloth = own(new THREE.MeshStandardMaterial({ map: grilleMap, roughness: .95, metalness: 0, color: 0xe1cba6 }));

  // A soft additive glow, physically located at the key that is currently depressed.
  const glowMap = texture(128, 128, ctx => {
    const glow = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    glow.addColorStop(0, 'rgba(150,245,255,1)');
    glow.addColorStop(.15, 'rgba(25,192,255,.8)');
    glow.addColorStop(.42, 'rgba(0,115,255,.28)');
    glow.addColorStop(1, 'rgba(0,80,255,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, 128, 128);
  });
  const glowMaterial = own(new THREE.SpriteMaterial({ map: glowMap, color: 0x5dcfff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  const glow = new THREE.Sprite(glowMaterial); glow.scale.set(2.6, 2.6, 1); rig.add(glow);
  const glowLight = new THREE.PointLight(0x11baff, 0, 5.5, 2); rig.add(glowLight);
  const keys = [], targets = [];

  function makeBoard(spec, boardIndex) {
    const board = new THREE.Group();
    board.position.fromArray(spec.position); board.rotation.y = spec.rotation;
    if (spec.tier) board.rotation.x = .065;
    rig.add(board);
    const width = spec.width, half = width / 2;
    const accent = material(spec.color, .36, .25);
    bevelBox(width, .72, 5.7, .085, graphite, 0, -.25, 0, board);
    box(width - .1, .18, 5.58, cheeks, 0, -.68, 0, board);
    bevelBox(.32, .94, 5.82, .08, cheeks, -half, -.15, 0, board);
    bevelBox(.32, .94, 5.82, .08, cheeks, half, -.15, 0, board);
    box(width - .35, .09, 2.04, graphite, 0, .17, -1.85, board);
    box(width - .35, .075, .07, accent, 0, .234, -.79, board);
    box(width - .28, .26, .16, plastic, 0, -.12, 2.85, board);
    box(width - .35, .04, .07, chrome, 0, -.22, 2.96, board);
    const whiteCount = Array.from({ length: spec.count }, (_, i) => spec.first + i).filter(midi => !keyIsBlack(midi)).length;
    const keyWidth = .41;
    const bedWidth = whiteCount * keyWidth;
    const startX = -bedWidth / 2 + .45;
    box(bedWidth + .23, .17, 3.42, plastic, .45, -.12, 1.03, board);
    const bendX = startX - .85;
    box(.7, .08, .55, plastic, bendX, .17, 1.34, board);
    box(.12, .29, .14, chrome, bendX, .35, 1.34, board);
    box(.34, .1, .17, plastic, bendX, .52, 1.34, board);
    const deck = texture(2048, 320, (ctx, w, h) => {
      ctx.fillStyle = '#e2ebf6';
      ctx.font = 'bold 74px Arial, sans-serif'; ctx.fillText('Roland', 34, 104);
      ctx.font = 'bold 67px Arial, sans-serif';
      const label = spec.name;
      ctx.fillText(label, w - ctx.measureText(label).width - 40, 104);
      ctx.fillStyle = '#9daec0'; ctx.font = '17px Arial, sans-serif';
      ctx.fillText(spec.tier ? 'ANALOG / DIGITAL SYNTHESIZER' : boardIndex === 2 ? 'MUSIC WORKSTATION' : 'SYNTHESIZER / 88', w - 388, 145);
      ctx.fillText('VOLUME', 290, 72); ctx.fillText('SOUND MODIFY', 408, 72);
      ctx.fillText(spec.tier ? 'OSCILLATOR / FILTER' : 'PHRASE PAD', 650, 72);
      ctx.fillText('PATCH / PERFORMANCE', 1096, 72);
      ctx.font = '15px Arial, sans-serif';
      ['PIANO', 'KEYS', 'ORGAN', 'STRINGS', 'BRASS', 'SYNTH'].forEach((name, i) => ctx.fillText(name, 1200 + i * 106, 267));
    });
    decal(width - .55, 1.66, 0, .221, -1.85, deck, board);
    const panelScale = width / 24.25;
    knob(.12, .22, chrome, -8.5 * panelScale, .32, -1.96, board);
    for (let i = 0; i < (spec.tier ? 8 : 4); i++) {
      const x = (-7.2 + i * .42) * panelScale;
      knob(.09, .22, plastic, x, .33, -1.94, board);
      box(.017, .012, .055, chrome, x, .447, -1.94, board);
      if (spec.tier) knob(.09, .22, plastic, x, .33, -1.44, board);
    }
    if (!spec.tier) for (let row = 0; row < 2; row++) for (let i = 0; i < 4; i++)
      box(.33, .07, .28, i === 0 && row === 1 ? accent : plastic, (-4.6 + i * .44) * panelScale, .275, -1.87 + row * .42, board);
    const screenX = -.2 * panelScale;
    box(2.72 * panelScale, .09, 1.04, plastic, screenX, .275, -1.84, board);
    const screen = texture(512, 160, ctx => {
      ctx.fillStyle = boardIndex === 1 ? '#325f83' : '#266e91'; ctx.fillRect(0, 0, 512, 160);
      ctx.fillStyle = '#b2edff'; ctx.font = '21px monospace'; ctx.fillText('PATCH              PRST 001', 14, 30);
      ctx.font = 'bold 36px monospace'; ctx.fillText(spec.patch, 14, 86);
      ctx.font = '19px monospace'; ctx.fillText(`${spec.count} KEYS    ROLAND`, 14, 135);
    });
    decal(2.48 * panelScale, .79, screenX, .326, -1.84, screen, board, true);
    knob(.21, .17, plastic, 1.65 * panelScale, .31, -1.94, board);
    for (let i = 0; i < 8; i++) box(.29, .07, .17, plastic, (2.6 + i * .43) * panelScale, .27, -1.47, board);
    box(.06, .012, .04, standbyBlue, 2.6 * panelScale, .315, -1.47, board);
    for (const x of [-half + .4, half - .4]) knob(.035, .015, chrome, x, .223, -2.6, board);
    let whiteIndex = 0;
    for (let midi = spec.first; midi < spec.first + spec.count; midi++) {
      const isBlack = keyIsBlack(midi);
      const x = startX + (isBlack ? whiteIndex - .5 : whiteIndex) * keyWidth;
      const pivot = new THREE.Group(); pivot.position.set(x, isBlack ? .355 : .19, -.57); board.add(pivot);
      const mesh = isBlack
        ? box(.235, .25, 1.89, black, 0, .09, .97, pivot)
        : box(keyWidth - .014, .205, 3.27, [ivorySide, ivorySide, ivory, ivorySide, ivory, ivorySide], 0, .01, 1.65, pivot);
      let cap;
      if (isBlack) cap = box(.204, .024, 1.83, black, 0, .224, .98, pivot);
      else { cap = box(keyWidth - .025, .03, .08, ivory, 0, -.032, 3.31, pivot); whiteIndex++; }
      const globalIndex = keys.length;
      mesh.userData.keyIndex = globalIndex;
      keys.push({ pivot, mesh, cap, board, instrumentIndex: keySpecs.indexOf(spec), midi, isBlack, rest: mesh.material, angle: 0, heat: 0, front: new THREE.Vector3(0, .38, isBlack ? 1.5 : 2.65) });
      targets.push(mesh);
    }
    return board;
  }
  keySpecs.filter(spec => spec.kind === 'roland').forEach(makeBoard);
  makeHammond();
  makeKeytar();
  const loadingKeys = inLoadingOrder(keys);

  function manual(parent, spec, y, z, keyWidth = .41, length = 2.72, xOffset = 1.2) {
    const group = new THREE.Group(); group.position.set(xOffset, y, z); parent.add(group);
    const whites = Array.from({ length: spec.count }, (_, i) => spec.first + i).filter(midi => !keyIsBlack(midi)).length;
    let whiteIndex = 0;
    for (let midi = spec.first; midi < spec.first + spec.count; midi++) {
      const isBlack = keyIsBlack(midi), x = -whites * keyWidth / 2 + (isBlack ? whiteIndex - .5 : whiteIndex) * keyWidth;
      const pivot = new THREE.Group(); pivot.position.set(x, isBlack ? .15 : 0, 0); group.add(pivot);
      const mesh = isBlack
        ? box(keyWidth * .57, .21, length * .59, black, 0, .16, length * .30, pivot)
        : box(keyWidth - .012, .19, length, [ivorySide, ivorySide, ivory, ivorySide, ivory, ivorySide], 0, .05, length * .5, pivot);
      const cap = isBlack ? box(keyWidth * .5, .022, length * .56, black, 0, .277, length * .30, pivot) : box(keyWidth - .02, .025, .06, ivory, 0, .004, length - .03, pivot);
      if (!isBlack) whiteIndex++;
      mesh.userData.keyIndex = keys.length;
      keys.push({ pivot, mesh, cap, board: parent, instrumentIndex: keySpecs.indexOf(spec), midi, isBlack, rest: mesh.material, angle: 0, heat: 0, front: new THREE.Vector3(0, .36, isBlack ? length * .49 : length * .87) });
      targets.push(mesh);
    }
    return group;
  }

  function makeHammond() {
    const organ = new THREE.Group(); organ.position.set(-20.5, .1, 7.7); organ.rotation.y = Math.PI / 2; rig.add(organ);
    // Solid walnut waterfall console, two offset manuals and the B-3's open wooden legs.
    bevelBox(20.6, .6, 7.8, .14, walnut, 0, -.43, .35, organ);
    bevelBox(.95, 2.86, 7.8, .16, walnut, -10.1, .7, .35, organ);
    bevelBox(.95, 2.86, 7.8, .16, walnut, 10.1, .7, .35, organ);
    bevelBox(19.6, .56, 3.0, .12, walnut, 0, 2.14, -2.05, organ);
    bevelBox(19.4, .25, 3.05, .07, walnutEdge, 0, 1.02, -.10, organ);
    bevelBox(19.5, .28, .32, .06, walnutEdge, 0, -.03, 4.12, organ);
    box(18.8, .12, 2.95, plastic, 0, -.04, 2.5, organ);
    box(18.8, .12, 2.95, plastic, 0, 1.15, .05, organ);
    manual(organ, keySpecs[4], .05, 1.3, .41, 2.66, 1.4);
    manual(organ, keySpecs[5], 1.28, -.95, .41, 2.66, 1.4);
    // Reversed-color preset octave and the pair of nine-drawbar tone controls.
    for (const y of [.15, 1.38]) for (let i = 0; i < 12; i++) {
      const preset = box(.155, .15, i % 3 === 1 ? 1.38 : 2.45, i % 3 === 1 ? ivory : black, -8.5 + i * .165, y, (y > 1 ? .18 : 2.43), organ);
      preset.receiveShadow = true;
    }
    for (let bank = 0; bank < 2; bank++) for (let i = 0; i < 9; i++) {
      const x = -5.4 + bank * 6.2 + i * .46;
      box(.25, .018, 1.15, plastic, x, 2.445, -1.87, organ);
      box(.065, .08, .85, chrome, x, 2.49, -1.60, organ);
      bevelBox(.29, .16, .25, .035, i < 2 ? walnutEdge : i % 2 ? ivory : black, x, 2.53, -1.24 + (i % 4) * .09, organ);
    }
    for (let i = 0; i < 6; i++) bevelBox(.38, .12, .42, .035, i % 2 ? ivory : walnutEdge, 6.35 + i * .43, 2.49, -1.7, organ);
    const badge = texture(1024, 160, ctx => {
      ctx.fillStyle = '#ddc38b'; ctx.font = 'italic 82px Georgia,serif'; ctx.fillText('Hammond', 30, 104);
      ctx.font = 'bold 42px Arial,sans-serif'; ctx.fillText('B-3', 775, 102);
    });
    decal(6.8, .65, .1, 2.442, -2.8, badge, organ);
    for (const x of [-8.8, 8.8]) for (const z of [-2.0, 3.05]) {
      const leg = new THREE.Mesh(own(new THREE.CylinderGeometry(.24, .32, 4.68, 16)), walnutEdge);
      leg.position.set(x, -3.02, z); leg.castShadow = true; organ.add(leg);
      knob(.37, .19, walnut, x, -5.38, z, organ);
      knob(.31, .23, walnut, x, -.93, z, organ);
    }
    box(17.9, .35, .28, walnutEdge, 0, -4.6, -2, organ);
    box(.28, .25, 5.1, walnutEdge, -8.8, -4.6, .5, organ);
    box(.28, .25, 5.1, walnutEdge, 8.8, -4.6, .5, organ);
    // A broad expression pedal is separate from the 122 musical manual notes.
    const expression = bevelBox(1.6, .22, 2.6, .08, plastic, 1.5, -5.15, 4.9, organ); expression.rotation.x = -.21;
    for (let i = 0; i < 8; i++) box(1.3, .025, .035, chrome, 1.5, -4.99 + i * .012, 4 + i * .23, organ);

    const leslie = new THREE.Group(); leslie.position.set(-16.8, -1.13, -6.9); leslie.rotation.y = .30; rig.add(leslie);
    bevelBox(6.15, 8.85, 5.0, .16, walnut, 0, 0, 0, leslie);
    // Inset woven lower grille and upper rotating-horn louvers are unmistakably Leslie.
    box(5.25, 3.9, .055, cloth, 0, -1.55, 2.53, leslie);
    box(5.25, 2.3, .055, plastic, 0, 2.12, 2.53, leslie);
    for (let i = 0; i < 5; i++) bevelBox(5.5, .17, .26, .04, walnutEdge, 0, 1.16 + i * .45, 2.66, leslie);
    for (const x of [-2.76, 2.76]) bevelBox(.2, 7.92, .16, .04, walnutEdge, x, -.1, 2.65, leslie);
    for (const y of [-3.67, .52, 3.39]) bevelBox(5.7, .19, .19, .04, walnutEdge, 0, y, 2.65, leslie);
    box(.055, 3.8, 3.8, cloth, 3.09, -1.6, 0, leslie);
    for (let i = 0; i < 5; i++) box(.22, .18, 4.2, walnutEdge, 3.16, 1.2 + i * .44, 0, leslie);
    const leslieBadge = texture(512, 128, ctx => { ctx.fillStyle = '#dfce9f'; ctx.font = 'italic 66px Georgia,serif'; ctx.fillText('Leslie', 24, 82); ctx.font = '24px Arial'; ctx.fillText('122', 360, 80); });
    const badgeMesh = new THREE.Mesh(own(new THREE.PlaneGeometry(2.8, .7)), own(new THREE.MeshStandardMaterial({ map: leslieBadge, transparent: true, roughness: .42, metalness: .3 })));
    badgeMesh.position.set(0, .05, 2.7); leslie.add(badgeMesh);
    for (const x of [-2.3, 2.3]) for (const z of [-1.7, 1.7]) box(.45, .25, .45, plastic, x, -4.48, z, leslie);
  }

  function makeKeytar() {
    const instrument = new THREE.Group();
    // Local X is the instrument's length: map it exactly onto world Y, then yaw
    // only around that vertical axis so the branded front faces the camera.
    instrument.position.set(-29.9, 1.1, 16.0);
    const yaw = 1.04;
    instrument.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw))
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2))
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
    rig.add(instrument);
    const pearl = own(new THREE.MeshPhysicalMaterial({ color: 0xf3f3ee, roughness: .2, metalness: .16, clearcoat: .85, clearcoatRoughness: .13 }));
    const bladeSilver = own(new THREE.MeshPhysicalMaterial({ color: 0xabb1b7, roughness: .27, metalness: .78, clearcoat: .35, clearcoatRoughness: .2 }));
    // The AX-Edge reference has a broad white control deck, silver blade edge,
    // sharply extended neck, and a large open space below the hand grip.
    function faceShape(points, depth, mat, y) {
      const shape = new THREE.Shape();
      points.forEach(([x, z], i) => i ? shape.lineTo(x, z) : shape.moveTo(x, z)); shape.closePath();
      const geometry = own(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: .055, bevelThickness: .055, bevelSegments: 3, steps: 1 }));
      geometry.rotateX(Math.PI / 2); geometry.translate(0, y, 0);
      const mesh = new THREE.Mesh(geometry, mat); mesh.castShadow = true; mesh.receiveShadow = true; instrument.add(mesh); return mesh;
    }
    faceShape([[-6.7,-1.7],[-5.85,-1.98],[10.45,-1.98],[10.1,-1.42],[9.25,-1.15],[7.25,-.93],[6.2,-1.05],[5.55,-.42],[5.73,.4],[6.7,2.65],[-5.92,2.18],[-6.7,1.8]], .42, pearl, .36);
    faceShape([[-6.7,1.78],[-5.92,2.18],[6.7,2.65],[5.83,1.98],[-5.55,1.71],[-6.22,-1.75],[-6.7,-1.69]], .035, bladeSilver, .435);
    box(11.4, .1, 2.62, plastic, -.25, .45, -.12, instrument);
    manual(instrument, keySpecs[6], .53, -1.48, .37, 2.5, -.25);
    // Neck grip and ribbon controls sit above the open cut-out, not across it.
    bevelBox(1.5, .2, .54, .05, plastic, 7.0, .51, -1.27, instrument);
    box(1.15, .07, .19, graphite, 7.0, .65, -1.27, instrument);
    for (let i = 0; i < 4; i++) box(.22, .075, .14, plastic, 8.3 + i * .35, .49, -1.55, instrument);
    for (let i = 0; i < 11; i++) box(.23, .065, .19, i === 8 ? activeBlack : plastic, -2.6 + i * .55, .48, 1.15, instrument);
    for (let i = 0; i < 5; i++) knob(.07, .07, plastic, 2.9 + i * .38, .49, 1.16, instrument);
    // Large, high-contrast Roland branding, including the familiar double-line
    // emblem. It occupies the white deck and remains visible in the loader.
    const rolandMark = texture(1536, 256, ctx => {
      ctx.strokeStyle = '#121820'; ctx.lineWidth = 15; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(36,209); ctx.lineTo(36,49); ctx.lineTo(255,49); ctx.quadraticCurveTo(308,49,308,98); ctx.quadraticCurveTo(308,145,255,145); ctx.lineTo(95,145); ctx.lineTo(95,207); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(68,210); ctx.lineTo(68,81); ctx.lineTo(249,81); ctx.quadraticCurveTo(276,81,276,98); ctx.quadraticCurveTo(276,115,249,115); ctx.lineTo(128,115); ctx.lineTo(128,178); ctx.lineTo(309,178); ctx.stroke();
      ctx.fillStyle = '#121820'; ctx.font = 'bold 230px Arial,sans-serif'; ctx.fillText('Roland', 350, 215);
    });
    decal(7.95, .96, -1.0, .515, 1.76, rolandMark, instrument);
    const modelMark = texture(768, 192, ctx => { ctx.fillStyle = '#171e27'; ctx.font = 'italic bold 135px Arial,sans-serif'; ctx.fillText('AX-Edge', 24, 145); });
    decal(2.5, .61, 9.0, .45, -1.67, modelMark, instrument);
    // Red patch digits and the small dark performance display match the front.
    const display = texture(512, 192, ctx => { ctx.fillStyle = '#10151d'; ctx.fillRect(0,0,512,192); ctx.fillStyle = '#fa343d'; ctx.font = '92px monospace'; ctx.fillText('001', 32, 124); });
    box(1.05, .075, .48, plastic, 4.35, .46, 1.55, instrument);
    decal(.93, .37, 4.35, .505, 1.55, display, instrument, true);
    for (const x of [-6.4, -5.8, 5.8]) for (const z of [1.86, -1.78]) knob(.035, .018, chrome, x, .47, z, instrument);
    // Independent floor stand outside the Hammond, with a padded lower cradle.
    // The instrument's bottom is at floor level; the pole sits behind its face.
    const sx = -29.9, sz = 16.0;
    beam([sx - .4, -5.52, sz - .24], [sx - .4, 4.6, sz - .24], .13, cheeks);
    beam([sx - 2.2, -5.52, sz - 1.2], [sx + 2.2, -5.52, sz + 1.2], .15, cheeks);
    beam([sx - 1.5, -5.52, sz + 1.8], [sx + 1.5, -5.52, sz - 1.8], .15, cheeks);
    beam([sx - .8, -4.55, sz + 1.35], [sx + .85, -4.55, sz - 1.38], .14, plastic);
  }

  // Solid two-tier support: rear risers and cross-braced feet keep every board connected.
  function beam(a, b, radius = .11, mat = chrome) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const direction = new THREE.Vector3().subVectors(end, start);
    const mesh = new THREE.Mesh(own(new THREE.CylinderGeometry(radius, radius, direction.length(), 10)), mat);
    mesh.position.copy(start).add(end).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    mesh.castShadow = true; rig.add(mesh);
  }
  for (const x of [-11, 5]) {
    beam([x, -5.4, 1], [x, 2.55, -3.8], .13);
    beam([x, -5.4, 6], [x, -.85, 1.4], .15, cheeks);
    beam([x, -5.4, -.6], [x, -5.4, 7.2], .17, cheeks);
    beam([x, -.93, .7], [x, -.93, 5.2], .13);
    beam([x, 2.44, -4.2], [x, 2.44, -.7], .12);
  }
  beam([-11, -4.1, 2], [5, -.95, 2], .13, cheeks);
  beam([5, -4.1, 2], [-11, -.95, 2], .13, cheeks);
  beam([-11, 1.5, -3.4], [5, 1.5, -3.4], .11, cheeks);
  for (const z of [-1.4, 12.7]) {
    beam([12.1, -5.4, z], [12.1, .52, z], .15, cheeks);
    beam([9.5, -5.4, z], [14.5, -5.4, z], .16, cheeks);
    beam([9.7, .53, z], [14.4, .53, z], .12);
  }
  beam([12.1, -4.5, -1.4], [12.1, .5, 12.7], .12);
  beam([12.1, .5, -1.4], [12.1, -4.5, 12.7], .12);

  for (const z of [.0, 11.6]) {
    beam([17.85, -5.4, z], [17.85, 3.7, z], .14);
    beam([14.7, 3.63, z], [20.3, 3.63, z], .13);
    beam([15.9, -5.4, z], [20, -5.4, z], .17, cheeks);
    beam([12.1, -.5, z], [17.85, 2.8, z], .12, cheeks);
  }
  beam([17.85, -4.6, .0], [17.85, 2.3, 11.6], .12, cheeks);
  const floor = new THREE.Mesh(own(new THREE.PlaneGeometry(78, 60)), own(new THREE.ShadowMaterial({ color: 0x00030e, opacity: .2 })));
  floor.rotation.x = -Math.PI / 2; floor.position.set(-1, -5.7, 6); floor.receiveShadow = true; scene.add(floor);
  let visible = true;
  const visibilityObserver = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; }, { rootMargin: '100px' });
  visibilityObserver.observe(container);
  rig.updateMatrixWorld(true);
  const corner = new THREE.Vector3();
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  // Fit the L itself, rather than the empty corners of its world-space bounding box.
  rig.traverse(object => {
    if (!object.isMesh || !object.geometry) return;
    object.geometry.computeBoundingBox();
    const bounds = object.geometry.boundingBox;
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      corner.set(x, y, z).applyMatrix4(object.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
      minX = Math.min(minX, corner.x); maxX = Math.max(maxX, corner.x);
      minY = Math.min(minY, corner.y); maxY = Math.max(maxY, corner.y);
    }
  });
  const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2;
  function resize() {
    if (disposed) return;
    const width = Math.max(1, container.clientWidth), height = Math.max(1, container.clientHeight || 380), aspect = width / height;
    const density = Math.min(matchMedia('(pointer: coarse)').matches ? 2 : 2.5, 4096 / width, 2304 / height);
    renderer.setPixelRatio(Math.max(1, density));
    renderer.setSize(width, height, false);
    const worldHeight = Math.max((maxY - minY) * 1.075, (maxX - minX) * 1.075 / aspect);
    const worldWidth = worldHeight * aspect;
    camera.left = centerX - worldWidth / 2; camera.right = centerX + worldWidth / 2;
    camera.top = centerY + worldHeight / 2; camera.bottom = centerY - worldHeight / 2;
    camera.updateProjectionMatrix();
  }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(container); resize();

  // Loading visits every key once, with a brief blue afterglow on keys just released.
  let sweep = -1, sweepPending = -1;
  function setProgress(value) {
    progress = Number.isFinite(value) ? Math.max(-1, Math.min(100, value)) : -1;
    sweepPending = progress < 0 ? -1 : Math.min(totalKeys - 1, Math.floor(progress * totalKeys / 100));
    if (sweepPending < sweep || sweepPending === -1) { keys.forEach(key => { key.heat = 0; }); sweep = sweepPending; }
    else if (sweepPending > sweep) {
      for (let i = Math.max(0, sweep + 1); i <= sweepPending; i++) loadingKeys[i].heat = 1;
      sweep = sweepPending;
    }
  }
  function playNote(midi = 60) {
    if (!interactive || disposed) return;
    const keyIndex = keys.findIndex(key => key.midi === midi);
    if (keyIndex >= 0) {
      held.add(keyIndex); keys[keyIndex].heat = 1;
      const timer = setTimeout(() => { held.delete(keyIndex); pulseTimers.delete(timer); }, 500); pulseTimers.add(timer);
    }
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume().catch(() => {});
      const osc = audio.createOscillator(), gain = audio.createGain(), now = audio.currentTime;
      osc.type = 'triangle'; osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
      gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(.1, now + .012); gain.gain.exponentialRampToValueAtTime(.0001, now + .8);
      osc.connect(gain); gain.connect(audio.destination); voices.add(osc); osc.start(now); osc.stop(now + .85);
      osc.onended = () => { voices.delete(osc); osc.disconnect(); gain.disconnect(); };
    } catch (_) {}
  }
  if (interactive) {
    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
    on(renderer.domElement, 'pointerdown', event => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(targets, false)[0];
      if (hit) playNote(keys[hit.object.userData.keyIndex].midi);
    });
  }
  let resolveReady, initial = true;
  const ready = new Promise(resolve => { resolveReady = resolve; });
  const glowPosition = new THREE.Vector3();
  function render(time) {
    if (disposed) return;
    frame = requestAnimationFrame(render);
    if (document.hidden || !visible) { lastTime = time; return; }
    if (lastTime && time - lastTime < 1000 / 35) return;
    const dt = Math.min((time - (lastTime || time - 16)) / 1000, .08); lastTime = time;
    keys.forEach((key, index) => {
      const active = key === loadingKeys[sweep] || held.has(index) || key.heat > .72;
      if (key === loadingKeys[sweep] || held.has(index)) key.heat = 1;
      else key.heat = Math.max(0, key.heat - dt * 3.3);
      const target = active ? (key.isBlack ? .095 : .073) : 0;
      key.angle += (target - key.angle) * Math.min(1, dt * 25);
      key.pivot.rotation.x = key.angle;
      key.mesh.material = active || key.heat > .18 ? (key.isBlack ? activeBlack : activeWhite) : key.rest;
      key.cap.material = active || key.heat > .18 ? (key.isBlack ? activeBlack : activeWhite) : (key.isBlack ? black : ivory);
    });
    if (sweep >= 0 && loadingKeys[sweep]) {
      const key = loadingKeys[sweep]; key.pivot.updateWorldMatrix(true, false);
      glowPosition.copy(key.front); key.pivot.localToWorld(glowPosition);
      rig.worldToLocal(glowPosition); glow.position.copy(glowPosition); glow.position.y += .12;
      glowLight.position.copy(glowPosition); glowLight.position.y += .45;
      glowMaterial.opacity = .68; glowLight.intensity = 3.8;
    } else { glowMaterial.opacity = 0; glowLight.intensity = 0; }
    rig.rotation.y = reduced ? 0 : Math.sin(time * .00024) * .017;
    rig.position.y = reduced ? 0 : Math.sin(time * .0005) * .035;
    renderer.render(scene, camera);
    if (initial) { initial = false; container.dataset.keyboardReady = 'true'; resolveReady(); }
  }
  frame = requestAnimationFrame(render);
  return { ready, setProgress, playNote, dispose() {
    if (disposed) return; disposed = true;
    cancelAnimationFrame(frame); resizeObserver.disconnect(); visibilityObserver.disconnect(); removers.forEach(remove => remove());
    pulseTimers.forEach(clearTimeout); voices.forEach(voice => { try { voice.stop(); } catch (_) {} }); audio?.close().catch(() => {});
    resources.forEach(resource => resource.dispose?.()); renderer.dispose(); renderer.domElement.remove(); resolveReady();
  } };

  function makeFallback() {
    const root = document.createElement('div');
    root.style.cssText = 'position:relative;width:100%;height:100%;min-height:240px;display:grid;place-items:center';
    const stage = document.createElement('div');
    stage.style.cssText = 'position:relative;width:94%;max-width:800px;height:270px;transform:perspective(1000px) rotateX(23deg);transform-style:preserve-3d';
    const buttons = [];
    const positions = [
      'left:35%;top:98px;width:36%;', 'left:37%;top:32px;width:33%;',
      'left:82%;top:97px;width:34%;transform:rotate(90deg);transform-origin:0 0;',
      'left:93%;top:78px;width:31%;transform:rotate(90deg);transform-origin:0 0;',
      'left:34%;top:91px;width:34%;transform:rotate(90deg);transform-origin:0 0;',
      'left:23%;top:91px;width:34%;transform:rotate(90deg);transform-origin:0 0;',
      'left:0;top:235px;width:35%;transform:rotate(-90deg);transform-origin:0 0;'
    ];
    keySpecs.forEach((spec, index) => {
      const board = document.createElement('div');
      board.style.cssText = `position:absolute;height:36px;background:${spec.kind === 'hammond' ? '#775038' : spec.kind === 'keytar' ? '#d9e0e9' : '#1c273b'};padding:14px 4px 4px;box-sizing:border-box;border-top:2px solid ${spec.kind === 'hammond' ? '#ad7b4a' : '#298bff'};display:flex;${positions[index]}`;
      const label = document.createElement('span'); label.textContent = spec.name;
      label.style.cssText = `position:absolute;left:5px;top:4px;color:${spec.kind === 'keytar' ? '#182439' : '#e2d7c2'};font:700 7px Arial,sans-serif`; board.append(label);
      for (let i = 0; i < spec.count; i++) {
        const isBlack = keyIsBlack(spec.first + i), key = document.createElement('span');
        key.style.cssText = isBlack ? 'height:64%;width:1.7%;flex:0 0 1.7%;background:#0b1020;margin:0 -.85%;z-index:2;transform-origin:top;' : 'height:100%;flex:1;background:#eae9e3;margin-right:.5px;transform-origin:top;';
        buttons.push({ el: key, isBlack, instrumentIndex: index, midi: spec.first + i }); board.append(key);
      }
      stage.append(board);
    });
    const speaker = document.createElement('div'); speaker.textContent = 'Leslie 122'; speaker.style.cssText = 'position:absolute;left:24%;top:8px;width:13%;height:64px;background:#5c3c25;border:5px solid #8d6240;color:#d5bf8b;font:italic 9px Georgia;text-align:center;padding-top:10px;box-sizing:border-box'; stage.append(speaker);
    root.append(stage); container.append(root); container.dataset.keyboardKeys = String(totalKeys);
    const loadingButtons = inLoadingOrder(buttons);
    return { ready: Promise.resolve(), playNote() {}, setProgress(value) {
      const current = value < 0 ? -1 : Math.min(totalKeys - 1, Math.floor(value * totalKeys / 100));
      buttons.forEach(key => {
        const active = key === loadingButtons[current] || key === loadingButtons[current - 1];
        key.el.style.transform = active ? 'rotateX(-14deg) translateY(2px)' : '';
        key.el.style.background = active ? '#5cdbff' : key.isBlack ? '#0b1020' : '#eae9e3';
        key.el.style.boxShadow = active ? '0 0 13px #168dff' : 'none';
      });
    }, dispose() { disposed = true; root.remove(); } };
  }
}
