// ⚠️ FROZEN COPY of src/game/quanOcParking.ts for the official "Quán Ốc Bờ Sông" map (promoted 2026-11-12).
// Develop in the original (Dev Mode) and run `yarn promote:quan-oc` to update this copy;
// edit here only for urgent production fixes (they are overwritten by the next promote).
/**
 * "Bãi giữ xe" of Quán Ốc Bờ Sông, on the embankment east of the snail stall: the same
 * lot the rider parks in at the end of the Ride Lab trip. Tin roof on posts, two rows
 * of bays, other people's bikes, the attendant's booth, and the player's own bike in
 * a glowing bay (walk up to it and press G to ride home).
 *
 * World frame of the bar scene: road toward +Z, river toward -Z.
 */
import * as THREE from 'three';
import type { Collider } from './playerController';
import { createPlasticStool } from '../../../game/proceduralModels';
import { RIDE_BIKES } from './rideLab/bikePhysics';
import { createRideBike, mergeByMaterial, type RideBikeModel } from './rideLab/rideModels';

export const LOT = {
  minX: 15.4,
  maxX: 27.2,
  minZ: -4.4,
  maxZ: 5.0,
  roofY: 3.05,
  /** Bay rows (z centre) and bay spacing along X. */
  rows: [2.55, -2.3],
  firstBayX: 16.4,
  bayPitch: 1.15,
  baysPerRow: 10,
};
/** Row 0, third bay: the player's. */
export const PLAYER_BAY = { row: 0, index: 2 };

const std = (color: THREE.ColorRepresentation, roughness = 0.6, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });
const glow = (color: THREE.ColorRepresentation, intensity: number) =>
  new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: intensity });

function canvasTex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const bayX = (index: number) => LOT.firstBayX + index * LOT.bayPitch;

export interface QuanOcParking {
  group: THREE.Group;
  colliders: Collider[];
  /** The player's bike (swapped when another bike is chosen). */
  setPlayerBike: (bikeId: string) => void;
  /** Where the player's bike stands, and a spot beside it to stand on arrival. */
  bike: { x: number; z: number };
  arrivalSpot: { x: number; z: number; facing: number };
  attendantSpot: { x: number; z: number; facing: number };
  update: (time: number) => void;
}

