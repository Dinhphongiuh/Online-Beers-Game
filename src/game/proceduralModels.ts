import * as THREE from 'three';

/**
 * Procedural geometries and materials for authentic Vietnamese street pub
 * 3-12 parts per subject, 100% procedural textures, grounded pivots
 */

// Procedural Canvas Textures
export function createBeerLabelTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Background
  const grad = ctx.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0, '#047857');
  grad.addColorStop(0.5, '#065f46');
  grad.addColorStop(1, '#047857');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // Gold border
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 8;
  ctx.strokeRect(16, 16, 480, 224);

  // Gold Star & Text
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 52px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('★ BIA SÀI GÒN ★', 256, 110);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText('SPECIAL LAGER', 256, 165);

  ctx.fillStyle = '#fde68a';
  ctx.font = '22px sans-serif';
  ctx.fillText('ĐẬM ĐÀ CHẤT VIỆT • 4.9% VOL', 256, 210);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createSidewalkTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#3f3f46';
  ctx.fillRect(0, 0, 512, 512);

  // Concrete square grid (gạch vỉa hè)
  ctx.strokeStyle = '#27272a';
  ctx.lineWidth = 6;
  const size = 64;
  for (let x = 0; x <= 512; x += size) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  for (let y = 0; y <= 512; y += size) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  // Grain noise
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  for (let i = 0; i < 6000; i++) {
    const rx = Math.random() * 512;
    const ry = Math.random() * 512;
    ctx.fillRect(rx, ry, 2, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// 1. Vietnamese Stainless Steel Low Table (Bàn Inox Thấp)
export function createStainlessTable(): THREE.Group {
  const table = new THREE.Group();
  table.name = 'StainlessTable';

  // Table Top: Shiny Inox reflective cylinder
  const topGeo = new THREE.CylinderGeometry(1.6, 1.6, 0.06, 48);
  const inoxMat = new THREE.MeshStandardMaterial({
    color: 0xd8d8d8,
    metalness: 0.9,
    // Brushed steel: the old mirror finish threw blinding highlights under the table spotlight
    roughness: 0.34,
  });
  const topMesh = new THREE.Mesh(topGeo, inoxMat);
  topMesh.position.y = 0.95;
  topMesh.receiveShadow = true;
  table.add(topMesh);

  // Table rim lip (mép cuộn bàn inox)
  const rimGeo = new THREE.TorusGeometry(1.6, 0.035, 16, 48);
  rimGeo.rotateX(Math.PI / 2);
  const rimMesh = new THREE.Mesh(rimGeo, inoxMat);
  rimMesh.position.y = 0.96;
  table.add(rimMesh);

  // 4 Tubular stainless steel legs
  const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.92, 16);
  const legRadius = 1.15;
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const leg = new THREE.Mesh(legGeo, inoxMat);
    leg.position.set(Math.cos(angle) * legRadius, 0.46, Math.sin(angle) * legRadius);
    leg.castShadow = true;
    table.add(leg);

    // Rubber foot tip (núm cao su đen)
    const footGeo = new THREE.CylinderGeometry(0.048, 0.048, 0.05, 16);
    const footMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });
    const foot = new THREE.Mesh(footGeo, footMat);
    foot.position.set(Math.cos(angle) * legRadius, 0.025, Math.sin(angle) * legRadius);
    table.add(foot);
  }

  // Cross reinforcement struts underneath table
  const crossGeo = new THREE.BoxGeometry(2.3, 0.03, 0.03);
  const cross1 = new THREE.Mesh(crossGeo, inoxMat);
  cross1.position.y = 0.35;
  cross1.rotation.y = Math.PI / 4;
  table.add(cross1);

  const cross2 = new THREE.Mesh(crossGeo, inoxMat);
  cross2.position.y = 0.35;
  cross2.rotation.y = -Math.PI / 4;
  table.add(cross2);

  // Soft contact shadow
  const shadowGeo = new THREE.CircleGeometry(1.7, 32);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x050505,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
  });
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  table.add(shadow);

  return table;
}

// 2. Vietnamese Plastic Stool (Ghế Nhựa Song Long Đỏ / Xanh)
export function createPlasticStool(colorHex: number = 0xdc2626): THREE.Group {
  const stool = new THREE.Group();
  stool.name = 'PlasticStool';

  const plasticMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.35,
    metalness: 0.05,
  });

  // Seat: square with rounded edges and center hole
  const seatShape = new THREE.Shape();
  const w = 0.32;
  const r = 0.04;
  seatShape.moveTo(-w + r, -w);
  seatShape.lineTo(w - r, -w);
  seatShape.quadraticCurveTo(w, -w, w, -w + r);
  seatShape.lineTo(w, w - r);
  seatShape.quadraticCurveTo(w, w, w - r, w);
  seatShape.lineTo(-w + r, w);
  seatShape.quadraticCurveTo(-w, w, -w, w - r);
  seatShape.lineTo(-w, -w + r);
  seatShape.quadraticCurveTo(-w, -w, -w + r, -w);

  // Center ventilation hole (lỗ cầm tay ghế nhựa)
  const hole = new THREE.Path();
  hole.arc(0, 0, 0.05, 0, Math.PI * 2, true);
  seatShape.holes.push(hole);

  const extrudeSettings = { depth: 0.03, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.01, bevelThickness: 0.01 };
  const seatGeo = new THREE.ExtrudeGeometry(seatShape, extrudeSettings);
  seatGeo.rotateX(Math.PI / 2);
  const seatMesh = new THREE.Mesh(seatGeo, plasticMat);
  seatMesh.position.y = 0.52;
  seatMesh.castShadow = true;
  stool.add(seatMesh);

  // 4 Tapered flared legs
  const legGeo = new THREE.CylinderGeometry(0.025, 0.035, 0.5, 12);
  const legOffsets = [
    [-0.22, -0.22, -0.06, 0.06],
    [0.22, -0.22, 0.06, 0.06],
    [-0.22, 0.22, -0.06, -0.06],
    [0.22, 0.22, 0.06, -0.06],
  ];

  legOffsets.forEach(([x, z, rx, rz]) => {
    const leg = new THREE.Mesh(legGeo, plasticMat);
    leg.position.set(x, 0.25, z);
    leg.rotation.set(rx, 0, rz);
    leg.castShadow = true;
    stool.add(leg);
  });

  return stool;
}

