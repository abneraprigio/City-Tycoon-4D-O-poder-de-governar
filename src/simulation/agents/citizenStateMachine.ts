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
  RoadVehicleSim,
  TileData,
} from '../../types/game';
import { computeBuildingAccess } from '../navigation/obstacleSystem';
import {
  findNearestPedestrianNode,
  isCrosswalkPoint,
} from '../navigation/pedestrianGraph';
import { smoothPedestrianPath } from '../navigation/pathfinding';
import { UrbanNavigationCache } from '../navigation/routeCache';
import {
  findAvailableInteractionSpot,
  hasLineOfSight,
  isCircleBlocked,
  recordCollisionEvent,
  releaseCitizenSpots,
  reserveInteractionSpot,
  sweepSegmentCapsule,
} from '../navigation/worldRegistry';
import { WORLD_SCALE } from '../worldScale';
import { evaluateCitizenIntent, findBuildingTileById, findNearestMatchingBuilding } from './citizenNeeds';
import { getScheduledSlot } from './citizenSchedule';

const PEDESTRIAN_RADIUS = WORLD_SCALE.pedestrianRadiusTile;

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

function recordTrailPoint(c: CitizenAgent): void {
  if (!c.trailHistory) c.trailHistory = [];
  const last = c.trailHistory[c.trailHistory.length - 1];
  if (!last || Math.hypot(c.x - last.x, c.z - last.z) >= 0.18) {
    c.trailHistory.push({ x: c.x, z: c.z });
    if (c.trailHistory.length > 16) {
      c.trailHistory.shift();
    }
  }
}

