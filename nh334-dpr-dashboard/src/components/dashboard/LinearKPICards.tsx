import React, { useMemo } from 'react';
import {
  TrendingUp,
  Layers,
  Flame,
  Truck,
  AlertTriangle,
  Milestone,
  CheckCircle2,
  Clock,
  Ruler,
  Navigation,
  Compass
} from 'lucide-react';
import { ActualDPRRow, ProjectBaseline, ActivityType, BOQCardMetric } from '../../types/dpr';
import { Card, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { MiniTripleBarChart } from '../ui/MiniTripleBarChart';
import { calculateUniqueLinearLength } from '../../utils/excelParser';

interface LinearKPICardsProps {
  actualRows: ActualDPRRow[];
  baseline: ProjectBaseline;
  selectedActivities?: ActivityType[];
  side?: 'LHS' | 'RHS' | 'Both';
  selectedDate?: string;
  boqMetrics?: {
    milling: BOQCardMetric;
    tackcoat: BOQCardMetric;
    dbm: BOQCardMetric;
    bc: BOQCardMetric;
  };
}

export const LinearKPICards: React.FC<LinearKPICardsProps> = ({
  actualRows,
  baseline,
  selectedActivities,
  side,
  selectedDate,
  boqMetrics
}) => {
  // Format numbers with comma and optional decimal places
  const fmt = (num: number, decimals: number = 0) =>
    num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });

  const isMillingSelected = !selectedActivities || selectedActivities.includes('Milling');
  const isTackSelected = !selectedActivities || selectedActivities.includes('Tackcoat');
  const isDbmSelected = !selectedActivities || selectedActivities.includes('DBM');
  const isBcSelected = !selectedActivities || selectedActivities.includes('BC');

  // Baseline planned corridor lengths per activity from Work Program.xlsx:
  // Milling: 91,176 m (MCW -Milling & DBM (BHS))
  // Tackcoat: 103,286 m (MCW -BC (BHS))
  // DBM: 91,176 m (MCW -Milling & DBM (BHS))
  // BC: 103,286 m (MCW -BC (BHS))
  let millingPlannedLengthM = baseline.millingPlannedLengthM || 91176;
  let tackPlannedLengthM = baseline.tackcoatPlannedLengthM || 103286;
  let dbmPlannedLengthM = baseline.dbmPlannedLengthM || 91176;
  let bcPlannedLengthM = baseline.totalBcTargetLengthM || 103286;

  if (side === 'LHS' && baseline.lhs) {
    millingPlannedLengthM = baseline.lhs.millingLengthM;
    tackPlannedLengthM = baseline.lhs.tackcoatLengthM;
    dbmPlannedLengthM = baseline.lhs.dbmLengthM;
    if (baseline.lhs.bcLengthM) bcPlannedLengthM = baseline.lhs.bcLengthM;
  } else if (side === 'RHS' && baseline.rhs) {
    millingPlannedLengthM = baseline.rhs.millingLengthM;
    tackPlannedLengthM = baseline.rhs.tackcoatLengthM;
    dbmPlannedLengthM = baseline.rhs.dbmLengthM;
    if (baseline.rhs.bcLengthM) bcPlannedLengthM = baseline.rhs.bcLengthM;
  }

  // Compute Linear distances achieved using non-overlapping merged chainage intervals
  const linearMetrics = useMemo(() => {
    if (boqMetrics) {
      const millingM = boqMetrics.milling.cumulativeCompletedLengthM;
      const millingKm = boqMetrics.milling.cumulativeCompletedLengthKm;
      const millingDailyM = boqMetrics.milling.dailyCompletedLengthM;
      const millingDailyKm = boqMetrics.milling.dailyCompletedLengthKm;
      const millingPercent = boqMetrics.milling.linearProgressPercent;
      const millingRemainingM = boqMetrics.milling.balanceLengthM;

      const tackM = boqMetrics.tackcoat.cumulativeCompletedLengthM;
      const tackKm = boqMetrics.tackcoat.cumulativeCompletedLengthKm;
      const tackDailyM = boqMetrics.tackcoat.dailyCompletedLengthM;
      const tackDailyKm = boqMetrics.tackcoat.dailyCompletedLengthKm;
      const tackPercent = boqMetrics.tackcoat.linearProgressPercent;
      const tackRemainingM = boqMetrics.tackcoat.balanceLengthM;

      const dbmM = boqMetrics.dbm.cumulativeCompletedLengthM;
      const dbmKm = boqMetrics.dbm.cumulativeCompletedLengthKm;
      const dbmDailyM = boqMetrics.dbm.dailyCompletedLengthM;
      const dbmDailyKm = boqMetrics.dbm.dailyCompletedLengthKm;
      const dbmPercent = boqMetrics.dbm.linearProgressPercent;
      const dbmRemainingM = boqMetrics.dbm.balanceLengthM;

      const bcM = boqMetrics.bc.cumulativeCompletedLengthM;
      const bcKm = boqMetrics.bc.cumulativeCompletedLengthKm;
      const bcDailyM = boqMetrics.bc.dailyCompletedLengthM;
      const bcDailyKm = boqMetrics.bc.dailyCompletedLengthKm;
      const bcPercent = boqMetrics.bc.linearProgressPercent;
      const bcRemainingM = boqMetrics.bc.balanceLengthM;

      const tackSync = millingM > 0 ? (tackM / millingM) * 100 : 0;
      const dbmSync = millingM > 0 ? (dbmM / millingM) * 100 : 0;
      const exposedGapM = Math.max(0, millingM - dbmM);
      const exposedGapKm = exposedGapM / 1000;

      // Requirement 2 Dual Measurements
      const millingDailyLaneM = boqMetrics.milling.dailyExecutedLaneLengthM || millingDailyM;
      const millingDailyLaneKm = boqMetrics.milling.dailyExecutedLaneLengthKm || millingDailyKm;
      const millingCumLaneM = boqMetrics.milling.cumulativeExecutedLaneLengthM || millingM;
      const millingCumLaneKm = boqMetrics.milling.cumulativeExecutedLaneLengthKm || millingKm;

      const tackDailyLaneM = boqMetrics.tackcoat.dailyExecutedLaneLengthM || tackDailyM;
      const tackDailyLaneKm = boqMetrics.tackcoat.dailyExecutedLaneLengthKm || tackDailyKm;
      const tackCumLaneM = boqMetrics.tackcoat.cumulativeExecutedLaneLengthM || tackM;
      const tackCumLaneKm = boqMetrics.tackcoat.cumulativeExecutedLaneLengthKm || tackKm;

      const dbmDailyLaneM = boqMetrics.dbm.dailyExecutedLaneLengthM || dbmDailyM;
      const dbmDailyLaneKm = boqMetrics.dbm.dailyExecutedLaneLengthKm || dbmDailyKm;
      const dbmCumLaneM = boqMetrics.dbm.cumulativeExecutedLaneLengthM || dbmM;
      const dbmCumLaneKm = boqMetrics.dbm.cumulativeExecutedLaneLengthKm || dbmKm;

      const bcDailyLaneM = boqMetrics.bc.dailyExecutedLaneLengthM || bcDailyM;
      const bcDailyLaneKm = boqMetrics.bc.dailyExecutedLaneLengthKm || bcDailyKm;
      const bcCumLaneM = boqMetrics.bc.cumulativeExecutedLaneLengthM || bcM;
      const bcCumLaneKm = boqMetrics.bc.cumulativeExecutedLaneLengthKm || bcKm;

      return {
        millingM,
        millingKm,
        millingDailyM,
        millingDailyKm,
        millingPercent,
        millingRemainingM,
        millingDailyLaneM,
        millingDailyLaneKm,
        millingCumLaneM,
        millingCumLaneKm,
        tackM,
        tackKm,
        tackDailyM,
        tackDailyKm,
        tackPercent,
        tackRemainingM,
        tackDailyLaneM,
        tackDailyLaneKm,
        tackCumLaneM,
        tackCumLaneKm,
        tackSync,
        dbmM,
        dbmKm,
        dbmDailyM,
        dbmDailyKm,
        dbmPercent,
        dbmRemainingM,
        dbmDailyLaneM,
        dbmDailyLaneKm,
        dbmCumLaneM,
        dbmCumLaneKm,
        dbmSync,
        bcM,
        bcKm,
        bcDailyM,
        bcDailyKm,
        bcPercent,
        bcRemainingM,
        bcDailyLaneM,
        bcDailyLaneKm,
        bcCumLaneM,
        bcCumLaneKm,
        exposedGapM,
        exposedGapKm
      };
    }

    // Fallback: merge intervals from actualRows
    const mLen = calculateUniqueLinearLength(actualRows, 'Milling', side);
    const tLen = calculateUniqueLinearLength(actualRows, 'Tackcoat', side);
    const dLen = calculateUniqueLinearLength(actualRows, 'DBM', side);
    const bLen = calculateUniqueLinearLength(actualRows, 'BC', side);

    const millingM = mLen.meters;
    const millingKm = mLen.km;
    const tackM = tLen.meters;
    const tackKm = tLen.km;
    const dbmM = dLen.meters;
    const dbmKm = dLen.km;
    const bcM = bLen.meters;
    const bcKm = bLen.km;

    const millingPercent = millingPlannedLengthM > 0 ? (millingM / millingPlannedLengthM) * 100 : 0;
    const tackPercent = tackPlannedLengthM > 0 ? (tackM / tackPlannedLengthM) * 100 : 0;
    const dbmPercent = dbmPlannedLengthM > 0 ? (dbmM / dbmPlannedLengthM) * 100 : 0;
    const bcPercent = 103286 > 0 ? (bcM / 103286) * 100 : 0;

    const millingRemainingM = Math.max(0, millingPlannedLengthM - millingM);
    const tackRemainingM = Math.max(0, tackPlannedLengthM - tackM);
    const dbmRemainingM = Math.max(0, dbmPlannedLengthM - dbmM);
    const bcRemainingM = Math.max(0, 103286 - bcM);

    const tackSync = millingM > 0 ? (tackM / millingM) * 100 : 0;
    const dbmSync = millingM > 0 ? (dbmM / millingM) * 100 : 0;
    const exposedGapM = Math.max(0, millingM - dbmM);
    const exposedGapKm = exposedGapM / 1000;

    return {
      millingM,
      millingKm,
      millingDailyM: 0,
      millingDailyKm: 0,
      millingPercent,
      millingRemainingM,
      millingDailyLaneM: 0,
      millingDailyLaneKm: 0,
      millingCumLaneM: millingM,
      millingCumLaneKm: millingKm,
      tackM,
      tackKm,
      tackDailyM: 0,
      tackDailyKm: 0,
      tackPercent,
      tackRemainingM,
      tackDailyLaneM: 0,
      tackDailyLaneKm: 0,
      tackCumLaneM: tackM,
      tackCumLaneKm: tackKm,
      tackSync,
      dbmM,
      dbmKm,
      dbmDailyM: 0,
      dbmDailyKm: 0,
      dbmPercent,
      dbmRemainingM,
      dbmDailyLaneM: 0,
      dbmDailyLaneKm: 0,
      dbmCumLaneM: dbmM,
      dbmCumLaneKm: dbmKm,
      dbmSync,
      bcM,
      bcKm,
      bcDailyM: 0,
      bcDailyKm: 0,
      bcPercent,
      bcRemainingM,
      bcDailyLaneM: 0,
      bcDailyLaneKm: 0,
      bcCumLaneM: bcM,
      bcCumLaneKm: bcKm,
      exposedGapM,
      exposedGapKm
    };
  }, [boqMetrics, actualRows, millingPlannedLengthM, tackPlannedLengthM, dbmPlannedLengthM, side]);

  return (
    <div className="space-y-2.5 mb-4">
      {/* ============================================================== */}
      {/* THEME 1: PHYSICAL LINEAR PROGRESS (HIGHWAY BLUEPRINT THEME)    */}
      {/* ============================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/25 to-blue-600/20 border border-cyan-400/50 text-cyan-300 shadow-lg shadow-cyan-950/60 flex items-center justify-center">
            <Ruler className="w-4 h-4 text-cyan-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-[9px] font-mono font-extrabold uppercase tracking-widest text-cyan-300">
                Linear Distance // Meters & Km
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-[10px] font-mono text-cyan-400/80 font-semibold">Corridor Alignment</span>
            </div>
            <h2 className="text-sm font-black uppercase tracking-wider text-white drop-shadow-sm flex items-center gap-2 mt-0.5">
              <span>Physical Linear Highway Progress & Chainage Metrics</span>
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-300">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0D1524] border border-cyan-500/30 shadow-sm font-medium text-cyan-200">
            <Navigation className="w-3 h-3 text-cyan-400" />
            Corridor: Ch. 130+560 to 206+220 BHS
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0D1524] border border-cyan-500/30 shadow-sm font-medium text-cyan-300">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            Target: 91.18 km
          </span>
        </div>
      </div>

      {/* 4 Linear KPI Cards Grid - Cyber Blueprint Slate Theme */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* ============================================================== */}
        {/* Card 1: Milling Progress (Linear Removed)                      */}
        {/* ============================================================== */}
        <div
          className={`relative group transition-all duration-300 rounded-2xl overflow-hidden bg-gradient-to-b from-[#0F172A] to-[#0A0F1D] border border-cyan-500/30 shadow-xl shadow-cyan-950/20 ${
            isMillingSelected ? 'opacity-100 ring-1 ring-cyan-400/40' : 'opacity-40 grayscale-[40%]'
          }`}
        >
          {/* Top Highway Centerline Ribbon */}
          <div className="h-1.5 w-full bg-gradient-to-r from-cyan-500 via-amber-400 to-amber-500 relative">
            <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_8px,rgba(0,0,0,0.4)_8px,rgba(0,0,0,0.4)_16px)]" />
          </div>

          <div className="px-3.5 py-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2.5 rounded-xl border ${
                    isMillingSelected
                      ? 'bg-amber-500/15 text-amber-300 border-amber-400/40 shadow-md shadow-amber-950/40'
                      : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}
                >
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold uppercase tracking-wider text-white drop-shadow-sm">
                      Milling
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30 font-mono font-bold">
                      Length
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">Chainage stripped</p>
                </div>
              </div>

              {isMillingSelected ? (
                <Badge
                  variant={linearMetrics.millingPercent >= 10 ? 'emerald' : 'amber'}
                  size="sm"
                  className="font-mono font-bold shadow-sm"
                >
                  {`${linearMetrics.millingPercent.toFixed(1)}% Target`}
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
                    {isMillingSelected ? fmt(linearMetrics.millingM) : '—'}
                  </span>
                  <span className="text-xs text-cyan-400 font-bold font-mono">m</span>
                  {isMillingSelected && (
                    <span className="text-xs text-amber-300 font-mono ml-1 font-bold">
                      ({linearMetrics.millingKm.toFixed(2)} km)
                    </span>
                  )}
                </div>

                {/* Dual Measurement: Executed Lane Length */}
                {isMillingSelected && (
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-200/90 mt-1 font-medium font-mono">
                    <span className="text-slate-400">Lane Length:</span>
                    <span className="font-bold">
                      {fmt(linearMetrics.millingCumLaneM)} m ({linearMetrics.millingCumLaneKm.toFixed(2)} km)
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-1 font-medium">
                  <span className="text-slate-400">Target:</span>
                  <span className="font-mono font-bold text-white bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/20">
                    {fmt(millingPlannedLengthM)} m ({(millingPlannedLengthM / 1000).toFixed(2)} km)
                  </span>
                </div>

                {/* Today: Dual measurements if recorded */}
                {linearMetrics.millingDailyM > 0 && (
                  <div className="mt-1 pt-1 border-t border-cyan-500/15 space-y-0.5">
                    <div className="flex items-center gap-1.5 text-[11px] text-amber-300 font-medium">
                      <span className="text-slate-400">Today Coverage:</span>
                      <span className="font-mono font-bold">
                        +{fmt(linearMetrics.millingDailyM)} m ({linearMetrics.millingDailyKm.toFixed(2)} km)
                      </span>
                    </div>
                    {linearMetrics.millingDailyLaneM !== linearMetrics.millingDailyM && (
                      <div className="flex items-center gap-1.5 text-[10px] text-amber-200/90 font-medium font-mono">
                        <span className="text-slate-400">Today Lane:</span>
                        <span className="font-bold">
                          +{fmt(linearMetrics.millingDailyLaneM)} m ({linearMetrics.millingDailyLaneKm.toFixed(2)} km)
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {isMillingSelected && (
                <div className="hidden sm:block">
                  <MiniTripleBarChart
                    planned={millingPlannedLengthM}
                    actual={linearMetrics.millingM}
                    balance={linearMetrics.millingRemainingM}
                    unit="m"
                    actualColor="#F59E0B"
                  />
                </div>
              )}
            </div>

            {/* Progress Bar with Highway Ticks */}
            <div className="mt-4">
              <div className="w-full h-2 rounded-full bg-[#090D16] border border-cyan-500/20 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-500 shadow-sm shadow-amber-500/50"
                  style={{
                    width: `${isMillingSelected ? Math.min(linearMetrics.millingPercent, 100) : 0}%`
                  }}
                />
              </div>

              <div className="mt-2.5 flex items-center justify-between text-xs gap-1.5 min-w-0">
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-950/70 border border-amber-500/40 text-amber-300 font-bold font-mono whitespace-nowrap shrink-0">
                  <TrendingUp className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>
                    {isMillingSelected ? (
                      <>
                        <span className="hidden 2xl:inline">Stripping:&nbsp;</span>Active
                      </>
                    ) : (
                      'Inactive'
                    )}
                  </span>
                </span>

                {isMillingSelected && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0A101D] border border-cyan-500/30 text-xs font-mono shadow-sm whitespace-nowrap shrink-0">
                    <span className="text-slate-400 font-medium">Balance:</span>
                    <span className="font-extrabold text-amber-300 whitespace-nowrap">
                      {fmt(linearMetrics.millingRemainingM)}&nbsp;m
                    </span>
                    <span className="text-slate-300 font-bold whitespace-nowrap">
                      ({(linearMetrics.millingRemainingM / 1000).toFixed(1)}&nbsp;km)
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* Card 2: Tack Coat Progress (Linear Removed)                    */}
        {/* ============================================================== */}
        <div
          className={`relative group transition-all duration-300 rounded-2xl overflow-hidden bg-gradient-to-b from-[#0F172A] to-[#0A0F1D] border border-cyan-500/30 shadow-xl shadow-cyan-950/20 ${
            isTackSelected ? 'opacity-100 ring-1 ring-cyan-400/40' : 'opacity-40 grayscale-[40%]'
          }`}
        >
          {/* Top Highway Centerline Ribbon */}
          <div className="h-1.5 w-full bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 relative">
            <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_8px,rgba(0,0,0,0.4)_8px,rgba(0,0,0,0.4)_16px)]" />
          </div>

          <div className="px-3.5 py-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2.5 rounded-xl border ${
                    isTackSelected
                      ? 'bg-cyan-500/15 text-cyan-300 border-cyan-400/40 shadow-md shadow-cyan-950/40'
                      : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}
                >
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold uppercase tracking-wider text-white drop-shadow-sm">
                      Tack Coat
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30 font-mono font-bold">
                      Length
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">Bitumen emulsion seal</p>
                </div>
              </div>

              {isTackSelected ? (
                <Badge
                  variant={linearMetrics.tackPercent >= 8.5 ? 'emerald' : 'cyan'}
                  size="sm"
                  className="font-mono font-bold shadow-sm"
                >
                  {`${linearMetrics.tackPercent.toFixed(1)}% Target`}
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
                    {isTackSelected ? fmt(linearMetrics.tackM) : '—'}
                  </span>
                  <span className="text-xs text-cyan-400 font-bold font-mono">m</span>
                  {isTackSelected && (
                    <span className="text-xs text-cyan-300 font-mono ml-1 font-bold">
                      ({linearMetrics.tackKm.toFixed(2)} km)
                    </span>
                  )}
                </div>

                {/* Dual Measurement: Executed Lane Length */}
                {isTackSelected && (
                  <div className="flex items-center gap-1.5 text-[11px] text-cyan-200/90 mt-1 font-medium font-mono">
                    <span className="text-slate-400">Lane Length:</span>
                    <span className="font-bold">
                      {fmt(linearMetrics.tackCumLaneM)} m ({linearMetrics.tackCumLaneKm.toFixed(2)} km)
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-1 font-medium">
                  <span className="text-slate-400">Target:</span>
                  <span className="font-mono font-bold text-white bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/20">
                    {fmt(tackPlannedLengthM)} m ({(tackPlannedLengthM / 1000).toFixed(2)} km)
                  </span>
                </div>

                {/* Today: Dual measurements if recorded */}
                {linearMetrics.tackDailyM > 0 && (
                  <div className="mt-1 pt-1 border-t border-cyan-500/15 space-y-0.5">
                    <div className="flex items-center gap-1.5 text-[11px] text-cyan-300 font-medium">
                      <span className="text-slate-400">Today Coverage:</span>
                      <span className="font-mono font-bold">
                        +{fmt(linearMetrics.tackDailyM)} m ({linearMetrics.tackDailyKm.toFixed(2)} km)
                      </span>
                    </div>
                    {linearMetrics.tackDailyLaneM !== linearMetrics.tackDailyM && (
                      <div className="flex items-center gap-1.5 text-[10px] text-cyan-200/90 font-medium font-mono">
                        <span className="text-slate-400">Today Lane:</span>
                        <span className="font-bold">
                          +{fmt(linearMetrics.tackDailyLaneM)} m ({linearMetrics.tackDailyLaneKm.toFixed(2)} km)
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {isTackSelected && (
                <div className="hidden sm:block">
                  <MiniTripleBarChart
                    planned={tackPlannedLengthM}
                    actual={linearMetrics.tackM}
                    balance={linearMetrics.tackRemainingM}
                    unit="m"
                    actualColor="#06B6D4"
                  />
                </div>
              )}
            </div>

            {/* Progress Bar with Highway Ticks */}
            <div className="mt-4">
              <div className="w-full h-2 rounded-full bg-[#090D16] border border-cyan-500/20 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all duration-500 shadow-sm shadow-cyan-500/50"
                  style={{
                    width: `${isTackSelected ? Math.min(linearMetrics.tackPercent, 100) : 0}%`
                  }}
                />
              </div>

              <div className="mt-2.5 flex items-center justify-between text-xs gap-1.5 min-w-0">
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 font-bold font-mono whitespace-nowrap shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>
                    {isTackSelected ? (
                      <>
                        <span className="hidden 2xl:inline">Milling&nbsp;</span>Sync:&nbsp;{linearMetrics.tackSync.toFixed(1)}%
                      </>
                    ) : (
                      'Inactive'
                    )}
                  </span>
                </span>

                {isTackSelected && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0A101D] border border-cyan-500/30 text-xs font-mono shadow-sm whitespace-nowrap shrink-0">
                    <span className="text-slate-400 font-medium">Balance:</span>
                    <span className="font-extrabold text-cyan-300 whitespace-nowrap">
                      {fmt(linearMetrics.tackRemainingM)}&nbsp;m
                    </span>
                    <span className="text-slate-300 font-bold whitespace-nowrap">
                      ({(linearMetrics.tackRemainingM / 1000).toFixed(1)}&nbsp;km)
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* Card 3: DBM Laid (Linear Removed)                              */}
        {/* ============================================================== */}
        <div
          className={`relative group transition-all duration-300 rounded-2xl overflow-hidden bg-gradient-to-b from-[#0F172A] to-[#0A0F1D] border border-cyan-500/30 shadow-xl shadow-cyan-950/20 ${
            isDbmSelected ? 'opacity-100 ring-1 ring-cyan-400/40' : 'opacity-40 grayscale-[40%]'
          }`}
        >
          {/* Top Highway Centerline Ribbon */}
          <div className="h-1.5 w-full bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-500 relative">
            <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_8px,rgba(0,0,0,0.4)_8px,rgba(0,0,0,0.4)_16px)]" />
          </div>

          <div className="px-3.5 py-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2.5 rounded-xl border ${
                    isDbmSelected
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40 shadow-md shadow-emerald-950/40'
                      : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}
                >
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold uppercase tracking-wider text-white drop-shadow-sm">
                      DBM Laid
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30 font-mono font-bold">
                      Length
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">50mm base course paved</p>
                </div>
              </div>

              {isDbmSelected ? (
                <Badge
                  variant={linearMetrics.dbmPercent >= 8.5 ? 'emerald' : 'cyan'}
                  size="sm"
                  className="font-mono font-bold shadow-sm"
                >
                  {`${linearMetrics.dbmPercent.toFixed(1)}% Paved`}
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
                    {isDbmSelected ? fmt(linearMetrics.dbmM) : '—'}
                  </span>
                  <span className="text-xs text-cyan-400 font-bold font-mono">m</span>
                  {isDbmSelected && (
                    <span className="text-xs text-emerald-300 font-mono ml-1 font-bold">
                      ({linearMetrics.dbmKm.toFixed(2)} km)
                    </span>
                  )}
                </div>

                {/* Dual Measurement: Executed Lane Length */}
                {isDbmSelected && (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-200/90 mt-1 font-medium font-mono">
                    <span className="text-slate-400">Lane Length:</span>
                    <span className="font-bold">
                      {fmt(linearMetrics.dbmCumLaneM)} m ({linearMetrics.dbmCumLaneKm.toFixed(2)} km)
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-1 font-medium">
                  <span className="text-slate-400">Target:</span>
                  <span className="font-mono font-bold text-white bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/20">
                    {fmt(dbmPlannedLengthM)} m ({(dbmPlannedLengthM / 1000).toFixed(2)} km)
                  </span>
                </div>

                {/* Today: Dual measurements if recorded */}
                {linearMetrics.dbmDailyM > 0 && (
                  <div className="mt-1 pt-1 border-t border-cyan-500/15 space-y-0.5">
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-300 font-medium">
                      <span className="text-slate-400">Today Coverage:</span>
                      <span className="font-mono font-bold">
                        +{fmt(linearMetrics.dbmDailyM)} m ({linearMetrics.dbmDailyKm.toFixed(2)} km)
                      </span>
                    </div>
                    {linearMetrics.dbmDailyLaneM !== linearMetrics.dbmDailyM && (
                      <div className="flex items-center gap-1.5 text-[10px] text-emerald-200/90 font-medium font-mono">
                        <span className="text-slate-400">Today Lane:</span>
                        <span className="font-bold">
                          +{fmt(linearMetrics.dbmDailyLaneM)} m ({linearMetrics.dbmDailyLaneKm.toFixed(2)} km)
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {isDbmSelected && (
                <div className="hidden sm:block">
                  <MiniTripleBarChart
                    planned={dbmPlannedLengthM}
                    actual={linearMetrics.dbmM}
                    balance={linearMetrics.dbmRemainingM}
                    unit="m"
                    actualColor="#10B981"
                  />
                </div>
              )}
            </div>

            {/* Progress Bar with Highway Ticks */}
            <div className="mt-4">
              <div className="w-full h-2 rounded-full bg-[#090D16] border border-cyan-500/20 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-500 shadow-sm shadow-emerald-500/50"
                  style={{
                    width: `${isDbmSelected ? Math.min(linearMetrics.dbmPercent, 100) : 0}%`
                  }}
                />
              </div>

              <div className="mt-2.5 flex items-center justify-between text-xs gap-1.5 min-w-0">
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 font-bold font-mono whitespace-nowrap shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>
                    {isDbmSelected ? (
                      <>
                        <span className="hidden 2xl:inline">Milling&nbsp;</span>Covered:&nbsp;{linearMetrics.dbmSync.toFixed(1)}%
                      </>
                    ) : (
                      'Inactive'
                    )}
                  </span>
                </span>

                {isDbmSelected && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0A101D] border border-cyan-500/30 text-xs font-mono shadow-sm whitespace-nowrap shrink-0">
                    <span className="text-slate-400 font-medium">Balance:</span>
                    <span className="font-extrabold text-emerald-300 whitespace-nowrap">
                      {fmt(linearMetrics.dbmRemainingM)}&nbsp;m
                    </span>
                    <span className="text-slate-300 font-bold whitespace-nowrap">
                      ({(linearMetrics.dbmRemainingM / 1000).toFixed(1)}&nbsp;km)
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* Card 4: BC Layer Laid & Exposed Gap                            */}
        {/* ============================================================== */}
        <div
          className={`relative group transition-all duration-300 rounded-2xl overflow-hidden bg-gradient-to-b from-[#0F172A] to-[#0A0F1D] border ${
            isBcSelected ? 'border-teal-500/30 shadow-teal-950/20' : 'border-rose-500/30 shadow-rose-950/20'
          } shadow-xl ${
            isBcSelected ? 'opacity-100 ring-1 ring-teal-400/40' : 'opacity-40 grayscale-[40%]'
          }`}
        >
          {/* Top Highway Centerline Ribbon */}
          <div className="h-1.5 w-full bg-gradient-to-r from-teal-400 via-cyan-400 to-rose-500 relative">
            <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_8px,rgba(0,0,0,0.4)_8px,rgba(0,0,0,0.4)_16px)]" />
          </div>

          <div className="px-3.5 py-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2.5 rounded-xl border ${
                    isBcSelected
                      ? 'bg-teal-500/15 text-teal-300 border-teal-400/40 shadow-md shadow-teal-950/40'
                      : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}
                >
                  <Navigation className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold uppercase tracking-wider text-white drop-shadow-sm">
                      BC Layer Laid
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30 font-mono font-bold">
                      Length
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">40mm wearing course</p>
                </div>
              </div>

              {isBcSelected ? (
                <Badge
                  variant={linearMetrics.bcPercent >= 1 ? 'emerald' : 'cyan'}
                  size="sm"
                  className="font-mono font-bold shadow-sm"
                >
                  {`${linearMetrics.bcPercent.toFixed(1)}% Target`}
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
                    {isBcSelected ? fmt(linearMetrics.bcM) : '—'}
                  </span>
                  <span className="text-xs text-cyan-400 font-bold font-mono">m</span>
                  {isBcSelected && (
                    <span className="text-xs text-teal-300 font-mono ml-1 font-bold">
                      ({linearMetrics.bcKm.toFixed(2)} km)
                    </span>
                  )}
                </div>

                {/* Dual Measurement: Executed Lane Length */}
                {isBcSelected && (
                  <div className="flex items-center gap-1.5 text-[11px] text-teal-200/90 mt-1 font-medium font-mono">
                    <span className="text-slate-400">Lane Length:</span>
                    <span className="font-bold">
                      {fmt(linearMetrics.bcCumLaneM)} m ({linearMetrics.bcCumLaneKm.toFixed(2)} km)
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-1 font-medium">
                  <span className="text-slate-400">Target:</span>
                  <span className="font-mono font-bold text-white bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/20">
                    {fmt(bcPlannedLengthM)} m ({(bcPlannedLengthM / 1000).toFixed(2)} km)
                  </span>
                </div>

                {/* Today: Dual measurements if recorded */}
                {linearMetrics.bcDailyM > 0 && (
                  <div className="mt-1 pt-1 border-t border-cyan-500/15 space-y-0.5">
                    <div className="flex items-center gap-1.5 text-[11px] text-teal-300 font-medium">
                      <span className="text-slate-400">Today Coverage:</span>
                      <span className="font-mono font-bold">
                        +{fmt(linearMetrics.bcDailyM)} m ({linearMetrics.bcDailyKm.toFixed(2)} km)
                      </span>
                    </div>
                    {linearMetrics.bcDailyLaneM !== linearMetrics.bcDailyM && (
                      <div className="flex items-center gap-1.5 text-[10px] text-teal-200/90 font-medium font-mono">
                        <span className="text-slate-400">Today Lane:</span>
                        <span className="font-bold">
                          +{fmt(linearMetrics.bcDailyLaneM)} m ({linearMetrics.bcDailyLaneKm.toFixed(2)} km)
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {isBcSelected && (
                <div className="hidden sm:block">
                  <MiniTripleBarChart
                    planned={bcPlannedLengthM}
                    actual={linearMetrics.bcM}
                    balance={linearMetrics.bcRemainingM}
                    unit="m"
                    actualColor="#14B8A6"
                  />
                </div>
              )}
            </div>

            {/* Progress Bar with Highway Ticks */}
            <div className="mt-4">
              <div className="w-full h-2 rounded-full bg-[#090D16] border border-cyan-500/20 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-teal-400 to-cyan-500 rounded-full transition-all duration-500 shadow-sm shadow-teal-500/50"
                  style={{
                    width: `${isBcSelected ? Math.min(linearMetrics.bcPercent, 100) : 0}%`
                  }}
                />
              </div>

              <div className="mt-2.5 flex items-center justify-between text-xs gap-1.5 min-w-0">
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-rose-950/70 border border-rose-500/40 text-rose-300 font-bold font-mono whitespace-nowrap shrink-0">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>
                    Exposed Gap: {fmt(linearMetrics.exposedGapM)} m
                  </span>
                </span>

                {isBcSelected && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0A101D] border border-cyan-500/30 text-xs font-mono shadow-sm whitespace-nowrap shrink-0">
                    <span className="text-slate-400 font-medium">Balance:</span>
                    <span className="font-extrabold text-teal-300 whitespace-nowrap">
                      {fmt(linearMetrics.bcRemainingM)}&nbsp;m
                    </span>
                    <span className="text-slate-300 font-bold whitespace-nowrap">
                      ({(linearMetrics.bcRemainingM / 1000).toFixed(1)}&nbsp;km)
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

export default LinearKPICards;
