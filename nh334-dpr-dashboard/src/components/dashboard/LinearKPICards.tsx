import React, { useMemo, useState, useEffect } from 'react';
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
  X,
  Maximize2,
  BarChart3
} from 'lucide-react';
import { ActualDPRRow, ProjectBaseline, ActivityType, BOQCardMetric, HighwaySide, LinearLaneFilter, LinearStretchFilter } from '../../types/dpr';
import { Badge } from '../ui/Badge';
import { MiniTripleBarChart } from '../ui/MiniTripleBarChart';
import { serialToIsoDate, isoToDisplayDate, getLinearTargetM } from '../../utils/excelParser';
import { useFilters } from '../../context/FilterContext';
import { STATE_BOUNDARIES } from '../../utils/stateFilterUtils';

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

// Feature flag: Hide Exposed Milled Gap card from linear progress grid
const SHOW_EXPOSED_GAP_CARD = false;
// Feature flag: Hide secondary operational status badges from linear KPI card face
const SHOW_CARD_STATUS_BADGES = false;
// Feature flag: Temporarily hide "Today" values from all card faces (strictly toggleable: set to true to retrieve/show)
const SHOW_TODAY_VALUES = false;

const STRETCH_BOUNDARIES: Record<LinearStretchFilter, { minM: number; maxM: number; label: string; lengthKm: number }> = {
  'All': { minM: 130560, maxM: 206220, label: 'Corridor: Ch. 130+560 to 206+220 BHS (75.66 km)', lengthKm: 75.66 },
  'Stretch 1': { minM: 130560, maxM: 167250, label: 'Stretch 1: Ch. 130+560 to 167+250 (36.69 km)', lengthKm: 36.69 },
  'Stretch 2': { minM: 167250, maxM: 190000, label: 'Stretch 2: Ch. 167+250 to 190+000 (22.75 km)', lengthKm: 22.75 },
  'Stretch 3': { minM: 190000, maxM: 206220, label: 'Stretch 3: Ch. 190+000 to 206+220 (16.22 km)', lengthKm: 16.22 }
};

const getRowLengthM = (r: ActualDPRRow): number => {
  if (r.lengthM !== undefined && r.lengthM !== null && !isNaN(r.lengthM) && r.lengthM > 0) {
    return r.lengthM;
  }
  return Math.abs(r.rawToChainage - r.rawFromChainage);
};