// 3. Beer Tower (Tháp Bia Tươi 3 Lít Với Đá Khô Bốc Khói)
export function createBeerTower(levelRatio: number = 0.85): THREE.Group {
  const tower = new THREE.Group();
  tower.name = 'BeerTower';

  // Base stand (chân đế tháp bia)
  const baseGeo = new THREE.CylinderGeometry(0.24, 0.28, 0.18, 32);
  const blackPlastic = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.4 });
  const baseMesh = new THREE.Mesh(baseGeo, blackPlastic);
  baseMesh.position.y = 0.09;
  tower.add(baseMesh);

  // Golden brass tap (vòi rót bia)
  const tapGeo = new THREE.CylinderGeometry(0.02, 0.025, 0.12, 16);
  tapGeo.rotateX(Math.PI / 2);
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.9, roughness: 0.2 });
  const tapMesh = new THREE.Mesh(tapGeo, brassMat);
  tapMesh.position.set(0, 0.12, 0.26);
  tower.add(tapMesh);

  // Tap lever handle
  const leverGeo = new THREE.CylinderGeometry(0.015, 0.01, 0.14, 12);
  const leverMesh = new THREE.Mesh(leverGeo, blackPlastic);
  leverMesh.position.set(0, 0.21, 0.26);
  leverMesh.rotation.x = 0.2;
  tower.add(leverMesh);

  // Clear acrylic container cylinder
  const tubeGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.9, 32);
  const acrylicMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.35,
    // Very glossy acrylic right under the table spotlight made a blinding specular stripe
    roughness: 0.38,
    transmission: 0, // transmission + bloom (HDR) produces NaN blowouts
    ior: 1.4,
    depthWrite: false,
  });
  const tubeMesh = new THREE.Mesh(tubeGeo, acrylicMat);
  tubeMesh.position.y = 0.63;
  tower.add(tubeMesh);

  // Golden beer liquid inside
  const beerHeight = 0.82 * Math.max(0.1, Math.min(levelRatio, 1));
  const beerGeo = new THREE.CylinderGeometry(0.165, 0.165, beerHeight, 32);
  const beerMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.25,
    metalness: 0.1,
    transparent: true,
    opacity: 0.9,
  });
  const beerMesh = new THREE.Mesh(beerGeo, beerMat);
  beerMesh.position.y = 0.18 + beerHeight / 2;
  tower.add(beerMesh);

  // Foam head top inside
  const foamGeo = new THREE.CylinderGeometry(0.168, 0.168, 0.06, 32);
  const foamMat = new THREE.MeshStandardMaterial({ color: 0xfffbeb, roughness: 0.9 });
  const foamMesh = new THREE.Mesh(foamGeo, foamMat);
  foamMesh.position.y = 0.18 + beerHeight + 0.03;
  tower.add(foamMesh);

  // Central ice cooling rod with cyan glow
  const iceGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.82, 16);
  const iceMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.4,
    roughness: 0.1,
  });
  const iceMesh = new THREE.Mesh(iceGeo, iceMat);
  iceMesh.position.y = 0.63;
  tower.add(iceMesh);

  // Top lid
  const lidGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.08, 32);
  const lidMesh = new THREE.Mesh(lidGeo, blackPlastic);
  lidMesh.position.y = 1.12;
  tower.add(lidMesh);

  return tower;
}

// 4. Glass Beer Mug (Ly Thủy Tinh Cối / Ly Quai)
export function createBeerMug(glassType: string = 'beer_mug'): THREE.Group {
  const mug = new THREE.Group();
  mug.name = 'BeerMug';

  // Glass Cylinder
  const bodyGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.22, 24);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: glassType === 'jade_cup' ? 0xa7f3d0 : glassType === 'horn' ? 0x78350f : 0xe0f2fe,
    transparent: true,
    opacity: 0.4,
    roughness: 0.15,
    transmission: 0, // transmission + bloom (HDR) produces NaN blowouts
    ior: 1.5,
    depthWrite: false,
  });
  const body = new THREE.Mesh(bodyGeo, glassMat);
  body.position.y = 0.11;
  mug.add(body);

  // Glass Handle
  const handleGeo = new THREE.TorusGeometry(0.06, 0.015, 12, 24, Math.PI);
  const handle = new THREE.Mesh(handleGeo, glassMat);
  handle.position.set(0.1, 0.11, 0);
  handle.rotation.z = -Math.PI / 2;
  mug.add(handle);

  // Liquid Inside
  const beerGeo = new THREE.CylinderGeometry(0.08, 0.072, 0.18, 24);
  const beerMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.2,
    transparent: true,
    opacity: 0.9,
  });
  const beer = new THREE.Mesh(beerGeo, beerMat);
  beer.position.y = 0.1;
  mug.add(beer);

  // Thick Foam Top
  const foamGeo = new THREE.CylinderGeometry(0.085, 0.08, 0.035, 24);
  const foamMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
  const foam = new THREE.Mesh(foamGeo, foamMat);
  foam.position.y = 0.2;
  mug.add(foam);

  mug.userData = { beer, foam, beerMat, foamMat };
  return mug;
}

// 5. Minigame: Crocodile Dentist Toy (Cá Sấu Bốc Răng)
export function createCrocodileToy(): {
  group: THREE.Group;
  teeth: THREE.Mesh[];
  jawGroup: THREE.Group;
} {
  const root = new THREE.Group();
  root.name = 'CrocodileToy';

  const greenMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.4 });
  const bellyMat = new THREE.MeshStandardMaterial({ color: 0xbbf7d0, roughness: 0.5 });
  const toothMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
  const toothPressedMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.7 });

  // Lower Jaw / Body base
  const baseGeo = new THREE.BoxGeometry(0.5, 0.12, 0.65);
  const baseMesh = new THREE.Mesh(baseGeo, greenMat);
  baseMesh.position.y = 0.06;
  root.add(baseMesh);

  // Red mouth floor
  const mouthGeo = new THREE.BoxGeometry(0.38, 0.02, 0.48);
  const mouthMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.6 });
  const mouthMesh = new THREE.Mesh(mouthGeo, mouthMat);
  mouthMesh.position.set(0, 0.125, 0.05);
  root.add(mouthMesh);

  // Teeth array arranged along mouth curve
  const teeth: THREE.Mesh[] = [];
  const numTeeth = 10;
  const toothGeo = new THREE.CylinderGeometry(0.018, 0.022, 0.045, 12);

  for (let i = 0; i < numTeeth; i++) {
    const angle = (i / (numTeeth - 1)) * Math.PI * 0.85 - Math.PI * 0.425;
    const x = Math.sin(angle) * 0.16;
    const z = Math.cos(angle) * 0.22 - 0.05;

    const tooth = new THREE.Mesh(toothGeo, toothMat.clone());
    tooth.position.set(x, 0.145, z);
    tooth.userData = { toothIndex: i, isPressed: false, origY: 0.145, toothMat, toothPressedMat };
    tooth.castShadow = true;
    root.add(tooth);
    teeth.push(tooth);
  }

  // Upper Jaw (Hinged to snap shut)
  const jawGroup = new THREE.Group();
  jawGroup.position.set(0, 0.12, -0.25); // Pivot at back

  const upperJawGeo = new THREE.BoxGeometry(0.48, 0.14, 0.55);
  const upperJawMesh = new THREE.Mesh(upperJawGeo, greenMat);
  upperJawMesh.position.set(0, 0.1, 0.25);
  upperJawMesh.castShadow = true;
  jawGroup.add(upperJawMesh);

  // Eyes
  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const eyeBlackMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
  const eyeGeo = new THREE.SphereGeometry(0.045, 16, 16);
  const pupilGeo = new THREE.SphereGeometry(0.02, 12, 12);

  [-0.14, 0.14].forEach((x) => {
    const eye = new THREE.Mesh(eyeGeo, eyeWhiteMat);
    eye.position.set(x, 0.2, 0.1);
    jawGroup.add(eye);

    const pupil = new THREE.Mesh(pupilGeo, eyeBlackMat);
    pupil.position.set(x, 0.21, 0.135);
    jawGroup.add(pupil);
  });

  // Snout nostrils
  [-0.07, 0.07].forEach((x) => {
    const nostrilGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.02, 8);
    const nostril = new THREE.Mesh(nostrilGeo, eyeBlackMat);
    nostril.position.set(x, 0.17, 0.48);
    jawGroup.add(nostril);
  });

  // Initial mouth open position (40 degrees)
  jawGroup.rotation.x = -0.7;
  root.add(jawGroup);

  return { group: root, teeth, jawGroup };
}

