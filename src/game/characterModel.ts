import * as THREE from 'three';
import {
  CharacterAvatar,
  ClothingType,
  HatType,
  GlassType,
  IKHandControlState,
} from './types';
import { createBeerMug } from './proceduralModels';

export type CheersAnimPhase = 'idle' | 'clink_center' | 'chug_gulp' | 'slam_finish';

export interface CharacterRig {
  root: THREE.Group;
  body: THREE.Group;
  torsoMesh: THREE.Mesh;
  head: THREE.Group;
  jaw: THREE.Group;
  fireBreathGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  mugHolder: THREE.Group;
  eyeLeft: THREE.Mesh;
  eyeRight: THREE.Mesh;
  pupilLeft: THREE.Mesh;
  pupilRight: THREE.Mesh;
  doodleGroup: THREE.Group;
  update: (
    delta: number,
    alcohol: number,
    isPassedOut: boolean,
    isCheersing: boolean,
    ikState?: IKHandControlState,
    extraState?: {
      bladderLevel?: number;
      isBreathingFire?: boolean;
      isStunned?: boolean;
      isSpicedMouth?: boolean;
      cheersPhase?: CheersAnimPhase;
      cupFillRatio?: number;
      isCallingMaiAnh?: boolean;
      isHeartbrokenMaiAnh?: boolean;
      isClimbingTree?: boolean;
    }
  ) => void;
  setDoodles: (doodles: string[]) => void;
  setNameplate: (
    name: string,
    title: string,
    alcoholLevel: number,
    isUser: boolean,
    avatar: CharacterAvatar,
    specialStatus?: string | null
  ) => void;
}

