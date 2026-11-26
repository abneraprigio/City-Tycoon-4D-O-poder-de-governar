import * as THREE from 'three';
import { BUILDING_CATALOG, CitizenAgent, GRID_SIZE, TILE_WORLD_SIZE, TileData } from '../types/game';
import { getTilePadElevation, tileToWorld, worldToTile } from './terrainAndRoads';

export type VehicleKind =
  | 'hatch'
  | 'sedan'
  | 'suv'
  | 'moto'
  | 'bus'
  | 'truck'
  | 'ambulance'
  | 'police';

export interface VehicleEntity {
  id: string;
  kind: VehicleKind;
  x: number;
  z: number;
  dirX: number;
  dirZ: number;
  rotY: number;
  baseSpeed: number;
  currentSpeed: number;
  braking: boolean;
  color: number;
  lastDecisionTileKey: string;
}

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

const BODY_PALETTE = [
  0xd64545, // Red
  0x2b6cb0, // Metallic blue
  0xd97706, // Amber
  0xe2e8f0, // Silver-white
  0x334155, // Graphite
  0x2f855a, // Forest green
  0x94a3b8, // Metallic grey
];

const SKIN_TONES = [0xf2c9ac, 0xdca57d, 0xb87b52, 0x7c4d30, 0xe8b996];
const PANTS_TONES = [0x1e293b, 0x334155, 0x3f3f46, 0x1e3a5f, 0x4b5563];
const HAIR_TONES = [0x1c1917, 0x443226, 0x785a3c, 0x52525b, 0x27272a];

interface VehicleDimensions {
  bodyW: number;
  bodyH: number;
  bodyL: number;
  cabW: number;
  cabH: number;
  cabL: number;
  cabZOffset: number;
  wheelR: number;
  wheelW: number;
  axleSpread: number;
}

const VEHICLE_SPECS: Record<VehicleKind, VehicleDimensions> = {
  hatch: {
    bodyW: 0.28,
    bodyH: 0.11,
    bodyL: 0.5,
    cabW: 0.24,
    cabH: 0.09,
    cabL: 0.28,
    cabZOffset: -0.04,
    wheelR: 0.055,
    wheelW: 0.04,
    axleSpread: 0.15,
  },
  sedan: {
    bodyW: 0.29,
    bodyH: 0.11,
    bodyL: 0.58,
    cabW: 0.24,
    cabH: 0.09,
    cabL: 0.28,
    cabZOffset: -0.03,
    wheelR: 0.058,
    wheelW: 0.04,
    axleSpread: 0.18,
  },
  suv: {
    bodyW: 0.31,
    bodyH: 0.13,
    bodyL: 0.6,
    cabW: 0.27,
    cabH: 0.11,
    cabL: 0.36,
    cabZOffset: -0.05,
    wheelR: 0.068,
    wheelW: 0.045,
    axleSpread: 0.19,
  },
  moto: {
    bodyW: 0.1,
    bodyH: 0.1,
    bodyL: 0.32,
    cabW: 0.09,
    cabH: 0.07,
    cabL: 0.12,
    cabZOffset: 0.02,
    wheelR: 0.055,
    wheelW: 0.03,
    axleSpread: 0.11,
  },
  bus: {
    bodyW: 0.34,
    bodyH: 0.26,
    bodyL: 0.92,
    cabW: 0.32,
    cabH: 0.1,
    cabL: 0.84,
    cabZOffset: 0.0,
    wheelR: 0.072,
    wheelW: 0.05,
    axleSpread: 0.28,
  },
  truck: {
    bodyW: 0.33,
    bodyH: 0.24,
    bodyL: 0.84,
    cabW: 0.31,
    cabH: 0.17,
    cabL: 0.26,
    cabZOffset: 0.26,
    wheelR: 0.072,
    wheelW: 0.05,
    axleSpread: 0.25,
  },
  ambulance: {
    bodyW: 0.31,
    bodyH: 0.21,
    bodyL: 0.68,
    cabW: 0.27,
    cabH: 0.11,
    cabL: 0.22,
    cabZOffset: 0.19,
    wheelR: 0.065,
    wheelW: 0.045,
    axleSpread: 0.21,
  },
  police: {
    bodyW: 0.29,
    bodyH: 0.11,
    bodyL: 0.58,
    cabW: 0.24,
    cabH: 0.09,
    cabL: 0.28,
    cabZOffset: -0.02,
    wheelR: 0.058,
    wheelW: 0.04,
    axleSpread: 0.18,
  },
};

