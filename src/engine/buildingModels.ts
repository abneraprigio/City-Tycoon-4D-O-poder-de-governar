import * as THREE from 'three';
import { BuildingTypeId } from '../types/game';
import { ProceduralTextureSet } from './proceduralTextures';

export interface BuildingMaterialLibrary {
  concreteMat: THREE.MeshStandardMaterial;
  darkConcreteMat: THREE.MeshStandardMaterial;
  terracottaRoofMat: THREE.MeshStandardMaterial;
  slateRoofMat: THREE.MeshStandardMaterial;
  metalSteelMat: THREE.MeshStandardMaterial;
  glassMat: THREE.MeshPhysicalMaterial;
  facadeWindowMat: THREE.MeshStandardMaterial;
  brickMat: THREE.MeshStandardMaterial;
  woodMat: THREE.MeshStandardMaterial;
  goldAccentMat: THREE.MeshStandardMaterial;
  parkGrassMat: THREE.MeshStandardMaterial;
  waterPoolMat: THREE.MeshPhysicalMaterial;
  redAccentMat: THREE.MeshStandardMaterial;
  blueAccentMat: THREE.MeshStandardMaterial;
  amberAccentMat: THREE.MeshStandardMaterial;
  nightGlowMat: THREE.MeshStandardMaterial;
  shadowPlaneMat: THREE.MeshBasicMaterial;
  dispose: () => void;
}

export function createBuildingMaterialLibrary(
  textures: ProceduralTextureSet,
  isSoftwareGl: boolean,
): BuildingMaterialLibrary {
  const concreteMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.85,
    metalness: 0.05,
  });
  const darkConcreteMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.88,
    metalness: 0.08,
  });
  const terracottaRoofMat = new THREE.MeshStandardMaterial({
    color: 0xb45338,
    roughness: 0.78,
    metalness: 0.05,
  });
  const slateRoofMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.72,
    metalness: 0.15,
  });
  const metalSteelMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.28,
    metalness: 0.82,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x7dd3fc,
    roughness: 0.12,
    metalness: 0.15,
    clearcoat: 1.0,
    transparent: true,
    opacity: isSoftwareGl ? 0.55 : 0.72,
  });
  const facadeWindowMat = new THREE.MeshStandardMaterial({
    map: textures.facadeDay,
    emissiveMap: textures.facadeNightEmissive,
    emissive: new THREE.Color(0xffd28a),
    emissiveIntensity: 0.0,
    roughness: 0.42,
    metalness: 0.25,
  });
  const brickMat = new THREE.MeshStandardMaterial({
    map: textures.brick,
    roughness: 0.86,
    metalness: 0.04,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x8b5a2b,
    roughness: 0.82,
    metalness: 0.02,
  });
  const goldAccentMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.24,
    metalness: 0.85,
  });
  const parkGrassMat = new THREE.MeshStandardMaterial({
    color: 0x4d8c40,
    roughness: 0.92,
    metalness: 0.0,
  });
  const waterPoolMat = new THREE.MeshPhysicalMaterial({
    color: 0x0ea5e9,
    roughness: 0.1,
    metalness: 0.1,
    clearcoat: 1.0,
  });
  const redAccentMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.45,
    metalness: 0.2,
  });
  const blueAccentMat = new THREE.MeshStandardMaterial({
    color: 0x2563eb,
    roughness: 0.45,
    metalness: 0.2,
  });
  const amberAccentMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.5,
    metalness: 0.15,
  });
  const nightGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: new THREE.Color(0xfbbf24),
    emissiveIntensity: 0.15,
    roughness: 0.3,
  });
  const shadowPlaneMat = new THREE.MeshBasicMaterial({
    map: textures.contactShadow,
    transparent: true,
    depthWrite: false,
    opacity: 0.5,
  });

  const all = [
    concreteMat,
    darkConcreteMat,
    terracottaRoofMat,
    slateRoofMat,
    metalSteelMat,
    glassMat,
    facadeWindowMat,
    brickMat,
    woodMat,
    goldAccentMat,
    parkGrassMat,
    waterPoolMat,
    redAccentMat,
    blueAccentMat,
    amberAccentMat,
    nightGlowMat,
    shadowPlaneMat,
  ];

  return {
    concreteMat,
    darkConcreteMat,
    terracottaRoofMat,
    slateRoofMat,
    metalSteelMat,
    glassMat,
    facadeWindowMat,
    brickMat,
    woodMat,
    goldAccentMat,
    parkGrassMat,
    waterPoolMat,
    redAccentMat,
    blueAccentMat,
    amberAccentMat,
    nightGlowMat,
    shadowPlaneMat,
    dispose: () => {
      all.forEach((m) => m.dispose());
    },
  };
}

