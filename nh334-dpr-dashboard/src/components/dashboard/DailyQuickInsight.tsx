import React, { useMemo, useEffect, useRef, useCallback, useState } from 'react';
import {
  Clock,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Flame,
  Truck,
  RotateCcw,
  Sparkles,
  MapPin,
  Navigation
} from 'lucide-react';
import { ActualDPRRow, ProjectBaseline, DashboardFilters } from '../../types/dpr';
import { getPhasedTargetForDate, getPhasedMillingTargetForDate } from '../../utils/excelParser';
import { DEFAULT_DAILY_PLANNED_TARGETS } from '../../utils/dailyPlannedTargetsData';
import { useFilters } from '../../context/FilterContext';
import { formatChainageM } from '../../utils/gisUtils';

export interface DailyQuickInsightProps {
  actualRows: ActualDPRRow[];
  baseline?: ProjectBaseline;
  filters?: DashboardFilters;
  onFilterChange?: (newFilters: DashboardFilters) => void;
  availableDates: string[];
  onSelectRow?: (row: ActualDPRRow) => void;
  onNavigateToLocation?: (row: ActualDPRRow) => void;
  className?: string;
}

// Feature flag: Hide target metrics, percentages, and progress bars from quick insight cards (Set to true to re-enable)
const SHOW_DAILY_TARGET_PROGRESS = false;

// Format date from "14.10.2026" to "14 Oct"
function formatPillDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('.');
  if (parts.length < 2) return dateStr;
  const d = parts[0];
  const m = Number(parts[1]);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = months[m - 1] || 'Oct';
  return `${d} ${monthName}`;
}