// 6. Minigame: Spinning Saigon Beer Bottle (Chai Bia Xoay)
export function createSpinningBottle(): THREE.Group {
  const bottle = new THREE.Group();
  bottle.name = 'SpinningBottle';

  const bottleGlassMat = new THREE.MeshStandardMaterial({
    color: 0x064e3b,
    roughness: 0.15,
    metalness: 0.1,
  });

  // Bottle Body cylinder
  const bodyGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.28, 24);
  const bodyMesh = new THREE.Mesh(bodyGeo, bottleGlassMat);
  bodyMesh.position.y = 0.14;
  bottle.add(bodyMesh);

  // Label
  const labelGeo = new THREE.CylinderGeometry(0.066, 0.066, 0.14, 24);
  const labelMat = new THREE.MeshStandardMaterial({
    map: createBeerLabelTexture(),
    roughness: 0.4,
  });
  const labelMesh = new THREE.Mesh(labelGeo, labelMat);
  labelMesh.position.y = 0.14;
  bottle.add(labelMesh);

  // Neck taper
  const neckTaperGeo = new THREE.CylinderGeometry(0.028, 0.065, 0.1, 24);
  const neckTaperMesh = new THREE.Mesh(neckTaperGeo, bottleGlassMat);
  neckTaperMesh.position.y = 0.33;
  bottle.add(neckTaperMesh);

  // Neck cylinder
  const neckGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.12, 16);
  const neckMesh = new THREE.Mesh(neckGeo, bottleGlassMat);
  neckMesh.position.y = 0.44;
  bottle.add(neckMesh);

  // Crown Bottle Cap (Nắp keng đỏ)
  const capGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.02, 16);
  const capMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.85, roughness: 0.2 });
  const capMesh = new THREE.Mesh(capGeo, capMat);
  capMesh.position.y = 0.51;
  bottle.add(capMesh);

  // Lie down flat on the table for spinning
  bottle.rotation.z = Math.PI / 2;
  bottle.position.y = 0.065;

  return bottle;
}

// 7. Street Pub Dishes (Đĩa Mồi Đậu Phộng, Chân Gà, Lẩu Thái, Ốc Hương, Cá Viên, Xoài Non)

// 7b. 3D Animated Chopsticks Pair (Đôi Đũa Tre Gắp Mồi)
export function createChopsticksPair(): {
  group: THREE.Group;
  stick1: THREE.Mesh;
  stick2: THREE.Mesh;
  morselMesh: THREE.Mesh;
} {
  const group = new THREE.Group();
  group.name = 'AnimatedChopsticks';

  const stickGeo = new THREE.CylinderGeometry(0.005, 0.009, 0.42, 10);
  stickGeo.rotateX(Math.PI / 2);
  const bambooMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.45 });

  const stick1 = new THREE.Mesh(stickGeo, bambooMat);
  stick1.position.set(-0.014, 0, -0.18);
  stick1.rotation.y = -0.04;
  group.add(stick1);

  const stick2 = new THREE.Mesh(stickGeo, bambooMat);
  stick2.position.set(0.014, 0, -0.18);
  stick2.rotation.y = 0.04;
  group.add(stick2);

  // Pinched food morsel at the tip of the chopsticks (z = 0)
  const morselGeo = new THREE.SphereGeometry(0.028, 12, 12);
  morselGeo.scale(1.3, 0.95, 1.1);
  const morselMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.35,
  });
  const morselMesh = new THREE.Mesh(morselGeo, morselMat);
  morselMesh.position.set(0, 0, 0.02);
  group.add(morselMesh);

  group.visible = false;
  return { group, stick1, stick2, morselMesh };
}

// 8. Overhead String Fairy Lights (Dây Đèn Vàng Lung Linh Vỉa Hè)
export function createFairyLights(): THREE.Group {
  const lightsGroup = new THREE.Group();
  lightsGroup.name = 'FairyLights';

  const cordCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-4, 2.8, -4),
    new THREE.Vector3(0, 2.3, 0),
    new THREE.Vector3(4, 2.8, 4),
  ]);

  const cordGeo = new THREE.TubeGeometry(cordCurve, 32, 0.015, 8, false);
  const cordMat = new THREE.MeshBasicMaterial({ color: 0x18181b });
  const cordMesh = new THREE.Mesh(cordGeo, cordMat);
  lightsGroup.add(cordMesh);

  // Bulbs along wire
  const bulbGeo = new THREE.SphereGeometry(0.06, 12, 12);
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfbbf24,
    emissiveIntensity: 3.2,
    roughness: 0.2,
  });

  const numBulbs = 9;
  for (let i = 0; i < numBulbs; i++) {
    const t = i / (numBulbs - 1);
    const pos = cordCurve.getPoint(t);
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.copy(pos).sub(new THREE.Vector3(0, 0.06, 0));
    lightsGroup.add(bulb);
  }

  return lightsGroup;
}

