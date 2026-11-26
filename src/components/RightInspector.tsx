import React from 'react';
import {
  ArrowUpCircle,
  Camera,
  Gavel,
  Move,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { BUILDING_CATALOG } from '../types/game';
import { useGameStore } from '../store/useGameStore';
import { getTile } from '../simulation/tickEngine';

const STATE_LABELS: Record<string, string> = {
  idle: 'Em descanso',
  commuting: 'Em deslocamento',
  working: 'Trabalhando',
  studying: 'Na escola / curso',
  shopping: 'No comércio local',
  seeking_job: 'Procurando emprego',
  seeking_home: 'Buscando moradia',
  protesting: 'Participando de manifestação',
};

const TERRAIN_LABELS: Record<string, string> = {
  grass: 'Planície Urbana',
  fertile: 'Solo Fértil',
  waterfront: 'Orla Marítima / Fluvial',
  hill: 'Colina Residencial',
};

export const RightInspector: React.FC = () => {
  const zenMode = useGameStore((s) => s.zenMode);
  const tiles = useGameStore((s) => s.tiles);
  const citizens = useGameStore((s) => s.citizens);
  const selectedTileCoords = useGameStore((s) => s.selectedTileCoords);
  const selectedCitizenId = useGameStore((s) => s.selectedCitizenId);
  const followedCitizenId = useGameStore((s) => s.followedCitizenId);

  const selectCitizen = useGameStore((s) => s.selectCitizen);
  const followCitizen = useGameStore((s) => s.followCitizen);
  const upgradeBuilding = useGameStore((s) => s.upgradeBuilding);
  const startMoveBuilding = useGameStore((s) => s.startMoveBuilding);
  const demolishAt = useGameStore((s) => s.demolishAt);
  const buyLand = useGameStore((s) => s.buyLand);
  const sellLand = useGameStore((s) => s.sellLand);
  const grantConcession = useGameStore((s) => s.grantConcession);
  const togglePlannedDistrict = useGameStore((s) => s.togglePlannedDistrict);
  const openAuction = useGameStore((s) => s.openAuction);
  const resolveLandConflict = useGameStore((s) => s.resolveLandConflict);

  if (zenMode) return null;

  const citizen = selectedCitizenId ? citizens.find((c) => c.id === selectedCitizenId) : null;
  const tile = selectedTileCoords ? getTile(tiles, selectedTileCoords.x, selectedTileCoords.z) : null;

  if (!citizen && !tile) return null;

  return (
    <aside className="fixed top-14 right-3 bottom-12 z-20 w-80 pointer-events-none flex flex-col justify-start">
      <div className="pointer-events-auto max-h-full bg-slate-950/94 border border-slate-800 rounded-lg shadow-2xl flex flex-col overflow-hidden">
        {citizen ? (
          <>
            <div className="px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-sky-400" />
                <h2 className="font-display text-sm font-semibold text-white truncate">
                  {citizen.name}
                </h2>
              </div>
              <button
                onClick={() => {
                  followCitizen(null);
                  selectCitizen(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 overflow-y-auto hud-scroll space-y-3 text-xs">
              <div className="bg-slate-900 border border-slate-800 rounded p-2.5 text-slate-200 italic">
                &ldquo;{citizen.thought}&rdquo;
              </div>

              <button
                onClick={() =>
                  followCitizen(followedCitizenId === citizen.id ? null : citizen.id)
                }
                className={`w-full flex items-center justify-center gap-2 py-2 rounded font-semibold transition-colors ${
                  followedCitizenId === citizen.id
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-sky-600 hover:bg-sky-500 text-white'
                }`}
              >
                <Camera className="w-4 h-4" />
                <span>
                  {followedCitizenId === citizen.id
                    ? 'Deixar de Acompanhar'
                    : 'Acompanhar pela Cidade'}
                </span>
              </button>

              <div className="space-y-1.5 bg-slate-900 border border-slate-800 rounded p-2.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Situação Atual:</span>
                  <span className="text-amber-300 font-medium">
                    {STATE_LABELS[citizen.state] || citizen.state}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Idade:</span>
                  <span className="font-mono-num">{citizen.age} anos</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Profissão:</span>
                  <span>{citizen.profession}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Escolaridade:</span>
                  <span>{citizen.education}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Renda Mensal:</span>
                  <span className="font-mono-num text-emerald-400">
                    R$ {citizen.income.toLocaleString('pt-BR')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Emprego:</span>
                  <span>{citizen.employedAtName || 'Desempregado(a)'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Residência:</span>
                  <span className="font-mono-num">
                    {citizen.homeTileKey ? `Lote (${citizen.homeTileKey})` : 'Sem moradia fixa'}
                  </span>
                </div>
              </div>

              <div className="space-y-2 bg-slate-900 border border-slate-800 rounded p-2.5">
                <div className="font-semibold text-slate-200">Necessidades e Opinião</div>
                {(
                  [
                    ['Felicidade Geral', citizen.happiness],
                    ['Opinião sobre Prefeitura', citizen.opinion],
                    ['Saúde', citizen.health],
                    ['Moradia', citizen.needs.housing],
                    ['Emprego', citizen.needs.job],
                    ['Segurança do Bairro', citizen.needs.safety],
                  ] as const
                ).map(([label, val]) => (
                  <div key={label} className="space-y-0.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">{label}</span>
                      <span className="font-mono-num text-slate-200">{val}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded overflow-hidden">
                      <div
                        className={`h-full ${
                          val >= 65 ? 'bg-emerald-500' : val >= 40 ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, val))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : tile ? (
          <>
            <div className="px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-amber-400">
                Terreno ({tile.x}, {tile.z})
              </h2>
              <button
                onClick={() => useGameStore.setState({ selectedTileCoords: null })}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 overflow-y-auto hud-scroll space-y-3 text-xs">
              {/* Tile Land Info */}
              <div className="bg-slate-900 border border-slate-800 rounded p-2.5 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Geografia:</span>
                  <span className="text-slate-200">{TERRAIN_LABELS[tile.terrain]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Titularidade:</span>
                  <span className="text-slate-100 font-medium">{tile.ownerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Valor Imobiliário:</span>
                  <span className="font-mono-num text-emerald-400 font-semibold">
                    R$ {tile.landValue.toLocaleString('pt-BR')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Infraestrutura:</span>
                  <span className="text-slate-200">
                    {tile.hasPower ? 'Energia OK' : 'Sem Energia'} · {tile.hasWater ? 'Água OK' : 'Sem Água'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Segurança / Poluição:</span>
                  <span className="font-mono-num">
                    {tile.safetyCoverage}% / {tile.pollution}
                  </span>
                </div>
              </div>

              {/* Building Details */}
              {tile.building && (
                <div className="bg-slate-900 border border-slate-800 rounded p-2.5 space-y-2">
                  {(() => {
                    const b = tile.building!;
                    const def = BUILDING_CATALOG[b.type];
                    const upgradeCost = Math.round(def.cost * 0.75 * b.level);
                    return (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white">{def.name}</span>
                          <span className="font-mono-num text-amber-400">Nível {b.level}/3</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {b.powered && b.watered && b.connectedRoad
                            ? 'Operando normalmente'
                            : `Pendências: ${!b.powered ? 'Energia ' : ''}${!b.watered ? 'Água ' : ''}${!b.connectedRoad ? 'Via' : ''}`}
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span>Capacidade:</span>
                          <span className="font-mono-num text-slate-200">
                            {def.housingCapacity > 0 ? `${def.housingCapacity} moradias` : `${def.jobsProvided} vagas`}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 pt-1">
                          <button
                            disabled={b.level >= 3}
                            onClick={() => upgradeBuilding(tile.x, tile.z)}
                            className="flex flex-col items-center p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-[11px]"
                          >
                            <ArrowUpCircle className="w-3.5 h-3.5 text-emerald-400 mb-0.5" />
                            <span>{b.level >= 3 ? 'Máx' : `R$ ${(upgradeCost / 1000).toFixed(0)}k`}</span>
                          </button>
                          <button
                            onClick={() => startMoveBuilding(tile.x, tile.z)}
                            className="flex flex-col items-center p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px]"
                          >
                            <Move className="w-3.5 h-3.5 text-sky-400 mb-0.5" />
                            <span>Mover</span>
                          </button>
                          <button
                            onClick={() => demolishAt(tile.x, tile.z)}
                            className="flex flex-col items-center p-1.5 rounded bg-slate-800 hover:bg-rose-900/70 text-[11px]"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-400 mb-0.5" />
                            <span>Demolir</span>
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Land Conflict Resolution */}
              {tile.conflict && (
                <div className="bg-amber-950/60 border border-amber-700 rounded p-2.5 space-y-2">
                  <div className="font-semibold text-amber-300">{tile.conflict.title}</div>
                  <p className="text-[11px] text-amber-100/90">
                    Representação: {tile.conflict.groupName} · Ativo há {tile.conflict.daysActive} dias.
                  </p>
                  <div className="space-y-1">
                    <button
                      onClick={() => resolveLandConflict(tile.x, tile.z, 'mediate')}
                      className="w-full py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                    >
                      Mediar e Regularizar (R$ 45.000)
                    </button>
                    <button
                      onClick={() => resolveLandConflict(tile.x, tile.z, 'housing')}
                      className="w-full py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-medium"
                    >
                      Construir Moradia Popular (R$ 95.000)
                    </button>
                    <button
                      onClick={() => resolveLandConflict(tile.x, tile.z, 'legal')}
                      className="w-full py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium"
                    >
                      Encaminhar à Justiça (R$ 15.000)
                    </button>
                  </div>
                </div>
              )}

              {/* Banco Imobiliário Actions */}
              {!tile.building && tile.road === 'none' && !tile.conflict && (
                <div className="bg-slate-900 border border-slate-800 rounded p-2.5 space-y-1.5">
                  <div className="font-semibold text-slate-200">Operações Imobiliárias</div>
                  {tile.ownerType !== 'public' ? (
                    <button
                      onClick={() => buyLand(tile.x, tile.z)}
                      className="w-full py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                    >
                      Comprar Terreno (R$ {tile.landValue.toLocaleString('pt-BR')})
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => sellLand(tile.x, tile.z)}
                        className="w-full py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold"
                      >
                        Vender Lote (+R$ {Math.round(tile.landValue * 1.15).toLocaleString('pt-BR')})
                      </button>
                      <button
                        onClick={() => openAuction(tile.x, tile.z)}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-medium"
                      >
                        <Gavel className="w-3.5 h-3.5" />
                        <span>Realizar Leilão Imobiliário</span>
                      </button>
                      <button
                        onClick={() => grantConcession(tile.x, tile.z)}
                        className="w-full py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium"
                      >
                        Conceder p/ Empreendimento (+R$ {Math.round(tile.landValue * 0.45).toLocaleString('pt-BR')})
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => togglePlannedDistrict(tile.x, tile.z)}
                    className="w-full py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium"
                  >
                    {tile.plannedDistrict ? 'Setor Bairro Planejado Ativo' : 'Declarar Bairro Planejado (R$ 25.000)'}
                  </button>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </aside>
  );
};
