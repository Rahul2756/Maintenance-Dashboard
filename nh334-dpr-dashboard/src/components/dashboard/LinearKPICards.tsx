import React, { useMemo, useState } from 'react';
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
  Compass,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter
} from 'lucide-react';
import { ActualDPRRow, ProjectBaseline, ActivityType, BOQCardMetric, HighwaySide } from '../../types/dpr';
import { Badge } from '../ui/Badge';
import { MiniTripleBarChart } from '../ui/MiniTripleBarChart';
import { serialToIsoDate, isoToDisplayDate } from '../../utils/excelParser';

interface LinearKPICardsProps {
  actualRows: ActualDPRRow[];
  baseline: ProjectBaseline;
  selectedActivities?: ActivityType[];
  side?: HighwaySide;
  selectedDate?: string;
  availableDates?: string[];
  boqMetrics?: {
    milling: BOQCardMetric;
    tackcoat: BOQCardMetric;
    dbm: BOQCardMetric;
    bc: BOQCardMetric;
  };
  onDateChange?: (date: string) => void;
  onActivitySelect?: (activity: ActivityType | 'All') => void;
}

export const LinearKPICards: React.FC<LinearKPICardsProps> = ({
  actualRows,
  baseline,
  selectedActivities,
  side = 'Both',
  selectedDate,
  availableDates,
  boqMetrics,
  onDateChange,
  onActivitySelect
}) => {
  // Format numbers with commas and fixed decimals
  const fmt = (num: number, decimals: number = 0) =>
    num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });

  // Extract all distinct work dates from actualRows (chronological)
  const allDates = useMemo(() => {
    if (availableDates && availableDates.length > 0) {
      return availableDates;
    }
    const set = new Set<string>();
    actualRows.forEach((r) => {
      if (r.date) set.add(r.date);
    });
    return Array.from(set).sort((a, b) => {
      const isoA = serialToIsoDate(a);
      const isoB = serialToIsoDate(b);
      return isoA.localeCompare(isoB);
    });
  }, [availableDates, actualRows]);

  // Fallback date is latest available in dataset
  const latestDate = allDates[allDates.length - 1] || '01.11.2026';
  const effectiveDate = selectedDate || latestDate;

  // Selected date ISO and human-readable format (e.g. 14-Oct-2026)
  const selectedIso = serialToIsoDate(effectiveDate);
  const selectedDisplayDate = isoToDisplayDate(selectedIso);

  // Current date index in available dates list for stepping
  const currentDateIndex = useMemo(() => {
    const idx = allDates.findIndex(
      (d) => serialToIsoDate(d) === selectedIso || d === effectiveDate
    );
    return idx >= 0 ? idx : allDates.length - 1;
  }, [allDates, selectedIso, effectiveDate]);

  // Local activity view state ('All' or specific activity)
  const [selectedActivityFilter, setSelectedActivityFilter] = useState<ActivityType | 'All'>('All');

  const handleDateSelect = (newDate: string) => {
    if (onDateChange) {
      onDateChange(newDate);
    }
  };

  const handlePrevDate = () => {
    if (currentDateIndex > 0) {
      handleDateSelect(allDates[currentDateIndex - 1]);
    }
  };

  const handleNextDate = () => {
    if (currentDateIndex < allDates.length - 1) {
      handleDateSelect(allDates[currentDateIndex + 1]);
    }
  };

  const handleActivityClick = (act: ActivityType | 'All') => {
    setSelectedActivityFilter(act);
    if (onActivitySelect) {
      onActivitySelect(act);
    }
  };

  // Determine active highlights based on global or local filter
  const isAllActivities = selectedActivityFilter === 'All' && (!selectedActivities || selectedActivities.length >= 4);
  const isMillingSelected = isAllActivities || selectedActivityFilter === 'Milling' || (selectedActivities?.includes('Milling') ?? true);
  const isTackSelected = isAllActivities || selectedActivityFilter === 'Tackcoat' || (selectedActivities?.includes('Tackcoat') ?? true);
  const isDbmSelected = isAllActivities || selectedActivityFilter === 'DBM' || (selectedActivities?.includes('DBM') ?? true);
  const isBcSelected = selectedActivityFilter === 'BC' || (selectedActivities?.includes('BC') && selectedActivities.length === 1);

  // 1. DYNAMIC CONTRACTUAL TARGET LENGTHS FROM STRETCH-WISE SUMMARY
  // Milling: 147.23 km (LHS: 72.36 km, RHS: 74.87 km)
  // Tack Coat: 235.11 km (LHS: 115.12 km, RHS: 120.00 km)
  // DBM: 147.23 km (LHS: 72.36 km, RHS: 74.87 km)
  // BC: 103.29 km (LHS: 49.36 km, RHS: 53.93 km)
  let millingTargetM = baseline.millingPlannedLengthM || 147228;
  let tackTargetM = baseline.tackcoatPlannedLengthM || 235114;
  let dbmTargetM = baseline.dbmPlannedLengthM || 147228;
  let bcTargetM = baseline.totalBcTargetLengthM || 103286;

  if (side === 'LHS' && baseline.lhs) {
    millingTargetM = baseline.lhs.millingLengthM || 72357;
    tackTargetM = baseline.lhs.tackcoatLengthM || 115115;
    dbmTargetM = baseline.lhs.dbmLengthM || 72357;
    bcTargetM = baseline.lhs.bcLengthM || 49358;
  } else if (side === 'RHS' && baseline.rhs) {
    millingTargetM = baseline.rhs.millingLengthM || 74871;
    tackTargetM = baseline.rhs.tackcoatLengthM || 119999;
    dbmTargetM = baseline.rhs.dbmLengthM || 74871;
    bcTargetM = baseline.rhs.bcLengthM || 53928;
  }

  // 2. LINEAR PHYSICAL LENGTH CALCULATION FROM CHAINAGE LOG(INPUT)
  // Priority:
  // 1. Positive valid Length (m) from column L
  // 2. ABS(To Ch. - From Ch.)
  // 3. Length (km) = Length (m) / 1000
  const metrics = useMemo(() => {
    const getRowLengthM = (r: ActualDPRRow): number => {
      if (r.lengthM !== undefined && r.lengthM !== null && !isNaN(r.lengthM) && r.lengthM > 0) {
        return r.lengthM;
      }
      return Math.abs(r.rawToChainage - r.rawFromChainage);
    };

    // Helper to calculate daily & cumulative for any activity
    const calcActivity = (act: ActivityType, targetM: number) => {
      const actRows = actualRows.filter(
        (r) =>
          r.activity === act &&
          (side === 'Both' || side === 'ALL' || side === 'BHS' || r.side === side)
      );

      const dailyRows = actRows.filter((r) => serialToIsoDate(r.date) === selectedIso);
      const cumRows = actRows.filter((r) => serialToIsoDate(r.date) <= selectedIso);

      const dailyM = dailyRows.reduce((sum, r) => sum + getRowLengthM(r), 0);
      const dailyKm = Number((dailyM / 1000).toFixed(3));
      const dailyEntries = dailyRows.length;

      const cumulativeM = cumRows.reduce((sum, r) => sum + getRowLengthM(r), 0);
      const cumulativeKm = Number((cumulativeM / 1000).toFixed(3));
      const cumulativeEntries = cumRows.length;

      const balanceM = Math.max(0, targetM - cumulativeM);
      const balanceKm = Number((balanceM / 1000).toFixed(3));
      const progressPercent = targetM > 0 ? (cumulativeM / targetM) * 100 : 0;

      return {
        targetM,
        targetKm: Number((targetM / 1000).toFixed(2)),
        dailyM,
        dailyKm,
        dailyEntries,
        cumulativeM,
        cumulativeKm,
        cumulativeEntries,
        balanceM,
        balanceKm,
        progressPercent
      };
    };

    const milling = calcActivity('Milling', millingTargetM);
    const tack = calcActivity('Tackcoat', tackTargetM);
    const dbm = calcActivity('DBM', dbmTargetM);
    const bc = calcActivity('BC', bcTargetM);

    // Sync percentages
    const tackSync = milling.cumulativeM > 0 ? (tack.cumulativeM / milling.cumulativeM) * 100 : 0;
    const dbmSync = milling.cumulativeM > 0 ? (dbm.cumulativeM / milling.cumulativeM) * 100 : 0;

    // Exposed Milled Gap = Milling Cumulative Length - DBM Laid Cumulative Length
    const exposedGapM = Math.max(0, milling.cumulativeM - dbm.cumulativeM);
    const exposedGapKm = Number((exposedGapM / 1000).toFixed(2));
    const dailyNetGapM = milling.dailyM - dbm.dailyM;

    return {
      milling,
      tack,
      dbm,
      bc,
      tackSync,
      dbmSync,
      exposedGapM,
      exposedGapKm,
      dailyNetGapM
    };
  }, [actualRows, selectedIso, side, millingTargetM, tackTargetM, dbmTargetM, bcTargetM]);

  return (
    <div className="space-y-3 mb-5">
      {/* ============================================================== */}
      {/* THEME 1: PHYSICAL LINEAR PROGRESS (HIGHWAY BLUEPRINT THEME)    */}
      {/* ============================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-1">
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
              <span className="text-[10px] font-mono text-cyan-400/80 font-semibold">
                Single Source of Truth: final_sheet.xlsx
              </span>
            </div>
            <h2 className="text-sm font-black uppercase tracking-wider text-white drop-shadow-sm flex items-center gap-2 mt-0.5">
              <span>Physical Linear Highway Progress & Chainage Metrics</span>
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-300 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0D1524] border border-cyan-500/30 shadow-sm font-medium text-cyan-200">
            <Navigation className="w-3 h-3 text-cyan-400" />
            Corridor: Ch. 130+560 to 206+220 {side === 'Both' ? 'BHS' : side}
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0D1524] border border-cyan-500/30 shadow-sm font-medium text-cyan-300">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            Corridor Scope: 75.66 km (151.32 km BHS)
          </span>
        </div>
      </div>

      {/* ============================================================== */}
      {/* INTERACTIVE CONTROLS: DATE SELECTOR & ACTIVITY FILTER          */}
      {/* ============================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 sm:p-3 rounded-2xl bg-gradient-to-r from-[#0C1427] via-[#0E1A33] to-[#0A1020] border border-cyan-500/30 shadow-lg shadow-cyan-950/40">
        {/* Left: Prominent Date Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-cyan-950/90 border border-cyan-400/40 text-cyan-300 shadow-sm">
            <Calendar className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider">Date Selector:</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevDate}
              disabled={currentDateIndex <= 0}
              title="Previous work date"
              className="p-1.5 rounded-lg bg-[#0F172A] border border-cyan-500/30 text-cyan-300 hover:bg-cyan-900/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <select
              value={effectiveDate}
              onChange={(e) => handleDateSelect(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-[#0F172A] border border-cyan-400/50 text-cyan-200 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-cyan-400 cursor-pointer shadow-inner"
            >
              {allDates.map((d) => {
                const label = isoToDisplayDate(serialToIsoDate(d));
                return (
                  <option key={d} value={d} className="bg-[#0D1524] text-white">
                    {label} ({d})
                  </option>
                );
              })}
            </select>

            <button
              onClick={handleNextDate}
              disabled={currentDateIndex >= allDates.length - 1}
              title="Next work date"
              className="p-1.5 rounded-lg bg-[#0F172A] border border-cyan-500/30 text-cyan-300 hover:bg-cyan-900/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#080D19] border border-cyan-500/20 text-[11px] font-mono text-slate-300">
            <span className="text-slate-400">As-of Date:</span>
            <span className="text-cyan-300 font-bold">{selectedDisplayDate}</span>
          </div>
        </div>

        {/* Right: Activity Selector */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400 mr-1 hidden sm:flex">
            <Filter className="w-3 h-3 text-cyan-400" />
            <span>Activity:</span>
          </div>
          {(['All', 'Milling', 'Tackcoat', 'DBM', 'BC'] as const).map((act) => {
            const isAll = act === 'All';
            const isActive = isAll
              ? selectedActivityFilter === 'All'
              : selectedActivityFilter === act;
            const label = act === 'Tackcoat' ? 'Tack Coat' : act === 'All' ? 'All Activities' : act;
            return (
              <button
                key={act}
                onClick={() => handleActivityClick(act)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/30 ring-1 ring-cyan-300 scale-105'
                    : 'bg-[#0F172A] border border-cyan-500/20 text-slate-300 hover:bg-cyan-950/50 hover:text-cyan-200'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 4 LINEAR KPI CARDS GRID - CYBER BLUEPRINT SLATE THEME          */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* ============================================================== */}
        {/* Card 1: Milling Progress (Linear Metric)                       */}
        {/* ============================================================== */}
        <div
          className={`relative group transition-all duration-300 rounded-2xl overflow-hidden bg-gradient-to-b from-[#0F172A] to-[#0A0F1D] border border-cyan-500/30 shadow-xl shadow-cyan-950/20 ${
            isMillingSelected ? 'opacity-100 ring-1 ring-amber-400/50' : 'opacity-40 grayscale-[40%]'
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
                  variant={metrics.milling.progressPercent >= 10 ? 'emerald' : 'amber'}
                  size="sm"
                  className="font-mono font-bold shadow-sm"
                >
                  {`${metrics.milling.progressPercent.toFixed(1)}% Target`}
                </Badge>
              ) : (
                <Badge variant="neutral" size="xs">
                  Filtered Out
                </Badge>
              )}
            </div>

            {/* Primary Achieved & Target Section */}
            <div className="mt-4 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight drop-shadow-sm">
                    {isMillingSelected ? fmt(metrics.milling.cumulativeM) : '—'}
                  </span>
                  <span className="text-xs text-cyan-400 font-bold font-mono">m</span>
                  {isMillingSelected && (
                    <span className="text-xs text-amber-300 font-mono ml-1 font-bold">
                      ({metrics.milling.cumulativeKm.toFixed(2)} km)
                    </span>
                  )}
                </div>

                {/* Total Target Length row */}
                <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-1 font-medium flex-wrap">
                  <span className="text-slate-400">Total Target:</span>
                  <span className="font-mono font-bold text-white bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/20">
                    {fmt(metrics.milling.targetM)} m ({metrics.milling.targetKm.toFixed(2)} km)
                  </span>
                </div>

                {/* Selected Day Progress row */}
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-mono">
                  <span className="text-slate-400">Today:</span>
                  {metrics.milling.dailyM > 0 ? (
                    <span className="font-bold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
                      +{fmt(metrics.milling.dailyM)} m ({metrics.milling.dailyKm.toFixed(3)} km)
                      <span className="text-slate-300 text-[10px] ml-1 font-normal">
                        [{metrics.milling.dailyEntries} {metrics.milling.dailyEntries === 1 ? 'entry' : 'entries'}]
                      </span>
                    </span>
                  ) : (
                    <span className="text-slate-500 bg-[#0A101D] px-2 py-0.5 rounded border border-slate-700/50">
                      0 m (0 entries)
                    </span>
                  )}
                </div>
              </div>

              {isMillingSelected && (
                <div className="hidden sm:block shrink-0">
                  <MiniTripleBarChart
                    planned={metrics.milling.targetM}
                    actual={metrics.milling.cumulativeM}
                    balance={metrics.milling.balanceM}
                    unit="m"
                    actualColor="#F59E0B"
                  />
                </div>
              )}
            </div>

            {/* Progress Bar with Highway Ticks */}
            <div className="mt-3.5">
              <div className="w-full h-2 rounded-full bg-[#090D16] border border-cyan-500/20 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-500 shadow-sm shadow-amber-500/50"
                  style={{
                    width: `${isMillingSelected ? Math.min(metrics.milling.progressPercent, 100) : 0}%`
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
                      {fmt(metrics.milling.balanceM)}&nbsp;m
                    </span>
                    <span className="text-slate-300 font-bold whitespace-nowrap">
                      ({metrics.milling.balanceKm.toFixed(1)}&nbsp;km)
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* Card 2: Tack Coat Progress (Linear Metric)                     */}
        {/* ============================================================== */}
        <div
          className={`relative group transition-all duration-300 rounded-2xl overflow-hidden bg-gradient-to-b from-[#0F172A] to-[#0A0F1D] border border-cyan-500/30 shadow-xl shadow-cyan-950/20 ${
            isTackSelected ? 'opacity-100 ring-1 ring-cyan-400/50' : 'opacity-40 grayscale-[40%]'
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
                  variant={metrics.tack.progressPercent >= 8.5 ? 'emerald' : 'cyan'}
                  size="sm"
                  className="font-mono font-bold shadow-sm"
                >
                  {`${metrics.tack.progressPercent.toFixed(1)}% Target`}
                </Badge>
              ) : (
                <Badge variant="neutral" size="xs">
                  Filtered Out
                </Badge>
              )}
            </div>

            {/* Primary Achieved & Target Section */}
            <div className="mt-4 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight drop-shadow-sm">
                    {isTackSelected ? fmt(metrics.tack.cumulativeM) : '—'}
                  </span>
                  <span className="text-xs text-cyan-400 font-bold font-mono">m</span>
                  {isTackSelected && (
                    <span className="text-xs text-cyan-300 font-mono ml-1 font-bold">
                      ({metrics.tack.cumulativeKm.toFixed(2)} km)
                    </span>
                  )}
                </div>

                {/* Total Target Length row */}
                <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-1 font-medium flex-wrap">
                  <span className="text-slate-400">Total Target:</span>
                  <span className="font-mono font-bold text-white bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/20">
                    {fmt(metrics.tack.targetM)} m ({metrics.tack.targetKm.toFixed(2)} km)
                  </span>
                </div>

                {/* Selected Day Progress row */}
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-mono">
                  <span className="text-slate-400">Today:</span>
                  {metrics.tack.dailyM > 0 ? (
                    <span className="font-bold text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                      +{fmt(metrics.tack.dailyM)} m ({metrics.tack.dailyKm.toFixed(3)} km)
                      <span className="text-slate-300 text-[10px] ml-1 font-normal">
                        [{metrics.tack.dailyEntries} {metrics.tack.dailyEntries === 1 ? 'entry' : 'entries'}]
                      </span>
                    </span>
                  ) : (
                    <span className="text-slate-500 bg-[#0A101D] px-2 py-0.5 rounded border border-slate-700/50">
                      0 m (0 entries)
                    </span>
                  )}
                </div>
              </div>

              {isTackSelected && (
                <div className="hidden sm:block shrink-0">
                  <MiniTripleBarChart
                    planned={metrics.tack.targetM}
                    actual={metrics.tack.cumulativeM}
                    balance={metrics.tack.balanceM}
                    unit="m"
                    actualColor="#06B6D4"
                  />
                </div>
              )}
            </div>

            {/* Progress Bar with Highway Ticks */}
            <div className="mt-3.5">
              <div className="w-full h-2 rounded-full bg-[#090D16] border border-cyan-500/20 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all duration-500 shadow-sm shadow-cyan-500/50"
                  style={{
                    width: `${isTackSelected ? Math.min(metrics.tack.progressPercent, 100) : 0}%`
                  }}
                />
              </div>

              <div className="mt-2.5 flex items-center justify-between text-xs gap-1.5 min-w-0">
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 font-bold font-mono whitespace-nowrap shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>
                    {isTackSelected ? (
                      <>
                        <span className="hidden 2xl:inline">Milling&nbsp;</span>Sync:&nbsp;{metrics.tackSync.toFixed(1)}%
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
                      {fmt(metrics.tack.balanceM)}&nbsp;m
                    </span>
                    <span className="text-slate-300 font-bold whitespace-nowrap">
                      ({metrics.tack.balanceKm.toFixed(1)}&nbsp;km)
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* Card 3: DBM Laid (Linear Metric)                               */}
        {/* ============================================================== */}
        <div
          className={`relative group transition-all duration-300 rounded-2xl overflow-hidden bg-gradient-to-b from-[#0F172A] to-[#0A0F1D] border border-cyan-500/30 shadow-xl shadow-cyan-950/20 ${
            isDbmSelected ? 'opacity-100 ring-1 ring-emerald-400/50' : 'opacity-40 grayscale-[40%]'
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
                  variant={metrics.dbm.progressPercent >= 8.5 ? 'emerald' : 'cyan'}
                  size="sm"
                  className="font-mono font-bold shadow-sm"
                >
                  {`${metrics.dbm.progressPercent.toFixed(1)}% Paved`}
                </Badge>
              ) : (
                <Badge variant="neutral" size="xs">
                  Filtered Out
                </Badge>
              )}
            </div>

            {/* Primary Achieved & Target Section */}
            <div className="mt-4 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight drop-shadow-sm">
                    {isDbmSelected ? fmt(metrics.dbm.cumulativeM) : '—'}
                  </span>
                  <span className="text-xs text-cyan-400 font-bold font-mono">m</span>
                  {isDbmSelected && (
                    <span className="text-xs text-emerald-300 font-mono ml-1 font-bold">
                      ({metrics.dbm.cumulativeKm.toFixed(2)} km)
                    </span>
                  )}
                </div>

                {/* Total Target Length row */}
                <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-1 font-medium flex-wrap">
                  <span className="text-slate-400">Total Target:</span>
                  <span className="font-mono font-bold text-white bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/20">
                    {fmt(metrics.dbm.targetM)} m ({metrics.dbm.targetKm.toFixed(2)} km)
                  </span>
                </div>

                {/* Selected Day Progress row */}
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-mono">
                  <span className="text-slate-400">Today:</span>
                  {metrics.dbm.dailyM > 0 ? (
                    <span className="font-bold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                      +{fmt(metrics.dbm.dailyM)} m ({metrics.dbm.dailyKm.toFixed(3)} km)
                      <span className="text-slate-300 text-[10px] ml-1 font-normal">
                        [{metrics.dbm.dailyEntries} {metrics.dbm.dailyEntries === 1 ? 'entry' : 'entries'}]
                      </span>
                    </span>
                  ) : (
                    <span className="text-slate-500 bg-[#0A101D] px-2 py-0.5 rounded border border-slate-700/50">
                      0 m (0 entries)
                    </span>
                  )}
                </div>
              </div>

              {isDbmSelected && (
                <div className="hidden sm:block shrink-0">
                  <MiniTripleBarChart
                    planned={metrics.dbm.targetM}
                    actual={metrics.dbm.cumulativeM}
                    balance={metrics.dbm.balanceM}
                    unit="m"
                    actualColor="#10B981"
                  />
                </div>
              )}
            </div>

            {/* Progress Bar with Highway Ticks */}
            <div className="mt-3.5">
              <div className="w-full h-2 rounded-full bg-[#090D16] border border-cyan-500/20 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-500 shadow-sm shadow-emerald-500/50"
                  style={{
                    width: `${isDbmSelected ? Math.min(metrics.dbm.progressPercent, 100) : 0}%`
                  }}
                />
              </div>

              <div className="mt-2.5 flex items-center justify-between text-xs gap-1.5 min-w-0">
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 font-bold font-mono whitespace-nowrap shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>
                    {isDbmSelected ? (
                      <>
                        <span className="hidden 2xl:inline">Milling&nbsp;</span>Covered:&nbsp;{metrics.dbmSync.toFixed(1)}%
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
                      {fmt(metrics.dbm.balanceM)}&nbsp;m
                    </span>
                    <span className="text-slate-300 font-bold whitespace-nowrap">
                      ({metrics.dbm.balanceKm.toFixed(1)}&nbsp;km)
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* Card 4: Exposed Milled Gap OR BC Laid (Dynamic View)          */}
        {/* ============================================================== */}
        {isBcSelected ? (
          // DEDICATED BC VIEW WHEN BC IS EXPLICITLY FILTERED
          <div className="relative group transition-all duration-300 rounded-2xl overflow-hidden bg-gradient-to-b from-[#0F172A] to-[#0A0F1D] border border-teal-500/40 shadow-xl shadow-teal-950/20 ring-1 ring-teal-400/50">
            {/* Top Highway Centerline Ribbon */}
            <div className="h-1.5 w-full bg-gradient-to-r from-teal-400 via-cyan-400 to-emerald-400 relative">
              <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_8px,rgba(0,0,0,0.4)_8px,rgba(0,0,0,0.4)_16px)]" />
            </div>

            <div className="px-3.5 py-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl border bg-teal-500/15 text-teal-300 border-teal-400/40 shadow-md shadow-teal-950/40">
                    <Milestone className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold uppercase tracking-wider text-white drop-shadow-sm">
                        BC Wearing Course
                      </span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30 font-mono font-bold">
                        Length
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">40mm wearing layer paved</p>
                  </div>
                </div>

                <Badge variant="cyan" size="sm" className="font-mono font-bold shadow-sm">
                  {`${metrics.bc.progressPercent.toFixed(1)}% Target`}
                </Badge>
              </div>

              {/* Primary Achieved & Target Section */}
              <div className="mt-4 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight drop-shadow-sm">
                      {fmt(metrics.bc.cumulativeM)}
                    </span>
                    <span className="text-xs text-cyan-400 font-bold font-mono">m</span>
                    <span className="text-xs text-teal-300 font-mono ml-1 font-bold">
                      ({metrics.bc.cumulativeKm.toFixed(2)} km)
                    </span>
                  </div>

                  {/* Target row */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-1 font-medium flex-wrap">
                    <span className="text-slate-400">Total Target:</span>
                    <span className="font-mono font-bold text-white bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/20">
                      {fmt(metrics.bc.targetM)} m ({metrics.bc.targetKm.toFixed(2)} km)
                    </span>
                  </div>

                  {/* Selected Day Progress row */}
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-mono">
                    <span className="text-slate-400">Today:</span>
                    {metrics.bc.dailyM > 0 ? (
                      <span className="font-bold text-teal-300 bg-teal-950/60 px-2 py-0.5 rounded border border-teal-500/30">
                        +{fmt(metrics.bc.dailyM)} m ({metrics.bc.dailyKm.toFixed(3)} km)
                        <span className="text-slate-300 text-[10px] ml-1 font-normal">
                          [{metrics.bc.dailyEntries} {metrics.bc.dailyEntries === 1 ? 'entry' : 'entries'}]
                        </span>
                      </span>
                    ) : (
                      <span className="text-slate-500 bg-[#0A101D] px-2 py-0.5 rounded border border-slate-700/50">
                        0 m (0 entries)
                      </span>
                    )}
                  </div>
                </div>

                <div className="hidden sm:block shrink-0">
                  <MiniTripleBarChart
                    planned={metrics.bc.targetM}
                    actual={metrics.bc.cumulativeM}
                    balance={metrics.bc.balanceM}
                    unit="m"
                    actualColor="#14B8A6"
                  />
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-3.5">
                <div className="w-full h-2 rounded-full bg-[#090D16] border border-cyan-500/20 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-teal-400 to-emerald-500 rounded-full transition-all duration-500 shadow-sm shadow-teal-500/50"
                    style={{
                      width: `${Math.min(metrics.bc.progressPercent, 100)}%`
                    }}
                  />
                </div>

                <div className="mt-2.5 flex items-center justify-between text-xs gap-1.5 min-w-0">
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-teal-950/70 border border-teal-500/40 text-teal-300 font-bold font-mono whitespace-nowrap shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                    <span>Active Wearing Front</span>
                  </span>

                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0A101D] border border-cyan-500/30 text-xs font-mono shadow-sm whitespace-nowrap shrink-0">
                    <span className="text-slate-400 font-medium">Balance:</span>
                    <span className="font-extrabold text-teal-300 whitespace-nowrap">
                      {fmt(metrics.bc.balanceM)}&nbsp;m
                    </span>
                    <span className="text-slate-300 font-bold whitespace-nowrap">
                      ({metrics.bc.balanceKm.toFixed(1)}&nbsp;km)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // CARD 4: EXPOSED MILLED GAP & PAVEMENT CONTINUITY
          <div className="relative group transition-all duration-300 rounded-2xl overflow-hidden bg-gradient-to-b from-[#0F172A] to-[#0A0F1D] border border-rose-500/30 shadow-xl shadow-rose-950/20">
            {/* Top Highway Warning Ribbon */}
            <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-rose-500 to-red-600 relative">
              <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_8px,rgba(0,0,0,0.4)_8px,rgba(0,0,0,0.4)_16px)]" />
            </div>

            <div className="px-3.5 py-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`p-2.5 rounded-xl border ${
                      metrics.exposedGapM > 1000
                        ? 'bg-rose-500/20 text-rose-300 border-rose-400/40 shadow-md shadow-rose-950/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                    }`}
                  >
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold uppercase tracking-wider text-white drop-shadow-sm">
                        Exposed Milled Gap
                      </span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-500/30 font-mono font-bold">
                        Gap Length
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">Uncovered lane waiting DBM</p>
                  </div>
                </div>

                <Badge
                  variant={metrics.exposedGapM > 1500 ? 'crimson' : metrics.exposedGapM > 500 ? 'amber' : 'emerald'}
                  size="sm"
                  className="font-mono font-bold shadow-sm"
                >
                  {metrics.exposedGapM > 1500 ? 'High Exposure' : metrics.exposedGapM > 500 ? 'Safety Watch' : 'Optimal'}
                </Badge>
              </div>

              {/* Primary Gap Metric & Coverage Breakdown */}
              <div className="mt-4 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight drop-shadow-sm">
                      {fmt(metrics.exposedGapM)}
                    </span>
                    <span className="text-xs text-rose-400 font-bold font-mono">m</span>
                    <span className="text-xs text-rose-300 font-mono ml-1 font-bold">
                      ({metrics.exposedGapKm.toFixed(2)} km)
                    </span>
                  </div>

                  {/* Coverage row: Milled vs Paved */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-1 font-medium flex-wrap">
                    <span className="text-slate-400">Milled:</span>
                    <span className="font-mono font-bold text-white bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/20">
                      {fmt(metrics.milling.cumulativeM)} m
                    </span>
                    <span className="text-slate-400 ml-1">Paved:</span>
                    <span className="font-mono font-bold text-emerald-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/20">
                      {fmt(metrics.dbm.cumulativeM)} m
                    </span>
                  </div>

                  {/* Selected Day Net Gap change */}
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-mono flex-wrap">
                    <span className="text-slate-400">Today Delta:</span>
                    <span
                      className={`font-mono font-bold px-2 py-0.5 rounded border ${
                        metrics.dailyNetGapM > 0
                          ? 'text-rose-300 bg-rose-950/60 border-rose-500/30'
                          : metrics.dailyNetGapM < 0
                          ? 'text-emerald-300 bg-emerald-950/60 border-emerald-500/30'
                          : 'text-slate-400 bg-[#0A101D] border-slate-700/50'
                      }`}
                    >
                      {metrics.dailyNetGapM > 0 ? `+${fmt(metrics.dailyNetGapM)} m` : `${fmt(metrics.dailyNetGapM)} m`}
                      <span className="text-slate-400 text-[10px] ml-1 font-normal">
                        (M: +{fmt(metrics.milling.dailyM)} | D: +{fmt(metrics.dbm.dailyM)})
                      </span>
                    </span>
                  </div>
                </div>

                <div className="hidden sm:block shrink-0">
                  <MiniTripleBarChart
                    planned={metrics.milling.cumulativeM > 0 ? metrics.milling.cumulativeM : metrics.milling.targetM}
                    actual={metrics.dbm.cumulativeM}
                    balance={metrics.exposedGapM}
                    unit="m"
                    actualColor="#F43F5E"
                  />
                </div>
              </div>

              {/* Gap Continuity Progress Bar */}
              <div className="mt-3.5">
                <div className="w-full h-2 rounded-full bg-[#090D16] border border-rose-500/20 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 shadow-sm ${
                      metrics.exposedGapM > 1500
                        ? 'bg-gradient-to-r from-rose-500 to-red-600 shadow-rose-500/50'
                        : 'bg-gradient-to-r from-amber-400 to-rose-500 shadow-amber-500/50'
                    }`}
                    style={{
                      width: `${Math.min(100, Math.max(5, (metrics.exposedGapM / 2000) * 100))}%`
                    }}
                  />
                </div>

                <div className="mt-2.5 flex items-center justify-between text-xs gap-1.5 min-w-0">
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-rose-950/70 border border-rose-500/40 text-rose-300 font-bold font-mono whitespace-nowrap shrink-0">
                    <Clock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>
                      <span className="hidden 2xl:inline">Continuity:&nbsp;</span>
                      {metrics.dbmSync.toFixed(1)}%&nbsp;Paved
                    </span>
                  </span>

                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0A101D] border border-rose-500/30 text-xs font-mono shadow-sm whitespace-nowrap shrink-0">
                    <span className="text-slate-400 font-medium">BC Laid:</span>
                    <span className="text-teal-300 font-extrabold whitespace-nowrap">
                      {fmt(metrics.bc.cumulativeM)}&nbsp;m
                    </span>
                    <span className="text-slate-400 font-bold whitespace-nowrap">
                      ({metrics.bc.cumulativeKm.toFixed(2)}&nbsp;km)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LinearKPICards;
