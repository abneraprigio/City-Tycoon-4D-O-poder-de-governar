import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Hammer,
  Landmark,
  Move,
  MousePointer,
  RotateCw,
  Trash2,
} from 'lucide-react';
import {
  BUILDING_CATALOG,
  BuildingCategory,
  DEVELOPMENT_LEVELS,
} from '../types/game';
import { useGameStore } from '../store/useGameStore';
import { getBuildingThumbnails } from '../engine/buildingThumbnails';

const CATEGORIES: { id: BuildingCategory; label: string }[] = [
  { id: 'infra', label: 'Vias e Redes' },
  { id: 'residential', label: 'Residencial' },
  { id: 'commercial', label: 'Comercial' },
  { id: 'industrial', label: 'Industrial' },
  { id: 'public', label: 'Serviços Públicos' },
  { id: 'leisure', label: 'Lazer e Urbanismo' },
];

export const BottomBuildDock: React.FC = () => {
  const [expanded, setExpanded] = useState(true);
  const [category, setCategory] = useState<BuildingCategory>('residential');

  const zenMode = useGameStore((s) => s.zenMode);
  const activeTool = useGameStore((s) => s.activeTool);
  const selectedBuildType = useGameStore((s) => s.selectedBuildType);
  const developmentLevel = useGameStore((s) => s.developmentLevel);
  const setActiveTool = useGameStore((s) => s.setActiveTool);
  const rotateBuildPreview = useGameStore((s) => s.rotateBuildPreview);

  const thumbnails = useMemo(() => getBuildingThumbnails(), []);

  if (zenMode) return null;

  const items = Object.values(BUILDING_CATALOG).filter((b) => b.category === category);

  return (
    <div className="fixed bottom-11 left-1/2 -translate-x-1/2 z-20 max-w-[min(92vw,840px)] w-auto pointer-events-none flex flex-col items-center">
      {/* Compact Strategy Build Strip */}
      {expanded && (
        <div className="pointer-events-auto w-full bg-slate-950/94 border border-slate-800 rounded-t-lg shadow-2xl overflow-hidden">
          {/* Category Tabs & Utility Tools */}
          <div className="px-2.5 py-1.5 border-b border-slate-800 flex items-center justify-between gap-2 overflow-x-auto hud-scroll">
            <div className="flex items-center gap-1 shrink-0">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap ${
                    category === cat.id
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 shrink-0 pl-2 border-l border-slate-800">
              <button
                onClick={() => setActiveTool('select', null)}
                title="Inspecionar (Esc)"
                className={`p-1.5 rounded text-[11px] transition-colors ${
                  activeTool === 'select'
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-900 text-slate-300 hover:text-white'
                }`}
              >
                <MousePointer className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setActiveTool('move', null)}
                title="Mover Construção"
                className={`p-1.5 rounded text-[11px] transition-colors ${
                  activeTool === 'move'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-900 text-slate-300 hover:text-white'
                }`}
              >
                <Move className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setActiveTool('demolish', null)}
                title="Demolir"
                className={`p-1.5 rounded text-[11px] transition-colors ${
                  activeTool === 'demolish'
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-900 text-slate-300 hover:text-white'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setActiveTool('buy_land', null)}
                title="Comprar Terreno"
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap ${
                  activeTool === 'buy_land'
                    ? 'bg-emerald-500 text-slate-950 font-semibold'
                    : 'bg-slate-900 text-slate-300 hover:text-white'
                }`}
              >
                <Landmark className="w-3 h-3 inline mr-1" />
                Lote
              </button>
              {activeTool === 'build' && (
                <button
                  onClick={rotateBuildPreview}
                  title="Girar Edificação (R)"
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] font-medium whitespace-nowrap"
                >
                  <RotateCw className="w-3 h-3 inline mr-1" />
                  Girar
                </button>
              )}
              <button
                onClick={() => setExpanded(false)}
                title="Recolher menu de obras"
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Building Miniatures Strip */}
          <div className="px-2.5 py-2 flex items-stretch gap-2 overflow-x-auto hud-scroll">
            {items.map((b) => {
              const locked = developmentLevel < b.unlockLevel;
              const isSelected = activeTool === 'build' && selectedBuildType === b.id;
              const reqLevel = DEVELOPMENT_LEVELS.find((l) => l.level === b.unlockLevel);
              const thumb = thumbnails[b.id];

              return (
                <button
                  key={b.id}
                  disabled={locked}
                  onClick={() => setActiveTool('build', b.id)}
                  title={`${b.name} — ${b.description}`}
                  className={`shrink-0 w-32 rounded border p-1.5 text-left transition-colors flex flex-col justify-between ${
                    locked
                      ? 'bg-slate-900/45 border-slate-800/70 opacity-50 cursor-not-allowed'
                      : isSelected
                      ? 'bg-amber-500/15 border-amber-400'
                      : 'bg-slate-900/90 border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-11 h-11 rounded bg-slate-950 border border-slate-800 shrink-0 overflow-hidden flex items-center justify-center">
                      {thumb ? (
                        <img src={thumb} alt={b.name} className="w-full h-full object-contain" />
                      ) : (
                        <Hammer className="w-4 h-4 text-slate-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-slate-100 leading-tight line-clamp-2">
                        {b.name}
                      </div>
                      <div className="font-mono-num text-[10px] font-semibold text-emerald-400 mt-0.5">
                        R$ {b.cost.toLocaleString('pt-BR')}
                      </div>
                    </div>
                  </div>

                  <div className="mt-1 pt-1 border-t border-slate-800/80 text-[10px] text-slate-400 font-mono-num truncate">
                    {locked
                      ? `Nível ${b.unlockLevel} (${reqLevel?.name})`
                      : b.housingCapacity > 0
                      ? `+${b.housingCapacity} moradias`
                      : b.jobsProvided > 0
                      ? `+${b.jobsProvided} vagas`
                      : b.powerProvided > 0
                      ? `+${b.powerProvided} energia`
                      : b.waterProvided > 0
                      ? `+${b.waterProvided} água`
                      : b.happinessBonus > 0
                      ? `+${b.happinessBonus} lazer`
                      : b.isRoad
                      ? 'Via conectada'
                      : 'Serviço urbano'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="pointer-events-auto flex items-center gap-2 px-4 py-1 rounded-t-lg bg-slate-950/94 border border-b-0 border-slate-800 text-xs font-semibold text-amber-400 hover:text-amber-300 shadow-lg"
        >
          <Hammer className="w-3.5 h-3.5" />
          <span>Obras e Construção</span>
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