// Shared primitive geometries (cached for high performance and zero GC)
const _box1 = new THREE.BoxGeometry(1, 1, 1);
const _cyl1 = new THREE.CylinderGeometry(1, 1, 1, 12);
const _cone1 = new THREE.ConeGeometry(1, 1, 4);
const _coneRound = new THREE.ConeGeometry(1, 1, 10);
const _plane1 = new THREE.PlaneGeometry(1, 1);

function addPart(
  group: THREE.Group,
  geom: THREE.BufferGeometry,
  mat: THREE.Material,
  px: number,
  py: number,
  pz: number,
  sx: number,
  sy: number,
  sz: number,
  ry = 0,
  castShadow = true,
) {
  const m = new THREE.Mesh(geom, mat);
  m.position.set(px, py, pz);
  m.scale.set(sx, sy, sz);
  if (ry !== 0) m.rotation.y = ry;
  m.castShadow = castShadow;
  m.receiveShadow = true;
  group.add(m);
  return m;
}

function addContactShadow(group: THREE.Group, mat: THREE.Material, size = 1.85) {
  const m = new THREE.Mesh(_plane1, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.015;
  m.scale.set(size, size, 1);
  m.receiveShadow = false;
  m.castShadow = false;
  group.add(m);
}

/**
 * Creates a composite 3–12 part procedural 3D building group grounded at y = 0.
 * Scale fits comfortably inside a 2x2 tile footprint.
 */
export function buildProceduralBuildingMesh(
  type: BuildingTypeId,
  level: 1 | 2 | 3,
  mats: BuildingMaterialLibrary,
): THREE.Group {
  const g = new THREE.Group();
  const lvlBonus = (level - 1) * 0.32;

  addContactShadow(g, mats.shadowPlaneMat, 1.88);

  switch (type) {
    case 'prefeitura': {
      // Grand Civic Hall (9 parts): stepped plinth, main hall, colonnade, pediment, dome, flagpole
      addPart(g, _box1, mats.darkConcreteMat, 0, 0.08, 0, 1.75, 0.16, 1.6);
      addPart(g, _box1, mats.concreteMat, 0, 0.58, -0.08, 1.5, 0.85, 1.1);
      addPart(g, _box1, mats.facadeWindowMat, 0, 0.62, 0.48, 1.38, 0.65, 0.06);
      // Columns
      for (const cx of [-0.52, -0.18, 0.18, 0.52]) {
        addPart(g, _cyl1, mats.concreteMat, cx, 0.56, 0.58, 0.06, 0.8, 0.06);
      }
      // Roof & pediment
      addPart(g, _box1, mats.slateRoofMat, 0, 1.06, 0.05, 1.62, 0.12, 1.32);
      addPart(g, _cyl1, mats.concreteMat, 0, 1.32, -0.05, 0.34, 0.4, 0.34);
      addPart(g, _cyl1, mats.goldAccentMat, 0, 1.62, -0.05, 0.28, 0.24, 0.28);
      addPart(g, _cyl1, mats.metalSteelMat, 0, 1.92, -0.05, 0.025, 0.45, 0.025);
      addPart(g, _box1, mats.blueAccentMat, 0.12, 2.04, -0.05, 0.22, 0.14, 0.02);
      break;
    }

    case 'rede_energia': {
      // Substation (7 parts): concrete pad, control house, 2 transformers, 2 pylons, insulator bar
      addPart(g, _box1, mats.darkConcreteMat, 0, 0.05, 0, 1.7, 0.1, 1.7);
      addPart(g, _box1, mats.concreteMat, -0.42, 0.36, -0.35, 0.65, 0.52, 0.65);
      addPart(g, _cyl1, mats.metalSteelMat, 0.35, 0.42, -0.35, 0.24, 0.62, 0.24);
      addPart(g, _cyl1, mats.metalSteelMat, 0.35, 0.42, 0.25, 0.24, 0.62, 0.24);
      addPart(g, _box1, mats.amberAccentMat, -0.35, 0.28, 0.38, 0.48, 0.36, 0.38);
      addPart(g, _cyl1, mats.metalSteelMat, 0, 0.95, 0.0, 0.05, 1.5, 0.05);
      addPart(g, _box1, mats.goldAccentMat, 0, 1.45, 0.0, 1.1, 0.08, 0.08);
      break;
    }

    case 'saneamento': {
      // Water/Sanitation Plant (7 parts): pad, 2 circular clarifier tanks, water inside, pump house, water tower
      addPart(g, _box1, mats.darkConcreteMat, 0, 0.05, 0, 1.72, 0.1, 1.72);
      addPart(g, _cyl1, mats.concreteMat, -0.38, 0.26, 0.28, 0.4, 0.34, 0.4);
      addPart(g, _cyl1, mats.waterPoolMat, -0.38, 0.44, 0.28, 0.34, 0.04, 0.34);
      addPart(g, _cyl1, mats.concreteMat, 0.38, 0.26, 0.28, 0.4, 0.34, 0.4);
      addPart(g, _cyl1, mats.waterPoolMat, 0.38, 0.44, 0.28, 0.34, 0.04, 0.34);
      addPart(g, _box1, mats.blueAccentMat, -0.32, 0.36, -0.4, 0.72, 0.52, 0.55);
      // Elevated water tower
      addPart(g, _cyl1, mats.metalSteelMat, 0.42, 0.72, -0.4, 0.12, 1.25, 0.12);
      addPart(g, _cyl1, mats.blueAccentMat, 0.42, 1.38, -0.4, 0.32, 0.38, 0.32);
      break;
    }

    case 'casa_popular': {
      // Popular house (6 parts): base, stucco walls, pitched terracotta roof, porch, door, roof water tank
      const h = 0.52 + lvlBonus * 0.45;
      addPart(g, _box1, mats.darkConcreteMat, 0, 0.04, 0, 1.4, 0.08, 1.4);
      addPart(g, _box1, mats.concreteMat, 0, 0.08 + h / 2, 0, 1.1, h, 1.0);
      addPart(g, _cone1, mats.terracottaRoofMat, 0, 0.08 + h + 0.22, 0, 0.92, 0.44, 0.92, Math.PI / 4);
      addPart(g, _box1, mats.woodMat, 0, 0.24, 0.51, 0.22, 0.32, 0.04);
      addPart(g, _box1, mats.nightGlowMat, -0.3, 0.32, 0.51, 0.2, 0.18, 0.04);
      addPart(g, _cyl1, mats.blueAccentMat, 0.35, 0.08 + h + 0.15, -0.28, 0.14, 0.22, 0.14);
      break;
    }

    case 'casa_media': {
      // Mid-tier house (7 parts): lawn plinth, 2-story body, hip roof, garage wing, balcony, glowing windows
      const h = 0.72 + lvlBonus * 0.55;
      addPart(g, _box1, mats.parkGrassMat, 0, 0.03, 0, 1.7, 0.06, 1.7);
      addPart(g, _box1, mats.concreteMat, -0.15, 0.06 + h / 2, 0, 1.05, h, 1.05);
      addPart(g, _box1, mats.brickMat, 0.48, 0.26, 0.1, 0.48, 0.42, 0.85);
      addPart(g, _cone1, mats.slateRoofMat, -0.15, 0.06 + h + 0.24, 0, 0.88, 0.46, 0.88, Math.PI / 4);
      addPart(g, _box1, mats.facadeWindowMat, -0.15, 0.06 + h * 0.55, 0.53, 0.85, h * 0.68, 0.04);
      addPart(g, _box1, mats.metalSteelMat, 0.48, 0.22, 0.54, 0.36, 0.28, 0.04);
      break;
    }

    case 'condominio': {
      // Residential Condominium (8 parts): courtyard base, twin L-wings, pool, gatehouse, pitched roofs
      const h = 0.95 + lvlBonus * 0.85;
      addPart(g, _box1, mats.darkConcreteMat, 0, 0.04, 0, 1.78, 0.08, 1.78);
      addPart(g, _box1, mats.facadeWindowMat, -0.45, 0.08 + h / 2, -0.1, 0.62, h, 1.35);
      addPart(g, _box1, mats.facadeWindowMat, 0.45, 0.08 + h / 2, -0.1, 0.62, h, 1.35);
      addPart(g, _box1, mats.terracottaRoofMat, -0.45, 0.08 + h + 0.08, -0.1, 0.66, 0.16, 1.4);
      addPart(g, _box1, mats.terracottaRoofMat, 0.45, 0.08 + h + 0.08, -0.1, 0.66, 0.16, 1.4);
      addPart(g, _box1, mats.waterPoolMat, 0, 0.09, 0.05, 0.28, 0.03, 0.55);
      addPart(g, _box1, mats.concreteMat, 0, 0.2, 0.68, 0.44, 0.24, 0.28);
      break;
    }

    case 'predio_residencial': {
      // High-rise Residential Tower (7 parts): podium, main tower, glass trim, penthouse, water/HVAC crown
      const h = 1.85 + lvlBonus * 1.4;
      addPart(g, _box1, mats.darkConcreteMat, 0, 0.12, 0, 1.65, 0.24, 1.65);
      addPart(g, _box1, mats.facadeWindowMat, 0, 0.24 + h / 2, 0, 1.25, h, 1.25);
      addPart(g, _box1, mats.concreteMat, 0, 0.24 + h / 2, 0, 1.3, h * 0.96, 0.22);
      addPart(g, _box1, mats.concreteMat, 0, 0.24 + h / 2, 0, 0.22, h * 0.96, 1.3);
      addPart(g, _box1, mats.slateRoofMat, 0, 0.24 + h + 0.12, 0, 0.9, 0.24, 0.9);
      addPart(g, _box1, mats.metalSteelMat, 0.22, 0.24 + h + 0.3, -0.15, 0.28, 0.16, 0.28);
      break;
    }

    case 'padaria': {
      // Bakery (6 parts): warm brick body, striped awning, glass storefront, signboard, chimney
      const h = 0.62 + lvlBonus * 0.35;
      addPart(g, _box1, mats.darkConcreteMat, 0, 0.04, 0, 1.56, 0.08, 1.56);
      addPart(g, _box1, mats.brickMat, 0, 0.08 + h / 2, 0, 1.25, h, 1.15);
      addPart(g, _box1, mats.amberAccentMat, 0, 0.36, 0.66, 1.15, 0.1, 0.28);
      addPart(g, _box1, mats.nightGlowMat, 0, 0.24, 0.59, 0.92, 0.26, 0.04);
      addPart(g, _box1, mats.terracottaRoofMat, 0, 0.08 + h + 0.06, 0, 1.34, 0.12, 1.24);
      addPart(g, _cyl1, mats.brickMat, -0.38, 0.08 + h + 0.24, -0.3, 0.12, 0.38, 0.12);
      break;
    }

    case 'mercado': {
      // Municipal Market (6 parts): wide hall, vaulted slate roof, glazed entry, loading dock, signboard
      const h = 0.72 + lvlBonus * 0.4;
      addPart(g, _box1, mats.darkConcreteMat, 0, 0.04, 0, 1.74, 0.08, 1.74);
      addPart(g, _box1, mats.concreteMat, 0, 0.08 + h / 2, 0, 1.48, h, 1.3);
      addPart(g, _box1, mats.blueAccentMat, 0, 0.08 + h + 0.1, 0, 1.54, 0.18, 1.36);
      addPart(g, _box1, mats.glassMat, 0, 0.36, 0.67, 1.05, 0.46, 0.08);
      addPart(g, _box1, mats.amberAccentMat, 0, 0.72, 0.68, 0.85, 0.14, 0.06);
      break;
    }

    case 'restaurante': {
      // Restaurant (7 parts): wooden deck patio, main hall, pitched roof, patio umbrellas, warm windows
      const h = 0.66 + lvlBonus * 0.4;
      addPart(g, _box1, mats.woodMat, 0, 0.04, 0, 1.7, 0.08, 1.7);
      addPart(g, _box1, mats.brickMat, 0, 0.08 + h / 2, -0.18, 1.35, h, 0.98);
      addPart(g, _box1, mats.terracottaRoofMat, 0, 0.08 + h + 0.12, -0.18, 1.44, 0.22, 1.08);
      addPart(g, _box1, mats.nightGlowMat, 0, 0.36, 0.32, 1.05, 0.38, 0.05);
      // Patio umbrellas
      for (const ux of [-0.42, 0.42]) {
        addPart(g, _cyl1, mats.metalSteelMat, ux, 0.28, 0.56, 0.03, 0.4, 0.03);
        addPart(g, _coneRound, mats.redAccentMat, ux, 0.5, 0.56, 0.26, 0.14, 0.26);
      }
      break;
    }

    case 'loja': {
      // Retail Gallery (6 parts): 2-level urban facade, glass display, cornice, signboard
      const h = 1.05 + lvlBonus * 0.65;
      addPart(g, _box1, mats.darkConcreteMat, 0, 0.04, 0, 1.66, 0.08, 1.66);
      addPart(g, _box1, mats.facadeWindowMat, 0, 0.08 + h / 2, 0, 1.4, h, 1.28);
      addPart(g, _box1, mats.glassMat, 0, 0.28, 0.66, 1.24, 0.38, 0.08);
      addPart(g, _box1, mats.amberAccentMat, 0, 0.56, 0.67, 1.1, 0.12, 0.06);
      addPart(g, _box1, mats.slateRoofMat, 0, 0.08 + h + 0.08, 0, 1.48, 0.14, 1.36);
      break;
    }

    case 'shopping': {
      // Shopping Center (8 parts): grand podium, glass atrium, twin commercial wings, rooftop skylights, entrance canopy
      const h = 1.35 + lvlBonus * 0.85;
      addPart(g, _box1, mats.darkConcreteMat, 0, 0.06, 0, 1.88, 0.12, 1.88);
      addPart(g, _box1, mats.concreteMat, 0, 0.12 + h / 2, 0, 1.68, h * 0.85, 1.56);
      addPart(g, _box1, mats.glassMat, 0, 0.12 + h * 0.55, 0, 0.9, h * 0.95, 1.64);
      addPart(g, _box1, mats.amberAccentMat, 0, 0.44, 0.82, 1.15, 0.14, 0.24);
      addPart(g, _box1, mats.metalSteelMat, -0.48, 0.12 + h * 0.95, -0.35, 0.35, 0.18, 0.45);
      addPart(g, _box1, mats.metalSteelMat, 0.48, 0.12 + h * 0.95, -0.35, 0.35, 0.18, 0.45);
      break;
    }

    case 'fabrica_pequena': {
      // Small Factory (6 parts): slab, brick/metal hall, sawtooth roof ridges, smokestack, dock
      const h = 0.72 + lvlBonus * 0.35;
      addPart(g, _box1, mats.darkConcreteMat, 0, 0.04, 0, 1.72, 0.08, 1.72);
      addPart(g, _box1, mats.brickMat, 0, 0.08 + h / 2, 0, 1.42, h, 1.28);
      addPart(g, _box1, mats.metalSteelMat, -0.32, 0.08 + h + 0.12, 0, 0.52, 0.22, 1.28);
      addPart(g, _box1, mats.metalSteelMat, 0.32, 0.08 + h + 0.12, 0, 0.52, 0.22, 1.28);
      addPart(g, _cyl1, mats.darkConcreteMat, 0.48, 0.08 + h + 0.48, -0.4, 0.14, 0.95, 0.14);
      addPart(g, _box1, mats.slateRoofMat, -0.3, 0.28, 0.66, 0.42, 0.36, 0.06);
      break;
    }

    case 'galpao': {
      // Industrial Warehouse (6 parts): yard slab, steel hall, curved/peaked roof, 2 bay doors, cargo stacks
      const h = 0.85 + lvlBonus * 0.4;
      addPart(g, _box1, mats.darkConcreteMat, 0, 0.04, 0, 1.8, 0.08, 1.8);
      addPart(g, _box1, mats.metalSteelMat, 0, 0.08 + h / 2, -0.1, 1.54, h, 1.24);
      addPart(g, _box1, mats.slateRoofMat, 0, 0.08 + h + 0.08, -0.1, 1.62, 0.14, 1.32);
      addPart(g, _box1, mats.amberAccentMat, -0.38, 0.28, 0.54, 0.36, 0.42, 0.06);
      addPart(g, _box1, mats.amberAccentMat, 0.38, 0.28, 0.54, 0.36, 0.42, 0.06);
      break;
    }

    case 'centro_logistico': {
      // Logistics Center (7 parts): asphalt yard, long warehouse, office block, 3 loading bays, parked trailer
      const h = 0.92 + lvlBonus * 0.45;
      addPart(g, _box1, mats.darkConcreteMat, 0, 0.04, 0, 1.86, 0.08, 1.86);
      addPart(g, _box1, mats.concreteMat, -0.12, 0.08 + h / 2, -0.18, 1.5, h, 1.1);
      addPart(g, _box1, mats.blueAccentMat, 0.52, 0.46, 0.36, 0.52, 0.72, 0.58);
      addPart(g, _box1, mats.slateRoofMat, -0.12, 0.08 + h + 0.06, -0.18, 1.56, 0.12, 1.16);
      for (const bx of [-0.6, -0.2, 0.2]) {
        addPart(g, _box1, mats.metalSteelMat, bx, 0.24, 0.44, 0.24, 0.28, 0.36);
      }
      break;
    }

    case 'industria': {
      // Heavy Industry Complex (8 parts): heavy pad, main plant, twin silos, twin tall stacks, pipe bridge
      const h = 1.05 + lvlBonus * 0.55;
      addPart(g, _box1, mats.darkConcreteMat, 0, 0.05, 0, 1.88, 0.1, 1.88);
      addPart(g, _box1, mats.slateRoofMat, -0.25, 0.1 + h / 2, 0, 1.05, h, 1.32);
      addPart(g, _cyl1, mats.metalSteelMat, 0.52, 0.65, -0.35, 0.26, 1.15, 0.26);
      addPart(g, _cyl1, mats.metalSteelMat, 0.52, 0.65, 0.35, 0.26, 1.15, 0.26);
      addPart(g, _cyl1, mats.brickMat, -0.5, 0.1 + h + 0.55, -0.42, 0.13, 1.15, 0.13);
      addPart(g, _cyl1, mats.brickMat, -0.1, 0.1 + h + 0.55, -0.42, 0.13, 1.15, 0.13);
      addPart(g, _box1, mats.amberAccentMat, 0.15, 0.92, 0, 0.7, 0.12, 0.16);
      break;
    }

    case 'posto_saude': {
      // UBS Clinic (5 parts): pad, clean white L-building, red accent canopy, cross emblem
      addPart(g, _box1, mats.darkConcreteMat, 0, 0.04, 0, 1.66, 0.08, 1.66);
      addPart(g, _box1, mats.concreteMat, 0, 0.38, 0, 1.36, 0.58, 1.1);
      addPart(g, _box1, mats.redAccentMat, 0, 0.72, 0, 1.42, 0.1, 1.16);
      addPart(g, _box1, mats.redAccentMat, 0, 0.45, 0.58, 0.1, 0.34, 0.05);
      addPart(g, _box1, mats.redAccentMat, 0, 0.45, 0.58, 0.34, 0.1, 0.05);
      break;
    }

    case 'escola': {
      // Municipal School (7 parts): courtyard base, twin wings, connecting hall, terracotta roofs, sports court
      const h = 0.68 + lvlBonus * 0.35;
      addPart(g, _box1, mats.darkConcreteMat, 0, 0.04, 0, 1.78, 0.08, 1.78);
      addPart(g, _box1, mats.concreteMat, -0.48, 0.08 + h / 2, 0, 0.52, h, 1.38);
      addPart(g, _box1, mats.concreteMat, 0.48, 0.08 + h / 2, 0, 0.52, h, 1.38);
      addPart(g, _box1, mats.facadeWindowMat, 0, 0.08 + h / 2, -0.44, 0.72, h, 0.48);
      addPart(g, _box1, mats.terracottaRoofMat, -0.48, 0.08 + h + 0.08, 0, 0.56, 0.14, 1.44);
      addPart(g, _box1, mats.terracottaRoofMat, 0.48, 0.08 + h + 0.08, 0, 0.56, 0.14, 1.44);
      addPart(g, _box1, mats.blueAccentMat, 0, 0.09, 0.25, 0.46, 0.03, 0.65);
      break;
    }

    case 'delegacia': {
      // Police Station (6 parts): pad, civic building, blue band, canopy, antenna tower
      const h = 0.74 + lvlBonus * 0.35;
      addPart(g, _box1, mats.darkConcreteMat, 0, 0.04, 0, 1.7, 0.08, 1.7);
      addPart(g, _box1, mats.concreteMat, 0, 0.08 + h / 2, 0, 1.38, h, 1.18);
      addPart(g, _box1, mats.blueAccentMat, 0, 0.08 + h - 0.1, 0, 1.42, 0.18, 1.22);
      addPart(g, _box1, mats.glassMat, 0, 0.34, 0.62, 0.65, 0.36, 0.08);
      addPart(g, _cyl1, mats.metalSteelMat, 0.45, 0.08 + h + 0.35, -0.35, 0.035, 0.7, 0.035);
      break;
    }

    case 'bombeiros': {
      // Fire Station (6 parts): apron, apparatus bay, red bay doors, watchtower
      const h = 0.72 + lvlBonus * 0.3;
      addPart(g, _box1, mats.darkConcreteMat, 0, 0.04, 0, 1.74, 0.08, 1.74);
      addPart(g, _box1, mats.brickMat, -0.14, 0.08 + h / 2, 0, 1.15, h, 1.26);
      addPart(g, _box1, mats.redAccentMat, -0.36, 0.3, 0.65, 0.36, 0.44, 0.06);
      addPart(g, _box1, mats.redAccentMat, 0.12, 0.3, 0.65, 0.36, 0.44, 0.06);
      addPart(g, _box1, mats.concreteMat, 0.56, 0.75, -0.25, 0.38, 1.38, 0.38);
      addPart(g, _box1, mats.redAccentMat, 0.56, 1.48, -0.25, 0.44, 0.12, 0.44);
      break;
    }

    case 'hospital': {
      // General Hospital (8 parts): podium, cross-shaped tower, helipad H, red cross beacon
      const h = 1.65 + lvlBonus * 0.9;
      addPart(g, _box1, mats.darkConcreteMat, 0, 0.06, 0, 1.84, 0.12, 1.84);
      addPart(g, _box1, mats.concreteMat, 0, 0.36, 0, 1.56, 0.52, 1.48);
      addPart(g, _box1, mats.facadeWindowMat, 0, 0.5 + h / 2, 0, 0.65, h, 1.24);
      addPart(g, _box1, mats.facadeWindowMat, 0, 0.5 + h / 2, 0, 1.24, h, 0.65);
      addPart(g, _cyl1, mats.darkConcreteMat, 0, 0.5 + h + 0.05, 0, 0.48, 0.08, 0.48);
      addPart(g, _box1, mats.redAccentMat, 0, 0.5 + h + 0.11, 0, 0.35, 0.03, 0.08);
      addPart(g, _box1, mats.redAccentMat, 0, 0.5 + h + 0.11, 0, 0.08, 0.03, 0.35);
      break;
    }

    case 'centro_profissionalizante': {
      // Vocational Tech Center (6 parts): campus plinth, main academic block, workshop wing, skylight roof
      const h = 0.98 + lvlBonus * 0.5;
      addPart(g, _box1, mats.darkConcreteMat, 0, 0.05, 0, 1.8, 0.1, 1.8);
      addPart(g, _box1, mats.facadeWindowMat, -0.24, 0.1 + h / 2, -0.16, 1.15, h, 1.0);
      addPart(g, _box1, mats.blueAccentMat, 0.48, 0.42, 0.32, 0.62, 0.65, 0.78);
      addPart(g, _box1, mats.glassMat, -0.24, 0.1 + h + 0.1, -0.16, 0.95, 0.18, 0.78);
      break;
    }

    case 'praca': {
      // Tree-lined Square (8 parts): stone plaza, central fountain, water, 4 corner trees
      addPart(g, _box1, mats.concreteMat, 0, 0.04, 0, 1.82, 0.08, 1.82);
      addPart(g, _box1, mats.parkGrassMat, 0, 0.085, 0, 1.46, 0.03, 1.46);
      addPart(g, _cyl1, mats.concreteMat, 0, 0.16, 0, 0.38, 0.16, 0.38);
      addPart(g, _cyl1, mats.waterPoolMat, 0, 0.25, 0, 0.3, 0.04, 0.3);
      addPart(g, _cyl1, mats.concreteMat, 0, 0.36, 0, 0.09, 0.24, 0.09);
      for (const [tx, tz] of [
        [-0.58, -0.58],
        [0.58, -0.58],
        [-0.58, 0.58],
        [0.58, 0.58],
      ]) {
        addPart(g, _cyl1, mats.woodMat, tx, 0.24, tz, 0.06, 0.32, 0.06);
        addPart(g, _coneRound, mats.parkGrassMat, tx, 0.52, tz, 0.24, 0.4, 0.24);
      }
      break;
    }

    case 'parque': {
      // Ecological Park (10 parts): lush base, pond, gazebo, 6 clustered trees
      addPart(g, _box1, mats.parkGrassMat, 0, 0.05, 0, 1.88, 0.1, 1.88);
      addPart(g, _cyl1, mats.waterPoolMat, 0.3, 0.11, 0.28, 0.48, 0.03, 0.42);
      addPart(g, _cyl1, mats.woodMat, -0.35, 0.24, -0.25, 0.28, 0.3, 0.28);
      addPart(g, _coneRound, mats.terracottaRoofMat, -0.35, 0.46, -0.25, 0.34, 0.2, 0.34);
      for (const [tx, tz, sc] of [
        [-0.65, 0.48, 1.0],
        [-0.2, 0.62, 0.85],
        [0.62, -0.55, 1.15],
        [0.18, -0.62, 0.9],
        [-0.68, -0.62, 1.05],
      ]) {
        addPart(g, _cyl1, mats.woodMat, tx, 0.26, tz, 0.06, 0.36, 0.06);
        addPart(g, _coneRound, mats.parkGrassMat, tx, 0.58 * sc, tz, 0.26 * sc, 0.48 * sc, 0.26 * sc);
      }
      break;
    }

    case 'centro_esportivo': {
      // Sports Center (6 parts): base, arched gym hall, outdoor court, roof ribs
      addPart(g, _box1, mats.darkConcreteMat, 0, 0.04, 0, 1.82, 0.08, 1.82);
      addPart(g, _box1, mats.concreteMat, 0, 0.4, -0.28, 1.48, 0.62, 0.92);
      addPart(g, _box1, mats.blueAccentMat, 0, 0.76, -0.28, 1.54, 0.16, 0.98);
      addPart(g, _box1, mats.terracottaRoofMat, 0, 0.09, 0.48, 1.38, 0.03, 0.64);
      break;
    }

    case 'estadio': {
      // Municipal Stadium (9 parts): oval/bowl tiers, green pitch, 4 corner floodlight towers
      addPart(g, _box1, mats.darkConcreteMat, 0, 0.06, 0, 1.9, 0.12, 1.9);
      addPart(g, _box1, mats.concreteMat, 0, 0.36, -0.68, 1.72, 0.56, 0.38);
      addPart(g, _box1, mats.concreteMat, 0, 0.36, 0.68, 1.72, 0.56, 0.38);
      addPart(g, _box1, mats.concreteMat, -0.68, 0.36, 0, 0.38, 0.56, 1.15);
      addPart(g, _box1, mats.concreteMat, 0.68, 0.36, 0, 0.38, 0.56, 1.15);
      addPart(g, _box1, mats.parkGrassMat, 0, 0.13, 0, 1.0, 0.04, 0.96);
      for (const [fx, fz] of [
        [-0.78, -0.78],
        [0.78, -0.78],
        [-0.78, 0.78],
        [0.78, 0.78],
      ]) {
        addPart(g, _cyl1, mats.metalSteelMat, fx, 0.62, fz, 0.04, 1.05, 0.04);
        addPart(g, _box1, mats.nightGlowMat, fx, 1.16, fz, 0.18, 0.12, 0.08);
      }
      break;
    }

    default: {
      addPart(g, _box1, mats.concreteMat, 0, 0.35, 0, 1.2, 0.7, 1.2);
      break;
    }
  }

  return g;
}

/**
 * Small procedural camp / protest tents when a tile has an active land conflict.
 */
export function buildConflictMarkerMesh(mats: BuildingMaterialLibrary): THREE.Group {
  const g = new THREE.Group();
  addContactShadow(g, mats.shadowPlaneMat, 1.4);
  addPart(g, _cone1, mats.amberAccentMat, -0.35, 0.22, -0.2, 0.32, 0.42, 0.32, Math.PI / 4);
  addPart(g, _cone1, mats.blueAccentMat, 0.32, 0.2, 0.25, 0.28, 0.38, 0.28, 0.2);
  addPart(g, _cyl1, mats.woodMat, 0, 0.45, -0.45, 0.03, 0.9, 0.03);
  addPart(g, _box1, mats.redAccentMat, 0.18, 0.8, -0.45, 0.36, 0.2, 0.03);
  return g;
}
