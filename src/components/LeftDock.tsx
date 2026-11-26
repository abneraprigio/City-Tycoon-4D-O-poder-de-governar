import React, { useMemo, useState } from 'react';
import {
  Award,
  Building2,
  Landmark,
  Layers,
  MapPin,
  Move,
  MousePointer,
  Scale,
  Trash2,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import {
  BUILDING_CATALOG,
  BuildingCategory,
  DEVELOPMENT_LEVELS,
  ThematicMapMode,
} from '../types/game';
import { LeftTabId, useGameStore } from '../store/useGameStore';
import { getBuildingThumbnails } from '../engine/buildingThumbnails';

const BUILD_CATEGORIES: { id: BuildingCategory; label: string }[] = [
  { id: 'residential', label: 'Residencial' },
  { id: 'commercial', label: 'Comercial' },
  { id: 'industrial', label: 'Industrial' },
  { id: 'public', label: 'Serviços Públicos' },
  { id: 'leisure', label: 'Lazer e Urbanismo' },
];

const THEMATIC_LAYERS: { id: ThematicMapMode; label: string; hint: string }[] = [
  { id: 'normal', label: 'Mapa Normal', hint: 'Visualização realista padrão da cidade' },
  { id: 'landValue', label: 'Valor Imobiliário', hint: 'Verde = alta valorização · Vermelho = baixo valor' },
  { id: 'safety', label: 'Segurança Pública', hint: 'Cobertura de delegacias, iluminação e prevenção' },
  { id: 'traffic', label: 'Trânsito e Mobilidade', hint: 'Carga viária nas ruas e avenidas' },
  { id: 'pollution', label: 'Poluição Ambiental', hint: 'Impacto industrial e áreas verdes' },
  { id: 'health', label: 'Saúde', hint: 'Cobertura de UBS e hospitais' },
  { id: 'education', label: 'Educação', hint: 'Cobertura de escolas e centros técnicos' },
  { id: 'employment', label: 'Polos de Emprego', hint: 'Verde = lotes geradores de vagas' },
  { id: 'happiness', label: 'Felicidade e Lazer', hint: 'Acesso a praças, parques e esportes' },
  { id: 'coverage', label: 'Energia e Saneamento', hint: 'Azul = completo · Âmbar = parcial · Vermelho = sem rede' },
];

export const LeftDock: React.FC = () => {
  const [buildCategory, setBuildCategory] = useState<BuildingCategory>('residential');
  const thumbnails = useMemo(() => getBuildingThumbnails(), []);

  const zenMode = useGameStore((s) => s.zenMode);
  const activeLeftTab = useGameStore((s) => s.activeLeftTab);
  const activeTool = useGameStore((s) => s.activeTool);
  const selectedBuildType = useGameStore((s) => s.selectedBuildType);
  const developmentLevel = useGameStore((s) => s.developmentLevel);
  const economy = useGameStore((s) => s.economy);
  const indicators = useGameStore((s) => s.indicators);
  const politics = useGameStore((s) => s.politics);
  const tiles = useGameStore((s) => s.tiles);
  const thematicMode = useGameStore((s) => s.thematicMode);
  const achievements = useGameStore((s) => s.achievements);

  const setActiveLeftTab = useGameStore((s) => s.setActiveLeftTab);
  const setActiveTool = useGameStore((s) => s.setActiveTool);
  const setThematicMode = useGameStore((s) => s.setThematicMode);
  const updateTaxRates = useGameStore((s) => s.updateTaxRates);
  const updateBudgets = useGameStore((s) => s.updateBudgets);
  const proposeBill = useGameStore((s) => s.proposeBill);
  const negotiateCouncil = useGameStore((s) => s.negotiateCouncil);
  const resignMayor = useGameStore((s) => s.resignMayor);
  const sendCameraCommand = useGameStore((s) => s.sendCameraCommand);

  if (zenMode) return null;

  const navTabs: { id: LeftTabId; label: string; icon: React.ReactNode }[] = [
    { id: 'build', label: 'Construir', icon: <Building2 className="w-4 h-4" /> },
    { id: 'infra', label: 'Infra', icon: <Wrench className="w-4 h-4" /> },
    { id: 'realestate', label: 'Imóveis', icon: <Landmark className="w-4 h-4" /> },
    { id: 'economy', label: 'Economia', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'politics', label: 'Política', icon: <Scale className="w-4 h-4" /> },
    { id: 'layers', label: 'Mapas', icon: <Layers className="w-4 h-4" /> },
    { id: 'achievements', label: 'Metas', icon: <Award className="w-4 h-4" /> },
  ];

  const allBuildings = Object.values(BUILDING_CATALOG);
  const publicLots = tiles.filter((t) => t.ownerType === 'public').length;
  const privateLots = tiles.filter((t) => t.ownerType === 'private').length;
  const avgLandValue = Math.round(tiles.reduce((acc, t) => acc + t.landValue, 0) / tiles.length);

  return (
    <aside className="fixed top-12 left-3 bottom-11 z-20 flex items-start gap-2 pointer-events-none">
      {/* Vertical Icon Tool Rail */}
      <nav className="pointer-events-auto flex flex-col gap-1 bg-slate-950/92 border border-slate-800 rounded-lg p-1.5 shadow-xl">
        <button
          onClick={() => setActiveTool('select', null)}
          title="Selecionar terreno ou cidadão"
          className={`flex flex-col items-center justify-center w-14 py-2 rounded text-[11px] font-medium transition-colors ${
            activeTool === 'select'
              ? 'bg-amber-500 text-slate-950 font-semibold'
              : 'text-slate-300 hover:bg-slate-800/80'
          }`}
        >
          <MousePointer className="w-4 h-4 mb-0.5" />
          <span>Inspec.</span>
        </button>

        <div className="h-px bg-slate-800 my-0.5" />

        {navTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveLeftTab(tab.id)}
            className={`flex flex-col items-center justify-center w-14 py-2 rounded text-[11px] font-medium transition-colors ${
              activeLeftTab === tab.id
                ? 'bg-slate-800 text-amber-400 border border-amber-500/40'
                : 'text-slate-300 hover:bg-slate-800/70'
            }`}
          >
            {tab.icon}
            <span className="mt-0.5">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Expandable Context Drawer */}
      {activeLeftTab && (
        <div className="pointer-events-auto w-80 max-h-full bg-slate-950/94 border border-slate-800 rounded-lg shadow-2xl flex flex-col overflow-hidden">
          <div className="px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-amber-400">
              {navTabs.find((t) => t.id === activeLeftTab)?.label}
            </h2>
            <button
              onClick={() => setActiveLeftTab(null)}
              className="text-xs text-slate-400 hover:text-white px-1.5 py-0.5"
            >
              Fechar
            </button>
          </div>

          <div className="p-3 overflow-y-auto hud-scroll space-y-3 text-xs">
            {/* 1. CONSTRUÇÃO */}
            {activeLeftTab === 'build' && (
              <>
                <div className="grid grid-cols-2 gap-1 bg-slate-900 p-1 rounded border border-slate-800">
                  {BUILD_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setBuildCategory(cat.id)}
                      className={`px-2 py-1.5 rounded text-left text-[11px] font-medium transition-colors ${
                        buildCategory === cat.id
                          ? 'bg-amber-500 text-slate-950 font-semibold'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  {allBuildings
                    .filter((b) => b.category === buildCategory)
                    .map((b) => {
                      const locked = developmentLevel < b.unlockLevel;
                      const isSelected = activeTool === 'build' && selectedBuildType === b.id;
                      const reqLevel = DEVELOPMENT_LEVELS.find((l) => l.level === b.unlockLevel);
                      const thumb = thumbnails[b.id];
                      return (
                        <button
                          key={b.id}
                          disabled={locked}
                          onClick={() => setActiveTool('build', b.id)}
                          className={`w-full text-left p-2 rounded border transition-colors flex items-start gap-2.5 ${
                            locked
                              ? 'bg-slate-900/40 border-slate-800/70 opacity-55 cursor-not-allowed'
                              : isSelected
                              ? 'bg-amber-500/15 border-amber-400'
                              : 'bg-slate-900/80 border-slate-800 hover:border-slate-600'
                          }`}
                        >
                          {thumb && (
                            <img
                              src={thumb}
                              alt={b.name}
                              className="w-10 h-10 rounded bg-slate-950 border border-slate-800 shrink-0 object-contain mt-0.5"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-slate-100 truncate">{b.name}</span>
                              <span className="font-mono-num text-emerald-400 font-semibold shrink-0">
                                R$ {b.cost.toLocaleString('pt-BR')}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{b.description}</p>
                            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-300 font-mono-num">
                              {b.housingCapacity > 0 && <span>+{b.housingCapacity} moradias</span>}
                              {b.jobsProvided > 0 && <span>+{b.jobsProvided} vagas</span>}
                              {b.monthlyRevenue > 0 && (
                                <span className="text-sky-400">Rec. R$ {b.monthlyRevenue.toLocaleString('pt-BR')}</span>
                              )}
                              {locked && (
                                <span className="text-amber-400">
                                  Nv.{b.unlockLevel} ({reqLevel?.name})
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </>
            )}

            {/* 2. INFRAESTRUTURA & FERRAMENTAS */}
            {activeLeftTab === 'infra' && (
              <>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => setActiveTool('move', null)}
                    className={`flex items-center justify-center gap-1.5 p-2 rounded border font-medium ${
                      activeTool === 'move'
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-slate-900 border-slate-800 text-slate-200 hover:border-slate-600'
                    }`}
                  >
                    <Move className="w-3.5 h-3.5" />
                    <span>Mover Imóvel</span>
                  </button>
                  <button
                    onClick={() => setActiveTool('demolish', null)}
                    className={`flex items-center justify-center gap-1.5 p-2 rounded border font-medium ${
                      activeTool === 'demolish'
                        ? 'bg-rose-600 text-white border-rose-400'
                        : 'bg-slate-900 border-slate-800 text-slate-200 hover:border-slate-600'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Demolir</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {allBuildings
                    .filter((b) => b.category === 'infra')
                    .map((b) => {
                      const isSelected = activeTool === 'build' && selectedBuildType === b.id;
                      const thumb = thumbnails[b.id];
                      return (
                        <button
                          key={b.id}
                          onClick={() => setActiveTool('build', b.id)}
                          className={`w-full text-left p-2 rounded border transition-colors flex items-start gap-2.5 ${
                            isSelected
                              ? 'bg-amber-500/15 border-amber-400'
                              : 'bg-slate-900/80 border-slate-800 hover:border-slate-600'
                          }`}
                        >
                          {thumb && (
                            <img
                              src={thumb}
                              alt={b.name}
                              className="w-10 h-10 rounded bg-slate-950 border border-slate-800 shrink-0 object-contain mt-0.5"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-slate-100 truncate">{b.name}</span>
                              <span className="font-mono-num text-emerald-400 font-semibold shrink-0">
                                R$ {b.cost.toLocaleString('pt-BR')}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">{b.description}</p>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </>
            )}

            {/* 3. BANCO IMOBILIÁRIO */}
            {activeLeftTab === 'realestate' && (
              <>
                <div className="bg-slate-900 border border-slate-800 rounded p-2.5 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Valor médio do lote:</span>
                    <span className="font-mono-num text-amber-400 font-semibold">
                      R$ {avgLandValue.toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Terrenos públicos:</span>
                    <span className="font-mono-num text-slate-200">{publicLots} lotes</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Propriedades privadas:</span>
                    <span className="font-mono-num text-slate-200">{privateLots} lotes</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => setActiveTool('buy_land', null)}
                    className={`p-2 rounded border font-medium ${
                      activeTool === 'buy_land'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                        : 'bg-slate-900 border-slate-800 text-slate-200 hover:border-slate-600'
                    }`}
                  >
                    Comprar Lote
                  </button>
                  <button
                    onClick={() => setActiveTool('sell_land', null)}
                    className={`p-2 rounded border font-medium ${
                      activeTool === 'sell_land'
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-slate-900 border-slate-800 text-slate-200 hover:border-slate-600'
                    }`}
                  >
                    Vender Lote
                  </button>
                </div>

                <div className="border-t border-slate-800 pt-2.5 space-y-2">
                  <p className="text-slate-300 font-medium">Aproximar Regiões da Cidade</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { label: 'Centro Cívico', x: 11, z: 11 },
                      { label: 'Orla Sul', x: 12, z: 20 },
                      { label: 'Zona Norte', x: 12, z: 4 },
                      { label: 'Polo Leste', x: 19, z: 12 },
                    ].map((loc) => (
                      <button
                        key={loc.label}
                        onClick={() => sendCameraCommand({ type: 'focus_tile', x: loc.x, z: loc.z })}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 hover:border-amber-500/50 text-slate-200"
                      >
                        <MapPin className="w-3.5 h-3.5 text-amber-400" />
                        <span>{loc.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Selecione qualquer lote no mapa (modo Inspecionar) para realizar leilões imobiliários, conceder áreas para iniciativa privada ou declarar Bairro Planejado.
                </p>
              </>
            )}

            {/* 4. ECONOMIA & ORÇAMENTO */}
            {activeLeftTab === 'economy' && (
              <>
                <div className="space-y-2 bg-slate-900 border border-slate-800 rounded p-2.5">
                  <div className="font-semibold text-slate-200">Alíquotas Tributárias</div>
                  <label className="block space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span>IPTU (Imóveis)</span>
                      <span className="font-mono-num text-amber-400">{economy.iptuRate.toFixed(1)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={4.0}
                      step={0.1}
                      value={economy.iptuRate}
                      onChange={(e) => updateTaxRates({ iptuRate: Number(e.target.value) })}
                      className="w-full accent-amber-500"
                    />
                  </label>
                  <label className="block space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span>ISS (Serviços e Comércio)</span>
                      <span className="font-mono-num text-amber-400">{economy.issRate.toFixed(1)}%</span>
                    </div>
                    <input
                      type="range"
                      min={1.0}
                      max={6.0}
                      step={0.1}
                      value={economy.issRate}
                      onChange={(e) => updateTaxRates({ issRate: Number(e.target.value) })}
                      className="w-full accent-amber-500"
                    />
                  </label>
                  <label className="block space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span>ITBI (Transações Imobiliárias)</span>
                      <span className="font-mono-num text-amber-400">{economy.itbiRate.toFixed(1)}%</span>
                    </div>
                    <input
                      type="range"
                      min={1.0}
                      max={5.0}
                      step={0.1}
                      value={economy.itbiRate}
                      onChange={(e) => updateTaxRates({ itbiRate: Number(e.target.value) })}
                      className="w-full accent-amber-500"
                    />
                  </label>
                </div>

                <div className="space-y-2 bg-slate-900 border border-slate-800 rounded p-2.5">
                  <div className="font-semibold text-slate-200">Orçamento das Secretarias</div>
                  {(
                    [
                      ['budgetHealth', 'Saúde'],
                      ['budgetEducation', 'Educação'],
                      ['budgetSafety', 'Segurança Municipal'],
                      ['budgetTransit', 'Transporte e Vias'],
                      ['budgetSocial', 'Assistência Social'],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="block space-y-0.5">
                      <div className="flex justify-between text-[11px]">
                        <span>{label}</span>
                        <span className="font-mono-num text-sky-400">
                          {Math.round(economy[key] * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.5}
                        max={1.7}
                        step={0.1}
                        value={economy[key]}
                        onChange={(e) => updateBudgets({ [key]: Number(e.target.value) })}
                        className="w-full accent-sky-500"
                      />
                    </label>
                  ))}
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded p-2.5 space-y-1 text-[11px]">
                  <div className="font-semibold text-emerald-400">
                    Receitas (R$ {economy.lastMonthlyRevenue.toLocaleString('pt-BR')})
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>IPTU</span>
                    <span className="font-mono-num">R$ {economy.revenueBreakdown.iptu.toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>ISS</span>
                    <span className="font-mono-num">R$ {economy.revenueBreakdown.iss.toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>ITBI e Concessões</span>
                    <span className="font-mono-num">
                      R$ {(economy.revenueBreakdown.itbi + economy.revenueBreakdown.servicesAndConcessions).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Transferências</span>
                    <span className="font-mono-num">R$ {economy.revenueBreakdown.transfers.toLocaleString('pt-BR')}</span>
                  </div>

                  <div className="font-semibold text-rose-400 pt-2">
                    Despesas (R$ {economy.lastMonthlyExpense.toLocaleString('pt-BR')})
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Folha + Manutenção</span>
                    <span className="font-mono-num">R$ {economy.expenseBreakdown.payroll.toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Saúde e Educação</span>
                    <span className="font-mono-num">
                      R$ {(economy.expenseBreakdown.health + economy.expenseBreakdown.education).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Segurança, Vias e Social</span>
                    <span className="font-mono-num">
                      R$ {(economy.expenseBreakdown.safety + economy.expenseBreakdown.transitAndInfra + economy.expenseBreakdown.socialPrograms).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  {economy.expenseBreakdown.debtInterest > 0 && (
                    <div className="flex justify-between text-rose-300">
                      <span>Juros da Dívida</span>
                      <span className="font-mono-num">R$ {economy.expenseBreakdown.debtInterest.toLocaleString('pt-BR')}</span>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* 5. POLÍTICA & INDICADORES */}
            {activeLeftTab === 'politics' && (
              <>
                <div className="bg-slate-900 border border-slate-800 rounded p-2.5 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Prefeitura:</span>
                    <span className="font-semibold text-white">{politics.mayorName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Vice-Prefeitura:</span>
                    <span className="text-slate-200">{politics.viceMayorName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Apoio na Câmara:</span>
                    <span
                      className={`font-mono-num font-semibold ${
                        politics.councilSupport >= 50 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {politics.councilSupport}% ({politics.councilors.filter((c) => c.support >= 50).length}/11)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Próxima Eleição:</span>
                    <span className="font-mono-num text-amber-400">Dez / Ano {politics.nextElectionYear}</span>
                  </div>
                  <button
                    onClick={negotiateCouncil}
                    className="w-full mt-1 py-1.5 px-2.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-medium transition-colors"
                  >
                    Articular Apoio na Câmara (R$ 55.000)
                  </button>
                </div>

                {politics.impeachment.active && (
                  <div className="bg-rose-950/90 border border-rose-700 rounded p-2.5 space-y-1">
                    <div className="font-semibold text-rose-300">
                      Processo de Impeachment — Etapa {politics.impeachment.stage}/4
                    </div>
                    <p className="text-[11px] text-rose-200">{politics.impeachment.reason}</p>
                    <p className="text-[11px] text-amber-300">
                      Recupere apoio acima de 54% e popularidade acima de 42% para arquivar.
                    </p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="font-semibold text-slate-200">Projetos de Lei na Câmara</div>
                  {politics.bills.map((bill) => (
                    <div
                      key={bill.id}
                      className="p-2 rounded bg-slate-900 border border-slate-800 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-100">{bill.title}</span>
                        <span className="font-mono-num text-amber-400 shrink-0">
                          R$ {bill.cost.toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">{bill.description}</p>
                      {bill.status === 'available' ? (
                        <button
                          onClick={() => proposeBill(bill.id)}
                          className="w-full py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold transition-colors"
                        >
                          Enviar para Votação
                        </button>
                      ) : (
                        <div
                          className={`text-[11px] font-semibold ${
                            bill.status === 'approved' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {bill.status === 'approved' ? 'Aprovado e em vigor' : 'Rejeitado em plenário'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded p-2.5 space-y-1.5">
                  <div className="font-semibold text-slate-200">Indicadores da Cidade</div>
                  {(
                    [
                      ['Qualidade de Vida', indicators.qualityOfLife],
                      ['Segurança', indicators.safety],
                      ['Saúde', indicators.health],
                      ['Educação', indicators.education],
                      ['Habitação', indicators.housingIndex],
                      ['Mobilidade', indicators.mobility],
                      ['Desenv. Econômico', indicators.economicDevelopment],
                      ['Desemprego', `${indicators.unemploymentRate}%`],
                      ['Poluição', indicators.pollution],
                      ['Desigualdade', indicators.inequality],
                    ] as const
                  ).map(([lbl, val]) => (
                    <div key={lbl} className="flex justify-between text-[11px]">
                      <span className="text-slate-400">{lbl}</span>
                      <span className="font-mono-num text-slate-100">{val}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={resignMayor}
                  className="w-full py-2 rounded bg-slate-900 border border-rose-800/80 text-rose-300 hover:bg-rose-950 font-medium transition-colors"
                >
                  Renunciar ao Mandato
                </button>
              </>
            )}

            {/* 6. MAPAS TEMÁTICOS */}
            {activeLeftTab === 'layers' && (
              <div className="space-y-1.5">
                {THEMATIC_LAYERS.map((layer) => (
                  <button
                    key={layer.id}
                    onClick={() => setThematicMode(layer.id)}
                    className={`w-full text-left p-2.5 rounded border transition-colors ${
                      thematicMode === layer.id
                        ? 'bg-amber-500/15 border-amber-400'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className="font-semibold text-slate-100">{layer.label}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{layer.hint}</div>
                  </button>
                ))}
              </div>
            )}

            {/* 7. CONQUISTAS & PROGRESSÃO */}
            {activeLeftTab === 'achievements' && (
              <div className="space-y-2">
                <div className="bg-slate-900 border border-slate-800 rounded p-2.5 space-y-1">
                  <div className="font-semibold text-slate-200">Níveis Urbanos</div>
                  {DEVELOPMENT_LEVELS.map((lvl) => (
                    <div
                      key={lvl.level}
                      className={`flex justify-between text-[11px] ${
                        developmentLevel >= lvl.level ? 'text-emerald-400 font-medium' : 'text-slate-500'
                      }`}
                    >
                      <span>
                        {lvl.level}. {lvl.name}
                      </span>
                      <span className="font-mono-num">{lvl.minPop.toLocaleString('pt-BR')} hab.</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <div className="font-semibold text-slate-200">Conquistas</div>
                  {achievements.map((a) => (
                    <div
                      key={a.id}
                      className={`p-2 rounded border ${
                        a.unlocked
                          ? 'bg-emerald-950/50 border-emerald-700/70'
                          : 'bg-slate-900/70 border-slate-800'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className={`font-medium ${a.unlocked ? 'text-emerald-300' : 'text-slate-300'}`}>
                          {a.title}
                        </span>
                        {a.unlocked && (
                          <span className="text-[10px] font-mono-num text-emerald-400">
                            Ano {a.unlockedAtYear}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{a.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