// 9. Luminous Neon Signboard
export function createNeonSign(text: string, subtext: string, colorHex: number = 0x06b6d4): THREE.Group {
  const sign = new THREE.Group();
  sign.name = 'NeonSign';

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 380;
  const ctx = canvas.getContext('2d')!;

  // Dark acrylic backing
  ctx.fillStyle = '#09090b';
  ctx.fillRect(0, 0, 1024, 380);

  // Outer Neon border
  ctx.strokeStyle = '#f43f5e';
  ctx.lineWidth = 14;
  ctx.strokeRect(20, 20, 984, 340);

  // Inner Neon border
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 6;
  ctx.strokeRect(40, 40, 944, 300);

  // Main Neon Text
  ctx.font = '900 84px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#06b6d4';
  ctx.shadowBlur = 30;
  ctx.fillText(text, 512, 160);

  // Subtext
  ctx.font = '700 46px sans-serif';
  ctx.fillStyle = '#fbbf24';
  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur = 24;
  ctx.fillText(subtext, 512, 260);

  // Tagline
  ctx.font = 'bold 28px sans-serif';
  ctx.fillStyle = '#f43f5e';
  ctx.shadowColor = '#e11d48';
  ctx.shadowBlur = 15;
  ctx.fillText('★ 1, 2, 3 DZÔÔÔ! • UỐNG HẾT MÌNH ★', 512, 320);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const signGeo = new THREE.BoxGeometry(4.2, 1.6, 0.1);
  const signMat = new THREE.MeshStandardMaterial({
    map: texture,
    emissiveMap: texture,
    emissive: 0xffffff,
    emissiveIntensity: 1.9,
    roughness: 0.2,
  });

  const signMesh = new THREE.Mesh(signGeo, signMat);
  sign.add(signMesh);

  // Steel frame support poles
  const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, 4.2, 16);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.6 });
  [-1.9, 1.9].forEach((x) => {
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(x, -1.2, 0);
    sign.add(pole);
  });

  return sign;
}

// 10. Stacked Plastic Beer Crates (Két Bia Sài Gòn & Tiger)
export function createBeerCrates(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'BeerCrates';

  const crateGeo = new THREE.BoxGeometry(0.7, 0.35, 0.5);
  const redMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.5 });
  const yellowMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.5 });

  const bottleGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.3, 12);
  const bottleMat = new THREE.MeshStandardMaterial({ color: 0x064e3b, roughness: 0.2 });

  // 3 stacked crates
  for (let level = 0; level < 3; level++) {
    const crate = new THREE.Mesh(crateGeo, level % 2 === 0 ? redMat : yellowMat);
    crate.position.set(0, 0.175 + level * 0.36, 0);
    group.add(crate);

    // Bottles poking out top crate
    if (level === 2) {
      for (let bx = -0.22; bx <= 0.22; bx += 0.18) {
        for (let bz = -0.15; bz <= 0.15; bz += 0.15) {
          const bottle = new THREE.Mesh(bottleGeo, bottleMat);
          bottle.position.set(bx, 0.175 + level * 0.36 + 0.12, bz);
          group.add(bottle);
        }
      }
    }
  }

  return group;
}

// 11. Street Food Cart in Background (Xe Đẩy Cá Viên Chiên & Đèn Lồng)
export function createStreetFoodCart(): THREE.Group {
  const cart = new THREE.Group();
  cart.name = 'StreetFoodCart';

  // Cart body
  const bodyGeo = new THREE.BoxGeometry(1.8, 1.1, 0.9);
  const stainlessMat = new THREE.MeshStandardMaterial({ color: 0xa1a1aa, metalness: 0.8, roughness: 0.3 });
  const body = new THREE.Mesh(bodyGeo, stainlessMat);
  body.position.y = 0.8;
  cart.add(body);

  // Glass display case on top
  const caseGeo = new THREE.BoxGeometry(1.6, 0.7, 0.8);
  const caseMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.4,
    roughness: 0.1,
    transmission: 0, // transmission + bloom (HDR) produces NaN blowouts
    depthWrite: false,
  });
  const glassCase = new THREE.Mesh(caseGeo, caseMat);
  glassCase.position.set(0, 1.7, 0);
  cart.add(glassCase);

  // Red Hanging Lantern (Đèn lồng đỏ)
  const lanternGeo = new THREE.SphereGeometry(0.22, 16, 16);
  lanternGeo.scale(1, 1.25, 1);
  const lanternMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xdc2626,
    emissiveIntensity: 1.5,
    roughness: 0.4,
  });
  const lantern = new THREE.Mesh(lanternGeo, lanternMat);
  lantern.position.set(0.6, 2.3, 0.5);
  cart.add(lantern);

  const lanternLight = new THREE.PointLight(0xef4444, 1.8, 5);
  lanternLight.position.set(0.6, 2.3, 0.5);
  cart.add(lanternLight);

  return cart;
}

// 12. Stainless Steel Ice Bucket & Tongs (Xô Đá Inox & Cây Gắp Đá)
export function createIceBucket(): THREE.Group {
  const bucket = new THREE.Group();
  bucket.name = 'IceBucket';

  const stainlessMat = new THREE.MeshStandardMaterial({
    color: 0xd4d4d8,
    metalness: 0.88,
    roughness: 0.22,
  });

  // Bucket tapered body
  const bodyGeo = new THREE.CylinderGeometry(0.15, 0.11, 0.22, 24);
  const body = new THREE.Mesh(bodyGeo, stainlessMat);
  body.position.y = 0.11;
  body.castShadow = true;
  bucket.add(body);

  // Side ring handles
  const ringGeo = new THREE.TorusGeometry(0.025, 0.005, 8, 16);
  [-0.145, 0.145].forEach((x) => {
    const ring = new THREE.Mesh(ringGeo, stainlessMat);
    ring.position.set(x, 0.16, 0);
    ring.rotation.y = Math.PI / 2;
    bucket.add(ring);
  });

  // Translucent cyan-white Ice Cubes piled at top
  const iceMat = new THREE.MeshPhysicalMaterial({
    color: 0xe0f2fe,
    emissive: 0x0284c7,
    emissiveIntensity: 0.2,
    transparent: true,
    opacity: 0.82,
    roughness: 0.12,
    transmission: 0, // transmission + bloom (HDR) produces NaN blowouts
  });
  const cubeGeo = new THREE.BoxGeometry(0.052, 0.052, 0.052);
  for (let i = 0; i < 9; i++) {
    const cube = new THREE.Mesh(cubeGeo, iceMat);
    const angle = (i / 9) * Math.PI * 2;
    const r = i < 6 ? 0.075 : 0.02;
    cube.position.set(
      Math.cos(angle) * r,
      0.21 + (i % 3) * 0.018,
      Math.sin(angle) * r
    );
    cube.rotation.set(i * 0.5, i * 0.8, i * 0.3);
    bucket.add(cube);
  }

  // Ice Tongs (Cây gắp đá inox gác trên thành xô)
  const tongGeo = new THREE.BoxGeometry(0.012, 0.18, 0.022);
  const tong1 = new THREE.Mesh(tongGeo, stainlessMat);
  tong1.position.set(0.05, 0.25, 0.02);
  tong1.rotation.z = -0.35;
  bucket.add(tong1);

  const tong2 = new THREE.Mesh(tongGeo, stainlessMat);
  tong2.position.set(0.08, 0.24, 0.02);
  tong2.rotation.z = -0.5;
  bucket.add(tong2);

  return bucket;
}

