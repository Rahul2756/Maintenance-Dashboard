import React from 'react';
import {
  TrendingUp,
  Layers,
  Flame,
  Truck,
  CheckCircle2,
  Sparkles,
  Scale,
  Container,
  Clock,
  AlertCircle
} from 'lucide-react';
import { KPIAggregates, ActivityType } from '../../types/dpr';
import { Badge } from '../ui/Badge';
import { MiniTripleBarChart } from '../ui/MiniTripleBarChart';

interface KPICardsProps {
  kpis: KPIAggregates;
  selectedActivities?: ActivityType[];
}

export const KPICards: React.FC<KPICardsProps> = ({ kpis, selectedActivities }) => {
  // Format numbers with comma and 1 decimal place
  const fmt = (num: number | undefined | null, decimals: number = 1) => {
    if (num === undefined || num === null || isNaN(num)) return '0';
    return num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };

  const isMillingSelected = !selectedActivities || selectedActivities.includes('Milling');
  const isTackSelected = !selectedActivities || selectedActivities.includes('Tackcoat');
  const isDbmSelected = !selectedActivities || selectedActivities.includes('DBM');
  const isBcSelected = !selectedActivities || selectedActivities.includes('BC');
  const isSingleSelect = selectedActivities && selectedActivities.length === 1;

  // 1. Milling variables
  const millingTarget = kpis.millingTarget || 681284;
  const millingToday = kpis.millingAchievedToday !== undefined ? kpis.millingAchievedToday : 0;
  const millingCum = kpis.millingCumulative !== undefined ? kpis.millingCumulative : kpis.millingAchieved;
  const millingBalance = kpis.millingBalance !== undefined ? kpis.millingBalance : (millingTarget - millingCum);
  const millingPercent = millingTarget > 0 ? (millingCum / millingTarget) * 100 : 0;
  const isMillingOver = millingCum > millingTarget;

  // 2. Tackcoat variables
  const tackTarget = kpis.tackcoatTarget || 1848270;
  const tackToday = kpis.tackcoatAchievedToday !== undefined ? kpis.tackcoatAchievedToday : 0;
  const tackCum = kpis.tackcoatCumulative !== undefined ? kpis.tackcoatCumulative : kpis.tackcoatAchieved;
  const tackBalance = kpis.tackcoatBalance !== undefined ? kpis.tackcoatBalance : (tackTarget - tackCum);
  const tackPercent = tackTarget > 0 ? (tackCum / tackTarget) * 100 : 0;
  const isTackOver = tackCum > tackTarget;

  // 3. DBM variables (Strictly in Cum)
  const dbmTarget = kpis.dbmTargetCum ?? kpis.dbmTarget ?? 37026.25;
  const dbmToday = kpis.dbmAchievedTodayCum !== undefined ? kpis.dbmAchievedTodayCum : 0;
  const dbmCum = kpis.dbmCumulativeCum !== undefined ? kpis.dbmCumulativeCum : (kpis.dbmAchievedCum ?? kpis.dbmAchieved);
  const dbmBalance = kpis.dbmBalanceCum !== undefined ? kpis.dbmBalanceCum : (dbmTarget - dbmCum);
  const dbmPercent = dbmTarget > 0 ? (dbmCum / dbmTarget) * 100 : 0;
  const isDbmOver = dbmCum > dbmTarget;

  // 4. BC variables (Strictly in Cum)
  const bcTarget = kpis.bcTargetCum ?? kpis.bcTarget ?? 46679.48;
  const bcToday = kpis.bcAchievedTodayCum !== undefined ? kpis.bcAchievedTodayCum : 0;
  const bcCum = kpis.bcCumulativeCum !== undefined ? kpis.bcCumulativeCum : (kpis.bcAchievedCum ?? kpis.bcAchieved);
  const bcBalance = kpis.bcBalanceCum !== undefined ? kpis.bcBalanceCum : (bcTarget - bcCum);
  const bcPercent = bcTarget > 0 ? (bcCum / bcTarget) * 100 : 0;
  const isBcOver = bcCum > bcTarget;

  return (
    <div className="space-y-2.5 mb-4">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/25 to-yellow-600/20 border border-amber-400/50 text-amber-300 shadow-lg shadow-amber-950/60 flex items-center justify-center">
            <Container className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-500/40 text-[9px] font-mono font-extrabold uppercase tracking-widest text-amber-300">
                Material Mass // Sqm • Cum
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[10px] font-mono text-amber-400/80 font-semibold">Contractual BOQ</span>
            </div>
            <h2 className="text-sm font-black uppercase tracking-wider text-white drop-shadow-sm flex items-center gap-2 mt-0.5">
              <span>Contractual BOQ Scope & Material Volume Metrics</span>
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-300">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#181510] border border-amber-500/30 shadow-sm font-medium text-amber-200">
            <Scale className="w-3 h-3 text-amber-400" />
            Source: final_sheet.xlsx (Work Program & Chainage Log)
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#181510] border border-amber-500/30 shadow-sm font-medium text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Targets: {fmt(millingTarget, 0)} sqm Milling • {fmt(tackTarget, 0)} sqm Tack • {fmt(dbmTarget, 1)} Cum DBM • {fmt(bcTarget, 1)} Cum BC
          </span>
        </div>
      </div>

      {/* 4 Volumetric KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* ============================================================== */}
        {/* 1. Milling Progress (Volumetric)                               */}
        {/* ============================================================== */}
        <div
          className={`relative group transition-all duration-300 rounded-2xl overflow-hidden bg-gradient-to-b from-[#1C1813] to-[#12100C] border border-amber-500/25 shadow-xl shadow-amber-950/20 ${
            isMillingSelected ? 'opacity-100 ring-1 ring-amber-400/30' : 'opacity-40 grayscale-[40%]'
          }`}
        >
          <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600" />

          <div className="px-3.5 py-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2.5 rounded-xl border ${
                    isMillingSelected
                      ? 'bg-amber-500/20 text-amber-300 border-amber-400/40 shadow-md shadow-amber-950/40'
                      : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}
                >
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold uppercase tracking-wider text-white drop-shadow-sm">
                      Milling Executed
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-500/30 font-mono font-bold">
                      Sqm
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">Surface layer removal (0-100mm)</p>
                </div>
              </div>

              {isMillingSelected ? (
                <Badge
                  variant={isMillingOver ? 'amber' : millingPercent >= 15 ? 'emerald' : 'cyan'}
                  size="sm"
                  className="font-mono font-bold shadow-sm"
                >
                  {isMillingOver ? `+${(millingPercent - 100).toFixed(1)}% OVER` : `${millingPercent.toFixed(1)}% Target`}
                </Badge>
              ) : (
                <Badge variant="neutral" size="xs">Filtered Out</Badge>
              )}
            </div>

            {/* Main numbers: Cumulative & Today */}
            <div className="mt-4 flex items-center justify-between gap-2">
              <div>
                <div className="text-[10px] uppercase font-mono font-bold tracking-wider text-amber-400/90 mb-0.5">
                  Cumulative Achieved
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight drop-shadow-sm">
                    {isMillingSelected ? fmt(millingCum, 1) : '—'}
                  </span>
                  <span className="text-xs text-amber-400 font-bold font-mono">sqm</span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-[11px] font-mono font-bold text-amber-300">
                    <Clock className="w-3 h-3 text-amber-400" />
                    Today: {isMillingSelected ? `${fmt(millingToday, 1)} sqm` : '—'}
                  </span>
                </div>
              </div>

              {isMillingSelected && (
                <div className="hidden sm:block">
                  <MiniTripleBarChart
                    planned={millingTarget}
                    actual={millingCum}
                    balance={Math.max(0, millingBalance)}
                    unit="sqm"
                    actualColor="#F59E0B"
                  />
                </div>
              )}
            </div>

            {/* Scope Details: Target & Balance */}
            <div className="mt-3.5 pt-3 border-t border-white/5 grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-[#14120E] p-2 rounded-xl border border-white/5">
                <span className="text-slate-400 text-[10px] block">Target Qty</span>
                <span className="font-bold text-slate-200 mt-0.5 block truncate">
                  {isMillingSelected ? `${fmt(millingTarget, 0)} sqm` : '—'}
                </span>
              </div>
              <div className={`p-2 rounded-xl border ${isMillingOver ? 'bg-amber-950/40 border-amber-500/30 text-amber-300' : 'bg-[#14120E] border-white/5 text-amber-400'}`}>
                <span className="text-slate-400 text-[10px] block">Balance Qty</span>
                <span className="font-extrabold mt-0.5 block truncate">
                  {isMillingSelected ? `${fmt(millingBalance, 1)} sqm` : '—'}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-3">
              <div className="w-full h-2 rounded-full bg-[#100E0B] border border-amber-500/20 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 shadow-sm ${
                    isMillingOver
                      ? 'bg-gradient-to-r from-amber-400 to-rose-500 shadow-amber-500/50'
                      : 'bg-gradient-to-r from-amber-500 to-yellow-400 shadow-amber-500/50'
                  }`}
                  style={{ width: `${isMillingSelected ? Math.min(millingPercent, 100) : 0}%` }}
                />
              </div>

              {isMillingOver && (
                <div className="mt-1.5 flex items-center gap-1 text-[11px] text-amber-300 font-mono font-semibold">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Target achieved and exceeded</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 2. Tackcoat Progress (Volumetric)                              */}
        {/* ============================================================== */}
        <div
          className={`relative group transition-all duration-300 rounded-2xl overflow-hidden bg-gradient-to-b from-[#1C1813] to-[#12100C] border border-amber-500/25 shadow-xl shadow-amber-950/20 ${
            isTackSelected ? 'opacity-100 ring-1 ring-amber-400/30' : 'opacity-40 grayscale-[40%]'
          }`}
        >
          <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500" />

          <div className="px-3.5 py-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2.5 rounded-xl border ${
                    isTackSelected
                      ? 'bg-amber-500/20 text-amber-300 border-amber-400/40 shadow-md shadow-amber-950/40'
                      : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}
                >
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold uppercase tracking-wider text-white drop-shadow-sm">
                      Tack Coat Spray
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-500/30 font-mono font-bold">
                      Sqm
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">Combined Tack Coat (DBM + BC)</p>
                </div>
              </div>

              {isTackSelected ? (
                <Badge
                  variant={isTackOver ? 'amber' : tackPercent >= 10 ? 'emerald' : 'cyan'}
                  size="sm"
                  className="font-mono font-bold shadow-sm"
                >
                  {isTackOver ? `+${(tackPercent - 100).toFixed(1)}% OVER` : `${tackPercent.toFixed(1)}% Target`}
                </Badge>
              ) : (
                <Badge variant="neutral" size="xs">Filtered Out</Badge>
              )}
            </div>

            {/* Main numbers: Cumulative & Today */}
            <div className="mt-4 flex items-center justify-between gap-2">
              <div>
                <div className="text-[10px] uppercase font-mono font-bold tracking-wider text-amber-400/90 mb-0.5">
                  Cumulative Achieved
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight drop-shadow-sm">
                    {isTackSelected ? fmt(tackCum, 1) : '—'}
                  </span>
                  <span className="text-xs text-amber-400 font-bold font-mono">sqm</span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-[11px] font-mono font-bold text-amber-300">
                    <Clock className="w-3 h-3 text-amber-400" />
                    Today: {isTackSelected ? `${fmt(tackToday, 1)} sqm` : '—'}
                  </span>
                </div>
              </div>

              {isTackSelected && (
                <div className="hidden sm:block">
                  <MiniTripleBarChart
                    planned={tackTarget}
                    actual={tackCum}
                    balance={Math.max(0, tackBalance)}
                    unit="sqm"
                    actualColor="#F59E0B"
                  />
                </div>
              )}
            </div>

            {/* Scope Details: Target & Balance */}
            <div className="mt-3.5 pt-3 border-t border-white/5 grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-[#14120E] p-2 rounded-xl border border-white/5">
                <span className="text-slate-400 text-[10px] block">Target Qty</span>
                <span className="font-bold text-slate-200 mt-0.5 block truncate">
                  {isTackSelected ? `${fmt(tackTarget, 0)} sqm` : '—'}
                </span>
              </div>
              <div className={`p-2 rounded-xl border ${isTackOver ? 'bg-amber-950/40 border-amber-500/30 text-amber-300' : 'bg-[#14120E] border-white/5 text-amber-400'}`}>
                <span className="text-slate-400 text-[10px] block">Balance Qty</span>
                <span className="font-extrabold mt-0.5 block truncate">
                  {isTackSelected ? `${fmt(tackBalance, 1)} sqm` : '—'}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-3">
              <div className="w-full h-2 rounded-full bg-[#100E0B] border border-amber-500/20 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 shadow-sm ${
                    isTackOver
                      ? 'bg-gradient-to-r from-amber-400 to-rose-500 shadow-amber-500/50'
                      : 'bg-gradient-to-r from-amber-400 to-orange-500 shadow-amber-500/50'
                  }`}
                  style={{ width: `${isTackSelected ? Math.min(tackPercent, 100) : 0}%` }}
                />
              </div>

              {isTackOver && (
                <div className="mt-1.5 flex items-center gap-1 text-[11px] text-amber-300 font-mono font-semibold">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Target achieved and exceeded</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 3. DBM Volume Laid                                             */}
        {/* ============================================================== */}
        <div
          className={`relative group transition-all duration-300 rounded-2xl overflow-hidden bg-gradient-to-b from-[#1C1813] to-[#12100C] border border-emerald-500/25 shadow-xl shadow-emerald-950/20 ${
            isDbmSelected ? 'opacity-100 ring-1 ring-emerald-400/30' : 'opacity-40 grayscale-[40%]'
          }`}
        >
          <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />

          <div className="px-3.5 py-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2.5 rounded-xl border ${
                    isDbmSelected
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40 shadow-md shadow-emerald-950/40'
                      : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}
                >
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold uppercase tracking-wider text-white drop-shadow-sm">
                      DBM Volume Laid
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30 font-mono font-bold">
                      Cum
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">Dense Bituminous Macadam (50mm)</p>
                </div>
              </div>

              {isDbmSelected ? (
                <Badge
                  variant={isDbmOver ? 'amber' : dbmPercent >= 10 ? 'emerald' : 'cyan'}
                  size="sm"
                  className="font-mono font-bold shadow-sm"
                >
                  {isDbmOver ? `+${(dbmPercent - 100).toFixed(1)}% OVER` : `${dbmPercent.toFixed(1)}% Target`}
                </Badge>
              ) : (
                <Badge variant="neutral" size="xs">Filtered Out</Badge>
              )}
            </div>

            {/* Main numbers: Cumulative & Today */}
            <div className="mt-4 flex items-center justify-between gap-2">
              <div>
                <div className="text-[10px] uppercase font-mono font-bold tracking-wider text-emerald-400/90 mb-0.5">
                  Cumulative Achieved
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight drop-shadow-sm">
                    {isDbmSelected ? fmt(dbmCum, 2) : '—'}
                  </span>
                  <span className="text-xs text-emerald-400 font-bold font-mono">Cum</span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-mono font-bold text-emerald-300">
                    <Clock className="w-3 h-3 text-emerald-400" />
                    Today: {isDbmSelected ? `${fmt(dbmToday, 2)} Cum` : '—'}
                  </span>
                </div>
              </div>

              {isDbmSelected && (
                <div className="hidden sm:block">
                  <MiniTripleBarChart
                    planned={dbmTarget}
                    actual={dbmCum}
                    balance={Math.max(0, dbmBalance)}
                    unit="Cum"
                    actualColor="#10B981"
                  />
                </div>
              )}
            </div>

            {/* Scope Details: Target & Balance */}
            <div className="mt-3.5 pt-3 border-t border-white/5 grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-[#14120E] p-2 rounded-xl border border-white/5">
                <span className="text-slate-400 text-[10px] block">Target Qty</span>
                <span className="font-bold text-slate-200 mt-0.5 block truncate">
                  {isDbmSelected ? `${fmt(dbmTarget, 2)} Cum` : '—'}
                </span>
              </div>
              <div className={`p-2 rounded-xl border ${isDbmOver ? 'bg-amber-950/40 border-amber-500/30 text-amber-300' : 'bg-[#14120E] border-white/5 text-emerald-400'}`}>
                <span className="text-slate-400 text-[10px] block">Balance Qty</span>
                <span className="font-extrabold mt-0.5 block truncate">
                  {isDbmSelected ? `${fmt(dbmBalance, 2)} Cum` : '—'}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-3">
              <div className="w-full h-2 rounded-full bg-[#100E0B] border border-emerald-500/20 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 shadow-sm ${
                    isDbmOver
                      ? 'bg-gradient-to-r from-amber-400 to-rose-500 shadow-emerald-500/50'
                      : 'bg-gradient-to-r from-emerald-400 to-teal-500 shadow-emerald-500/50'
                  }`}
                  style={{ width: `${isDbmSelected ? Math.min(dbmPercent, 100) : 0}%` }}
                />
              </div>

              {isDbmOver && (
                <div className="mt-1.5 flex items-center gap-1 text-[11px] text-amber-300 font-mono font-semibold">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Target achieved and exceeded</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 4. BC Layer Laid (Bituminous Concrete)                         */}
        {/* ============================================================== */}
        <div
          className={`relative group transition-all duration-300 rounded-2xl overflow-hidden bg-gradient-to-b from-[#1C1813] to-[#12100C] border border-purple-500/25 shadow-xl shadow-purple-950/20 ${
            isBcSelected ? 'opacity-100 ring-1 ring-purple-400/30' : 'opacity-40 grayscale-[40%]'
          }`}
        >
          <div className="h-1.5 w-full bg-gradient-to-r from-purple-500 via-indigo-500 to-fuchsia-500" />

          <div className="px-3.5 py-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2.5 rounded-xl border ${
                    isBcSelected
                      ? 'bg-purple-500/20 text-purple-300 border-purple-400/40 shadow-md shadow-purple-950/40'
                      : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}
                >
                  <Sparkles className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold uppercase tracking-wider text-white drop-shadow-sm">
                      BC Layer Laid
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-500/30 font-mono font-bold">
                      Cum
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">Bituminous Concrete (40mm Wearing)</p>
                </div>
              </div>

              {isBcSelected ? (
                <Badge
                  variant={isBcOver ? 'amber' : bcPercent >= 1 ? 'emerald' : 'purple'}
                  size="sm"
                  className="font-mono font-bold shadow-sm"
                >
                  {isBcOver ? `+${(bcPercent - 100).toFixed(1)}% OVER` : `${bcPercent.toFixed(1)}% Target`}
                </Badge>
              ) : (
                <Badge variant="neutral" size="xs">Filtered Out</Badge>
              )}
            </div>

            {/* Main numbers: Cumulative & Today */}
            <div className="mt-4 flex items-center justify-between gap-2">
              <div>
                <div className="text-[10px] uppercase font-mono font-bold tracking-wider text-purple-400/90 mb-0.5">
                  Cumulative Achieved
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight drop-shadow-sm">
                    {isBcSelected ? fmt(bcCum, 2) : '—'}
                  </span>
                  <span className="text-xs text-purple-400 font-bold font-mono">Cum</span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/15 border border-purple-500/30 text-[11px] font-mono font-bold text-purple-300">
                    <Clock className="w-3 h-3 text-purple-400" />
                    Today: {isBcSelected ? `${fmt(bcToday, 2)} Cum` : '—'}
                  </span>
                </div>
              </div>

              {isBcSelected && (
                <div className="hidden sm:block">
                  <MiniTripleBarChart
                    planned={bcTarget}
                    actual={bcCum}
                    balance={Math.max(0, bcBalance)}
                    unit="Cum"
                    actualColor="#A855F7"
                  />
                </div>
              )}
            </div>

            {/* Scope Details: Target & Balance */}
            <div className="mt-3.5 pt-3 border-t border-white/5 grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-[#14120E] p-2 rounded-xl border border-white/5">
                <span className="text-slate-400 text-[10px] block">Target Qty</span>
                <span className="font-bold text-slate-200 mt-0.5 block truncate">
                  {isBcSelected ? `${fmt(bcTarget, 2)} Cum` : '—'}
                </span>
              </div>
              <div className={`p-2 rounded-xl border ${isBcOver ? 'bg-amber-950/40 border-amber-500/30 text-amber-300' : 'bg-[#14120E] border-white/5 text-purple-400'}`}>
                <span className="text-slate-400 text-[10px] block">Balance Qty</span>
                <span className="font-extrabold mt-0.5 block truncate">
                  {isBcSelected ? `${fmt(bcBalance, 2)} Cum` : '—'}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-3">
              <div className="w-full h-2 rounded-full bg-[#100E0B] border border-purple-500/20 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 shadow-sm ${
                    isBcOver
                      ? 'bg-gradient-to-r from-amber-400 to-rose-500 shadow-purple-500/50'
                      : 'bg-gradient-to-r from-purple-500 to-indigo-500 shadow-purple-500/50'
                  }`}
                  style={{ width: `${isBcSelected ? Math.min(bcPercent, 100) : 0}%` }}
                />
              </div>

              {isBcOver && (
                <div className="mt-1.5 flex items-center gap-1 text-[11px] text-amber-300 font-mono font-semibold">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Target achieved and exceeded</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KPICards;
