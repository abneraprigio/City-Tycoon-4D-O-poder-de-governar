import { GRID_SIZE, PathPoint, TileData } from '../../types/game';
import {
  CARDINAL_DIRS,
  computeBuildingAccess,
  isBuildingSolidObstacle,
  isWaterObstacle,
  tileAt,
  tileKey,
} from './obstacleSystem';

export interface PedestrianEdge {
  to: string;
  cost: number;
  isCrosswalk: boolean;
}

export interface PedestrianNode {
  id: string;
  x: number;
  z: number;
  tileX: number;
  tileZ: number;
  kind: 'sidewalk' | 'lot' | 'entrance';
  buildingId?: string;
  edges: PedestrianEdge[];
}

export interface PedestrianGraph {
  nodes: Map<string, PedestrianNode>;
  buildingEntranceNode: Map<string, string>;
  tileNodes: Map<string, string[]>;
  crosswalkSegments: Array<{ ax: number; az: number; bx: number; bz: number; tileX: number; tileZ: number }>;
}

const SW_OFF = 0.38; // Sidewalk distance from road tile center

function addNode(graph: PedestrianGraph, node: PedestrianNode): PedestrianNode {
  const existing = graph.nodes.get(node.id);
  if (existing) return existing;
  graph.nodes.set(node.id, node);
  const tk = tileKey(node.tileX, node.tileZ);
  const list = graph.tileNodes.get(tk) ?? [];
  list.push(node.id);
  graph.tileNodes.set(tk, list);
  return node;
}

function connectNodes(
  graph: PedestrianGraph,
  aId: string,
  bId: string,
  costMultiplier = 1.0,
  isCrosswalk = false,
): void {
  const a = graph.nodes.get(aId);
  const b = graph.nodes.get(bId);
  if (!a || !b || aId === bId) return;
  const dist = Math.hypot(a.x - b.x, a.z - b.z) * costMultiplier;
  if (!a.edges.some((e) => e.to === bId)) {
    a.edges.push({ to: bId, cost: dist, isCrosswalk });
  }
  if (!b.edges.some((e) => e.to === aId)) {
    b.edges.push({ to: aId, cost: dist, isCrosswalk });
  }
}

/**
 * Builds an urban pedestrian graph composed of:
 * 1) 4 sidewalk corner nodes per road tile (NW, NE, SW, SE)
 * 2) Crosswalks across road tiles with elevated cost so NPCs prefer sidewalks first
 * 3) Walkable open tiles (parks, plazas, empty non-water lots)
 * 4) Building front entrance nodes facing adjacent sidewalks
 */