// 13. 1-Stall Sidewalk WC Booth (Nhà Vệ Sinh 1 Buồng Duy Nhất Góc Quán)
export function createToiletBooth(): {
  group: THREE.Group;
  doorMesh: THREE.Mesh;
  statusBulb: THREE.Mesh;
} {
  const wc = new THREE.Group();
  wc.name = 'ToiletBooth1Stall';

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.65 });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.45 });

  // Stall Cabin Box
  const cabinGeo = new THREE.BoxGeometry(1.1, 2.1, 1.1);
  const cabin = new THREE.Mesh(cabinGeo, wallMat);
  cabin.position.y = 1.05;
  cabin.castShadow = true;
  wc.add(cabin);

  // Blue Plastic Door on Front
  const doorGeo = new THREE.BoxGeometry(0.78, 1.82, 0.06);
  const doorMesh = new THREE.Mesh(doorGeo, doorMat);
  doorMesh.position.set(0, 0.96, 0.54);
  wc.add(doorMesh);

  // Occupied / Free Status Bulb above door
  const bulbGeo = new THREE.SphereGeometry(0.075, 16, 16);
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    emissive: 0x22c55e,
    emissiveIntensity: 1.5,
  });
  const statusBulb = new THREE.Mesh(bulbGeo, bulbMat);
  statusBulb.position.set(0, 2.02, 0.58);
  wc.add(statusBulb);

  return { group: wc, doorMesh, statusBulb };
}

// 14. Sidewalk Floor Litter: Peanut Shells, Crumpled Tissues, Bottle Caps & Rolling Empty Bottles
export function createFloorLitterAndBottles(): THREE.Group {
  const litter = new THREE.Group();
  litter.name = 'SidewalkLitterAndBottles';

  const tissueMat = new THREE.MeshStandardMaterial({ color: 0xf4f4f5, roughness: 0.9 });
  const peanutMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.8 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.7, roughness: 0.3 });
  const bottleMat = new THREE.MeshStandardMaterial({
    color: 0x065f46,
    roughness: 0.18,
    metalness: 0.1,
  });

  // Crumpled white paper napkins under and around table
  const tissueGeo = new THREE.DodecahedronGeometry(0.045, 0);
  const tissuePositions = [
    [-0.55, 0.03, 0.65],
    [0.68, 0.03, -0.45],
    [-0.25, 0.03, -0.78],
    [0.42, 0.03, 0.88],
    [-0.85, 0.03, 0.15],
    [0.15, 0.03, 1.15],
  ];
  tissuePositions.forEach(([x, y, z], i) => {
    const t = new THREE.Mesh(tissueGeo, tissueMat);
    t.position.set(x, y, z);
    t.rotation.set(i * 0.7, i * 1.1, i * 0.4);
    litter.add(t);
  });

  // Scattered peanut shells & beer caps
  const shellGeo = new THREE.SphereGeometry(0.022, 8, 8);
  shellGeo.scale(1.6, 0.7, 0.9);
  const capGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.008, 10);
  for (let i = 0; i < 18; i++) {
    const angle = (i / 18) * Math.PI * 2 + 0.3;
    const dist = 0.35 + (i % 5) * 0.28;
    const mesh = new THREE.Mesh(i % 2 === 0 ? shellGeo : capGeo, i % 2 === 0 ? peanutMat : capMat);
    mesh.position.set(Math.cos(angle) * dist, 0.012, Math.sin(angle) * dist);
    mesh.rotation.y = i * 0.9;
    litter.add(mesh);
  }

  // Rolling empty green beer bottles on the floor near plastic stools
  const bottleGeo = new THREE.CylinderGeometry(0.034, 0.034, 0.24, 12);
  bottleGeo.rotateZ(Math.PI / 2);
  const bottleSpots = [
    [-1.15, 0.035, 1.05, 0.4],
    [1.05, 0.035, 0.95, -0.7],
    [-0.92, 0.035, -1.1, 1.2],
    [0.88, 0.035, -0.95, 2.1],
  ];
  bottleSpots.forEach(([x, y, z, rot]) => {
    const b = new THREE.Mesh(bottleGeo, bottleMat);
    b.position.set(x, y, z);
    b.rotation.y = rot;
    litter.add(b);
  });

  return litter;
}

// 15. "Cậu Vàng" — Friendly Street Dog Waiting Under the Table
export function createCauVangDog(): {
  group: THREE.Group;
  tail: THREE.Mesh;
  headGroup: THREE.Group;
} {
  const dog = new THREE.Group();
  dog.name = 'CauVangDog';

  const furMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.65 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.3 });
  const collarMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 });

  // Torso lying/crouching under table
  const bodyGeo = new THREE.BoxGeometry(0.24, 0.18, 0.38);
  const body = new THREE.Mesh(bodyGeo, furMat);
  body.position.set(0, 0.13, 0);
  body.castShadow = true;
  dog.add(body);

  // Red Collar
  const collarGeo = new THREE.BoxGeometry(0.25, 0.05, 0.06);
  const collar = new THREE.Mesh(collarGeo, collarMat);
  collar.position.set(0, 0.18, 0.16);
  dog.add(collar);

  // Head Group
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.25, 0.2);

  const skullGeo = new THREE.BoxGeometry(0.2, 0.18, 0.2);
  const skull = new THREE.Mesh(skullGeo, furMat);
  headGroup.add(skull);

  const snoutGeo = new THREE.BoxGeometry(0.11, 0.09, 0.12);
  const snout = new THREE.Mesh(snoutGeo, furMat);
  snout.position.set(0, -0.02, 0.13);
  headGroup.add(snout);

  const noseGeo = new THREE.SphereGeometry(0.025, 8, 8);
  const nose = new THREE.Mesh(noseGeo, darkMat);
  nose.position.set(0, 0.01, 0.19);
  headGroup.add(nose);

  // Eyes
  const eyeGeo = new THREE.SphereGeometry(0.02, 8, 8);
  [-0.055, 0.055].forEach((x) => {
    const eye = new THREE.Mesh(eyeGeo, darkMat);
    eye.position.set(x, 0.03, 0.1);
    headGroup.add(eye);
  });

  // Floppy Ears
  const earGeo = new THREE.BoxGeometry(0.05, 0.11, 0.07);
  [-0.11, 0.11].forEach((x) => {
    const ear = new THREE.Mesh(earGeo, furMat);
    ear.position.set(x, 0.04, 0);
    ear.rotation.z = x > 0 ? -0.25 : 0.25;
    headGroup.add(ear);
  });

  dog.add(headGroup);

  // Wagging Tail
  const tailGeo = new THREE.CylinderGeometry(0.02, 0.03, 0.18, 8);
  const tail = new THREE.Mesh(tailGeo, furMat);
  tail.position.set(0, 0.22, -0.2);
  tail.rotation.x = -0.6;
  dog.add(tail);

  return { group: dog, tail, headGroup };
}

