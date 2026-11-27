import React, { useMemo } from 'react';
import {
  ArrowUpCircle,
  Bus,
  Camera,
  Car,
  Gavel,
  Home,
  MapPin,
  Move,
  Route,
  Trash2,
  User,
  Users,
  Briefcase,
  X,
} from 'lucide-react';
import {
  BUILDING_CATALOG,
  BuildingLifecycleStage,
  CitizenBehaviorState,
  CitizenPersonality,
  CitizenScheduleProfile,
  ZoningType,
} from '../types/game';
import { useGameStore } from '../store/useGameStore';
import { getTile } from '../simulation/tickEngine';
import { getBuildingThumbnails } from '../engine/buildingThumbnails';
import { getNextCommitmentText } from '../simulation/agents/citizenSchedule';
import { getResidenceCapacity } from '../simulation/agents/householdEngine';

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

const BEHAVIOR_LABELS: Record<CitizenBehaviorState, string> = {
  Sleeping: 'Dormindo em casa',
  AtHome: 'Em casa',
  PreparingForWork: 'Preparando-se para sair',
  WalkingToDestination: 'Caminhando pela calçada',
  WaitingForTransport: 'Aguardando ônibus no ponto',
  RidingTransport: 'Viajando de ônibus',
  Driving: 'Dirigindo veículo',
  CrossingStreet: 'Atravessando faixa de pedestres',
  Working: 'Em expediente de trabalho',
  Studying: 'Em aula / formação',
  Shopping: 'Fazendo compras',
  Eating: 'Fazendo refeição',
  Exercising: 'Praticando exercício',
  Socializing: 'Conversando com vizinhos',
  SeekingJob: 'Procurando emprego',
  SeekingHome: 'Buscando moradia',
  ReceivingMedicalCare: 'Em atendimento médico',
  Protesting: 'Em manifestação cívica',
  ReturningHome: 'Retornando para casa',
  WaitingForPath: 'Recalculando rota urbana',
};

const PERSONALITY_LABELS: Record<CitizenPersonality, string> = {
  sociavel: 'Sociável',
  reservado: 'Reservado(a)',
  organizado: 'Organizado(a)',
  aventureiro: 'Aventureiro(a)',
  trabalhador: 'Trabalhador(a)',
  tranquilo: 'Tranquilo(a)',
  ambicioso: 'Ambicioso(a)',
  comunitario: 'Comunitário(a)',
};

const SCHEDULE_LABELS: Record<CitizenScheduleProfile, string> = {
  crianca: 'Criança',
  estudante: 'Estudante',
  universitario: 'Universitário(a)',
  clt: 'Comercial / CLT',
  comerciante: 'Comerciante',
  empresario: 'Empresário(a)',
  autonomo: 'Autônomo(a)',
  desempregado: 'Em busca de vaga',
  aposentado: 'Aposentado(a)',
  saude: 'Plantão de Saúde',
  servidor: 'Servidor Público',
};

const ZONE_LABELS: Record<ZoningType, string> = {
  none: 'Sem zoneamento',
  residential: 'Zona Residencial',
  commercial: 'Zona Comercial',
  industrial: 'Zona Industrial',
  mixed: 'Uso Misto',
  civic: 'Equipamento Cívico',
  green: 'Área Verde / Lazer',
};

const STAGE_LABELS: Record<BuildingLifecycleStage, string> = {
  planned: 'Planejado',
  construction_site: 'Canteiro de Obras',
  under_construction: 'Em Construção',
  operational: 'Operacional',
  remodeling: 'Em Reforma',
  abandoned: 'Abandonado',
};

const TERRAIN_LABELS: Record<string, string> = {
  grass: 'Planície Urbana',
  fertile: 'Solo Fértil',
  waterfront: 'Orla Marítima / Fluvial',
  hill: 'Colina Residencial',
};