export function buildPedestrianGraph(tiles: TileData[]): PedestrianGraph {
  const graph: PedestrianGraph = {
    nodes: new Map(),
    buildingEntranceNode: new Map(),
    tileNodes: new Map(),
    crosswalkSegments: [],
  };

  // 1. Road sidewalk corner nodes & intra-tile sidewalk edges
  for (const tile of tiles) {
    if (tile.road === 'none') continue;
    const { x, z } = tile;
    const nw = `sw:${x},${z}:nw`;
    const ne = `sw:${x},${z}:ne`;
    const sw = `sw:${x},${z}:sw`;
    const se = `sw:${x},${z}:se`;

    addNode(graph, { id: nw, x: x - SW_OFF, z: z - SW_OFF, tileX: x, tileZ: z, kind: 'sidewalk', edges: [] });
    addNode(graph, { id: ne, x: x + SW_OFF, z: z - SW_OFF, tileX: x, tileZ: z, kind: 'sidewalk', edges: [] });
    addNode(graph, { id: sw, x: x - SW_OFF, z: z + SW_OFF, tileX: x, tileZ: z, kind: 'sidewalk', edges: [] });
    addNode(graph, { id: se, x: x + SW_OFF, z: z + SW_OFF, tileX: x, tileZ: z, kind: 'sidewalk', edges: [] });

    const northRoad = tileAt(tiles, x, z - 1)?.road !== 'none';
    const southRoad = tileAt(tiles, x, z + 1)?.road !== 'none';
    const westRoad = tileAt(tiles, x - 1, z)?.road !== 'none';
    const eastRoad = tileAt(tiles, x + 1, z)?.road !== 'none';

    const roadNeighbors =
      (northRoad ? 1 : 0) + (southRoad ? 1 : 0) + (westRoad ? 1 : 0) + (eastRoad ? 1 : 0);
    const isIntersection = roadNeighbors >= 3 || (northRoad !== southRoad && westRoad !== eastRoad);

    // Sidewalks along edges WITHOUT continuing perpendicular roads
    if (!northRoad) connectNodes(graph, nw, ne, 1.0, false);
    if (!southRoad) connectNodes(graph, sw, se, 1.0, false);
    if (!westRoad) connectNodes(graph, nw, sw, 1.0, false);
    if (!eastRoad) connectNodes(graph, ne, se, 1.0, false);

    // Crosswalks across street at intersections OR straight stretches every 2 tiles
    if (northRoad || isIntersection || (!northRoad && !southRoad && (x + z) % 2 === 0)) {
      connectNodes(graph, nw, ne, 1.65, true);
      const a = graph.nodes.get(nw)!;
      const b = graph.nodes.get(ne)!;
      graph.crosswalkSegments.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, tileX: x, tileZ: z });
    }
    if (southRoad || isIntersection) {
      connectNodes(graph, sw, se, 1.65, true);
      const a = graph.nodes.get(sw)!;
      const b = graph.nodes.get(se)!;
      graph.crosswalkSegments.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, tileX: x, tileZ: z });
    }
    if (westRoad || isIntersection || (!westRoad && !eastRoad && (x + z) % 2 === 0)) {
      connectNodes(graph, nw, sw, 1.65, true);
      const a = graph.nodes.get(nw)!;
      const b = graph.nodes.get(sw)!;
      graph.crosswalkSegments.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, tileX: x, tileZ: z });
    }
    if (eastRoad || isIntersection) {
      connectNodes(graph, ne, se, 1.65, true);
      const a = graph.nodes.get(ne)!;
      const b = graph.nodes.get(se)!;
      graph.crosswalkSegments.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, tileX: x, tileZ: z });
    }
  }

  // 2. Connect adjacent road tile sidewalks seamlessly across tile seams
  for (const tile of tiles) {
    if (tile.road === 'none') continue;
    const { x, z } = tile;
    const east = tileAt(tiles, x + 1, z);
    if (east && east.road !== 'none') {
      connectNodes(graph, `sw:${x},${z}:ne`, `sw:${x + 1},${z}:nw`, 1.0, false);
      connectNodes(graph, `sw:${x},${z}:se`, `sw:${x + 1},${z}:sw`, 1.0, false);
    }
    const south = tileAt(tiles, x, z + 1);
    if (south && south.road !== 'none') {
      connectNodes(graph, `sw:${x},${z}:sw`, `sw:${x},${z + 1}:nw`, 1.0, false);
      connectNodes(graph, `sw:${x},${z}:se`, `sw:${x},${z + 1}:ne`, 1.0, false);
    }
  }

  // 3. Walkable non-road tiles (plazas, parks, open lots, excluding water and solid buildings)
  for (const tile of tiles) {
    if (tile.road !== 'none') continue;
    if (isWaterObstacle(tile)) continue;
    if (isBuildingSolidObstacle(tile)) continue;
    const lotId = `lot:${tile.x},${tile.z}`;
    addNode(graph, {
      id: lotId,
      x: tile.x,
      z: tile.z,
      tileX: tile.x,
      tileZ: tile.z,
      kind: 'lot',
      edges: [],
    });
  }

  // Connect walkable lots to adjacent lots & sidewalks
  for (const tile of tiles) {
    if (tile.road !== 'none') continue;
    const lotId = `lot:${tile.x},${tile.z}`;
    if (!graph.nodes.has(lotId)) continue;
    const isParkOrPlaza = tile.building?.type === 'praca' || tile.building?.type === 'parque';
    const lotPenalty = isParkOrPlaza ? 1.05 : 1.45;

    for (const dir of CARDINAL_DIRS) {
      const nb = tileAt(tiles, tile.x + dir.dx, tile.z + dir.dz);
      if (!nb) continue;
      if (nb.road !== 'none') {
        // Connect to both sidewalk corners facing this lot
        const roadKey = `sw:${nb.x},${nb.z}`;
        if (dir.dx === 1) {
          connectNodes(graph, lotId, `${roadKey}:nw`, 1.15, false);
          connectNodes(graph, lotId, `${roadKey}:sw`, 1.15, false);
        } else if (dir.dx === -1) {
          connectNodes(graph, lotId, `${roadKey}:ne`, 1.15, false);
          connectNodes(graph, lotId, `${roadKey}:se`, 1.15, false);
        } else if (dir.dz === 1) {
          connectNodes(graph, lotId, `${roadKey}:nw`, 1.15, false);
          connectNodes(graph, lotId, `${roadKey}:ne`, 1.15, false);
        } else if (dir.dz === -1) {
          connectNodes(graph, lotId, `${roadKey}:sw`, 1.15, false);
          connectNodes(graph, lotId, `${roadKey}:se`, 1.15, false);
        }
      } else {
        const nbLot = `lot:${nb.x},${nb.z}`;
        if (graph.nodes.has(nbLot)) {
          connectNodes(graph, lotId, nbLot, lotPenalty, false);
        }
      }
    }
  }

  // 4. Dedicated front entrance nodes for every building
  for (const tile of tiles) {
    if (!tile.building) continue;
    const access = computeBuildingAccess(tiles, tile);
    const entId = `ent:${tile.building.id}`;
    addNode(graph, {
      id: entId,
      x: access.entrancePoint.x,
      z: access.entrancePoint.z,
      tileX: tile.x,
      tileZ: tile.z,
      kind: 'entrance',
      buildingId: tile.building.id,
      edges: [],
    });
    graph.buildingEntranceNode.set(tile.building.id, entId);

    // Connect entrance to adjacent road sidewalks (strongly preferred) or nearby walkable lot
    if (access.adjacentRoadTile) {
      const rx = access.adjacentRoadTile.x;
      const rz = access.adjacentRoadTile.z;
      const dx = rx - tile.x;
      const dz = rz - tile.z;
      const base = `sw:${rx},${rz}`;
      if (dx === 1) {
        connectNodes(graph, entId, `${base}:nw`, 1.0, false);
        connectNodes(graph, entId, `${base}:sw`, 1.0, false);
      } else if (dx === -1) {
        connectNodes(graph, entId, `${base}:ne`, 1.0, false);
        connectNodes(graph, entId, `${base}:se`, 1.0, false);
      } else if (dz === 1) {
        connectNodes(graph, entId, `${base}:nw`, 1.0, false);
        connectNodes(graph, entId, `${base}:ne`, 1.0, false);
      } else if (dz === -1) {
        connectNodes(graph, entId, `${base}:sw`, 1.0, false);
        connectNodes(graph, entId, `${base}:se`, 1.0, false);
      }
    }

    // For parks/plazas, connect entrance to internal center lot node too
    const selfLot = `lot:${tile.x},${tile.z}`;
    if (graph.nodes.has(selfLot)) {
      connectNodes(graph, entId, selfLot, 1.0, false);
    }

    // Fallback connection if building has no road yet: connect to adjacent walkable lot
    if (!access.adjacentRoadTile) {
      for (const dir of CARDINAL_DIRS) {
        const nbLot = `lot:${tile.x + dir.dx},${tile.z + dir.dz}`;
        if (graph.nodes.has(nbLot)) {
          connectNodes(graph, entId, nbLot, 1.35, false);
        }
      }
    }
  }

  return graph;
}