function assignRouteToTile(
  c: CitizenAgent,
  destTile: TileData,
  tiles: TileData[],
  navCache: UrbanNavigationCache,
): boolean {
  const pedGraph = navCache.pedestrianGraph;
  const registry = navCache.worldRegistry;
  const startNode = findNearestPedestrianNode(
    pedGraph,
    c.x,
    c.z,
    4,
    tiles,
    registry,
    c.insideBuildingId,
  );
  if (!startNode) return false;

  let goalNodeId: string | undefined;
  if (destTile.building) {
    goalNodeId = pedGraph.buildingEntranceNode.get(destTile.building.id);
  }
  if (!goalNodeId) {
    const nearestDest = findNearestPedestrianNode(pedGraph, destTile.x, destTile.z, 3, tiles, registry);
    goalNodeId = nearestDest?.id;
  }
  if (!goalNodeId) return false;

  const res = navCache.getPedestrianPath(startNode.id, goalNodeId);
  if (!res.found || res.points.length === 0) {
    return false;
  }

  // Smooth intermediate waypoints ONLY when physically obstacle-free
  const smoothed = smoothPedestrianPath(res.points, (ax, az, bx, bz) =>
    hasLineOfSight(registry, tiles, ax, az, bx, bz, PEDESTRIAN_RADIUS * 0.9, {
      allowedBuildingId: destTile.building?.id ?? null,
    }),
  );

  // If heading to a plaza/park to relax/socialize, reserve an unoccupied bench seat spot if available
  const finalPoints = [...smoothed];
  if (
    destTile.building &&
    (destTile.building.type === 'praca' || destTile.building.type === 'parque')
  ) {
    const seat = findAvailableInteractionSpot(registry, destTile.building.id, 'seat', c.id);
    if (seat && reserveInteractionSpot(registry, seat.id, c.id)) {
      c.occupiedSpotId = seat.id;
      c.sittingYaw = seat.yaw;
      const last = finalPoints[finalPoints.length - 1];
      if (hasLineOfSight(registry, tiles, last.x, last.z, seat.approachX, seat.approachZ, PEDESTRIAN_RADIUS * 0.8)) {
        finalPoints.push({ x: seat.approachX, z: seat.approachZ });
      }
    }
  }

  c.path = finalPoints;
  c.pathIndex = 0;
  const finalPt = finalPoints[finalPoints.length - 1];
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
  vehicles: RoadVehicleSim[] = [],
): void {
  // Freeze completely when simulation is paused (speed === 0 => physicalDt === 0 & calendarHoursDelta === 0)
  if (physicalDt <= 0 && calendarHoursDelta <= 0) {
    return;
  }

  const registry = navCache.worldRegistry;
  const isWeekend = day % 7 === 6 || day % 7 === 0;
  const currentBuilding = findBuildingTileById(tiles, c.insideBuildingId);

  // Initialize lastValid anchor safely on first step
  if (c.lastValidX === undefined || c.lastValidZ === undefined) {
    if (!c.insideBuildingId && isCircleBlocked(registry, tiles, c.x, c.z, PEDESTRIAN_RADIUS * 0.85, { allowedBuildingId: c.targetBuildingId, allowDirectCenterEntry: true }).blocked) {
      const safeNode = findNearestPedestrianNode(navCache.pedestrianGraph, c.x, c.z, 3, tiles, registry);
      if (safeNode) {
        c.x = safeNode.x;
        c.z = safeNode.z;
      }
    }
    c.lastValidX = c.x;
    c.lastValidZ = c.z;
  }

  // If citizen was inside a building that got demolished, eject safely onto nearest clear sidewalk
  if (c.insideBuildingId && !currentBuilding) {
    releaseCitizenSpots(registry, c.id);
    c.occupiedSpotId = null;
    c.sittingYaw = undefined;
    const safeNode = findNearestPedestrianNode(navCache.pedestrianGraph, c.x, c.z, 3, tiles, registry);
    if (safeNode) {
      c.x = safeNode.x;
      c.z = safeNode.z;
      c.lastValidX = safeNode.x;
      c.lastValidZ = safeNode.z;
    }
    c.insideBuildingId = null;
    c.behaviorState = 'AtHome';
    c.movementState = 'stopped';
    c.animState = 'Idle';
    c.currentSpeed = 0;
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

    // If still committed to staying inside or resting/socializing on bench, stay put & animate naturally
    if ((c.activityUntilHour ?? 0) > 0.02) {
      c.currentSpeed = 0;
      if (c.insideBuildingId && currentBuilding) {
        c.x = currentBuilding.x;
        c.z = currentBuilding.z;
        c.movementState = 'stopped';
        c.animState = c.behaviorState === 'Working' ? 'Work' : c.behaviorState === 'Shopping' ? 'Shop' : 'Idle';
      } else if (c.occupiedSpotId && c.sittingYaw !== undefined) {
        c.yaw = lerpAngle(c.yaw ?? c.sittingYaw, c.sittingYaw, Math.max(0.1, physicalDt * 6));
        c.movementState = 'stopped';
        c.animState = 'Sit';
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
    releaseCitizenSpots(registry, c.id);
    c.occupiedSpotId = null;
    c.sittingYaw = undefined;

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

    if (!destTile) {
      destTile = tiles.find((t) => t.building?.type === 'praca' || t.building?.type === 'prefeitura') ?? null;
    }

    if (destTile) {
      // Already inside or right at front door of destination building? Enter cleanly
      const curEntDist = Math.hypot(c.x - destTile.x, c.z - destTile.z);
      const isAlreadyAtDestination =
        destTile.building &&
        (c.insideBuildingId === destTile.building.id ||
          (curEntDist < 0.56 &&
            hasLineOfSight(registry, tiles, c.x, c.z, destTile.x, destTile.z, PEDESTRIAN_RADIUS * 0.7, {
              allowedBuildingId: destTile.building.id,
              allowDirectCenterEntry: true,
            })));

      if (destTile.building && isAlreadyAtDestination) {
        const nextBehavior = getTargetBehaviorForGoal(intent.goalType);
        c.behaviorState = nextBehavior;
        c.intent = intent.goalType;
        c.activity = intent.thought;
        c.thought = intent.thought;
        c.talkingWithId = null;
        c.currentSpeed = 0;
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
          const seat = findAvailableInteractionSpot(registry, destTile.building.id, 'seat', c.id);
          if (seat && reserveInteractionSpot(registry, seat.id, c.id)) {
            c.occupiedSpotId = seat.id;
            c.sittingYaw = seat.yaw;
            c.x = seat.x;
            c.z = seat.z;
            c.yaw = seat.yaw;
            c.animState = 'Sit';
          } else {
            c.animState = nextBehavior === 'Protesting' ? 'Talk' : 'Idle';
          }
        }
        c.state = mapBehaviorToLegacyState(c.behaviorState);
        return;
      }

      // Exit current building onto its clear front entrance before routing
      if (c.insideBuildingId && currentBuilding) {
        const access = computeBuildingAccess(tiles, currentBuilding);
        c.x = access.entrancePoint.x;
        c.z = access.entrancePoint.z;
        c.lastValidX = c.x;
        c.lastValidZ = c.z;
        c.insideBuildingId = null;
      }

      const routed = assignRouteToTile(c, destTile, tiles, navCache);
      if (routed) {
        c.intent = intent.goalType;
        c.activity = intent.thought;
        c.thought = intent.thought;
        c.talkingWithId = null;
        c.blockedTicks = 0;
        c.blockedReason = undefined;
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
        c.currentSpeed = 0;
        c.blockedTicks = (c.blockedTicks ?? 0) + 1;
        c.unreachableCount = (c.unreachableCount ?? 0) + 1;
        c.blockedReason = 'Sem calçada conectada';
        c.thought = 'Sem acesso viário ou calçada conectada até o destino.';
        c.decisionCooldown = 0.8;
        c.state = mapBehaviorToLegacyState(c.behaviorState);
        return;
      }
    }
  }

  // Follow active A* pedestrian path with continuous swept collision, braking & natural steering
  if (c.path && c.pathIndex !== undefined && c.pathIndex < c.path.length) {
    const wp: PathPoint = c.path[c.pathIndex];
    const dx = wp.x - c.x;
    const dz = wp.z - c.z;
    const dist = Math.hypot(dx, dz);

    if (dist < 0.095) {
      c.pathIndex += 1;
      if (c.pathIndex >= c.path.length) {
        // Arrived at target!
        c.path = [];
        c.pathIndex = 0;
        c.currentSpeed = 0;
        c.movementState = 'stopped';
        c.blockedReason = undefined;

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
          if (c.occupiedSpotId && c.sittingYaw !== undefined) {
            const seat = registry.spotById.get(c.occupiedSpotId);
            if (seat) {
              c.x = seat.x;
              c.z = seat.z;
            }
            c.yaw = c.sittingYaw;
            c.animState = 'Sit';
          } else {
            c.animState =
              arrivedBehavior === 'Socializing' || arrivedBehavior === 'Protesting' ? 'Talk' : 'Idle';
          }
        }
        c.state = mapBehaviorToLegacyState(c.behaviorState);
        return;
      }
    } else if (physicalDt > 0) {
      const dirX = dx / dist;
      const dirZ = dz / dist;

      // Crosswalk safety: yield cleanly if an active vehicle is approaching the crossing
      const crossingNow = isCrosswalkPoint(navCache.pedestrianGraph, wp) || isCrosswalkPoint(navCache.pedestrianGraph, { x: c.x, z: c.z });
      if (crossingNow && vehicles.length > 0) {
        for (let i = 0; i < vehicles.length; i++) {
          const v = vehicles[i];
          if (v.speed < 0.06) continue;
          const vx = c.x - v.x;
          const vz = c.z - v.z;
          const vDist = Math.hypot(vx, vz);
          if (vDist < 0.52) {
            const vDirX = Math.sin(v.yaw);
            const vDirZ = Math.cos(v.yaw);
            // If citizen is right in front of approaching vehicle, stop at curb/edge
            if (vx * vDirX + vz * vDirZ > -0.05) {
              c.currentSpeed = 0;
              c.movementState = 'waiting';
              c.animState = 'Wait';
              c.behaviorState = 'CrossingStreet';
              c.blockedReason = 'Aguardando veículo na faixa';
              c.state = mapBehaviorToLegacyState(c.behaviorState);
              return;
            }
          }
        }
      }

      // Base speed calibrated to 0.14 - 0.25 tiles/s for natural human pace (jog/exercise up to 0.33)
      const isJogging = c.intent === 'exercise' && (c.personality === 'aventureiro' || (c.needs.energy ?? 70) > 65);
      const baseSpeed = isJogging ? 0.32 : Math.min(0.24, Math.max(0.14, c.speed * 0.16));
      let targetSpeed = baseSpeed * Math.min(2.0, Math.max(0.5, timeConfig.npcSpeedMultiplier));

      // Decelerate smoothly near final destination or tight turns
      if (dist < 0.24 && c.pathIndex === c.path.length - 1) {
        targetSpeed *= 0.62;
      }

      // Personal-space lateral avoidance, right-hand pass deflection, queue braking, and pace sync
      let steerX = dirX;
      let steerZ = dirZ;
      const rightX = -dirZ;
      const rightZ = dirX;
      for (let i = 0; i < allCitizens.length; i++) {
        const other = allCitizens[i];
        if (other.id === c.id || other.insideBuildingId) continue;
        const ox = c.x - other.x;
        const oz = c.z - other.z;
        const od = Math.hypot(ox, oz);
        if (od > 0.0005 && od < 0.3) {
          const towardOtherDot = ((-ox / od) * dirX) + ((-oz / od) * dirZ);
          const otherFacingDot =
            Math.sin(other.yaw ?? 0) * dirX + Math.cos(other.yaw ?? 0) * dirZ;
          // Ahead in our path: slow down / yield smoothly & pass on the right
          if (towardOtherDot > 0.35) {
            if (od < PEDESTRIAN_RADIUS * 1.75) {
              targetSpeed *= 0.25;
            } else if ((other.currentSpeed ?? 0) < 0.04 && od < 0.17) {
              targetSpeed *= 0.3;
            } else {
              targetSpeed = Math.min(targetSpeed, Math.max(0.08, (other.currentSpeed ?? baseSpeed) * 0.96));
            }
            // If walking opposite directions nearly head-on, add consistent right-hand sidestep
            if (otherFacingDot < -0.35) {
              const passWeight = ((0.3 - od) / 0.3) * 0.85;
              steerX += rightX * passWeight;
              steerZ += rightZ * passWeight;
            }
          }
          const push = ((0.3 - od) / 0.3) * (od < PEDESTRIAN_RADIUS * 1.9 ? 1.15 : 0.48);
          steerX += (ox / od) * push;
          steerZ += (oz / od) * push;
        }
      }

      // Pre-obstacle lookahead braking
      const lookX = c.x + dirX * 0.22;
      const lookZ = c.z + dirZ * 0.22;
      const isFinalWaypoint = c.pathIndex === c.path.length - 1;
      const allowDirectCenterEntry = Boolean(
        c.targetBuildingId &&
          isFinalWaypoint &&
          Math.hypot(wp.x - c.x, wp.z - c.z) < 0.58,
      );
      const collisionOpts = {
        allowedBuildingId: c.targetBuildingId,
        allowDirectCenterEntry,
      };
      if (isCircleBlocked(registry, tiles, lookX, lookZ, PEDESTRIAN_RADIUS, collisionOpts).blocked) {
        targetSpeed *= 0.55;
      }

      const curSpd = c.currentSpeed ?? 0;
      const accel = targetSpeed > curSpd ? 0.65 : 1.25;
      const nextSpd =
        curSpd + Math.sign(targetSpeed - curSpd) * Math.min(Math.abs(targetSpeed - curSpd), accel * physicalDt);
      c.currentSpeed = nextSpd;

      const steerLen = Math.hypot(steerX, steerZ) || 1;
      steerX /= steerLen;
      steerZ /= steerLen;

      const step = Math.min(dist, nextSpd * physicalDt);
      const candX = Math.min(GRID_SIZE - 0.55, Math.max(0.55, c.x + steerX * step));
      const candZ = Math.min(GRID_SIZE - 0.55, Math.max(0.55, c.z + steerZ * step));

      // Continuous swept-segment capsule check: NEVER allow entering solid obstacles
      let swept = sweepSegmentCapsule(
        registry,
        tiles,
        c.x,
        c.z,
        candX,
        candZ,
        PEDESTRIAN_RADIUS,
        collisionOpts,
      );

      let finalX = candX;
      let finalZ = candZ;
      let moved = true;

      if (swept.hit) {
        // Attempt validated angled lateral bypasses without touching solid colliders
        const tryAngles = [0.55, -0.55, 1.05, -1.05];
        let foundSlide = false;
        const baseAngle = Math.atan2(dirZ, dirX);
        for (const aOff of tryAngles) {
          const sx = Math.cos(baseAngle + aOff);
          const sz = Math.sin(baseAngle + aOff);
          const altX = Math.min(GRID_SIZE - 0.55, Math.max(0.55, c.x + sx * step * 0.72));
          const altZ = Math.min(GRID_SIZE - 0.55, Math.max(0.55, c.z + sz * step * 0.72));
          const altSwept = sweepSegmentCapsule(
            registry,
            tiles,
            c.x,
            c.z,
            altX,
            altZ,
            PEDESTRIAN_RADIUS,
            collisionOpts,
          );
          if (!altSwept.hit) {
            finalX = altX;
            finalZ = altZ;
            foundSlide = true;
            break;
          }
        }

        if (!foundSlide) {
          moved = false;
          c.x = c.lastValidX ?? swept.safeX;
          c.z = c.lastValidZ ?? swept.safeZ;
          c.currentSpeed = 0;
          c.movementState = 'waiting';
          c.animState = 'Wait';
          c.blockedTicks = (c.blockedTicks ?? 0) + 1;
          c.lastCollisionAt = Date.now();
          c.blockedReason = swept.reason ?? 'Obstáculo à frente';
          recordCollisionEvent(
            registry,
            swept.safeX,
            swept.safeZ,
            swept.hitObjectId ?? 'obstacle',
            c.blockedReason,
          );

          // After stalling 4 ticks against an obstacle, invalidate route & recompute A*
          if ((c.blockedTicks ?? 0) >= 4) {
            c.path = [];
            c.pathIndex = 0;
            c.decisionCooldown = 0.2;
          }
          c.state = mapBehaviorToLegacyState(c.behaviorState ?? 'WalkingToDestination');
          return;
        }
      }

      if (moved) {
        c.x = finalX;
        c.z = finalZ;
        c.lastValidX = finalX;
        c.lastValidZ = finalZ;
        c.blockedTicks = 0;
        c.blockedReason = undefined;
        recordTrailPoint(c);
      }

      // Smooth yaw orientation (damped hysteresis prevents spin oscillation)
      if (dist > 0.015) {
        const targetYaw = Math.atan2(dx, dz);
        c.yaw = lerpAngle(c.yaw ?? targetYaw, targetYaw, physicalDt * 8.5);
      }

      if (crossingNow) {
        c.behaviorState = 'CrossingStreet';
      } else if (c.intent === 'home' || c.intent === 'sleep') {
        c.behaviorState = 'ReturningHome';
      } else {
        c.behaviorState = 'WalkingToDestination';
      }

      c.movementState = isJogging ? 'jogging' : 'walking';
      if (nextSpd < 0.02) {
        c.movementState = 'waiting';
        c.animState = 'Wait';
      } else if (nextSpd < 0.15) {
        c.animState = 'WalkSlow';
      } else if (nextSpd < 0.24) {
        c.animState = 'Walk';
      } else if (nextSpd < 0.3) {
        c.animState = 'WalkFast';
      } else {
        c.animState = 'Run';
      }
    }
  } else {
    c.currentSpeed = 0;
    c.movementState = 'stopped';
    c.animState = c.behaviorState === 'WaitingForPath' ? 'Wait' : 'Idle';
  }

  c.state = mapBehaviorToLegacyState(c.behaviorState ?? 'AtHome');
  void BUILDING_CATALOG;
}
