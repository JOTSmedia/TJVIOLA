import * as THREE from './assets/three.module.min.js';

/** A complete three-sided studio station, with 442 individually articulated keys. */
export function createKeyboard(container, { interactive = false, compact = false } = {}) {
  if (!container) throw new Error('A rig container is required.');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const keySpecs = [
    { name: 'Roland FANTOM 8', kind: 'synth', model: 'fantom', count: 88, first: 21, width: 24.25, depth: 7.45, keyWidth: .39, keyOffset: .9, position: [-3, 0, 3], rotation: 0 },
    { name: 'Roland D-50', kind: 'synth', model: 'd50', count: 61, first: 36, width: 17.0, depth: 5.65, keyWidth: .39, keyOffset: .6, position: [-3.2, 3.3, -2.65], rotation: 0, tier: true },
    { name: 'Roland JUPITER-8', kind: 'synth', model: 'jupiter8', count: 61, first: 36, width: 18.0, depth: 8.1, keyWidth: .39, keyOffset: 1.0, position: [13.5, 1.4, 5.8], rotation: -Math.PI / 2 },
    { name: 'Yamaha DX7', kind: 'synth', model: 'dx7', count: 61, first: 36, width: 17.4, depth: 5.65, keyWidth: .39, keyOffset: .65, position: [21.3, 4.5, 5.8], rotation: -Math.PI / 2, tier: true },
    { name: 'Hammond B-3 · Lower', kind: 'hammond', count: 61, first: 36 },
    { name: 'Hammond B-3 · Upper', kind: 'hammond', count: 61, first: 36 },
    { name: 'Roland AX-Synth', kind: 'keytar', count: 49, first: 36 }
  ];
  const totalKeys = keySpecs.reduce((sum, board) => sum + board.count, 0);
  // Finish both Hammond manuals, the middle pair and right pair, then the upright keytar.
  const loadingOrder = [5, 4, 1, 0, 2, 3, 6];
  function inLoadingOrder(entries) {
    return loadingOrder.flatMap(instrumentIndex => entries
      .filter(key => key.instrumentIndex === instrumentIndex)
      // The DX7 runs right-to-left; the vertical keytar descends. Other rows run left-to-right.
      .sort((a, b) => ([3,6].includes(instrumentIndex) ? -1 : 1) * (a.midi - b.midi)));
  }
  let disposed = false, progress = -1, frame = 0, renderer, lastTime = 0;
  const resources = new Set();
  const removers = [];
  let manualKey = null;
  const pulseTimers = new Set();
  let audio;
  const voices = new Set();
  const keyIsBlack = midi => [1, 3, 6, 8, 10].includes(midi % 12);
  const own = resource => { resources.add(resource); return resource; };
  const on = (target, type, fn, options) => { target.addEventListener(type, fn, options); removers.push(() => target.removeEventListener(type, fn, options)); };
  try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' }); }
  catch (_) { return makeFallback(); }
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;outline:none;touch-action:pan-y';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.append(renderer.domElement);
  container.setAttribute('aria-label', 'Detailed 3D studio station: Hammond B-3, Leslie with a Logic-session MacBook, FANTOM 8 under D-50, JUPITER-8 under Yamaha DX7, and upright black Roland AX-Synth at the top-right corner of the carpet, facing the viewer. One of 442 keys glows at a time: Hammond upper, Hammond lower, D-50, FANTOM 8, JUPITER-8 left to right, Yamaha DX7 right to left, then AX-Synth from top to bottom.');
  container.dataset.keyboardKeys = String(totalKeys);

  const scene = new THREE.Scene();
  const rig = new THREE.Group();
  scene.add(rig);
  const camera = new THREE.OrthographicCamera(-22, 22, 14, -14, .1, 180);
  camera.position.set(23, 36, 47);
  camera.lookAt(-1, .5, 6);
  camera.updateMatrixWorld();
  scene.add(new THREE.HemisphereLight(0xe1edff, 0x222630, 1.45));
  const keyLight = new THREE.DirectionalLight(0xfff4e6, 3.1);
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
  // A pure blue emissive face avoids the white specular/ACES wash that can
  // conceal a small selected key. Only this one musical key uses these materials.
  const activeWhite=own(new THREE.MeshStandardMaterial({color:0x000000,roughness:1,metalness:1,envMapIntensity:0,emissive:0x006bff,emissiveIntensity:1.25,toneMapped:false}));
  const activeBlack=own(new THREE.MeshStandardMaterial({color:0x000000,roughness:1,metalness:1,envMapIntensity:0,emissive:0x006bff,emissiveIntensity:1.35,toneMapped:false}));
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
    const cacheKey = `cylinder/${r}/${h}`;
    if (!geometries.has(cacheKey)) geometries.set(cacheKey, own(new THREE.CylinderGeometry(r, r, h, 24)));
    const geometry = geometries.get(cacheKey);
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
    const cacheKey = `bevel/${w}/${h}/${d}/${r}`;
    if (!geometries.has(cacheKey)) { const geometry = own(new THREE.ExtrudeGeometry(shape, { depth: d - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 4, steps: 1, curveSegments: 2 })); geometry.center(); geometries.set(cacheKey, geometry); }
    const geometry = geometries.get(cacheKey);
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

  // The selected key's actual surface and its own fitted rim provide the light.
  // No fixed-size front-tip sprites or point streaks can conceal a size change.
  const keyHaloMap=texture(256,1024,ctx=>{
    ctx.clearRect(0,0,256,1024);ctx.shadowColor='rgba(0,104,255,.8)';ctx.shadowBlur=16;
    ctx.fillStyle='rgba(0,90,255,.08)';ctx.beginPath();ctx.roundRect(22,20,212,984,12);ctx.fill();
    ctx.shadowBlur=9;ctx.strokeStyle='rgba(70,185,255,.95)';ctx.lineWidth=3;ctx.stroke();
  });
  const keyHaloMaterial=own(new THREE.MeshBasicMaterial({map:keyHaloMap,color:0xffffff,transparent:true,opacity:1.0,blending:THREE.AdditiveBlending,depthWrite:false,depthTest:true,toneMapped:false}));
  const keyHalo=new THREE.Mesh(own(new THREE.PlaneGeometry(1,1)),keyHaloMaterial);keyHalo.matrixAutoUpdate=false;keyHalo.visible=false;keyHalo.renderOrder=4;rig.add(keyHalo);
  const edgeBloomMap=texture(512,1024,ctx=>{
    const image=ctx.createImageData(512,1024),data=image.data,halfW=512/2.4/2,halfH=1024/1.12/2;
    for(let y=0;y<1024;y++)for(let x=0;x<512;x++){
      const ax=Math.abs(x-255.5),ay=Math.abs(y-511.5),dx=Math.max(0,ax-halfW),dy=Math.max(0,ay-halfH),distance=Math.sqrt((dx/70)**2+(dy/28)**2);
      const inside=dx===0&&dy===0,innerDistance=Math.min((halfW-ax)/7,(halfH-ay)/13);
      let alpha=inside?.46*Math.exp(-Math.max(0,innerDistance)):.70*Math.exp(-.5*distance*distance);
      const edgeFade=Math.min(1,(255.5-ax)/20,(511.5-ay)/16);alpha*=Math.max(0,edgeFade);
      const falloff=Math.min(1,distance/2),offset=(y*512+x)*4;
      data[offset]=Math.round(65*(1-falloff));data[offset+1]=Math.round(215-120*falloff);data[offset+2]=255;data[offset+3]=Math.round(alpha*255);
    }
    ctx.putImageData(image,0,0);
  });
  const edgeBloomMaterial=own(new THREE.MeshBasicMaterial({map:edgeBloomMap,color:0xffffff,transparent:true,opacity:.22,blending:THREE.AdditiveBlending,depthWrite:false,depthTest:false,toneMapped:false}));
  const keyEdgeBloom=new THREE.Mesh(own(new THREE.PlaneGeometry(1,1)),edgeBloomMaterial);keyEdgeBloom.matrixAutoUpdate=false;keyEdgeBloom.visible=false;keyEdgeBloom.renderOrder=3;rig.add(keyEdgeBloom);const edgeBloomScale=new THREE.Vector3(2.4,1.12,1);
  const haloLocal=new THREE.Matrix4(),haloRotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2),haloScale=new THREE.Vector3(),haloPosition=new THREE.Vector3(),haloDimensions=new THREE.Vector3();

  const keys = [], targets = [];let leslieCabinet=null;
  const satinBlack = material(0x10141a, .36, .32);
  const darkBrown = own(new THREE.MeshPhysicalMaterial({color:0x211b1a,roughness:.43,metalness:.22,clearcoat:.3,clearcoatRoughness:.36}));
  const brushedSilver = own(new THREE.MeshPhysicalMaterial({color:0xb0b4b7,roughness:.3,metalness:.9,clearcoat:.15}));
  const buttonGray = material(0x5b6266,.46,.08);
  const tealSwitch = material(0x178d83,.51,.02);
  const greenSwitch = material(0x2c7c60,.55,.02);
  const orangePaint = material(0xc46628,.51,.06);
  const yellowButton = material(0xc9b46a,.48,.02);
  const orangeButton = material(0xd58044,.47,.03);
  const blueButton = material(0x377f9b,.48,.02);
  const membraneGreen = material(0x08776c,.61,.02);
  const pinkRim = material(0xc81c8d,.42,.1); pinkRim.emissive.set(0x7d0954);pinkRim.emissiveIntensity=.3;
  const cyanRing = material(0x0e9fbd,.35,.12);cyanRing.emissive.set(0x087b9b);cyanRing.emissiveIntensity=.38;

  function makePanel(spec, parent, draw) {
    const back=-spec.depth/2+.22,front=-.55, span=front-back;
    const panel = texture(4096,1024,(ctx,w,h)=>{
      const px=x=>(x+spec.width/2)/spec.width*w, py=z=>(z-back)/span*h;
      const text=(value,x,z,size=30,color='#b2b8bd',weight='400')=>{ctx.fillStyle=color;ctx.font=`${weight} ${size}px Arial,sans-serif`;ctx.fillText(value,px(x),py(z));};
      const line=(x1,z1,x2,z2,color='#737b83',thick=2)=>{ctx.strokeStyle=color;ctx.lineWidth=thick;ctx.beginPath();ctx.moveTo(px(x1),py(z1));ctx.lineTo(px(x2),py(z2));ctx.stroke();};
      const rect=(x,z,width,depth,color)=>{ctx.fillStyle=color;ctx.fillRect(px(x),py(z),width/spec.width*w,depth/span*h);};
      draw({ctx,w,h,px,py,text,line,rect,back,front});
    });
    decal(spec.width-.25,span,0,.247,(back+front)/2,panel,parent);
  }
  function smallButton(parent,x,z,mat=buttonGray,w=.22,d=.16,y=.30){return box(w,.065,d,mat,x,y,z,parent);}
  function slider(parent,x,z,length=.62,position=.5,mat=plastic){box(.045,.025,length,plastic,x,.29,z,parent);box(.17,.085,.13,mat,x,.34,z+(position-.5)*length,parent);}
  function wheel(parent,x,z,r=.24){const wheel=knob(r,.15,plastic,x,.37,z,parent);wheel.rotation.z=Math.PI/2;box(.065,.018,.08,chrome,x,.61,z,parent);return wheel;}
  function display(parent,x,z,w,d,draw,color='#90ac76'){
    bevelBox(w+.16,.085,d+.13,.035,plastic,x,.29,z,parent);
    const map=texture(1024,Math.round(1024*d/w),ctx=>{ctx.fillStyle=color;ctx.fillRect(0,0,1024,Math.round(1024*d/w));draw(ctx,1024,Math.round(1024*d/w));});
    decal(w,d,x,.339,z,map,parent,true);
  }
  function makeBoard(spec, boardIndex) {
    const board=new THREE.Group();board.position.fromArray(spec.position);board.rotation.y=spec.rotation;if(spec.tier)board.rotation.x=.065;rig.add(board);
    const width=spec.width,depth=spec.depth,half=width/2,model=spec.model,caseMat=model==='dx7'?darkBrown:satinBlack;
    bevelBox(width,.96,depth,.105,caseMat,0,-.30,0,board);
    bevelBox(width-.10,.18,depth-.13,.055,cheeks,0,-.82,0,board);
    const cheekMat=model==='jupiter8'?brushedSilver:caseMat;
    bevelBox(.28,1.16,depth+.03,.075,cheekMat,-half,-.19,0,board);bevelBox(.28,1.16,depth+.03,.075,cheekMat,half,-.19,0,board);
    // The backs have substance; the control decks and moulded key beds sit above it.
    box(width-.45,.37,.13,caseMat,0,.29,-depth/2+.04,board);
    const front=depth/2-.2;
    box(width-.33,.22,.12,plastic,0,-.1,front,board);
    if(model==='fantom'){
      const trim=material(0xa21d28,.34,.42);
      box(width-.30,.12,.09,trim,0,.22,-depth/2+.08,board);
      box(.07,.52,depth-.18,trim,-half+.10,-.08,0,board);box(.07,.52,depth-.18,trim,half-.10,-.08,0,board);
      const start=-6.1;
      const meterLED=material(0xb83313,.42,.02);meterLED.emissive.set(0x9c2109);meterLED.emissiveIntensity=.45;
      for(let i=0;i<8;i++){slider(board,start+i*.56,-1.23,.86,.18+(i%5)*.13);knob(.11,.19,plastic,start+i*.56,.36,-2.14,board);smallButton(board,start+i*.56,-2.5,i%3===0?orangeButton:plastic,.15,.12);}
      for(let col=0;col<8;col++)for(let row=0;row<5;row++)box(.035,.012,.055,meterLED,start+col*.56+.19,.311,-1.50+row*.13,board);
      slider(board,-7.1,-1.23,.86,.62);
      wheel(board,-half+1.1,-2.2,.27);wheel(board,-half+1.65,-2.2,.27);
      display(board,.05,-2.05,3.35,1.65,(ctx,w,h)=>{
        ctx.fillStyle='#101a28';ctx.fillRect(0,0,w,h);ctx.fillStyle='#edf5ff';ctx.font='bold 36px Arial';ctx.fillText('SCENE SELECT',28,48);ctx.font='bold 53px Arial';ctx.fillText('A001: Ac Piano + Pad',28,111);
        for(let row=0;row<2;row++)for(let col=0;col<4;col++){ctx.fillStyle=['#bf8841','#4d74ae','#816dc4','#568179'][col];ctx.fillRect(24+col*246,145+row*135,230,118);ctx.fillStyle='#eaf3ff';ctx.font='26px Arial';ctx.fillText(['Ac Piano','Warm Pad','Strings','Synth'][col],37+col*246,181+row*135);}
      },'#172231');
      for(let i=0;i<6;i++){knob(.115,.13,cyanRing,-1.31+i*.55,.35,-.86,board);knob(.079,.17,plastic,-1.31+i*.55,.39,-.86,board);}
      knob(.28,.12,plastic,2.35,.34,-2.52,board);
      for(let row=0;row<3;row++)for(let col=0;col<4;col++){const x=3.1+col*.48,z=-2.68+row*.57;knob(.105,.13,cyanRing,x,.33,z,board);knob(.074,.19,plastic,x,.39,z,board);}
      for(let row=0;row<4;row++)for(let col=0;col<4;col++){const x=6.02+col*.47,z=-2.95+row*.45;box(.38,.045,.35,pinkRim,x,.29,z,board);box(.29,.07,.26,plastic,x,.325,z,board);}
      for(let i=0;i<16;i++)smallButton(board,3.1+i*.39,-.71,i===0?cyanRing:buttonGray,.27,.17);
      makePanel(spec,board,({text,line})=>{text('Roland',-half+.6,-3.09,119,'#e4e9eb','700');text('FANTOM',-half+.57,-2.65,122,'#d6dce0','700');text('ZONE',-6.25,-2.99,30);text('SCENE SELECT',-1.6,-3.08,30);text('SYNTH CONTROL',3.1,-3.14,26);text('SAMPLER',6.03,-3.14,26);line(-7.55,-3.1,-7.55,-.64);for(let i=0;i<8;i++)text(String(i+1),start+i*.56-.04,-2.74,21);text('FANTOM 8',half-3.0,-3.09,62,'#b5bbc1','700');});
    }else if(model==='d50'){
      display(board,-1.25,-1.72,3.15,.40,(ctx,w,h)=>{ctx.fillStyle='#36432d';ctx.font='bold 35px monospace';ctx.fillText('I-11  FANTASIA',18,43);ctx.font='27px monospace';ctx.fillText('UPPER:Fantasia  LOWER:Warm Pad',18,87);},'#b6c58f');
      bevelBox(.9,.07,.72,.035,plastic,-4.65,.27,-1.83,board);knob(.24,.07,plastic,-4.65,.33,-1.83,board);const stick=knob(.055,.34,chrome,-4.65,.51,-1.83,board);stick.rotation.x=.18;knob(.105,.10,plastic,-4.65,.69,-1.79,board);
      for(let col=0;col<11;col++)smallButton(board,-3.68+col*.47,-.93,buttonGray,.31,.14);
      for(let row=0;row<3;row++)for(let col=0;col<3;col++)smallButton(board,1.0+col*.46,-2.24+row*.43,buttonGray,.27,.13);
      for(let row=0;row<4;row++)smallButton(board,-3.8,-2.22+row*.33,buttonGray,.24,.13);
      makePanel(spec,board,({ctx,px,py,text,line,rect})=>{
        text('Roland',-half+.4,-2.44,57,'#c3d5df','700');text('D-50',-half+.4,-1.97,163,'#a1bdce','700');text('LINEAR SYNTHESIZER',-half+2.3,-1.96,35,'#b9cbd6');
        text('JOYSTICK',-5.05,-2.37,22);text('TONE BALANCE',-2.75,-2.24,22);text('PATCH BANK',-.2,-1.12,20);
        // The original's white synthesis diagrams are printed across its right third.
        for(let row=0;row<2;row++)for(let col=0;col<4;col++){
          const x=3.0+col*1.18,z=-2.35+row*.77;rect(x,z,1.02,.32,'#1b2024');line(x,z,x+1.02,z);line(x,z,x,z+.32);line(x+1.02,z,x+1.02,z+.32);line(x,z+.32,x+1.02,z+.32);text(['WG','TVF','TVA','OUT'][col],x+.11,z+.23,20);if(col<3)line(x+1.03,z+.15,x+1.15,z+.15);
        }
        for(let i=0;i<3;i++){const x=3+i*1.55,z=-.82;line(x,z,x+.2,z-.3);line(x+.2,z-.3,x+.6,z-.16);line(x+.6,z-.16,x+.94,z-.18);line(x+.94,z-.18,x+1.3,z);text('ENV',x+.4,z+.09,18);}
      });
    }else if(model==='jupiter8'){
      const cols=[-7.2,-5.8,-4.6,-3.2,-1.7,-.3,1.2,2.5,3.8,5.2];
      for(let group=0;group<cols.length;group++){const x=cols[group];box(group<2?1.1:1.25,.018,.22,orangePaint,x,.265,-2.85,board);for(let j=0;j<(group<3?2:3);j++)slider(board,x-.3+j*.29,-2.06,.70,.2+(group+j)%5*.14,plastic);if(group%2===0)knob(.09,.16,plastic,x,.34,-3.21,board);}
      display(board,.4,-.99,1.55,.40,(ctx,w,h)=>{ctx.fillStyle='#170b0b';ctx.fillRect(0,0,w,h);ctx.fillStyle='#f3492e';ctx.font='bold 105px monospace';ctx.fillText('88 88',26,130);},'#160b0b');
      const colors=[orangeButton,yellowButton,yellowButton,ivory,tealSwitch,blueButton];
      for(let i=0;i<29;i++){if(i>=13&&i<=16)continue;smallButton(board,-7.2+i*.52,-.96,colors[Math.floor(i/5)%6],.34,.30);}
      for(let i=0;i<4;i++){slider(board,-half+.56+i*.32,1.03,.88,.25+i*.16);knob(.08,.15,plastic,-half+.56+i*.32,.33,.33,board);}
      makePanel(spec,board,({text,line})=>{text('Roland',-half+.5,-3.48,67,'#c5c7c8','700');text('JUPITER-8',half-5.0,-3.42,150,'#c9ced1','700');text('8 VOICE POLYPHONIC SYNTHESIZER',half-5.0,-3.09,29);['LFO','VCO MODULATOR','VCO-1','VCO-2','MIXER','HPF','VCF','VCA','ENV-1','ENV-2'].forEach((name,i)=>text(name,cols[i]-.5,-2.69,23,'#151a1d','700'));for(let i=0;i<10;i++){text('0   5   10',cols[i]-.35,-1.45,16);if(i<9)line(cols[i]+.7,-2.64,cols[i]+.7,-1.35,'#73787b',1);}text('PATCH NUMBER',-.43,-1.27,23);});
    }else{
      // The 1983 DX7 uses flush membrane switches rather than a field of knobs.
      display(board,-3.14,-1.43,1.45,.40,(ctx,w,h)=>{ctx.fillStyle='#283923';ctx.font='bold 64px monospace';ctx.fillText('INT 1',35,80);ctx.font='42px monospace';ctx.fillText('E.PIANO 1',35,156);},'#8a9c62');
      for(let row=0;row<2;row++)for(let col=0;col<16;col++)smallButton(board,-1.30+col*.46,-1.78+row*.44,membraneGreen,.35,.18,.29);
      for(let row=0;row<2;row++)for(let col=0;col<4;col++)smallButton(board,-5.62+col*.46,-1.78+row*.44,col===0?orangeButton:membraneGreen,.32,.18,.29);
      slider(board,-6.9,-1.52,.82,.62);slider(board,-6.4,-1.52,.82,.47);
      makePanel(spec,board,({text,line,rect})=>{text('YAMAHA',-half+.43,-2.4,53,'#c9c7be','700');text('DX7',-half+1.87,-2.35,132,'#c6c5bd');text('DIGITAL PROGRAMMABLE ALGORITHM SYNTHESIZER',-half+3.4,-2.36,19,'#b7b6a9');
        for(let i=0;i<32;i++){const x=-1.35+i*.252;for(let j=0;j<3;j++){rect(x+(j%2)*.05,-2.54+j*.14,.12,.09,'#a5a698');if(j<2)line(x+.06,-2.43+j*.14,x+.09,-2.41+j*.14,'#96998a',1);}text(String(i+1),x,-2.02,11,'#c1c6b5');}
        for(let i=0;i<16;i++)text(String(i+1),-1.32+i*.46,-1.92,16,'#d7debf');text('MEMORY SELECT',-5.7,-2.00,20);text('OPERATOR / FUNCTION',-1.3,-.88,21);});
    }
    const whites=Array.from({length:spec.count},(_,i)=>spec.first+i).filter(midi=>!keyIsBlack(midi)).length;
    const keyWidth=spec.keyWidth,startX=-whites*keyWidth/2+spec.keyOffset;
    box(whites*keyWidth+.22,.16,3.43,plastic,spec.keyOffset,-.08,1.08,board);
    const bendX=startX-1.04;
    if(model==='dx7'){wheel(board,bendX-.25,1.10,.27);wheel(board,bendX+.2,1.10,.27);}
    else{box(.72,.07,.46,plastic,bendX,.20,1.86,board);box(.12,.26,.15,chrome,bendX,.35,1.86,board);box(.37,.12,.18,plastic,bendX,.50,1.86,board);}
    if(model==='d50'){slider(board,bendX-.28,.65,.65,.5);slider(board,bendX+.14,.65,.65,.7);}
    let whiteIndex=0;
    for(let midi=spec.first;midi<spec.first+spec.count;midi++){
      const isBlack=keyIsBlack(midi),x=startX+(isBlack?whiteIndex-.5:whiteIndex)*keyWidth;
      const pivot=new THREE.Group();pivot.position.set(x,isBlack?.355:.19,-.57);board.add(pivot);
      const mesh=isBlack?box(keyWidth*.575,.25,1.89,black,0,.09,.97,pivot):box(keyWidth-.014,.205,3.27,[ivorySide,ivorySide,ivory,ivorySide,ivory,ivorySide],0,.01,1.65,pivot);
      const cap=isBlack?box(keyWidth*.5,.024,1.83,black,0,.224,.98,pivot):box(keyWidth-.025,.03,.08,ivory,0,-.032,3.31,pivot);
      if(!isBlack)whiteIndex++;mesh.userData.keyIndex=keys.length;
      keys.push({pivot,mesh,cap,board,instrumentIndex:keySpecs.indexOf(spec),midi,isBlack,rest:mesh.material,capRest:cap.material,angle:0,front:new THREE.Vector3(0,.38,isBlack?1.5:2.65)});targets.push(mesh);
    }
    return board;
  }
  keySpecs.filter(spec=>spec.kind==='synth').forEach(makeBoard);
  makeHammond(); makeKeytar();
  const loadingKeys=inLoadingOrder(keys);loadingKeys.forEach((key,index)=>{key.loadingPosition=index;key.hasPlayed=false;});

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
      keys.push({ pivot, mesh, cap, board: parent, instrumentIndex: keySpecs.indexOf(spec), midi, isBlack, rest: mesh.material, capRest: cap.material, angle: 0, front: new THREE.Vector3(0, .36, isBlack ? length * .49 : length * .87) });
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

    const leslie = new THREE.Group(); leslie.position.set(-29.9, -.3582, 16.0); leslie.rotation.y = .90; leslie.scale.y = 1.16; rig.add(leslie); leslieCabinet=leslie;
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
    const instrument=new THREE.Group();instrument.position.set(26.0,1.1,-8.0);const yaw=-.0545;
    instrument.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2));rig.add(instrument);
    // Black-sparkle AX-Synth: smooth convex belly, scalloped shoulder cut-out,
    // and its long rounded control neck, with no AX-Edge blade or angular trim.
    const sparkleMap=texture(1024,1024,(ctx,w,h)=>{ctx.fillStyle='#24272c';ctx.fillRect(0,0,w,h);let seed=12345;for(let i=0;i<26000;i++){seed=(seed*16807)%2147483647;const x=seed%w;seed=(seed*16807)%2147483647;const y=seed%h;ctx.fillStyle=i%7===0?'rgba(210,220,235,.15)':'rgba(110,125,145,.08)';ctx.fillRect(x,y,i%11===0?1.6:.7,.7);}});
    const blackSparkle=own(new THREE.MeshPhysicalMaterial({map:sparkleMap,color:0x777c86,roughness:.22,metalness:.38,clearcoat:.9,clearcoatRoughness:.15}));
    const shape=new THREE.Shape();shape.moveTo(-6.9,1.53);shape.bezierCurveTo(-6.96,.65,-6.35,-1.54,-5.95,-1.78);shape.bezierCurveTo(-5.78,-1.93,-5.5,-1.97,-5.2,-1.97);shape.lineTo(10.05,-1.97);shape.bezierCurveTo(10.7,-1.97,10.83,-1.72,10.34,-1.32);shape.bezierCurveTo(9.82,-.88,7.75,-.68,6.56,-.54);shape.bezierCurveTo(5.86,-.43,5.25,.10,5.39,.70);shape.bezierCurveTo(5.56,1.39,6.52,1.78,6.66,2.03);shape.bezierCurveTo(6.68,2.28,5.85,2.6,5.22,2.7);shape.bezierCurveTo(1.7,3.08,-3.8,2.72,-6.47,1.96);shape.bezierCurveTo(-6.82,1.86,-6.93,1.79,-6.9,1.53);shape.closePath();
    const geometry=own(new THREE.ExtrudeGeometry(shape,{depth:.48,bevelEnabled:true,bevelSize:.14,bevelThickness:.14,bevelSegments:6,steps:1,curveSegments:32}));geometry.rotateX(Math.PI/2);geometry.translate(0,.40,0);
    const body=new THREE.Mesh(geometry,blackSparkle);body.castShadow=true;body.receiveShadow=true;instrument.add(body);
    box(11.2,.09,2.6,plastic,-.22,.49,-.13,instrument);manual(instrument,keySpecs[6],.57,-1.48,.37,2.5,-.25);
    // Long rubber ribbon and modulation bar, plus a D-Beam pair on the neck.
    bevelBox(2.25,.12,.41,.07,plastic,7.3,.55,-1.19,instrument);bevelBox(2.2,.09,.20,.04,graphite,7.3,.63,-1.19,instrument);
    for(let i=0;i<2;i++)knob(.075,.04,black,6.0+i*.22,.59,-.83,instrument);
    for(let i=0;i<3;i++)smallButton(instrument,9.0+i*.34,-1.41,plastic,.18,.14,.56);
    const brand=texture(1536,384,ctx=>{ctx.fillStyle='#eceff2';ctx.font='italic bold 245px Arial,sans-serif';ctx.fillText('AX-Synth',20,234);ctx.font='bold 111px Arial,sans-serif';ctx.fillText('Roland',675,363);});
    decal(4.9,1.02,-4.0,.575,1.70,brand,instrument);
    for(let i=0;i<9;i++){smallButton(instrument,-1.72+i*.49,1.40,i===4?blueButton:plastic,.25,.19,.575);}
    for(let i=0;i<3;i++)smallButton(instrument,4.22,1.15+i*.34,plastic,.20,.13,.575);
    display(instrument,3.21,1.80,1.08,.56,(ctx,w,h)=>{ctx.fillStyle='#090d11';ctx.fillRect(0,0,w,h);ctx.fillStyle='#f23932';ctx.font='bold 150px monospace';ctx.fillText('086',25,160);},'#080c10');
    // Above helper's fixed screen height is lifted to the actual keytar face.
    const lastScreen=instrument.children[instrument.children.length-1];lastScreen.position.y=.59;
    const labels=texture(2048,256,ctx=>{ctx.fillStyle='#a0a9b8';ctx.font='28px Arial';['PIANO','E.PIANO','CLAV','ORGAN','GUITAR','BASS','SYNTH','PAD','FX'].forEach((v,i)=>ctx.fillText(v,45+i*205,74));ctx.fillStyle='#739ac7';ctx.font='24px Arial';ctx.fillText('PROFESSIONAL SHOULDER SYNTHESIZER',30,210);});
    decal(5.2,.72,.50,.58,1.93,labels,instrument);
    for(const x of [-6.35,5.55])knob(.055,.025,chrome,x,.59,1.72,instrument);
    const sx=26.0,sz=-8.0;beam([sx-.4,-5.52,sz-.24],[sx-.4,4.6,sz-.24],.13,cheeks);beam([sx-2.2,-5.52,sz-1.2],[sx+2.2,-5.52,sz+1.2],.15,cheeks);beam([sx-1.5,-5.52,sz+1.8],[sx+1.5,-5.52,sz-1.8],.15,cheeks);beam([sx-.8,-4.55,sz+1.35],[sx+.85,-4.55,sz-1.38],.14,plastic);
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
    beam([13.5, -5.4, z], [13.5, .52, z], .15, cheeks);
    beam([10.5, -5.4, z], [16.0, -5.4, z], .16, cheeks);
    beam([9.9, .53, z], [16.0, .53, z], .12);
  }
  beam([13.5, -4.5, -1.4], [13.5, .5, 12.7], .12);
  beam([13.5, .5, -1.4], [13.5, -4.5, 12.7], .12);

  for (const z of [.0, 11.6]) {
    beam([21.3, -5.4, z], [21.3, 3.7, z], .14);
    beam([18.3, 3.63, z], [24.0, 3.63, z], .13);
    beam([18.3, -5.4, z], [22.4, -5.4, z], .17, cheeks);
    beam([12.1, -.5, z], [21.3, 2.8, z], .12, cheeks);
  }
  beam([21.3, -4.6, .0], [21.3, 2.3, 11.6], .12, cheeks);
  function makeMacBook(){
    const laptop=new THREE.Group();laptop.position.set(0,4.494,0);laptop.scale.set(.65,.65/1.16,.65);leslieCabinet.add(laptop);
    const aluminum=own(new THREE.MeshPhysicalMaterial({color:0x9a9fa5,roughness:.32,metalness:.88,clearcoat:.2,clearcoatRoughness:.35}));
    const darkAluminum=material(0x373d45,.4,.75),rubber=material(0x0c1014,.75,.02);
    bevelBox(8.0,.19,5.15,.08,aluminum,0,.02,0,laptop);bevelBox(7.92,.055,5.08,.025,darkAluminum,0,-.095,0,laptop);
    // A broad black key well, individually sculpted chiclet keys, large trackpad,
    // perforated speaker strips and the full-width hinge establish the MacBook.
    bevelBox(6.6,.025,2.35,.035,rubber,0,.129,-.79,laptop);
    for(let row=0;row<6;row++)for(let col=0;col<14;col++){if(row===5&&col>3&&col<9)continue;const w=row===0?.36:.40;bevelBox(w,.055,row===0?.17:.28,.025,plastic,-2.92+col*.45,.174,-1.77+row*.34,laptop);}
    bevelBox(2.45,.055,.28,.025,plastic,-.2,.174,-.07,laptop);
    bevelBox(3.05,.012,1.57,.04,darkAluminum,0,.132,1.30,laptop);bevelBox(2.98,.013,1.50,.04,aluminum,0,.14,1.30,laptop);
    for(const side of [-1,1])for(let row=0;row<15;row++)for(let col=0;col<3;col++)box(.021,.005,.055,rubber,side*(3.48+col*.085),.137,-1.8+row*.133,laptop);
    bevelBox(6.93,.20,.28,.06,darkAluminum,0,.11,-2.35,laptop);
    const lid=new THREE.Group();lid.position.set(0,.16,-2.35);lid.rotation.x=-.23;laptop.add(lid);
    bevelBox(8.0,5.02,.12,.10,aluminum,0,2.42,0,lid);bevelBox(7.76,4.80,.035,.07,rubber,0,2.42,.079,lid);
    const screenMap=texture(4096,2560,(ctx,w,h)=>{
      ctx.fillStyle='#171b1e';ctx.fillRect(0,0,w,h);
      // macOS / Logic transport, recognizable time display, arrangement and mixer.
      ctx.fillStyle='#252b30';ctx.fillRect(0,0,w,92);ctx.fillStyle='#d4d9de';ctx.font='bold 38px Arial';ctx.fillText('Logic Pro',52,61);ctx.font='29px Arial';ctx.fillText('File   Edit   Track   Navigate   Record   Mix   View   Window   Help',245,60);ctx.fillText('TJ VIOLA — STUDIO SESSION',1560,60);
      ctx.fillStyle='#393f45';ctx.fillRect(0,92,w,195);ctx.fillStyle='#151c20';ctx.fillRect(1320,114,1470,142);ctx.fillStyle='#b1d1ce';ctx.font='bold 72px monospace';ctx.fillText('01  01  001  001',1380,205);ctx.font='38px Arial';ctx.fillText('120.000     4/4     C maj',2120,205);
      ctx.fillStyle='#5ba95b';ctx.beginPath();ctx.moveTo(1110,140);ctx.lineTo(1110,226);ctx.lineTo(1181,183);ctx.closePath();ctx.fill();ctx.fillStyle='#bbc3ca';ctx.fillRect(987,153,58,59);ctx.fillStyle='#df575c';ctx.beginPath();ctx.arc(1250,183,33,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#282e32';ctx.fillRect(0,288,435,h-288);ctx.fillStyle='#3e464d';ctx.fillRect(0,288,435,72);ctx.fillStyle='#d4dade';ctx.font='bold 30px Arial';ctx.fillText('Library',28,337);ctx.font='27px Arial';['Grand Piano','Vintage Electric Piano','Studio Strings','Analog Synth','Horn Section','Drum Kit','Vocal Chain','User Patches'].forEach((name,i)=>{ctx.fillStyle=i===0?'#628da1':'#b8c1c7';if(i===0){ctx.fillRect(12,383+i*82,410,62);ctx.fillStyle='#edf4f7';}ctx.fillText(name,30,425+i*82);});
      const headers=435,headerW=690,gridX=headers+headerW,gridW=w-gridX;ctx.fillStyle='#30373c';ctx.fillRect(headers,288,w-headers,95);ctx.fillStyle='#aeb9bf';ctx.font='30px Arial';ctx.fillText('Tracks',headers+25,350);ctx.font='24px Arial';for(let bar=0;bar<17;bar++)ctx.fillText(String(1+bar*2),gridX+bar*gridW/16+8,350);
      const tracks=[['Grand Piano','#69a547','MIDI'],['Analog Pad','#4f9546','MIDI'],['French Horn','#428dc4','AUDIO'],['Drums','#438ac0','AUDIO'],['Bass','#6da448','MIDI'],['Lead Vocal','#4386b8','AUDIO'],['Keys Stack','#5f9f43','MIDI']];
      const rowH=196,startY=384;
      tracks.forEach(([name,color,kind],index)=>{const y=startY+index*rowH;ctx.fillStyle=index%2?'#262d32':'#2b3237';ctx.fillRect(headers,y,w-headers,rowH-2);ctx.fillStyle='#171d21';ctx.fillRect(headers+22,y+26,74,74);ctx.fillStyle=color;ctx.fillRect(headers+32,y+39,54,46);ctx.fillStyle='#e0e6ea';ctx.font='bold 34px Arial';ctx.fillText(name,headers+118,y+59);ctx.font='24px Arial';ctx.fillStyle='#9caab4';ctx.fillText(index===0?'FANTOM 8':index===1?'D-50':index===4?'JUPITER-8':index===6?'DX7':'Audio '+(index+1),headers+118,y+100);ctx.fillStyle='#53606a';ctx.fillRect(headers+118,y+130,208,12);ctx.fillStyle='#d6e0e6';ctx.fillRect(headers+208,y+123,20,26);ctx.font='bold 26px Arial';ctx.fillText('M    S    R',headers+406,y+66);ctx.fillStyle=index===5?'#bd4d4d':'#7b8a91';ctx.fillRect(headers+516,y+37,39,39);
        for(let bar=0;bar<16;bar++){ctx.fillStyle='#3a434a';ctx.fillRect(gridX+bar*gridW/16,y,2,rowH);}
        const regions=index===3?4:index===5?2:3;for(let r=0;r<regions;r++){const x=gridX+22+r*(gridW-44)/regions+((index%2)*15),rw=(gridW-44)/regions-17;ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y+22,rw,rowH-43,9);ctx.fill();ctx.fillStyle='rgba(245,255,245,.80)';ctx.font='24px Arial';ctx.fillText(name+' '+(r+1),x+15,y+56);
          if(kind==='MIDI'){for(let n=0;n<14;n++){const nx=x+15+n*(rw-38)/14,ny=y+83+(n*17+index*11)%71;ctx.fillStyle='rgba(23,61,25,.7)';ctx.fillRect(nx,ny,Math.max(18,(rw-50)/17),5);}}
          else{ctx.strokeStyle='rgba(17,56,91,.8)';ctx.lineWidth=2;ctx.beginPath();const mid=y+112;for(let xx=0;xx<rw-20;xx+=3){const amplitude=14+19*Math.sin(xx*.021+index);const yy=mid+Math.sin(xx*.43+index)*amplitude;xx?ctx.lineTo(x+10+xx,yy):ctx.moveTo(x+10+xx,yy);}ctx.stroke();}
        }
      });
      // A bright playhead and compact channel strips complete the active session.
      ctx.fillStyle='#e7d58c';ctx.fillRect(gridX+gridW*.27,startY,4,rowH*7);ctx.beginPath();ctx.moveTo(gridX+gridW*.27-13,365);ctx.lineTo(gridX+gridW*.27+17,365);ctx.lineTo(gridX+gridW*.27+2,383);ctx.closePath();ctx.fill();
      const mixerY=1800;ctx.fillStyle='#20272c';ctx.fillRect(headers,mixerY,w-headers,h-mixerY);ctx.fillStyle='#49545d';ctx.fillRect(headers,mixerY,w-headers,3);
      for(let channel=0;channel<10;channel++){const x=headers+channel*(w-headers)/10,cw=(w-headers)/10;ctx.fillStyle=channel%2?'#262e34':'#2b3339';ctx.fillRect(x+2,mixerY+4,cw-4,h-mixerY-5);ctx.fillStyle='#68a3b3';ctx.font='25px Arial';ctx.fillText(channel<7?tracks[channel][0]:channel===9?'Stereo Out':'Aux '+(channel-6),x+12,mixerY+48);for(let slot=0;slot<3;slot++){ctx.fillStyle=slot===0?'#326b7d':'#344d5e';ctx.fillRect(x+18,mixerY+83+slot*48,cw-36,35);ctx.fillStyle='#c6d3da';ctx.font='22px Arial';ctx.fillText(['Channel EQ','Compressor','Space D'][slot],x+26,mixerY+108+slot*48);}ctx.fillStyle='#101619';ctx.fillRect(x+cw*.43,mixerY+289,12,300);ctx.fillStyle='#c9d2d9';ctx.fillRect(x+cw*.43-17,mixerY+400+(channel%3)*32,46,38);for(let segment=0;segment<14;segment++){ctx.fillStyle=segment>11?'#b7b942':'#3fbe60';ctx.fillRect(x+cw*.68,mixerY+600-segment*22,19,17);}ctx.fillStyle='#b2bcc3';ctx.font='23px Arial';ctx.fillText('-6.0',x+cw*.35,mixerY+655);}
      ctx.fillStyle='#151b20';ctx.fillRect(0,h-54,w,54);ctx.fillStyle='#a8b6bf';ctx.font='24px Arial';ctx.fillText('442 notes • Studio Session • 48 kHz / 24-bit',34,h-18);
    });
    const screen=new THREE.Mesh(own(new THREE.PlaneGeometry(7.48,4.56)),own(new THREE.MeshBasicMaterial({map:screenMap,color:new THREE.Color(1.45,1.45,1.45),toneMapped:false})));screen.position.set(0,2.45,.103);screen.userData.pulseScreen=true;lid.add(screen);
    const screenGlowMap=texture(1024,640,ctx=>{ctx.clearRect(0,0,1024,640);ctx.shadowColor='rgba(80,175,235,.85)';ctx.shadowBlur=24;ctx.strokeStyle='rgba(115,210,255,.55)';ctx.lineWidth=5;ctx.beginPath();ctx.roundRect(24,24,976,592,16);ctx.stroke();});
    const screenGlow=new THREE.Mesh(own(new THREE.PlaneGeometry(7.82,4.86)),own(new THREE.MeshBasicMaterial({map:screenGlowMap,color:0x98deff,transparent:true,opacity:.42,blending:THREE.AdditiveBlending,depthWrite:false,depthTest:false,toneMapped:false})));screenGlow.position.set(0,2.45,.102);screenGlow.renderOrder=3;lid.add(screenGlow);
    const screenSpill=new THREE.PointLight(0x8ccfff,1.15,3.6,2);screenSpill.position.set(0,1.6,.65);screenSpill.userData.pulseScreen=true;lid.add(screenSpill);

    bevelBox(.67,.19,.033,.05,rubber,0,4.66,.139,lid);knob(.022,.02,chrome,0,4.68,.163,lid);
    // Its rubber underside rests directly on the Leslie's lacquered top;
    // the cabinet's yaw is inherited, with no separate laptop stand.
    for(const x of [-3.1,3.1])for(const z of [-1.8,1.8])box(.25,.025,.18,rubber,x,-.13,z,laptop);
  }
  makeMacBook();

  // Resting keys share draw submissions. The active original mesh is revealed
  // separately, retaining its own hinge, normal key geometry and single glow.
  rig.updateMatrixWorld(true);
  const rigInverse=new THREE.Matrix4().copy(rig.matrixWorld).invert();
  const matrixFor=mesh=>new THREE.Matrix4().multiplyMatrices(rigInverse,mesh.matrixWorld);
  const materialId=mat=>Array.isArray(mat)?mat.map(x=>x.uuid).join(':'):mat.uuid;
  const zeroMatrix=new THREE.Matrix4().makeScale(0,0,0);
  const keyParts=new Set(keys.flatMap(key=>[key.mesh,key.cap]));
  function batchMeshes(meshes,keyBatch=false){
    const groups=new Map();for(const mesh of meshes){const id=mesh.geometry.uuid+'/'+materialId(mesh.material);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(mesh);}
    for(const list of groups.values()){
      if(!keyBatch&&list.length<4)continue;
      const batch=own(new THREE.InstancedMesh(list[0].geometry,list[0].material,list.length));batch.userData.keyRestBatch=keyBatch;batch.castShadow=true;batch.receiveShadow=true;batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);batch.frustumCulled=false;
      list.forEach((mesh,i)=>{const matrix=matrixFor(mesh);batch.setMatrixAt(i,matrix);mesh.userData.restBatch={batch,index:i,matrix};if(keyBatch){const color=mesh.material===black?new THREE.Color().setRGB(10,7,4.5):new THREE.Color().setRGB(.40,.40,.40);batch.setColorAt(i,color);}mesh.visible=false;});batch.instanceMatrix.needsUpdate=true;if(batch.instanceColor)batch.instanceColor.needsUpdate=true;rig.add(batch);
    }
  }
  batchMeshes([...keyParts],true);
  const staticMeshes=[];rig.traverse(mesh=>{if(mesh.isMesh&&!mesh.isInstancedMesh&&!keyParts.has(mesh)&&mesh.visible)staticMeshes.push(mesh);});batchMeshes(staticMeshes);
  function setKeyVisible(key,active){
    if(!key)return;
    for(const mesh of [key.mesh,key.cap]){const part=mesh.userData.restBatch;if(part){part.batch.setMatrixAt(part.index,active?zeroMatrix:part.matrix);part.batch.instanceMatrix.needsUpdate=true;}mesh.visible=active;}
    key.pivot.rotation.x=active?(key.isBlack?.055:.038):0;key.angle=key.pivot.rotation.x;
    key.mesh.material=active?(key.isBlack?activeBlack:activeWhite):key.rest;key.cap.material=active?(key.isBlack?activeBlack:activeWhite):key.capRest;
  }
  const restColor=new THREE.Color();
  function setRestFinish(key,played){if(key.hasPlayed===played)return;key.hasPlayed=played;if(played)restColor.setRGB(1,1,1);else if(key.isBlack)restColor.setRGB(10,7,4.5);else restColor.setRGB(.40,.40,.40);for(const mesh of [key.mesh,key.cap]){const part=mesh.userData.restBatch;if(part){part.batch.setColorAt(part.index,restColor);part.batch.instanceColor.needsUpdate=true;}}}
  let finishIndex=-1;
  function setPassedPrefix(index){
    if(index>finishIndex){for(let i=Math.max(0,finishIndex);i<index;i++)setRestFinish(loadingKeys[i],true);}
    else if(index<finishIndex){for(let i=index;i<=finishIndex;i++)if(loadingKeys[i])setRestFinish(loadingKeys[i],false);}
    finishIndex=index;
  }
  function resetFinishes(){keys.forEach(key=>setRestFinish(key,false));finishIndex=-1;}
  let activeVisualKey=null;
  function activateKey(key){if(key===activeVisualKey)return;setKeyVisible(activeVisualKey,false);activeVisualKey=key||null;setKeyVisible(activeVisualKey,true);container.dataset.activeInstrument=key?keySpecs[key.instrumentIndex].name:'';container.dataset.activeMidi=key?String(key.midi):'';container.dataset.activeKeyCount=key?'1':'0';}

  const floor = new THREE.Mesh(own(new THREE.PlaneGeometry(78, 60)), own(new THREE.ShadowMaterial({ color: 0x00030e, opacity: .2 })));
  floor.rotation.x = -Math.PI / 2; floor.position.set(-1, -5.7, 6); floor.receiveShadow = true; scene.add(floor);
  // A real woven stage surface, kept on the floor independently of the rig's
  // tiny presentation drift. The center medallion sits in the player's opening.
  const rugGroup=new THREE.Group();rugGroup.position.set(-3.5,-5.64,7.5);scene.add(rugGroup);
  const rugWidth=64,rugDepth=36;
  const rugFallback=texture(1536,1024,(ctx,w,h)=>{
    ctx.fillStyle='#9bcbd5';ctx.fillRect(0,0,w,h);
    for(let i=0;i<7;i++){ctx.strokeStyle=i%2?'#c5dfe1':'#235d79';ctx.lineWidth=8;ctx.strokeRect(12+i*14,12+i*14,w-24-i*28,h-24-i*28);}
    for(let y=144;y<h-144;y+=62)for(let x=144;x<w-144;x+=62){ctx.save();ctx.translate(x,y);ctx.fillStyle=(x+y)%124?'#4a9ba9':'#cee3df';for(let petal=0;petal<8;petal++){ctx.rotate(Math.PI/4);ctx.beginPath();ctx.ellipse(0,10,3,10,0,0,Math.PI*2);ctx.fill();}ctx.restore();}
    ctx.save();ctx.translate(w/2,h/2);for(let ring=5;ring>0;ring--){ctx.beginPath();for(let i=0;i<16;i++){const a=i*Math.PI/8,r=(i%2?ring*24:ring*37);const x=Math.cos(a)*r,y=Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fillStyle=ring%2?'#246985':'#d4e7e4';ctx.fill();}ctx.restore();
  });
  const weave=texture(256,256,(ctx,w,h)=>{ctx.fillStyle='#8b8b8b';ctx.fillRect(0,0,w,h);for(let i=0;i<w;i+=4){ctx.fillStyle=i%8?'#a8a8a8':'#626262';ctx.fillRect(i,0,1,h);ctx.fillStyle=i%8?'#9b9b9b':'#757575';ctx.fillRect(0,i,w,1);}});weave.wrapS=weave.wrapT=THREE.RepeatWrapping;weave.repeat.set(65,39);
  const rugMaterial=own(new THREE.MeshPhysicalMaterial({map:rugFallback,color:0xffffff,roughness:.97,metalness:0,bumpMap:weave,bumpScale:.012,sheen:.45,sheenColor:new THREE.Color(0x7fb3c2),sheenRoughness:.95}));
  const rugBase=box(rugWidth,.05,rugDepth,material(0x296276,.95,0),0,-.025,0,rugGroup);rugBase.castShadow=false;rugBase.receiveShadow=true;
  const rugSurface=new THREE.Mesh(own(new THREE.PlaneGeometry(rugWidth,rugDepth)),rugMaterial);rugSurface.rotation.x=-Math.PI/2;rugSurface.position.y=.003;rugSurface.receiveShadow=true;rugSurface.castShadow=false;rugGroup.add(rugSurface);
  // Fine pale-blue fringe strands at the two short ends, in one draw call.
  const fringeGeometry=own(new THREE.CylinderGeometry(.012,.012,.46,5));const fringeMaterial=material(0xa5cdd1,.98,0);const fringes=own(new THREE.InstancedMesh(fringeGeometry,fringeMaterial,320));const fringeMatrix=new THREE.Matrix4(),fringeQuaternion=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2),fringePosition=new THREE.Vector3();
  for(let side=0;side<2;side++)for(let i=0;i<160;i++){fringePosition.set((side?1:-1)*(rugWidth/2+.20),-.012,-rugDepth/2+.12+i*(rugDepth-.24)/159);fringeMatrix.compose(fringePosition,fringeQuaternion,new THREE.Vector3(1,1,1));fringes.setMatrixAt(side*160+i,fringeMatrix);}fringes.instanceMatrix.needsUpdate=true;fringes.receiveShadow=true;fringes.frustumCulled=false;rugGroup.add(fringes);
  let rugTextureSettled=false;
  new THREE.TextureLoader().load('./assets/studio-rug.png',map=>{if(disposed){map.dispose();return;}own(map);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),16);rugMaterial.map=map;rugMaterial.needsUpdate=true;rugTextureSettled=true;container.dataset.rugReady='true';},undefined,()=>{rugTextureSettled=true;container.dataset.rugReady='fallback';});
  rugGroup.updateMatrixWorld(true);
  let visible = true;
  const visibilityObserver = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; }, { rootMargin: '100px' });
  visibilityObserver.observe(container);
  rig.updateMatrixWorld(true);
  const corner = new THREE.Vector3();
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  // Fit the L itself, rather than the empty corners of its world-space bounding box.
  const fitGroup=group=>group.traverse(object => {
    if (!object.isMesh || !object.geometry) return;
    object.geometry.computeBoundingBox();
    const bounds = object.geometry.boundingBox;
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      corner.set(x, y, z).applyMatrix4(object.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
      minX = Math.min(minX, corner.x); maxX = Math.max(maxX, corner.x);
      minY = Math.min(minY, corner.y); maxY = Math.max(maxY, corner.y);
    }
  });
  fitGroup(rig);fitGroup(rugGroup);
  let qualityReady=false;
  const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2;
  function resize() {
    if (disposed) return;
    const width = Math.max(1, container.clientWidth), height = Math.max(1, container.clientHeight || 380), aspect = width / height;
    const small=width<700||matchMedia('(pointer: coarse)').matches;
    const targetDensity=small?Math.min(2,window.devicePixelRatio||2):Math.min(4.5,3840/width,2160/height);
    const density=qualityReady?targetDensity:Math.min(1.3,targetDensity);
    renderer.setPixelRatio(Math.max(1,density));
    renderer.setSize(width, height, false);
    container.dataset.renderWidth=String(renderer.domElement.width);container.dataset.renderHeight=String(renderer.domElement.height);
    const worldHeight = Math.max((maxY - minY) * 1.075, (maxX - minX) * 1.075 / aspect);
    const worldWidth = worldHeight * aspect;
    camera.left = centerX - worldWidth / 2; camera.right = centerX + worldWidth / 2;
    camera.top = centerY + worldHeight / 2; camera.bottom = centerY - worldHeight / 2;
    camera.updateProjectionMatrix();
  }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(container); resize();

  // Completion is one synchronized optical pulse on the instruments only.
  // The rug and floor live outside rig, so their materials never receive it.
  const completionGroup=new THREE.Group();completionGroup.name='completion-neon-pulse';completionGroup.visible=false;rig.add(completionGroup);
  const completionEdgeMaterial=own(new THREE.MeshBasicMaterial({color:0x1d8fff,transparent:true,opacity:0,side:THREE.BackSide,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));
  const completionOuterMaterial=own(new THREE.MeshBasicMaterial({color:0x0072ff,transparent:true,opacity:0,side:THREE.BackSide,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));
  const completionMaterials=new Map(),completionScreens=[],completionLights=[],completionShapes=[];
  rig.updateMatrixWorld(true);
  rig.traverse(object=>{
    if(object.userData.pulseScreen&&object.isLight)completionLights.push({light:object,intensity:object.intensity});
    if(!object.isMesh)return;
    if(object.userData.pulseScreen&&object.material?.color)completionScreens.push({material:object.material,color:object.material.color.clone()});
    const mats=Array.isArray(object.material)?object.material:[object.material];
    for(const mat of mats){if(mat?.emissive&&mat!==activeWhite&&mat!==activeBlack&&!completionMaterials.has(mat))completionMaterials.set(mat,{color:mat.emissive.clone(),intensity:mat.emissiveIntensity});}
    if(object.isInstancedMesh||!object.geometry)return;object.geometry.computeBoundingBox();const size=new THREE.Vector3();object.geometry.boundingBox.getSize(size);
    if(Math.max(size.x,size.y,size.z)>4&&Math.min(size.x,size.y,size.z)>.05)completionShapes.push(object);
  });
  for(const shape of completionShapes){
    const base=new THREE.Matrix4().copy(rig.matrixWorld).invert().multiply(shape.matrixWorld);
    const rim=new THREE.Mesh(shape.geometry,completionEdgeMaterial);rim.matrixAutoUpdate=false;rim.matrix.copy(base).scale(new THREE.Vector3(1.013,1.025,1.013));rim.renderOrder=2;completionGroup.add(rim);
    const outer=new THREE.Mesh(shape.geometry,completionOuterMaterial);outer.matrixAutoUpdate=false;outer.matrix.copy(base).scale(new THREE.Vector3(1.028,1.04,1.028));outer.renderOrder=1;completionGroup.add(outer);
  }
  const completionBlue=new THREE.Color(0x007bff);let completionStartedAt=-1,completionHasRun=false;
  container.dataset.completionPulse='idle';container.dataset.completionAmount='0';
  function applyCompletionAmount(amount){
    completionGroup.visible=amount>0;completionGroup.userData.amount=amount;completionEdgeMaterial.opacity=amount*.88;completionOuterMaterial.opacity=amount*.20;
    completionMaterials.forEach((base,mat)=>{mat.emissive.copy(base.color).lerp(completionBlue,amount);mat.emissiveIntensity=base.intensity+amount*1.25;});
    completionScreens.forEach(({material,color})=>material.color.copy(color).multiplyScalar(1+amount*.30));completionLights.forEach(({light,intensity})=>light.intensity=intensity+amount*1.7);
    container.dataset.completionAmount=amount.toFixed(4);
  }
  function resetCompletionPulse(){completionStartedAt=-1;completionHasRun=false;applyCompletionAmount(0);container.dataset.completionPulse='idle';}
  function updateCompletionPulse(now){
    if(completionStartedAt<0)return;
    if(reduced){applyCompletionAmount(.20);container.dataset.completionPulse='static';return;}
    const phase=Math.min(1,Math.max(0,(now-completionStartedAt)/750));
    applyCompletionAmount(Math.sin(Math.PI*phase)**1.1);container.dataset.completionPulse=phase>=1?'finished':'running';
  }

  // Requested and displayed progress are distinct. Sequential mode renders every
  // chromatic note; timed mode follows the requested note at the next frame.
  // Both commit getProgress only after the selected key has actually rendered.
  let sweep=-1,queuedIndex=-1,sequentialMode=false,timedMode=false,timedRequestedProgress=0,displayedProgress=0;
  function setProgress(value,{sequential=false,timed=false}={}){
    progress=Number.isFinite(value)?Math.max(-1,Math.min(100,value)):-1;
    if(progress<0){resetCompletionPulse();sequentialMode=false;timedMode=false;queuedIndex=-1;sweep=-1;displayedProgress=0;manualKey=null;resetFinishes();activateKey(null);return displayedProgress;}
    if(progress<100&&completionHasRun)resetCompletionPulse();
    const requestedIndex=Math.min(totalKeys-1,Math.floor(progress*totalKeys/100));
    manualKey=null;
    if(sequential){
      if(requestedIndex<sweep){sweep=-1;displayedProgress=0;resetFinishes();activateKey(null);}
      sequentialMode=true;timedMode=false;queuedIndex=requestedIndex;
    }else if(timed){sequentialMode=false;timedMode=true;queuedIndex=requestedIndex;timedRequestedProgress=progress;
    }else{sequentialMode=false;timedMode=false;queuedIndex=requestedIndex;sweep=requestedIndex;displayedProgress=progress;setPassedPrefix(requestedIndex);activateKey(loadingKeys[sweep]||null);}
    return displayedProgress;
  }
  function getProgress(){return displayedProgress;}
  function playNote(midi = 60) {
    if (!interactive || disposed) return;
    const keyIndex = keys.findIndex(key => key.midi === midi);
    if (keyIndex >= 0) {
      manualKey=keys[keyIndex];activateKey(manualKey);
      const playingKey=manualKey;const timer=setTimeout(()=>{if(manualKey===playingKey){manualKey=null;activateKey(loadingKeys[sweep]||null);}pulseTimers.delete(timer);},500);pulseTimers.add(timer);
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
  let resolveReady, initial = true, readyResolved=false;
  const ready = new Promise(resolve => { resolveReady = resolve; });
  function render(time) {
    if (disposed) return;
    frame = requestAnimationFrame(render);
    if (document.hidden || !visible) { lastTime = time; return; }
    if(lastTime&&time-lastTime<1000/60-.5)return;
    const frameDelta=time-(lastTime||time-16.67);lastTime=time;
    if(sequentialMode&&!manualKey&&sweep<queuedIndex){sweep+=1;activateKey(loadingKeys[sweep]||null);}
    else if(timedMode&&!manualKey&&sweep!==queuedIndex){setPassedPrefix(queuedIndex);sweep=queuedIndex;activateKey(loadingKeys[sweep]||null);}

    // A single indexed key is the only luminous and articulated note.
    if(activeVisualKey){
      const key=activeVisualKey,face=key.isBlack?key.cap:key.mesh;face.updateWorldMatrix(true,false);
      face.geometry.computeBoundingBox();face.geometry.boundingBox.getSize(haloDimensions);
      haloPosition.set(0,face.geometry.boundingBox.max.y+.014,0);haloScale.set(haloDimensions.x,haloDimensions.z,1);haloLocal.compose(haloPosition,haloRotation,haloScale);
      keyHalo.matrix.copy(rig.matrixWorld).invert().multiply(face.matrixWorld).multiply(haloLocal);keyHalo.visible=true;
      keyEdgeBloom.matrix.copy(keyHalo.matrix).scale(edgeBloomScale);keyEdgeBloom.visible=true;
    }else{keyHalo.visible=false;keyEdgeBloom.visible=false;}
    rig.rotation.y = reduced ? 0 : Math.sin(time * .00024) * .017;
    rig.position.y = reduced ? 0 : Math.sin(time * .0005) * .035;
    updateCompletionPulse(performance.now());
    const renderStarted=performance.now();renderer.render(scene,camera);if(activeVisualKey&&!activeVisualKey.hasPlayed)setRestFinish(activeVisualKey,true);if(sweep>=0)finishIndex=sweep;if(sequentialMode&&!manualKey){displayedProgress=sweep<0?0:sweep/(totalKeys-1)*100;}else if(timedMode&&!manualKey&&sweep===queuedIndex&&activeVisualKey===loadingKeys[sweep]){displayedProgress=timedRequestedProgress;}container.dataset.displayedProgress=displayedProgress.toFixed(4);container.dataset.renderMs=(performance.now()-renderStarted).toFixed(1);container.dataset.drawCalls=String(renderer.info.render.calls);container.dataset.frameMs=frameDelta.toFixed(1);
    if(!completionHasRun&&displayedProgress>=100&&sweep===totalKeys-1&&activeVisualKey===loadingKeys[totalKeys-1]){completionHasRun=true;completionStartedAt=performance.now();container.dataset.completionPulse=reduced?'static':'running';}
    if(initial){initial=false;requestAnimationFrame(()=>{if(!disposed){qualityReady=true;resize();}});}
    if(!readyResolved&&rugTextureSettled){readyResolved=true;container.dataset.keyboardReady='true';resolveReady();}
  }
  frame = requestAnimationFrame(render);
  return { ready, setProgress, getProgress, playNote, dispose() {
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
    stage.style.backgroundImage="url('./assets/studio-rug.png')";stage.style.backgroundSize='100% 100%';stage.style.backgroundColor='#79b5c5';
    const fallbackRugReady=new Promise(resolve=>{const image=new Image();image.onload=resolve;image.onerror=resolve;image.src='./assets/studio-rug.png';});
    const buttons = [];
    const positions = [
      'left:35%;top:98px;width:36%;', 'left:37%;top:32px;width:33%;',
      'left:82%;top:97px;width:34%;transform:rotate(90deg);transform-origin:0 0;',
      'left:93%;top:78px;width:31%;transform:rotate(90deg);transform-origin:0 0;',
      'left:34%;top:91px;width:34%;transform:rotate(90deg);transform-origin:0 0;',
      'left:23%;top:91px;width:34%;transform:rotate(90deg);transform-origin:0 0;',
      'left:93%;top:215px;width:26%;transform:rotate(-90deg);transform-origin:0 0;'
    ];
    keySpecs.forEach((spec, index) => {
      const board = document.createElement('div');
      board.style.cssText = `position:absolute;height:36px;background:${spec.kind === 'hammond' ? '#775038' : spec.kind === 'keytar' ? '#d9e0e9' : '#1c273b'};padding:14px 4px 4px;box-sizing:border-box;border-top:2px solid ${spec.kind === 'hammond' ? '#ad7b4a' : '#298bff'};display:flex;${positions[index]}`;
      const label = document.createElement('span'); label.textContent = spec.name;
      label.style.cssText = `position:absolute;left:5px;top:4px;color:${spec.kind === 'keytar' ? '#edf3fa' : '#e2d7c2'};font:700 7px Arial,sans-serif`; board.append(label);
      for (let i = 0; i < spec.count; i++) {
        const isBlack = keyIsBlack(spec.first + i), key = document.createElement('span');
        key.style.cssText = isBlack ? 'height:64%;width:1.7%;flex:0 0 1.7%;background:#0b1020;margin:0 -.85%;z-index:2;transform-origin:top;' : 'height:100%;flex:1;background:#eae9e3;margin-right:.5px;transform-origin:top;';
        buttons.push({el:key,isBlack,instrumentIndex:index,midi:spec.first+i,hasPlayed:false}); board.append(key);
      }
      if(spec.kind==='keytar')board.style.background='#10141a';
      stage.append(board);
    });
    const speaker = document.createElement('div'); speaker.textContent = 'Leslie 122'; speaker.style.cssText = 'position:absolute;left:0;top:118px;width:15%;height:91px;background:#5c3c25;border:5px solid #8d6240;color:#d5bf8b;font:italic 9px Georgia;text-align:center;padding-top:10px;box-sizing:border-box'; stage.append(speaker);
    const laptop=document.createElement('div');laptop.style.cssText='position:absolute;left:6%;top:-42px;width:86%;height:40px;background:#29323a;border:3px solid #a9afb6;border-radius:3px;color:#d2e4e8;font:6px Arial;padding:3px;box-sizing:border-box';laptop.innerHTML='<b>Logic Pro</b><div style="margin-top:3px;height:4px;background:#69a547"></div><div style="margin-top:2px;height:4px;background:#448ac0"></div><div style="margin-top:2px;height:4px;background:#69a547"></div><div style="margin-top:2px;height:4px;background:#448ac0"></div>';speaker.append(laptop);
    root.append(stage); container.append(root); container.dataset.keyboardKeys = String(totalKeys);
    const loadingButtons=inLoadingOrder(buttons);loadingButtons.forEach((key,index)=>key.loadingPosition=index);
    let fallbackCurrent=-1,fallbackTarget=-1,fallbackSequential=false,fallbackTimed=false,fallbackRequested=0,fallbackProgress=0,fallbackFrame=0;
    let fallbackCompletion=false;const fallbackAnimations=[];const fallbackPulseTargets=[...stage.children];
    function resetFallbackPulse(){fallbackCompletion=false;fallbackAnimations.splice(0).forEach(animation=>animation.cancel());fallbackPulseTargets.forEach(element=>element.style.filter='');}
    function triggerFallbackPulse(){if(fallbackCompletion)return;fallbackCompletion=true;fallbackPulseTargets.forEach(element=>{if(reduced)element.style.filter='drop-shadow(0 0 3px #1687ff)';else fallbackAnimations.push(element.animate([{filter:'drop-shadow(0 0 0px #007bff)'},{filter:'drop-shadow(0 0 12px #1687ff) brightness(1.35)'},{filter:'drop-shadow(0 0 0px #007bff)'}],{duration:750,easing:'ease-in-out'}));});}
    function paintFallback(){buttons.forEach(key=>{const active=key===loadingButtons[fallbackCurrent];key.el.style.transform=active?'rotateX(-14deg) translateY(2px)':'';key.el.style.background=active?'#007bff':key.isBlack?(key.hasPlayed?'#0b1020':'#3c4249'):(key.hasPlayed?'#eae9e3':'#929aa4');key.el.style.boxShadow=active?'0 0 4px #007bff':'none';});}
    function fallbackTick(){if(disposed)return;fallbackFrame=requestAnimationFrame(fallbackTick);if(document.hidden)return;if(fallbackSequential&&fallbackCurrent<fallbackTarget){if(fallbackCurrent>=0)loadingButtons[fallbackCurrent].hasPlayed=true;fallbackCurrent++;paintFallback();fallbackProgress=fallbackCurrent/(totalKeys-1)*100;}if(fallbackTimed){fallbackCurrent=fallbackTarget;buttons.forEach(key=>key.hasPlayed=key.loadingPosition<fallbackCurrent);paintFallback();fallbackProgress=fallbackRequested;}if(fallbackProgress>=100)triggerFallbackPulse();}
    paintFallback();fallbackFrame=requestAnimationFrame(fallbackTick);
    return {ready:fallbackRugReady,playNote(){},getProgress(){return fallbackProgress;},setProgress(value,{sequential=false,timed=false}={}){
      if(value<0||!Number.isFinite(value)){fallbackCurrent=-1;fallbackTarget=-1;fallbackSequential=false;fallbackTimed=false;fallbackProgress=0;resetFallbackPulse();buttons.forEach(key=>key.hasPlayed=false);paintFallback();return 0;}
      if(value<100&&fallbackCompletion)resetFallbackPulse();
      const target=Math.min(totalKeys-1,Math.floor(Math.max(0,value)*totalKeys/100));
      if(sequential){if(target<fallbackCurrent){fallbackCurrent=-1;fallbackProgress=0;buttons.forEach(key=>key.hasPlayed=false);paintFallback();}fallbackTarget=target;fallbackSequential=true;fallbackTimed=false;}
      else if(timed){fallbackTarget=target;fallbackRequested=Math.min(100,value);fallbackSequential=false;fallbackTimed=true;}
      else{fallbackCurrent=target;fallbackTarget=target;fallbackSequential=false;fallbackTimed=false;fallbackProgress=Math.min(100,value);buttons.forEach(key=>key.hasPlayed=key.loadingPosition<target);paintFallback();}
      return fallbackProgress;
    },dispose(){disposed=true;cancelAnimationFrame(fallbackFrame);resetFallbackPulse();root.remove();}};
  }
}