// 16. Street Motorbike (Wave / Vision / Exciter) Zooming Past the Curb
export function createStreetMotorbike(): THREE.Group {
  const bike = new THREE.Group();
  bike.name = 'StreetMotorbike';

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe11d48, metalness: 0.4, roughness: 0.3 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8 });
  const helmetMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 });
  const headlightMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

  // Chassis
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.35, 0.28), bodyMat);
  frame.position.set(0, 0.42, 0);
  bike.add(frame);

  // Front shield & handlebar
  const shield = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.58, 0.32), bodyMat);
  shield.position.set(0.32, 0.58, 0);
  shield.rotation.z = 0.2;
  bike.add(shield);

  // Glowing Headlight
  const headlight = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), headlightMat);
  headlight.position.set(0.45, 0.78, 0);
  bike.add(headlight);

  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.1, 16);
  wheelGeo.rotateX(Math.PI / 2);
  [-0.32, 0.36].forEach((x) => {
    const w = new THREE.Mesh(wheelGeo, tireMat);
    w.position.set(x, 0.22, 0);
    bike.add(w);
  });

  // Rider Silhouette
  const riderTorso = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.45, 0.26),
    new THREE.MeshStandardMaterial({ color: 0x27272a })
  );
  riderTorso.position.set(-0.08, 0.82, 0);
  bike.add(riderTorso);

  const riderHelmet = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 12), helmetMat);
  riderHelmet.position.set(-0.05, 1.16, 0);
  bike.add(riderHelmet);

  return bike;
}

// 17. Retractable Blue-Orange Street Rain Tarp Canopy (Bạt Kéo Che Mưa Vỉa Hè)
export function createRetractableTarp(): THREE.Group {
  const tarpGroup = new THREE.Group();
  tarpGroup.name = 'RetractableTarp';

  const tarpGeo = new THREE.BoxGeometry(4.6, 0.05, 4.2);
  const tarpMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.6,
    metalness: 0.1,
  });
  const tarpMesh = new THREE.Mesh(tarpGeo, tarpMat);
  tarpMesh.position.set(0, 2.75, 0);
  tarpGroup.add(tarpMesh);

  // Orange trim valance
  const trimGeo = new THREE.BoxGeometry(4.64, 0.16, 0.06);
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.5 });
  const trim = new THREE.Mesh(trimGeo, trimMat);
  trim.position.set(0, 2.66, 2.1);
  tarpGroup.add(trim);

  return tarpGroup;
}

// 18. Rolling Karaoke Speaker Rig ("Loa Kẹo Kéo LED Nhấp Nháy")
export function createKaraokeSpeakerRig(): {
  group: THREE.Group;
  ledRing: THREE.Mesh;
} {
  const rig = new THREE.Group();
  rig.name = 'KaraokeSpeakerRig';

  const boxMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.4, metalness: 0.3 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.76, 0.42), boxMat);
  box.position.y = 0.42;
  box.castShadow = true;
  rig.add(box);

  // Glowing RGB Woofer Ring
  const ringGeo = new THREE.RingGeometry(0.08, 0.17, 24);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xec4899,
    side: THREE.DoubleSide,
  });
  const ledRing = new THREE.Mesh(ringGeo, ringMat);
  ledRing.position.set(0, 0.38, 0.215);
  rig.add(ledRing);

  // Telescopic Pull Handle
  const handleMat = new THREE.MeshStandardMaterial({ color: 0xa1a1aa, metalness: 0.8 });
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.45, 0.04), handleMat);
  handle.position.set(0, 0.92, -0.16);
  rig.add(handle);

  return { group: rig, ledRing };
}

// 19. Neighbor Table Group ("Bàn Nhậu Kế Bên - Dân Nhậu Giang Hồ Mạng")
export function createNeighborTableGroup(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'NeighborTableGroup';

  const table = createStainlessTable();
  table.scale.set(0.75, 0.9, 0.75);
  group.add(table);

  const tower = createBeerTower(0.75);
  tower.position.set(0, 0.88, 0);
  tower.scale.set(0.75, 0.75, 0.75);
  group.add(tower);

  // 3 plastic stools around neighbor table
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI * 2;
    const stool = createPlasticStool(i % 2 === 0 ? 0x0284c7 : 0xdc2626);
    stool.position.set(Math.cos(ang) * 1.15, 0, Math.sin(ang) * 1.15);
    group.add(stool);
  }

  return group;
}

