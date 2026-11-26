import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  BUILDING_CATALOG,
  GRID_SIZE,
  TILE_WORLD_SIZE,
  ThematicMapMode,
  TileData,
} from '../types/game';
import { useGameStore } from '../store/useGameStore';
import { createProceduralTextures } from './proceduralTextures';
import {
  buildConflictMarkerMesh,
  buildProceduralBuildingMesh,
  createBuildingMaterialLibrary,
} from './buildingModels';

// Module-scope reusable math objects for zero GC inside render loop
const _vec3 = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _skyDay = new THREE.Color(0x9ecae6);
const _skySunset = new THREE.Color(0xd98a6c);
const _skyNight = new THREE.Color(0x0c162b);
const _sunDay = new THREE.Color(0xfff4de);
const _sunSunset = new THREE.Color(0xff9a52);
const _sunNight = new THREE.Color(0x6488c4);

function tileToWorld(tx: number, tz: number): [number, number] {
  return [(tx - (GRID_SIZE - 1) / 2) * TILE_WORLD_SIZE, (tz - (GRID_SIZE - 1) / 2) * TILE_WORLD_SIZE];
}

function worldToTile(wx: number, wz: number): [number, number] | null {
  const tx = Math.round(wx / TILE_WORLD_SIZE + (GRID_SIZE - 1) / 2);
  const tz = Math.round(wz / TILE_WORLD_SIZE + (GRID_SIZE - 1) / 2);
  if (tx < 0 || tz < 0 || tx >= GRID_SIZE || tz >= GRID_SIZE) return null;
  return [tx, tz];
}

function getThematicTileColor(tile: TileData, mode: ThematicMapMode, out: THREE.Color): THREE.Color {
  if (mode === 'normal') {
    if (tile.plannedDistrict) return out.setHex(0x659e58);
    if (tile.terrain === 'waterfront') return out.setHex(0xc2b28b);
    if (tile.terrain === 'fertile') return out.setHex(0x659648);
    if (tile.terrain === 'hill') return out.setHex(0x5b7c4d);
    return out.setHex(0x5a8e4b);
  }

  let t = 0.5;
  if (mode === 'landValue') {
    t = Math.min(1, Math.max(0, (tile.landValue - 15000) / 95000));
    return out.setHSL(0.32 * t + 0.02, 0.72, 0.45);
  }
  if (mode === 'safety') {
    t = Math.min(1, Math.max(0, tile.safetyCoverage / 100));
    return out.setHSL(0.34 * t, 0.75, 0.44);
  }
  if (mode === 'traffic') {
    if (tile.road === 'none') return out.setHex(0x475569);
    t = Math.min(1, Math.max(0, 1 - tile.trafficLoad / 100));
    return out.setHSL(0.34 * t, 0.78, 0.48);
  }
  if (mode === 'pollution') {
    t = Math.min(1, Math.max(0, 1 - tile.pollution / 60));
    return out.setHSL(0.34 * t, 0.74, 0.45);
  }
  if (mode === 'education') {
    t = Math.min(1, Math.max(0, tile.educationCoverage / 100));
    return out.setHSL(0.56 - (1 - t) * 0.48, 0.72, 0.46);
  }
  if (mode === 'health') {
    t = Math.min(1, Math.max(0, tile.healthCoverage / 100));
    return out.setHSL(0.38 * t, 0.72, 0.46);
  }
  if (mode === 'employment') {
    const jobs = tile.building ? BUILDING_CATALOG[tile.building.type].jobsProvided : 0;
    return jobs > 0 ? out.setHex(0x10b981) : out.setHex(0x475569);
  }
  if (mode === 'happiness') {
    t = Math.min(1, Math.max(0, tile.leisureCoverage / 90));
    return out.setHSL(0.35 * t, 0.75, 0.46);
  }
  if (mode === 'coverage') {
    const ok = tile.hasPower && tile.hasWater ? 1 : tile.hasPower || tile.hasWater ? 0.5 : 0;
    return ok === 1 ? out.setHex(0x0ea5e9) : ok === 0.5 ? out.setHex(0xf59e0b) : out.setHex(0xef4444);
  }
  return out.setHex(0x5a8e4b);
}