export function findNearestPedestrianNode(
  graph: PedestrianGraph,
  x: number,
  z: number,
  maxRadius = 3,
): PedestrianNode | null {
  const cx = Math.max(0, Math.min(GRID_SIZE - 1, Math.round(x)));
  const cz = Math.max(0, Math.min(GRID_SIZE - 1, Math.round(z)));

  let best: PedestrianNode | null = null;
  let bestDist = Infinity;

  for (let r = 0; r <= maxRadius; r++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
        const list = graph.tileNodes.get(tileKey(cx + dx, cz + dz));
        if (!list) continue;
        for (const nid of list) {
          const node = graph.nodes.get(nid);
          if (!node || node.edges.length === 0) continue;
          const d = Math.hypot(node.x - x, node.z - z);
          if (d < bestDist) {
            bestDist = d;
            best = node;
          }
        }
      }
    }
    if (best) return best;
  }
  return best;
}

export function isCrosswalkPoint(graph: PedestrianGraph, point: PathPoint): boolean {
  for (const cw of graph.crosswalkSegments) {
    const midX = (cw.ax + cw.bx) * 0.5;
    const midZ = (cw.az + cw.bz) * 0.5;
    if (Math.hypot(point.x - midX, point.z - midZ) < 0.48) return true;
  }
  return false;
}