function parseTileKey(key: string | null | undefined): { x: number; z: number } | null {
  if (!key) return null;
  const parts = key.split(',').map(Number);
  if (parts.length !== 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return null;
  return { x: parts[0], z: parts[1] };
}

export const RightInspector: React.FC = () => {
  const zenMode = useGameStore((s) => s.zenMode);
  const tiles = useGameStore((s) => s.tiles);
  const citizens = useGameStore((s) => s.citizens);
  const households = useGameStore((s) => s.households);
  const workplaces = useGameStore((s) => s.workplaces);
  const day = useGameStore((s) => s.day);
  const hourOfDay = useGameStore((s) => s.hourOfDay);
  const selectedTileCoords = useGameStore((s) => s.selectedTileCoords);
  const selectedCitizenId = useGameStore((s) => s.selectedCitizenId);
  const followedCitizenId = useGameStore((s) => s.followedCitizenId);
  const followedVehicleId = useGameStore((s) => s.followedVehicleId);
  const showCitizenRoute = useGameStore((s) => s.showCitizenRoute);

  const selectCitizen = useGameStore((s) => s.selectCitizen);
  const followCitizen = useGameStore((s) => s.followCitizen);
  const followVehicle = useGameStore((s) => s.followVehicle);
  const setShowCitizenRoute = useGameStore((s) => s.setShowCitizenRoute);
  const sendCameraCommand = useGameStore((s) => s.sendCameraCommand);
  const toggleBusStop = useGameStore((s) => s.toggleBusStop);
  const upgradeBuilding = useGameStore((s) => s.upgradeBuilding);
  const startMoveBuilding = useGameStore((s) => s.startMoveBuilding);
  const demolishAt = useGameStore((s) => s.demolishAt);
  const buyLand = useGameStore((s) => s.buyLand);
  const sellLand = useGameStore((s) => s.sellLand);
  const grantConcession = useGameStore((s) => s.grantConcession);
  const togglePlannedDistrict = useGameStore((s) => s.togglePlannedDistrict);
  const openAuction = useGameStore((s) => s.openAuction);
  const resolveLandConflict = useGameStore((s) => s.resolveLandConflict);

  const thumbnails = useMemo(() => getBuildingThumbnails(), []);

  if (zenMode) return null;

  const citizen = selectedCitizenId ? citizens.find((c) => c.id === selectedCitizenId) : null;
  const tile = selectedTileCoords ? getTile(tiles, selectedTileCoords.x, selectedTileCoords.z) : null;

  if (!citizen && !tile && !followedVehicleId) return null;

  const citizenHousehold = citizen?.householdId
    ? households.find((h) => h.id === citizen.householdId) || null
    : null;
  const familyMembers = citizenHousehold
    ? citizens.filter((m) => m.id !== citizen?.id && citizenHousehold.memberIds.includes(m.id))
    : [];
  const citizenWorkplace = citizen?.employedAtId
    ? workplaces.find((w) => w.buildingId === citizen.employedAtId) || null
    : null;
  const homeCoords = parseTileKey(citizen?.homeTileKey);
  const workCoords = parseTileKey(citizenWorkplace?.tileKey);

  return (
    <aside className="fixed top-12 right-3 bottom-48 z-20 w-80 pointer-events-none flex flex-col justify-start">
      <div className="pointer-events-auto max-h-full bg-slate-950/94 border border-slate-800 rounded-lg shadow-2xl flex flex-col overflow-hidden">
        {followedVehicleId && !citizen && !tile ? (
          <div className="p-3.5 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Car className="w-4 h-4 text-sky-400" />
                <span className="font-display font-semibold text-white">Câmera em Trânsito</span>
              </div>
              <button
                onClick={() => followVehicle(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-slate-400">
              Acompanhando veículo em circulação pelas vias da cidade em tempo real.
            </p>
            <button
              onClick={() => followVehicle(null)}
              className="w-full py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold"
            >
              Sair do Acompanhamento (Esc)
            </button>
          </div>
        ) : citizen ? (
          <>
            <div className="px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <User className="w-4 h-4 text-sky-400 shrink-0" />
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

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() =>
                    followCitizen(followedCitizenId === citizen.id ? null : citizen.id)
                  }
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded font-semibold transition-colors ${
                    followedCitizenId === citizen.id
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-sky-600 hover:bg-sky-500 text-white'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{followedCitizenId === citizen.id ? 'Seguindo' : 'Seguir'}</span>
                </button>
                <button
                  onClick={() => setShowCitizenRoute(!showCitizenRoute)}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded font-semibold border transition-colors ${
                    showCitizenRoute
                      ? 'bg-emerald-600/90 border-emerald-400 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-500'
                  }`}
                >
                  <Route className="w-3.5 h-3.5" />
                  <span>{showCitizenRoute ? 'Ocultar Rota' : 'Ver Rota 3D'}</span>
                </button>
              </div>

              {/* Navigation quick focus */}
              {(homeCoords || workCoords) && (
                <div className="grid grid-cols-2 gap-1.5">
                  {homeCoords && (
                    <button
                      onClick={() => sendCameraCommand({ type: 'focus_tile', x: homeCoords.x, z: homeCoords.z })}
                      className="flex items-center justify-center gap-1 py-1.5 px-2 rounded bg-slate-900 border border-slate-700 hover:border-amber-400 text-slate-200"
                    >
                      <Home className="w-3 h-3 text-amber-400" />
                      <span>Ir p/ Casa</span>
                    </button>
                  )}
                  {workCoords && (
                    <button
                      onClick={() => sendCameraCommand({ type: 'focus_tile', x: workCoords.x, z: workCoords.z })}
                      className="flex items-center justify-center gap-1 py-1.5 px-2 rounded bg-slate-900 border border-slate-700 hover:border-sky-400 text-slate-200"
                    >
                      <Briefcase className="w-3 h-3 text-sky-400" />
                      <span>Ir p/ Trabalho</span>
                    </button>
                  )}
                </div>
              )}

              <div className="space-y-1.5 bg-slate-900 border border-slate-800 rounded p-2.5">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-400">Atividade:</span>
                  <span className="text-amber-300 font-medium text-right">
                    {(citizen.behaviorState && BEHAVIOR_LABELS[citizen.behaviorState]) ||
                      STATE_LABELS[citizen.state] ||
                      citizen.state}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-400">Próximo Compromisso:</span>
                  <span className="text-sky-300 text-right">
                    {getNextCommitmentText(citizen, hourOfDay, day)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Rotina / Perfil:</span>
                  <span className="text-slate-200">
                    {SCHEDULE_LABELS[citizen.scheduleProfile ?? 'clt']}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Personalidade:</span>
                  <span className="text-slate-200">
                    {PERSONALITY_LABELS[citizen.personality ?? 'organizado']}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Transporte:</span>
                  <span className="text-slate-200">
                    {citizen.transportMode === 'bus'
                      ? 'Ônibus Urbano'
                      : citizen.transportMode === 'car'
                      ? 'Veículo Particular'
                      : 'A pé'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Idade / Nascimento:</span>
                  <span className="font-mono-num text-slate-200">
                    {citizen.age} anos · D{citizen.birthDay ?? 1}/A{citizen.birthYear ?? 1}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Profissão / Escolaridade:</span>
                  <span className="text-right">{citizen.profession} · {citizen.education}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Renda / Reserva:</span>
                  <span className="font-mono-num text-emerald-400">
                    R$ {citizen.income.toLocaleString('pt-BR')} / R$ {(citizen.balance ?? 0).toLocaleString('pt-BR')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Emprego:</span>
                  <span className="text-right">{citizen.employedAtName || 'Desempregado(a)'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Residência:</span>
                  <span className="font-mono-num">
                    {citizen.homeTileKey ? `Lote (${citizen.homeTileKey})` : 'Sem moradia fixa'}
                  </span>
                </div>
                {citizen.insideBuildingId && (
                  <div className="flex justify-between text-[11px] text-emerald-300">
                    <span>Localização atual:</span>
                    <span>No interior de edifício</span>
                  </div>
                )}
              </div>

              {/* Needs */}
              <div className="space-y-2 bg-slate-900 border border-slate-800 rounded p-2.5">
                <div className="font-semibold text-slate-200">Necessidades & Bem-estar</div>
                {(
                  [
                    ['Felicidade Geral', citizen.happiness],
                    ['Opinião sobre Prefeitura', citizen.opinion],
                    ['Energia / Descanso', citizen.needs.energy ?? 80],
                    ['Alimentação', citizen.needs.hunger ?? 80],
                    ['Lazer e Convivência', citizen.needs.leisure ?? 70],
                    ['Saúde', citizen.health],
                    ['Moradia', citizen.needs.housing],
                    ['Emprego', citizen.needs.job],
                    ['Transporte', citizen.needs.transport ?? 75],
                    ['Segurança do Bairro', citizen.needs.safety],
                  ] as const
                ).map(([label, val]) => {
                  const rounded = Math.round(val);
                  return (
                    <div key={label} className="space-y-0.5">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">{label}</span>
                        <span className="font-mono-num text-slate-200">{rounded}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded overflow-hidden">
                        <div
                          className={`h-full ${
                            rounded >= 65 ? 'bg-emerald-500' : rounded >= 40 ? 'bg-amber-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, rounded))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Household / Family */}
              {citizenHousehold && (
                <div className="bg-slate-900 border border-slate-800 rounded p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-amber-400" />
                      Família {citizenHousehold.surname}
                    </span>
                    <span className="text-[11px] font-mono-num text-slate-400">
                      Aluguel R$ {citizenHousehold.monthlyRent.toLocaleString('pt-BR')}
                    </span>
                  </div>
                  {familyMembers.length === 0 ? (
                    <p className="text-[11px] text-slate-400">Mora sozinho(a) nesta residência.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {familyMembers.map((fm) => (
                        <button
                          key={fm.id}
                          onClick={() => selectCitizen(fm.id)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-sky-300"
                        >
                          {fm.name} ({fm.age}a)
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Citizen History Log */}
              {citizen.history && citizen.history.length > 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded p-2.5 space-y-1">
                  <div className="font-semibold text-slate-200">Histórico Pessoal</div>
                  <ul className="space-y-1 text-[11px] text-slate-400">
                    {citizen.history.slice(-4).reverse().map((entry, idx) => (
                      <li key={idx} className="leading-snug">• {entry}</li>
                    ))}
                  </ul>
                </div>
              )}
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
              <div className="bg-slate-900 border border-slate-800 rounded p-2.5 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Geografia:</span>
                  <span className="text-slate-200">{TERRAIN_LABELS[tile.terrain]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Zoneamento:</span>
                  <span className="text-sky-300 font-medium">
                    {ZONE_LABELS[tile.zone ?? 'none']}
                  </span>
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

              {/* Bus stop toggle for roads */}
              {tile.road !== 'none' && (
                <div className="bg-slate-900 border border-slate-800 rounded p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <Bus className="w-3.5 h-3.5 text-sky-400" />
                      {tile.road === 'avenida' ? 'Avenida Urbana' : 'Rua Local'}
                    </span>
                    <span className="text-[11px] font-mono-num text-slate-400">
                      Tráfego: {tile.trafficLoad}%
                    </span>
                  </div>
                  <button
                    onClick={() => toggleBusStop(tile.x, tile.z)}
                    className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded font-medium transition-colors ${
                      tile.busStop
                        ? 'bg-sky-600 hover:bg-sky-500 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{tile.busStop ? 'Remover Ponto de Ônibus' : 'Instalar Ponto de Ônibus'}</span>
                  </button>
                </div>
              )}

              {tile.building && (
                <div className="bg-slate-900 border border-slate-800 rounded p-2.5 space-y-2.5">
                  {(() => {
                    const b = tile.building!;
                    const def = BUILDING_CATALOG[b.type];
                    const upgradeCost = Math.round(def.cost * 0.75 * b.level);
                    const thumb = thumbnails[b.type];
                    const stage = b.constructionStage ?? 'operational';
                    const progress = Math.round(b.constructionProgress ?? 100);
                    const occupants = (b.occupantIds ?? [])
                      .map((id) => citizens.find((c) => c.id === id))
                      .filter((c): c is NonNullable<typeof c> => Boolean(c));
                    const workplace = workplaces.find((w) => w.buildingId === b.id);
                    const resCap = getResidenceCapacity(tile);
                    const residents = resCap > 0
                      ? citizens.filter((c) => c.residenceBuildingId === b.id)
                      : [];

                    return (
                      <>
                        <div className="flex items-center gap-2.5">
                          {thumb && (
                            <img
                              src={thumb}
                              alt={def.name}
                              className="w-11 h-11 rounded bg-slate-950 border border-slate-800 shrink-0 object-contain"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-white truncate">{def.name}</span>
                              <span className="font-mono-num text-amber-400 shrink-0">
                                Nv.{b.level}/3
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {stage !== 'operational'
                                ? `${STAGE_LABELS[stage]} (${progress}%)`
                                : b.powered && b.watered && b.connectedRoad
                                ? 'Operando normalmente'
                                : `Pendências: ${!b.powered ? 'Energia ' : ''}${!b.watered ? 'Água ' : ''}${!b.connectedRoad ? 'Via' : ''}`}
                            </div>
                          </div>
                        </div>

                        {stage !== 'operational' && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px]">
                              <span className="text-amber-300">Progresso da Obra</span>
                              <span className="font-mono-num text-slate-200">{progress}%</span>
                            </div>
                            <div className="h-1.5 bg-slate-800 rounded overflow-hidden">
                              <div
                                className="h-full bg-amber-500"
                                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                              />
                            </div>
                          </div>
                        )}

                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-400">Conservação / Capacidade:</span>
                          <span className="font-mono-num text-slate-200">
                            {Math.round(b.condition)}% ·{' '}
                            {def.housingCapacity > 0
                              ? `${residents.length}/${resCap} moradores`
                              : workplace
                              ? `${workplace.workerIds.length}/${workplace.capacity} vagas`
                              : `${def.jobsProvided} vagas`}
                          </span>
                        </div>

                        {/* Residents or Workers list */}
                        {residents.length > 0 && (
                          <div className="pt-1 border-t border-slate-800 space-y-1">
                            <div className="text-[11px] text-slate-400">Moradores:</div>
                            <div className="flex flex-wrap gap-1">
                              {residents.slice(0, 6).map((r) => (
                                <button
                                  key={r.id}
                                  onClick={() => selectCitizen(r.id)}
                                  className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-sky-300"
                                >
                                  {r.name.split(' ')[0]}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {workplace && workplace.workerIds.length > 0 && (
                          <div className="pt-1 border-t border-slate-800 space-y-1">
                            <div className="text-[11px] text-slate-400">Equipe contratada:</div>
                            <div className="flex flex-wrap gap-1">
                              {workplace.workerIds.slice(0, 6).map((wid) => {
                                const w = citizens.find((c) => c.id === wid);
                                if (!w) return null;
                                return (
                                  <button
                                    key={wid}
                                    onClick={() => selectCitizen(wid)}
                                    className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-emerald-300"
                                  >
                                    {w.name.split(' ')[0]}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Citizens currently inside building */}
                        <div className="pt-1 border-t border-slate-800 space-y-1">
                          <div className="text-[11px] text-slate-400">
                            No interior agora ({occupants.length}):
                          </div>
                          {occupants.length === 0 ? (
                            <div className="text-[11px] text-slate-500">Nenhum cidadão dentro no momento.</div>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {occupants.slice(0, 8).map((occ) => (
                                <button
                                  key={occ.id}
                                  onClick={() => selectCitizen(occ.id)}
                                  className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-amber-300"
                                >
                                  {occ.name.split(' ')[0]}
                                </button>
                              ))}
                            </div>
                          )}
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

              {!tile.building && tile.road === 'none' && !tile.conflict && (
                <div className="bg-slate-900 border border-slate-800 rounded p-2.5 space-y-1.5">
                  <div className="font-semibold text-slate-200">Operações Imobiliárias</div>
                  {tile.ownerType !== 'public' ? (
                    <button
                      disabled={tile.ownerType === 'occupied'}
                      onClick={() => buyLand(tile.x, tile.z)}
                      className="w-full py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 text-white font-medium"
                    >
                      Comprar Terreno (R$ {tile.landValue.toLocaleString('pt-BR')})
                    </button>
                  ) : tile.terrain === 'waterfront' ? (
                    <div className="text-[11px] text-slate-400 py-1">
                      Área de orla preservada como patrimônio público e lazer.
                    </div>
                  ) : (
                    <>
                      <button
                        disabled={tile.concessionActive}
                        onClick={() => sellLand(tile.x, tile.z)}
                        className="w-full py-1.5 rounded bg-amber-500 hover:bg-amber-400 disabled:opacity-45 text-slate-950 font-semibold"
                      >
                        Vender Lote (+R$ {Math.round(tile.landValue * 1.15).toLocaleString('pt-BR')})
                      </button>
                      <button
                        disabled={tile.concessionActive}
                        onClick={() => openAuction(tile.x, tile.z)}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-45 text-white font-medium"
                      >
                        <Gavel className="w-3.5 h-3.5" />
                        <span>Realizar Leilão Imobiliário</span>
                      </button>
                      <button
                        disabled={tile.concessionActive}
                        onClick={() => grantConcession(tile.x, tile.z)}
                        className="w-full py-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-45 text-slate-200 font-medium"
                      >
                        {tile.concessionActive
                          ? 'Concessão Ativa'
                          : `Conceder p/ Empreendimento (+R$ ${Math.round(tile.landValue * 0.45).toLocaleString('pt-BR')})`}
                      </button>
                    </>
                  )}
                  <button
                    disabled={tile.plannedDistrict}
                    onClick={() => togglePlannedDistrict(tile.x, tile.z)}
                    className="w-full py-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-55 text-slate-200 font-medium"
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
