import { create } from 'zustand';
import {
  Achievement,
  BUILDING_CATALOG,
  BuildingTypeId,
  CitizenAgent,
  CityIndicators,
  DecisionLogEntry,
  DEVELOPMENT_LEVELS,
  EconomyState,
  EndGameReport,
  GameEvent,
  GRID_SIZE,
  InteractionTool,
  NewsArticle,
  PoliticsState,
  ThematicMapMode,
  TileData,
} from '../types/game';
import {
  createInitialAchievements,
  createInitialCitizens,
  createInitialEconomy,
  createInitialIndicators,
  createInitialNews,
  createInitialPolitics,
  createInitialTiles,
} from '../simulation/cityGenerator';
import {
  buildEndGameReport,
  getTile,
  processMonthlyCycle,
  recomputeCityGridMetrics,
  stepCitizensMotion,
  updateCitizenAttributesAndThoughts,
} from '../simulation/tickEngine';
import { clearCityLocal, loadCityLocal, saveCityLocal } from '../services/persistence';

export type LeftTabId =
  | 'build'
  | 'infra'
  | 'realestate'
  | 'economy'
  | 'politics'
  | 'layers'
  | 'achievements';

export interface CameraCommand {
  type:
    | 'focus_tile'
    | 'follow_citizen'
    | 'reset'
    | 'rotate_left'
    | 'rotate_right'
    | 'tilt_up'
    | 'tilt_down'
    | 'zoom_in'
    | 'zoom_out';
  x?: number;
  z?: number;
  citizenId?: string;
  nonce: number;
}

export interface ToastNotice {
  id: string;
  text: string;
  tone: 'info' | 'success' | 'warning' | 'error';
}

export interface GameState {
  cityName: string;
  day: number;
  month: number;
  year: number;
  hourOfDay: number; // 0..24
  dayAccumulator: number;
  speed: 0 | 1 | 2 | 4 | 8;
  developmentLevel: number;
  hadDebtBefore: boolean;

  tiles: TileData[];
  citizens: CitizenAgent[];
  economy: EconomyState;
  indicators: CityIndicators;
  politics: PoliticsState;
  news: NewsArticle[];
  achievements: Achievement[];
  decisionLogs: DecisionLogEntry[];

  activeEvent: GameEvent | null;
  endGameReport: EndGameReport | null;
  auctionTile: { x: number; z: number } | null;

  // UI & Interaction State
  activeTool: InteractionTool;
  selectedBuildType: BuildingTypeId | null;
  buildRotation: number; // 0..3
  moveSourceTile: { x: number; z: number } | null;
  selectedTileCoords: { x: number; z: number } | null;
  selectedCitizenId: string | null;
  followedCitizenId: string | null;
  thematicMode: ThematicMapMode;
  activeLeftTab: LeftTabId | null;
  zenMode: boolean;
  showNewspaperModal: boolean;
  showCloudModal: boolean;
  cameraCommand: CameraCommand | null;
  toast: ToastNotice | null;
  gridVersion: number; // increments when 3D tile meshes need sync

  // Actions
  advanceSimulation: (dtSeconds: number) => void;
  setSpeed: (speed: 0 | 1 | 2 | 4 | 8) => void;
  setActiveTool: (tool: InteractionTool, buildType?: BuildingTypeId | null) => void;
  rotateBuildPreview: () => void;
  setThematicMode: (mode: ThematicMapMode) => void;
  setActiveLeftTab: (tab: LeftTabId | null) => void;
  toggleZenMode: () => void;
  setShowNewspaperModal: (open: boolean) => void;
  setShowCloudModal: (open: boolean) => void;

  selectTile: (x: number, z: number) => void;
  selectCitizen: (citizenId: string | null) => void;
  followCitizen: (citizenId: string | null) => void;
  sendCameraCommand: (cmd: Omit<CameraCommand, 'nonce'>) => void;

  interactWithTile: (x: number, z: number) => void;
  upgradeBuilding: (x: number, z: number) => void;
  startMoveBuilding: (x: number, z: number) => void;
  demolishAt: (x: number, z: number) => void;

  buyLand: (x: number, z: number) => void;
  sellLand: (x: number, z: number) => void;
  grantConcession: (x: number, z: number) => void;
  togglePlannedDistrict: (x: number, z: number) => void;
  openAuction: (x: number, z: number) => void;
  closeAuction: () => void;
  completeAuction: (x: number, z: number, bidAmount: number, buyerName: string) => void;
  resolveLandConflict: (x: number, z: number, method: 'mediate' | 'housing' | 'legal') => void;

  updateTaxRates: (partial: Partial<Pick<EconomyState, 'iptuRate' | 'issRate' | 'itbiRate'>>) => void;
  updateBudgets: (
    partial: Partial<
      Pick<EconomyState, 'budgetHealth' | 'budgetEducation' | 'budgetSafety' | 'budgetTransit' | 'budgetSocial'>
    >,
  ) => void;

