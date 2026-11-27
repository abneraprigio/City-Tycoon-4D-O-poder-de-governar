import {
  BUILDING_CATALOG,
  CitizenAgent,
  CitizenBehaviorState,
  CitizenState,
  CityIndicators,
  EconomyState,
  GameTimeConfig,
  GRID_SIZE,
  PathPoint,
  TileData,
} from '../../types/game';
import { computeBuildingAccess, tileAt } from '../navigation/obstacleSystem';
import {
  findNearestPedestrianNode,
  isCrosswalkPoint,
} from '../navigation/pedestrianGraph';
import { UrbanNavigationCache } from '../navigation/routeCache';
import { evaluateCitizenIntent, findBuildingTileById, findNearestMatchingBuilding } from './citizenNeeds';
import { getScheduledSlot } from './citizenSchedule';

function mapBehaviorToLegacyState(b: CitizenBehaviorState): CitizenState {
  switch (b) {
    case 'Working':
      return 'working';
    case 'Studying':
      return 'studying';
    case 'Shopping':
    case 'Eating':
      return 'shopping';
    case 'SeekingJob':
      return 'seeking_job';
    case 'SeekingHome':
      return 'seeking_home';
    case 'Protesting':
      return 'protesting';
    case 'WalkingToDestination':
    case 'WaitingForTransport':
    case 'RidingTransport':
    case 'Driving':
    case 'CrossingStreet':
    case 'ReturningHome':
      return 'commuting';
    default:
      return 'idle';
  }
}

function getTargetBehaviorForGoal(
  goal: ReturnType<typeof evaluateCitizenIntent>['goalType'],
): CitizenBehaviorState {
  switch (goal) {
    case 'sleep':
      return 'Sleeping';
    case 'home':
      return 'AtHome';
    case 'work':
      return 'Working';
    case 'study':
      return 'Studying';
    case 'eat':
      return 'Eating';
    case 'shop':
      return 'Shopping';
    case 'exercise':
      return 'Exercising';
    case 'socialize':
      return 'Socializing';
    case 'health':
      return 'ReceivingMedicalCare';
    case 'seek_job':
      return 'SeekingJob';
    case 'seek_home':
      return 'SeekingHome';
    case 'protest':
      return 'Protesting';
    default:
      return 'AtHome';
  }
}

function lerpAngle(current: number, target: number, t: number): number {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * Math.min(1, t);
}

function shouldStayInsideBuilding(tile: TileData | null): boolean {
  if (!tile || !tile.building) return false;
  return tile.building.type !== 'praca' && tile.building.type !== 'parque';
}

function assignRouteToTile(
  c: CitizenAgent,
  destTile: TileData,
  tiles: TileData[],
  navCache: UrbanNavigationCache,
): boolean {
  const pedGraph = navCache.pedestrianGraph;
  const startNode = findNearestPedestrianNode(pedGraph, c.x, c.z, 4);
  if (!startNode) return false;

  let goalNodeId: string | undefined;
  if (destTile.building) {
    goalNodeId = pedGraph.buildingEntranceNode.get(destTile.building.id);
  }
  if (!goalNodeId) {
    const nearestDest = findNearestPedestrianNode(pedGraph, destTile.x, destTile.z, 3);
    goalNodeId = nearestDest?.id;
  }
  if (!goalNodeId) return false;

  const res = navCache.getPedestrianPath(startNode.id, goalNodeId);
  if (!res.found || res.points.length === 0) {
    return false;
  }

  c.path = res.points;
  c.pathIndex = 0;
  const finalPt = res.points[res.points.length - 1];
  c.targetX = finalPt.x;
  c.targetZ = finalPt.z;
  c.targetBuildingId = destTile.building?.id ?? null;
  return true;
}

