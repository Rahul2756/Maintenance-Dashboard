import React from 'react';
import {
  TrendingUp,
  Layers,
  Flame,
  Truck,
  CheckCircle2,
  Sparkles,
  Scale,
  PackageCheck,
  Container
} from 'lucide-react';
import { KPIAggregates, ActivityType } from '../../types/dpr';
import { Card, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { MiniTripleBarChart } from '../ui/MiniTripleBarChart';

interface KPICardsProps {
  kpis: KPIAggregates;
  selectedActivities?: ActivityType[];
}

export const KPICards: React.FC<KPICardsProps> = ({ kpis, selectedActivities }) => {
  // Format numbers with comma and 1 decimal place
  const fmt = (num: number, decimals: number = 1) =>
    num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });

  const isMillingSelected = !selectedActivities || selectedActivities.includes('Milling');
  const isTackSelected = !selectedActivities || selectedActivities.includes('Tackcoat');
  const isDbmSelected = !selectedActivities || selectedActivities.includes('DBM');
  const isBcSelected = !selectedActivities || selectedActivities.includes('BC');
  const isSingleSelect = selectedActivities && selectedActivities.length === 1;

  // Compute positive remaining balances for display
  const millingBalance = Math.max(0, kpis.millingTarget - kpis.millingAchieved);
  const tackcoatBalance = Math.max(0, kpis.tackcoatTarget - kpis.tackcoatAchieved);
  const dbmBalance = Math.max(0, (kpis.dbmTargetCum ?? kpis.dbmTarget) - (kpis.dbmAchievedCum ?? kpis.dbmAchieved));
  const bcBalance = Math.max(0, kpis.bcTarget - kpis.bcAchieved);

  return (
    <div className="space-y-2.5 mb-4">
      {/* ============================================================== */}
      {/* THEME 2: CONTRACTUAL BOQ SCOPE (INDUSTRIAL OBSIDIAN / BRONZE) */}
      {/* ============================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/25 to-yellow-600/20 border border-amber-400/50 text-amber-300 shadow-lg shadow-amber-950/60 flex items-center justify-center">
            <Container className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-500/40 text-[9px] font-mono font-extrabold uppercase tracking-widest text-amber-300">
                Material Mass // Sqm • MT • Cum
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
            Baseline: Work Program BOQ
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#181510] border border-amber-500/30 shadow-sm font-medium text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Target: 681,284 sqm • 1,848,271 sqm Tack • 37,026 Cum DBM
          </span>
        </div>
      </div>

      {/* 4 Volumetric KPI Cards Grid - Industrial Carbon / Warm Bronze Theme */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* ============================================================== */}
        {/* 1. Milling Progress (Volumetric)                               */}
        {/* ============================================================== */}
        <div
          className={`relative group transition-all duration-300 rounded-2xl overflow-hidden bg-gradient-to-b from-[#1C1813] to-[#12100C] border border-amber-500/25 shadow-xl shadow-amber-950/20 ${isMillingSelected ? 'opacity-100 ring-1 ring-amber-400/30' : 'opacity-40 grayscale-[40%]'
            }`}
        >
          {/* Top Industrial Metal Rail */}
          <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600" />

          <div className="px-3.5 py-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2.5 rounded-xl border ${isMillingSelected
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
                      Volume
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">Surface layer removal</p>
                </div>
              </div>

              {isMillingSelected ? (
                <Badge
                  variant={kpis.millingPercent >= 90 ? 'emerald' : 'amber'}
                  size="sm"
                  className="font-mono font-bold shadow-sm"
                >
                  {isSingleSelect ? 'Focused (Single)' : `${kpis.millingPercent.toFixed(1)}% Target`}
                </Badge>
              ) : (
                <Badge variant="neutral" size="xs">
                  Filtered Out
                </Badge>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight drop-shadow-sm">
                    {isMillingSelected ? fmt(kpis.millingAchieved) : '—'}
                  </span>
                  <span className="text-xs text-amber-400 font-bold font-mono">sqm</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-1 font-medium">
                  <span className="text-slate-400">Target:</span>
                  <span className="font-mono font-bold text-white bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/20">
                    {isMillingSelected ? `${fmt(kpis.millingTarget)} sqm` : '681,284 sqm (Excluded)'}
                  </span>
                </div>
              </div>

              {isMillingSelected && (
                <div className="hidden sm:block">
                  <MiniTripleBarChart
                    planned={kpis.millingTarget}
                    actual={kpis.millingAchieved}
                    balance={millingBalance}
                    unit="sqm"
                    actualColor="#F59E0B"
                  />
                </div>
              )}
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="w-full h-2 rounded-full bg-[#100E0B] border border-amber-500/20 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-500 shadow-sm shadow-amber-500/50"
                  style={{ width: `${isMillingSelected ? Math.min(kpis.millingPercent, 100) : 0}%` }}
                />
              </div>

              <div className="mt-2.5 flex items-center justify-between text-xs gap-1.5 min-w-0">
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-950/70 border border-amber-500/40 text-amber-300 font-bold font-mono whitespace-nowrap shrink-0">
                  <TrendingUp className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>
                    {isMillingSelected ? (
                      <>
                        <span className="hidden 2xl:inline">Pacing:&nbsp;</span>Active
                      </>
                    ) : (
                      'Inactive'
                    )}
                  </span>
                </span>

                {isMillingSelected && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#14120E] border border-amber-500/30 text-xs font-mono shadow-sm whitespace-nowrap shrink-0">
                    <span className="text-slate-400 font-medium">Balance:</span>
                    <span className="font-extrabold text-amber-300 whitespace-nowrap">
                      {fmt(millingBalance)}&nbsp;sqm
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 2. Tackcoat Progress (Volumetric)                              */}
        {/* ============================================================== */}
        <div
          className={`relative group transition-all duration-300 rounded-2xl overflow-hidden bg-gradient-to-b from-[#1C1813] to-[#12100C] border border-amber-500/25 shadow-xl shadow-amber-950/20 ${isTackSelected ? 'opacity-100 ring-1 ring-amber-400/30' : 'opacity-40 grayscale-[40%]'
            }`}
        >
          {/* Top Industrial Metal Rail */}
          <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500" />

          <div className="px-3.5 py-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2.5 rounded-xl border ${isTackSelected
                      ? 'bg-amber-500/20 text-amber-300 border-amber-400/40 shadow-md shadow-amber-950/40'
                      : 'bg-slate-800 text-slate-500 border-slate-700'
                    }`}
                >
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold uppercase tracking-wider text-white drop-shadow-sm">
                      Tackcoat Spray
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-500/30 font-mono font-bold">
                      Volume
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">Bitumen emulsion bond</p>
                </div>
              </div>

              {isTackSelected ? (
                <Badge
                  variant={kpis.tackcoatPercent >= 85 ? 'emerald' : 'amber'}
                  size="sm"
                  className="font-mono font-bold shadow-sm"
                >
                  {isSingleSelect ? 'Focused (Single)' : `${kpis.tackcoatPercent.toFixed(1)}% Target`}
                </Badge>
              ) : (
                <Badge variant="neutral" size="xs">
                  Filtered Out
                </Badge>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight drop-shadow-sm">
                    {isTackSelected ? fmt(kpis.tackcoatAchieved) : '—'}
                  </span>
                  <span className="text-xs text-amber-400 font-bold font-mono">sqm</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-1 font-medium">
                  <span className="text-slate-400">Target:</span>
                  <span className="font-mono font-bold text-white bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/20">
                    {isTackSelected ? `${fmt(kpis.tackcoatTarget)} sqm` : '1,848,271 sqm (Excluded)'}
                  </span>
                </div>
              </div>

              {isTackSelected && (
                <div className="hidden sm:block">
                  <MiniTripleBarChart
                    planned={kpis.tackcoatTarget}
                    actual={kpis.tackcoatAchieved}
                    balance={tackcoatBalance}
                    unit="sqm"
                    actualColor="#F59E0B"
                  />
                </div>
              )}
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="w-full h-2 rounded-full bg-[#100E0B] border border-amber-500/20 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-500 shadow-sm shadow-amber-500/50"
                  style={{ width: `${isTackSelected ? Math.min(kpis.tackcoatPercent, 100) : 0}%` }}
                />
              </div>

              <div className="mt-2.5 flex items-center justify-between text-xs gap-1.5 min-w-0">
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-950/70 border border-amber-500/40 text-amber-300 font-bold font-mono whitespace-nowrap shrink-0">
                  <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>
                    {isTackSelected ? (
                      <>
                        <span className="hidden 2xl:inline">Milling&nbsp;</span>Sync:&nbsp;84%
                      </>
                    ) : (
                      'Inactive'
                    )}
                  </span>
                </span>

                {isTackSelected && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#14120E] border border-amber-500/30 text-xs font-mono shadow-sm whitespace-nowrap shrink-0">
                    <span className="text-slate-400 font-medium">Balance:</span>
                    <span className="font-extrabold text-amber-300 whitespace-nowrap">
                      {fmt(tackcoatBalance)}&nbsp;sqm
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 3. DBM Volume Laid                                             */}
        {/* ============================================================== */}
        <div
          className={`relative group transition-all duration-300 rounded-2xl overflow-hidden bg-gradient-to-b from-[#1C1813] to-[#12100C] border border-emerald-500/25 shadow-xl shadow-emerald-950/20 ${isDbmSelected ? 'opacity-100 ring-1 ring-emerald-400/30' : 'opacity-40 grayscale-[40%]'
            }`}
        >
          {/* Top Industrial Metal Rail */}
          <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />

          <div className="px-3.5 py-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2.5 rounded-xl border ${isDbmSelected
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
                      Volume
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">Dense Bituminous Macadam</p>
                </div>
              </div>

              {isDbmSelected ? (
                <Badge
                  variant={kpis.dbmPercent >= 80 ? 'emerald' : 'amber'}
                  size="sm"
                  className="font-mono font-bold shadow-sm"
                >
                  {isSingleSelect ? 'Focused (Single)' : `${kpis.dbmPercent.toFixed(1)}% Target`}
                </Badge>
              ) : (
                <Badge variant="neutral" size="xs">
                  Filtered Out
                </Badge>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight drop-shadow-sm">
                    {isDbmSelected ? fmt(kpis.dbmAchievedCum ?? kpis.dbmAchieved, 2) : '—'}
                  </span>
                  <span className="text-xs text-emerald-400 font-bold font-mono">Cum</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-1 font-medium">
                  <span className="text-slate-400">Target:</span>
                  <span className="font-mono font-bold text-white bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/20">
                    {isDbmSelected ? `${fmt(kpis.dbmTargetCum ?? kpis.dbmTarget, 2)} Cum` : '37,026 Cum (Excluded)'}
                  </span>
                </div>
              </div>

              {isDbmSelected && (
                <div className="hidden sm:block">
                  <MiniTripleBarChart
                    planned={kpis.dbmTargetCum ?? kpis.dbmTarget}
                    actual={kpis.dbmAchievedCum ?? kpis.dbmAchieved}
                    balance={dbmBalance}
                    unit="Cum"
                    actualColor="#10B981"
                  />
                </div>
              )}
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="w-full h-2 rounded-full bg-[#100E0B] border border-emerald-500/20 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-500 shadow-sm shadow-emerald-500/50"
                  style={{ width: `${isDbmSelected ? Math.min(kpis.dbmPercent, 100) : 0}%` }}
                />
              </div>

              <div className="mt-2.5 flex items-center justify-between text-xs gap-1.5 min-w-0">
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 font-bold font-mono whitespace-nowrap shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>
                    {isDbmSelected ? (
                      <>
                        Plant-1:&nbsp;<span className="hidden 2xl:inline">100%&nbsp;</span>OK
                      </>
                    ) : (
                      'Inactive'
                    )}
                  </span>
                </span>

                {isDbmSelected && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#14120E] border border-emerald-500/30 text-xs font-mono shadow-sm whitespace-nowrap shrink-0">
                    <span className="text-slate-400 font-medium">Balance:</span>
                    <span className="text-emerald-400 font-extrabold whitespace-nowrap">
                      {fmt(dbmBalance, 1)}&nbsp;Cum
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 4. BC Layer Laid (Bituminous Concrete)                         */}
        {/* ============================================================== */}
        <div
          className={`relative group transition-all duration-300 rounded-2xl overflow-hidden bg-gradient-to-b from-[#1C1813] to-[#12100C] border border-purple-500/25 shadow-xl shadow-purple-950/20 ${isBcSelected ? 'opacity-100 ring-1 ring-purple-400/30' : 'opacity-40 grayscale-[40%]'
            }`}
        >
          {/* Top Industrial Metal Rail */}
          <div className="h-1.5 w-full bg-gradient-to-r from-purple-500 via-indigo-500 to-fuchsia-500" />

          <div className="px-3.5 py-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2.5 rounded-xl border ${isBcSelected
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
                      Cum Vol
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">Bituminous Concrete (40mm Wearing)</p>
                </div>
              </div>

              {isBcSelected ? (
                <Badge
                  variant={kpis.bcPercent >= 80 ? 'emerald' : 'purple'}
                  size="sm"
                  className="font-mono font-bold shadow-sm"
                >
                  {isSingleSelect
                    ? 'Focused (Single)'
                    : kpis.bcAchieved > 0
                      ? `${kpis.bcPercent.toFixed(1)}% Target`
                      : 'Phase 2: Planned'}
                </Badge>
              ) : (
                <Badge variant="neutral" size="xs">
                  Filtered Out
                </Badge>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight drop-shadow-sm">
                    {isBcSelected ? fmt(kpis.bcAchieved, 2) : '—'}
                  </span>
                  <span className="text-xs text-purple-400 font-bold font-mono">Cum</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-1 font-medium">
                  <span className="text-slate-400">Target:</span>
                  <span className="font-mono font-bold text-white bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/20">
                    {fmt(kpis.bcTarget, 1)} Cum ({fmt(kpis.bcTarget * 2.35, 0)} MT)
                  </span>
                </div>
              </div>

              {isBcSelected && (
                <div className="hidden sm:block">
                  <MiniTripleBarChart
                    planned={kpis.bcTarget}
                    actual={kpis.bcAchieved}
                    balance={bcBalance}
                    unit="Cum"
                    actualColor="#A855F7"
                  />
                </div>
              )}
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="w-full h-2 rounded-full bg-[#100E0B] border border-purple-500/20 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500 shadow-sm shadow-purple-500/50"
                  style={{ width: `${isBcSelected ? Math.min(kpis.bcPercent, 100) : 0}%` }}
                />
              </div>

              <div className="mt-2.5 flex items-center justify-between text-xs gap-1.5 min-w-0">
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-purple-950/70 border border-purple-500/40 text-purple-300 font-bold font-mono whitespace-nowrap shrink-0">
                  <Layers className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span>
                    {isBcSelected
                      ? kpis.bcAchieved === 0
                        ? 'Phase 2: Post-DBM'
                        : 'Wearing Course: Active'
                      : 'Filter: Inactive'}
                  </span>
                </span>

                {isBcSelected && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#14120E] border border-purple-500/30 text-xs font-mono shadow-sm whitespace-nowrap shrink-0">
                    <span className="text-slate-400 font-medium">Balance:</span>
                    <span className="text-purple-300 font-extrabold whitespace-nowrap">
                      {fmt(bcBalance, 1)}&nbsp;Cum
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KPICards;
