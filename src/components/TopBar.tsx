import React from 'react';
import {
  Camera,
  Cloud,
  Eye,
  EyeOff,
  FastForward,
  Moon,
  Newspaper,
  Pause,
  Play,
  Sliders,
  Sun,
} from 'lucide-react';
import { DEVELOPMENT_LEVELS } from '../types/game';
import { useGameStore } from '../store/useGameStore';

const MONTH_NAMES = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

function getDayPhaseLabel(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  if (h < 5) return 'Madrugada';
  if (h < 7) return 'Amanhecer';
  if (h < 11) return 'Manhã';
  if (h < 15) return 'Meio-dia';
  if (h < 18.5) return 'Entardecer';
  if (h < 21) return 'Anoitecer';
  return 'Madrugada';
}

export const TopBar: React.FC = () => {
  const cityName = useGameStore((s) => s.cityName);
  const treasury = useGameStore((s) => s.economy.treasury);
  const debt = useGameStore((s) => s.economy.debt);
  const monthlyNet = useGameStore((s) => s.economy.lastMonthlyNet);
  const population = useGameStore((s) => s.indicators.population);
  const popularity = useGameStore((s) => s.indicators.popularity);
  const developmentLevel = useGameStore((s) => s.developmentLevel);
  const day = useGameStore((s) => s.day);
  const month = useGameStore((s) => s.month);
  const year = useGameStore((s) => s.year);
  const hourOfDay = useGameStore((s) => s.hourOfDay);
  const speed = useGameStore((s) => s.speed);
  const zenMode = useGameStore((s) => s.zenMode);
  const cameraMode = useGameStore((s) => s.cameraMode);
  const graphicsQuality = useGameStore((s) => s.graphicsQuality);

  const setSpeed = useGameStore((s) => s.setSpeed);
  const toggleZenMode = useGameStore((s) => s.toggleZenMode);
  const setShowNewspaperModal = useGameStore((s) => s.setShowNewspaperModal);
  const setShowCloudModal = useGameStore((s) => s.setShowCloudModal);
  const setShowSettingsModal = useGameStore((s) => s.setShowSettingsModal);
  const setCameraMode = useGameStore((s) => s.setCameraMode);

  const levelInfo = DEVELOPMENT_LEVELS.find((d) => d.level === developmentLevel) || DEVELOPMENT_LEVELS[0];
  const isNight = hourOfDay < 5.8 || hourOfDay >= 18.8;
  const hh = String(Math.floor(hourOfDay)).padStart(2, '0');
  const mm = String(Math.floor((hourOfDay % 1) * 60)).padStart(2, '0');
  const phaseLabel = getDayPhaseLabel(hourOfDay);

  if (zenMode) {
    return (
      <div className="fixed top-3 right-3 z-20 pointer-events-auto">
        <button
          onClick={toggleZenMode}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-950/92 border border-slate-700 text-xs font-medium text-slate-200 hover:text-amber-400 transition-colors"
        >
          <Eye className="w-4 h-4" />
          <span>Exibir Controles (H)</span>
        </button>
      </div>
    );
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-20 pointer-events-auto bg-slate-950/94 border-b border-slate-800 px-3.5 py-1.5 flex items-center justify-between gap-3 overflow-x-auto">
      {/* Brand & City Rank */}
      <div className="flex items-center gap-2.5 shrink-0">
        <span className="font-display font-bold text-sm tracking-wide text-amber-400 whitespace-nowrap">
          CITY TYCOON 4D
        </span>
        <span className="text-slate-700" aria-hidden="true">|</span>
        <div className="flex items-center gap-1.5 text-xs text-slate-300 whitespace-nowrap">
          <span className="font-semibold text-white">{cityName}</span>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <span className="text-slate-400">Nv.{levelInfo.level} {levelInfo.name}</span>
        </div>
      </div>

      {/* Live Municipal Telemetry */}
      <div className="flex items-center gap-4 shrink-0 text-xs">
        <div>
          <span className="text-slate-400 mr-1">Caixa:</span>
          <span className="font-mono-num font-semibold text-emerald-400">
            R$ {treasury.toLocaleString('pt-BR')}
          </span>
          {debt > 0 && (
            <span className="font-mono-num text-rose-400 ml-1">
              (Dív. R$ {debt.toLocaleString('pt-BR')})
            </span>
          )}
        </div>

        <div>
          <span className="text-slate-400 mr-1">Mensal:</span>
          <span
            className={`font-mono-num font-semibold ${
              monthlyNet >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {monthlyNet >= 0 ? '+' : ''}R$ {monthlyNet.toLocaleString('pt-BR')}
          </span>
        </div>

        <div>
          <span className="text-slate-400 mr-1">Pop:</span>
          <span className="font-mono-num font-semibold text-slate-100">
            {population.toLocaleString('pt-BR')}
          </span>
        </div>

        <div>
          <span className="text-slate-400 mr-1">Aprov.:</span>
          <span
            className={`font-mono-num font-semibold ${
              popularity >= 60 ? 'text-sky-400' : popularity >= 38 ? 'text-amber-400' : 'text-rose-400'
            }`}
          >
            {popularity}%
          </span>
        </div>
      </div>

      {/* 4D Time, Camera Modes, Graphics & Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono-num whitespace-nowrap">
          {isNight ? (
            <Moon className="w-3.5 h-3.5 text-sky-300" />
          ) : (
            <Sun className="w-3.5 h-3.5 text-amber-400" />
          )}
          <span>
            D{day} · {MONTH_NAMES[(month - 1) % 12]} · A{year} · {hh}:{mm}
          </span>
          <span className="hidden xl:inline text-slate-400 font-sans text-[11px]">
            ({phaseLabel})
          </span>
        </div>

        {/* Simulation Speed */}
        <div className="flex items-center bg-slate-900 border border-slate-700 rounded p-0.5">
          <button
            onClick={() => setSpeed(0)}
            title="Pausar simulação"
            className={`px-1.5 py-1 text-xs rounded transition-colors ${
              speed === 0 ? 'bg-amber-500 text-slate-950 font-semibold' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Pause className="w-3.5 h-3.5" />
          </button>
          {([1, 2, 4, 8] as const).map((spd) => (
            <button
              key={spd}
              onClick={() => setSpeed(spd)}
              className={`px-1.5 py-1 text-[11px] font-mono-num rounded transition-colors whitespace-nowrap ${
                speed === spd
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {spd === 1 ? <Play className="w-3 h-3 inline mr-0.5" /> : <FastForward className="w-3 h-3 inline mr-0.5" />}
              {spd}x
            </button>
          ))}
        </div>

        {/* Camera Mode Switcher */}
        <div className="flex items-center bg-slate-900 border border-slate-700 rounded p-0.5">
          <button
            onClick={() => setCameraMode('strategic')}
            title="Câmera Aérea Estratégica"
            className={`px-2 py-1 text-[11px] rounded transition-colors whitespace-nowrap ${
              cameraMode === 'strategic'
                ? 'bg-sky-600 text-white font-semibold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Camera className="w-3 h-3 inline mr-1" />
            Aéreo
          </button>
          <button
            onClick={() => setCameraMode('drone')}
            title="Modo Drone Cinematográfico (Tecla M)"
            className={`px-2 py-1 text-[11px] rounded transition-colors whitespace-nowrap ${
              cameraMode === 'drone'
                ? 'bg-sky-600 text-white font-semibold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Drone
          </button>
        </div>

        <button
          onClick={() => setShowSettingsModal(true)}
          title={`Qualidade Gráfica (${graphicsQuality.toUpperCase()})`}
          className="flex items-center gap-1 px-2 py-1.5 rounded bg-slate-900 border border-slate-700 hover:border-amber-500/60 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap"
        >
          <Sliders className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden md:inline">Gráficos</span>
        </button>

        <button
          onClick={() => setShowNewspaperModal(true)}
          className="flex items-center gap-1 px-2 py-1.5 rounded bg-slate-900 border border-slate-700 hover:border-amber-500/60 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap"
        >
          <Newspaper className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden lg:inline">Jornal</span>
        </button>

        <button
          onClick={() => setShowCloudModal(true)}
          className="flex items-center gap-1 px-2 py-1.5 rounded bg-slate-900 border border-slate-700 hover:border-sky-500/60 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap"
        >
          <Cloud className="w-3.5 h-3.5 text-sky-400" />
          <span className="hidden sm:inline">Salvar</span>
        </button>

        <button
          onClick={toggleZenMode}
          title="Modo Cinema / Ocultar Interface (Tecla H)"
          className="p-1.5 rounded bg-slate-900 border border-slate-700 text-slate-300 hover:text-white transition-colors"
        >
          <EyeOff className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