const getRowLengthInStretchM = (r: ActualDPRRow, stretch: LinearStretchFilter): number => {
  const rawFrom = r.rawFromChainage || Math.round(r.fromChainage * 1000);
  const rawTo = r.rawToChainage || Math.round(r.toChainage * 1000);
  const minCh = Math.min(rawFrom, rawTo);
  const maxCh = Math.max(rawFrom, rawTo);

  // If 'All Stretches', return original length directly to preserve exact full-corridor values
  if (stretch === 'All') {
    return getRowLengthM(r);
  }

  if (isNaN(minCh) || isNaN(maxCh) || (minCh === 0 && maxCh === 0)) {
    return 0;
  }

  const boundary = STRETCH_BOUNDARIES[stretch];
  const overlapStart = Math.max(minCh, boundary.minM);
  const overlapEnd = Math.min(maxCh, boundary.maxM);

  if (overlapEnd <= overlapStart) {
    return 0; // Not inside this stretch
  }

  const overlapM = overlapEnd - overlapStart;
  const spanM = maxCh - minCh;

  if (spanM <= 0) {
    return (minCh >= boundary.minM && minCh <= boundary.maxM) ? getRowLengthM(r) : 0;
  }

  // If fully within stretch boundaries
  if (overlapM === spanM) {
    return getRowLengthM(r);
  }

  // If crossing boundary, split proportionally to prevent double-counting
  const totalLen = getRowLengthM(r);
  return Math.round(totalLen * (overlapM / spanM));
};

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

  // Determine active highlights based on global filter
  const isAllActivities = !selectedActivities || selectedActivities.length >= 4 || selectedActivities.length === 0;
  const isMillingSelected = isAllActivities || (selectedActivities?.includes('Milling') ?? true);
  const isTackSelected = isAllActivities || (selectedActivities?.includes('Tackcoat') ?? true);
  const isDbmSelected = isAllActivities || (selectedActivities?.includes('DBM') ?? true);
  const isBcActive = isAllActivities || (selectedActivities?.includes('BC') ?? true);
  const isBcSelected = Boolean(selectedActivities && selectedActivities.length === 1 && selectedActivities.includes('BC'));

  // Global lane, stretch, and state selection from context
  const { linearLane = 'All', linearStretch = 'All', state: selectedState = 'All' } = useFilters();
  const stateBoundary = STATE_BOUNDARIES[selectedState];

  const displayCorridorText = useMemo(() => {
    const sideSuffix = side === 'Both' ? 'BHS' : side;
    if (selectedState !== 'All') {
      const stateSuffix = selectedState === 'Uttar Pradesh' ? 'UP' : 'UK';
      if (linearStretch === 'All') {
        return `${selectedState}: Ch. ${stateBoundary.minKm.toFixed(3)} to ${stateBoundary.maxKm.toFixed(3)} ${sideSuffix}`;
      } else {
        const sBound = STRETCH_BOUNDARIES[linearStretch];
        const interMin = Math.max(sBound.minM / 1000, stateBoundary.minKm);
        const interMax = Math.min(sBound.maxM / 1000, stateBoundary.maxKm);
        if (interMax <= interMin) {
          return `${linearStretch} (${stateSuffix}): Outside State Range`;
        }
        return `${linearStretch} (${stateSuffix}): Ch. ${interMin.toFixed(3)} to ${interMax.toFixed(3)} ${sideSuffix}`;
      }
    }
    if (linearStretch === 'All') {
      return `Corridor: Ch. 130+560 to 206+220 ${sideSuffix}`;
    }
    return `${linearStretch}: ${linearStretch === 'Stretch 1' ? 'Ch. 130+560 to 167+250' : linearStretch === 'Stretch 2' ? 'Ch. 167+250 to 190+000' : 'Ch. 190+000 to 206+220'} ${sideSuffix}`;
  }, [selectedState, stateBoundary, linearStretch, side]);

  const displayScopeText = useMemo(() => {
    if (selectedState !== 'All') {
      if (linearStretch === 'All') {
        return `State Scope: ${stateBoundary.lengthKm.toFixed(2)} km (${(stateBoundary.lengthKm * 2).toFixed(2)} km BHS)`;
      } else {
        const sBound = STRETCH_BOUNDARIES[linearStretch];
        const interMin = Math.max(sBound.minM, stateBoundary.minM);
        const interMax = Math.min(sBound.maxM, stateBoundary.maxM);
        const interKm = Math.max(0, (interMax - interMin) / 1000);
        return `Stretch Scope: ${interKm.toFixed(2)} km (${(interKm * 2).toFixed(2)} km BHS)`;
      }
    }
    if (linearStretch === 'All') {
      return 'Corridor Scope: 75.66 km (151.32 km BHS)';
    }
    return `Stretch Scope: ${STRETCH_BOUNDARIES[linearStretch].lengthKm.toFixed(2)} km (${(STRETCH_BOUNDARIES[linearStretch].lengthKm * 2).toFixed(2)} km BHS)`;
  }, [selectedState, stateBoundary, linearStretch]);

  // 1. DYNAMIC CONTRACTUAL TARGET LENGTHS FROM STRETCH-WISE SUMMARY (RESPECTING LANE, STRETCH, & STATE FILTERS)
  // Milling: All: 147.23 km, F/L: 87.89 km, S/L: 59.34 km
  // Tack Coat: All: 235.11 km, F/L: 87.89 km, S/L: 59.34 km
  // DBM: All: 147.23 km, F/L: 87.89 km, S/L: 59.34 km
  // BC: Total: 103.29 km (STRICTLY INDEPENDENT of Lane filter, respects Stretch filter)
  const template = baseline.stretchWiseTemplate;
  const millingTargetM = getLinearTargetM(template, 'Milling', side, linearLane, linearStretch);
  const tackTargetM = getLinearTargetM(template, 'Tackcoat', side, linearLane, linearStretch);
  const dbmTargetM = getLinearTargetM(template, 'DBM', side, linearLane, linearStretch);
  const bcTargetM = getLinearTargetM(template, 'BC', side, 'All', linearStretch); // BC is strictly independent of lane filter

  // 2. LINEAR PHYSICAL LENGTH CALCULATION FROM CHAINAGE LOG(INPUT)
  // Priority:
  // 1. Positive valid Length (m) from column L
  // 2. ABS(To Ch. - From Ch.)
  // 3. Length (km) = Length (m) / 1000
  // Entries crossing stretch boundaries are split proportionally to prevent double-counting.
  const metrics = useMemo(() => {
    // Lane matching helper
    const matchesLane = (rowLane: string, filter: LinearLaneFilter) => {
      if (filter === 'All') return true;
      const norm = (rowLane || '').toUpperCase().trim();
      if (filter === 'Fast Lane') {
        return norm === 'F/L' || norm === 'FL' || norm.startsWith('F/L') || norm.includes('FAST');
      }
      if (filter === 'Slow Lane') {
        return norm === 'S/L' || norm === 'SL' || norm.startsWith('S/L') || norm.includes('SLOW');
      }
      return true;
    };

    // Helper to calculate daily & cumulative for any activity within the active stretch
    const calcActivity = (act: ActivityType, targetM: number) => {
      const actRows = actualRows.filter(
        (r) =>
          r.activity === act &&
          (side === 'Both' || side === 'ALL' || side === 'BHS' || r.side === side) &&
          matchesLane(r.lane, linearLane) &&
          getRowLengthInStretchM(r, linearStretch) > 0
      );

      const dailyRows = actRows.filter((r) => serialToIsoDate(r.date) === selectedIso);
      const cumRows = actRows.filter((r) => serialToIsoDate(r.date) <= selectedIso);

      const dailyM = dailyRows.reduce((sum, r) => sum + getRowLengthInStretchM(r, linearStretch), 0);
      const dailyKm = Number((dailyM / 1000).toFixed(3));
      const dailyEntries = dailyRows.length;

      const cumulativeM = cumRows.reduce((sum, r) => sum + getRowLengthInStretchM(r, linearStretch), 0);
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
        progressPercent,
        cumRows,
        dailyRows
      };
    };

    const milling = calcActivity('Milling', millingTargetM);
    const tack = calcActivity('Tackcoat', tackTargetM);
    const dbm = calcActivity('DBM', dbmTargetM);

    // BC Linear Length Calculation: STRICTLY EXCLUDED FROM LANE FILTERING (Section 2)
    // Planned Target (km): SUM of matching BC planned values from Stretch-wise Summary, col P (or Stretch Col)
    // Actual Achievement (km): SUM of matching BC Length (m) entries from Chainage Log / 1000
    // Note: As required, do not consider "S/L" (Slow Lane) rows from the Lane column to avoid double-counting
    const isBcSlowLane = (laneStr?: string): boolean => {
      const norm = (laneStr || '').toUpperCase().trim();
      return norm === 'S/L' || norm === 'SL';
    };

    const bcActRows = actualRows.filter(
      (r) =>
        r.activity === 'BC' &&
        (side === 'Both' || side === 'ALL' || side === 'BHS' || r.side === side) &&
        !isBcSlowLane(r.lane) &&
        getRowLengthInStretchM(r, linearStretch) > 0
    );
    const bcDailyRows = bcActRows.filter((r) => serialToIsoDate(r.date) === selectedIso);
    const bcCumRows = bcActRows.filter((r) => serialToIsoDate(r.date) <= selectedIso);

    const bcDailyM = bcDailyRows.reduce((sum, r) => sum + getRowLengthInStretchM(r, linearStretch), 0);
    const bcDailyKm = Number((bcDailyM / 1000).toFixed(3));
    const bcDailyEntries = bcDailyRows.length;

    const bcCumulativeM = bcCumRows.reduce((sum, r) => sum + getRowLengthInStretchM(r, linearStretch), 0);
    const bcCumulativeKm = Number((bcCumulativeM / 1000).toFixed(2));
    const bcCumulativeEntries = bcCumRows.length;

    const bcTargetKm = Number((bcTargetM / 1000).toFixed(2));
    const bcBalanceM = Math.max(0, bcTargetM - bcCumulativeM);
    const bcBalanceKm = Number((bcBalanceM / 1000).toFixed(2));
    const bcProgressPercent = bcTargetM > 0 ? Number(((bcCumulativeM / bcTargetM) * 100).toFixed(1)) : 0;

    const bc = {
      targetM: bcTargetM,
      targetKm: bcTargetKm,
      dailyM: bcDailyM,
      dailyKm: bcDailyKm,
      dailyEntries: bcDailyEntries,
      cumulativeM: bcCumulativeM,
      cumulativeKm: bcCumulativeKm,
      cumulativeEntries: bcCumulativeEntries,
      balanceM: bcBalanceM,
      balanceKm: bcBalanceKm,
      progressPercent: bcProgressPercent,
      cumRows: bcCumRows,
      dailyRows: bcDailyRows
    };

    // Sync percentages
    const tackSync = milling.cumulativeM > 0 ? (tack.cumulativeM / milling.cumulativeM) * 100 : 0;
    const dbmSync = milling.cumulativeM > 0 ? (dbm.cumulativeM / milling.cumulativeM) * 100 : 0;

    // Exposed Milled Gap = Milling Cumulative Length - DBM Laid Cumulative Length (using filtered actuals)
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
      dailyNetGapM,
      linearLane,
      linearStretch
    };
  }, [actualRows, selectedIso, side, millingTargetM, tackTargetM, dbmTargetM, bcTargetM, linearLane, linearStretch]);

  // Selected card for detailed pop-up modal
  type LinearCardType = 'milling' | 'tack' | 'dbm' | 'bc' | 'gap';
  const [selectedCard, setSelectedCard] = useState<LinearCardType | null>(null);

  // Close on Escape key & prevent background scroll when modal is open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedCard(null);
    };
    if (selectedCard) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [selectedCard]);

  // Modal payload builder (respecting global linearLane & linearStretch filters)
  const modalData = useMemo(() => {
    if (!selectedCard) return null;

    const stretchLabel = linearStretch === 'All' ? 'All Stretches' : linearStretch;
    const laneLabel = linearLane === 'All' ? 'All Lanes' : linearLane;
    const filterContextSubtitle = `${stretchLabel} • ${laneLabel}`;

    if (selectedCard === 'milling') {
      return {
        title: 'Milling – Chainage Stripped',
        subtitle: `Physical Highway Linear Progress (${filterContextSubtitle})`,
        laneLabel,
        stretchLabel,
        icon: Layers,
        accentColor: '#F59E0B',
        accentBg: 'bg-amber-500/15',
        accentBorder: 'border-amber-400/40',
        accentText: 'text-amber-300',
        ribbonGradient: 'from-cyan-500 via-amber-400 to-amber-500',
        unit: 'lane km',
        planned: metrics.milling.targetM,
        actual: metrics.milling.cumulativeM,
        balance: metrics.milling.balanceM,
        targetKm: metrics.milling.targetKm,
        cumulativeKm: metrics.milling.cumulativeKm,
        dailyM: metrics.milling.dailyM,
        dailyKm: metrics.milling.dailyKm,
        balanceKm: metrics.milling.balanceKm,
        progressPercent: metrics.milling.progressPercent,
        statusText: metrics.milling.progressPercent >= 10 ? 'Stripping Target Normal' : 'Stripping Active',
        statusBadge: `${metrics.milling.progressPercent.toFixed(1)}% Target`,
        statusVariant: metrics.milling.progressPercent >= 10 ? ('emerald' as const) : ('amber' as const),
        extraLabel: 'Stripping Status',
        extraValue: `Active (${stretchLabel} • ${laneLabel} Stripping)`,
        records: metrics.milling.cumRows,
        boqMetric: boqMetrics?.milling
      };
    }

    if (selectedCard === 'tack') {
      return {
        title: 'Tack Coat – Bitumen Emulsion Seal',
        subtitle: `Physical Highway Linear Progress (${filterContextSubtitle})`,
        laneLabel,
        stretchLabel,
        icon: Flame,
        accentColor: '#06B6D4',
        accentBg: 'bg-cyan-500/15',
        accentBorder: 'border-cyan-400/40',
        accentText: 'text-cyan-300',
        ribbonGradient: 'from-cyan-400 via-sky-400 to-blue-500',
        unit: 'lane km',
        planned: metrics.tack.targetM,
        actual: metrics.tack.cumulativeM,
        balance: metrics.tack.balanceM,
        targetKm: metrics.tack.targetKm,
        cumulativeKm: metrics.tack.cumulativeKm,
        dailyM: metrics.tack.dailyM,
        dailyKm: metrics.tack.dailyKm,
        balanceKm: metrics.tack.balanceKm,
        progressPercent: metrics.tack.progressPercent,
        statusText: `Milling Synchronization: ${metrics.tackSync.toFixed(1)}%`,
        statusBadge: `${metrics.tack.progressPercent.toFixed(1)}% Target`,
        statusVariant: metrics.tack.progressPercent >= 8.5 ? ('emerald' as const) : ('cyan' as const),
        extraLabel: 'Milling Sync Ratio',
        extraValue: `${metrics.tackSync.toFixed(1)}% of milled chainage sealed with Tack Coat (${stretchLabel} • ${laneLabel})`,
        records: metrics.tack.cumRows,
        boqMetric: boqMetrics?.tackcoat
      };
    }

    if (selectedCard === 'dbm') {
      return {
        title: 'DBM Laid – 50mm Bituminous Base Course',
        subtitle: `Physical Highway Linear Progress (${filterContextSubtitle})`,
        laneLabel,
        stretchLabel,
        icon: Truck,
        accentColor: '#10B981',
        accentBg: 'bg-emerald-500/15',
        accentBorder: 'border-emerald-400/40',
        accentText: 'text-emerald-300',
        ribbonGradient: 'from-emerald-400 via-teal-400 to-cyan-500',
        unit: 'lane km',
        planned: metrics.dbm.targetM,
        actual: metrics.dbm.cumulativeM,
        balance: metrics.dbm.balanceM,
        targetKm: metrics.dbm.targetKm,
        cumulativeKm: metrics.dbm.cumulativeKm,
        dailyM: metrics.dbm.dailyM,
        dailyKm: metrics.dbm.dailyKm,
        balanceKm: metrics.dbm.balanceKm,
        progressPercent: metrics.dbm.progressPercent,
        statusText: `Milling Coverage: ${metrics.dbmSync.toFixed(1)}%`,
        statusBadge: `${metrics.dbm.progressPercent.toFixed(1)}% Paved`,
        statusVariant: metrics.dbm.progressPercent >= 8.5 ? ('emerald' as const) : ('cyan' as const),
        extraLabel: 'Milling Coverage Ratio',
        extraValue: `${metrics.dbmSync.toFixed(1)}% of stripped surface paved with DBM (${stretchLabel} • ${laneLabel})`,
        records: metrics.dbm.cumRows,
        boqMetric: boqMetrics?.dbm
      };
    }

    if (selectedCard === 'bc') {
      return {
        title: 'BC (Wearing Course) – Bituminous Concrete',
        subtitle: `Physical Highway Linear Progress (${stretchLabel} • Excl. S/L)`,
        laneLabel: 'Excl. S/L (BC Deduplicated)',
        stretchLabel,
        icon: Navigation,
        accentColor: '#10B981',
        accentBg: 'bg-emerald-500/15',
        accentBorder: 'border-emerald-400/40',
        accentText: 'text-emerald-300',
        ribbonGradient: 'from-emerald-400 via-teal-400 to-green-500',
        unit: 'km',
        planned: metrics.bc.targetM,
        actual: metrics.bc.cumulativeM,
        balance: metrics.bc.balanceM,
        targetKm: metrics.bc.targetKm,
        cumulativeKm: metrics.bc.cumulativeKm,
        dailyM: metrics.bc.dailyM,
        dailyKm: metrics.bc.dailyKm,
        balanceKm: metrics.bc.balanceKm,
        progressPercent: metrics.bc.progressPercent,
        statusText: `Calculation Method: Sum across ${stretchLabel} (Excluding S/L)`,
        statusBadge: `${metrics.bc.progressPercent.toFixed(1)}% Target`,
        statusVariant: 'emerald' as const,
        extraLabel: 'Calculation Method',
        extraValue: `Sum of all chainages in ${stretchLabel} excluding S/L rows to avoid dual-lane double counting`,
        records: metrics.bc.cumRows,
        boqMetric: boqMetrics?.bc
      };
    }

    // Gap
    return {
      title: 'Exposed Milled Gap & Pavement Continuity',
      subtitle: `Uncovered Lane Safety & Continuity Monitoring (${filterContextSubtitle})`,
      laneLabel,
      stretchLabel,
      icon: AlertTriangle,
      accentColor: '#F43F5E',
      accentBg: metrics.exposedGapM > 1000 ? 'bg-rose-500/20' : 'bg-amber-500/20',
      accentBorder: metrics.exposedGapM > 1000 ? 'border-rose-400/40' : 'border-amber-400/40',
      accentText: metrics.exposedGapM > 1000 ? 'text-rose-300' : 'text-amber-300',
      ribbonGradient: 'from-amber-400 via-rose-500 to-red-600',
      unit: 'lane km',
      planned: metrics.milling.cumulativeM > 0 ? metrics.milling.cumulativeM : metrics.milling.targetM,
      actual: metrics.dbm.cumulativeM,
      balance: metrics.exposedGapM,
      targetKm: Number(((metrics.milling.cumulativeM > 0 ? metrics.milling.cumulativeM : metrics.milling.targetM) / 1000).toFixed(2)),
      cumulativeKm: metrics.dbm.cumulativeKm,
      dailyM: metrics.dailyNetGapM,
      dailyKm: Number((metrics.dailyNetGapM / 1000).toFixed(3)),
      balanceKm: metrics.exposedGapKm,
      progressPercent: metrics.dbmSync,
      statusText: metrics.exposedGapM > 1500 ? 'High Exposure Alert (>1,500 m uncovered)' : metrics.exposedGapM > 500 ? 'Safety Watch Window (500–1,500 m)' : 'Optimal Window (<500 m uncovered)',
      statusBadge: metrics.exposedGapM > 1500 ? 'High Exposure' : metrics.exposedGapM > 500 ? 'Safety Watch' : 'Optimal',
      statusVariant: metrics.exposedGapM > 1500 ? ('crimson' as const) : metrics.exposedGapM > 500 ? ('amber' as const) : ('emerald' as const),
      extraLabel: 'Pavement Continuity',
      extraValue: `${metrics.dbmSync.toFixed(1)}% paved with DBM in ${stretchLabel} • ${laneLabel} | Net Gap: ${fmt(metrics.exposedGapM)} m`,
      records: [],
      boqMetric: undefined
    };
  }, [selectedCard, metrics, boqMetrics, linearLane, linearStretch]);

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
            {displayCorridorText}
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0D1524] border border-cyan-500/30 shadow-sm font-medium text-cyan-300">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            {displayScopeText}
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0D1524] border border-cyan-500/30 shadow-sm font-medium text-cyan-300">
            <Calendar className="w-3 h-3 text-cyan-400" />
            As-of Date: {selectedDisplayDate}
          </span>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 4 LINEAR KPI CARDS GRID - CYBER BLUEPRINT SLATE THEME          */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* ============================================================== */}
        {/* Card 1: Milling Progress (Linear Metric)                       */}
        {/* ============================================================== */}
        <div
          onClick={() => setSelectedCard('milling')}
          className={`relative group transition-all duration-300 rounded-2xl overflow-hidden bg-gradient-to-b from-[#0F172A] to-[#0A0F1D] border border-cyan-500/30 shadow-xl shadow-cyan-950/20 cursor-pointer hover:border-amber-400/80 hover:shadow-2xl hover:shadow-amber-950/30 hover:-translate-y-0.5 select-none ${
            isMillingSelected ? 'opacity-100 ring-1 ring-amber-400/50' : 'opacity-40 grayscale-[40%]'
          }`}
          title="Click card to view detailed breakdown & column chart"
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
                  </div>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">Chainage stripped</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
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
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCard('milling');
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/30 transition-colors"
                  title="Click to view details & column chart"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Primary Achieved & Target Section (Full width, chart moved to pop-up) */}
            <div className="mt-4 w-full">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight drop-shadow-sm">
                  {isMillingSelected ? metrics.milling.cumulativeKm.toFixed(2) : '—'}
                </span>
                <span className="text-xs text-amber-400 font-bold font-mono">lane km</span>
                {isMillingSelected && (
                  <span className="text-xs text-slate-300 font-mono ml-1 font-bold">
                    ({fmt(metrics.milling.cumulativeM)} m)
                  </span>
                )}
              </div>

              {/* Total Target Length row */}
              <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-1 font-medium flex-wrap">
                <span className="text-slate-400 whitespace-nowrap">Total Target:</span>
                <span className="font-mono font-bold text-white bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/20 whitespace-normal break-words inline-block">
                  {metrics.milling.targetKm.toFixed(2)} lane km ({fmt(metrics.milling.targetM)} m)
                </span>
              </div>

              {/* Selected Day Progress row */}
              {SHOW_TODAY_VALUES && (
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-mono flex-wrap">
                  <span className="text-slate-400 whitespace-nowrap">Today:</span>
                  {metrics.milling.dailyM > 0 ? (
                    <span className="font-bold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30 whitespace-normal break-words inline-block">
                      +{metrics.milling.dailyKm.toFixed(3)} lane km ({fmt(metrics.milling.dailyM)} m)
                    </span>
                  ) : (
                    <span className="text-slate-500 bg-[#0A101D] px-2 py-0.5 rounded border border-slate-700/50 whitespace-normal break-words inline-block">
                      0 lane km
                    </span>
                  )}
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
                {SHOW_CARD_STATUS_BADGES && (
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
                )}

                {isMillingSelected && (
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0A101D] border border-cyan-500/30 text-xs font-mono shadow-sm whitespace-nowrap shrink-0 ${!SHOW_CARD_STATUS_BADGES ? 'ml-auto' : ''}`}>
                    <span className="text-slate-400 font-medium">Balance:</span>
                    <span className="font-extrabold text-amber-300 whitespace-nowrap">
                      {metrics.milling.balanceKm.toFixed(2)}&nbsp;lane km
                    </span>
                    <span className="text-slate-300 font-bold whitespace-nowrap hidden sm:inline">
                      ({fmt(metrics.milling.balanceM)}&nbsp;m)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Click hint footer */}
            <div className="mt-2.5 pt-2 border-t border-cyan-500/10 flex items-center justify-between text-[10px] text-slate-400">
              <span className="flex items-center gap-1 group-hover:text-amber-300 transition-colors">
                <BarChart3 className="w-3 h-3 text-amber-400" />
                <span>Click for details & chart</span>
              </span>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* Card 2: Tack Coat Progress (Linear Metric)                     */}
        {/* ============================================================== */}
        <div
          onClick={() => setSelectedCard('tack')}
          className={`relative group transition-all duration-300 rounded-2xl overflow-hidden bg-gradient-to-b from-[#0F172A] to-[#0A0F1D] border border-cyan-500/30 shadow-xl shadow-cyan-950/20 cursor-pointer hover:border-cyan-400/80 hover:shadow-2xl hover:shadow-cyan-950/30 hover:-translate-y-0.5 select-none ${
            isTackSelected ? 'opacity-100 ring-1 ring-cyan-400/50' : 'opacity-40 grayscale-[40%]'
          }`}
          title="Click card to view detailed breakdown & column chart"
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
                  </div>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">Bitumen emulsion seal</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
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
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCard('tack');
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 border border-transparent hover:border-cyan-500/30 transition-colors"
                  title="Click to view details & column chart"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Primary Achieved & Target Section (Full width, chart moved to pop-up) */}
            <div className="mt-4 w-full">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight drop-shadow-sm">
                  {isTackSelected ? metrics.tack.cumulativeKm.toFixed(2) : '—'}
                </span>
                <span className="text-xs text-cyan-400 font-bold font-mono">lane km</span>
                {isTackSelected && (
                  <span className="text-xs text-slate-300 font-mono ml-1 font-bold">
                    ({fmt(metrics.tack.cumulativeM)} m)
                  </span>
                )}
              </div>

              {/* Total Target Length row */}
              <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-1.5 font-medium flex-wrap">
                <span className="text-slate-400 whitespace-nowrap">Total Target:</span>
                <span className="font-mono font-bold text-white bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/20 whitespace-normal break-words inline-block">
                  {metrics.tack.targetKm.toFixed(2)} lane km ({fmt(metrics.tack.targetM)} m)
                </span>
              </div>

              {/* Selected Day Progress row */}
              {SHOW_TODAY_VALUES && (
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-mono flex-wrap">
                  <span className="text-slate-400 whitespace-nowrap">Today:</span>
                  {metrics.tack.dailyM > 0 ? (
                    <span className="font-bold text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30 whitespace-normal break-words inline-block">
                      +{metrics.tack.dailyKm.toFixed(3)} lane km ({fmt(metrics.tack.dailyM)} m)
                    </span>
                  ) : (
                    <span className="text-slate-500 bg-[#0A101D] px-2 py-0.5 rounded border border-slate-700/50 whitespace-normal break-words inline-block">
                      0 lane km
                    </span>
                  )}
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
                {SHOW_CARD_STATUS_BADGES && (
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
                )}

                {isTackSelected && (
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0A101D] border border-cyan-500/30 text-xs font-mono shadow-sm whitespace-nowrap shrink-0 ${!SHOW_CARD_STATUS_BADGES ? 'ml-auto' : ''}`}>
                    <span className="text-slate-400 font-medium">Balance:</span>
                    <span className="font-extrabold text-cyan-300 whitespace-nowrap">
                      {metrics.tack.balanceKm.toFixed(2)}&nbsp;lane km
                    </span>
                    <span className="text-slate-300 font-bold whitespace-nowrap hidden sm:inline">
                      ({fmt(metrics.tack.balanceM)}&nbsp;m)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Click hint footer */}
            <div className="mt-2.5 pt-2 border-t border-cyan-500/10 flex items-center justify-between text-[10px] text-slate-400">
              <span className="flex items-center gap-1 group-hover:text-cyan-300 transition-colors">
                <BarChart3 className="w-3 h-3 text-cyan-400" />
                <span>Click for details & chart</span>
              </span>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* Card 3: DBM Laid (Linear Metric)                               */}
        {/* ============================================================== */}
        <div
          onClick={() => setSelectedCard('dbm')}
          className={`relative group transition-all duration-300 rounded-2xl overflow-hidden bg-gradient-to-b from-[#0F172A] to-[#0A0F1D] border border-cyan-500/30 shadow-xl shadow-cyan-950/20 cursor-pointer hover:border-emerald-400/80 hover:shadow-2xl hover:shadow-emerald-950/30 hover:-translate-y-0.5 select-none ${
            isDbmSelected ? 'opacity-100 ring-1 ring-emerald-400/50' : 'opacity-40 grayscale-[40%]'
          }`}
          title="Click card to view detailed breakdown & column chart"
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
                  </div>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">50mm base course paved</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
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
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCard('dbm');
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/30 transition-colors"
                  title="Click to view details & column chart"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Primary Achieved & Target Section (Full width, chart moved to pop-up) */}
            <div className="mt-4 w-full">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight drop-shadow-sm">
                  {isDbmSelected ? metrics.dbm.cumulativeKm.toFixed(2) : '—'}
                </span>
                <span className="text-xs text-emerald-400 font-bold font-mono">lane km</span>
                {isDbmSelected && (
                  <span className="text-xs text-slate-300 font-mono ml-1 font-bold">
                    ({fmt(metrics.dbm.cumulativeM)} m)
                  </span>
                )}
              </div>

              {/* Total Target Length row */}
              <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-1.5 font-medium flex-wrap">
                <span className="text-slate-400 whitespace-nowrap">Total Target:</span>
                <span className="font-mono font-bold text-white bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/20 whitespace-normal break-words inline-block">
                  {metrics.dbm.targetKm.toFixed(2)} lane km ({fmt(metrics.dbm.targetM)} m)
                </span>
              </div>

              {/* Selected Day Progress row */}
              {SHOW_TODAY_VALUES && (
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-mono flex-wrap">
                  <span className="text-slate-400 whitespace-nowrap">Today:</span>
                  {metrics.dbm.dailyM > 0 ? (
                    <span className="font-bold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30 whitespace-normal break-words inline-block">
                      +{metrics.dbm.dailyKm.toFixed(3)} lane km ({fmt(metrics.dbm.dailyM)} m)
                    </span>
                  ) : (
                    <span className="text-slate-500 bg-[#0A101D] px-2 py-0.5 rounded border border-slate-700/50 whitespace-normal break-words inline-block">
                      0 lane km
                    </span>
                  )}
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
                {SHOW_CARD_STATUS_BADGES && (
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
                )}

                {isDbmSelected && (
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0A101D] border border-cyan-500/30 text-xs font-mono shadow-sm whitespace-nowrap shrink-0 ${!SHOW_CARD_STATUS_BADGES ? 'ml-auto' : ''}`}>
                    <span className="text-slate-400 font-medium">Balance:</span>
                    <span className="font-extrabold text-emerald-300 whitespace-nowrap">
                      {metrics.dbm.balanceKm.toFixed(2)}&nbsp;lane km
                    </span>
                    <span className="text-slate-300 font-bold whitespace-nowrap hidden sm:inline">
                      ({fmt(metrics.dbm.balanceM)}&nbsp;m)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Click hint footer */}
            <div className="mt-2.5 pt-2 border-t border-cyan-500/10 flex items-center justify-between text-[10px] text-slate-400">
              <span className="flex items-center gap-1 group-hover:text-emerald-300 transition-colors">
                <BarChart3 className="w-3 h-3 text-emerald-400" />
                <span>Click for details & chart</span>
              </span>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* Card 4: BC (Wearing Course) - Sum Target Length Metric         */}
        {/* ============================================================== */}
        <div
          onClick={() => setSelectedCard('bc')}
          className={`relative group transition-all duration-300 rounded-2xl overflow-hidden bg-gradient-to-b from-[#0F172A] to-[#0A0F1D] border border-emerald-500/30 shadow-xl shadow-emerald-950/20 cursor-pointer hover:border-emerald-400/80 hover:shadow-2xl hover:shadow-emerald-950/30 hover:-translate-y-0.5 select-none ${
            isBcActive ? 'opacity-100 ring-1 ring-emerald-400/50' : 'opacity-40 grayscale-[40%]'
          }`}
          title="Click card to view detailed breakdown & column chart"
        >
          {/* Top Highway Centerline Ribbon */}
          <div className="h-1.5 w-full bg-gradient-to-r from-emerald-400 via-teal-400 to-green-500 relative">
            <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_8px,rgba(0,0,0,0.4)_8px,rgba(0,0,0,0.4)_16px)]" />
          </div>

          <div className="px-3.5 py-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2.5 rounded-xl border ${
                    isBcActive
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40 shadow-md shadow-emerald-950/40'
                      : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}
                >
                  <Navigation className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold uppercase tracking-wider text-white drop-shadow-sm">
                      BC
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">Wearing Course</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {isBcActive ? (
                  <Badge
                    variant="emerald"
                    size="sm"
                    className="font-mono font-bold shadow-sm"
                  >
                    {`${metrics.bc.progressPercent.toFixed(1)}% Target`}
                  </Badge>
                ) : (
                  <Badge variant="neutral" size="xs">
                    Filtered Out
                  </Badge>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCard('bc');
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/30 transition-colors"
                  title="Click to view details & column chart"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Primary Achieved & Target Section (Full width, chart moved to pop-up) */}
            <div className="mt-4 w-full">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight drop-shadow-sm">
                  {isBcActive ? metrics.bc.cumulativeKm.toFixed(2) : '—'}
                </span>
                <span className="text-xs text-emerald-400 font-bold font-mono">km</span>
                {isBcActive && (
                  <span className="text-xs text-slate-300 font-mono ml-1 font-bold">
                    ({fmt(metrics.bc.cumulativeM)} m)
                  </span>
                )}
              </div>

              {/* Total Target Length row */}
              <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-1.5 font-medium flex-wrap">
                <span className="text-slate-400 whitespace-nowrap">Total Target:</span>
                <span className="font-mono font-bold text-white bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/20 whitespace-normal break-words inline-block">
                  {metrics.bc.targetKm.toFixed(2)} km ({fmt(metrics.bc.targetM)} m)
                </span>
              </div>

              {/* Selected Day Progress row */}
              {SHOW_TODAY_VALUES && (
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-mono flex-wrap">
                  <span className="text-slate-400 whitespace-nowrap">Today:</span>
                  {metrics.bc.dailyM > 0 ? (
                    <span className="font-bold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30 whitespace-normal break-words inline-block">
                      +{metrics.bc.dailyKm.toFixed(3)} km ({fmt(metrics.bc.dailyM)} m)
                    </span>
                  ) : (
                    <span className="text-slate-500 bg-[#0A101D] px-2 py-0.5 rounded border border-slate-700/50 whitespace-normal break-words inline-block">
                      0 km
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Progress Bar with Highway Ticks */}
            <div className="mt-3.5">
              <div className="w-full h-2 rounded-full bg-[#090D16] border border-cyan-500/20 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-green-500 rounded-full transition-all duration-500 shadow-sm shadow-emerald-500/50"
                  style={{
                    width: `${isBcActive ? Math.min(metrics.bc.progressPercent, 100) : 0}%`
                  }}
                />
              </div>

              <div className="mt-2.5 flex items-center justify-between text-xs gap-1.5 min-w-0">
                {SHOW_CARD_STATUS_BADGES && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 font-bold font-mono whitespace-nowrap shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Method: Sum</span>
                  </span>
                )}

                {isBcActive && (
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0A101D] border border-cyan-500/30 text-xs font-mono shadow-sm whitespace-nowrap shrink-0 ${!SHOW_CARD_STATUS_BADGES ? 'ml-auto' : ''}`}>
                    <span className="text-slate-400 font-medium">Balance:</span>
                    <span className="font-extrabold text-emerald-300 whitespace-nowrap">
                      {metrics.bc.balanceKm.toFixed(2)}&nbsp;km
                    </span>
                    <span className="text-slate-300 font-bold whitespace-nowrap hidden sm:inline">
                      ({fmt(metrics.bc.balanceM)}&nbsp;m)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Click hint footer */}
            <div className="mt-2.5 pt-2 border-t border-cyan-500/10 flex items-center justify-between text-[10px] text-slate-400">
              <span className="flex items-center gap-1 group-hover:text-emerald-300 transition-colors">
                <BarChart3 className="w-3 h-3 text-emerald-400" />
                <span>Click for details & chart</span>
              </span>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* Card 5: Exposed Milled Gap & Pavement Continuity (Hidden)      */}
        {/* ============================================================== */}
        {SHOW_EXPOSED_GAP_CARD && (
          <div
            onClick={() => setSelectedCard('gap')}
            className="relative group transition-all duration-300 rounded-2xl overflow-hidden bg-gradient-to-b from-[#0F172A] to-[#0A0F1D] border border-rose-500/30 shadow-xl shadow-rose-950/20 cursor-pointer hover:border-rose-400/80 hover:shadow-2xl hover:shadow-rose-950/30 hover:-translate-y-0.5 select-none"
            title="Click card to view detailed breakdown & column chart"
          >
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
                    </div>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">Uncovered lane waiting DBM</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Badge
                    variant={metrics.exposedGapM > 1500 ? 'crimson' : metrics.exposedGapM > 500 ? 'amber' : 'emerald'}
                    size="sm"
                    className="font-mono font-bold shadow-sm"
                  >
                    {metrics.exposedGapM > 1500 ? 'High Exposure' : metrics.exposedGapM > 500 ? 'Safety Watch' : 'Optimal'}
                  </Badge>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCard('gap');
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition-colors"
                    title="Click to view details & column chart"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Primary Gap Metric & Coverage Breakdown (Full width, chart moved to pop-up) */}
              <div className="mt-4 w-full">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight drop-shadow-sm">
                    {metrics.exposedGapKm.toFixed(2)}
                  </span>
                  <span className="text-xs text-rose-400 font-bold font-mono">lane km</span>
                  <span className="text-xs text-slate-300 font-mono ml-1 font-bold">
                    ({fmt(metrics.exposedGapM)} m)
                  </span>
                </div>

                {/* Coverage row: Milled vs Paved */}
                <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-1.5 font-medium flex-wrap">
                  <span className="text-slate-400 whitespace-nowrap">Milled:</span>
                  <span className="font-mono font-bold text-white bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/20 whitespace-normal break-words inline-block">
                    {metrics.milling.cumulativeKm.toFixed(2)} lane km ({fmt(metrics.milling.cumulativeM)} m)
                  </span>
                  <span className="text-slate-400 ml-1 whitespace-nowrap">Paved:</span>
                  <span className="font-mono font-bold text-emerald-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/20 whitespace-normal break-words inline-block">
                    {metrics.dbm.cumulativeKm.toFixed(2)} lane km ({fmt(metrics.dbm.cumulativeM)} m)
                  </span>
                </div>

                {/* Selected Day Net Gap change */}
                {SHOW_TODAY_VALUES && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-mono flex-wrap">
                    <span className="text-slate-400 whitespace-nowrap">Today Delta:</span>
                    <span
                      className={`font-mono font-bold px-2 py-0.5 rounded border whitespace-normal break-words inline-block ${
                        metrics.dailyNetGapM > 0
                          ? 'text-rose-300 bg-rose-950/60 border-rose-500/30'
                          : metrics.dailyNetGapM < 0
                          ? 'text-emerald-300 bg-emerald-950/60 border-emerald-500/30'
                          : 'text-slate-400 bg-[#0A101D] border-slate-700/50'
                      }`}
                    >
                      {metrics.dailyNetGapM > 0
                        ? `+${(metrics.dailyNetGapM / 1000).toFixed(3)} lane km (${fmt(metrics.dailyNetGapM)} m)`
                        : metrics.dailyNetGapM < 0
                        ? `${(metrics.dailyNetGapM / 1000).toFixed(3)} lane km (${fmt(metrics.dailyNetGapM)} m)`
                        : '0 lane km'}
                      <span className="text-slate-400 text-[10px] ml-1 font-normal">
                        (M: +{metrics.milling.dailyKm.toFixed(3)} | D: +{metrics.dbm.dailyKm.toFixed(3)})
                      </span>
                    </span>
                  </div>
                )}
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
                      {metrics.bc.cumulativeKm.toFixed(2)}&nbsp;km
                    </span>
                    <span className="text-slate-400 font-bold whitespace-nowrap">
                      ({fmt(metrics.bc.cumulativeM)}&nbsp;m)
                    </span>
                  </div>
                </div>
              </div>

              {/* Click hint footer */}
              <div className="mt-2.5 pt-2 border-t border-rose-500/10 flex items-center justify-between text-[10px] text-slate-400">
                <span className="flex items-center gap-1 group-hover:text-rose-300 transition-colors">
                  <BarChart3 className="w-3 h-3 text-rose-400" />
                  <span>Click for details & chart</span>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* CARD DETAILS POP-UP MODAL (WITH COLUMN CHART VISUAL & STATS)  */}
      {/* ============================================================== */}
      {selectedCard && modalData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setSelectedCard(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto bg-gradient-to-b from-[#0F172A] via-[#0B101D] to-[#070B14] border border-cyan-500/40 rounded-2xl shadow-2xl shadow-cyan-950/60 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Highway Centerline Ribbon */}
            <div className={`h-1.5 w-full bg-gradient-to-r ${modalData.ribbonGradient} relative`}>
              <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_8px,rgba(0,0,0,0.4)_8px,rgba(0,0,0,0.4)_16px)]" />
            </div>

            {/* Header */}
            <div className="px-5 py-4 border-b border-cyan-500/20 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl border ${modalData.accentBg} ${modalData.accentBorder} ${modalData.accentText} shadow-md`}>
                  <modalData.icon className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
                      {modalData.title}
                    </h3>
                    <Badge variant={modalData.statusVariant} size="sm" className="font-mono font-bold">
                      {modalData.statusBadge}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{modalData.subtitle}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCard(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors border border-transparent hover:border-slate-700 shrink-0 cursor-pointer"
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter context strip */}
            <div className="px-5 py-2.5 bg-[#090E1A] border-b border-cyan-500/15 flex items-center justify-between text-xs text-slate-300 flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-cyan-400 font-semibold">
                  {STRETCH_BOUNDARIES[linearStretch].label}
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-300">
                  Side: <span className="font-bold text-white">{side === 'Both' ? 'Both Sides' : side}</span>
                </span>
                <span className="text-slate-600">•</span>
                <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-mono font-bold ${
                  linearStretch !== 'All'
                    ? 'bg-cyan-950 border-cyan-400/60 text-cyan-300'
                    : 'bg-[#0F172A] border-slate-700 text-slate-300'
                }`}>
                  Stretch: {linearStretch === 'All' ? 'All Stretches' : linearStretch}
                </span>
                <span className="text-slate-600">•</span>
                <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-mono font-bold ${
                  selectedCard === 'bc'
                    ? 'bg-slate-800 border-slate-600 text-slate-300'
                    : linearLane !== 'All'
                    ? 'bg-cyan-950 border-cyan-400/60 text-cyan-300'
                    : 'bg-[#0F172A] border-slate-700 text-slate-300'
                }`}>
                  Lane: {selectedCard === 'bc' ? 'All Lanes (BC Excluded)' : linearLane}
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-slate-400 text-[11px]">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                <span>As-of: <strong className="text-cyan-300">{selectedDisplayDate}</strong></span>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {/* Visual Section: Column Chart Visual */}
              <div className="bg-[#070B14] border border-cyan-500/25 rounded-xl p-4 shadow-inner">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                      Scope vs Achievement vs Balance (Column Visual)
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">Unit: {modalData.unit}</span>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2">
                  {/* Left Column Legend & Breakdown */}
                  <div className="grid grid-cols-3 gap-2 w-full sm:w-auto sm:flex-1">
                    <div className="p-2.5 rounded-lg bg-[#0F172A] border border-slate-700/60 text-center">
                      <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 font-medium">
                        <span className="w-2 h-2 rounded-xs bg-[#64748B]" />
                        <span>Plan Target</span>
                      </div>
                      <div className="mt-1 font-mono font-bold text-sm text-white">
                        {fmt(modalData.planned)}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {modalData.targetKm.toFixed(2)} km
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#0F172A] border border-cyan-500/30 text-center">
                      <div className="flex items-center justify-center gap-1 text-[10px] text-cyan-300 font-medium">
                        <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: modalData.accentColor }} />
                        <span>Achieved</span>
                      </div>
                      <div className="mt-1 font-mono font-bold text-sm text-white">
                        {fmt(modalData.actual)}
                      </div>
                      <div className="text-[10px] font-mono text-cyan-300">
                        {modalData.cumulativeKm.toFixed(2)} km
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#0F172A] border border-amber-500/30 text-center">
                      <div className="flex items-center justify-center gap-1 text-[10px] text-amber-400 font-medium">
                        <span className="w-2 h-2 rounded-xs bg-[#F97316]" />
                        <span>Balance</span>
                      </div>
                      <div className="mt-1 font-mono font-bold text-sm text-white">
                        {fmt(modalData.balance)}
                      </div>
                      <div className="text-[10px] font-mono text-amber-300">
                        {modalData.balanceKm.toFixed(2)} km
                      </div>
                    </div>
                  </div>

                  {/* Right: The Actual MiniTripleBarChart visual */}
                  <div className="p-3 rounded-lg bg-[#0A0F1D] border border-cyan-500/20 shrink-0 flex flex-col items-center justify-center">
                    <MiniTripleBarChart
                      planned={modalData.planned}
                      actual={modalData.actual}
                      balance={modalData.balance}
                      unit={modalData.unit}
                      actualColor={modalData.accentColor}
                    />
                  </div>
                </div>

                {/* Progress bar inside visual card */}
                <div className="mt-3 pt-3 border-t border-slate-800">
                  <div className="flex items-center justify-between text-xs mb-1.5 font-mono">
                    <span className="text-slate-400">Completion Ratio:</span>
                    <span className="font-bold text-cyan-300">{modalData.progressPercent.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-[#0B101D] border border-cyan-500/20 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 shadow-sm"
                      style={{
                        width: `${Math.min(100, modalData.progressPercent)}%`,
                        backgroundColor: modalData.accentColor
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Detailed Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. Planned Target Scope */}
                <div className="p-3.5 rounded-xl bg-[#090E1A] border border-slate-800 hover:border-cyan-500/30 transition-colors">
                  <div className="text-xs text-slate-400 font-medium">Total Contractual Scope</div>
                  <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-xl font-bold font-mono text-white">{modalData.targetKm.toFixed(2)}</span>
                    <span className="text-xs text-cyan-400 font-bold font-mono">{modalData.unit}</span>
                    <span className="text-xs text-slate-400 font-mono">({fmt(modalData.planned)} m)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Total scope baseline for active stretch & side</p>
                </div>

                {/* 2. Cumulative Execution */}
                <div className="p-3.5 rounded-xl bg-[#090E1A] border border-slate-800 hover:border-cyan-500/30 transition-colors">
                  <div className="text-xs text-slate-400 font-medium">Cumulative Achieved</div>
                  <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-xl font-bold font-mono text-white">{modalData.cumulativeKm.toFixed(2)}</span>
                    <span className="text-xs text-cyan-400 font-bold font-mono">{modalData.unit}</span>
                    <span className="text-xs font-bold font-mono text-cyan-300">({fmt(modalData.actual)} m)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">{modalData.progressPercent.toFixed(1)}% of target finished</p>
                </div>

                {/* 3. Selected Day Progress */}
                <div className="p-3.5 rounded-xl bg-[#090E1A] border border-slate-800 hover:border-cyan-500/30 transition-colors">
                  <div className="text-xs text-slate-400 font-medium">Daily Output ({selectedDisplayDate})</div>
                  <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
                    {modalData.dailyM !== 0 ? (
                      <>
                        <span className="text-xl font-bold font-mono text-emerald-400">
                          {modalData.dailyKm > 0 ? `+${modalData.dailyKm.toFixed(3)}` : modalData.dailyKm.toFixed(3)}
                        </span>
                        <span className="text-xs text-emerald-400 font-bold font-mono">{modalData.unit}</span>
                        <span className="text-xs text-slate-400 font-mono">({fmt(modalData.dailyM)} m)</span>
                      </>
                    ) : (
                      <span className="text-base font-bold font-mono text-slate-500">0 {modalData.unit} (No work logged)</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Output recorded on selected report date</p>
                </div>

                {/* 4. Remaining Balance */}
                <div className="p-3.5 rounded-xl bg-[#090E1A] border border-slate-800 hover:border-cyan-500/30 transition-colors">
                  <div className="text-xs text-slate-400 font-medium">Remaining Linear Balance</div>
                  <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-xl font-bold font-mono text-amber-400">{modalData.balanceKm.toFixed(2)}</span>
                    <span className="text-xs text-amber-400 font-bold font-mono">{modalData.unit}</span>
                    <span className="text-xs text-slate-400 font-mono">({fmt(modalData.balance)} m)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Pending linear execution to milestone target</p>
                </div>

                {/* 5. Operational Status */}
                <div className="p-3.5 rounded-xl bg-[#090E1A] border border-slate-800 sm:col-span-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">{modalData.extraLabel}</span>
                    <span className="font-mono text-cyan-300 font-semibold">{modalData.statusText}</span>
                  </div>
                  <div className="mt-1.5 text-xs text-slate-300 font-mono">
                    {modalData.extraValue}
                  </div>
                </div>

                {/* 6. Contractual BOQ Link (if available) */}
                {modalData.boqMetric && (
                  <div className="p-3.5 rounded-xl bg-[#0A1224] border border-cyan-500/30 sm:col-span-2">
                    <div className="flex items-center justify-between text-xs text-cyan-300 font-semibold">
                      <span>Contractual BOQ Baseline Volume</span>
                      <span className="font-mono">{modalData.boqMetric.progressPercent.toFixed(1)}% BOQ Done</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="bg-[#070B14] p-2 rounded border border-slate-800">
                        <span className="text-slate-400 text-[10px] block">BOQ Scope:</span>
                        <span className="text-white font-bold">{fmt(modalData.boqMetric.targetQuantity)} {modalData.boqMetric.unit}</span>
                      </div>
                      <div className="bg-[#070B14] p-2 rounded border border-slate-800">
                        <span className="text-slate-400 text-[10px] block">BOQ Achieved:</span>
                        <span className="text-emerald-400 font-bold">{fmt(modalData.boqMetric.cumulativeAchieved)} {modalData.boqMetric.unit}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 7. Executed Chainage Records for Selected Activity & Lane */}
                {modalData.records && modalData.records.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-[#090E1A] border border-slate-800 sm:col-span-2">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                        <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
                        Executed Chainage Records ({modalData.records.length})
                      </span>
                      <span className="text-[11px] font-mono text-cyan-300">
                        {selectedCard === 'bc' ? `All Lanes (Excl. S/L) • ${modalData.stretchLabel}` : `${modalData.laneLabel} • ${modalData.stretchLabel}`}
                      </span>
                    </div>
                    <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1 font-mono text-[11px]">
                      {modalData.records.slice().reverse().map((r, idx) => {
                        const allocM = getRowLengthInStretchM(r, linearStretch);
                        const origM = r.lengthM || Math.abs(r.rawToChainage - r.rawFromChainage);
                        return (
                          <div
                            key={`${r.id || r.date}-${r.rawFromChainage}-${idx}`}
                            className="p-2 rounded-lg bg-[#070B14] border border-white/5 flex items-center justify-between gap-2 hover:border-cyan-500/30 transition-colors"
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-slate-400 text-[10px]">{r.date}</span>
                              <span className="text-white font-bold">
                                Ch. {(r.fromChainage).toFixed(3)} → {(r.toChainage).toFixed(3)}
                              </span>
                              <span className="px-1.5 py-0.2 rounded bg-white/5 text-[10px] text-slate-300">
                                {r.side} • {r.lane}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-cyan-300 font-bold">
                                +{fmt(allocM)} m
                              </span>
                              {allocM !== origM && (
                                <span className="text-[10px] text-slate-500 block">
                                  of {fmt(origM)} m
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 8. Exposed Milled Gap Lane-Wise Breakdown */}
                {selectedCard === 'gap' && (
                  <div className="p-3.5 rounded-xl bg-[#090E1A] border border-slate-800 sm:col-span-2">
                    <div className="text-xs font-semibold text-slate-300 mb-2">
                      Lane-Wise Gap Breakdown ({linearLane})
                    </div>
                    <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                      <div className="p-2.5 rounded bg-[#070B14] border border-amber-500/30">
                        <span className="text-slate-400 text-[10px] block">Milled Length ({linearLane}):</span>
                        <span className="text-amber-300 font-bold text-sm">{fmt(metrics.milling.cumulativeM)} m</span>
                        <span className="text-slate-400 text-[10px] block mt-0.5">Today: +{fmt(metrics.milling.dailyM)} m</span>
                      </div>
                      <div className="p-2.5 rounded bg-[#070B14] border border-emerald-500/30">
                        <span className="text-slate-400 text-[10px] block">DBM Paved ({linearLane}):</span>
                        <span className="text-emerald-300 font-bold text-sm">{fmt(metrics.dbm.cumulativeM)} m</span>
                        <span className="text-slate-400 text-[10px] block mt-0.5">Today: +{fmt(metrics.dbm.dailyM)} m</span>
                      </div>
                    </div>
                    <div className="mt-2 p-2 rounded bg-[#070B14] border border-rose-500/30 text-xs font-mono flex items-center justify-between">
                      <span className="text-slate-400">Net Uncovered Gap ({linearLane}):</span>
                      <span className="text-rose-400 font-bold">{fmt(metrics.exposedGapM)} m ({metrics.exposedGapKm.toFixed(2)} km)</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 bg-[#090E1A] border-t border-cyan-500/20 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-mono">Press Esc to close</span>
              <button
                type="button"
                onClick={() => setSelectedCard(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-600 transition-colors cursor-pointer shadow-sm"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LinearKPICards;
