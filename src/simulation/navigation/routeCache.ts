import { TileData } from '../../types/game';
import { buildPedestrianGraph, PedestrianGraph } from './pedestrianGraph';
import { buildRoadGraph, RoadGraph } from './roadGraph';
import { findPedestrianPath, findRoadPath, PathResult } from './pathfinding';

const MAX_CACHED_ROUTES = 1200;

/**
 * Holds compiled PedestrianGraph & RoadGraph alongside an LRU path cache.
 * Automatically rebuilds and invalidates ONLY when gridVersion changes.
 */
export class UrbanNavigationCache {
  public builtVersion = -1;
  public pedestrianGraph: PedestrianGraph = {
    nodes: new Map(),
    buildingEntranceNode: new Map(),
    tileNodes: new Map(),
    crosswalkSegments: [],
  };
  public roadGraph: RoadGraph = {
    nodes: new Map(),
    signalCandidates: [],
    allRoadTileKeys: [],
  };

  private pedRouteCache = new Map<string, PathResult>();
  private roadRouteCache = new Map<string, PathResult>();

  public ensureFresh(tiles: TileData[], version: number): void {
    if (this.builtVersion === version && this.pedestrianGraph.nodes.size > 0) return;
    this.pedestrianGraph = buildPedestrianGraph(tiles);
    this.roadGraph = buildRoadGraph(tiles);
    this.pedRouteCache.clear();
    this.roadRouteCache.clear();
    this.builtVersion = version;
  }

  public get cacheCount(): number {
    return this.pedRouteCache.size + this.roadRouteCache.size;
  }

  public getPedestrianPath(startNodeId: string, goalNodeId: string): PathResult {
    const key = `${startNodeId}->${goalNodeId}`;
    const hit = this.pedRouteCache.get(key);
    if (hit) {
      // Refresh LRU ordering
      this.pedRouteCache.delete(key);
      this.pedRouteCache.set(key, hit);
      return hit;
    }
    const res = findPedestrianPath(this.pedestrianGraph, startNodeId, goalNodeId);
    if (this.pedRouteCache.size >= MAX_CACHED_ROUTES) {
      const oldest = this.pedRouteCache.keys().next().value;
      if (oldest) this.pedRouteCache.delete(oldest);
    }
    this.pedRouteCache.set(key, res);
    return res;
  }

  public getRoadPath(startTileKey: string, goalTileKey: string): PathResult {
    const key = `${startTileKey}->${goalTileKey}`;
    const hit = this.roadRouteCache.get(key);
    if (hit) {
      this.roadRouteCache.delete(key);
      this.roadRouteCache.set(key, hit);
      return hit;
    }
    const res = findRoadPath(this.roadGraph, startTileKey, goalTileKey);
    if (this.roadRouteCache.size >= MAX_CACHED_ROUTES) {
      const oldest = this.roadRouteCache.keys().next().value;
      if (oldest) this.roadRouteCache.delete(oldest);
    }
    this.roadRouteCache.set(key, res);
    return res;
  }
}
