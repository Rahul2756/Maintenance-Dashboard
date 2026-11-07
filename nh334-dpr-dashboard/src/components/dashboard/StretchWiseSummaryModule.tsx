import React, { useState, useMemo } from 'react';
import { ActualDPRRow, HighwaySide } from '../../types/dpr';
import {
  computeStretchWiseSummary,
  computeDailyGroupedExecution,
  StretchWiseTemplateRow,
  DEFAULT_STRETCH_WISE_TEMPLATE,
  formatChainagePlus,
  isoToDisplayDate,
  serialToIsoDate,
  dmyToIso
} from '../../utils/excelParser';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import {
  Layers,
  MapPin,
  TrendingUp,
  Download,
  Filter,
  CheckCircle2,
  Calendar,
  Compass,
  ArrowRight,
  Flame,
  Truck,
  Navigation,
  Clock,
  Table,
  BarChart3
} from 'lucide-react';

interface StretchWiseSummaryModuleProps {
  actualRows: ActualDPRRow[];
  templateRows?: StretchWiseTemplateRow[];
  selectedDate?: string;
  globalSide?: HighwaySide;
  className?: string;
  onDateChange?: (date: string) => void;
}

export const StretchWiseSummaryModule: React.FC<StretchWiseSummaryModuleProps> = ({
  actualRows,
  templateRows = DEFAULT_STRETCH_WISE_TEMPLATE,
  selectedDate,
  globalSide = 'Both',
  className = '',
  onDateChange
}) => {
  // View mode switcher: 'stretch' for Requirement 1, 'daily' for Requirement 2
  const [viewMode, setViewMode] = useState<'stretch' | 'daily'>('stretch');

  // Sorted list of unique dates from actualRows (defaulting to latest date)
  const availableDates = useMemo(() => {
    const set = new Set<string>();
    actualRows.forEach(r => {
      if (r.date) set.add(r.date);
    });
    return Array.from(set).sort((a, b) => {
      const [ad, am, ay] = a.split('.').map(Number);
      const [bd, bm, by] = b.split('.').map(Number);
      return new Date(ay, am - 1, ad).getTime() - new Date(by, bm - 1, bd).getTime();
    });
  }, [actualRows]);

  const latestDate = availableDates[availableDates.length - 1] || '23.10.2026';
  const [activeDate, setActiveDate] = useState<string>(selectedDate || latestDate);

  // Sync activeDate if selectedDate prop updates
  React.useEffect(() => {
    if (selectedDate) {
      setActiveDate(selectedDate);
    }
  }, [selectedDate]);

  // Local filter states that default or sync with global
  const [activityFilter, setActivityFilter] = useState<string>('ALL');
  const [sideFilter, setSideFilter] = useState<HighwaySide>(globalSide);
  const [laneFilter, setLaneFilter] = useState<string>('All');

  // Keep side filter synchronized if global side changes
  React.useEffect(() => {
    if (globalSide) {
      setSideFilter(globalSide);
    }
  }, [globalSide]);

  // Format decimal numbers with specified digits
  const fmtKm = (num: number, decimals: number = 3): string => {
    if (num === 0) return '0.000';
    return num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };

  const fmtInt = (num: number): string => {
    return Math.round(num).toLocaleString('en-US');
  };

  // 1. Requirement 1: Stretch-Wise Summary Data
  const summaryData = useMemo(() => {
    return computeStretchWiseSummary(actualRows, templateRows, {
      activityFilter,
      sideFilter,
      laneFilter,
      selectedDate: activeDate
    });
  }, [actualRows, templateRows, activityFilter, sideFilter, laneFilter, activeDate]);

  // 2. Requirement 2: Daily Completed Length Data
  const dailyData = useMemo(() => {
    return computeDailyGroupedExecution(actualRows, {
      selectedDate: activeDate,
      activityFilter,
      sideFilter,
      laneFilter
    });
  }, [actualRows, activeDate, activityFilter, sideFilter, laneFilter]);

  // Handle date change
  const handleDateSelect = (newDate: string) => {
    setActiveDate(newDate);
    if (onDateChange) onDateChange(newDate);
  };

  // CSV Export Handler
  const handleExportCSV = () => {
    if (viewMode === 'stretch') {
      const headers = [
        'Side',
        'Activity',
        'Lane',
        'Stretch 1 Planned (km)',
        'Stretch 1 Actual (km)',
        'Stretch 1 Remaining (km)',
        'Stretch 1 % Done',
        'Stretch 2 Planned (km)',
        'Stretch 2 Actual (km)',
        'Stretch 2 Remaining (km)',
        'Stretch 2 % Done',
        'Stretch 3 Planned (km)',
        'Stretch 3 Actual (km)',
        'Stretch 3 Remaining (km)',
        'Stretch 3 % Done',
        'Total Corridor Planned (km)',
        'Total Corridor Actual (km)',
        'Total Corridor Remaining (km)',
        'Total Corridor % Done'
      ];

      const dataLines = summaryData.rows.map(r => [
        r.side,
        `"${r.activity}"`,
        r.lane,
        r.stretch1.plannedKm.toFixed(3),
        r.stretch1.actualKm.toFixed(3),
        r.stretch1.remainingKm.toFixed(3),
        `${r.stretch1.percentDone.toFixed(1)}%`,
        r.stretch2.plannedKm.toFixed(3),
        r.stretch2.actualKm.toFixed(3),
        r.stretch2.remainingKm.toFixed(3),
        `${r.stretch2.percentDone.toFixed(1)}%`,
        r.stretch3.plannedKm.toFixed(3),
        r.stretch3.actualKm.toFixed(3),
        r.stretch3.remainingKm.toFixed(3),
        `${r.stretch3.percentDone.toFixed(1)}%`,
        r.total.plannedKm.toFixed(3),
        r.total.actualKm.toFixed(3),
        r.total.remainingKm.toFixed(3),
        `${r.total.percentDone.toFixed(1)}%`
      ].join(','));

      const t = summaryData.totals;
      const totalsLine = [
        'TOTAL',
        'Filtered Summary',
        laneFilter,
        t.stretch1.plannedKm.toFixed(3),
        t.stretch1.actualKm.toFixed(3),
        t.stretch1.remainingKm.toFixed(3),
        `${t.stretch1.percentDone.toFixed(1)}%`,
        t.stretch2.plannedKm.toFixed(3),
        t.stretch2.actualKm.toFixed(3),
        t.stretch2.remainingKm.toFixed(3),
        `${t.stretch2.percentDone.toFixed(1)}%`,
        t.stretch3.plannedKm.toFixed(3),
        t.stretch3.actualKm.toFixed(3),
        t.stretch3.remainingKm.toFixed(3),
        `${t.stretch3.percentDone.toFixed(1)}%`,
        t.total.plannedKm.toFixed(3),
        t.total.actualKm.toFixed(3),
        t.total.remainingKm.toFixed(3),
        `${t.total.percentDone.toFixed(1)}%`
      ].join(',');

      const csvContent = [headers.join(','), ...dataLines, totalsLine].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `NH334_Stretch_Wise_Summary_${activeDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const headers = [
        'Date',
        'Activity',
        'Side',
        'Lane',
        'Chainage Span',
        'Daily Executed Lane Length (m)',
        'Daily Executed Lane Length (km)',
        'Daily Unique Coverage (m)',
        'Daily Unique Coverage (km)',
        'Cumulative Executed Lane Length (m)',
        'Cumulative Executed Lane Length (km)',
        'Cumulative Unique Coverage (m)',
        'Cumulative Unique Coverage (km)',
        'Entries Count',
        'Multi-Lane Flag'
      ];

      const dataLines = dailyData.rows.map(r => [
        r.date,
        `"${r.activity}"`,
        r.side,
        r.lane,
        `"${r.chainageSpan}"`,
        r.dailyExecutedLaneLengthM,
        r.dailyExecutedLaneLengthKm.toFixed(3),
        r.dailyUniqueCoverageM,
        r.dailyUniqueCoverageKm.toFixed(3),
        r.cumulativeExecutedLaneLengthM,
        r.cumulativeExecutedLaneLengthKm.toFixed(3),
        r.cumulativeUniqueCoverageM,
        r.cumulativeUniqueCoverageKm.toFixed(3),
        r.recordCount,
        r.hasMultiLaneOrOverlap ? 'Yes' : 'No'
      ].join(','));

      const t = dailyData.totals;
      const totalsLine = [
        activeDate,
        'TOTAL FILTERED',
        sideFilter,
        laneFilter,
        'Corridor Span',
        t.dailyExecutedLaneLengthM,
        t.dailyExecutedLaneLengthKm.toFixed(3),
        t.dailyUniqueCoverageM,
        t.dailyUniqueCoverageKm.toFixed(3),
        t.cumulativeExecutedLaneLengthM,
        t.cumulativeExecutedLaneLengthKm.toFixed(3),
        t.cumulativeUniqueCoverageM,
        t.cumulativeUniqueCoverageKm.toFixed(3),
        t.recordCount,
        '-'
      ].join(',');

      const csvContent = [headers.join(','), ...dataLines, totalsLine].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `NH334_Daily_Completed_Length_${activeDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const activityOptions = [
    { id: 'ALL', label: 'All Activities' },
    { id: 'Milling', label: 'Milling' },
    { id: 'Tack Coat', label: 'Tack Coat' },
    { id: 'DBM', label: 'DBM' },
    { id: 'BC', label: 'BC' },
    { id: 'Road Marking', label: 'Road Marking' },
    { id: 'Earthen Shoulder', label: 'Earthen Shoulder' }
  ];

  const laneOptions = ['All', 'F/L', 'S/L', 'FW', 'SR'];

  return (
    <Card className={`border border-white/10 bg-[#0E1015] shadow-2xl overflow-hidden ${className}`}>
      {/* 1. Header Banner */}
      <CardHeader className="border-b border-white/10 bg-gradient-to-r from-[#12151D] via-[#10131A] to-[#0E1015] p-4 lg:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 shadow-md">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 font-bold uppercase tracking-wider">
                  {viewMode === 'stretch' ? 'Requirement 1 // Stretch Analytics' : 'Requirement 2 // Daily Progress'}
                </span>
                <span className="text-xs text-slate-400 font-mono">Ch. 130+560 to 206+220</span>
              </div>
              <CardTitle className="text-base lg:text-lg font-black text-white uppercase tracking-wide mt-1">
                {viewMode === 'stretch'
                  ? 'Stretch-wise Summary — Total Planned vs Actual (km)'
                  : 'Daily Completed Length & Activity Breakdown (Chainage Log)'}
              </CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">
                {viewMode === 'stretch'
                  ? 'Dynamic stretch allocation: Stretch 1 (36.69 km) + Stretch 2 (22.75 km) + Stretch 3 (16.22 km) = Total Corridor (75.66 km)'
                  : 'Daily executed lane length vs unique chainage coverage with cumulative progression'}
              </p>
            </div>
          </div>

          {/* Quick Metrics & Actions */}
          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Segmented Switch */}
            <div className="flex items-center bg-[#161922] p-1 rounded-xl border border-white/10">
              <button
                onClick={() => setViewMode('stretch')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'stretch'
                    ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>Stretch-Wise Summary</span>
              </button>
              <button
                onClick={() => setViewMode('daily')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'daily'
                    ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Daily Completed Length</span>
              </button>
            </div>

            {/* Date Selector Dropdown */}
            <div className="flex items-center gap-2 bg-[#161922] px-3 py-1.5 rounded-xl border border-white/10">
              <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="text-xs text-slate-400 whitespace-nowrap">As-Of Date:</span>
              <select
                value={activeDate}
                onChange={e => handleDateSelect(e.target.value)}
                className="bg-transparent border-none text-cyan-300 font-mono font-bold text-xs focus:outline-none cursor-pointer pr-1"
              >
                {[...availableDates].reverse().map(d => (
                  <option key={`opt-date-${d}`} value={d} className="bg-[#12151D] text-slate-200">
                    {d}{d === latestDate ? ' ★ LATEST' : ''}
                  </option>
                ))}
              </select>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportCSV}
              className="bg-[#161922] border-white/10 text-slate-300 hover:text-white hover:bg-white/5 text-xs font-medium cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 mr-1.5 text-cyan-400" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* 2. Interactive Filter Controls Bar */}
        <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Activity Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-400 font-medium mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-cyan-400" />
              Activity:
            </span>
            {activityOptions.map(opt => {
              const active = activityFilter === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setActivityFilter(opt.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    active
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm font-bold'
                      : 'bg-[#161922] text-slate-400 hover:text-slate-200 border border-white/5'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Side Filters */}
            <div className="flex items-center gap-1 bg-[#161922] p-1 rounded-xl border border-white/10">
              <span className="text-[11px] text-slate-400 px-1 font-medium">Side:</span>
              {(['Both', 'LHS', 'RHS'] as HighwaySide[]).map(side => {
                const active = sideFilter === side;
                return (
                  <button
                    key={side}
                    onClick={() => setSideFilter(side)}
                    className={`px-2.5 py-0.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      active
                        ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 shadow-sm font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {side === 'Both' ? 'Both' : side}
                  </button>
                );
              })}
            </div>

            {/* Lane Filters */}
            <div className="flex items-center gap-1 bg-[#161922] p-1 rounded-xl border border-white/10">
              <span className="text-[11px] text-slate-400 px-1 font-medium">Lane:</span>
              {laneOptions.map(l => {
                const active = laneFilter === l;
                return (
                  <button
                    key={l}
                    onClick={() => setLaneFilter(l)}
                    className={`px-2 py-0.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      active
                        ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 shadow-sm font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {l}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </CardHeader>

      {/* 3. Main Body: Switch between View 1 (Stretch) and View 2 (Daily) */}
      <CardContent className="p-0">
        {viewMode === 'stretch' ? (
          /* ============================================================== */
          /* VIEW 1: MASTER STRETCH DATA TABLE (REQUIREMENT 1)              */
          /* ============================================================== */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 border-collapse">
              {/* Table Level 1 Header (Sections) */}
              <thead>
                <tr className="bg-[#141720] border-b border-white/10 text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  <th colSpan={3} className="py-2.5 px-3 border-r border-white/10 bg-[#141720]">
                    <div className="flex items-center gap-1.5 text-cyan-300">
                      <Layers className="w-3.5 h-3.5" />
                      <span>Scope Definition</span>
                    </div>
                  </th>
                  <th colSpan={4} className="py-2.5 px-3 border-r border-white/10 bg-[#161a24] text-center">
                    <div className="flex items-center justify-center gap-1.5 text-sky-300">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Stretch 1: Ch. 130+560 to 167+250 (36.69 km)</span>
                    </div>
                  </th>
                  <th colSpan={4} className="py-2.5 px-3 border-r border-white/10 bg-[#141720] text-center">
                    <div className="flex items-center justify-center gap-1.5 text-amber-300">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Stretch 2: Ch. 167+250 to 190+000 (22.75 km)</span>
                    </div>
                  </th>
                  <th colSpan={4} className="py-2.5 px-3 border-r border-white/10 bg-[#161a24] text-center">
                    <div className="flex items-center justify-center gap-1.5 text-emerald-300">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Stretch 3: Ch. 190+000 to 206+220 (16.22 km)</span>
                    </div>
                  </th>
                  <th colSpan={4} className="py-2.5 px-3 bg-[#1d2230] text-center">
                    <div className="flex items-center justify-center gap-1.5 text-cyan-300 font-extrabold">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>Total Corridor: Ch. 130+560 to 206+220 (75.66 km)</span>
                    </div>
                  </th>
                </tr>

                {/* Table Level 2 Header (Columns) */}
                <tr className="bg-[#0D1017] border-b border-white/10 text-[10px] font-mono text-slate-400">
                  <th className="py-2 px-3 border-r border-white/5">Side</th>
                  <th className="py-2 px-3 border-r border-white/5">Activity</th>
                  <th className="py-2 px-3 border-r border-white/10">Lane</th>

                  {/* Stretch 1 */}
                  <th className="py-2 px-2 text-right border-r border-white/5">Plan (km)</th>
                  <th className="py-2 px-2 text-right border-r border-white/5">Act (km)</th>
                  <th className="py-2 px-2 text-right border-r border-white/5">Rem (km)</th>
                  <th className="py-2 px-2 text-right border-r border-white/10">% Done</th>

                  {/* Stretch 2 */}
                  <th className="py-2 px-2 text-right border-r border-white/5">Plan (km)</th>
                  <th className="py-2 px-2 text-right border-r border-white/5">Act (km)</th>
                  <th className="py-2 px-2 text-right border-r border-white/5">Rem (km)</th>
                  <th className="py-2 px-2 text-right border-r border-white/10">% Done</th>

                  {/* Stretch 3 */}
                  <th className="py-2 px-2 text-right border-r border-white/5">Plan (km)</th>
                  <th className="py-2 px-2 text-right border-r border-white/5">Act (km)</th>
                  <th className="py-2 px-2 text-right border-r border-white/5">Rem (km)</th>
                  <th className="py-2 px-2 text-right border-r border-white/10">% Done</th>

                  {/* Total Corridor */}
                  <th className="py-2 px-2 text-right border-r border-white/5 text-cyan-300 font-bold">Total Plan</th>
                  <th className="py-2 px-2 text-right border-r border-white/5 text-emerald-300 font-bold">Total Act</th>
                  <th className="py-2 px-2 text-right border-r border-white/5 text-amber-300 font-bold">Total Rem</th>
                  <th className="py-2 px-2 text-right text-cyan-300 font-bold">% Done</th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-white/5 font-mono text-xs">
                {summaryData.rows.length === 0 ? (
                  <tr>
                    <td colSpan={19} className="py-8 text-center text-slate-500 font-sans">
                      No records match the current filter selection ({activityFilter}, {sideFilter}, {laneFilter}).
                    </td>
                  </tr>
                ) : (
                  summaryData.rows.map((row, idx) => {
                    const isTotalDone = row.total.percentDone >= 100;
                    const hasProgress = row.total.actualKm > 0;
                    return (
                      <tr
                        key={`stretch-row-${row.rowNum}-${idx}`}
                        className={`hover:bg-white/[0.03] transition-colors ${
                          idx % 2 === 0 ? 'bg-[#0E1015]' : 'bg-[#101319]'
                        }`}
                      >
                        {/* Scope */}
                        <td className="py-2 px-3 font-semibold text-slate-300 border-r border-white/5 whitespace-nowrap">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                            row.side === 'LHS' ? 'bg-sky-950 text-sky-300 border border-sky-500/30' :
                            row.side === 'RHS' ? 'bg-amber-950 text-amber-300 border border-amber-500/30' :
                            'bg-teal-950 text-teal-300 border border-teal-500/30'
                          }`}>
                            {row.side}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-white font-medium border-r border-white/5 whitespace-nowrap">
                          {row.activity}
                        </td>
                        <td className="py-2 px-3 text-slate-400 border-r border-white/10 whitespace-nowrap">
                          {row.lane}
                        </td>

                        {/* Stretch 1 */}
                        <td className="py-2 px-2 text-right border-r border-white/5 text-slate-400">
                          {fmtKm(row.stretch1.plannedKm)}
                        </td>
                        <td className="py-2 px-2 text-right border-r border-white/5 text-slate-200 font-semibold">
                          {fmtKm(row.stretch1.actualKm)}
                        </td>
                        <td className="py-2 px-2 text-right border-r border-white/5 text-slate-400">
                          {fmtKm(row.stretch1.remainingKm)}
                        </td>
                        <td className={`py-2 px-2 text-right border-r border-white/10 font-bold ${
                          row.stretch1.percentDone > 0 ? 'text-cyan-300' : 'text-slate-500'
                        }`}>
                          {row.stretch1.percentDone.toFixed(1)}%
                        </td>

                        {/* Stretch 2 */}
                        <td className="py-2 px-2 text-right border-r border-white/5 text-slate-400">
                          {fmtKm(row.stretch2.plannedKm)}
                        </td>
                        <td className="py-2 px-2 text-right border-r border-white/5 text-slate-200 font-semibold">
                          {fmtKm(row.stretch2.actualKm)}
                        </td>
                        <td className="py-2 px-2 text-right border-r border-white/5 text-slate-400">
                          {fmtKm(row.stretch2.remainingKm)}
                        </td>
                        <td className={`py-2 px-2 text-right border-r border-white/10 font-bold ${
                          row.stretch2.percentDone > 0 ? 'text-amber-300' : 'text-slate-500'
                        }`}>
                          {row.stretch2.percentDone.toFixed(1)}%
                        </td>

                        {/* Stretch 3 */}
                        <td className="py-2 px-2 text-right border-r border-white/5 text-slate-400">
                          {fmtKm(row.stretch3.plannedKm)}
                        </td>
                        <td className="py-2 px-2 text-right border-r border-white/5 text-slate-200 font-semibold">
                          {fmtKm(row.stretch3.actualKm)}
                        </td>
                        <td className="py-2 px-2 text-right border-r border-white/5 text-slate-400">
                          {fmtKm(row.stretch3.remainingKm)}
                        </td>
                        <td className={`py-2 px-2 text-right border-r border-white/10 font-bold ${
                          row.stretch3.percentDone > 0 ? 'text-emerald-300' : 'text-slate-500'
                        }`}>
                          {row.stretch3.percentDone.toFixed(1)}%
                        </td>

                        {/* Total Corridor */}
                        <td className="py-2 px-2 text-right border-r border-white/5 text-cyan-300 font-bold bg-cyan-950/10">
                          {fmtKm(row.total.plannedKm)}
                        </td>
                        <td className="py-2 px-2 text-right border-r border-white/5 text-emerald-300 font-bold bg-emerald-950/10">
                          {fmtKm(row.total.actualKm)}
                        </td>
                        <td className="py-2 px-2 text-right border-r border-white/5 text-amber-300 font-semibold bg-amber-950/10">
                          {fmtKm(row.total.remainingKm)}
                        </td>
                        <td className={`py-2 px-2 text-right font-black ${
                          isTotalDone ? 'text-emerald-400' : hasProgress ? 'text-cyan-300' : 'text-slate-500'
                        } bg-white/[0.02]`}>
                          {row.total.percentDone.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* Totals Footer Row */}
              <tfoot>
                <tr className="bg-[#141822] border-t-2 border-cyan-500/40 font-mono text-xs font-bold text-white">
                  <td colSpan={3} className="py-3 px-3 border-r border-white/10 uppercase tracking-wider text-cyan-300">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                      <span>Total Filtered Summary ({summaryData.rows.length} rows)</span>
                    </div>
                  </td>

                  {/* S1 Totals */}
                  <td className="py-3 px-2 text-right border-r border-white/5 text-slate-300">
                    {fmtKm(summaryData.totals.stretch1.plannedKm)}
                  </td>
                  <td className="py-3 px-2 text-right border-r border-white/5 text-sky-300">
                    {fmtKm(summaryData.totals.stretch1.actualKm)}
                  </td>
                  <td className="py-3 px-2 text-right border-r border-white/5 text-slate-400">
                    {fmtKm(summaryData.totals.stretch1.remainingKm)}
                  </td>
                  <td className="py-3 px-2 text-right border-r border-white/10 text-sky-300">
                    {summaryData.totals.stretch1.percentDone.toFixed(1)}%
                  </td>

                  {/* S2 Totals */}
                  <td className="py-3 px-2 text-right border-r border-white/5 text-slate-300">
                    {fmtKm(summaryData.totals.stretch2.plannedKm)}
                  </td>
                  <td className="py-3 px-2 text-right border-r border-white/5 text-amber-300">
                    {fmtKm(summaryData.totals.stretch2.actualKm)}
                  </td>
                  <td className="py-3 px-2 text-right border-r border-white/5 text-slate-400">
                    {fmtKm(summaryData.totals.stretch2.remainingKm)}
                  </td>
                  <td className="py-3 px-2 text-right border-r border-white/10 text-amber-300">
                    {summaryData.totals.stretch2.percentDone.toFixed(1)}%
                  </td>

                  {/* S3 Totals */}
                  <td className="py-3 px-2 text-right border-r border-white/5 text-slate-300">
                    {fmtKm(summaryData.totals.stretch3.plannedKm)}
                  </td>
                  <td className="py-3 px-2 text-right border-r border-white/5 text-emerald-300">
                    {fmtKm(summaryData.totals.stretch3.actualKm)}
                  </td>
                  <td className="py-3 px-2 text-right border-r border-white/5 text-slate-400">
                    {fmtKm(summaryData.totals.stretch3.remainingKm)}
                  </td>
                  <td className="py-3 px-2 text-right border-r border-white/10 text-emerald-300">
                    {summaryData.totals.stretch3.percentDone.toFixed(1)}%
                  </td>

                  {/* Total Corridor Totals */}
                  <td className="py-3 px-2 text-right border-r border-white/5 text-cyan-300 text-sm font-extrabold bg-cyan-950/20">
                    {fmtKm(summaryData.totals.total.plannedKm)}
                  </td>
                  <td className="py-3 px-2 text-right border-r border-white/5 text-emerald-300 text-sm font-extrabold bg-emerald-950/20">
                    {fmtKm(summaryData.totals.total.actualKm)}
                  </td>
                  <td className="py-3 px-2 text-right border-r border-white/5 text-amber-300 font-bold bg-amber-950/20">
                    {fmtKm(summaryData.totals.total.remainingKm)}
                  </td>
                  <td className="py-3 px-2 text-right text-cyan-300 text-sm font-black bg-cyan-950/30">
                    {summaryData.totals.total.percentDone.toFixed(1)}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          /* ============================================================== */
          /* VIEW 2: DAILY COMPLETED LENGTH & ACTIVITY BREAKDOWN (REQ 2)   */
          /* ============================================================== */
          <div className="p-4 lg:p-6 space-y-5">
            {/* 4 Daily Activity Summary Cards for the Selected Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Milling */}
              <div className="p-4 rounded-xl bg-gradient-to-b from-[#161B26] to-[#0E121A] border border-amber-500/30 shadow-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      <Layers className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-bold text-white uppercase tracking-wider">Milling</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/30 font-bold">
                    {activeDate}
                  </span>
                </div>
                <div className="pt-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black font-mono text-white">
                      {fmtInt(dailyData.activitySummaries.milling.dailyLaneM)}
                    </span>
                    <span className="text-xs text-amber-400 font-bold font-mono">m</span>
                    <span className="text-xs text-amber-300 font-mono font-medium">
                      ({dailyData.activitySummaries.milling.dailyLaneKm.toFixed(2)} km lane)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono mt-1 pt-1 border-t border-white/5">
                    <span>Unique Coverage:</span>
                    <span className="text-white font-bold">
                      {fmtInt(dailyData.activitySummaries.milling.dailyUniqueM)} m ({dailyData.activitySummaries.milling.dailyUniqueKm.toFixed(2)} km)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono mt-1">
                    <span>Cumulative Lane:</span>
                    <span className="text-amber-200 font-bold">
                      {fmtInt(dailyData.activitySummaries.milling.cumLaneM)} m ({dailyData.activitySummaries.milling.cumLaneKm.toFixed(2)} km)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono mt-0.5">
                    <span>Cumulative Unique:</span>
                    <span className="text-cyan-300 font-bold">
                      {fmtInt(dailyData.activitySummaries.milling.cumUniqueM)} m ({dailyData.activitySummaries.milling.cumUniqueKm.toFixed(2)} km)
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 2: Tack Coat */}
              <div className="p-4 rounded-xl bg-gradient-to-b from-[#161B26] to-[#0E121A] border border-cyan-500/30 shadow-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      <Flame className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-bold text-white uppercase tracking-wider">Tack Coat</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30 font-bold">
                    {activeDate}
                  </span>
                </div>
                <div className="pt-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black font-mono text-white">
                      {fmtInt(dailyData.activitySummaries.tackCoat.dailyLaneM)}
                    </span>
                    <span className="text-xs text-cyan-400 font-bold font-mono">m</span>
                    <span className="text-xs text-cyan-300 font-mono font-medium">
                      ({dailyData.activitySummaries.tackCoat.dailyLaneKm.toFixed(2)} km lane)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono mt-1 pt-1 border-t border-white/5">
                    <span>Unique Coverage:</span>
                    <span className="text-white font-bold">
                      {fmtInt(dailyData.activitySummaries.tackCoat.dailyUniqueM)} m ({dailyData.activitySummaries.tackCoat.dailyUniqueKm.toFixed(2)} km)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono mt-1">
                    <span>Cumulative Lane:</span>
                    <span className="text-cyan-200 font-bold">
                      {fmtInt(dailyData.activitySummaries.tackCoat.cumLaneM)} m ({dailyData.activitySummaries.tackCoat.cumLaneKm.toFixed(2)} km)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono mt-0.5">
                    <span>Cumulative Unique:</span>
                    <span className="text-cyan-300 font-bold">
                      {fmtInt(dailyData.activitySummaries.tackCoat.cumUniqueM)} m ({dailyData.activitySummaries.tackCoat.cumUniqueKm.toFixed(2)} km)
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 3: DBM */}
              <div className="p-4 rounded-xl bg-gradient-to-b from-[#161B26] to-[#0E121A] border border-emerald-500/30 shadow-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <Truck className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-bold text-white uppercase tracking-wider">DBM Laid</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30 font-bold">
                    {activeDate}
                  </span>
                </div>
                <div className="pt-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black font-mono text-white">
                      {fmtInt(dailyData.activitySummaries.dbm.dailyLaneM)}
                    </span>
                    <span className="text-xs text-emerald-400 font-bold font-mono">m</span>
                    <span className="text-xs text-emerald-300 font-mono font-medium">
                      ({dailyData.activitySummaries.dbm.dailyLaneKm.toFixed(2)} km lane)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono mt-1 pt-1 border-t border-white/5">
                    <span>Unique Coverage:</span>
                    <span className="text-white font-bold">
                      {fmtInt(dailyData.activitySummaries.dbm.dailyUniqueM)} m ({dailyData.activitySummaries.dbm.dailyUniqueKm.toFixed(2)} km)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono mt-1">
                    <span>Cumulative Lane:</span>
                    <span className="text-emerald-200 font-bold">
                      {fmtInt(dailyData.activitySummaries.dbm.cumLaneM)} m ({dailyData.activitySummaries.dbm.cumLaneKm.toFixed(2)} km)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono mt-0.5">
                    <span>Cumulative Unique:</span>
                    <span className="text-emerald-300 font-bold">
                      {fmtInt(dailyData.activitySummaries.dbm.cumUniqueM)} m ({dailyData.activitySummaries.dbm.cumUniqueKm.toFixed(2)} km)
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 4: BC */}
              <div className="p-4 rounded-xl bg-gradient-to-b from-[#161B26] to-[#0E121A] border border-teal-500/30 shadow-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/30">
                      <Navigation className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-bold text-white uppercase tracking-wider">BC Layer</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-500/30 font-bold">
                    {activeDate}
                  </span>
                </div>
                <div className="pt-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black font-mono text-white">
                      {fmtInt(dailyData.activitySummaries.bc.dailyLaneM)}
                    </span>
                    <span className="text-xs text-teal-400 font-bold font-mono">m</span>
                    <span className="text-xs text-teal-300 font-mono font-medium">
                      ({dailyData.activitySummaries.bc.dailyLaneKm.toFixed(2)} km lane)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono mt-1 pt-1 border-t border-white/5">
                    <span>Unique Coverage:</span>
                    <span className="text-white font-bold">
                      {fmtInt(dailyData.activitySummaries.bc.dailyUniqueM)} m ({dailyData.activitySummaries.bc.dailyUniqueKm.toFixed(2)} km)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono mt-1">
                    <span>Cumulative Lane:</span>
                    <span className="text-teal-200 font-bold">
                      {fmtInt(dailyData.activitySummaries.bc.cumLaneM)} m ({dailyData.activitySummaries.bc.cumLaneKm.toFixed(2)} km)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono mt-0.5">
                    <span>Cumulative Unique:</span>
                    <span className="text-teal-300 font-bold">
                      {fmtInt(dailyData.activitySummaries.bc.cumUniqueM)} m ({dailyData.activitySummaries.bc.cumUniqueKm.toFixed(2)} km)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Grouped Daily Chainage Table */}
            <div className="rounded-xl border border-white/10 overflow-hidden bg-[#0A0D14]">
              <div className="px-4 py-3 bg-[#121620] border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Chainage Log Records for {activeDate} ({dailyData.rows.length} grouped execution spans)
                  </span>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  Daily Lane Length: <strong className="text-cyan-300">{fmtInt(dailyData.totals.dailyExecutedLaneLengthM)} m ({dailyData.totals.dailyExecutedLaneLengthKm.toFixed(2)} km)</strong> • 
                  Unique Coverage: <strong className="text-emerald-300">{fmtInt(dailyData.totals.dailyUniqueCoverageM)} m ({dailyData.totals.dailyUniqueCoverageKm.toFixed(2)} km)</strong>
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300 border-collapse">
                  <thead>
                    <tr className="bg-[#10141D] border-b border-white/10 text-[10px] font-mono uppercase text-slate-400">
                      <th className="py-2.5 px-3 border-r border-white/5">Date</th>
                      <th className="py-2.5 px-3 border-r border-white/5">Activity</th>
                      <th className="py-2.5 px-3 border-r border-white/5">Side</th>
                      <th className="py-2.5 px-3 border-r border-white/5">Lane</th>
                      <th className="py-2.5 px-3 border-r border-white/10">Chainage Interval Span</th>
                      <th className="py-2.5 px-3 text-right border-r border-white/5 text-amber-300 font-bold">Daily Lane (m / km)</th>
                      <th className="py-2.5 px-3 text-right border-r border-white/10 text-cyan-300 font-bold">Daily Unique (m / km)</th>
                      <th className="py-2.5 px-3 text-right border-r border-white/5 text-slate-200">Cum Lane (m / km)</th>
                      <th className="py-2.5 px-3 text-right border-r border-white/10 text-slate-200">Cum Unique (m / km)</th>
                      <th className="py-2.5 px-3 text-center">Execution Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-xs">
                    {dailyData.rows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-500 font-sans">
                          No work recorded on {activeDate} matching current filters ({activityFilter}, {sideFilter}, {laneFilter}).
                        </td>
                      </tr>
                    ) : (
                      dailyData.rows.map((row, idx) => (
                        <tr
                          key={`daily-row-${idx}`}
                          className={`hover:bg-white/[0.03] transition-colors ${
                            idx % 2 === 0 ? 'bg-[#0B0E15]' : 'bg-[#0E121B]'
                          }`}
                        >
                          <td className="py-2.5 px-3 border-r border-white/5 text-slate-300 whitespace-nowrap">
                            {row.date}
                          </td>
                          <td className="py-2.5 px-3 border-r border-white/5 text-white font-semibold whitespace-nowrap">
                            {row.activity}
                          </td>
                          <td className="py-2.5 px-3 border-r border-white/5 whitespace-nowrap">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                              row.side === 'LHS' ? 'bg-sky-950 text-sky-300 border border-sky-500/30' :
                              row.side === 'RHS' ? 'bg-amber-950 text-amber-300 border border-amber-500/30' :
                              'bg-teal-950 text-teal-300 border border-teal-500/30'
                            }`}>
                              {row.side}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 border-r border-white/5 text-slate-300 whitespace-nowrap">
                            {row.lane}
                          </td>
                          <td className="py-2.5 px-3 border-r border-white/10 text-cyan-300 font-bold whitespace-nowrap">
                            {row.chainageSpan}
                          </td>
                          <td className="py-2.5 px-3 text-right border-r border-white/5 text-amber-300 font-bold whitespace-nowrap">
                            {fmtInt(row.dailyExecutedLaneLengthM)} m ({row.dailyExecutedLaneLengthKm.toFixed(3)} km)
                          </td>
                          <td className="py-2.5 px-3 text-right border-r border-white/10 text-cyan-300 font-bold whitespace-nowrap">
                            {fmtInt(row.dailyUniqueCoverageM)} m ({row.dailyUniqueCoverageKm.toFixed(3)} km)
                          </td>
                          <td className="py-2.5 px-3 text-right border-r border-white/5 text-slate-300 whitespace-nowrap">
                            {fmtInt(row.cumulativeExecutedLaneLengthM)} m ({row.cumulativeExecutedLaneLengthKm.toFixed(3)} km)
                          </td>
                          <td className="py-2.5 px-3 text-right border-r border-white/10 text-slate-300 whitespace-nowrap">
                            {fmtInt(row.cumulativeUniqueCoverageM)} m ({row.cumulativeUniqueCoverageKm.toFixed(3)} km)
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            {row.hasMultiLaneOrOverlap ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                {row.recordCount} entries • Multi-Lane / Pass
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                {row.recordCount} entry • 1D Span
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#121622] border-t-2 border-cyan-500/40 font-mono text-xs font-bold text-white">
                      <td colSpan={5} className="py-3 px-3 border-r border-white/10 uppercase tracking-wider text-cyan-300">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                          <span>Total Daily Output ({dailyData.totals.recordCount} total entries)</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right border-r border-white/5 text-amber-300 text-sm font-black">
                        {fmtInt(dailyData.totals.dailyExecutedLaneLengthM)} m ({dailyData.totals.dailyExecutedLaneLengthKm.toFixed(3)} km)
                      </td>
                      <td className="py-3 px-3 text-right border-r border-white/10 text-cyan-300 text-sm font-black">
                        {fmtInt(dailyData.totals.dailyUniqueCoverageM)} m ({dailyData.totals.dailyUniqueCoverageKm.toFixed(3)} km)
                      </td>
                      <td className="py-3 px-3 text-right border-r border-white/5 text-slate-200">
                        {fmtInt(dailyData.totals.cumulativeExecutedLaneLengthM)} m ({dailyData.totals.cumulativeExecutedLaneLengthKm.toFixed(3)} km)
                      </td>
                      <td className="py-3 px-3 text-right border-r border-white/10 text-slate-200">
                        {fmtInt(dailyData.totals.cumulativeUniqueCoverageM)} m ({dailyData.totals.cumulativeUniqueCoverageKm.toFixed(3)} km)
                      </td>
                      <td className="py-3 px-3 text-center text-slate-400 font-sans text-xs">
                        {dailyData.rows.length} groups
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StretchWiseSummaryModule;