export function stepCitizenBehaviorAndMotion(
  c: CitizenAgent,
  allCitizens: CitizenAgent[],
  tiles: TileData[],
  navCache: UrbanNavigationCache,
  hourOfDay: number,
  day: number,
  physicalDt: number,
  calendarHoursDelta: number,
  timeConfig: GameTimeConfig,
  indicators: CityIndicators,
  economy: EconomyState,
  hasActiveConflict: boolean,
  canMakeDecisionNow: boolean,
): void {
  const isWeekend = day % 7 === 6 || day % 7 === 0;
  const currentBuilding = findBuildingTileById(tiles, c.insideBuildingId);

  // If citizen was inside a building that got demolished, eject safely onto sidewalk
  if (c.insideBuildingId && !currentBuilding) {
    const safeNode = findNearestPedestrianNode(navCache.pedestrianGraph, c.x, c.z, 3);
    if (safeNode) {
      c.x = safeNode.x;
      c.z = safeNode.z;
    }
    c.insideBuildingId = null;
    c.behaviorState = 'AtHome';
    c.movementState = 'stopped';
    c.animState = 'Idle';
    c.decisionCooldown = 0;
  }

  // Decrement decision cooldown
  if ((c.decisionCooldown ?? 0) > 0) {
    c.decisionCooldown = Math.max(0, (c.decisionCooldown ?? 0) - calendarHoursDelta);
  }

  // Check if current inside-building or stationary activity has completed
  const activityRemaining = c.activityUntilHour ?? 0;
  if (c.insideBuildingId || (c.movementState === 'stopped' && (!c.path || c.pathIndex === undefined || c.pathIndex >= c.path.length))) {
    if (activityRemaining > 0) {
      c.activityUntilHour = Math.max(0, activityRemaining - calendarHoursDelta);
    }

    // If still committed to staying inside or socializing, stay put & animate naturally
    if ((c.activityUntilHour ?? 0) > 0.02) {
      if (c.insideBuildingId && currentBuilding) {
        c.x = currentBuilding.x;
        c.z = currentBuilding.z;
        c.movementState = 'stopped';
        c.animState = c.behaviorState === 'Working' ? 'Work' : c.behaviorState === 'Shopping' ? 'Shop' : 'Idle';
      } else if (c.behaviorState === 'Socializing' && c.talkingWithId) {
        const partner = allCitizens.find((o) => o.id === c.talkingWithId);
        if (partner && Math.hypot(partner.x - c.x, partner.z - c.z) < 1.3) {
          c.yaw = lerpAngle(c.yaw ?? 0, Math.atan2(partner.x - c.x, partner.z - c.z), physicalDt * 6);
          c.animState = 'Talk';
        } else {
          c.talkingWithId = null;
          c.animState = 'Idle';
        }
      }
      c.state = mapBehaviorToLegacyState(c.behaviorState ?? 'AtHome');
      return;
    }
  }

  // Decide next goal when ready (no active path, finished activity, cooldown expired)
  const hasActivePath = Boolean(c.path && c.pathIndex !== undefined && c.pathIndex < c.path.length);
  if (!hasActivePath && (c.decisionCooldown ?? 0) <= 0 && (canMakeDecisionNow || (c.activityUntilHour ?? 0) <= 0.02)) {
    const slot = getScheduledSlot(c.scheduleProfile ?? 'clt', hourOfDay, c.staggerMinutes ?? 0, day);
    const intent = evaluateCitizenIntent(c, hourOfDay, isWeekend, slot, indicators, economy, hasActiveConflict);

    // Choose concrete destination tile
    let destTile: TileData | null = null;
    if (intent.goalType === 'sleep' || intent.goalType === 'home') {
      destTile = findBuildingTileById(tiles, c.residenceBuildingId);
    } else if (intent.goalType === 'work') {
      destTile = findBuildingTileById(tiles, c.employedAtId);
    }
    if (!destTile && intent.preferredBuildingTypes.length > 0) {
      destTile = findNearestMatchingBuilding(tiles, c.x, c.z, intent.preferredBuildingTypes);
    }

    // Fallback to public plaza or nearest road lot if no matching building exists yet
    if (!destTile) {
      destTile = tiles.find((t) => t.building?.type === 'praca' || t.building?.type === 'prefeitura') ?? null;
    }

    if (destTile) {
      // Already at destination building? Enter immediately without redundant walking
      const curEntDist = Math.hypot(c.x - destTile.x, c.z - destTile.z);
      if (destTile.building && (c.insideBuildingId === destTile.building.id || curEntDist < 0.72)) {
        const nextBehavior = getTargetBehaviorForGoal(intent.goalType);
        c.behaviorState = nextBehavior;
        c.intent = intent.goalType;
        c.activity = intent.thought;
        c.thought = intent.thought;
        c.talkingWithId = null;
        const dur =
          intent.minDurationHours +
          Math.random() * Math.max(0.2, intent.maxDurationHours - intent.minDurationHours);
        c.activityUntilHour = dur;
        c.decisionCooldown = 0.25;
        if (shouldStayInsideBuilding(destTile)) {
          c.insideBuildingId = destTile.building.id;
          c.x = destTile.x;
          c.z = destTile.z;
          c.movementState = 'stopped';
          c.animState = nextBehavior === 'Working' ? 'Work' : nextBehavior === 'Shopping' ? 'Shop' : 'Idle';
        } else {
          c.insideBuildingId = null;
          c.movementState = 'stopped';
          c.animState = nextBehavior === 'Protesting' ? 'Talk' : 'Idle';
        }
        c.state = mapBehaviorToLegacyState(c.behaviorState);
        return;
      }

      // Exit current building onto its front sidewalk/entrance before routing
      if (c.insideBuildingId && currentBuilding) {
        const access = computeBuildingAccess(tiles, currentBuilding);
        c.x = access.entrancePoint.x;
        c.z = access.entrancePoint.z;
        c.insideBuildingId = null;
      }

      const routed = assignRouteToTile(c, destTile, tiles, navCache);
      if (routed) {
        c.intent = intent.goalType;
        c.activity = intent.thought;
        c.thought = intent.thought;
        c.talkingWithId = null;
        c.blockedTicks = 0;
        c.behaviorState =
          intent.goalType === 'home' || intent.goalType === 'sleep'
            ? 'ReturningHome'
            : 'WalkingToDestination';
        c.activityMinDurationHours =
          intent.minDurationHours +
          Math.random() * Math.max(0.2, intent.maxDurationHours - intent.minDurationHours);
        const pathDist = c.path ? c.path.length : 1;
        c.transportMode = pathDist > 18 && tiles.some((t) => t.busStop) ? 'bus' : 'walk';
        c.decisionCooldown = 0.4;
      } else {
        // Unreachable: wait peacefully without teleporting
        c.behaviorState = 'WaitingForPath';
        c.movementState = 'waiting';
        c.animState = 'Wait';
        c.blockedTicks = (c.blockedTicks ?? 0) + 1;
        c.unreachableCount = (c.unreachableCount ?? 0) + 1;
        c.thought = 'Sem acesso viário ou calçada conectada até o destino.';
        c.decisionCooldown = 0.8;
        c.state = mapBehaviorToLegacyState(c.behaviorState);
        return;
      }
    }
  }

  // Follow active A* pedestrian path with physical acceleration, yaw & personal space steering
  if (c.path && c.pathIndex !== undefined && c.pathIndex < c.path.length) {
    const wp: PathPoint = c.path[c.pathIndex];
    const dx = wp.x - c.x;
    const dz = wp.z - c.z;
    const dist = Math.hypot(dx, dz);

    if (dist < 0.09) {
      c.pathIndex += 1;
      if (c.pathIndex >= c.path.length) {
        // Arrived at target!
        c.path = [];
        c.pathIndex = 0;
        c.currentSpeed = 0;
        c.movementState = 'stopped';

        const destBuilding = findBuildingTileById(tiles, c.targetBuildingId);
        const goalType = (c.intent as ReturnType<typeof evaluateCitizenIntent>['goalType']) ?? 'home';
        const arrivedBehavior = getTargetBehaviorForGoal(goalType);
        c.behaviorState = arrivedBehavior;
        c.activityUntilHour = c.activityMinDurationHours ?? 1.5;

        if (destBuilding && destBuilding.building && shouldStayInsideBuilding(destBuilding)) {
          c.insideBuildingId = destBuilding.building.id;
          c.x = destBuilding.x;
          c.z = destBuilding.z;
          c.animState = arrivedBehavior === 'Working' ? 'Work' : arrivedBehavior === 'Shopping' ? 'Shop' : 'Idle';
        } else {
          c.insideBuildingId = null;
          c.animState =
            arrivedBehavior === 'Socializing' || arrivedBehavior === 'Protesting' ? 'Talk' : 'Idle';
        }
        c.state = mapBehaviorToLegacyState(c.behaviorState);
        return;
      }
    } else if (physicalDt > 0) {
      // Base speed calibrated to 0.14 - 0.25 tiles/s for natural human pace (jog/exercise up to 0.34)
      const isJogging = c.intent === 'exercise' && (c.personality === 'aventureiro' || (c.needs.energy ?? 70) > 65);
      const baseSpeed = isJogging ? 0.33 : Math.min(0.25, Math.max(0.14, c.speed * 0.165));
      const targetSpeed = baseSpeed * Math.min(2.0, Math.max(0.5, timeConfig.npcSpeedMultiplier));

      // Decelerate near corners or destination
      const approachSlow = dist < 0.25 && c.pathIndex === c.path.length - 1 ? 0.55 : 1.0;
      const desiredSpeed = targetSpeed * approachSlow;
      const curSpd = c.currentSpeed ?? 0;
      const accel = desiredSpeed > curSpd ? 0.65 : 1.1;
      const nextSpd =
        curSpd + Math.sign(desiredSpeed - curSpd) * Math.min(Math.abs(desiredSpeed - curSpd), accel * physicalDt);
      c.currentSpeed = nextSpd;

      // Personal-space lateral avoidance (tiny offset away from crowding)
      let steerX = dx / dist;
      let steerZ = dz / dist;
      for (let i = 0; i < allCitizens.length; i++) {
        const other = allCitizens[i];
        if (other.id === c.id || other.insideBuildingId) continue;
        const ox = c.x - other.x;
        const oz = c.z - other.z;
        const od = Math.hypot(ox, oz);
        if (od > 0.001 && od < 0.28) {
          const push = ((0.28 - od) / 0.28) * 0.35;
          steerX += (ox / od) * push;
          steerZ += (oz / od) * push;
        }
      }
      const steerLen = Math.hypot(steerX, steerZ) || 1;
      steerX /= steerLen;
      steerZ /= steerLen;

      const step = Math.min(dist, nextSpd * physicalDt);
      const nextX = Math.min(GRID_SIZE - 0.55, Math.max(0.55, c.x + steerX * step));
      const nextZ = Math.min(GRID_SIZE - 0.55, Math.max(0.55, c.z + steerZ * step));

      // Verify candidate step never passes through solid building center
      const candidateTile = tileAt(tiles, Math.round(nextX), Math.round(nextZ));
      if (
        candidateTile?.building &&
        candidateTile.building.id !== c.targetBuildingId &&
        candidateTile.building.type !== 'praca' &&
        candidateTile.building.type !== 'parque' &&
        Math.hypot(nextX - candidateTile.x, nextZ - candidateTile.z) < 0.32
      ) {
        // Stay on current path tangent without clipping into building
        c.x = Math.min(GRID_SIZE - 0.55, Math.max(0.55, c.x + (dx / dist) * step));
        c.z = Math.min(GRID_SIZE - 0.55, Math.max(0.55, c.z + (dz / dist) * step));
      } else {
        c.x = nextX;
        c.z = nextZ;
      }

      // Smooth yaw orientation
      const targetYaw = Math.atan2(dx, dz);
      c.yaw = lerpAngle(c.yaw ?? targetYaw, targetYaw, physicalDt * 9);

      const crossing = isCrosswalkPoint(navCache.pedestrianGraph, wp);
      if (crossing) {
        c.behaviorState = 'CrossingStreet';
      } else if (c.intent === 'home' || c.intent === 'sleep') {
        c.behaviorState = 'ReturningHome';
      } else {
        c.behaviorState = 'WalkingToDestination';
      }

      c.movementState = isJogging ? 'jogging' : 'walking';
      if (nextSpd < 0.16) c.animState = 'WalkSlow';
      else if (nextSpd < 0.25) c.animState = 'Walk';
      else if (nextSpd < 0.31) c.animState = 'WalkFast';
      else c.animState = 'Run';
    }
  } else {
    c.currentSpeed = 0;
    c.movementState = 'stopped';
    c.animState = c.behaviorState === 'WaitingForPath' ? 'Wait' : 'Idle';
  }

  c.state = mapBehaviorToLegacyState(c.behaviorState ?? 'AtHome');
  void BUILDING_CATALOG;
}