export interface TrafficAndCitizenSystem {
  vehicles: VehicleEntity[];
  syncRoads: (tiles: TileData[]) => void;
  update: (
    dt: number,
    simPaused: boolean,
    speedMultiplier: number,
    nightGlow: number,
    tiles: TileData[],
    citizens: CitizenAgent[],
    cameraTarget: THREE.Vector3,
    detailDistance: number,
  ) => void;
  pickVehicleAt: (wx: number, wz: number) => VehicleEntity | null;
  getVehicleById: (id: string) => VehicleEntity | null;
  dispose: () => void;
}

interface HumanoidRig {
  group: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  headMesh: THREE.Mesh;
  hairMesh: THREE.Mesh;
  torsoMesh: THREE.Mesh;
  leftLegMesh: THREE.Mesh;
  rightLegMesh: THREE.Mesh;
  leftArmMesh: THREE.Mesh;
  rightArmMesh: THREE.Mesh;
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createTrafficAndCitizenSystem(
  scene: THREE.Scene,
  isSoftwareGl: boolean,
): TrafficAndCitizenSystem {
  const maxVehicles = 52;
  const maxDetailedCitizens = isSoftwareGl ? 24 : 44;
  const maxFarCitizens = 120;

  // --- 1. Multi-Part Instanced Vehicles ---
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const wheelGeo = new THREE.CylinderGeometry(1, 1, 1, 10);
  wheelGeo.rotateZ(Math.PI / 2);

  const carPaintMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.28,
    metalness: 0.45,
    clearcoat: isSoftwareGl ? 0.25 : 0.85,
    clearcoatRoughness: 0.14,
  });
  const cabinGlassMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.14,
    metalness: 0.35,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.88,
    metalness: 0.08,
  });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xfef9c3,
    emissive: new THREE.Color(0xfffbeb),
    emissiveIntensity: 0.2,
    roughness: 0.2,
  });
  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    emissive: new THREE.Color(0xef4444),
    emissiveIntensity: 0.25,
    roughness: 0.3,
  });
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: new THREE.Color(0xef4444),
    emissiveIntensity: 0.65,
  });

  const bodyInst = new THREE.InstancedMesh(unitBox, carPaintMat, maxVehicles);
  const cabInst = new THREE.InstancedMesh(unitBox, cabinGlassMat, maxVehicles);
  const wheelInst = new THREE.InstancedMesh(wheelGeo, tireMat, maxVehicles * 4);
  const headLightInst = new THREE.InstancedMesh(unitBox, headlightMat, maxVehicles * 2);
  const tailLightInst = new THREE.InstancedMesh(unitBox, taillightMat, maxVehicles * 2);
  const beaconInst = new THREE.InstancedMesh(unitBox, beaconMat, maxVehicles);

  bodyInst.castShadow = !isSoftwareGl;
  bodyInst.receiveShadow = true;
  [bodyInst, cabInst, wheelInst, headLightInst, tailLightInst, beaconInst].forEach((inst) => {
    inst.frustumCulled = false;
    scene.add(inst);
  });

  const vehicles: VehicleEntity[] = [];

  // --- 2. Articulated Pooled 3D Humanoids (Near LOD) + Instanced Multi-Part Far LOD ---
  const limbGeo = new THREE.BoxGeometry(0.055, 0.17, 0.055);
  limbGeo.translate(0, -0.085, 0); // Pivot at shoulder / hip
  const torsoGeo = new THREE.BoxGeometry(0.14, 0.19, 0.085);
  const headGeo = new THREE.SphereGeometry(0.055, 8, 7);
  const hairGeo = new THREE.SphereGeometry(0.058, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.58);

  const detailedGroup = new THREE.Group();
  scene.add(detailedGroup);
  const humanPool: HumanoidRig[] = [];

  for (let i = 0; i < maxDetailedCitizens; i++) {
    const group = new THREE.Group();
    group.visible = false;

    const torsoMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.72 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xdca57d, roughness: 0.68 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.82 });

    const torsoMesh = new THREE.Mesh(torsoGeo, torsoMat);
    torsoMesh.position.y = 0.27;
    torsoMesh.castShadow = !isSoftwareGl;
    group.add(torsoMesh);

    const headMesh = new THREE.Mesh(headGeo, skinMat);
    headMesh.position.y = 0.42;
    headMesh.castShadow = !isSoftwareGl;
    group.add(headMesh);

    const hairMesh = new THREE.Mesh(hairGeo, hairMat);
    hairMesh.position.y = 0.425;
    group.add(hairMesh);

    const leftLegPivot = new THREE.Group();
    leftLegPivot.position.set(-0.036, 0.175, 0);
    const leftLegMesh = new THREE.Mesh(limbGeo, pantsMat);
    leftLegPivot.add(leftLegMesh);
    group.add(leftLegPivot);

    const rightLegPivot = new THREE.Group();
    rightLegPivot.position.set(0.036, 0.175, 0);
    const rightLegMesh = new THREE.Mesh(limbGeo, pantsMat);
    rightLegPivot.add(rightLegMesh);
    group.add(rightLegPivot);

    const leftArmPivot = new THREE.Group();
    leftArmPivot.position.set(-0.095, 0.35, 0);
    const leftArmMesh = new THREE.Mesh(limbGeo, torsoMat);
    leftArmMesh.scale.set(0.8, 0.9, 0.8);
    leftArmPivot.add(leftArmMesh);
    group.add(leftArmPivot);

    const rightArmPivot = new THREE.Group();
    rightArmPivot.position.set(0.095, 0.35, 0);
    const rightArmMesh = new THREE.Mesh(limbGeo, torsoMat);
    rightArmMesh.scale.set(0.8, 0.9, 0.8);
    rightArmPivot.add(rightArmMesh);
    group.add(rightArmPivot);

    detailedGroup.add(group);
    humanPool.push({
      group,
      leftLegPivot,
      rightLegPivot,
      leftArmPivot,
      rightArmPivot,
      headMesh,
      hairMesh,
      torsoMesh,
      leftLegMesh,
      rightLegMesh,
      leftArmMesh,
      rightArmMesh,
    });
  }

  // Far LOD instanced multi-part humanoids (legs + torso + head)
  const farLegsGeo = new THREE.BoxGeometry(0.11, 0.17, 0.06);
  const farTorsoMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
  const farLegsMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.82 });
  const farHeadMat = new THREE.MeshStandardMaterial({ color: 0xdca57d, roughness: 0.72 });

  const farLegsInst = new THREE.InstancedMesh(farLegsGeo, farLegsMat, maxFarCitizens);
  const farTorsoInst = new THREE.InstancedMesh(torsoGeo, farTorsoMat, maxFarCitizens);
  const farHeadInst = new THREE.InstancedMesh(headGeo, farHeadMat, maxFarCitizens);
  [farLegsInst, farTorsoInst, farHeadInst].forEach((inst) => {
    inst.frustumCulled = false;
    scene.add(inst);
  });

  const syncRoads = (tiles: TileData[]) => {
    const roadTiles = tiles.filter((t) => t.road !== 'none');
    vehicles.length = 0;
    if (roadTiles.length === 0) {
      bodyInst.count = 0;
      cabInst.count = 0;
      wheelInst.count = 0;
      headLightInst.count = 0;
      tailLightInst.count = 0;
      beaconInst.count = 0;
      return;
    }

    const hasDelegacia = tiles.some((t) => t.building?.type === 'delegacia');
    const hasHospital = tiles.some((t) => t.building?.type === 'hospital' || t.building?.type === 'posto_saude');
    const hasIndustry = tiles.some(
      (t) => t.building && BUILDING_CATALOG[t.building.type].category === 'industrial',
    );

    const desired = Math.min(maxVehicles, Math.max(6, Math.floor(roadTiles.length * 0.75)));
    for (let i = 0; i < desired; i++) {
      const rt = roadTiles[(i * 7) % roadTiles.length];
      const [wx, wz] = tileToWorld(rt.x, rt.z);

      // Pick connected road direction
      const dirs: [number, number][] = [];
      if (rt.z > 0 && tiles[(rt.z - 1) * GRID_SIZE + rt.x].road !== 'none') dirs.push([0, -1]);
      if (rt.z < GRID_SIZE - 1 && tiles[(rt.z + 1) * GRID_SIZE + rt.x].road !== 'none') dirs.push([0, 1]);
      if (rt.x > 0 && tiles[rt.z * GRID_SIZE + (rt.x - 1)].road !== 'none') dirs.push([-1, 0]);
      if (rt.x < GRID_SIZE - 1 && tiles[rt.z * GRID_SIZE + (rt.x + 1)].road !== 'none') dirs.push([1, 0]);
      const chosen = dirs.length > 0 ? dirs[i % dirs.length] : [1, 0];

      let kind: VehicleKind = 'sedan';
      let color = BODY_PALETTE[i % BODY_PALETTE.length];
      if (i % 13 === 0 && hasDelegacia) {
        kind = 'police';
        color = 0x1e293b;
      } else if (i % 15 === 0 && hasHospital) {
        kind = 'ambulance';
        color = 0xf8fafc;
      } else if (i % 9 === 0) {
        kind = 'bus';
        color = 0x1d4ed8;
      } else if (i % 7 === 0 && hasIndustry) {
        kind = 'truck';
        color = 0xe2e8f0;
      } else if (i % 5 === 0) {
        kind = 'suv';
      } else if (i % 6 === 0) {
        kind = 'moto';
      } else if (i % 2 === 0) {
        kind = 'hatch';
      }

      vehicles.push({
        id: `veh_${i}`,
        kind,
        x: wx,
        z: wz,
        dirX: chosen[0],
        dirZ: chosen[1],
        rotY: Math.atan2(chosen[0], chosen[1]),
        baseSpeed: kind === 'moto' ? 3.2 : kind === 'bus' || kind === 'truck' ? 2.0 : 2.55 + (i % 3) * 0.35,
        currentSpeed: 2.2,
        braking: false,
        color,
        lastDecisionTileKey: '',
      });
    }
  };

  let animTime = 0;

  const update = (
    dt: number,
    simPaused: boolean,
    speedMultiplier: number,
    nightGlow: number,
    tiles: TileData[],
    citizens: CitizenAgent[],
    cameraTarget: THREE.Vector3,
    detailDistance: number,
  ) => {
    if (!simPaused) {
      animTime += dt * Math.max(0.8, Math.min(2.4, speedMultiplier));
    }

    headlightMat.emissiveIntensity = 0.15 + nightGlow * 2.2;
    taillightMat.emissiveIntensity = 0.2 + nightGlow * 1.4;
    beaconMat.emissiveIntensity = !simPaused && Math.sin(animTime * 14) > 0 ? 1.8 : 0.25;
    beaconMat.emissive.setHex(Math.sin(animTime * 14) > 0 ? 0xef4444 : 0x3b82f6);

    // --- Update Vehicles ---
    const vCount = vehicles.length;
    let wheelCount = 0;
    let hlCount = 0;
    let tlCount = 0;
    let beaconCount = 0;

    for (let i = 0; i < vCount; i++) {
      const v = vehicles[i];
      const spec = VEHICLE_SPECS[v.kind];
      const coords = worldToTile(v.x, v.z);
      const tile = coords ? tiles[coords[1] * GRID_SIZE + coords[0]] : null;
      const roadBaseY = (tile ? getTilePadElevation(tile) : 0.06) + 0.058;

      if (!simPaused && speedMultiplier > 0) {
        // Check braking proximity to vehicle ahead on same lane
        let blocked = false;
        for (let j = 0; j < vCount; j++) {
          if (i === j) continue;
          const o = vehicles[j];
          const dx = o.x - v.x;
          const dz = o.z - v.z;
          const forwardDot = dx * v.dirX + dz * v.dirZ;
          const lateralDot = Math.abs(dx * -v.dirZ + dz * v.dirX);
          if (forwardDot > 0.1 && forwardDot < 1.35 && lateralDot < 0.35 && o.dirX === v.dirX && o.dirZ === v.dirZ) {
            blocked = true;
            break;
          }
        }
        v.braking = blocked;
        const targetSpd = blocked ? 0 : v.baseSpeed;
        v.currentSpeed = THREE.MathUtils.damp(v.currentSpeed, targetSpd, blocked ? 9 : 4, dt * speedMultiplier);

        v.x += v.dirX * v.currentSpeed * dt * speedMultiplier;
        v.z += v.dirZ * v.currentSpeed * dt * speedMultiplier;

        // Smooth intersection steering & boundary clamping
        const nextCoords = worldToTile(v.x, v.z);
        const curTile = nextCoords ? tiles[nextCoords[1] * GRID_SIZE + nextCoords[0]] : null;
        if (nextCoords && curTile && curTile.road !== 'none') {
          const [cx, cz] = tileToWorld(nextCoords[0], nextCoords[1]);
          const distCenter = Math.hypot(v.x - cx, v.z - cz);
          const key = `${nextCoords[0]}_${nextCoords[1]}`;
          if (distCenter < 0.24 && v.lastDecisionTileKey !== key) {
            v.lastDecisionTileKey = key;
            const candidates: [number, number][] = [];
            const dirs: [number, number][] = [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ];
            for (const [dx, dz] of dirs) {
              if (dx === -v.dirX && dz === -v.dirZ) continue; // Avoid instant U-turn if alternatives exist
              const nx = nextCoords[0] + dx;
              const nz = nextCoords[1] + dz;
              if (nx >= 0 && nz >= 0 && nx < GRID_SIZE && nz < GRID_SIZE) {
                if (tiles[nz * GRID_SIZE + nx].road !== 'none') {
                  candidates.push([dx, dz]);
                }
              }
            }
            if (candidates.length > 0) {
              // Deterministic pseudo-random choice per vehicle + tile
              const pickIdx = (i * 11 + nextCoords[0] * 7 + nextCoords[1] * 13) % candidates.length;
              const [ndx, ndz] = candidates[pickIdx];
              if (ndx !== v.dirX || ndz !== v.dirZ) {
                v.dirX = ndx;
                v.dirZ = ndz;
                v.x = cx;
                v.z = cz;
              }
            } else {
              // Dead-end turnaround
              v.dirX = -v.dirX;
              v.dirZ = -v.dirZ;
            }
          }
        } else {
          // Off-road guard: snap back onto nearest valid road tile
          const fallbackRoad = tiles.find((t) => t.road !== 'none');
          if (fallbackRoad) {
            const [rx, rz] = tileToWorld(fallbackRoad.x, fallbackRoad.z);
            v.x = rx;
            v.z = rz;
          }
        }
      }

      // Smooth yaw orientation
      const goalYaw = Math.atan2(v.dirX, v.dirZ);
      let diff = goalYaw - v.rotY;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      v.rotY += diff * Math.min(1, dt * 12);

      // Right-hand lane offset
      const laneOff = v.kind === 'moto' ? 0.18 : 0.27;
      const px = v.x - v.dirZ * laneOff;
      const pz = v.z + v.dirX * laneOff;
      const sinY = Math.sin(v.rotY);
      const cosY = Math.cos(v.rotY);

      // 1. Body
      _dummy.position.set(px, roadBaseY + spec.wheelR + spec.bodyH * 0.5, pz);
      _dummy.rotation.set(0, v.rotY, 0);
      _dummy.scale.set(spec.bodyW, spec.bodyH, spec.bodyL);
      _dummy.updateMatrix();
      bodyInst.setMatrixAt(i, _dummy.matrix);
      _color.setHex(v.color);
      bodyInst.setColorAt(i, _color);

      // 2. Cabin / Glass Greenhouse
      const cabX = px + sinY * spec.cabZOffset;
      const cabZ = pz + cosY * spec.cabZOffset;
      _dummy.position.set(cabX, roadBaseY + spec.wheelR + spec.bodyH + spec.cabH * 0.45, cabZ);
      _dummy.rotation.set(0, v.rotY, 0);
      _dummy.scale.set(spec.cabW, spec.cabH, spec.cabL);
      _dummy.updateMatrix();
      cabInst.setMatrixAt(i, _dummy.matrix);

      // 3. 4 Wheels
      const wxOff = spec.bodyW * 0.48;
      const wzOff = spec.axleSpread;
      const wheelOffsets: [number, number][] = [
        [-wxOff, wzOff],
        [wxOff, wzOff],
        [-wxOff, -wzOff],
        [wxOff, -wzOff],
      ];
      for (const [lx, lz] of wheelOffsets) {
        const wpx = px + lx * cosY + lz * sinY;
        const wpz = pz - lx * sinY + lz * cosY;
        _dummy.position.set(wpx, roadBaseY + spec.wheelR, wpz);
        _dummy.rotation.set(0, v.rotY, 0);
        _dummy.scale.set(spec.wheelW, spec.wheelR, spec.wheelR);
        _dummy.updateMatrix();
        wheelInst.setMatrixAt(wheelCount++, _dummy.matrix);
      }

      // 4. Headlights (+Z local front) & Taillights (-Z local rear)
      const lightW = spec.bodyW * 0.34;
      const halfL = spec.bodyL * 0.502;
      const lightY = roadBaseY + spec.wheelR + spec.bodyH * 0.48;
      for (const side of [-1, 1]) {
        const lx = side * lightW;
        // Front headlight
        _dummy.position.set(px + lx * cosY + halfL * sinY, lightY, pz - lx * sinY + halfL * cosY);
        _dummy.rotation.set(0, v.rotY, 0);
        _dummy.scale.set(0.05, 0.035, 0.02);
        _dummy.updateMatrix();
        headLightInst.setMatrixAt(hlCount++, _dummy.matrix);

        // Rear taillight (larger when braking)
        const tlScale = v.braking ? 1.45 : 1.0;
        _dummy.position.set(px + lx * cosY - halfL * sinY, lightY, pz - lx * sinY - halfL * cosY);
        _dummy.scale.set(0.055 * tlScale, 0.036 * tlScale, 0.02);
        _dummy.updateMatrix();
        tailLightInst.setMatrixAt(tlCount++, _dummy.matrix);
      }

      // 5. Emergency lightbar on police / ambulance
      if (v.kind === 'police' || v.kind === 'ambulance') {
        _dummy.position.set(
          cabX,
          roadBaseY + spec.wheelR + spec.bodyH + spec.cabH + 0.02,
          cabZ,
        );
        _dummy.rotation.set(0, v.rotY, 0);
        _dummy.scale.set(spec.cabW * 0.65, 0.035, 0.06);
        _dummy.updateMatrix();
        beaconInst.setMatrixAt(beaconCount++, _dummy.matrix);
      }
    }

    bodyInst.count = vCount;
    cabInst.count = vCount;
    wheelInst.count = wheelCount;
    headLightInst.count = hlCount;
    tailLightInst.count = tlCount;
    beaconInst.count = beaconCount;

    bodyInst.instanceMatrix.needsUpdate = true;
    if (bodyInst.instanceColor) bodyInst.instanceColor.needsUpdate = true;
    cabInst.instanceMatrix.needsUpdate = true;
    wheelInst.instanceMatrix.needsUpdate = true;
    headLightInst.instanceMatrix.needsUpdate = true;
    tailLightInst.instanceMatrix.needsUpdate = true;
    beaconInst.instanceMatrix.needsUpdate = true;

    // --- Update Citizens (Articulated Near LOD + Multi-Part Instanced Far LOD) ---
    let nearIdx = 0;
    let farIdx = 0;
    const citTotal = Math.min(maxFarCitizens, citizens.length);

    for (let i = 0; i < citTotal; i++) {
      const cit = citizens[i];
      const [wx, wz] = tileToWorld(cit.x, cit.z);
      const coords = worldToTile(wx, wz);
      const tile = coords ? tiles[coords[1] * GRID_SIZE + coords[0]] : null;
      const groundY = (tile ? getTilePadElevation(tile) : 0.06) + (tile && tile.road !== 'none' ? 0.052 : 0.01);

      const camDist = Math.hypot(wx - cameraTarget.x, wz - cameraTarget.z);
      const seed = hashStr(cit.id);
      const shirtHex = cit.state === 'protesting' ? 0xef4444 : cit.shirtColor;

      if (camDist <= detailDistance && nearIdx < maxDetailedCitizens) {
        const rig = humanPool[nearIdx++];
        rig.group.visible = true;

        const isMoving =
          cit.state === 'commuting' || cit.state === 'seeking_job' || cit.state === 'seeking_home';
        const isProtesting = cit.state === 'protesting';
        const isTalking = cit.state === 'shopping' || cit.state === 'idle';
        const phase = animTime * 7.5 + (seed % 100) * 0.1;

        const stride = !simPaused && isMoving ? Math.sin(phase) * 0.55 : 0;
        const bob = !simPaused && isMoving ? Math.abs(Math.sin(phase)) * 0.025 : 0;

        rig.group.position.set(wx, groundY + bob, wz);
        const yaw = Math.atan2(cit.targetX - cit.x, cit.targetZ - cit.z);
        if (Math.hypot(cit.targetX - cit.x, cit.targetZ - cit.z) > 0.02) {
          rig.group.rotation.y = yaw;
        }
        const heightScale = 0.92 + (seed % 16) * 0.012;
        rig.group.scale.setScalar(heightScale);

        rig.leftLegPivot.rotation.x = stride;
        rig.rightLegPivot.rotation.x = -stride;

        if (isProtesting && !simPaused) {
          rig.leftArmPivot.rotation.x = -2.4 + Math.sin(phase * 1.4) * 0.3;
          rig.rightArmPivot.rotation.x = -2.1 + Math.cos(phase * 1.4) * 0.3;
        } else if (isTalking && !simPaused) {
          rig.leftArmPivot.rotation.x = -0.35 + Math.sin(phase * 0.6) * 0.18;
          rig.rightArmPivot.rotation.x = -0.25 + Math.cos(phase * 0.6) * 0.15;
        } else {
          rig.leftArmPivot.rotation.x = -stride * 0.85;
          rig.rightArmPivot.rotation.x = stride * 0.85;
        }

        (rig.torsoMesh.material as THREE.MeshStandardMaterial).color.setHex(shirtHex);
        (rig.leftArmMesh.material as THREE.MeshStandardMaterial).color.setHex(shirtHex);
        (rig.rightArmMesh.material as THREE.MeshStandardMaterial).color.setHex(shirtHex);
        (rig.leftLegMesh.material as THREE.MeshStandardMaterial).color.setHex(
          PANTS_TONES[seed % PANTS_TONES.length],
        );
        (rig.headMesh.material as THREE.MeshStandardMaterial).color.setHex(
          SKIN_TONES[(seed >> 3) % SKIN_TONES.length],
        );
        (rig.hairMesh.material as THREE.MeshStandardMaterial).color.setHex(
          HAIR_TONES[(seed >> 6) % HAIR_TONES.length],
        );
      } else if (farIdx < maxFarCitizens) {
        const bob =
          !simPaused && cit.state !== 'working'
            ? Math.abs(Math.sin(animTime * 6 + i)) * 0.025
            : 0;
        _dummy.position.set(wx, groundY + 0.085 + bob, wz);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        farLegsInst.setMatrixAt(farIdx, _dummy.matrix);

        _dummy.position.set(wx, groundY + 0.26 + bob, wz);
        _dummy.updateMatrix();
        farTorsoInst.setMatrixAt(farIdx, _dummy.matrix);
        _color.setHex(shirtHex);
        farTorsoInst.setColorAt(farIdx, _color);

        _dummy.position.set(wx, groundY + 0.41 + bob, wz);
        _dummy.updateMatrix();
        farHeadInst.setMatrixAt(farIdx, _dummy.matrix);
        farIdx++;
      }
    }

    for (let k = nearIdx; k < maxDetailedCitizens; k++) {
      humanPool[k].group.visible = false;
    }

    farLegsInst.count = farIdx;
    farTorsoInst.count = farIdx;
    farHeadInst.count = farIdx;
    farLegsInst.instanceMatrix.needsUpdate = true;
    farTorsoInst.instanceMatrix.needsUpdate = true;
    farHeadInst.instanceMatrix.needsUpdate = true;
    if (farTorsoInst.instanceColor) farTorsoInst.instanceColor.needsUpdate = true;
  };

  const pickVehicleAt = (wx: number, wz: number): VehicleEntity | null => {
    let best: VehicleEntity | null = null;
    let bestDist = 0.72;
    for (const v of vehicles) {
      const d = Math.hypot(v.x - wx, v.z - wz);
      if (d < bestDist) {
        bestDist = d;
        best = v;
      }
    }
    return best;
  };

  const getVehicleById = (id: string) => vehicles.find((v) => v.id === id) || null;

  return {
    vehicles,
    syncRoads,
    update,
    pickVehicleAt,
    getVehicleById,
    dispose: () => {
      [bodyInst, cabInst, wheelInst, headLightInst, tailLightInst, beaconInst].forEach((inst) => {
        scene.remove(inst);
      });
      [farLegsInst, farTorsoInst, farHeadInst].forEach((inst) => {
        scene.remove(inst);
      });
      scene.remove(detailedGroup);
      humanPool.forEach((rig) => {
        (rig.torsoMesh.material as THREE.Material).dispose();
        (rig.leftLegMesh.material as THREE.Material).dispose();
        (rig.headMesh.material as THREE.Material).dispose();
        (rig.hairMesh.material as THREE.Material).dispose();
      });
      unitBox.dispose();
      wheelGeo.dispose();
      limbGeo.dispose();
      torsoGeo.dispose();
      headGeo.dispose();
      hairGeo.dispose();
      farLegsGeo.dispose();
      carPaintMat.dispose();
      cabinGlassMat.dispose();
      tireMat.dispose();
      headlightMat.dispose();
      taillightMat.dispose();
      beaconMat.dispose();
      farTorsoMat.dispose();
      farLegsMat.dispose();
      farHeadMat.dispose();
    },
  };
}
