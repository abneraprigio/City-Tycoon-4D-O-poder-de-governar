import React, { useEffect } from 'react';
import {
  AlertTriangle,
  Compass,
  Move,
  Newspaper,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useGameStore } from '../store/useGameStore';

export const BottomTicker: React.FC = () => {
  const news = useGameStore((s) => s.news);
  const indicators = useGameStore((s) => s.indicators);
  const impeachment = useGameStore((s) => s.politics.impeachment);
  const tiles = useGameStore((s) => s.tiles);
  const zenMode = useGameStore((s) => s.zenMode);
  const toast = useGameStore((s) => s.toast);
  const activeTool = useGameStore((s) => s.activeTool);
  const selectedBuildType = useGameStore((s) => s.selectedBuildType);

  const sendCameraCommand = useGameStore((s) => s.sendCameraCommand);
  const setShowNewspaperModal = useGameStore((s) => s.setShowNewspaperModal);
  const rotateBuildPreview = useGameStore((s) => s.rotateBuildPreview);
  const setActiveTool = useGameStore((s) => s.setActiveTool);
  const clearToast = useGameStore((s) => s.clearToast);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => clearToast(), 3800);
    return () => clearTimeout(t);
  }, [toast, clearToast]);

  if (zenMode) return null;

  const latestNews = news[0];
  const conflictCount = tiles.filter((t) => t.conflict !== null).length;

  const demands: string[] = [];
  if (indicators.housingDeficit > 10) demands.push(`Déficit de ${indicators.housingDeficit} moradias`);
  if (indicators.unemploymentRate > 12) demands.push(`Desemprego em ${indicators.unemploymentRate}%`);
  if (indicators.safety < 50) demands.push('Reforçar segurança');
  if (indicators.health < 50) demands.push('Ampliar saúde');
  if (conflictCount > 0) demands.push(`${conflictCount} conflito(s) fundiário(s)`);
  if (impeachment.active) demands.push(`Impeachment: Etapa ${impeachment.stage}/4`);

  return (
    <>
      {/* Toast Feedback Banner */}
      {toast && (
        <div
          className={`fixed bottom-14 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-lg border text-xs font-medium shadow-lg pointer-events-auto ${
            toast.tone === 'error'
              ? 'bg-rose-950/95 border-rose-700 text-rose-200'
              : toast.tone === 'warning'
              ? 'bg-amber-950/95 border-amber-700 text-amber-200'
              : toast.tone === 'success'
              ? 'bg-emerald-950/95 border-emerald-700 text-emerald-200'
              : 'bg-slate-900/95 border-slate-700 text-slate-200'
          }`}
        >
          {toast.text}
        </div>
      )}

      {/* Active Build / Tool Hint */}
      {activeTool !== 'select' && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-3.5 py-1.5 rounded-lg bg-slate-950/92 border border-amber-500/60 text-xs text-slate-100 pointer-events-auto">
          <span>
            Modo:{' '}
            <strong className="text-amber-400">
              {activeTool === 'build'
                ? `Construir (${selectedBuildType})`
                : activeTool === 'move'
                ? 'Mover Construção'
                : activeTool === 'demolish'
                ? 'Demolir'
                : activeTool === 'buy_land'
                ? 'Comprar Terreno'
                : 'Vender Terreno'}
            </strong>
          </span>
          {activeTool === 'build' && (
            <button
              onClick={rotateBuildPreview}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            >
              Girar (R)
            </button>
          )}
          <button
            onClick={() => setActiveTool('select', null)}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            Cancelar (Esc)
          </button>
        </div>
      )}

      {/* Bottom Compact Strategy Bar */}
      <footer className="fixed bottom-0 left-0 right-0 z-20 pointer-events-auto bg-slate-950/92 border-t border-slate-800 px-4 py-1.5 flex items-center justify-between gap-4 text-xs">
        {/* Cidade News Headline */}
        <button
          onClick={() => setShowNewspaperModal(true)}
          className="flex items-center gap-2 text-left min-w-0 hover:text-amber-300 transition-colors"
        >
          <Newspaper className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="font-semibold text-amber-400 shrink-0">Cidade News:</span>
          <span className="text-slate-200 truncate">
            {latestNews ? latestNews.headline : 'Acompanhe as notícias da cidade.'}
          </span>
        </button>

        {/* Population Demands & Alerts */}
        <div className="hidden lg:flex items-center gap-2 shrink-0 text-slate-300">
          {demands.length > 0 ? (
            <>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-amber-200 truncate max-w-sm">{demands.join(' · ')}</span>
            </>
          ) : (
            <span className="text-emerald-400">Serviços urbanos operando em equilíbrio</span>
          )}
        </div>

        {/* Camera Navigation Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="hidden sm:inline text-slate-500 mr-1.5">WASD mover · Arraste girar</span>
          <button
            onClick={() => sendCameraCommand({ type: 'rotate_left' })}
            title="Girar câmera à esquerda"
            className="p-1.5 rounded bg-slate-900 border border-slate-800 hover:border-slate-600 text-slate-300 hover:text-white"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => sendCameraCommand({ type: 'rotate_right' })}
            title="Girar câmera à direita"
            className="p-1.5 rounded bg-slate-900 border border-slate-800 hover:border-slate-600 text-slate-300 hover:text-white"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => sendCameraCommand({ type: 'zoom_in' })}
            title="Aproximar"
            className="p-1.5 rounded bg-slate-900 border border-slate-800 hover:border-slate-600 text-slate-300 hover:text-white"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => sendCameraCommand({ type: 'zoom_out' })}
            title="Afastar"
            className="p-1.5 rounded bg-slate-900 border border-slate-800 hover:border-slate-600 text-slate-300 hover:text-white"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => sendCameraCommand({ type: 'tilt_up' })}
            title="Elevar ângulo"
            className="px-2 py-1 rounded bg-slate-900 border border-slate-800 hover:border-slate-600 text-slate-300 hover:text-white"
          >
            <Move className="w-3 h-3 inline mr-1" />
            Ângulo+
          </button>
          <button
            onClick={() => sendCameraCommand({ type: 'reset' })}
            title="Centralizar cidade"
            className="px-2 py-1 rounded bg-slate-900 border border-slate-800 hover:border-slate-600 text-slate-300 hover:text-white"
          >
            <Compass className="w-3 h-3 inline mr-1" />
            Centro
          </button>
        </div>
      </footer>
    </>
  );
};