interface VehicleSim {
  x: number;
  z: number;
  dirX: number;
  dirZ: number;
  speed: number;
  color: number;
}

export const CityViewport: React.FC = () => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [contextLost, setContextLost] = useState(false);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Detect software WebGL (SwiftShader/llvmpipe/WARP) for rendering cost only
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 2. Initialize Renderer, Scene, Camera
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onContextRestored = () => {
      setContextLost(false);
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9ecae6);
    scene.fog = new THREE.FogExp2(0x9ecae6, 0.0082);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      42,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.5,
      260,
    );
    camera.position.set(24, 24, 24);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.minDistance = 11;
    controls.maxDistance = 76;
    controls.minPolarAngle = 0.25;
    controls.maxPolarAngle = Math.PI * 0.43;
    controls.target.set(0, 0, 0);
    controls.update();

    // 3. Studio / Outdoor Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x3b4d34, 0.78);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff4de, 1.85);
    sunLight.position.set(28, 38, 22);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 5;
    sunLight.shadow.camera.far = 115;
    const d = 32;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.025;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0xbfdbfe, 0.42);
    rimLight.position.set(-24, 18, -26);
    scene.add(rimLight);

    // 4. Procedural Textures & Material Library
    const textures = createProceduralTextures(renderer.capabilities.getMaxAnisotropy());
    const mats = createBuildingMaterialLibrary(textures, isSoftwareGl);

    // 5. Natural Outdoor Surrounding Terrain & Bay (No floating box in empty void!)
    const outerGroundGeo = new THREE.PlaneGeometry(220, 220);
    const outerGroundMat = new THREE.MeshStandardMaterial({
      color: 0x45733b,
      roughness: 0.94,
      metalness: 0.0,
    });
    const outerGround = new THREE.Mesh(outerGroundGeo, outerGroundMat);
    outerGround.rotation.x = -Math.PI / 2;
    outerGround.position.y = -0.08;
    outerGround.receiveShadow = true;
    scene.add(outerGround);

    // Waterfront Bay along +Z edge
    const bayGeo = new THREE.PlaneGeometry(220, 95);
    const bayMat = new THREE.MeshPhysicalMaterial({
      color: 0x0e7490,
      roughness: 0.14,
      metalness: 0.18,
      clearcoat: 0.9,
    });
    const bayMesh = new THREE.Mesh(bayGeo, bayMat);
    bayMesh.rotation.x = -Math.PI / 2;
    bayMesh.position.set(0, -0.03, 66);
    bayMesh.receiveShadow = true;
    scene.add(bayMesh);

    // Gentle distant perimeter hills
    const hillGeo = new THREE.ConeGeometry(1, 1, 7);
    const hillMat = new THREE.MeshStandardMaterial({ color: 0x3b6634, roughness: 0.92 });
    const hillPositions: [number, number, number, number][] = [
      [-45, -42, 18, 9],
      [-18, -46, 22, 11],
      [14, -44, 19, 8],
      [44, -38, 20, 10],
      [-48, -10, 16, 7],
      [48, -6, 17, 8],
    ];
    hillPositions.forEach(([hx, hz, rad, hgt]) => {
      const m = new THREE.Mesh(hillGeo, hillMat);
      m.position.set(hx, hgt * 0.42 - 0.1, hz);
      m.scale.set(rad, hgt, rad);
      m.receiveShadow = true;
      scene.add(m);
    });

    // Instanced Perimeter Forest Groves (~220 trees outside the 24x24 playable grid)
    const treeCount = 220;
    const trunkGeo = new THREE.CylinderGeometry(0.11, 0.16, 0.85, 6);
    const crownGeo = new THREE.ConeGeometry(0.55, 1.35, 7);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9 });
    const crownMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
    const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    const crownInst = new THREE.InstancedMesh(crownGeo, crownMat, treeCount);
    trunkInst.castShadow = true;
    crownInst.castShadow = true;
    let placedTrees = 0;
    for (let i = 0; i < 600 && placedTrees < treeCount; i++) {
      const angle = (i * 2.39996) % (Math.PI * 2);
      const radius = 29 + ((i * 17) % 36);
      const tx = Math.cos(angle) * radius;
      const tz = Math.sin(angle) * radius;
      if (tz > 20) continue; // Keep bay open
      const sc = 0.82 + ((i * 13) % 35) / 100;
      _dummy.position.set(tx, 0.35 * sc, tz);
      _dummy.scale.set(sc, sc, sc);
      _dummy.rotation.set(0, (i * 0.7) % Math.PI, 0);
      _dummy.updateMatrix();
      trunkInst.setMatrixAt(placedTrees, _dummy.matrix);

      _dummy.position.set(tx, 1.25 * sc, tz);
      _dummy.updateMatrix();
      crownInst.setMatrixAt(placedTrees, _dummy.matrix);

      _color.setHSL(0.28 + ((i % 7) - 3) * 0.015, 0.48, 0.32 + (i % 5) * 0.03);
      crownInst.setColorAt(placedTrees, _color);
      placedTrees++;
    }
    trunkInst.count = placedTrees;
    crownInst.count = placedTrees;
    trunkInst.instanceMatrix.needsUpdate = true;
    crownInst.instanceMatrix.needsUpdate = true;
    if (crownInst.instanceColor) crownInst.instanceColor.needsUpdate = true;
    trunkInst.computeBoundingSphere();
    crownInst.computeBoundingSphere();
    scene.add(trunkInst);
    scene.add(crownInst);

    // 6. Playable 24x24 Tile Grid (InstancedMesh)
    const totalTiles = GRID_SIZE * GRID_SIZE;
    const tileGeo = new THREE.BoxGeometry(TILE_WORLD_SIZE * 0.985, 0.14, TILE_WORLD_SIZE * 0.985);
    const tileMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.88,
      metalness: 0.04,
    });
    const tileInst = new THREE.InstancedMesh(tileGeo, tileMat, totalTiles);
    tileInst.receiveShadow = true;
    tileInst.layers.enable(1); // Clickable layer 1
    for (let z = 0; z < GRID_SIZE; z++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const idx = z * GRID_SIZE + x;
        const [wx, wz] = tileToWorld(x, z);
        _dummy.position.set(wx, -0.07, wz);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        tileInst.setMatrixAt(idx, _dummy.matrix);
      }
    }
    tileInst.instanceMatrix.needsUpdate = true;
    tileInst.computeBoundingSphere();
    scene.add(tileInst);

    // Road & Avenue Layer
    const roadGroup = new THREE.Group();
    scene.add(roadGroup);
    const roadGeo = new THREE.PlaneGeometry(TILE_WORLD_SIZE, TILE_WORLD_SIZE);
    const roadMat = new THREE.MeshStandardMaterial({
      map: textures.road,
      roughness: 0.82,
      metalness: 0.05,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const avenueMat = new THREE.MeshStandardMaterial({
      map: textures.avenue,
      roughness: 0.8,
      metalness: 0.06,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    // Buildings & Conflicts Layer
    const buildingsGroup = new THREE.Group();
    scene.add(buildingsGroup);

    // 7. Animated Vehicles (InstancedMesh on Roads)
    const maxVehicles = 44;
    const vehicleGeo = new THREE.BoxGeometry(0.32, 0.2, 0.56);
    const vehicleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.32, metalness: 0.45 });
    const vehicleInst = new THREE.InstancedMesh(vehicleGeo, vehicleMat, maxVehicles);
    vehicleInst.castShadow = true;
    vehicleInst.frustumCulled = false;
    scene.add(vehicleInst);
    const vehicles: VehicleSim[] = [];
    const vehicleColors = [0xef4444, 0xf59e0b, 0x3b82f6, 0xe2e8f0, 0x10b981, 0x475569];

    // 8. Animated Autonomous Citizens (InstancedMesh: torso + head)
    const maxCitizens = 120;
    const citBodyGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.28, 7);
    const citHeadGeo = new THREE.SphereGeometry(0.075, 8, 6);
    const citBodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65 });
    const citHeadMat = new THREE.MeshStandardMaterial({ color: 0xf1c27d, roughness: 0.7 });
    const citBodyInst = new THREE.InstancedMesh(citBodyGeo, citBodyMat, maxCitizens);
    const citHeadInst = new THREE.InstancedMesh(citHeadGeo, citHeadMat, maxCitizens);
    citBodyInst.castShadow = true;
    citBodyInst.frustumCulled = false;
    citHeadInst.frustumCulled = false;
    scene.add(citBodyInst);
    scene.add(citHeadInst);

    // 9. Selection & Hover Rings + Build Ghost Preview
    const ringGeo = new THREE.RingGeometry(0.84, 0.98, 4);
    const selectRingMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
    });
    const selectRing = new THREE.Mesh(ringGeo, selectRingMat);
    selectRing.rotation.x = -Math.PI / 2;
    selectRing.rotation.z = Math.PI / 4;
    selectRing.position.y = 0.04;
    selectRing.visible = false;
    scene.add(selectRing);

    const citizenRingGeo = new THREE.RingGeometry(0.22, 0.34, 24);
    const citizenRing = new THREE.Mesh(citizenRingGeo, selectRingMat);
    citizenRing.rotation.x = -Math.PI / 2;
    citizenRing.position.y = 0.04;
    citizenRing.visible = false;
    scene.add(citizenRing);

    const ghostHolder = new THREE.Group();
    ghostHolder.visible = false;
    scene.add(ghostHolder);
    const ghostPad = new THREE.Mesh(
      new THREE.PlaneGeometry(TILE_WORLD_SIZE * 0.94, TILE_WORLD_SIZE * 0.94),
      new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.36 }),
    );
    ghostPad.rotation.x = -Math.PI / 2;
    ghostPad.position.y = 0.03;
    ghostHolder.add(ghostPad);

    let lastGhostKey = '';
    let lastGridVersion = -1;
    let lastThematicMode: ThematicMapMode = 'normal';

    const syncGridVisuals = (tiles: TileData[], thematicMode: ThematicMapMode) => {
      // Update tile colors
      for (let i = 0; i < tiles.length; i++) {
        getThematicTileColor(tiles[i], thematicMode, _color);
        tileInst.setColorAt(i, _color);
      }
      if (tileInst.instanceColor) tileInst.instanceColor.needsUpdate = true;

      // Clear & rebuild roads and buildings cleanly
      while (roadGroup.children.length > 0) {
        roadGroup.remove(roadGroup.children[0]);
      }
      while (buildingsGroup.children.length > 0) {
        buildingsGroup.remove(buildingsGroup.children[0]);
      }

      const roadTiles: TileData[] = [];
      for (const tile of tiles) {
        const [wx, wz] = tileToWorld(tile.x, tile.z);

        if (tile.road !== 'none') {
          roadTiles.push(tile);
          const rMesh = new THREE.Mesh(roadGeo, tile.road === 'avenida' ? avenueMat : roadMat);
          rMesh.rotation.x = -Math.PI / 2;
          // Auto-orient horizontally if connected E/W and not N/S
          const left = tile.x > 0 && tiles[tile.z * GRID_SIZE + (tile.x - 1)].road !== 'none';
          const right = tile.x < GRID_SIZE - 1 && tiles[tile.z * GRID_SIZE + (tile.x + 1)].road !== 'none';
          const up = tile.z > 0 && tiles[(tile.z - 1) * GRID_SIZE + tile.x].road !== 'none';
          const down = tile.z < GRID_SIZE - 1 && tiles[(tile.z + 1) * GRID_SIZE + tile.x].road !== 'none';
          if ((left || right) && !up && !down) {
            rMesh.rotation.z = Math.PI / 2;
          }
          rMesh.position.set(wx, 0.012, wz);
          rMesh.receiveShadow = true;
          roadGroup.add(rMesh);
        }

        if (tile.building) {
          const bGroup = buildProceduralBuildingMesh(tile.building.type, tile.building.level, mats);
          bGroup.position.set(wx, 0, wz);
          bGroup.rotation.y = tile.building.rotation * (Math.PI / 2);
          buildingsGroup.add(bGroup);
        } else if (tile.conflict) {
          const cGroup = buildConflictMarkerMesh(mats);
          cGroup.position.set(wx, 0, wz);
          buildingsGroup.add(cGroup);
        }
      }

      // Sync vehicle pool onto road tiles
      vehicles.length = 0;
      const desiredVehicles = Math.min(maxVehicles, Math.max(4, Math.floor(roadTiles.length * 0.7)));
      for (let i = 0; i < desiredVehicles && roadTiles.length > 0; i++) {
        const rt = roadTiles[i % roadTiles.length];
        const [wx, wz] = tileToWorld(rt.x, rt.z);
        vehicles.push({
          x: wx,
          z: wz,
          dirX: i % 2 === 0 ? 1 : 0,
          dirZ: i % 2 === 0 ? 0 : 1,
          speed: 2.2 + (i % 4) * 0.45,
          color: vehicleColors[i % vehicleColors.length],
        });
      }
      vehicleInst.count = vehicles.length;
      for (let i = 0; i < vehicles.length; i++) {
        _color.setHex(vehicles[i].color);
        vehicleInst.setColorAt(i, _color);
      }
      if (vehicleInst.instanceColor) vehicleInst.instanceColor.needsUpdate = true;
    };

    // 10. Pointer Raycasting (Click to select tile/citizen, Hover for placement preview)
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointerNdc = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };
    let lastHoverTime = 0;
    let hoveredTile: [number, number] | null = null;

    const updatePointerNdc = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverTime < 40) return;
      lastHoverTime = now;

      updatePointerNdc(e);
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObject(tileInst, false);
      if (hits.length > 0) {
        const p = hits[0].point;
        hoveredTile = worldToTile(p.x, p.z);
      } else {
        hoveredTile = null;
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const moved = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (moved > 6) return; // Was dragging camera, not clicking

      updatePointerNdc(e);
      const state = useGameStore.getState();

      // Check citizen proximity picking when in select mode
      if (state.activeTool === 'select') {
        const fullRay = new THREE.Raycaster();
        fullRay.setFromCamera(pointerNdc, camera);
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        if (fullRay.ray.intersectPlane(groundPlane, _vec3)) {
          let closestId: string | null = null;
          let bestDist = 0.72;
          for (const cit of state.citizens) {
            const [cx, cz] = tileToWorld(cit.x, cit.z);
            const dist = Math.hypot(_vec3.x - cx, _vec3.z - cz);
            if (dist < bestDist) {
              bestDist = dist;
              closestId = cit.id;
            }
          }
          if (closestId) {
            state.selectCitizen(closestId);
            return;
          }
        }
      }

      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObject(tileInst, false);
      if (hits.length > 0) {
        const coords = worldToTile(hits[0].point.x, hits[0].point.z);
        if (coords) {
          state.interactWithTile(coords[0], coords[1]);
        }
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);

    // 11. Keyboard Input (WASD camera pan + R to rotate preview + H for Zen mode)
    const keys: Record<string, boolean> = {};
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      keys[e.code] = true;
      if (e.code === 'KeyR') {
        useGameStore.getState().rotateBuildPreview();
      } else if (e.code === 'KeyH') {
        useGameStore.getState().toggleZenMode();
      } else if (e.code === 'Escape') {
        useGameStore.getState().setActiveTool('select', null);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Camera transition state
    let activeCamGoal: { target: THREE.Vector3; pos?: THREE.Vector3 } | null = null;
    let lastCamNonce = 0;

    controls.addEventListener('start', () => {
      activeCamGoal = null;
    });

    // Resize handling
    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // 12. Main 4D Game & Render Loop
    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (disposed) return;
      const dt = Math.min(0.1, clock.getDelta());
      const state = useGameStore.getState();

      // Advance simulation
      state.advanceSimulation(dt);
      const updated = useGameStore.getState();

      // Sync grid & buildings when changed
      if (updated.gridVersion !== lastGridVersion || updated.thematicMode !== lastThematicMode) {
        syncGridVisuals(updated.tiles, updated.thematicMode);
        lastGridVersion = updated.gridVersion;
        lastThematicMode = updated.thematicMode;
      }

      // Day/Night Atmosphere & Dynamic Sun
      const h = updated.hourOfDay;
      const dayAngle = ((h - 6) / 24) * Math.PI * 2;
      const sunY = Math.sin(dayAngle) * 42;
      const sunX = Math.cos(dayAngle) * 42;
      sunLight.position.set(sunX, Math.max(8, sunY), 22);

      // Daylight factor 0 (night) -> 1 (noon)
      const daylight = THREE.MathUtils.clamp((Math.sin(dayAngle) + 0.25) / 1.15, 0, 1);
      const sunsetFactor = THREE.MathUtils.clamp(1 - Math.abs(daylight - 0.3) * 3.2, 0, 1);

      _color.copy(_skyNight).lerp(_skyDay, daylight).lerp(_skySunset, sunsetFactor * 0.65);
      (scene.background as THREE.Color).copy(_color);
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.copy(_color);
      }

      sunLight.intensity = 0.35 + daylight * 1.65;
      sunLight.color.copy(_sunNight).lerp(_sunDay, daylight).lerp(_sunSunset, sunsetFactor * 0.7);
      hemiLight.intensity = 0.32 + daylight * 0.55;

      const nightGlow = THREE.MathUtils.clamp((0.45 - daylight) * 2.2, 0, 1);
      mats.facadeWindowMat.emissiveIntensity = nightGlow * 1.1;
      mats.nightGlowMat.emissiveIntensity = 0.12 + nightGlow * 1.3;

      // Update animated vehicles on roads
      const speedMult = updated.speed === 0 ? 0 : Math.min(4, updated.speed);
      if (speedMult > 0 && vehicles.length > 0) {
        for (let i = 0; i < vehicles.length; i++) {
          const v = vehicles[i];
          v.x += v.dirX * v.speed * dt * speedMult;
          v.z += v.dirZ * v.speed * dt * speedMult;

          const coords = worldToTile(v.x, v.z);
          const curTile = coords ? updated.tiles[coords[1] * GRID_SIZE + coords[0]] : null;
          if (!curTile || curTile.road === 'none') {
            // Turn or reverse onto an adjacent road
            const tx = coords ? coords[0] : 11;
            const tz = coords ? coords[1] : 11;
            const dirs = [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ];
            let found = false;
            for (const [dx, dz] of dirs) {
              const nx = tx + dx;
              const nz = tz + dz;
              if (nx >= 0 && nz >= 0 && nx < GRID_SIZE && nz < GRID_SIZE) {
                if (updated.tiles[nz * GRID_SIZE + nx].road !== 'none') {
                  const [wx, wz] = tileToWorld(nx, nz);
                  v.x = wx;
                  v.z = wz;
                  v.dirX = dx;
                  v.dirZ = dz;
                  found = true;
                  break;
                }
              }
            }
            if (!found) {
              v.dirX = -v.dirX;
              v.dirZ = -v.dirZ;
            }
          }

          _dummy.position.set(v.x + v.dirZ * 0.25, 0.12, v.z - v.dirX * 0.25);
          _dummy.rotation.set(0, Math.atan2(v.dirX, v.dirZ), 0);
          _dummy.scale.set(1, 1, 1);
          _dummy.updateMatrix();
          vehicleInst.setMatrixAt(i, _dummy.matrix);
        }
        vehicleInst.instanceMatrix.needsUpdate = true;
      }

      // Update autonomous 3D citizens InstancedMesh
      const citCount = Math.min(maxCitizens, updated.citizens.length);
      citBodyInst.count = citCount;
      citHeadInst.count = citCount;
      for (let i = 0; i < citCount; i++) {
        const cit = updated.citizens[i];
        const [wx, wz] = tileToWorld(cit.x, cit.z);
        const bob = updated.speed > 0 ? Math.abs(Math.sin(performance.now() * 0.008 + i)) * 0.04 : 0;

        _dummy.position.set(wx, 0.16 + bob, wz);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        citBodyInst.setMatrixAt(i, _dummy.matrix);

        _dummy.position.set(wx, 0.38 + bob, wz);
        _dummy.updateMatrix();
        citHeadInst.setMatrixAt(i, _dummy.matrix);

        _color.setHex(cit.state === 'protesting' ? 0xef4444 : cit.shirtColor);
        citBodyInst.setColorAt(i, _color);
      }
      citBodyInst.instanceMatrix.needsUpdate = true;
      citHeadInst.instanceMatrix.needsUpdate = true;
      if (citBodyInst.instanceColor) citBodyInst.instanceColor.needsUpdate = true;

      // Update selection ring
      if (updated.selectedTileCoords) {
        const [wx, wz] = tileToWorld(updated.selectedTileCoords.x, updated.selectedTileCoords.z);
        selectRing.position.set(wx, 0.045, wz);
        selectRing.visible = true;
      } else {
        selectRing.visible = false;
      }

      if (updated.selectedCitizenId) {
        const cit = updated.citizens.find((c) => c.id === updated.selectedCitizenId);
        if (cit) {
          const [wx, wz] = tileToWorld(cit.x, cit.z);
          citizenRing.position.set(wx, 0.05, wz);
          citizenRing.visible = true;
        } else {
          citizenRing.visible = false;
        }
      } else {
        citizenRing.visible = false;
      }

      // Update ghost placement preview
      if (
        hoveredTile &&
        ((updated.activeTool === 'build' && updated.selectedBuildType) ||
          (updated.activeTool === 'move' && updated.moveSourceTile))
      ) {
        const [hx, hz] = hoveredTile;
        const [wx, wz] = tileToWorld(hx, hz);
        const tile = updated.tiles[hz * GRID_SIZE + hx];
        const previewType =
          updated.activeTool === 'build'
            ? updated.selectedBuildType!
            : updated.tiles[updated.moveSourceTile!.z * GRID_SIZE + updated.moveSourceTile!.x]?.building?.type;

        if (previewType) {
          const ghostKey = `${previewType}_${updated.buildRotation}`;
          if (ghostKey !== lastGhostKey) {
            while (ghostHolder.children.length > 1) {
              ghostHolder.remove(ghostHolder.children[1]);
            }
            if (!BUILDING_CATALOG[previewType].isRoad) {
              const previewMesh = buildProceduralBuildingMesh(previewType, 1, mats);
              previewMesh.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                  (child as THREE.Mesh).castShadow = false;
                }
              });
              previewMesh.rotation.y = updated.buildRotation * (Math.PI / 2);
              ghostHolder.add(previewMesh);
            }
            lastGhostKey = ghostKey;
          }
          const isValid =
            tile &&
            !tile.building &&
            !tile.conflict &&
            (BUILDING_CATALOG[previewType].isRoad
              ? true
              : tile.road === 'none' && (tile.terrain !== 'waterfront' || BUILDING_CATALOG[previewType].category === 'leisure'));
          (ghostPad.material as THREE.MeshBasicMaterial).color.setHex(isValid ? 0x22c55e : 0xef4444);
          ghostHolder.position.set(wx, 0.02, wz);
          ghostHolder.visible = true;
        }
      } else {
        ghostHolder.visible = false;
      }

      // Process WASD panning
      const panSpeed = 18 * dt;
      if (keys['KeyW'] || keys['KeyS'] || keys['KeyA'] || keys['KeyD']) {
        activeCamGoal = null;
        camera.getWorldDirection(_vec3);
        _vec3.y = 0;
        _vec3.normalize();
        _vec3B.crossVectors(_vec3, camera.up).normalize();
        let dx = 0;
        let dz = 0;
        if (keys['KeyW']) {
          dx += _vec3.x * panSpeed;
          dz += _vec3.z * panSpeed;
        }
        if (keys['KeyS']) {
          dx -= _vec3.x * panSpeed;
          dz -= _vec3.z * panSpeed;
        }
        if (keys['KeyD']) {
          dx += _vec3B.x * panSpeed;
          dz += _vec3B.z * panSpeed;
        }
        if (keys['KeyA']) {
          dx -= _vec3B.x * panSpeed;
          dz -= _vec3B.z * panSpeed;
        }
        camera.position.x += dx;
        camera.position.z += dz;
        controls.target.x = THREE.MathUtils.clamp(controls.target.x + dx, -26, 26);
        controls.target.z = THREE.MathUtils.clamp(controls.target.z + dz, -26, 26);
      }

      // Handle explicit camera commands & citizen follow mode
      if (updated.cameraCommand && updated.cameraCommand.nonce !== lastCamNonce) {
        lastCamNonce = updated.cameraCommand.nonce;
        const cmd = updated.cameraCommand;
        if (cmd.type === 'reset') {
          activeCamGoal = {
            target: new THREE.Vector3(0, 0, 0),
            pos: new THREE.Vector3(24, 24, 24),
          };
        } else if (cmd.type === 'focus_tile' && cmd.x !== undefined && cmd.z !== undefined) {
          const [wx, wz] = tileToWorld(cmd.x, cmd.z);
          activeCamGoal = {
            target: new THREE.Vector3(wx, 0, wz),
            pos: new THREE.Vector3(wx + 12, 13, wz + 12),
          };
        } else if (cmd.type === 'rotate_left' || cmd.type === 'rotate_right') {
          const angle = cmd.type === 'rotate_left' ? Math.PI / 4 : -Math.PI / 4;
          const offset = camera.position.clone().sub(controls.target);
          offset.applyAxisAngle(camera.up, angle);
          activeCamGoal = {
            target: controls.target.clone(),
            pos: controls.target.clone().add(offset),
          };
        } else if (cmd.type === 'tilt_up' || cmd.type === 'tilt_down') {
          const offset = camera.position.clone().sub(controls.target);
          offset.y = THREE.MathUtils.clamp(offset.y + (cmd.type === 'tilt_up' ? 5 : -5), 6, 44);
          activeCamGoal = {
            target: controls.target.clone(),
            pos: controls.target.clone().add(offset),
          };
        } else if (cmd.type === 'zoom_in' || cmd.type === 'zoom_out') {
          const offset = camera.position.clone().sub(controls.target);
          offset.multiplyScalar(cmd.type === 'zoom_in' ? 0.78 : 1.25);
          if (offset.length() >= 11 && offset.length() <= 72) {
            activeCamGoal = {
              target: controls.target.clone(),
              pos: controls.target.clone().add(offset),
            };
          }
        }
      }

      if (updated.followedCitizenId) {
        const cit = updated.citizens.find((c) => c.id === updated.followedCitizenId);
        if (cit) {
          const [wx, wz] = tileToWorld(cit.x, cit.z);
          controls.target.x = THREE.MathUtils.damp(controls.target.x, wx, 6, dt);
          controls.target.z = THREE.MathUtils.damp(controls.target.z, wz, 6, dt);
          camera.position.x = THREE.MathUtils.damp(camera.position.x, wx + 8, 4, dt);
          camera.position.y = THREE.MathUtils.damp(camera.position.y, 9.5, 4, dt);
          camera.position.z = THREE.MathUtils.damp(camera.position.z, wz + 8, 4, dt);
        }
      } else if (activeCamGoal) {
        controls.target.x = THREE.MathUtils.damp(controls.target.x, activeCamGoal.target.x, 6, dt);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, activeCamGoal.target.z, 6, dt);
        if (activeCamGoal.pos) {
          camera.position.x = THREE.MathUtils.damp(camera.position.x, activeCamGoal.pos.x, 6, dt);
          camera.position.y = THREE.MathUtils.damp(camera.position.y, activeCamGoal.pos.y, 6, dt);
          camera.position.z = THREE.MathUtils.damp(camera.position.z, activeCamGoal.pos.z, 6, dt);
          if (camera.position.distanceTo(activeCamGoal.pos) < 0.15) {
            activeCamGoal = null;
          }
        }
      }

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);

      controls.dispose();
      envTexture.dispose();
      textures.dispose();
      mats.dispose();
      outerGroundGeo.dispose();
      outerGroundMat.dispose();
      bayGeo.dispose();
      bayMat.dispose();
      hillGeo.dispose();
      hillMat.dispose();
      trunkGeo.dispose();
      crownGeo.dispose();
      trunkMat.dispose();
      crownMat.dispose();
      tileGeo.dispose();
      tileMat.dispose();
      roadGeo.dispose();
      roadMat.dispose();
      avenueMat.dispose();
      vehicleGeo.dispose();
      vehicleMat.dispose();
      citBodyGeo.dispose();
      citHeadGeo.dispose();
      citBodyMat.dispose();
      citHeadMat.dispose();
      ringGeo.dispose();
      citizenRingGeo.dispose();
      selectRingMat.dispose();
      renderer.dispose();
      if (canvas.parentElement === container) {
        container.removeChild(canvas);
      }
    };
  }, []);

  if (contextLost) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-200 p-6 text-center">
        <p className="font-display text-xl font-semibold text-amber-400">
          Contexto Gráfico 3D Interrompido
        </p>
        <p className="text-sm text-slate-400 mt-2 max-w-md">
          O navegador suspendeu temporariamente o WebGL. Recarregue a página para restaurar a cidade em 3D.
        </p>
      </div>
    );
  }

  return <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />;
};