// 20. Lush Sidewalk Green Tree ("Cây Xanh Bờ Kè Cho Gấu Nâu Khoa Nguyễn Leo Cây Khi Say 80%")
export function createSidewalkGreenTree(): {
  group: THREE.Group;
  canopyGroup: THREE.Group;
} {
  const group = new THREE.Group();
  group.name = 'SidewalkGreenTree';

  // 1. Octagonal Painted Curb Planter Box at Base ("Bồn Cây Vỉa Hè Sơn Trắng Đỏ")
  const planterMat = new THREE.MeshStandardMaterial({
    color: 0xe4e4e7,
    roughness: 0.75,
  });
  const planterGeo = new THREE.CylinderGeometry(0.46, 0.5, 0.22, 8);
  const planter = new THREE.Mesh(planterGeo, planterMat);
  planter.position.y = 0.11;
  planter.receiveShadow = true;
  planter.castShadow = true;
  group.add(planter);

  // Red-and-white curb rim
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.6 });
  const rimGeo = new THREE.TorusGeometry(0.46, 0.035, 8, 8);
  rimGeo.rotateX(Math.PI / 2);
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.position.y = 0.22;
  group.add(rim);

  // Dark Soil & Little Grass Tufts inside Planter
  const soilMat = new THREE.MeshStandardMaterial({ color: 0x3f2e21, roughness: 0.95 });
  const soilGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.06, 12);
  const soil = new THREE.Mesh(soilGeo, soilMat);
  soil.position.y = 0.21;
  group.add(soil);

  // 2. Sturdy Climbable Tree Trunk & Branches
  const barkMat = new THREE.MeshStandardMaterial({
    color: 0x6b4226,
    roughness: 0.88,
  });
  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.23, 1.95, 14);
  const trunk = new THREE.Mesh(trunkGeo, barkMat);
  trunk.position.y = 1.1;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  // Side Branch 1 (Lower climbing perch for Khoa Nguyễn at y = 1.25)
  const branch1Geo = new THREE.CylinderGeometry(0.065, 0.1, 0.72, 10);
  const branch1 = new THREE.Mesh(branch1Geo, barkMat);
  branch1.position.set(0.26, 1.32, 0.08);
  branch1.rotation.z = -0.82;
  branch1.castShadow = true;
  group.add(branch1);

  // Side Branch 2 (Left upper branch)
  const branch2Geo = new THREE.CylinderGeometry(0.055, 0.09, 0.65, 10);
  const branch2 = new THREE.Mesh(branch2Geo, barkMat);
  branch2.position.set(-0.22, 1.52, -0.06);
  branch2.rotation.z = 0.74;
  branch2.castShadow = true;
  group.add(branch2);

  // Cute Golden Beehive ("Tổ Ong Mật") hanging from the climbing branch
  const hiveGroup = new THREE.Group();
  hiveGroup.position.set(0.46, 1.24, 0.12);
  const hiveMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.5,
    emissive: 0xd97706,
    emissiveIntensity: 0.2,
  });
  [0, 0.055, 0.105].forEach((dy, idx) => {
    const r = idx === 1 ? 0.085 : 0.068;
    const ring = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), hiveMat);
    ring.scale.y = 0.65;
    ring.position.y = -dy;
    hiveGroup.add(ring);
  });
  group.add(hiveGroup);

  // Warm Street Lantern hanging from branch
  const lanternBulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xfef08a })
  );
  lanternBulb.position.set(0.32, 1.18, 0.22);
  group.add(lanternBulb);

  // 3. Lush Multi-Layered Green Foliage Canopy ("Tán Cây Xanh Mướt Dễ Nhìn")
  const canopyGroup = new THREE.Group();
  canopyGroup.position.set(0, 2.08, 0);

  const leafMatDark = new THREE.MeshStandardMaterial({
    color: 0x15803d,
    roughness: 0.65,
  });
  const leafMatMid = new THREE.MeshStandardMaterial({
    color: 0x16a34a,
    roughness: 0.6,
  });
  const leafMatBright = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    roughness: 0.55,
  });
  const leafMatLime = new THREE.MeshStandardMaterial({
    color: 0x4ade80,
    roughness: 0.5,
  });

  const foliageClusters: {
    pos: [number, number, number];
    radius: number;
    mat: THREE.Material;
  }[] = [
    { pos: [0, 0.18, 0], radius: 0.62, mat: leafMatMid },
    { pos: [-0.42, -0.05, 0.22], radius: 0.46, mat: leafMatDark },
    { pos: [0.45, -0.02, 0.18], radius: 0.48, mat: leafMatBright },
    { pos: [0.18, 0.05, -0.38], radius: 0.46, mat: leafMatDark },
    { pos: [-0.28, 0.12, -0.32], radius: 0.44, mat: leafMatMid },
    { pos: [0, 0.52, 0.06], radius: 0.48, mat: leafMatLime },
    { pos: [0.32, 0.35, 0.25], radius: 0.36, mat: leafMatLime },
    { pos: [-0.32, 0.32, 0.2], radius: 0.38, mat: leafMatBright },
    { pos: [0.48, -0.28, 0.1], radius: 0.34, mat: leafMatMid },
  ];

  foliageClusters.forEach((c) => {
    const geo = new THREE.IcosahedronGeometry(c.radius, 2);
    geo.scale(1.12, 0.88, 1.08);
    const mesh = new THREE.Mesh(geo, c.mat);
    mesh.position.set(c.pos[0], c.pos[1], c.pos[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    canopyGroup.add(mesh);
  });

  group.add(canopyGroup);

  // Overhead 3D Tree Sign Sprite ("🌳 CÂY XANH BỜ KÈ")
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 384;
  signCanvas.height = 96;
  const sCtx = signCanvas.getContext('2d');
  if (sCtx) {
    sCtx.fillStyle = 'rgba(6, 78, 59, 0.92)';
    sCtx.strokeStyle = '#4ade80';
    sCtx.lineWidth = 4;
    sCtx.beginPath();
    sCtx.roundRect(10, 10, 364, 76, 20);
    sCtx.fill();
    sCtx.stroke();

    sCtx.font = '900 26px system-ui, sans-serif';
    sCtx.fillStyle = '#ecfdf5';
    sCtx.textAlign = 'center';
    sCtx.textBaseline = 'middle';
    sCtx.fillText('🌳 CÂY BÀNG BỜ KÈ', 192, 36);

    sCtx.font = 'bold 18px system-ui, sans-serif';
    sCtx.fillStyle = '#fde047';
    sCtx.fillText('Chỗ Khoa Nguyễn Leo Cây Khi Say 80%', 192, 66);
  }
  const signTex = new THREE.CanvasTexture(signCanvas);
  signTex.colorSpace = THREE.SRGBColorSpace;
  const signSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: signTex, transparent: true, depthTest: false })
  );
  signSprite.position.set(0, 2.95, 0);
  signSprite.scale.set(1.15, 0.29, 1);
  signSprite.renderOrder = 12;
  group.add(signSprite);

  return { group, canopyGroup };
}

// 21. Open-Air Charcoal Grill Kitchen ("Khu Vực Bếp Lộ Thiên - Nướng Mực & Hàu Mỡ Hành + Dao Phay Chủ Quán")
export function createOpenCharcoalKitchen(): {
  group: THREE.Group;
  charcoalGlow: THREE.Mesh;
  cleaverMesh: THREE.Group;
} {
  const group = new THREE.Group();

  // Stainless steel grill counter
  const counterMat = new THREE.MeshStandardMaterial({
    color: 0xa1a1aa,
    metalness: 0.75,
    roughness: 0.3,
  });
  const counterTop = new THREE.Mesh(
    new THREE.BoxGeometry(1.45, 0.12, 0.72),
    counterMat
  );
  counterTop.position.y = 0.86;
  counterTop.castShadow = true;
  group.add(counterTop);

  // 4 steel legs
  const legGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.85, 10);
  [
    [-0.65, 0.425, -0.3],
    [0.65, 0.425, -0.3],
    [-0.65, 0.425, 0.3],
    [0.65, 0.425, 0.3],
  ].forEach(([lx, ly, lz]) => {
    const leg = new THREE.Mesh(legGeo, counterMat);
    leg.position.set(lx, ly, lz);
    group.add(leg);
  });

  // Charcoal trough & glowing red-orange embers
  const trough = new THREE.Mesh(
    new THREE.BoxGeometry(0.82, 0.14, 0.52),
    new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.8 })
  );
  trough.position.set(-0.22, 0.94, 0);
  group.add(trough);

  const charcoalGlow = new THREE.Mesh(
    new THREE.BoxGeometry(0.74, 0.05, 0.44),
    new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xef4444,
      emissiveIntensity: 1.6,
      roughness: 0.5,
    })
  );
  charcoalGlow.position.set(-0.22, 1.01, 0);
  group.add(charcoalGlow);

  // Grilled dried squid & green-onion oysters on wire rack
  for (let i = 0; i < 4; i++) {
    const squid = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.025, 0.22),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.6 })
    );
    squid.position.set(-0.46 + i * 0.16, 1.04, -0.08);
    group.add(squid);

    const oyster = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.04, 0.03, 10),
      new THREE.MeshStandardMaterial({ color: 0x84cc16, roughness: 0.5 })
    );
    oyster.position.set(-0.44 + i * 0.16, 1.04, 0.12);
    group.add(oyster);
  }

  // Wooden Butcher Block + Shiny Steel Meat Cleaver ("Dao Phay Chủ Quán Tư Đực")
  const board = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.08, 16),
    new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.75 })
  );
  board.position.set(0.42, 0.96, 0);
  group.add(board);

  const cleaverMesh = new THREE.Group();
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.12, 0.015),
    new THREE.MeshStandardMaterial({
      color: 0xf4f4f5,
      metalness: 0.92,
      roughness: 0.15,
    })
  );
  blade.position.set(0, 0.06, 0);
  cleaverMesh.add(blade);

  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.022, 0.14, 8),
    new THREE.MeshStandardMaterial({ color: 0x7c2d12 })
  );
  handle.rotation.z = Math.PI / 2;
  handle.position.set(0.16, 0.09, 0);
  cleaverMesh.add(handle);

  cleaverMesh.position.set(0.42, 1.02, 0);
  cleaverMesh.rotation.z = -0.35;
  group.add(cleaverMesh);

  // Overhead 3D Kitchen Sign Sprite
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'rgba(124, 45, 18, 0.94)';
    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(10, 10, 364, 76, 18);
    ctx.fill();
    ctx.stroke();

    ctx.font = '900 24px system-ui, sans-serif';
    ctx.fillStyle = '#ffedd5';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔥 KHU BẾP LỘ THIÊN TƯ ĐỰC', 192, 36);

    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillStyle = '#fde047';
    ctx.fillText('Nướng Mực & Hàu Mỡ Hành (Coi Chừng Dao Phay!)', 192, 66);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const signSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
  );
  signSprite.position.set(0, 1.68, 0);
  signSprite.scale.set(1.15, 0.29, 1);
  signSprite.renderOrder = 12;
  group.add(signSprite);

  return { group, charcoalGlow, cleaverMesh };
}