export function createChibiCharacter(
  avatar: CharacterAvatar = 'dog',
  clothing: ClothingType = 'tanktop_red',
  hat: HatType = 'none',
  glassType: GlassType = 'beer_mug'
): CharacterRig {
  const root = new THREE.Group();
  root.name = `Character_${avatar}`;

  // Animal skin colors
  const skinColors: Record<CharacterAvatar, number> = {
    dog: 0xd97706,     // Chó cỏ vàng
    cat: 0xf97316,     // Mèo mướp cam
    panda: 0xf8fafc,   // Gấu trúc trắng (Phi Quân)
    duck: 0xfacc15,    // Vịt vàng
    bear: 0x92400e,    // Gấu nâu (Khoa Nguyễn)
    hamster: 0xf59e0b, // Chuột Hamster vàng mật ong đuôi dài (Nga Phan)
  };

  const skinMat = new THREE.MeshStandardMaterial({
    color: skinColors[avatar],
    roughness: 0.6,
  });

  const secondaryMat = new THREE.MeshStandardMaterial({
    color:
      avatar === 'panda'
        ? 0x18181b
        : avatar === 'bear'
        ? 0xfde68a
        : avatar === 'hamster'
        ? 0xfffbeb
        : 0xfef08a,
    roughness: 0.5,
  });

  // Clothing color
  const clothesMat = new THREE.MeshStandardMaterial({
    color:
      clothing === 'tanktop_red'
        ? 0xdc2626
        : clothing === 'tanktop_white'
        ? 0xf8fafc
        : clothing === 'floral_shirt'
        ? 0x0284c7
        : 0xeab308,
    roughness: 0.7,
  });

  // Pelvis / Seat root
  const body = new THREE.Group();
  body.position.set(0, 0.55, 0); // Sitting on stool height
  root.add(body);

  // Torso / Belly (Chibi round body — scales into a giant drum as bladderLevel -> 100%)
  const torsoGeo = new THREE.SphereGeometry(0.26, 20, 20);
  torsoGeo.scale(1.0, 1.15, 0.95);
  const torsoMesh = new THREE.Mesh(torsoGeo, clothesMat);
  torsoMesh.position.y = 0.22;
  torsoMesh.castShadow = true;
  body.add(torsoMesh);

  // Articulated Legs with "Dép Tổ Ong" flip-flops
  const legGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.26, 12);
  legGeo.rotateX(Math.PI / 2);

  const honeycombSandalMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    roughness: 0.4,
  });
  const soleGeo = new THREE.BoxGeometry(0.1, 0.04, 0.18);

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.14, 0.02, 0.05);
  const leftLegMesh = new THREE.Mesh(legGeo, skinMat);
  leftLegMesh.position.set(0, 0, 0.09);
  leftLeg.add(leftLegMesh);
  const leftSandal = new THREE.Mesh(soleGeo, honeycombSandalMat);
  leftSandal.position.set(0, -0.07, 0.23);
  leftLeg.add(leftSandal);
  body.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.14, 0.02, 0.05);
  const rightLegMesh = new THREE.Mesh(legGeo, skinMat);
  rightLegMesh.position.set(0, 0, 0.09);
  rightLeg.add(rightLegMesh);
  const rightSandal = new THREE.Mesh(soleGeo, honeycombSandalMat);
  rightSandal.position.set(0, -0.07, 0.23);
  rightLeg.add(rightSandal);
  body.add(rightLeg);

  // Head Group (Chibi oversized head, pivots at neck)
  const head = new THREE.Group();
  head.position.set(0, 0.52, 0);
  body.add(head);

  const headGeo = new THREE.SphereGeometry(0.32, 24, 24);
  headGeo.scale(1.05, 0.98, 1.0);
  const headMesh = new THREE.Mesh(headGeo, skinMat);
  headMesh.castShadow = true;
  head.add(headMesh);

  // Snout / Nose / Beak
  if (
    avatar === 'dog' ||
    avatar === 'cat' ||
    avatar === 'panda' ||
    avatar === 'bear' ||
    avatar === 'hamster'
  ) {
    const snoutGeo = new THREE.SphereGeometry(0.11, 16, 16);
    snoutGeo.scale(1.2, 0.8, 1.1);
    const snoutMesh = new THREE.Mesh(snoutGeo, secondaryMat);
    snoutMesh.position.set(0, -0.04, 0.27);
    head.add(snoutMesh);

    // Nose tip (pink for Hamster Nga Phan, black for others)
    const noseGeo = new THREE.SphereGeometry(0.04, 12, 12);
    const noseMat = new THREE.MeshStandardMaterial({
      color: avatar === 'hamster' ? 0xfb7185 : 0x09090b,
      roughness: 0.3,
    });
    const noseMesh = new THREE.Mesh(noseGeo, noseMat);
    noseMesh.position.set(0, -0.01, 0.36);
    head.add(noseMesh);

    // Puffy snack-stuffed hamster cheeks + 2 cute white buck teeth for Nga Phan!
    if (avatar === 'hamster') {
      const cheekGeo = new THREE.SphereGeometry(0.115, 14, 14);
      [-0.21, 0.21].forEach((cx) => {
        const cheek = new THREE.Mesh(cheekGeo, secondaryMat);
        cheek.position.set(cx, -0.07, 0.22);
        head.add(cheek);
      });

      const toothGeo = new THREE.BoxGeometry(0.026, 0.055, 0.015);
      const toothMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.2,
      });
      [-0.016, 0.016].forEach((tx) => {
        const tooth = new THREE.Mesh(toothGeo, toothMat);
        tooth.position.set(tx, -0.085, 0.355);
        head.add(tooth);
      });
    }
  } else if (avatar === 'duck') {
    // Orange Duck Beak
    const beakGeo = new THREE.ConeGeometry(0.12, 0.22, 16);
    beakGeo.rotateX(Math.PI / 2);
    const beakMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4 });
    const beakMesh = new THREE.Mesh(beakGeo, beakMat);
    beakMesh.position.set(0, -0.05, 0.32);
    head.add(beakMesh);
  }

  // Animated Jaw / Mouth Group for Voice Lip-Sync & Laughing
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.11, 0.27);
  const mouthMat = new THREE.MeshStandardMaterial({
    color: 0x991b1b,
    roughness: 0.4,
  });
  const mouthGeo = new THREE.SphereGeometry(0.065, 14, 14);
  mouthGeo.scale(1.25, 0.55, 0.65);
  const mouthMesh = new THREE.Mesh(mouthGeo, mouthMat);
  jaw.add(mouthMesh);

  // Cute pink tongue inside mouth
  const tongueMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.4 });
  const tongueGeo = new THREE.SphereGeometry(0.038, 10, 10);
  tongueGeo.scale(1.1, 0.4, 0.8);
  const tongueMesh = new THREE.Mesh(tongueGeo, tongueMat);
  tongueMesh.position.set(0, -0.01, 0.02);
  jaw.add(tongueMesh);
  head.add(jaw);

  // 3D Fire-Breath Cone Group (when drinking Rượu Đế / Chuối Hột / Soju!)
  const fireBreathGroup = new THREE.Group();
  fireBreathGroup.position.set(0, -0.1, 0.35);
  const outerFlameGeo = new THREE.ConeGeometry(0.14, 0.58, 12);
  outerFlameGeo.rotateX(Math.PI / 2);
  const outerFlameMat = new THREE.MeshBasicMaterial({
    color: 0xf97316,
    transparent: true,
    opacity: 0.85,
  });
  const outerFlame = new THREE.Mesh(outerFlameGeo, outerFlameMat);
  outerFlame.position.z = 0.28;
  fireBreathGroup.add(outerFlame);

  const innerFlameGeo = new THREE.ConeGeometry(0.08, 0.42, 12);
  innerFlameGeo.rotateX(Math.PI / 2);
  const innerFlameMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.95,
  });
  const innerFlame = new THREE.Mesh(innerFlameGeo, innerFlameMat);
  innerFlame.position.z = 0.22;
  fireBreathGroup.add(innerFlame);
  fireBreathGroup.visible = false;
  head.add(fireBreathGroup);

  // Ears
  if (avatar === 'dog') {
    const earGeo = new THREE.BoxGeometry(0.08, 0.24, 0.05);
    [-0.26, 0.26].forEach((x, i) => {
      const ear = new THREE.Mesh(earGeo, skinMat);
      ear.position.set(x, 0.1, 0);
      ear.rotation.z = i === 0 ? 0.35 : -0.35;
      head.add(ear);
    });
  } else if (avatar === 'cat') {
    const earGeo = new THREE.ConeGeometry(0.1, 0.18, 4);
    [-0.2, 0.2].forEach((x, i) => {
      const ear = new THREE.Mesh(earGeo, skinMat);
      ear.position.set(x, 0.3, 0);
      ear.rotation.z = i === 0 ? 0.4 : -0.4;
      head.add(ear);
    });
  } else if (avatar === 'panda') {
    const earGeo = new THREE.SphereGeometry(0.1, 16, 16);
    const earMat = new THREE.MeshStandardMaterial({ color: 0x18181b });
    [-0.26, 0.26].forEach((x) => {
      const ear = new THREE.Mesh(earGeo, earMat);
      ear.position.set(x, 0.25, 0);
      head.add(ear);
    });

    const patchGeo = new THREE.SphereGeometry(0.09, 12, 12);
    patchGeo.scale(1.1, 0.9, 0.5);
    [-0.14, 0.14].forEach((x) => {
      const patch = new THREE.Mesh(patchGeo, earMat);
      patch.position.set(x, 0.05, 0.26);
      head.add(patch);
    });
  } else if (avatar === 'bear') {
    // Gấu Nâu (Khoa Nguyễn): Round brown bear ears with warm tan inner ear pads
    const earGeo = new THREE.SphereGeometry(0.11, 16, 16);
    const innerEarGeo = new THREE.SphereGeometry(0.06, 12, 12);
    [-0.25, 0.25].forEach((x) => {
      const ear = new THREE.Mesh(earGeo, skinMat);
      ear.position.set(x, 0.26, 0);
      head.add(ear);

      const innerEar = new THREE.Mesh(innerEarGeo, secondaryMat);
      innerEar.position.set(x, 0.26, 0.065);
      head.add(innerEar);
    });
  } else if (avatar === 'hamster') {
    // Chuột Hamster Đuôi Dài (Nga Phan): Cute rounded ears with rosy pink inner ear pads
    const earGeo = new THREE.SphereGeometry(0.115, 16, 16);
    earGeo.scale(1.0, 1.0, 0.55);
    const pinkEarMat = new THREE.MeshStandardMaterial({
      color: 0xfda4af,
      roughness: 0.45,
    });
    const innerEarGeo = new THREE.SphereGeometry(0.068, 12, 12);
    innerEarGeo.scale(1.0, 1.0, 0.5);
    [-0.26, 0.26].forEach((x) => {
      const ear = new THREE.Mesh(earGeo, skinMat);
      ear.position.set(x, 0.26, 0.02);
      head.add(ear);

      const innerEar = new THREE.Mesh(innerEarGeo, pinkEarMat);
      innerEar.position.set(x, 0.26, 0.055);
      head.add(innerEar);
    });
  }

  // Long Curving Hamster Tail ("Chuột Hamster Đuôi Dài" cho NPC Nga Phan)
  let hamsterTailGroup: THREE.Group | null = null;
  if (avatar === 'hamster') {
    hamsterTailGroup = new THREE.Group();
    hamsterTailGroup.position.set(0, 0.08, -0.22);
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0xfda4af,
      roughness: 0.5,
    });
    // Multi-segment long curving tail sticking out behind the stool so everyone sees it!
    const seg1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.036, 0.34, 10),
      tailMat
    );
    seg1.rotation.x = -Math.PI / 2.6;
    seg1.position.set(0, 0.06, -0.15);
    hamsterTailGroup.add(seg1);

    const seg2 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.028, 0.34, 10),
      tailMat
    );
    seg2.rotation.x = -Math.PI / 5;
    seg2.position.set(0, 0.25, -0.34);
    hamsterTailGroup.add(seg2);

    const tailTip = new THREE.Mesh(
      new THREE.SphereGeometry(0.024, 10, 10),
      tailMat
    );
    tailTip.position.set(0, 0.39, -0.44);
    hamsterTailGroup.add(tailTip);

    body.add(hamsterTailGroup);
  }

  // Eyes (Blinking / Wobbling / Meme face)
  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
  const eyeBlackMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.2 });
  const eyeGeo = new THREE.SphereGeometry(0.055, 16, 16);
  const pupilGeo = new THREE.SphereGeometry(0.028, 12, 12);

  const eyeLeft = new THREE.Mesh(eyeGeo, eyeWhiteMat);
  eyeLeft.position.set(-0.13, 0.06, 0.28);
  head.add(eyeLeft);

  const pupilLeft = new THREE.Mesh(pupilGeo, eyeBlackMat);
  pupilLeft.position.set(-0.13, 0.06, 0.325);
  head.add(pupilLeft);

  const eyeRight = new THREE.Mesh(eyeGeo, eyeWhiteMat);
  eyeRight.position.set(0.13, 0.06, 0.28);
  head.add(eyeRight);

  const pupilRight = new THREE.Mesh(pupilGeo, eyeBlackMat);
  pupilRight.position.set(0.13, 0.06, 0.325);
  head.add(pupilRight);

  // Accessories: Sunglasses / Traffic Helmet / Cold Towel on Head
  if (hat === 'sunglasses') {
    const glassesMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.1 });
    const frameGeo = new THREE.BoxGeometry(0.42, 0.08, 0.04);
    const glasses = new THREE.Mesh(frameGeo, glassesMat);
    glasses.position.set(0, 0.07, 0.33);
    head.add(glasses);
  } else if (hat === 'traffic_helmet') {
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.3 });
    const helmetGeo = new THREE.SphereGeometry(0.34, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const helmet = new THREE.Mesh(helmetGeo, helmetMat);
    helmet.position.set(0, 0.04, 0);
    head.add(helmet);
  } else if (hat === 'towel') {
    const towelMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.8 });
    const towelGeo = new THREE.BoxGeometry(0.36, 0.07, 0.26);
    const towel = new THREE.Mesh(towelGeo, towelMat);
    towel.position.set(0, 0.31, 0.02);
    head.add(towel);
  }

  // Accessories: Gold Chain (Dây chuyền vàng)
  if (clothing === 'gold_chain') {
    const chainMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.95,
      roughness: 0.2,
    });
    const chainGeo = new THREE.TorusGeometry(0.22, 0.025, 12, 24);
    chainGeo.rotateX(Math.PI / 2.5);
    const chain = new THREE.Mesh(chainGeo, chainMat);
    chain.position.set(0, 0.44, 0.08);
    body.add(chain);
  }

  // Doodle Group on face (for passed out graffiti)
  const doodleGroup = new THREE.Group();
  doodleGroup.position.set(0, 0, 0.32);
  head.add(doodleGroup);

  // Arms
  const armGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.28, 12);

  // Left Arm (resting on table / slapping table / holding phone to ear when calling Mai Anh)
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.28, 0.36, 0.05);
  leftArm.rotation.set(0.4, 0, 0.3);
  const leftArmMesh = new THREE.Mesh(armGeo, skinMat);
  leftArmMesh.position.y = -0.14;
  leftArm.add(leftArmMesh);

  // 3D Glowing Smartphone in Left Hand (Used when Phi Quân hits 80% alcohol & calls NYC Mai Anh)
  const phoneGroup = new THREE.Group();
  phoneGroup.position.set(0, -0.27, 0.05);
  const phoneBodyGeo = new THREE.BoxGeometry(0.09, 0.16, 0.018);
  const phoneBodyMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.3,
    metalness: 0.7,
  });
  const phoneBody = new THREE.Mesh(phoneBodyGeo, phoneBodyMat);
  phoneGroup.add(phoneBody);

  const phoneScreenGeo = new THREE.PlaneGeometry(0.076, 0.14);
  const phoneScreenMat = new THREE.MeshBasicMaterial({
    color: 0xf43f5e,
    side: THREE.DoubleSide,
  });
  const phoneScreen = new THREE.Mesh(phoneScreenGeo, phoneScreenMat);
  phoneScreen.position.z = 0.011;
  phoneGroup.add(phoneScreen);
  phoneGroup.visible = false;
  leftArm.add(phoneGroup);

  body.add(leftArm);

  // Right Arm (IK Controlled Hand holding Beer Mug / Chopsticks)
  const rightArm = new THREE.Group();
  rightArm.position.set(0.28, 0.36, 0.05);
  rightArm.rotation.set(0.7, 0, -0.4);
  const rightArmMesh = new THREE.Mesh(armGeo, skinMat);
  rightArmMesh.position.y = -0.14;
  rightArm.add(rightArmMesh);
  body.add(rightArm);

  // Mug Holder at right hand
  const mugHolder = new THREE.Group();
  mugHolder.position.set(0, -0.28, 0.06);
  const mugMesh = createBeerMug(glassType);
  mugMesh.scale.set(0.85, 0.85, 0.85);

  // If NPC Nga Phan (Hamster): convert her glass into a fizzy dark Coca-Cola glass with red label & straw!
  if (avatar === 'hamster') {
    const colaBeer = mugMesh.userData?.beer as THREE.Mesh | undefined;
    if (colaBeer) {
      const colaMat = (colaBeer.material as THREE.MeshStandardMaterial).clone();
      colaMat.color.setHex(0x271206); // Dark Coca-Cola brown-black
      colaMat.emissive.setHex(0x1c0a00);
      colaBeer.material = colaMat;
    }
    // Red Coca-Cola band around glass
    const cocaBand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.088, 0.084, 0.065, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xdc2626, side: THREE.DoubleSide })
    );
    cocaBand.position.y = 0.11;
    mugMesh.add(cocaBand);

    // Red drinking straw sticking out of the Coca-Cola glass
    const straw = new THREE.Mesh(
      new THREE.CylinderGeometry(0.009, 0.009, 0.26, 8),
      new THREE.MeshStandardMaterial({ color: 0xef4444 })
    );
    straw.position.set(0.03, 0.2, 0.02);
    straw.rotation.z = -0.22;
    mugMesh.add(straw);
  }

  mugHolder.add(mugMesh);
  rightArm.add(mugHolder);

  // Doodles on face generator
  const setDoodles = (doodles: string[]) => {
    while (doodleGroup.children.length > 0) {
      doodleGroup.remove(doodleGroup.children[0]);
    }
    const markerMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });

    doodles.forEach((d) => {
      if (d === 'mustache') {
        const mGeo = new THREE.TorusGeometry(0.08, 0.012, 8, 16, Math.PI);
        const mMesh = new THREE.Mesh(mGeo, markerMat);
        mMesh.position.set(0, -0.12, 0.02);
        doodleGroup.add(mMesh);
      } else if (d === 'cat_whiskers') {
        [-0.18, 0.18].forEach((x) => {
          for (let w = -1; w <= 1; w++) {
            const wGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.12, 6);
            wGeo.rotateZ(Math.PI / 2 + w * 0.2);
            const whisker = new THREE.Mesh(wGeo, markerMat);
            whisker.position.set(x, -0.06 + w * 0.03, 0.01);
            doodleGroup.add(whisker);
          }
        });
      } else if (d === 'spiral_glasses') {
        [-0.12, 0.12].forEach((x) => {
          const ringGeo = new THREE.RingGeometry(0.03, 0.045, 16);
          const ring = new THREE.Mesh(ringGeo, markerMat);
          ring.position.set(x, 0.06, 0.03);
          doodleGroup.add(ring);
        });
      }
    });
  };

  // ============================================================================
  // 3D OVERHEAD NAMEPLATE BILLBOARD SPRITE (Displays Player Name + Avatar + Alcohol %)
  // ============================================================================
  const nameCanvas = document.createElement('canvas');
  nameCanvas.width = 512;
  nameCanvas.height = 148;
  const nameCtx = nameCanvas.getContext('2d');
  const nameTexture = new THREE.CanvasTexture(nameCanvas);
  nameTexture.colorSpace = THREE.SRGBColorSpace;
  nameTexture.needsUpdate = true;

  const nameSpriteMat = new THREE.SpriteMaterial({
    map: nameTexture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const nameplateSprite = new THREE.Sprite(nameSpriteMat);
  nameplateSprite.position.set(0, 1.06, 0);
  nameplateSprite.scale.set(1.22, 0.35, 1);
  nameplateSprite.renderOrder = 15;
  body.add(nameplateSprite);

  let lastNameplateKey = '';

  const setNameplate = (
    name: string,
    title: string,
    alcoholLevel: number,
    isUser: boolean,
    charAvatar: CharacterAvatar,
    specialStatus?: string | null
  ) => {
    const roundedAlc = Math.round(alcoholLevel);
    const cacheKey = `${name}|${title}|${roundedAlc}|${isUser}|${charAvatar}|${specialStatus || ''}`;
    if (cacheKey === lastNameplateKey || !nameCtx) return;
    lastNameplateKey = cacheKey;

    const w = nameCanvas.width;
    const h = nameCanvas.height;
    nameCtx.clearRect(0, 0, w, h);

    const avatarEmojiMap: Record<CharacterAvatar, string> = {
      panda: '🐼',
      bear: '🐻',
      cat: '🐱',
      dog: '🐕',
      duck: '🦆',
      hamster: '🐹',
    };
    const avatarLabelMap: Record<CharacterAvatar, string> = {
      panda: 'Gấu Trúc',
      bear: 'Gấu Nâu',
      cat: 'Mèo Mướp',
      dog: 'Chó Cỏ',
      duck: 'Vịt Vàng',
      hamster: 'Hamster Đuôi Dài',
    };

    const isColaHamster = charAvatar === 'hamster';

    const borderColor = specialStatus
      ? '#ec4899'
      : isColaHamster
      ? '#38bdf8'
      : isUser
      ? '#f59e0b'
      : roundedAlc >= 71
      ? '#f43f5e'
      : roundedAlc >= 31
      ? '#eab308'
      : '#10b981';

    // Rounded background pill with subtle glow
    const padX = 18;
    const padY = 12;
    const pillW = w - padX * 2;
    const pillH = h - padY * 2 - 14;
    const r = 28;

    nameCtx.save();
    nameCtx.beginPath();
    nameCtx.moveTo(padX + r, padY);
    nameCtx.lineTo(padX + pillW - r, padY);
    nameCtx.quadraticCurveTo(padX + pillW, padY, padX + pillW, padY + r);
    nameCtx.lineTo(padX + pillW, padY + pillH - r);
    nameCtx.quadraticCurveTo(padX + pillW, padY + pillH, padX + pillW - r, padY + pillH);
    // Little pointer triangle at bottom center pointing down to head
    nameCtx.lineTo(w / 2 + 12, padY + pillH);
    nameCtx.lineTo(w / 2, padY + pillH + 13);
    nameCtx.lineTo(w / 2 - 12, padY + pillH);
    nameCtx.lineTo(padX + r, padY + pillH);
    nameCtx.quadraticCurveTo(padX, padY + pillH, padX, padY + pillH - r);
    nameCtx.lineTo(padX, padY + r);
    nameCtx.quadraticCurveTo(padX, padY, padX + r, padY);
    nameCtx.closePath();

    nameCtx.fillStyle = specialStatus
      ? 'rgba(80, 7, 36, 0.95)'
      : isColaHamster
      ? 'rgba(12, 74, 110, 0.94)'
      : isUser
      ? 'rgba(24, 24, 27, 0.94)'
      : 'rgba(9, 9, 11, 0.90)';
    nameCtx.fill();
    nameCtx.lineWidth = 5;
    nameCtx.strokeStyle = borderColor;
    nameCtx.stroke();
    nameCtx.restore();

    // Main Line: Avatar Emoji + Bold Player Name
    const emoji = avatarEmojiMap[charAvatar] || '🍻';
    const speciesLabel = avatarLabelMap[charAvatar] || '';
    nameCtx.font = '900 34px system-ui, -apple-system, sans-serif';
    nameCtx.textAlign = 'center';
    nameCtx.textBaseline = 'middle';
    nameCtx.fillStyle = isUser
      ? '#fde047'
      : isColaHamster
      ? '#bae6fd'
      : '#ffffff';
    nameCtx.fillText(`${emoji} ${name}`, w / 2, padY + 38);

    // Sub Line: Special Status (e.g., Calling Mai Anh) or Coca 0% (for Nga Phan) or Species + Alcohol % Badge
    nameCtx.font = 'bold 21px system-ui, -apple-system, sans-serif';
    nameCtx.fillStyle = specialStatus
      ? '#fbcfe8'
      : isColaHamster
      ? '#fde047'
      : roundedAlc >= 71
      ? '#fda4af'
      : roundedAlc >= 31
      ? '#fde047'
      : '#6ee7b7';
    const subText =
      specialStatus ||
      (isColaHamster
        ? '🥤 Uống Coca (0% Cồn) • 🍗 Phá Mồi'
        : `${speciesLabel} • 🍺 ${roundedAlc}% Cồn`);
    nameCtx.fillText(subText, w / 2, padY + 80);

    nameTexture.needsUpdate = true;
  };

  let animTimer = 0;

  // Ragdoll & Inverse Kinematics (IK) Update Loop
  const update = (
    delta: number,
    alcohol: number,
    isPassedOut: boolean,
    isCheersing: boolean,
    ikState?: IKHandControlState,
    extraState?: {
      bladderLevel?: number;
      isBreathingFire?: boolean;
      isStunned?: boolean;
      isSpicedMouth?: boolean;
      cheersPhase?: CheersAnimPhase;
      cupFillRatio?: number;
      isCallingMaiAnh?: boolean;
      isHeartbrokenMaiAnh?: boolean;
      isClimbingTree?: boolean;
      isWalkingToTree?: boolean;
    }
  ) => {
    animTimer += delta;

    // Wag Nga Phan's long hamster tail & munch snacks continuously!
    if (hamsterTailGroup) {
      hamsterTailGroup.rotation.y = Math.sin(animTimer * 11) * 0.48;
      hamsterTailGroup.rotation.z = Math.cos(animTimer * 7) * 0.18;
    }

    // Show/hide 3D phone in left hand when Phi Quân calls NYC Mai Anh
    phoneGroup.visible = !!extraState?.isCallingMaiAnh;

    // 0a. Update 3D Liquid & Foam inside Held Mug based on cupFillRatio
    const fillRatio =
      extraState?.cupFillRatio !== undefined ? extraState.cupFillRatio : 0.85;
    const mugBeer = mugMesh.userData?.beer as THREE.Mesh | undefined;
    const mugFoam = mugMesh.userData?.foam as THREE.Mesh | undefined;
    if (mugBeer && mugFoam) {
      const clampedFill = Math.max(0, Math.min(1, fillRatio));
      mugBeer.visible = clampedFill > 0.02;
      mugFoam.visible = clampedFill > 0.05;
      mugBeer.scale.y = Math.max(0.05, clampedFill);
      mugBeer.position.y = 0.01 + 0.09 * clampedFill;
      mugFoam.position.y = 0.02 + 0.18 * clampedFill;
    }

    // 0b. Dynamic Beer Belly Inflation ("Bụng Bia 100% phình to tròn xoe như cái trống!")
    const bladderRatio = Math.max(0, Math.min((extraState?.bladderLevel || 0) / 100, 1));
    torsoMesh.scale.set(
      1.0 + bladderRatio * 0.62,
      1.0 + bladderRatio * 0.34,
      1.0 + bladderRatio * 0.78
    );

    // 0c. Rượu Đế 3D Fire Breath Animation ("Khè ra lửa")
    if (extraState?.isBreathingFire) {
      fireBreathGroup.visible = true;
      const flicker = 0.85 + Math.sin(animTimer * 35) * 0.3;
      fireBreathGroup.scale.set(flicker, flicker, 0.9 + Math.cos(animTimer * 28) * 0.35);
      jaw.scale.set(1.5, 2.2, 1.2);
    } else {
      fireBreathGroup.visible = false;
    }

    // 0c. "Bỏng Mỏ" (Spiced Mouth from Bom Hỗn Hợp Cocktail — flailing panic!)
    if (extraState?.isSpicedMouth) {
      body.position.y = 0.65 + Math.abs(Math.sin(animTimer * 18)) * 0.14;
      head.rotation.y = Math.sin(animTimer * 22) * 0.65;
      leftArm.rotation.set(2.2 + Math.sin(animTimer * 25) * 0.5, 0, 0.6);
      rightArm.rotation.set(2.2 - Math.sin(animTimer * 25) * 0.5, 0, -0.6);
      leftLeg.rotation.x = Math.PI / 2 + Math.sin(animTimer * 20) * 0.7;
      rightLeg.rotation.x = Math.PI / 2 - Math.sin(animTimer * 20) * 0.7;
      jaw.scale.set(1.5, 2.1, 1.2);
      return;
    }

    // 0d. "Tàu Ngầm" 5s Stunned State (Choáng váng quay cuồng)
    if (extraState?.isStunned) {
      head.rotation.z = Math.sin(animTimer * 14) * 0.45;
      head.rotation.x = Math.cos(animTimer * 14) * 0.35;
      body.rotation.z = Math.sin(animTimer * 8) * 0.35;
      pupilLeft.position.x = -0.13 + Math.sin(animTimer * 18) * 0.025;
      pupilRight.position.x = 0.13 - Math.sin(animTimer * 18) * 0.025;
      return;
    }

    // 0e. NPC Phi Quân (>=80% cồn) rút điện thoại gọi cho NYC Mai Anh!
    if (extraState?.isCallingMaiAnh) {
      body.position.y = 0.55 + Math.abs(Math.sin(animTimer * 8)) * 0.04;
      body.rotation.z = Math.sin(animTimer * 5) * 0.18;
      head.rotation.z = -0.22 + Math.sin(animTimer * 9) * 0.08;
      head.rotation.y = Math.sin(animTimer * 4) * 0.15;
      // Left hand holds glowing smartphone right up to Panda ear
      leftArm.rotation.set(2.15 + Math.sin(animTimer * 12) * 0.08, 0.38, 0.55);
      // Right hand waves beer mug dramatically while pleading with Mai Anh
      rightArm.rotation.set(1.1 + Math.sin(animTimer * 10) * 0.35, -0.2, -0.35);
      // Talking jaw motion
      jaw.scale.set(1.25, 0.9 + Math.abs(Math.sin(animTimer * 18)) * 1.15, 1.0);
      return;
    }

    // 0f. Phi Quân bị Mai Anh mắng & block -> Suy tình gục đầu khóc rưng rức
    if (extraState?.isHeartbrokenMaiAnh) {
      body.position.y = 0.48;
      body.rotation.x = 0.55;
      body.rotation.z = Math.sin(animTimer * 14) * 0.06; // Sobbing shoulder shake
      head.rotation.x = 0.45 + Math.sin(animTimer * 16) * 0.08;
      leftArm.rotation.set(1.65, 0.5, 0.45);
      rightArm.rotation.set(1.65, -0.5, -0.45);
      jaw.scale.set(1.3, 1.4, 1.0);
      return;
    }

    // 0g-1. NPC Khoa Nguyễn đang lảo đảo chạy từ ghế ra gốc cây (hoặc từ gốc cây về lại ghế)
    if (extraState?.isWalkingToTree) {
      const runCycle = animTimer * 14;
      body.position.y = 0.64 + Math.abs(Math.sin(runCycle)) * 0.11;
      body.rotation.x = 0.18;
      body.rotation.z = Math.sin(runCycle * 0.5) * 0.22; // Drunken waddle sway
      head.rotation.y = Math.sin(runCycle * 0.5) * 0.25;
      head.rotation.z = Math.cos(runCycle * 0.5) * 0.15;
      leftArm.rotation.set(1.2 + Math.sin(runCycle) * 0.75, 0.2, 0.45);
      rightArm.rotation.set(1.2 - Math.sin(runCycle) * 0.75, -0.2, -0.45);
      leftLeg.rotation.x = Math.sin(runCycle) * 0.85;
      rightLeg.rotation.x = -Math.sin(runCycle) * 0.85;
      jaw.scale.set(1.2, 1.1 + Math.abs(Math.sin(runCycle)) * 0.6, 1.0);
      return;
    }

    // 0g-2. NPC Khoa Nguyễn (Gấu Nâu >= 80% cồn) ôm thân cây xanh trèo lên và đu cành cây!
    if (extraState?.isClimbingTree) {
      const climbCycle = animTimer * 9.5;
      body.position.y = 0.64 + Math.sin(climbCycle) * 0.11;
      body.rotation.x = -0.24; // Leaning chest into tree trunk / branch
      body.rotation.z = Math.sin(climbCycle * 0.5) * 0.22;
      // Head turns toward the camera/table to wave and shout at friends while up in the tree
      head.rotation.y = Math.sin(animTimer * 3.8) * 0.35;
      head.rotation.x = 0.12;
      // Left arm hugs the trunk/branch tightly, right arm waves beer mug high in the air!
      leftArm.rotation.set(2.15 + Math.sin(climbCycle) * 0.45, 0.42, 0.45);
      rightArm.rotation.set(2.35 + Math.cos(climbCycle) * 0.55, -0.35, -0.55);
      // Legs pedaling vigorously up the trunk
      leftLeg.rotation.x = Math.PI / 3 + Math.sin(climbCycle) * 0.58;
      rightLeg.rotation.x = Math.PI / 3 - Math.sin(climbCycle) * 0.58;
      jaw.scale.set(1.3, 1.15 + Math.abs(Math.sin(animTimer * 14)) * 0.95, 1.0);
      return;
    }

    // 1. Passed out state ("Sập nguồn 100%")
    if (isPassedOut) {
      body.position.y = THREE.MathUtils.damp(body.position.y, 0.38, 4, delta);
      body.position.z = THREE.MathUtils.damp(body.position.z, 0, 4, delta);
      body.rotation.x = THREE.MathUtils.damp(body.rotation.x, 1.25, 5, delta);
      body.rotation.z = THREE.MathUtils.damp(body.rotation.z, 0.3, 3, delta);
      head.rotation.x = THREE.MathUtils.damp(head.rotation.x, 0.4, 4, delta);
      head.rotation.y = THREE.MathUtils.damp(head.rotation.y, 0.6, 4, delta);
      rightArm.rotation.set(0.2, 0, -1.2);
      leftArm.rotation.set(0.2, 0, 1.2);
      pupilLeft.scale.set(0.1, 0.1, 0.1);
      pupilRight.scale.set(0.1, 0.1, 0.1);
      jaw.scale.set(0.6, 0.3, 0.6);
      return;
    }

    pupilLeft.scale.set(1, 1, 1);
    pupilRight.scale.set(1, 1, 1);

    const drunkRatio = Math.max(0, Math.min(alcohol / 100, 1));
    const wobbleSpeed = 1.2 + drunkRatio * 1.6;
    const wobbleMag = drunkRatio * 0.35;

    // 2. Fallen backward off plastic stool ("Ngã lộn cổ khỏi ghế nhựa!")
    if (ikState?.isFallenOffChair) {
      body.position.y = THREE.MathUtils.damp(body.position.y, 0.24, 6, delta);
      body.position.z = THREE.MathUtils.damp(body.position.z, -0.52, 6, delta);
      body.rotation.x = THREE.MathUtils.damp(body.rotation.x, -1.45, 7, delta);
      body.rotation.z = THREE.MathUtils.damp(
        body.rotation.z,
        Math.sin(animTimer * 8) * 0.25,
        5,
        delta
      );
      // Legs kicking up in the air
      leftLeg.rotation.x = Math.sin(animTimer * 12) * 0.45;
      rightLeg.rotation.x = -Math.sin(animTimer * 12) * 0.45;
      leftArm.rotation.set(1.8, 0, 0.8 + Math.sin(animTimer * 10) * 0.3);
      rightArm.rotation.set(1.8, 0, -0.8 - Math.sin(animTimer * 10) * 0.3);
      jaw.scale.set(1.3, 1.8, 1.2);
      return;
    }

    // 3. Free-Roam Standing & Ragdoll Open-World Sandbox Mode ("Đứng dậy đi lại / Hỗn chiến")
    if (ikState?.controlMode === 'free_roam') {
      // 3a. Faceplant ("Vấp cục gạch / két bia ngã sấp mặt xuống vỉa hè!")
      if (ikState.isFaceplanted) {
        body.position.y = THREE.MathUtils.damp(body.position.y, 0.18, 10, delta);
        body.position.z = THREE.MathUtils.damp(body.position.z, 0.35, 10, delta);
        body.rotation.x = THREE.MathUtils.damp(body.rotation.x, 1.48, 10, delta);
        body.rotation.z = THREE.MathUtils.damp(
          body.rotation.z,
          Math.sin(animTimer * 10) * 0.12,
          6,
          delta
        );
        leftArm.rotation.set(2.4, 0.4, 0.85);
        rightArm.rotation.set(2.4, -0.4, -0.85);
        leftLeg.rotation.x = Math.PI / 2 + Math.sin(animTimer * 14) * 0.35;
        rightLeg.rotation.x = Math.PI / 2 - Math.sin(animTimer * 14) * 0.35;
        jaw.scale.set(1.4, 1.8, 1.2);
        return;
      }

      // 3b. Crawling Mode ("Kỹ năng Bò Lê Bò Lết bằng tứ chi — bất tử trước xe máy & đòn ngang!")
      if (ikState.isCrawlingMode) {
        const crawlCycle = animTimer * 11;
        body.position.y = THREE.MathUtils.damp(
          body.position.y,
          0.26 + Math.abs(Math.sin(crawlCycle)) * 0.05,
          10,
          delta
        );
        body.position.z = THREE.MathUtils.damp(body.position.z, 0.15, 8, delta);
        body.rotation.x = THREE.MathUtils.damp(body.rotation.x, 1.28, 8, delta);
        body.rotation.z = Math.sin(crawlCycle * 0.5) * 0.18;
        head.rotation.x = -0.75 + Math.sin(crawlCycle) * 0.1; // Looking forward while crawling
        leftArm.rotation.set(1.55 + Math.sin(crawlCycle) * 0.65, 0.2, 0.35);
        rightArm.rotation.set(1.55 - Math.sin(crawlCycle) * 0.65, -0.2, -0.35);
        leftLeg.rotation.x = Math.PI / 2.2 - Math.sin(crawlCycle) * 0.65;
        rightLeg.rotation.x = Math.PI / 2.2 + Math.sin(crawlCycle) * 0.65;
        return;
      }

      const isMoving =
        ikState.freeRoamPos.isMoving ||
        ikState.isUrgentPeeRushing ||
        ikState.isChasedByCleaverChef;
      const speedMult =
        ikState.isUrgentPeeRushing || ikState.isChasedByCleaverChef ? 18 : 10 + drunkRatio * 4;
      const walkCycle = isMoving ? animTimer * speedMult : animTimer * 2;
      const waddleBounce = isMoving ? Math.abs(Math.sin(walkCycle)) * 0.09 : 0;

      body.position.y = THREE.MathUtils.damp(body.position.y, 0.62 + waddleBounce, 8, delta);
      body.position.z = THREE.MathUtils.damp(body.position.z, 0, 6, delta);

      // Legs point down for standing and swing when walking
      leftLeg.rotation.x = THREE.MathUtils.damp(
        leftLeg.rotation.x,
        Math.PI / 2 + (isMoving ? Math.sin(walkCycle) * (0.55 + drunkRatio * 0.35) : 0),
        10,
        delta
      );
      rightLeg.rotation.x = THREE.MathUtils.damp(
        rightLeg.rotation.x,
        Math.PI / 2 + (isMoving ? -Math.sin(walkCycle) * (0.55 + drunkRatio * 0.35) : 0),
        10,
        delta
      );
      // Drunken leg twist (or knock-knees when urgent pee rushing!)
      leftLeg.rotation.z = ikState.isUrgentPeeRushing
        ? -0.22
        : isMoving
        ? Math.cos(walkCycle * 0.5) * drunkRatio * 0.25
        : 0;
      rightLeg.rotation.z = ikState.isUrgentPeeRushing
        ? 0.22
        : isMoving
        ? -Math.cos(walkCycle * 0.5) * drunkRatio * 0.25
        : 0;

      // Headbutt / Tackle lunge (RMB in Free-Roam)
      if (ikState.isHeadbutting) {
        body.rotation.x = THREE.MathUtils.damp(body.rotation.x, 0.95, 14, delta);
        head.rotation.x = THREE.MathUtils.damp(head.rotation.x, 0.5, 14, delta);
      } else {
        body.rotation.x = THREE.MathUtils.damp(
          body.rotation.x,
          (isMoving ? 0.15 : 0) + Math.sin(animTimer * wobbleSpeed) * wobbleMag * 0.6,
          6,
          delta
        );
      }

      body.rotation.z = THREE.MathUtils.damp(
        body.rotation.z,
        (isMoving ? Math.cos(walkCycle) * 0.18 : 0) +
          Math.cos(animTimer * wobbleSpeed) * wobbleMag * 0.7,
        6,
        delta
      );

      // Arms in Free-Roam: Heavy Prop Overhead Carry, Urgent Pee Belly Clutch, Wingman Grab/Hold, or Swinging
      if (ikState.carriedHeavyProp && ikState.carriedHeavyProp !== 'none') {
        leftArm.rotation.set(2.85, 0.25, 0.2);
        rightArm.rotation.set(2.85, -0.25, -0.2);
      } else if (ikState.isUrgentPeeRushing) {
        // Clutching 100% beer belly with both hands!
        leftArm.rotation.set(1.15, 0.55, 0.45);
        rightArm.rotation.set(1.15, -0.55, -0.45);
        jaw.scale.set(1.35, 1.6, 1.1);
      } else if (
        ikState.isGrabbing ||
        ikState.isHoldingGrabSupport ||
        ikState.draggingFriendId
      ) {
        leftArm.rotation.set(1.45, 0.28, 0.12);
        rightArm.rotation.set(1.45, -0.28, -0.12);
      } else if (ikState.isChasedByCleaverChef) {
        // Panic arms waving overhead while chased by chef with meat cleaver!
        leftArm.rotation.set(2.5 + Math.sin(walkCycle) * 0.45, 0, 0.5);
        rightArm.rotation.set(2.5 - Math.sin(walkCycle) * 0.45, 0, -0.5);
        jaw.scale.set(1.5, 2.0, 1.2);
      } else {
        leftArm.rotation.set(
          0.4 + (isMoving ? -Math.sin(walkCycle) * 0.5 : 0),
          0,
          0.35
        );
        rightArm.rotation.set(
          0.5 + (isMoving ? Math.sin(walkCycle) * 0.5 : 0),
          0,
          -0.35
        );
      }
      return;
    }

    // 4. Seated Mode (Default 70% gameplay on plastic stool)
    const cheersPhase = extraState?.cheersPhase || (isCheersing ? 'clink_center' : 'idle');

    // Lean forward into the table during Phase 1 ('clink_center') so mugs converge!
    const targetBodyZ =
      cheersPhase === 'clink_center' || ikState?.isCheersHolding ? 0.38 : 0;
    const targetBodyY =
      cheersPhase === 'clink_center' ? 0.62 : 0.55;

    body.position.y = THREE.MathUtils.damp(body.position.y, targetBodyY, 7, delta);
    body.position.z = THREE.MathUtils.damp(body.position.z, targetBodyZ, 7, delta);
    leftLeg.rotation.set(0, 0, 0);
    rightLeg.rotation.set(0, 0, 0);

    // Perlin/Simplex style wave sway + Chair Balance tilt
    const swayX = Math.sin(animTimer * wobbleSpeed) * wobbleMag;
    const swayZ = Math.cos(animTimer * (wobbleSpeed * 0.8)) * (wobbleMag * 0.7);
    const chairTiltZ = ((ikState?.chairBalance || 0) / 100) * 0.68;

    // Emote overrides
    const emote = ikState?.emote || 'none';

    if (emote === 'sleep_table') {
      // Phím 4: Gục đầu xuống bàn ngủ
      body.rotation.x = THREE.MathUtils.damp(body.rotation.x, 0.92, 6, delta);
      head.rotation.x = THREE.MathUtils.damp(head.rotation.x, 0.35, 6, delta);
    } else if (cheersPhase === 'clink_center' || ikState?.isCheersHolding) {
      // Phase 1: Lean deeply toward table center to clink glasses
      body.rotation.x = THREE.MathUtils.damp(body.rotation.x, 0.52 + swayX * 0.25, 8, delta);
    } else if (cheersPhase === 'chug_gulp') {
      // Phase 2: Lean slightly back while chugging
      body.rotation.x = THREE.MathUtils.damp(body.rotation.x, -0.14 + swayX * 0.2, 8, delta);
    } else if (cheersPhase === 'slam_finish') {
      // Phase 3: Slam mug down on table and shout "KHÀ!"
      body.rotation.x = THREE.MathUtils.damp(body.rotation.x, 0.18, 10, delta);
    } else if (alcohol > 70) {
      body.rotation.x = THREE.MathUtils.damp(body.rotation.x, 0.42 + swayX, 3, delta);
    } else {
      body.rotation.x = THREE.MathUtils.damp(body.rotation.x, swayX * 0.4, 3, delta);
    }

    body.rotation.z = THREE.MathUtils.damp(body.rotation.z, swayZ + chairTiltZ, 5, delta);

    // Head Look & IK Target Tracking + Drunk Drift
    const driftX =
      (Math.sin(animTimer * 2.3) * 0.6 + Math.cos(animTimer * 3.9) * 0.4) *
      drunkRatio *
      0.45;
    const driftY =
      (Math.cos(animTimer * 1.9) * 0.6 + Math.sin(animTimer * 4.3) * 0.4) *
      drunkRatio *
      0.35;

    const targetAimX = (ikState?.aimX || 0) + driftX;
    const targetAimY = (ikState?.aimY || 0) + driftY;

    if (cheersPhase === 'chug_gulp') {
      // Phase 2: Throw head back to chug beer ("Ngửa cổ uống ực ực!")
      head.rotation.x = THREE.MathUtils.damp(
        head.rotation.x,
        -0.62 + Math.sin(animTimer * 18) * 0.08,
        10,
        delta
      );
      head.rotation.y = THREE.MathUtils.damp(head.rotation.y, 0, 8, delta);
    } else if (cheersPhase === 'slam_finish') {
      // Phase 3: Throw head back "KHÀÀÀ!"
      head.rotation.x = THREE.MathUtils.damp(head.rotation.x, -0.42, 10, delta);
      head.rotation.y = THREE.MathUtils.damp(head.rotation.y, 0, 8, delta);
    } else if (emote === 'laugh_slap') {
      // Phím 1: Ngửa cổ đập bàn cười ha hả
      head.rotation.x = THREE.MathUtils.damp(
        head.rotation.x,
        -0.55 + Math.sin(animTimer * 18) * 0.12,
        10,
        delta
      );
      head.rotation.y = THREE.MathUtils.damp(head.rotation.y, 0, 8, delta);
    } else if (emote === 'beg_mercy') {
      // Phím 3: Cúi đầu chắp tay xin tha uống
      head.rotation.x = THREE.MathUtils.damp(
        head.rotation.x,
        0.35 + Math.sin(animTimer * 10) * 0.15,
        8,
        delta
      );
      head.rotation.y = THREE.MathUtils.damp(head.rotation.y, 0, 8, delta);
    } else if (ikState) {
      head.rotation.y = THREE.MathUtils.damp(
        head.rotation.y,
        -targetAimX * 0.55,
        6,
        delta
      );
      head.rotation.x = THREE.MathUtils.damp(
        head.rotation.x,
        -targetAimY * 0.35 + (cheersPhase === 'clink_center' ? -0.28 : 0),
        6,
        delta
      );
    } else {
      head.rotation.x = THREE.MathUtils.damp(
        head.rotation.x,
        (cheersPhase === 'clink_center' ? -0.28 : 0) +
          Math.sin(animTimer * 2.5) * 0.1 * drunkRatio,
        4,
        delta
      );
      head.rotation.y = THREE.MathUtils.damp(
        head.rotation.y,
        Math.sin(animTimer * 1.5) * 0.2 * drunkRatio,
        2,
        delta
      );
    }

    // Voice Lip-Sync, Chugging Gulp & Laugh Jaw Animation
    const micVol = ikState?.micVolume || 0;
    if (cheersPhase === 'chug_gulp') {
      // Rhythmic gulping jaw motion ("ỰC... ỰC... ỰC")
      const gulpPulse = 0.8 + Math.abs(Math.sin(animTimer * 16)) * 1.1;
      jaw.scale.set(1.1, gulpPulse, 1.0);
    } else if (cheersPhase === 'slam_finish') {
      // Wide open "KHÀÀÀ!" mouth
      jaw.scale.set(1.35, 1.9, 1.1);
    } else if (emote === 'laugh_slap' || micVol > 0.02 || cheersPhase === 'clink_center') {
      const openAmount =
        emote === 'laugh_slap'
          ? 1.4 + Math.abs(Math.sin(animTimer * 16)) * 1.2
          : cheersPhase === 'clink_center'
          ? 1.75
          : 0.5 + micVol * 2.4;
      jaw.scale.set(1.0 + openAmount * 0.15, openAmount, 1.0);
    } else if (!extraState?.isBreathingFire) {
      jaw.scale.set(0.85, 0.35, 0.85);
    }

    // Left & Right Arm IK & 3-Phase Cheers Physics
    const tremor = (Math.random() - 0.5) * drunkRatio * 0.12;

    if (cheersPhase === 'clink_center' || ikState?.isCheersHolding) {
      // Phase 1: Stretch right arm far forward toward center of table so glasses collide!
      rightArm.position.x = THREE.MathUtils.damp(rightArm.position.x, 0.14, 10, delta);
      rightArm.position.y = THREE.MathUtils.damp(rightArm.position.y, 0.44, 10, delta);
      rightArm.position.z = THREE.MathUtils.damp(rightArm.position.z, 0.34, 10, delta);
      rightArm.rotation.x = THREE.MathUtils.damp(
        rightArm.rotation.x,
        1.64 + tremor,
        10,
        delta
      );
      rightArm.rotation.y = THREE.MathUtils.damp(
        rightArm.rotation.y,
        -0.25 - targetAimX * 0.2,
        10,
        delta
      );
      rightArm.rotation.z = THREE.MathUtils.damp(
        rightArm.rotation.z,
        -0.12 + tremor,
        10,
        delta
      );
      leftArm.rotation.set(0.55, 0, 0.25);
    } else if (cheersPhase === 'chug_gulp' || ikState?.isDrinkingOrEating) {
      // Phase 2: Pull mug right up to mouth & tilt it upside down to chug!
      const drunkSlip =
        alcohol > 70 ? Math.sin(animTimer * 18) * 0.25 : 0;
      rightArm.position.x = THREE.MathUtils.damp(rightArm.position.x, 0.2, 10, delta);
      rightArm.position.y = THREE.MathUtils.damp(rightArm.position.y, 0.42, 10, delta);
      rightArm.position.z = THREE.MathUtils.damp(rightArm.position.z, 0.16, 10, delta);
      rightArm.rotation.x = THREE.MathUtils.damp(
        rightArm.rotation.x,
        2.12 + drunkSlip + tremor,
        12,
        delta
      );
      rightArm.rotation.y = THREE.MathUtils.damp(
        rightArm.rotation.y,
        0.46 + drunkSlip * 0.4,
        12,
        delta
      );
      rightArm.rotation.z = THREE.MathUtils.damp(
        rightArm.rotation.z,
        0.32 + tremor,
        12,
        delta
      );
    } else if (cheersPhase === 'slam_finish') {
      // Phase 3: Slam mug down onto stainless steel table ("CỘP!")
      rightArm.position.set(0.28, 0.36, 0.12);
      rightArm.rotation.x = THREE.MathUtils.damp(rightArm.rotation.x, 0.92, 14, delta);
      rightArm.rotation.y = THREE.MathUtils.damp(rightArm.rotation.y, -0.1, 14, delta);
      rightArm.rotation.z = THREE.MathUtils.damp(rightArm.rotation.z, -0.22, 14, delta);
      leftArm.rotation.set(0.85, 0, 0.25);
    } else {
      // Reset right arm shoulder position for normal IK / emotes
      rightArm.position.x = THREE.MathUtils.damp(rightArm.position.x, 0.28, 8, delta);
      rightArm.position.y = THREE.MathUtils.damp(rightArm.position.y, 0.36, 8, delta);
      rightArm.position.z = THREE.MathUtils.damp(rightArm.position.z, 0.05, 8, delta);

      if (emote === 'laugh_slap') {
        leftArm.rotation.x = 0.85 + Math.sin(animTimer * 22) * 0.38;
        leftArm.rotation.z = 0.25;
        rightArm.rotation.x = 0.65;
        rightArm.rotation.z = -0.35;
      } else if (emote === 'point_taunt') {
        leftArm.rotation.set(0.4, 0, 0.3);
        rightArm.rotation.x = THREE.MathUtils.damp(rightArm.rotation.x, 1.55, 10, delta);
        rightArm.rotation.y = THREE.MathUtils.damp(
          rightArm.rotation.y,
          -targetAimX * 0.5,
          10,
          delta
        );
        rightArm.rotation.z = THREE.MathUtils.damp(
          rightArm.rotation.z,
          -0.05 + Math.sin(animTimer * 14) * 0.08,
          10,
          delta
        );
      } else if (emote === 'beg_mercy') {
        const prayBob = Math.sin(animTimer * 12) * 0.18;
        leftArm.rotation.set(1.15 + prayBob, 0.45, -0.35);
        rightArm.rotation.set(1.15 + prayBob, -0.45, 0.35);
      } else if (ikState) {
        const reachPitch = 0.78 + (targetAimY + 0.3) * 0.55 + (ikState.isGrabbing ? 0.35 : 0);
        const reachYaw = -targetAimX * 0.65;
        const reachRoll = -0.32 - targetAimX * 0.35 + tremor;

        rightArm.rotation.x = THREE.MathUtils.damp(
          rightArm.rotation.x,
          reachPitch + tremor,
          7,
          delta
        );
        rightArm.rotation.y = THREE.MathUtils.damp(rightArm.rotation.y, reachYaw, 7, delta);
        rightArm.rotation.z = THREE.MathUtils.damp(rightArm.rotation.z, reachRoll, 7, delta);
        leftArm.rotation.set(0.4, 0, 0.3);
      } else {
        rightArm.rotation.x = THREE.MathUtils.damp(rightArm.rotation.x, 0.6 + tremor, 4, delta);
        rightArm.rotation.y = THREE.MathUtils.damp(rightArm.rotation.y, 0, 4, delta);
        rightArm.rotation.z = THREE.MathUtils.damp(
          rightArm.rotation.z,
          -0.35 + tremor,
          4,
          delta
        );
        leftArm.rotation.set(0.4, 0, 0.3);
      }
    }

    // Drunken eye wandering
    if (drunkRatio > 0.4) {
      const eyeWanderX = Math.sin(animTimer * 3) * 0.015 * drunkRatio;
      const eyeWanderY = Math.cos(animTimer * 2.2) * 0.015 * drunkRatio;
      pupilLeft.position.x = -0.13 + eyeWanderX;
      pupilLeft.position.y = 0.06 + eyeWanderY;
      pupilRight.position.x = 0.13 - eyeWanderX;
      pupilRight.position.y = 0.06 + eyeWanderY;
    } else {
      pupilLeft.position.set(-0.13, 0.06, 0.325);
      pupilRight.position.set(0.13, 0.06, 0.325);
    }
  };

  return {
    root,
    body,
    torsoMesh,
    head,
    jaw,
    fireBreathGroup,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    mugHolder,
    eyeLeft,
    eyeRight,
    pupilLeft,
    pupilRight,
    doodleGroup,
    update,
    setDoodles,
    setNameplate,
  };
}