export function createQuanOcParking(): QuanOcParking {
  const group = new THREE.Group();
  group.name = 'BaiGiuXe';
  const colliders: Collider[] = [];
  const width = LOT.maxX - LOT.minX;
  const depth = LOT.maxZ - LOT.minZ;
  const cx = (LOT.minX + LOT.maxX) / 2;
  const cz = (LOT.minZ + LOT.maxZ) / 2;

  // Oil-stained concrete floor and bay lines.
  const floorTex = canvasTex(512, 512, (ctx) => {
    ctx.fillStyle = '#6b6a66';
    ctx.fillRect(0, 0, 512, 512);
    let seed = 7;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 9000; i++) {
      const v = 80 + random() * 50;
      ctx.fillStyle = `rgba(${v},${v},${v - 4},0.5)`;
      ctx.fillRect(random() * 512, random() * 512, 2, 2);
    }
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = 'rgba(20,18,14,0.35)';
      ctx.beginPath();
      ctx.ellipse(random() * 512, random() * 512, 10 + random() * 24, 8 + random() * 14, random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.75 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0.012, cz);
  floor.receiveShadow = true;
  group.add(floor);
  const line = new THREE.MeshBasicMaterial({ color: 0xf2f2ec });
  LOT.rows.forEach((rowZ) => {
    for (let i = 0; i <= LOT.baysPerRow; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 2.2).rotateX(-Math.PI / 2), line);
      m.position.set(bayX(i) - LOT.bayPitch / 2, 0.016, rowZ);
      group.add(m);
    }
  });

  // The player's bay: pulsing green outline and a little post sign.
  const playerX = bayX(PLAYER_BAY.index);
  const playerZ = LOT.rows[PLAYER_BAY.row];
  const marker = glow(0x22ff88, 2.5);
  [
    [0, -1.1, 1.1, 0.08],
    [0, 1.1, 1.1, 0.08],
    [-0.55, 0, 0.08, 2.2],
    [0.55, 0, 0.08, 2.2],
  ].forEach(([x, z, w, d]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), marker);
    m.position.set(playerX + x, 0.02, playerZ + z);
    group.add(m);
  });
  const bayLabel = canvasTex(256, 96, (ctx) => {
    ctx.fillStyle = '#052e16';
    ctx.fillRect(0, 0, 256, 96);
    ctx.fillStyle = '#4ade80';
    ctx.font = '900 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Ô SỐ 27', 128, 44);
    ctx.fillStyle = '#d1fae5';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('xe của bạn • phím G', 128, 78);
  });
  const post = new THREE.Group();
  post.position.set(playerX + 0.5, 0, playerZ - 1.25);
  post.add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.3, 6), std(0x9ca3af)).translateY(0.65));
  post.add(new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.26), new THREE.MeshBasicMaterial({ map: bayLabel, side: THREE.DoubleSide })).translateY(1.4));
  group.add(post);

  // Other people's bikes, nose toward the river, lights off.
  let seed = 3;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  LOT.rows.forEach((rowZ, row) => {
    for (let i = 0; i < LOT.baysPerRow; i++) {
      if ((row === PLAYER_BAY.row && i === PLAYER_BAY.index) || random() < 0.22) continue;
      const spec = RIDE_BIKES[Math.floor(random() * RIDE_BIKES.length)];
      const model = createRideBike(
        { ...spec, color: ['#b91c1c', '#1d4ed8', '#111827', '#e5e7eb', '#a16207', '#15803d', '#7c3aed'][Math.floor(random() * 7)] },
        { rider: false }
      );
      quiet(model);
      model.kickstand.rotation.x = 0.5;
      model.lean.rotation.z = -0.1;
      const parked = mergeByMaterial(model.root);
      parked.position.set(bayX(i), 0, rowZ);
      parked.rotation.y = Math.PI + (random() - 0.5) * 0.12; // facing -Z
      group.add(parked);
      colliders.push({ kind: 'box', x: bayX(i), z: rowZ, hw: 0.3, hd: 0.95, yaw: 0 });
    }
  });

  // The player's bike (kept as a live model so the bike choice can change).
  let playerBike: RideBikeModel | null = null;
  const setPlayerBike = (bikeId: string) => {
    if (playerBike) group.remove(playerBike.root);
    const spec = RIDE_BIKES.find((b) => b.id === bikeId) ?? RIDE_BIKES[0];
    playerBike = createRideBike(spec, { rider: false, plate: '59-X1 123.45' });
    quiet(playerBike);
    playerBike.kickstand.rotation.x = 0.5;
    playerBike.lean.rotation.z = -0.1;
    playerBike.root.position.set(playerX, 0, playerZ);
    playerBike.root.rotation.y = Math.PI;
    group.add(playerBike.root);
  };
  setPlayerBike(RIDE_BIKES[0].id);
  colliders.push({ kind: 'box', x: playerX, z: playerZ, hw: 0.3, hd: 0.95, yaw: 0 });

  // Corrugated tin roof on posts, tubes underneath.
  const tin = canvasTex(64, 256, (ctx) => {
    for (let y = 0; y < 256; y += 8) {
      const g = ctx.createLinearGradient(0, y, 0, y + 8);
      g.addColorStop(0, '#5b7a99');
      g.addColorStop(0.5, '#9fb6cc');
      g.addColorStop(1, '#4a627a');
      ctx.fillStyle = g;
      ctx.fillRect(0, y, 64, 8);
    }
  });
  tin.wrapS = tin.wrapT = THREE.RepeatWrapping;
  tin.repeat.set(1, depth);
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(width + 0.4, depth + 0.4), new THREE.MeshStandardMaterial({ map: tin, roughness: 0.45, metalness: 0.5, side: THREE.DoubleSide }));
  roof.rotation.x = -Math.PI / 2 + 0.05; // a little fall toward the road
  roof.position.set(cx, LOT.roofY, cz);
  group.add(roof);
  const postMat = std(0x52525b, 0.5, 0.6);
  [LOT.minX + 0.1, cx, LOT.maxX - 0.1].forEach((x) =>
    [LOT.minZ + 0.1, LOT.maxZ - 0.1].forEach((z) => {
      group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, LOT.roofY, 8), postMat).translateX(x).translateY(LOT.roofY / 2).translateZ(z));
      colliders.push({ kind: 'circle', x, z, r: 0.1 });
    })
  );
  const tubes: THREE.Mesh[] = [];
  [LOT.minX + 2.5, cx, LOT.maxX - 2.5].forEach((x) => {
    const tube = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 1.3), glow(0xeaf6ff, 4));
    tube.position.set(x, LOT.roofY - 0.12, cz);
    group.add(tube);
    tubes.push(tube);
  });
  const light = new THREE.PointLight(0xeaf6ff, 9, 14, 2);
  light.position.set(cx, LOT.roofY - 0.4, cz);
  group.add(light);

  // Yellow signboards: one to the road, one toward the quán.
  const board = canvasTex(1024, 160, (ctx) => {
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 1024, 160);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 10;
    ctx.strokeRect(6, 6, 1012, 148);
    ctx.fillStyle = '#b91c1c';
    ctx.font = '900 84px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BÃI GIỮ XE', 512, 86);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText('5.000đ / lượt  •  Có bảo vệ  •  Gửi xe lấy vé', 512, 138);
  });
  const boardMat = new THREE.MeshStandardMaterial({ map: board, emissiveMap: board, emissive: 0xffffff, emissiveIntensity: 0.6 });
  const front = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 1.0), boardMat);
  front.position.set(cx, LOT.roofY + 0.6, LOT.maxZ + 0.15);
  group.add(front);
  const side = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.78), boardMat);
  side.position.set(LOT.minX - 0.15, LOT.roofY + 0.5, cz);
  side.rotation.y = -Math.PI / 2;
  group.add(side);

  // Attendant's booth by the road entrance: desk, ticket book, stool, little lamp.
  const booth = new THREE.Group();
  booth.position.set(LOT.minX + 0.9, 0, LOT.maxZ - 0.9);
  booth.add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.25, 1.3), std(0x1d4ed8, 0.6)).translateY(1.125));
  booth.add(new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 1.6), std(0x334155, 0.5)).translateY(2.29));
  booth.add(new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.62), glow(0xffe2a8, 1.1)).translateY(1.45).translateX(0.705).rotateY(Math.PI / 2));
  const desk = new THREE.Group();
  desk.position.set(1.15, 0, 0);
  desk.add(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 1.0), std(0x7c4a24, 0.6)).translateY(0.75));
  desk.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.05), std(0x52525b)).translateY(0.375).translateZ(0.45));
  desk.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.05), std(0x52525b)).translateY(0.375).translateZ(-0.45));
  desk.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.22), std(0xfef3c7, 0.9)).translateY(0.79).translateZ(0.2));
  const ticketTex = canvasTex(128, 64, (ctx) => {
    ctx.fillStyle = '#fde68a';
    ctx.fillRect(0, 0, 128, 64);
    ctx.fillStyle = '#7c2d12';
    ctx.font = '900 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VÉ XE 27', 64, 42);
  });
  desk.add(new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.07), new THREE.MeshBasicMaterial({ map: ticketTex })).rotateX(-Math.PI / 2).translateZ(0.792).translateY(0.15));
  booth.add(desk);
  const stool = createPlasticStool(0xdc2626);
  stool.scale.setScalar(0.85);
  stool.position.set(1.7, 0, 0.5);
  booth.add(stool);
  group.add(booth);
  colliders.push({ kind: 'box', x: booth.position.x, z: booth.position.z, hw: 0.75, hd: 0.7, yaw: 0 });
  colliders.push({ kind: 'box', x: booth.position.x + 1.15, z: booth.position.z, hw: 0.3, hd: 0.55, yaw: 0 });

  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = true;
  });

  return {
    group,
    colliders,
    setPlayerBike,
    bike: { x: playerX, z: playerZ },
    // In the aisle just behind the bike (within reach of [G]), facing it.
    arrivalSpot: { x: playerX + 0.1, z: playerZ - 1.45, facing: 0 },
    attendantSpot: { x: booth.position.x + 1.7, z: booth.position.z - 0.2, facing: -Math.PI / 2 },
    update: (time) => {
      marker.emissiveIntensity = 1.6 + Math.sin(time * 4) * 1.0;
    },
  };
}

/** Lights off on a parked bike. */
function quiet(model: RideBikeModel) {
  model.headLens.emissiveIntensity = 0.05;
  model.brakeLight.emissiveIntensity = 0.15;
  model.signals.left.emissiveIntensity = 0;
  model.signals.right.emissiveIntensity = 0;
}
