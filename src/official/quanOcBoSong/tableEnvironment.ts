/**
 * Surroundings of the multiplayer table scene (threeScene) for the "Quán Ốc Bờ Sông"
 * map: the embankment, river, boats, bridge and far bank, the snail stall, the walk-in
 * shophouse across the road and the parking lot — from the frozen snapshot in ./game.
 *
 * Hand-written glue (not overwritten by `yarn promote:quan-oc`). The table, its stools,
 * the players and the interactive props stay threeScene's own; the scenery is built in
 * "table mode" so nothing of it lands on top of them.
 */
import * as THREE from 'three';
import { createRiversideScenery } from './game/riversideScenery';
import { constrainToArea, type Collider } from './game/playerController';

export interface QuanOcTableEnvironment {
  group: THREE.Group;
  /** Scene look for this map (river haze, far camera plane). */
  fog: { color: number; density: number };
  background: number;
  cameraFar: number;
  /**
   * Free-roam walking: the whole map (embankment, road, the house across it, the
   * parking lot), blocked by walls, tables, the stall, parked bikes… and the main table.
   */
  constrain: (x: number, z: number) => { x: number; z: number };
  update: (time: number, delta: number) => void;
  dispose: () => void;
}

export function createQuanOcTableEnvironment(): QuanOcTableEnvironment {
  const scenery = createRiversideScenery({ tableMode: true });
  const group = new THREE.Group();
  group.name = 'QuanOcBoSong';
  group.add(scenery.ground, scenery.props, scenery.backdrop, scenery.sky);
  // Near props cast into the table's key-light shadow; far ones and the backdrop don't.
  group.updateMatrixWorld(true);
  const at = new THREE.Vector3();
  scenery.props.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.receiveShadow = true;
    mesh.getWorldPosition(at);
    mesh.castShadow = Math.hypot(at.x, at.z) < 9;
  });
  scenery.ground.traverse((object) => {
    if ((object as THREE.Mesh).isMesh) (object as THREE.Mesh).receiveShadow = true;
  });
  // The table scene's own table at the origin (its stools stay walkable, as in the street map).
  const colliders: Collider[] = [{ kind: 'circle', x: 0, z: 0, r: 1.5 }, ...scenery.colliders];
  return {
    group,
    constrain: (x, z) => constrainToArea(x, z, colliders, scenery.bounds),
    fog: { color: 0x0b0d1a, density: 0.009 },
    background: 0x0b0d1a,
    cameraFar: 400,
    update: (time, delta) => scenery.update(time, delta),
    dispose: () => {
      group.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((m) => {
          (m as THREE.MeshStandardMaterial).map?.dispose();
          (m as THREE.MeshStandardMaterial).emissiveMap?.dispose();
          m.dispose();
        });
      });
    },
  };
}