// Format numbers with commas
function formatFmt(val: number, decimals: number = 0): string {
  if (val === null || val === undefined || isNaN(val) || !isFinite(val)) return '0';
  return val.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

// Date comparator helper
function isDateInRange(dateStr: string, start: string, end: string): boolean {
  if (!start || !end) return true;
  const [d, m, y] = dateStr.split('.').map(Number);
  const [sd, sm, sy] = start.split('.').map(Number);
  const [ed, em, ey] = end.split('.').map(Number);

  const targetTime = new Date(y, m - 1, d).getTime();
  const startTime = new Date(sy, sm - 1, sd).getTime();
  const endTime = new Date(ey, em - 1, ed, 23, 59, 59).getTime();

  return targetTime >= startTime && targetTime <= endTime;
}

export const DailyQuickInsight: React.FC<DailyQuickInsightProps> = ({
  actualRows,
  baseline,
  filters: propsFilters,
  onFilterChange: propsOnFilterChange,
  availableDates,
  onSelectRow,
  onNavigateToLocation,
  className = ''
}) => {
  const [isStretchesExpanded, setIsStretchesExpanded] = useState<boolean>(true);

  // Access global filter context if available
  let context: ReturnType<typeof useFilters> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    context = useFilters();
  } catch {
    context = null;
  }

  // Sorted list of unique dates
  const dates = useMemo(() => {
    if (availableDates && availableDates.length > 0) return availableDates;
    const set = new Set<string>();
    actualRows.forEach(r => {
      if (r.date) set.add(r.date);
    });
    if (set.size === 0) {
      return [
        '14.10.2026', '15.10.2026', '16.10.2026', '17.10.2026', '18.10.2026',
        '19.10.2026', '20.10.2026', '21.10.2026', '22.10.2026', '23.10.2026',
        '24.10.2026', '25.10.2026', '26.10.2026', '27.10.2026', '28.10.2026',
        '29.10.2026', '31.10.2026', '01.11.2026'
      ];
    }
    return Array.from(set).sort((a, b) => {
      const [ad, am, ay] = a.split('.').map(Number);
      const [bd, bm, by] = b.split('.').map(Number);
      return new Date(ay, am - 1, ad).getTime() - new Date(by, bm - 1, bd).getTime();
    });
  }, [actualRows, availableDates]);

  // Derive active filter values with context priority
  const activeSide = context ? (context.filters.side === 'Both' ? 'ALL' : context.filters.side) : (propsFilters?.side || 'ALL');
  const activeActivities = context ? context.filters.selectedActivities : (propsFilters?.activities || ['Milling', 'Tackcoat', 'DBM', 'BC']);
  const activeMinCh = context ? context.filters.chainageBounds.from : (propsFilters?.minChainage ?? 169.000);
  const activeMaxCh = context ? context.filters.chainageBounds.to : (propsFilters?.maxChainage ?? 206.220);
  const activeAnomaliesOnly = context ? context.filters.anomaliesOnly : (propsFilters?.anomaliesOnly ?? false);
  const activeStartDate = context ? context.filters.dateRange.start : (propsFilters?.startDate || dates[0] || '14.10.2026');
  const activeEndDate = context ? context.filters.dateRange.end : (propsFilters?.endDate || dates[dates.length - 1] || '05.11.2026');
  const singleFocusedDate = context?.filters.selectedSingleDate || null;

  // Determine if All (Cumulative) or Single Day is active
  const isAllSelected = !singleFocusedDate || singleFocusedDate === 'ALL';
  const isSingleDay = !isAllSelected;
  const isFullRange = isAllSelected;

  // Active date for scrubber: if All, focal point is latest date; otherwise singleFocusedDate
  const activeDate = isAllSelected ? (dates[dates.length - 1] || '05.11.2026') : (singleFocusedDate || activeStartDate);

  // Active index on timeline track (position vehicle at end in All mode)
  const activeIndex = useMemo(() => {
    if (isAllSelected) return dates.length - 1;
    const idx = dates.indexOf(activeDate);
    return idx >= 0 ? idx : dates.length - 1;
  }, [dates, activeDate, isAllSelected]);

  // Auto-play state for timeline simulation
  const [isPlaying, setIsPlaying] = React.useState<boolean>(false);
  const playTimerRef = useRef<number | null>(null);

  // Select a specific single day
  const handleSelectDate = useCallback((date: string) => {
    if (context) {
      context.setSelectedSingleDate(date);
    }
    if (propsOnFilterChange && propsFilters) {
      propsOnFilterChange({
        ...propsFilters,
        startDate: date,
        endDate: date
      });
    }
    // Highlight matching row in lower table
    if (onSelectRow) {
      const match = actualRows.find(r => r.date === date);
      if (match) onSelectRow(match);
    }
  }, [context, propsOnFilterChange, propsFilters, onSelectRow, actualRows]);

  // Select full date range (All Cumulative)
  const handleSelectFullRange = useCallback(() => {
    const latestDate = dates[dates.length - 1] || '05.11.2026';
    const earliestDate = dates[0] || '14.10.2026';
    if (context) {
      context.setSelectedSingleDate(null);
      context.setDateRange({
        start: earliestDate,
        end: latestDate
      });
    }
    if (propsOnFilterChange && propsFilters) {
      propsOnFilterChange({
        ...propsFilters,
        startDate: earliestDate,
        endDate: latestDate
      });
    }
  }, [context, dates, propsOnFilterChange, propsFilters]);

  // Step backward or forward 1 day
  const handleStep = useCallback((direction: 'prev' | 'next') => {
    const currentIdx = isAllSelected ? dates.length - 1 : activeIndex;
    const newIdx = direction === 'prev' ? Math.max(0, currentIdx - 1) : Math.min(dates.length - 1, currentIdx + 1);
    const newDate = dates[newIdx];
    handleSelectDate(newDate);
  }, [activeIndex, dates, handleSelectDate, isAllSelected]);

  useEffect(() => {
    if (isPlaying) {
      playTimerRef.current = window.setInterval(() => {
        const nextIdx = (activeIndex + 1) % dates.length;
        const nextDate = dates[nextIdx];
        handleSelectDate(nextDate);
      }, 2400);
    } else {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    }
    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, [isPlaying, activeIndex, dates, handleSelectDate]);

  // Filter rows based on active Date, Side, Chainage, and Anomalies
  const dayRows = useMemo(() => {
    return actualRows.filter(r => {
      // Date filter: if All / cumulative is active, include all rows up to activeEndDate
      if (isAllSelected) {
        if (!r.date) return false;
        const [d, m, y] = r.date.split('.').map(Number);
        const rowTime = new Date(y, m - 1, d).getTime();
        const [ed, em, ey] = (activeEndDate || dates[dates.length - 1] || '05.11.2026').split('.').map(Number);
        const maxTime = new Date(ey, em - 1, ed, 23, 59, 59).getTime();
        if (rowTime > maxTime) return false;
      } else {
        if (r.date !== activeDate) return false;
      }

      // Side filter: respect activeSide
      if (activeSide !== 'ALL' && r.side !== activeSide) return false;

      // Activity filter
      if (!activeActivities.includes(r.activity)) return false;

      // Chainage overlap filter
      const rowMin = Math.min(r.fromChainage, r.toChainage);
      const rowMax = Math.max(r.fromChainage, r.toChainage);
      if (rowMax < activeMinCh || rowMin > activeMaxCh) return false;

      // Anomalies only
      if (activeAnomaliesOnly && !r.isAnomaly) return false;

      return true;
    });
  }, [actualRows, isAllSelected, activeEndDate, dates, activeDate, activeSide, activeActivities, activeMinCh, activeMaxCh, activeAnomaliesOnly]);

  // Calculate metrics for the active date (or range) respecting all filters
  const metrics = useMemo(() => {
    const count = dayRows.length;

    // Chainage stretch summary
    let stretchSummary = 'No DPR entries recorded';
    if (count > 0) {
      const minCh = Math.min(...dayRows.map(r => Math.min(r.fromChainage, r.toChainage)));
      const maxCh = Math.max(...dayRows.map(r => Math.max(r.fromChainage, r.toChainage)));
      const sideText = activeSide === 'ALL' ? 'Both Sides' : activeSide;
      stretchSummary = `${count} Stretches • Ch. ${minCh.toFixed(3)} to ${maxCh.toFixed(3)} (${sideText})`;
    } else {
      stretchSummary = `0 Stretches (${activeSide === 'ALL' ? 'Both Sides' : activeSide} • Ch. ${activeMinCh.toFixed(1)}–${activeMaxCh.toFixed(1)})`;
    }

    // Activity selection checks
    const isMillingSelected = activeActivities.includes('Milling');
    const isTackSelected = activeActivities.includes('Tackcoat');
    const isDbmSelected = activeActivities.includes('DBM');

    // 1. Milling
    const millingRows = dayRows.filter(r => r.activity === 'Milling');
    const actualMilling = millingRows.reduce((sum, r) => sum + (r.achievedToday || 0), 0);
    let targetMilling = 0;
    if (isAllSelected) {
      const [ed, em, ey] = (activeEndDate || dates[dates.length - 1] || '05.11.2026').split('.').map(Number);
      const maxTime = new Date(ey, em - 1, ed, 23, 59, 59).getTime();
      let cumPlanned = 0;
      for (const [dateStr, val] of Object.entries(DEFAULT_DAILY_PLANNED_TARGETS)) {
        const [d, m, y] = dateStr.split('.').map(Number);
        const t = new Date(y, m - 1, d).getTime();
        if (t <= maxTime) {
          cumPlanned += val.Milling || 0;
        }
      }
      targetMilling = cumPlanned;
    } else {
      const explicitPlannedMilling = millingRows.reduce((sum, r) => sum + (r.plannedToday || 0), 0);
      targetMilling = explicitPlannedMilling > 0
        ? explicitPlannedMilling
        : getPhasedMillingTargetForDate(activeDate, baseline?.dailyPhases);
    }
    const millingVariance = actualMilling - targetMilling;
    const millingVariancePct = targetMilling > 0 ? (millingVariance / targetMilling) * 100 : 0;
    const millingProgressPct = targetMilling > 0
      ? Math.min(100, Math.max(0, (actualMilling / targetMilling) * 100))
      : (actualMilling > 0 ? 100 : 0);

    // 2. Tackcoat
    const tackRows = dayRows.filter(r => r.activity === 'Tackcoat');
    const actualTack = tackRows.reduce((sum, r) => sum + (r.achievedToday || 0), 0);
    let targetTack = 0;
    if (isAllSelected) {
      const [ed, em, ey] = (activeEndDate || dates[dates.length - 1] || '05.11.2026').split('.').map(Number);
      const maxTime = new Date(ey, em - 1, ed, 23, 59, 59).getTime();
      let cumPlannedTack = 0;
      for (const [dateStr, val] of Object.entries(DEFAULT_DAILY_PLANNED_TARGETS)) {
        const [d, m, y] = dateStr.split('.').map(Number);
        const t = new Date(y, m - 1, d).getTime();
        if (t <= maxTime) {
          cumPlannedTack += val['Tackcoat (DBM)'] || val.Tackcoat || 0;
        }
      }
      targetTack = cumPlannedTack;
    } else {
      const explicitPlannedTack = tackRows.reduce((sum, r) => sum + (r.plannedToday || 0), 0);
      targetTack = explicitPlannedTack > 0
        ? explicitPlannedTack
        : Math.round(targetMilling * 0.85);
    }
    const tackVariance = actualTack - targetTack;
    const tackVariancePct = targetTack > 0 ? (tackVariance / targetTack) * 100 : 0;
    const tackProgressPct = targetTack > 0
      ? Math.min(100, Math.max(0, (actualTack / targetTack) * 100))
      : (actualTack > 0 ? 100 : 0);

    // 3. DBM
    const dbmRows = dayRows.filter(r => r.activity === 'DBM');
    const actualDbmCum = dbmRows.reduce((sum, r) => sum + (r.achievedToday || 0), 0);
    const actualDbmMT = Number((actualDbmCum * 2.38).toFixed(1));
    let targetDbmCum = 0;
    let targetDbmMT = 0;
    let phasedTargetMT = 0;
    if (isAllSelected) {
      const [ed, em, ey] = (activeEndDate || dates[dates.length - 1] || '05.11.2026').split('.').map(Number);
      const maxTime = new Date(ey, em - 1, ed, 23, 59, 59).getTime();
      let cumPlannedDbm = 0;
      for (const [dateStr, val] of Object.entries(DEFAULT_DAILY_PLANNED_TARGETS)) {
        const [d, m, y] = dateStr.split('.').map(Number);
        const t = new Date(y, m - 1, d).getTime();
        if (t <= maxTime) {
          cumPlannedDbm += val.DBM || 0;
        }
      }
      targetDbmCum = Number(cumPlannedDbm.toFixed(1));
      targetDbmMT = Number((cumPlannedDbm * 2.38).toFixed(1));
      phasedTargetMT = targetDbmMT;
    } else {
      const explicitPlannedDbmCum = dbmRows.reduce((sum, r) => sum + (r.plannedToday || 0), 0);
      phasedTargetMT = getPhasedTargetForDate(activeDate, baseline?.dailyPhases);
      targetDbmCum = explicitPlannedDbmCum > 0
        ? explicitPlannedDbmCum
        : Number((phasedTargetMT / 2.38).toFixed(1));
      targetDbmMT = phasedTargetMT;
    }
    const dbmVariance = actualDbmCum - targetDbmCum;
    const dbmVariancePct = targetDbmCum > 0 ? (dbmVariance / targetDbmCum) * 100 : 0;
    const dbmProgressPct = targetDbmCum > 0
      ? Math.min(100, Math.max(0, (actualDbmCum / targetDbmCum) * 100))
      : (actualDbmCum > 0 ? 100 : 0);

    // Anomalies on this day matching current filters
    const dayAnomalies = dayRows.filter(r => r.isAnomaly);
    const anomalyDescriptions: string[] = [];
    dayAnomalies.forEach(r => {
      if (r.anomalyCategory === 'milling_excess_depth' && !anomalyDescriptions.includes('Milling > 50mm')) {
        anomalyDescriptions.push('Milling > 50mm');
      } else if (r.anomalyCategory === 'offset' && !anomalyDescriptions.includes('Excess offset')) {
        anomalyDescriptions.push('Excess offset');
      } else if (r.anomalyCategory === 'excess_qty' && !anomalyDescriptions.includes('Excess BOQ Qty')) {
        anomalyDescriptions.push('Excess BOQ Qty');
      }
    });

    // Phase identification
    const isPhase1 = activeDate.startsWith('10.') || activeDate.startsWith('11.') ||
      activeDate.startsWith('12.') || activeDate.startsWith('13.') ||
      activeDate.startsWith('14.') || activeDate.startsWith('15.');
    const phaseLabel = isAllSelected
      ? `Cumulative Scope (to ${formatPillDate(activeEndDate || dates[dates.length - 1] || '05.11.2026')})`
      : (isPhase1 ? 'Phase 1 Target: 770.53 MT/day' : 'Phase 2 Target: 988.03 MT/day');

    return {
      count,
      stretchSummary,
      isMillingSelected,
      isTackSelected,
      isDbmSelected,
      actualMilling,
      targetMilling,
      millingVariancePct,
      millingProgressPct,
      actualTack,
      targetTack,
      tackVariancePct,
      tackProgressPct,
      actualDbmCum,
      actualDbmMT,
      targetDbmCum,
      targetDbmMT,
      phasedTargetMT,
      dbmVariancePct,
      dbmProgressPct,
      anomaliesCount: dayAnomalies.length,
      anomalyDescriptions,
      phaseLabel
    };
  }, [dayRows, activeDate, baseline, activeSide, activeActivities, activeMinCh, activeMaxCh, isAllSelected, activeEndDate, dates]);

  // Track progress calculation (percentage from 0 to 100%)
  const progressPercent = isAllSelected ? 100 : (dates.length > 1 ? (activeIndex / (dates.length - 1)) * 100 : 100);

  return (
    <div
      id="daily-quick-insight"
      className={`bg-[#0E121E]/95 backdrop-blur-md border border-white/5 rounded-2xl p-5 shadow-2xl relative overflow-hidden transition-all duration-300 ${className}`}
      style={{
        boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5), inset 0 1px 0 0 rgba(255,255,255,0.05)'
      }}
    >
      {/* Top Header Row with Widget Title, Filter-Sync Badges & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Clock className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xs sm:text-sm font-bold tracking-wider uppercase text-slate-200">
                Daily Quick Insight Timeline & Day Scrubber
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20">
                {metrics.phaseLabel}
              </span>
              {/* Dynamic Filter Badges showing active connection with filter bar */}
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                Side: {activeSide === 'ALL' ? 'Both' : activeSide}
              </span>
              {activeAnomaliesOnly && (
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono bg-rose-500/10 text-rose-300 border border-rose-500/20">
                  <AlertTriangle className="w-2.5 h-2.5" /> Anomalies Only
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {isAllSelected
                ? `Viewing Cumulative Progress: All Dates (${formatPillDate(dates[0])} to ${formatPillDate(activeEndDate)}) • All DPR Records`
                : `Viewing Single Day: ${formatPillDate(activeDate)} 2026 (${activeDate}) • Real-time Filter Bound`}
            </p>
          </div>
        </div>

        {/* Playback Controls & Range Reset */}
        <div className="flex items-center gap-2">
          {!isAllSelected && (
            <button
              onClick={handleSelectFullRange}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono transition-all border bg-white/[0.04] text-slate-300 border-white/10 hover:text-white hover:border-cyan-500/30 cursor-pointer"
              title="Reset date filter to All (Cumulative)"
            >
              <RotateCcw className="w-3 h-3 text-cyan-400" />
              <span>All Dates</span>
            </button>
          )}

          <div className="flex items-center bg-black/40 border border-white/10 rounded-xl p-0.5">
            <button
              onClick={() => handleStep('prev')}
              disabled={activeIndex === 0}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
              title="Previous Day"
              aria-label="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                isPlaying
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-white/10'
              }`}
              title={isPlaying ? 'Pause Auto-Play' : 'Play Timeline (Auto-advance daily)'}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>

            <button
              onClick={() => handleStep('next')}
              disabled={activeIndex === dates.length - 1}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
              title="Next Day"
              aria-label="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Row 1: Date Scrubber Track (Continuous Horizontal Timeline Slider) */}
      <div className="relative pt-7 pb-2 mb-4">
        {/* Background Track */}
        <div className="h-1.5 bg-white/10 rounded-full relative w-full overflow-visible">
          {/* Active Fill Line in Electric Blue */}
          <div
            className="h-full bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 rounded-full transition-all duration-300 relative shadow-[0_0_12px_rgba(56,189,248,0.5)]"
            style={{ width: `${progressPercent}%` }}
          />

          {/* Highway Inspection Vehicle Thumb (In place of blue dot) */}
          <div
            className="absolute top-1/2 transition-all duration-300 pointer-events-none z-20"
            style={{
              left: `${progressPercent}%`,
              transform: 'translate(-50%, -82%)'
            }}
          >
            <div className="relative flex items-center justify-center filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.85)]">
              {/* Forward Conical Headlight Projection Beam Illuminating the Road Ahead */}
              <div
                className="absolute left-[90%] top-[55%] -translate-y-1/2 w-10 sm:w-12 h-5 bg-gradient-to-r from-amber-300/40 via-yellow-200/15 to-transparent blur-[1.5px] pointer-events-none"
                style={{ clipPath: 'polygon(0 40%, 100% 0, 100% 100%, 0 60%)' }}
              />

              {/* Highway Maintenance Inspection Car Design */}
              <svg
                viewBox="0 0 54 26"
                className="w-11 sm:w-12 h-auto overflow-visible select-none drop-shadow-lg"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Roof Flashing Warning Beacon Bar with Glow Pulse */}
                <rect x="22" y="2" width="8" height="3" rx="1.5" fill="#F59E0B" />
                <circle cx="26" cy="3.5" r="4.5" fill="#F59E0B" className="animate-ping opacity-60" />

                {/* Car Main Body Chassis (Cube Highway Tech Blue) */}
                <path
                  d="M 3 17 L 3 13.5 C 3 12 4.5 11 6 11 L 12 11 L 16 5 C 17.2 3.8 19 3.5 21 3.5 L 32 3.5 C 34 3.5 35.8 4.2 37 5.8 L 43 11.5 L 48.5 12 C 50.5 12.5 51.5 13.8 51.5 15.5 L 51.5 18 C 51.5 18.5 51 19 50 19 L 46 19 C 45.5 16.8 43.5 15.2 41 15.2 C 38.5 15.2 36.5 16.8 36 19 L 19 19 C 18.5 16.8 16.5 15.2 14 15.2 C 11.5 15.2 9.5 16.8 9 19 L 4 19 C 3.5 19 3 18.5 3 18 Z"
                  fill="#0284C7"
                  stroke="#38BDF8"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />

                {/* Reflective Highway Maintenance Safety Stripe (Yellow/Black Pattern) */}
                <path
                  d="M 6 12.5 L 48 12.5"
                  stroke="#FACC15"
                  strokeWidth="1.5"
                  strokeDasharray="3 1.8"
                />

                {/* Windshield & Windows (Glass Glare & Pillars) */}
                {/* Rear Window */}
                <path
                  d="M 16.8 6.5 C 17.6 5.2 18.8 4.8 20.5 4.8 L 26.5 4.8 L 26.5 10.5 L 13.5 10.5 Z"
                  fill="#0369A1"
                  stroke="#BAE6FD"
                  strokeWidth="0.6"
                />
                {/* Front Windshield */}
                <path
                  d="M 28 4.8 L 32.5 4.8 C 34 4.8 35.2 5.4 36 6.5 L 41 10.5 L 28 10.5 Z"
                  fill="#0369A1"
                  stroke="#BAE6FD"
                  strokeWidth="0.6"
                />
                {/* Windshield Glare Line */}
                <line x1="30" y1="5.5" x2="38.5" y2="10" stroke="#FFFFFF" strokeWidth="0.8" strokeLinecap="round" opacity="0.6" />

                {/* Front Headlight (Bright Xenon Light) */}
                <circle cx="50" cy="14" r="1.8" fill="#FEF08A" />
                <circle cx="50" cy="14" r="3.2" fill="#FEF08A" className="opacity-40 animate-pulse" />

                {/* Rear Taillight (Crimson Red) */}
                <rect x="2.5" y="13" width="1.8" height="3" rx="0.6" fill="#EF4444" />

                {/* Wheels with Rubber Tires & Alloy Rims (Touching down on track rail) */}
                {/* Front Wheel */}
                <circle cx="41" cy="19" r="4.2" fill="#0F172A" stroke="#475569" strokeWidth="1" />
                <circle cx="41" cy="19" r="2.2" fill="#CBD5E1" stroke="#334155" strokeWidth="0.5" />
                <circle cx="41" cy="19" r="0.9" fill="#0284C7" />

                {/* Rear Wheel */}
                <circle cx="14" cy="19" r="4.2" fill="#0F172A" stroke="#475569" strokeWidth="1" />
                <circle cx="14" cy="19" r="2.2" fill="#CBD5E1" stroke="#334155" strokeWidth="0.5" />
                <circle cx="14" cy="19" r="0.9" fill="#0284C7" />
              </svg>

              {/* Floating Date Pin Above the Inspection Vehicle */}
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none select-none">
                <div className="whitespace-nowrap px-2 py-0.5 rounded-md bg-[#0B1120]/95 border border-sky-400/60 text-sky-300 font-mono text-[9px] font-bold shadow-lg shadow-black/90 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                  <span>{isAllSelected ? 'All Dates (Cumulative)' : formatPillDate(activeDate)}</span>
                </div>
                {/* Pointer Caret pointing to vehicle roof */}
                <div className="w-0 h-0 border-x-[3.5px] border-x-transparent border-t-[4px] border-t-sky-400/60 -mt-[0.5px]" />
              </div>
            </div>
          </div>
        </div>

        {/* Accessible Range Input Layer on Top */}
        <input
          type="range"
          min="0"
          max={dates.length - 1}
          value={activeIndex}
          onChange={e => {
            const idx = Number(e.target.value);
            if (dates[idx]) handleSelectDate(dates[idx]);
          }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 appearance-none bg-transparent"
          aria-label="Scrub timeline dates"
        />
      </div>

      {/* Row 2: Date Selection Pills */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10 mb-4">
        {/* "Full Scope / All" Pill */}
        <button
          onClick={handleSelectFullRange}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono transition-all cursor-pointer ${
            isAllSelected
              ? 'bg-indigo-600 text-white font-bold border border-indigo-400 shadow-md shadow-indigo-500/30 scale-105'
              : 'bg-white/[0.03] border border-white/10 text-gray-400 hover:text-white hover:border-white/20'
          }`}
          title="View cumulative progress across all dates"
        >
          <Sparkles className="w-3 h-3 text-cyan-300" />
          <span>All</span>
        </button>

        {/* Individual Date Pills */}
        {dates.map(date => {
          const isActive = !isAllSelected && date === activeDate;
          const dayHasAnomaly = actualRows.some(r => r.date === date && r.isAnomaly);
          // Check matching entries respecting side filter
          const dayEntries = actualRows.filter(
            r => r.date === date && (activeSide === 'ALL' || r.side === activeSide)
          ).length;

          return (
            <button
              key={date}
              onClick={() => handleSelectDate(date)}
              className={`shrink-0 relative group flex items-center gap-1.5 cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white font-bold border border-blue-400 shadow-md shadow-blue-500/30 px-3.5 py-1.5 rounded-xl text-xs font-mono scale-105 transition-all'
                  : 'bg-white/[0.03] border border-white/10 text-gray-400 hover:text-white hover:border-white/20 px-3 py-1.5 rounded-xl text-xs font-mono transition-all'
              }`}
              title={`${date}: ${dayEntries} entries (${activeSide})`}
            >
              <span>{formatPillDate(date)}</span>

              {/* Indicator dot: Amber if anomalies, white/slate if entries exist */}
              {dayHasAnomaly ? (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              ) : dayEntries > 0 ? (
                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : 'bg-slate-600'}`} />
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Row 3: Metrics & Insights Grid (Subtle Recessed Sub-Card) */}
      <div className="bg-black/35 border border-white/5 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
        {/* Metric 1: RECORDS LOGGED */}
        <div className="flex flex-col justify-between h-full space-y-1.5 p-1 border-b sm:border-b-0 sm:border-r border-white/5 pb-3 sm:pb-0 sm:pr-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
              Records Logged
            </span>
            <span className="text-[10px] font-mono text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">
              {isAllSelected ? 'All Dates' : (isSingleDay ? formatPillDate(activeDate) : 'Filtered Range')}
            </span>
          </div>

          <div className="text-xl sm:text-2xl font-bold font-mono text-sky-400 tracking-tight flex items-baseline gap-1.5">
            <span>{metrics.count}</span>
            <span className="text-xs font-normal text-slate-400">DPR entries</span>
          </div>

          <div className="text-[11px] text-slate-400 truncate" title={metrics.stretchSummary}>
            {metrics.stretchSummary}
          </div>
        </div>

        {/* Metric 2: MILLING TODAY / CUMULATIVE */}
        <div
          className={`flex flex-col justify-between h-full space-y-1.5 p-1 border-b sm:border-b-0 lg:border-r border-white/5 pb-3 sm:pb-0 sm:pr-4 transition-opacity ${
            metrics.isMillingSelected ? 'opacity-100' : 'opacity-40 grayscale-[40%]'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
                {metrics.isMillingSelected ? (isAllSelected ? 'Milling Cumulative' : 'Milling Today') : 'Milling'}
              </span>
            </div>

            {/* Variance Pill Badge */}
            {SHOW_DAILY_TARGET_PROGRESS ? (
              metrics.isMillingSelected ? (
                metrics.targetMilling > 0 && metrics.actualMilling > 0 ? (
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      metrics.millingVariancePct >= 0
                        ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-950/70 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {metrics.millingVariancePct >= 0 ? '+' : ''}
                    {metrics.millingVariancePct.toFixed(1)}%
                  </span>
                ) : null
              ) : (
                <span className="text-[9px] font-mono text-slate-500 bg-white/5 px-1 rounded">Filtered</span>
              )
            ) : (
              !metrics.isMillingSelected && (
                <span className="text-[9px] font-mono text-slate-500 bg-white/5 px-1 rounded">Filtered</span>
              )
            )}
          </div>

          <div className="text-xl sm:text-2xl font-bold font-mono text-white tracking-tight flex items-baseline gap-1.5">
            <span>{metrics.isMillingSelected ? formatFmt(metrics.actualMilling) : '—'}</span>
            <span className="text-xs font-normal text-slate-400">sqm</span>
          </div>

          {SHOW_DAILY_TARGET_PROGRESS && (
            <div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                <span>Target: {formatFmt(metrics.targetMilling)} sqm</span>
                <span className="font-mono text-[10px] text-slate-500">
                  {metrics.isMillingSelected ? `${Math.round(metrics.millingProgressPct)}%` : '0%'}
                </span>
              </div>
              {/* Slim 4px Micro Progress Bar */}
              <div className="h-1 bg-white/10 rounded-full overflow-hidden w-full">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    metrics.actualMilling >= metrics.targetMilling ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${metrics.isMillingSelected ? metrics.millingProgressPct : 0}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Metric 3: TACK COAT TODAY / CUMULATIVE */}
        <div
          className={`flex flex-col justify-between h-full space-y-1.5 p-1 border-b sm:border-b-0 sm:border-r border-white/5 pb-3 sm:pb-0 sm:pr-4 transition-opacity ${
            metrics.isTackSelected ? 'opacity-100' : 'opacity-40 grayscale-[40%]'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
                {metrics.isTackSelected ? (isAllSelected ? 'Tack Coat Cumulative' : 'Tack Coat Today') : 'Tack Coat'}
              </span>
            </div>

            {SHOW_DAILY_TARGET_PROGRESS ? (
              metrics.isTackSelected ? (
                metrics.targetTack > 0 && metrics.actualTack > 0 ? (
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      metrics.tackVariancePct >= 0
                        ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-950/70 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {metrics.tackVariancePct >= 0 ? '+' : ''}
                    {metrics.tackVariancePct.toFixed(1)}%
                  </span>
                ) : null
              ) : (
                <span className="text-[9px] font-mono text-slate-500 bg-white/5 px-1 rounded">Filtered</span>
              )
            ) : (
              !metrics.isTackSelected && (
                <span className="text-[9px] font-mono text-slate-500 bg-white/5 px-1 rounded">Filtered</span>
              )
            )}
          </div>

          <div className="text-xl sm:text-2xl font-bold font-mono text-white tracking-tight flex items-baseline gap-1.5">
            <span>{metrics.isTackSelected ? formatFmt(metrics.actualTack) : '—'}</span>
            <span className="text-xs font-normal text-slate-400">sqm</span>
          </div>

          {SHOW_DAILY_TARGET_PROGRESS && (
            <div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                <span>Target: {formatFmt(metrics.targetTack)} sqm</span>
                <span className="font-mono text-[10px] text-slate-500">
                  {metrics.isTackSelected ? `${Math.round(metrics.tackProgressPct)}%` : '0%'}
                </span>
              </div>
              {/* Slim 4px Micro Progress Bar */}
              <div className="h-1 bg-white/10 rounded-full overflow-hidden w-full">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    metrics.actualTack >= metrics.targetTack ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${metrics.isTackSelected ? metrics.tackProgressPct : 0}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Metric 4: DBM PAVEMENT TODAY / CUMULATIVE */}
        <div
          className={`flex flex-col justify-between h-full space-y-1.5 p-1 transition-opacity ${
            metrics.isDbmSelected ? 'opacity-100' : 'opacity-40 grayscale-[40%]'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
                {metrics.isDbmSelected ? (isAllSelected ? 'DBM Cumulative' : 'DBM Pavement') : 'DBM Pavement'}
              </span>
            </div>

            {/* Anomaly Badge or Quality Status */}
            {metrics.anomaliesCount > 0 ? (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-rose-950/70 text-rose-300 border border-rose-500/30 px-1.5 py-0.5 rounded"
                title={metrics.anomalyDescriptions.join(', ')}
              >
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                <span>{metrics.anomaliesCount} Anomaly</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Clean QA</span>
              </span>
            )}
          </div>

          <div className="text-xl sm:text-2xl font-bold font-mono text-white tracking-tight flex items-baseline gap-1.5">
            <span>{metrics.isDbmSelected ? formatFmt(metrics.actualDbmCum, 2) : '—'}</span>
            <span className="text-xs font-normal text-slate-400">Cum</span>
            {metrics.isDbmSelected && metrics.actualDbmMT > 0 && (
              <span className="text-[11px] font-mono text-emerald-400 font-semibold ml-1">
                ({formatFmt(metrics.actualDbmMT, 1)} MT)
              </span>
            )}
          </div>

          {SHOW_DAILY_TARGET_PROGRESS && (
            <div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                <span>Target: {formatFmt(metrics.targetDbmCum, 1)} Cum{isAllSelected && metrics.targetDbmMT > 0 ? ` (${formatFmt(metrics.targetDbmMT, 0)} MT)` : ''}</span>
                <span className="font-mono text-[10px] text-slate-500">
                  {metrics.isDbmSelected ? `${Math.round(metrics.dbmProgressPct)}%` : '0%'}
                </span>
              </div>
              {/* Slim 4px Micro Progress Bar */}
              <div className="h-1 bg-white/10 rounded-full overflow-hidden w-full">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    metrics.actualDbmCum >= metrics.targetDbmCum ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${metrics.isDbmSelected ? metrics.dbmProgressPct : 0}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 4: Daily Work Entries & Stretch Locations (Direct GIS Navigation) */}
      <div className="mt-4 bg-black/35 border border-white/5 rounded-xl p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <MapPin className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-wider text-slate-200 uppercase font-mono">
                  Daily Work Entries & Stretch Locations
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/70 text-cyan-300 border border-cyan-500/30 font-semibold">
                  {dayRows.length} {dayRows.length === 1 ? 'Stretch' : 'Stretches'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                Click <span className="text-cyan-400 font-semibold">Locate</span> to zoom and highlight exact GPS road section on NH-334 GIS Map
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsStretchesExpanded(!isStretchesExpanded)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5 text-[11px] font-mono transition-colors cursor-pointer"
            title={isStretchesExpanded ? 'Collapse stretches list' : 'Expand stretches list'}
          >
            <span>{isStretchesExpanded ? 'Hide' : 'Show'}</span>
            {isStretchesExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {isStretchesExpanded && (
          dayRows.length === 0 ? (
            <div className="p-3 text-center text-xs text-slate-500 font-mono bg-white/[0.01] rounded-lg border border-white/5">
              No individual DPR work entries recorded for {isAllSelected ? 'the selected filters' : activeDate}.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar pr-1">
              {dayRows.map((row, idx) => {
                const fromM = row.rawFromChainage || Math.round((row.fromChainage || 0) * 1000);
                const toM = row.rawToChainage || Math.round((row.toChainage || 0) * 1000);
                const fromChFmt = formatChainageM(fromM);
                const toChFmt = formatChainageM(toM);
                const lenM = row.lengthM || Math.abs(toM - fromM);

                return (
                  <div
                    key={row.id || `${row.date}-${row.activity}-${fromM}-${idx}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-cyan-500/30 transition-all gap-2 text-xs font-mono"
                  >
                    {/* Left: Date, Activity, Side & Lane */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-slate-400 text-[11px] bg-white/5 px-1.5 py-0.5 rounded">
                        {row.date}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                          row.activity === 'Milling'
                            ? 'bg-cyan-950/70 text-cyan-300 border-cyan-500/40'
                            : row.activity === 'Tackcoat'
                            ? 'bg-amber-950/70 text-amber-300 border-amber-500/40'
                            : 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40'
                        }`}
                      >
                        {row.activity}
                      </span>
                      <span className="text-slate-300 font-semibold bg-white/5 px-1.5 py-0.5 rounded text-[11px]">
                        {row.side} • {row.lane || 'MCW'}
                      </span>
                      {row.isAnomaly && (
                        <span className="text-[10px] text-rose-300 bg-rose-950/50 border border-rose-500/30 px-1.5 py-0.5 rounded flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />
                          <span>Anomaly</span>
                        </span>
                      )}
                    </div>

                    {/* Middle: Chainage span & Output */}
                    <div className="flex items-center gap-3 text-slate-300">
                      <span className="text-white font-bold">
                        {fromChFmt} <span className="text-slate-500 font-normal">→</span> {toChFmt}
                      </span>
                      <span className="text-slate-400 text-[11px]">
                        ({lenM.toLocaleString()} m)
                      </span>
                      {row.achievedToday > 0 && (
                        <span className="text-emerald-400 font-semibold text-[11px] hidden md:inline">
                          {formatFmt(row.achievedToday, 1)} {row.unit || 'sqm'}
                        </span>
                      )}
                    </div>

                    {/* Right: Map Pin Action Button */}
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => {
                          if (onNavigateToLocation) {
                            onNavigateToLocation(row);
                          } else if (onSelectRow) {
                            onSelectRow(row);
                          }
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/30 border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 hover:text-white font-mono text-xs font-semibold transition-all shadow-sm shadow-cyan-500/10 cursor-pointer group shrink-0"
                        title={`Locate ${row.activity} stretch (${fromChFmt} → ${toChFmt}) on NH-334 GIS Map`}
                      >
                        <MapPin className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
                        <span>Locate</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
};