  proposeBill: (billId: string) => void;
  negotiateCouncil: () => void;
  resolveEventChoice: (choiceId: string) => void;
  resignMayor: () => void;
  startNewCity: (cityName?: string, mayorName?: string) => void;

  exportSnapshot: () => Record<string, unknown>;
  importSnapshot: (snapshot: Record<string, unknown>) => boolean;
  showToast: (text: string, tone?: ToastNotice['tone']) => void;
  clearToast: () => void;
}

function buildFreshCityState(cityName = 'Nova Aurora', mayorName = 'Prefeito(a) Silva') {
  const tiles = createInitialTiles();
  const economy = createInitialEconomy();
  const politics = createInitialPolitics();
  politics.mayorName = mayorName;
  const indicators = createInitialIndicators();
  recomputeCityGridMetrics(tiles, economy, politics);
  const citizens = createInitialCitizens(tiles);
  updateCitizenAttributesAndThoughts(citizens, tiles, indicators, economy);

  return {
    cityName,
    day: 1,
    month: 1,
    year: 1,
    hourOfDay: 9.0,
    dayAccumulator: 0,
    speed: 1 as const,
    developmentLevel: 1,
    hadDebtBefore: false,
    tiles,
    citizens,
    economy,
    indicators,
    politics,
    news: createInitialNews(),
    achievements: createInitialAchievements(),
    decisionLogs: [{ day: 1, year: 1, text: `Fundação administrativa de ${cityName}.` }],
    activeEvent: null,
    endGameReport: null,
    auctionTile: null,
  };
}

function hydrateFromSnapshot(snap: Record<string, unknown>) {
  if (!Array.isArray(snap.tiles) || snap.tiles.length !== GRID_SIZE * GRID_SIZE) {
    return null;
  }
  const tiles = snap.tiles as TileData[];
  const economy = snap.economy as EconomyState;
  const indicators = snap.indicators as CityIndicators;
  const politics = snap.politics as PoliticsState;
  const citizens = Array.isArray(snap.citizens) ? (snap.citizens as CitizenAgent[]) : createInitialCitizens(tiles);
  const news = Array.isArray(snap.news) ? (snap.news as NewsArticle[]) : createInitialNews();
  const achievements = Array.isArray(snap.achievements)
    ? (snap.achievements as Achievement[])
    : createInitialAchievements();
  const decisionLogs = Array.isArray(snap.decisionLogs) ? (snap.decisionLogs as DecisionLogEntry[]) : [];

  recomputeCityGridMetrics(tiles, economy, politics);

  return {
    cityName: String(snap.cityName || 'Nova Aurora'),
    day: Number(snap.day || 1),
    month: Number(snap.month || 1),
    year: Number(snap.year || 1),
    hourOfDay: Number(snap.hourOfDay ?? 9),
    dayAccumulator: 0,
    speed: 1 as const,
    developmentLevel: Number(snap.developmentLevel || 1),
    hadDebtBefore: Boolean(snap.hadDebtBefore),
    tiles,
    citizens,
    economy,
    indicators,
    politics,
    news,
    achievements,
    decisionLogs,
    activeEvent: null,
    endGameReport: (snap.endGameReport as EndGameReport | null) || null,
    auctionTile: null,
  };
}

const initialLocal = loadCityLocal();
const bootState = (initialLocal && hydrateFromSnapshot(initialLocal)) || buildFreshCityState();