// 22. Convenience Store & 24/7 ATM Booth ("Khu Tạp Hóa Đêm & Cây ATM Rút Tiền")
export function createConvenienceStoreAndATM(): THREE.Group {
  const group = new THREE.Group();

  // 1. 24/7 Glowing Blue ATM Machine
  const atmBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 1.55, 0.58),
    new THREE.MeshStandardMaterial({
      color: 0x1d4ed8,
      roughness: 0.35,
      metalness: 0.4,
    })
  );
  atmBody.position.set(-0.48, 0.775, 0);
  atmBody.castShadow = true;
  group.add(atmBody);

  // ATM Glowing Screen
  const atmScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.44, 0.34),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
  );
  atmScreen.position.set(-0.48, 1.05, 0.295);
  group.add(atmScreen);

  // Cash slot glow
  const cashSlot = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.04, 0.04),
    new THREE.MeshBasicMaterial({ color: 0x4ade80 })
  );
  cashSlot.position.set(-0.48, 0.76, 0.295);
  group.add(cashSlot);

  // 2. Mini Convenience Store Rack (Kẹo cao su giải rượu, Nước sâm, Mồi khô)
  const kioskRack = new THREE.Mesh(
    new THREE.BoxGeometry(0.88, 1.35, 0.52),
    new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.6 })
  );
  kioskRack.position.set(0.42, 0.675, 0);
  kioskRack.castShadow = true;
  group.add(kioskRack);

  // Colorful gum & anti-hangover drink boxes on shelves
  const itemColors = [0x22c55e, 0xf43f5e, 0xfacc15, 0xa855f7];
  itemColors.forEach((col, idx) => {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.18, 0.14),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.4 })
    );
    box.position.set(0.15 + idx * 0.18, 0.95, 0.22);
    group.add(box);
  });

  // Overhead 3D ATM & Store Sign Sprite
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'rgba(30, 58, 138, 0.94)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(10, 10, 364, 76, 18);
    ctx.fill();
    ctx.stroke();

    ctx.font = '900 24px system-ui, sans-serif';
    ctx.fillStyle = '#e0f2fe';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏧 CÂY ATM 24/7 & TẠP HÓA', 192, 36);

    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillStyle = '#fde047';
    ctx.fillText('Rút Tiền Nhậu Tiếp • Kẹo Cao Su Giải Rượu', 192, 66);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const signSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
  );
  signSprite.position.set(0, 1.85, 0);
  signSprite.scale.set(1.15, 0.29, 1);
  signSprite.renderOrder = 12;
  group.add(signSprite);

  return group;
}

// 23. Standing Industrial Fan ("Quạt Công Nghiệp Đứng Trong Quán - Đạo Cụ Khiêng & Ném")
export function createStandingIndustrialFan(): {
  group: THREE.Group;
  bladesGroup: THREE.Group;
} {
  const group = new THREE.Group();
  const darkMetal = new THREE.MeshStandardMaterial({
    color: 0x27272a,
    metalness: 0.7,
    roughness: 0.35,
  });

  // Heavy circular base
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.26, 0.05, 16),
    darkMetal
  );
  base.position.y = 0.025;
  group.add(base);

  // Vertical pole
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.03, 1.15, 12),
    darkMetal
  );
  pole.position.y = 0.6;
  group.add(pole);

  // Cage ring
  const cage = new THREE.Mesh(
    new THREE.TorusGeometry(0.24, 0.015, 10, 24),
    new THREE.MeshStandardMaterial({
      color: 0xd4d4d8,
      metalness: 0.8,
      roughness: 0.25,
    })
  );
  cage.position.set(0, 1.18, 0.05);
  group.add(cage);

  // 3 Orange-Red Industrial Fan Blades
  const bladesGroup = new THREE.Group();
  bladesGroup.position.set(0, 1.18, 0.05);
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    roughness: 0.4,
  });
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.2, 0.012),
      bladeMat
    );
    const angle = (i / 3) * Math.PI * 2;
    b.position.set(Math.cos(angle) * 0.09, Math.sin(angle) * 0.09, 0);
    b.rotation.z = angle;
    bladesGroup.add(b);
  }
  group.add(bladesGroup);

  return { group, bladesGroup };
}

// 24. Slippery Yellow Puddle on Sidewalk ("Vũng Nước Vàng Khi Đua Đi WC Bị Va Chạm/Vấp Ngã")
export function createYellowPeePuddle(): THREE.Group {
  const group = new THREE.Group();
  const puddleMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xeab308,
    emissiveIntensity: 0.35,
    roughness: 0.12,
    metalness: 0.2,
    transparent: true,
    opacity: 0.88,
  });

  const mainDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 20),
    puddleMat
  );
  mainDisc.rotation.x = -Math.PI / 2;
  mainDisc.position.y = 0.014;
  group.add(mainDisc);

  const sideDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.24, 16),
    puddleMat
  );
  sideDisc.rotation.x = -Math.PI / 2;
  sideDisc.position.set(0.26, 0.015, 0.16);
  group.add(sideDisc);

  return group;
}





