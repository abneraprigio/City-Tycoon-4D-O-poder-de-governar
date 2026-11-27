import { GameTimeConfig, SpeedValue, TimePreset } from '../../types/game';

export const FIXED_SIM_DT = 1 / 20; // 20 Hz deterministic simulation step
export const MAX_FRAME_DT = 0.15; // Clamp large pauses/tab-switches

export const TIME_PRESET_SECONDS: Record<TimePreset, number> = {
  relaxed: 300, // 5 min per game day
  balanced: 180, // 3 min per game day (default)
  strategic: 60, // 1 min per game day
};

export function createDefaultTimeConfig(): GameTimeConfig {
  return {
    secondsPerDay: TIME_PRESET_SECONDS.balanced,
    preset: 'balanced',
    npcSpeedMultiplier: 1.0,
    trafficIntensity: 1.0,
    pedestrianDensity: 1.0,
    vegetationDensity: 1.0,
    cameraSpeed: 1.0,
    ambientAudioEnabled: false,
    ambientVolume: 0.45,
    debugOverlay: false,
    creativeInstantBuild: false,
  };
}

export function applyTimePreset(config: GameTimeConfig, preset: TimePreset): GameTimeConfig {
  return {
    ...config,
    preset,
    secondsPerDay: TIME_PRESET_SECONDS[preset],
  };
}

export interface ClockStepResult {
  fixedSteps: number;
  fixedDt: number;
  calendarHoursDelta: number;
  physicalDt: number;
  alpha: number;
}

/**
 * Decouples calendar time (day/month/year) from physical movement speed and frame rate.
 * Even at 8x calendar speed, pedestrians and vehicles move smoothly without cartoonish zooming.
 */
export class SimulationClock {
  private accumulator = 0;

  public reset(): void {
    this.accumulator = 0;
  }

  public computePhysicalScale(speed: SpeedValue): number {
    if (speed <= 0) return 0;
    if (speed === 0.5) return 0.55;
    if (speed === 1) return 1.0;
    if (speed === 2) return 1.45;
    if (speed === 4) return 1.9;
    return 2.35; // 8x calendar advances time rapidly while motion stays natural
  }

  public step(rawDtSeconds: number, speed: SpeedValue, config: GameTimeConfig): ClockStepResult {
    if (speed <= 0 || rawDtSeconds <= 0) {
      return {
        fixedSteps: 0,
        fixedDt: FIXED_SIM_DT,
        calendarHoursDelta: 0,
        physicalDt: 0,
        alpha: 0,
      };
    }

    const clampedDt = Math.min(MAX_FRAME_DT, Math.max(0, rawDtSeconds));
    this.accumulator = Math.min(this.accumulator + clampedDt, FIXED_SIM_DT * 6);

    let fixedSteps = 0;
    while (this.accumulator >= FIXED_SIM_DT) {
      this.accumulator -= FIXED_SIM_DT;
      fixedSteps += 1;
    }

    const totalSimDt = fixedSteps * FIXED_SIM_DT;
    const safeSecondsPerDay = Math.min(300, Math.max(60, config.secondsPerDay || 180));
    const calendarHoursDelta = ((totalSimDt * speed) / safeSecondsPerDay) * 24;
    const physicalDt = totalSimDt * this.computePhysicalScale(speed);
    const alpha = this.accumulator / FIXED_SIM_DT;

    return {
      fixedSteps,
      fixedDt: FIXED_SIM_DT,
      calendarHoursDelta,
      physicalDt,
      alpha,
    };
  }
}

export function computeStepTimings(
  dtSeconds: number,
  speed: SpeedValue,
  config: GameTimeConfig,
): { calendarHoursDelta: number; physicalDt: number; calendarSimSeconds: number } {
  if (speed <= 0 || dtSeconds <= 0) {
    return { calendarHoursDelta: 0, physicalDt: 0, calendarSimSeconds: 0 };
  }
  const clamped = Math.min(MAX_FRAME_DT, Math.max(0, dtSeconds));
  const safeSecondsPerDay = Math.min(300, Math.max(60, config.secondsPerDay || 180));
  const calendarSimSeconds = clamped * speed;
  const calendarHoursDelta = (calendarSimSeconds / safeSecondsPerDay) * 24;
  let physScale = 1.0;
  if (speed === 0.5) physScale = 0.55;
  else if (speed === 2) physScale = 1.45;
  else if (speed === 4) physScale = 1.9;
  else if (speed >= 8) physScale = 2.35;
  return {
    calendarHoursDelta,
    physicalDt: clamped * physScale,
    calendarSimSeconds,
  };
}