export const useGameStore = create<GameState>((set, get) => ({
  ...bootState,

  activeTool: 'select',
  selectedBuildType: null,
  buildRotation: 0,
  moveSourceTile: null,
  selectedTileCoords: null,
  selectedCitizenId: null,
  followedCitizenId: null,
  thematicMode: 'normal',
  activeLeftTab: 'build',
  zenMode: false,
  showNewspaperModal: false,
  showCloudModal: false,
  cameraCommand: null,
  toast: null,
  gridVersion: 1,

  showToast: (text, tone = 'info') => {
    set({ toast: { id: `${Date.now()}_${Math.random()}`, text, tone } });
  },

  clearToast: () => set({ toast: null }),

  setSpeed: (speed) => set({ speed }),

  setActiveTool: (tool, buildType = null) =>
    set({
      activeTool: tool,
      selectedBuildType: buildType,
      moveSourceTile: null,
    }),

  rotateBuildPreview: () => set((s) => ({ buildRotation: (s.buildRotation + 1) % 4 })),

  setThematicMode: (thematicMode) => set({ thematicMode }),

  setActiveLeftTab: (tab) =>
    set((s) => ({
      activeLeftTab: s.activeLeftTab === tab ? null : tab,
    })),

  toggleZenMode: () => set((s) => ({ zenMode: !s.zenMode })),

  setShowNewspaperModal: (showNewspaperModal) => set({ showNewspaperModal }),

  setShowCloudModal: (showCloudModal) => set({ showCloudModal }),

  selectTile: (x, z) =>
    set({
      selectedTileCoords: { x, z },
      selectedCitizenId: null,
      followedCitizenId: null,
    }),

  selectCitizen: (citizenId) =>
    set({
      selectedCitizenId: citizenId,
      selectedTileCoords: null,
    }),

  followCitizen: (citizenId) =>
    set((s) => ({
      followedCitizenId: citizenId,
      selectedCitizenId: citizenId ?? s.selectedCitizenId,
      cameraCommand: citizenId
        ? { type: 'follow_citizen', citizenId, nonce: Date.now() }
        : s.cameraCommand,
    })),

  sendCameraCommand: (cmd) =>
    set({
      followedCitizenId: null,
      cameraCommand: { ...cmd, nonce: Date.now() },
    }),

  advanceSimulation: (dtSeconds) => {
    const state = get();
    if (state.speed === 0 || state.endGameReport || state.activeEvent) return;

    const simDt = Math.min(0.25, dtSeconds) * state.speed;
    // 2.2 seconds per simulated day at 1x speed
    const secondsPerDay = 2.2;
    let newAcc = state.dayAccumulator + simDt;
    const hourStep = (simDt / secondsPerDay) * 24;
    let newHour = (state.hourOfDay + hourStep) % 24;

    // Move citizens smoothly in real time
    const nextCitizens = state.citizens;
    stepCitizensMotion(nextCitizens, state.tiles, newHour, simDt);

    if (newAcc < secondsPerDay) {
      set({ dayAccumulator: newAcc, hourOfDay: newHour });
      return;
    }

    newAcc -= secondsPerDay;
    let day = state.day + 1;
    let month = state.month;
    let year = state.year;

    if (day <= 30) {
      set({ day, dayAccumulator: newAcc, hourOfDay: newHour });
      return;
    }

    // Monthly closure!
    day = 1;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }

    const hadDebtBefore = state.hadDebtBefore || state.economy.debt > 0;
    const result = processMonthlyCycle({
      tiles: state.tiles,
      economy: state.economy,
      indicators: state.indicators,
      politics: state.politics,
      citizens: nextCitizens,
      achievements: state.achievements,
      developmentLevel: state.developmentLevel,
      decisionLogs: state.decisionLogs,
      day,
      month,
      year,
      cityName: state.cityName,
      hadDebtBefore,
    });

    const updatedNews = [...result.newsToAdd, ...state.news].slice(0, 40);

    set((s) => ({
      day,
      month,
      year,
      dayAccumulator: newAcc,
      hourOfDay: newHour,
      hadDebtBefore,
      tiles: result.tiles,
      economy: result.economy,
      indicators: result.indicators,
      politics: result.politics,
      citizens: result.citizens,
      news: updatedNews,
      achievements: result.achievements,
      developmentLevel: result.developmentLevel,
      decisionLogs: result.decisionLogs,
      activeEvent: result.triggeredEvent ?? s.activeEvent,
      endGameReport: result.endGameReport ?? s.endGameReport,
      gridVersion: s.gridVersion + 1,
      toast: result.developmentChangedTo
        ? {
            id: `lvl_${Date.now()}`,
            text: `Cidade evoluiu para: ${result.developmentChangedTo}! Novas construções desbloqueadas.`,
            tone: 'success',
          }
        : s.toast,
    }));

    // Auto-save locally every month
    const latest = get();
    saveCityLocal(latest.exportSnapshot());
  },

  interactWithTile: (x, z) => {
    const state = get();
    const tile = getTile(state.tiles, x, z);
    if (!tile) return;

    if (state.activeTool === 'select') {
      state.selectTile(x, z);
      return;
    }

    if (state.activeTool === 'demolish') {
      state.demolishAt(x, z);
      return;
    }

    if (state.activeTool === 'buy_land') {
      state.buyLand(x, z);
      return;
    }

    if (state.activeTool === 'sell_land') {
      state.sellLand(x, z);
      return;
    }

    if (state.activeTool === 'move') {
      if (!state.moveSourceTile) {
        if (tile.building && tile.building.type !== 'prefeitura') {
          set({ moveSourceTile: { x, z } });
          state.showToast('Selecione o terreno de destino para mover a construção.', 'info');
        } else {
          state.showToast('Selecione um edifício válido para mover.', 'warning');
        }
        return;
      }
      const src = state.moveSourceTile;
      if (src.x === x && src.z === z) {
        set({ moveSourceTile: null });
        return;
      }
      const srcTile = getTile(state.tiles, src.x, src.z);
      if (!srcTile || !srcTile.building) {
        set({ moveSourceTile: null });
        return;
      }
      if (tile.building || tile.road !== 'none' || tile.terrain === 'waterfront' || tile.conflict) {
        state.showToast('Terreno de destino inválido ou ocupado.', 'error');
        return;
      }
      const moveFee = 6000;
      if (state.economy.treasury < moveFee) {
        state.showToast('Saldo insuficiente para custo de realocação (R$ 6.000).', 'error');
        return;
      }
      const tiles = state.tiles.map((t) => ({
        ...t,
        building: t.building ? { ...t.building } : null,
      }));
      const sTile = tiles[src.z * GRID_SIZE + src.x];
      const dTile = tiles[z * GRID_SIZE + x];
      dTile.building = sTile.building;
      dTile.ownerType = sTile.ownerType;
      dTile.ownerName = sTile.ownerName;
      sTile.building = null;
      const economy = { ...state.economy, treasury: state.economy.treasury - moveFee };
      recomputeCityGridMetrics(tiles, economy, state.politics);
      set((s) => ({
        tiles,
        economy,
        moveSourceTile: null,
        selectedTileCoords: { x, z },
        gridVersion: s.gridVersion + 1,
      }));
      state.showToast('Construção realocada com sucesso!', 'success');
      return;
    }

    if (state.activeTool === 'build' && state.selectedBuildType) {
      const def = BUILDING_CATALOG[state.selectedBuildType];
      if (!def) return;

      if (state.developmentLevel < def.unlockLevel) {
        const reqName = DEVELOPMENT_LEVELS.find((d) => d.level === def.unlockLevel)?.name || '';
        state.showToast(`Desbloqueado no nível ${def.unlockLevel} (${reqName}).`, 'warning');
        return;
      }

      if (tile.conflict) {
        state.showToast('Resolva o conflito fundiário neste terreno antes de construir.', 'warning');
        return;
      }

      if (def.isRoad) {
        const roadType = def.id === 'avenida' ? 'avenida' : 'rua';
        if (tile.building) {
          state.showToast('Demolir o imóvel antes de pavimentar este lote.', 'error');
          return;
        }
        if (tile.road === roadType) return;
        if (state.economy.treasury < def.cost) {
          state.showToast('Orçamento público insuficiente.', 'error');
          return;
        }
        const tiles = state.tiles.map((t) => ({ ...t }));
        const target = tiles[z * GRID_SIZE + x];
        target.road = roadType;
        target.ownerType = 'public';
        target.ownerName = 'Via Pública';
        const economy = { ...state.economy, treasury: state.economy.treasury - def.cost };
        recomputeCityGridMetrics(tiles, economy, state.politics);
        set((s) => ({ tiles, economy, gridVersion: s.gridVersion + 1 }));
        return;
      }

      // Building placement
      if (tile.building || tile.road !== 'none') {
        state.showToast('Este terreno já está ocupado.', 'error');
        return;
      }

      if (tile.terrain === 'waterfront' && def.category !== 'leisure') {
        state.showToast('Área de orla reservada para praças, parques e lazer.', 'warning');
        return;
      }

      if (def.id === 'prefeitura' && state.tiles.some((t) => t.building?.type === 'prefeitura')) {
        state.showToast('A cidade já possui uma Prefeitura Municipal.', 'warning');
        return;
      }

      const landAcquisitionCost = tile.ownerType === 'available' ? Math.round(tile.landValue * 0.65) : 0;
      const totalCost = def.cost + landAcquisitionCost;

      if (state.economy.treasury < totalCost) {
        state.showToast(
          `Saldo insuficiente (necessário R$ ${totalCost.toLocaleString('pt-BR')}).`,
          'error',
        );
        return;
      }

      const tiles = state.tiles.map((t) => ({
        ...t,
        building: t.building ? { ...t.building } : null,
      }));
      const target = tiles[z * GRID_SIZE + x];
      const isPublic = Boolean(def.isPublicAsset);
      target.ownerType = isPublic ? 'public' : 'private';
      target.ownerName = isPublic ? 'Prefeitura Municipal' : 'Empreendimento Privado';
      target.building = {
        id: `b_${def.id}_${x}_${z}_${Date.now().toString(36)}`,
        type: def.id,
        level: 1,
        rotation: state.buildRotation,
        ownerType: isPublic ? 'public' : 'private',
        ownerName: target.ownerName,
        powered: target.hasPower,
        watered: target.hasWater,
        connectedRoad: true,
        builtAtDay: (state.year - 1) * 360 + (state.month - 1) * 30 + state.day,
        condition: 100,
      };

      const economy = {
        ...state.economy,
        treasury: state.economy.treasury - totalCost,
        revenueBreakdown: {
          ...state.economy.revenueBreakdown,
          itbi:
            state.economy.revenueBreakdown.itbi +
            Math.round(landAcquisitionCost * (state.economy.itbiRate / 100)),
        },
      };

      const grid = recomputeCityGridMetrics(tiles, economy, state.politics);
      const indicators = {
        ...state.indicators,
        housingCapacity: grid.housingCapacity,
        jobsTotal: grid.jobsTotal,
        safety: grid.avgSafety,
        health: grid.avgHealth,
        education: grid.avgEducation,
        pollution: grid.avgPollution,
      };

      set((s) => ({
        tiles,
        economy,
        indicators,
        selectedTileCoords: { x, z },
        gridVersion: s.gridVersion + 1,
      }));
      state.showToast(`${def.name} construído!`, 'success');
    }
  },

  upgradeBuilding: (x, z) => {
    const state = get();
    const tile = getTile(state.tiles, x, z);
    if (!tile || !tile.building) return;
    if (tile.building.level >= 3) {
      state.showToast('Edifício já está no nível máximo (Nível 3).', 'info');
      return;
    }
    const def = BUILDING_CATALOG[tile.building.type];
    const upgradeCost = Math.round(def.cost * 0.75 * tile.building.level);
    if (state.economy.treasury < upgradeCost) {
      state.showToast(`Saldo insuficiente (R$ ${upgradeCost.toLocaleString('pt-BR')}).`, 'error');
      return;
    }
    const tiles = state.tiles.map((t) => ({
      ...t,
      building: t.building ? { ...t.building } : null,
    }));
    const target = tiles[z * GRID_SIZE + x];
    if (target.building) {
      target.building.level = (target.building.level + 1) as 1 | 2 | 3;
    }
    const economy = { ...state.economy, treasury: state.economy.treasury - upgradeCost };
    const grid = recomputeCityGridMetrics(tiles, economy, state.politics);
    set((s) => ({
      tiles,
      economy,
      indicators: {
        ...s.indicators,
        housingCapacity: grid.housingCapacity,
        jobsTotal: grid.jobsTotal,
      },
      gridVersion: s.gridVersion + 1,
    }));
    state.showToast(`${def.name} evoluído para o Nível ${target.building!.level}!`, 'success');
  },

  startMoveBuilding: (x, z) => {
    const state = get();
    const tile = getTile(state.tiles, x, z);
    if (!tile?.building) return;
    if (tile.building.type === 'prefeitura') {
      state.showToast('A Prefeitura Municipal é um marco histórico fixo.', 'warning');
      return;
    }
    set({
      activeTool: 'move',
      selectedBuildType: null,
      moveSourceTile: { x, z },
    });
    state.showToast('Clique em um lote vazio para mover o imóvel.', 'info');
  },

  demolishAt: (x, z) => {
    const state = get();
    const tile = getTile(state.tiles, x, z);
    if (!tile) return;
    if (tile.building?.type === 'prefeitura') {
      state.showToast('Não é possível demolir a Prefeitura Municipal.', 'error');
      return;
    }
    if (!tile.building && tile.road === 'none') {
      state.showToast('Nada para demolir neste terreno.', 'info');
      return;
    }
    const refund = tile.building
      ? Math.round(BUILDING_CATALOG[tile.building.type].cost * 0.25)
      : 1000;
    const tiles = state.tiles.map((t) => ({
      ...t,
      building: t.building ? { ...t.building } : null,
    }));
    const target = tiles[z * GRID_SIZE + x];
    target.building = null;
    target.road = 'none';
    const economy = { ...state.economy, treasury: state.economy.treasury + refund };
    recomputeCityGridMetrics(tiles, economy, state.politics);
    set((s) => ({ tiles, economy, gridVersion: s.gridVersion + 1 }));
    state.showToast(`Demolição concluída (+R$ ${refund.toLocaleString('pt-BR')} reaproveitados).`, 'info');
  },

  buyLand: (x, z) => {
    const state = get();
    const tile = getTile(state.tiles, x, z);
    if (!tile) return;
    if (tile.ownerType === 'public') {
      state.showToast('Este terreno já pertence à Prefeitura.', 'info');
      return;
    }
    if (tile.building) {
      state.showToast('Desaproprie/demolir o imóvel ou compre lotes livres.', 'warning');
      return;
    }
    const price = Math.round(tile.landValue);
    if (state.economy.treasury < price) {
      state.showToast('Saldo insuficiente para adquirir o terreno.', 'error');
      return;
    }
    const tiles = state.tiles.map((t) => ({ ...t }));
    const target = tiles[z * GRID_SIZE + x];
    target.ownerType = 'public';
    target.ownerName = 'Prefeitura Municipal';
    const economy = { ...state.economy, treasury: state.economy.treasury - price };
    recomputeCityGridMetrics(tiles, economy, state.politics);
    set((s) => ({ tiles, economy, gridVersion: s.gridVersion + 1 }));
    state.showToast(`Terreno (${x}, ${z}) adquirido por R$ ${price.toLocaleString('pt-BR')}.`, 'success');
  },

  sellLand: (x, z) => {
    const state = get();
    const tile = getTile(state.tiles, x, z);
    if (!tile) return;
    if (tile.ownerType !== 'public' || tile.building || tile.road !== 'none') {
      state.showToast('Apenas terrenos públicos vazios podem ser vendidos.', 'warning');
      return;
    }
    const salePrice = Math.round(tile.landValue * 1.15);
    const itbi = Math.round(salePrice * (state.economy.itbiRate / 100));
    const tiles = state.tiles.map((t) => ({ ...t }));
    const target = tiles[z * GRID_SIZE + x];
    target.ownerType = 'private';
    target.ownerName = 'Investidor Privado';
    target.concessionActive = true;
    const economy = {
      ...state.economy,
      treasury: state.economy.treasury + salePrice + itbi,
      revenueBreakdown: {
        ...state.economy.revenueBreakdown,
        itbi: state.economy.revenueBreakdown.itbi + itbi,
      },
    };
    set((s) => ({ tiles, economy, gridVersion: s.gridVersion + 1 }));
    state.showToast(
      `Lote vendido por R$ ${salePrice.toLocaleString('pt-BR')} (+R$ ${itbi.toLocaleString('pt-BR')} ITBI).`,
      'success',
    );
  },

  grantConcession: (x, z) => {
    const state = get();
    const tile = getTile(state.tiles, x, z);
    if (!tile || tile.building || tile.road !== 'none') {
      state.showToast('Selecione um terreno sem construção para conceder.', 'warning');
      return;
    }
    const fee = Math.round(tile.landValue * 0.45);
    const tiles = state.tiles.map((t) => ({ ...t }));
    const target = tiles[z * GRID_SIZE + x];
    target.concessionActive = true;
    target.ownerType = 'private';
    target.ownerName = 'Concessionária Urbana';
    const economy = { ...state.economy, treasury: state.economy.treasury + fee };
    set((s) => ({ tiles, economy, gridVersion: s.gridVersion + 1 }));
    state.showToast(
      `Concessão aprovada! Taxa de R$ ${fee.toLocaleString('pt-BR')} recebida e desenvolvimento privado ativado.`,
      'success',
    );
  },

  togglePlannedDistrict: (x, z) => {
    const state = get();
    const tile = getTile(state.tiles, x, z);
    if (!tile) return;
    const cost = 25000;
    if (!tile.plannedDistrict && state.economy.treasury < cost) {
      state.showToast('Necessário R$ 25.000 para declarar Bairro Planejado.', 'error');
      return;
    }
    const tiles = state.tiles.map((t) => ({ ...t }));
    const minX = Math.max(0, x - 1);
    const maxX = Math.min(GRID_SIZE - 1, x + 1);
    const minZ = Math.max(0, z - 1);
    const maxZ = Math.min(GRID_SIZE - 1, z + 1);
    for (let tz = minZ; tz <= maxZ; tz++) {
      for (let tx = minX; tx <= maxX; tx++) {
        tiles[tz * GRID_SIZE + tx].plannedDistrict = true;
      }
    }
    const economy = { ...state.economy, treasury: state.economy.treasury - cost };
    recomputeCityGridMetrics(tiles, economy, state.politics);
    set((s) => ({ tiles, economy, gridVersion: s.gridVersion + 1 }));
    state.showToast('Setor declarado Bairro Planejado (valorização imobiliária +25%)!', 'success');
  },

  openAuction: (x, z) => set({ auctionTile: { x, z } }),
  closeAuction: () => set({ auctionTile: null }),

  completeAuction: (x, z, bidAmount, buyerName) => {
    const state = get();
    const tile = getTile(state.tiles, x, z);
    if (!tile) return;
    const itbi = Math.round(bidAmount * (state.economy.itbiRate / 100));
    const tiles = state.tiles.map((t) => ({ ...t }));
    const target = tiles[z * GRID_SIZE + x];
    target.ownerType = 'private';
    target.ownerName = buyerName;
    target.concessionActive = true;
    const economy = {
      ...state.economy,
      treasury: state.economy.treasury + bidAmount + itbi,
      revenueBreakdown: {
        ...state.economy.revenueBreakdown,
        itbi: state.economy.revenueBreakdown.itbi + itbi,
      },
    };
    const newsItem: NewsArticle = {
      id: `news_auc_${Date.now()}`,
      day: state.day,
      month: state.month,
      year: state.year,
      category: 'Economia',
      headline: `Leilão público arremata lote (${x},${z}) por R$ ${bidAmount.toLocaleString('pt-BR')}`,
      summary: `${buyerName} venceu a disputa imobiliária e planeja novos investimentos no setor.`,
    };
    set((s) => ({
      tiles,
      economy,
      auctionTile: null,
      news: [newsItem, ...s.news].slice(0, 40),
      gridVersion: s.gridVersion + 1,
    }));
    state.showToast(`Leilão concluído! +R$ ${(bidAmount + itbi).toLocaleString('pt-BR')}.`, 'success');
  },

  resolveLandConflict: (x, z, method) => {
    const state = get();
    const tile = getTile(state.tiles, x, z);
    if (!tile || !tile.conflict) return;

    const costs = { mediate: 45000, housing: 95000, legal: 15000 };
    const cost = costs[method];
    if (state.economy.treasury < cost) {
      state.showToast('Orçamento insuficiente para esta medida.', 'error');
      return;
    }

    const tiles = state.tiles.map((t) => ({ ...t }));
    const target = tiles[z * GRID_SIZE + x];
    target.conflict = null;

    let popDelta = 0;
    let headline = '';
    if (method === 'housing') {
      target.ownerType = 'public';
      target.ownerName = 'Programa Habitacional';
      target.building = {
        id: `b_hab_${x}_${z}_${Date.now().toString(36)}`,
        type: 'casa_popular',
        level: 1,
        rotation: 0,
        ownerType: 'private',
        ownerName: 'Cooperativa Habitacional',
        powered: target.hasPower,
        watered: target.hasWater,
        connectedRoad: true,
        builtAtDay: state.day,
        condition: 100,
      };
      popDelta = 6;
      headline = 'Prefeitura entrega moradias populares e encerra disputa fundiária com acordo';
    } else if (method === 'mediate') {
      target.ownerType = 'public';
      popDelta = 4;
      headline = 'Mesa de mediação regulariza área ocupada com apoio comunitário';
    } else {
      popDelta = -4;
      headline = 'Disputa de terreno segue para decisão judicial após impasse';
    }

    const economy = { ...state.economy, treasury: state.economy.treasury - cost };
    recomputeCityGridMetrics(tiles, economy, state.politics);
    set((s) => ({
      tiles,
      economy,
      indicators: {
        ...s.indicators,
        popularity: Math.max(5, Math.min(99, s.indicators.popularity + popDelta)),
      },
      news: [
        {
          id: `news_conf_${Date.now()}`,
          day: state.day,
          month: state.month,
          year: state.year,
          category: 'Habitação' as const,
          headline,
          summary: `Caso do lote (${x}, ${z}) recebeu encaminhamento administrativo da Prefeitura.`,
        },
        ...s.news,
      ].slice(0, 40),
      gridVersion: s.gridVersion + 1,
    }));
    state.showToast('Conflito fundiário encaminhado.', 'success');
  },

  updateTaxRates: (partial) =>
    set((s) => ({
      economy: { ...s.economy, ...partial },
    })),

  updateBudgets: (partial) =>
    set((s) => {
      const economy = { ...s.economy, ...partial };
      const tiles = s.tiles.map((t) => ({ ...t }));
      recomputeCityGridMetrics(tiles, economy, s.politics);
      return { economy, tiles };
    }),

  proposeBill: (billId) => {
    const state = get();
    const bill = state.politics.bills.find((b) => b.id === billId && b.status === 'available');
    if (!bill) return;
    if (state.economy.treasury < bill.cost) {
      state.showToast(`Caixa insuficiente (custo: R$ ${bill.cost.toLocaleString('pt-BR')}).`, 'error');
      return;
    }

    const approved = state.politics.councilSupport >= 48;
    const bills = state.politics.bills.map((b) =>
      b.id === billId ? { ...b, status: approved ? ('approved' as const) : ('rejected' as const) } : b,
    );

    if (!approved) {
      set((s) => ({
        politics: { ...s.politics, bills },
        news: [
          {
            id: `news_bill_rej_${Date.now()}`,
            day: state.day,
            month: state.month,
            year: state.year,
            category: 'Política' as const,
            headline: `Câmara rejeita projeto "${bill.title}" por falta de base aliada`,
            summary: 'Vereadores cobram articulação política antes de novas votações.',
          },
          ...s.news,
        ].slice(0, 40),
      }));
      state.showToast('Projeto rejeitado na Câmara! Negocie apoio político primeiro.', 'error');
      return;
    }

    const economy = { ...state.economy, treasury: state.economy.treasury - bill.cost };
    const politics = {
      ...state.politics,
      bills,
      activePolicies: [...state.politics.activePolicies, bill.id],
    };
    const indicators = {
      ...state.indicators,
      popularity: Math.min(99, state.indicators.popularity + bill.popularityEffect),
      safety: Math.min(100, state.indicators.safety + (bill.safetyEffect || 0)),
      education: Math.min(100, state.indicators.education + (bill.educationEffect || 0)),
      health: Math.min(100, state.indicators.health + (bill.healthEffect || 0)),
      housingIndex: Math.min(100, state.indicators.housingIndex + (bill.housingEffect || 0)),
      economicDevelopment: Math.min(100, state.indicators.economicDevelopment + (bill.economyEffect || 0)),
    };
    const tiles = state.tiles.map((t) => ({ ...t }));
    recomputeCityGridMetrics(tiles, economy, politics);

    set((s) => ({
      economy,
      politics,
      indicators,
      tiles,
      decisionLogs: [
        ...s.decisionLogs,
        { day: s.day, year: s.year, text: `Projeto de Lei aprovado: ${bill.title}.` },
      ],
      news: [
        {
          id: `news_bill_ok_${Date.now()}`,
          day: state.day,
          month: state.month,
          year: state.year,
          category: 'Política' as const,
          headline: `Câmara aprova "${bill.title}" com apoio da maioria`,
          summary: bill.description,
        },
        ...s.news,
      ].slice(0, 40),
    }));
    state.showToast(`Projeto "${bill.title}" aprovado pela Câmara!`, 'success');
  },

  negotiateCouncil: () => {
    const state = get();
    const cost = 55000;
    if (state.economy.treasury < cost) {
      state.showToast('Saldo insuficiente para obras de articulação distrital (R$ 55.000).', 'error');
      return;
    }
    const councilors = state.politics.councilors.map((c) => ({
      ...c,
      support: Math.min(96, c.support + (c.alignment === 'oposicao' ? 4 : 9)),
    }));
    const newSupport = Math.round(councilors.reduce((a, c) => a + c.support, 0) / councilors.length);
    set((s) => ({
      economy: { ...s.economy, treasury: s.economy.treasury - cost },
      politics: { ...s.politics, councilors, councilSupport: newSupport },
    }));
    state.showToast(`Apoio na Câmara Municipal elevado para ${newSupport}%.`, 'success');
  },

  resolveEventChoice: (choiceId) => {
    const state = get();
    const evt = state.activeEvent;
    if (!evt) return;
    const choice = evt.choices.find((c) => c.id === choiceId);
    if (!choice) return;

    if (choice.cost > 0 && state.economy.treasury < choice.cost) {
      state.showToast('Caixa insuficiente para custear esta opção.', 'error');
      return;
    }

    const tiles = state.tiles.map((t) => ({ ...t }));
    if (choice.effects.resolveConflictTile && evt.tileX !== undefined && evt.tileZ !== undefined) {
      const t = getTile(tiles, evt.tileX, evt.tileZ);
      if (t) t.conflict = null;
    }

    const economy = {
      ...state.economy,
      treasury: Math.max(0, state.economy.treasury + (choice.effects.treasury || 0)),
    };
    const indicators = {
      ...state.indicators,
      popularity: Math.max(5, Math.min(99, state.indicators.popularity + (choice.effects.popularity || 0))),
      safety: Math.max(5, Math.min(100, state.indicators.safety + (choice.effects.safety || 0))),
      health: Math.max(5, Math.min(100, state.indicators.health + (choice.effects.health || 0))),
      education: Math.max(5, Math.min(100, state.indicators.education + (choice.effects.education || 0))),
      economicDevelopment: Math.max(
        5,
        Math.min(100, state.indicators.economicDevelopment + (choice.effects.economy || 0)),
      ),
    };
    const politics = {
      ...state.politics,
      councilSupport: Math.max(
        10,
        Math.min(98, state.politics.councilSupport + (choice.effects.councilSupport || 0)),
      ),
    };

    recomputeCityGridMetrics(tiles, economy, politics);

    set((s) => ({
      tiles,
      economy,
      indicators,
      politics,
      activeEvent: null,
      decisionLogs: [
        ...s.decisionLogs,
        { day: s.day, year: s.year, text: `${evt.title}: ${choice.label}.` },
      ],
      news: [
        {
          id: `news_evt_${Date.now()}`,
          day: s.day,
          month: s.month,
          year: s.year,
          category: (evt.type === 'land_conflict' ? 'Habitação' : evt.type === 'political' ? 'Política' : 'Cidade') as NewsArticle['category'],
          headline: `${evt.title} — Prefeitura decide: ${choice.label}`,
          summary: choice.description,
        },
        ...s.news,
      ].slice(0, 40),
      gridVersion: s.gridVersion + 1,
    }));
  },

  resignMayor: () => {
    const s = get();
    const report = buildEndGameReport('resigned', s.indicators, s.economy, s.politics, s.year, s.decisionLogs);
    set({ endGameReport: report, speed: 0 });
  },

  startNewCity: (cityName = 'Nova Aurora', mayorName = 'Prefeito(a) Silva') => {
    clearCityLocal();
    const fresh = buildFreshCityState(cityName, mayorName);
    set((s) => ({
      ...fresh,
      selectedTileCoords: null,
      selectedCitizenId: null,
      followedCitizenId: null,
      activeTool: 'select',
      selectedBuildType: null,
      gridVersion: s.gridVersion + 1,
      cameraCommand: { type: 'reset', nonce: Date.now() },
    }));
  },

  exportSnapshot: () => {
    const s = get();
    return {
      cityName: s.cityName,
      day: s.day,
      month: s.month,
      year: s.year,
      hourOfDay: s.hourOfDay,
      developmentLevel: s.developmentLevel,
      hadDebtBefore: s.hadDebtBefore,
      tiles: s.tiles,
      citizens: s.citizens,
      economy: s.economy,
      indicators: s.indicators,
      politics: s.politics,
      news: s.news,
      achievements: s.achievements,
      decisionLogs: s.decisionLogs,
      endGameReport: s.endGameReport,
    };
  },

  importSnapshot: (snapshot) => {
    const hydrated = hydrateFromSnapshot(snapshot);
    if (!hydrated) return false;
    set((s) => ({
      ...hydrated,
      selectedTileCoords: null,
      selectedCitizenId: null,
      followedCitizenId: null,
      gridVersion: s.gridVersion + 1,
      cameraCommand: { type: 'reset', nonce: Date.now() },
    }));
    saveCityLocal(get().exportSnapshot());
    return true;
  },
}));
