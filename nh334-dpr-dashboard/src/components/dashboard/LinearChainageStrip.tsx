import React, { useState, useMemo } from 'react';
import { ActualDPRRow, ActivityType, ProjectBaseline, PlannedRecord } from '../../types/dpr';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { GitCommit, Layers, Flame, Truck, MapPin, CheckCircle2, Clock, AlertCircle, Calendar } from 'lucide-react';
import { formatChainagePlus } from '../../utils/excelParser';
import { SpatialMapModule } from '../modules/SpatialMapModule';
import { StripChartDataset } from '../../types/stripChart';

export type StripCompletionStatus = 'completed' | 'in_progress' | 'delayed' | 'future_planned';

export interface CorridorStripSegment {
  id: string;
  fromChainage: number;
  toChainage: number;
  lengthM: number;
  status: StripCompletionStatus;
  activity: ActivityType;
  date?: string;
  lane?: string;
  widthM?: number;
  achievedQty?: number;
  unit?: string;
  remarks?: string;
  isActualRow: boolean;
  actualRow?: ActualDPRRow;
}

interface LinearChainageStripProps {
  rows: ActualDPRRow[];
  minChainage?: number;
  maxChainage?: number;
  baseline?: ProjectBaseline;
  selectedActivities?: ActivityType[];
  onSelectRow?: (row: ActualDPRRow) => void;
  plannedRecords?: PlannedRecord[];
  reportDate?: string;
  onSelectChainage?: (chainageM: number) => void;
  targetChainageM?: number | null;
  onStripDatasetLoaded?: (dataset: StripChartDataset) => void;
}

export const LinearChainageStrip: React.FC<LinearChainageStripProps> = ({
  rows,
  minChainage = 169.000,
  maxChainage = 206.220,
  baseline,
  selectedActivities,
  onSelectRow,
  reportDate = '23.10.2026',
  onSelectChainage,
  targetChainageM,
  onStripDatasetLoaded
}) => {
  const [stripView, setStripView] = useState<'grid' | 'strip'>('grid');
  const [hoveredSegment, setHoveredSegment] = useState<CorridorStripSegment | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [colorMode, setColorMode] = useState<'status' | 'activity'>('status');
  const [statusFilter, setStatusFilter] = useState<'all' | StripCompletionStatus>('all');

  // Base track strictly to fixed baseline bounds (169.000 to 206.220 km)
  const effectiveMin = baseline?.minChainage ?? minChainage;
  const effectiveMax = baseline?.maxChainage ?? maxChainage;
  const totalLengthKm = effectiveMax - effectiveMin || 1;

  const isMillingSelected = !selectedActivities || selectedActivities.includes('Milling');
  const isTackSelected = !selectedActivities || selectedActivities.includes('Tackcoat');
  const isDbmSelected = !selectedActivities || selectedActivities.includes('DBM');

  // Generate ruler ticks (5 km steps for long corridor with start & end)
  const stepKm = totalLengthKm > 30 ? 5 : totalLengthKm > 15 ? 2 : 1;
  const ticks: number[] = [];
  const startKm = Math.ceil(effectiveMin / stepKm) * stepKm;
  for (let k = startKm; k <= effectiveMax; k += stepKm) {
    ticks.push(k);
  }

  // Derive the latest active work front chainage across the project
  const maxActiveChainage = useMemo(() => {
    let maxCh = effectiveMin;
    rows.forEach(r => {
      const top = Math.max(r.fromChainage, r.toChainage);
      if (top > maxCh) maxCh = top;
    });
    return maxCh > effectiveMin ? maxCh : 203.775;
  }, [rows, effectiveMin]);

  // Build continuous corridor segments per activity (Actuals + Gaps mapped to completion states)
  const buildActivitySegments = (activity: ActivityType): CorridorStripSegment[] => {
    const activityRows = rows.filter(r => r.activity === activity);
    const segments: CorridorStripSegment[] = [];

    // 1. Process Actual Executed Stretches
    activityRows.forEach(r => {
      const from = Math.min(r.fromChainage, r.toChainage);
      const to = Math.max(r.fromChainage, r.toChainage);
      // If work was executed on current reportDate, it is actively in progress
      const isToday = r.date === reportDate;

      segments.push({
        id: `act-${r.id}`,
        fromChainage: from,
        toChainage: to,
        lengthM: r.lengthM || Math.round((to - from) * 1000),
        status: isToday ? 'in_progress' : 'completed',
        activity,
        date: r.date,
        lane: r.lane,
        widthM: r.widthM,
        achievedQty: r.achievedToday,
        unit: r.unit,
        remarks: r.remarks,
        isActualRow: true,
        actualRow: r
      });
    });

    // 2. Compute Non-executed Gaps & Baseline Track Gaps
    const sortedActuals = [...activityRows]
      .map(r => ({
        from: Math.min(r.fromChainage, r.toChainage),
        to: Math.max(r.fromChainage, r.toChainage)
      }))
      .sort((a, b) => a.from - b.from);

    const mergedActuals: { from: number; to: number }[] = [];
    sortedActuals.forEach(curr => {
      if (mergedActuals.length === 0) {
        mergedActuals.push({ ...curr });
      } else {
        const last = mergedActuals[mergedActuals.length - 1];
        if (curr.from <= last.to + 0.02) {
          last.to = Math.max(last.to, curr.to);
        } else {
          mergedActuals.push({ ...curr });
        }
      }
    });

    const addGap = (from: number, to: number, keyTag: string | number) => {
      if (to - from < 0.01) return;

      // Delayed: stretches scheduled prior to or up to active work front that were not completed
      if (to <= maxActiveChainage + 0.05) {
        segments.push({
          id: `gap-del-${activity}-${keyTag}-${from.toFixed(3)}`,
          fromChainage: from,
          toChainage: to,
          lengthM: Math.round((to - from) * 1000),
          status: 'delayed',
          activity,
          remarks: 'Planned schedule target overdue; site execution pending mobilization',
          isActualRow: false
        });
      } else if (from >= maxActiveChainage - 0.05) {
        // Future Planned: stretches ahead of the active work front towards milestone finish
        segments.push({
          id: `gap-fut-${activity}-${keyTag}-${from.toFixed(3)}`,
          fromChainage: from,
          toChainage: to,
          lengthM: Math.round((to - from) * 1000),
          status: 'future_planned',
          activity,
          remarks: 'Scheduled in upcoming work program phase through 31 Dec 2026',
          isActualRow: false
        });
      } else {
        // Straddles the boundary: split into delayed and future planned
        segments.push({
          id: `gap-del-${activity}-${keyTag}-${from.toFixed(3)}`,
          fromChainage: from,
          toChainage: maxActiveChainage,
          lengthM: Math.round((maxActiveChainage - from) * 1000),
          status: 'delayed',
          activity,
          remarks: 'Planned schedule target overdue; site execution pending mobilization',
          isActualRow: false
        });
        segments.push({
          id: `gap-fut-${activity}-${keyTag}-${maxActiveChainage.toFixed(3)}`,
          fromChainage: maxActiveChainage,
          toChainage: to,
          lengthM: Math.round((to - maxActiveChainage) * 1000),
          status: 'future_planned',
          activity,
          remarks: 'Scheduled in upcoming work program phase through 31 Dec 2026',
          isActualRow: false
        });
      }
    };

    let pointer = effectiveMin;
    mergedActuals.forEach((m, idx) => {
      if (m.from > pointer + 0.02) {
        addGap(pointer, m.from, idx);
      }
      pointer = Math.max(pointer, m.to);
    });

    if (pointer < effectiveMax - 0.02) {
      addGap(pointer, effectiveMax, 'end');
    }

    return segments;
  };

  const millingSegments = useMemo(() => buildActivitySegments('Milling'), [rows, reportDate, maxActiveChainage, effectiveMin, effectiveMax]);
  const tackSegments = useMemo(() => buildActivitySegments('Tackcoat'), [rows, reportDate, maxActiveChainage, effectiveMin, effectiveMax]);
  const dbmSegments = useMemo(() => buildActivitySegments('DBM'), [rows, reportDate, maxActiveChainage, effectiveMin, effectiveMax]);

  // Overall corridor stats
  const corridorStats = useMemo(() => {
    let completedM = 0;
    let inProgressM = 0;
    let delayedM = 0;
    let futureM = 0;

    millingSegments.forEach(s => {
      if (s.status === 'completed') completedM += s.lengthM;
      else if (s.status === 'in_progress') inProgressM += s.lengthM;
      else if (s.status === 'delayed') delayedM += s.lengthM;
      else if (s.status === 'future_planned') futureM += s.lengthM;
    });

    return {
      completedKm: (completedM / 1000).toFixed(2),
      inProgressKm: (inProgressM / 1000).toFixed(2),
      delayedKm: (delayedM / 1000).toFixed(2),
      futureKm: (futureM / 1000).toFixed(2)
    };
  }, [millingSegments]);

  // Compute position percentage relative to fixed baseline base track
  const getSegmentStyle = (from: number, to: number) => {
    const left = Math.max(0, ((Math.min(from, to) - effectiveMin) / totalLengthKm) * 100);
    const right = Math.min(100, ((Math.max(from, to) - effectiveMin) / totalLengthKm) * 100);
    const width = Math.max(0.35, right - left);
    return { left: `${left}%`, width: `${width}%` };
  };

  const handleMouseEnter = (segment: CorridorStripSegment, e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredSegment(segment);
    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top - 10 });
  };

  const handleMouseLeave = () => {
    setHoveredSegment(null);
    setTooltipPos(null);
  };

  const handleClick = (segment: CorridorStripSegment) => {
    if (segment.isActualRow && segment.actualRow && onSelectRow) {
      onSelectRow(segment.actualRow);
    }
  };

  // Resolve styling for a segment based on colorMode and completion status
  const getSegmentColorClass = (segment: CorridorStripSegment) => {
    if (colorMode === 'status') {
      switch (segment.status) {
        case 'completed':
          return 'bg-emerald-500 border-emerald-300 shadow-sm shadow-emerald-950/40 hover:bg-emerald-400';
        case 'in_progress':
          return 'bg-amber-400 border-amber-200 shadow-md shadow-amber-950/50 hover:bg-amber-300 animate-pulse';
        case 'delayed':
          return 'bg-rose-500/85 border-rose-400/90 shadow-sm shadow-rose-950/30 hover:bg-rose-500';
        case 'future_planned':
          return 'bg-sky-500/60 border-sky-400/80 shadow-sm shadow-sky-950/20 hover:bg-sky-400/80';
      }
    }

    // Color by activity fallback
    if (segment.isActualRow) {
      if (segment.activity === 'Milling') return 'bg-cyan-500/80 border-cyan-400/70 hover:bg-cyan-400';
      if (segment.activity === 'Tackcoat') return 'bg-amber-500/80 border-amber-400/70 hover:bg-amber-400';
      return 'bg-emerald-500/80 border-emerald-400/70 hover:bg-emerald-400';
    }
    return segment.status === 'delayed'
      ? 'bg-rose-950/50 border-rose-800/40 text-rose-400'
      : 'bg-slate-800/40 border-white/10 text-slate-500';
  };

  const renderLane = (
    activitySegments: CorridorStripSegment[],
    isSelected: boolean,
    label: string
  ) => {
    if (!isSelected) {
      return (
        <div className="relative h-9 w-full bg-[#111317]/50 rounded-lg border border-dashed border-white/[0.06] flex items-center justify-center text-[11px] text-slate-500 font-mono">
          {label} layer excluded in filter
        </div>
      );
    }

    return (
      <div className="relative h-9 w-full bg-[#10131A] rounded-lg border border-white/[0.06] overflow-visible">
        {activitySegments.map(seg => {
          const style = getSegmentStyle(seg.fromChainage, seg.toChainage);
          const isHovered = hoveredSegment?.id === seg.id;
          const isDimmed = statusFilter !== 'all' && seg.status !== statusFilter;
          const colorClass = getSegmentColorClass(seg);

          return (
            <div
              key={seg.id}
              onClick={() => handleClick(seg)}
              onMouseEnter={e => handleMouseEnter(seg, e)}
              onMouseLeave={handleMouseLeave}
              style={style}
              className={`absolute top-1 bottom-1 rounded-md border transition-all duration-150 cursor-pointer ${colorClass} ${
                isDimmed ? 'opacity-20' : 'opacity-100'
              } ${isHovered ? 'ring-2 ring-white scale-y-110 z-30 shadow-lg' : 'z-10'}`}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* View Mode Selector Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#111317] p-1.5 rounded-xl border border-white/10 select-none shadow-lg">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setStripView('grid')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
              stripView === 'grid'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <GitCommit className="w-3.5 h-3.5 text-cyan-400" />
            <span>NH-334 Linear Progression Grid (Ch. 130+560 to 206+200)</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold">
              Master Format
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStripView('strip')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
              stripView === 'strip'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>DPR Execution Strip Map (Ch. 169+000 to 206+220)</span>
          </button>
        </div>

        <div className="text-[11px] font-mono text-slate-400 px-3 hidden sm:flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>{stripView === 'grid' ? 'Excel Synchronized Layout' : 'Daily DPR Feed'}</span>
        </div>
      </div>

      {stripView === 'grid' ? (
        <SpatialMapModule
          onSelectChainage={onSelectChainage}
          targetChainageM={targetChainageM}
          onDatasetLoaded={onStripDatasetLoaded}
        />
      ) : (
        <Card className="w-full shadow-xl shadow-black/30">
      <CardHeader
        action={
          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Toggle Pill */}
            <div className="flex items-center bg-[#111317] p-0.5 rounded-lg border border-white/10 text-[11px] font-sans">
              <button
                type="button"
                onClick={() => setColorMode('status')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer font-medium ${
                  colorMode === 'status'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Color by Completion Status
              </button>
              <button
                type="button"
                onClick={() => setColorMode('activity')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer font-medium ${
                  colorMode === 'activity'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Color by Layer
              </button>
            </div>

            {/* 4-Color Status Legend */}
            {colorMode === 'status' ? (
              <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed')}
                  className={`flex items-center gap-1.5 transition-opacity cursor-pointer ${
                    statusFilter === 'all' || statusFilter === 'completed' ? 'opacity-100' : 'opacity-40'
                  }`}
                  title="Filter Completed stretches"
                >
                  <span className="w-3 h-3 rounded bg-emerald-500 border border-emerald-300 shadow-sm shadow-emerald-500/40" />
                  <span className="text-emerald-400 font-semibold">Completed</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === 'in_progress' ? 'all' : 'in_progress')}
                  className={`flex items-center gap-1.5 transition-opacity cursor-pointer ${
                    statusFilter === 'all' || statusFilter === 'in_progress' ? 'opacity-100' : 'opacity-40'
                  }`}
                  title="Filter In Progress stretches (Active work front today)"
                >
                  <span className="w-3 h-3 rounded bg-amber-400 border border-amber-200 shadow-sm shadow-amber-400/40 animate-pulse" />
                  <span className="text-amber-300 font-semibold">In Progress</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === 'delayed' ? 'all' : 'delayed')}
                  className={`flex items-center gap-1.5 transition-opacity cursor-pointer ${
                    statusFilter === 'all' || statusFilter === 'delayed' ? 'opacity-100' : 'opacity-40'
                  }`}
                  title="Filter Delayed stretches (Planned in earlier schedule but not done)"
                >
                  <span className="w-3 h-3 rounded bg-rose-500 border border-rose-300 shadow-sm shadow-rose-500/40" />
                  <span className="text-rose-400 font-semibold">Delayed</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === 'future_planned' ? 'all' : 'future_planned')}
                  className={`flex items-center gap-1.5 transition-opacity cursor-pointer ${
                    statusFilter === 'all' || statusFilter === 'future_planned' ? 'opacity-100' : 'opacity-40'
                  }`}
                  title="Filter Future Planned stretches"
                >
                  <span className="w-3 h-3 rounded bg-sky-500 border border-sky-300 shadow-sm shadow-sky-500/40" />
                  <span className="text-sky-400 font-semibold">Future Planned</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-4 text-xs font-mono">
                <div className={`flex items-center gap-1.5 ${isMillingSelected ? 'opacity-100' : 'opacity-40'}`}>
                  <span className="w-3 h-3 rounded bg-cyan-500 border border-cyan-300" />
                  <span className="text-cyan-400 font-medium">Milling</span>
                </div>
                <div className={`flex items-center gap-1.5 ${isTackSelected ? 'opacity-100' : 'opacity-40'}`}>
                  <span className="w-3 h-3 rounded bg-amber-500 border border-amber-300" />
                  <span className="text-amber-400 font-medium">Tackcoat</span>
                </div>
                <div className={`flex items-center gap-1.5 ${isDbmSelected ? 'opacity-100' : 'opacity-40'}`}>
                  <span className="w-3 h-3 rounded bg-emerald-500 border border-emerald-300" />
                  <span className="text-emerald-400 font-medium">DBM</span>
                </div>
              </div>
            )}
          </div>
        }
      >
        <CardTitle icon={<GitCommit className="w-4 h-4 text-cyan-400" />}>
          Linear Highway Progression Strip Map (Ch. {effectiveMin.toFixed(3)} to {effectiveMax.toFixed(3)} km)
        </CardTitle>
        <p className="text-xs text-slate-400">
          Continuous contractual baseline corridor (37.22 km) color-coded by execution lifecycle status
        </p>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-4">
        {/* Executive Corridor Summary KPIs Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-[#0D1017] p-2.5 rounded-xl border border-white/5 font-mono text-xs">
          <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-slate-400 text-[11px]">Completed:</span>
            <span className="text-emerald-300 font-bold">{corridorStats.completedKm} km</span>
          </div>
          <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <span className="text-slate-400 text-[11px]">In Progress:</span>
            <span className="text-amber-300 font-bold">{corridorStats.inProgressKm} km</span>
          </div>
          <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
            <span className="text-slate-400 text-[11px]">Delayed:</span>
            <span className="text-rose-300 font-bold">{corridorStats.delayedKm} km</span>
          </div>
          <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20">
            <span className="text-slate-400 text-[11px]">Future Scope:</span>
            <span className="text-sky-300 font-bold">{corridorStats.futureKm} km</span>
          </div>
        </div>

        {/* Strip Track Container */}
        <div className="space-y-2.5">
          {/* Lane 1: Milling */}
          <div className={`flex items-center gap-3 transition-opacity ${isMillingSelected ? 'opacity-100' : 'opacity-40'}`}>
            <div className="w-24 shrink-0 flex items-center gap-1.5 text-xs font-semibold text-cyan-400">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Milling</span>
            </div>
            <div className="flex-1">
              {renderLane(millingSegments, isMillingSelected, 'Milling')}
            </div>
          </div>

          {/* Lane 2: Tackcoat */}
          <div className={`flex items-center gap-3 transition-opacity ${isTackSelected ? 'opacity-100' : 'opacity-40'}`}>
            <div className="w-24 shrink-0 flex items-center gap-1.5 text-xs font-semibold text-amber-400">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Tackcoat</span>
            </div>
            <div className="flex-1">
              {renderLane(tackSegments, isTackSelected, 'Tackcoat')}
            </div>
          </div>

          {/* Lane 3: DBM */}
          <div className={`flex items-center gap-3 transition-opacity ${isDbmSelected ? 'opacity-100' : 'opacity-40'}`}>
            <div className="w-24 shrink-0 flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
              <Truck className="w-3.5 h-3.5 text-emerald-400" />
              <span>DBM</span>
            </div>
            <div className="flex-1">
              {renderLane(dbmSegments, isDbmSelected, 'DBM')}
            </div>
          </div>
        </div>

        {/* Chainage Ruler Scale with Active Work Front Pin */}
        <div className="flex items-center gap-3 pt-2">
          <div className="w-24 shrink-0 text-[11px] font-mono text-slate-500">
            Scale (km):
          </div>
          <div className="flex-1 relative h-8 border-t border-white/20">
            {/* Start boundary tick */}
            <div
              style={{ left: '0%' }}
              className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
            >
              <div className="w-px h-2 bg-cyan-400" />
              <span className="text-[10px] font-mono text-cyan-300 mt-1 whitespace-nowrap">
                Ch.{effectiveMin.toFixed(0)}
              </span>
            </div>

            {/* Standard intermediate ticks */}
            {ticks.map(k => {
              const posPercent = ((k - effectiveMin) / totalLengthKm) * 100;
              if (posPercent <= 3 || posPercent >= 97) return null;
              return (
                <div
                  key={`tick-${k}`}
                  style={{ left: `${posPercent}%` }}
                  className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
                >
                  <div className="w-px h-2 bg-white/30" />
                  <span className="text-[10px] font-mono text-slate-400 mt-1 whitespace-nowrap">
                    Ch.{k}
                  </span>
                </div>
              );
            })}

            {/* Active Work Front Pin Marker */}
            {maxActiveChainage > effectiveMin && maxActiveChainage < effectiveMax && (
              <div
                style={{ left: `${((maxActiveChainage - effectiveMin) / totalLengthKm) * 100}%` }}
                className="absolute top-0 -translate-x-1/2 flex flex-col items-center z-20"
                title={`Active Front at Ch. ${maxActiveChainage.toFixed(3)}`}
              >
                <div className="w-0.5 h-3.5 bg-amber-400 shadow-sm shadow-amber-400" />
                <span className="text-[9px] font-mono font-bold text-amber-300 bg-amber-950/80 px-1 py-0.2 rounded border border-amber-500/40 mt-0.5 whitespace-nowrap">
                  Front: Ch.{maxActiveChainage.toFixed(1)}
                </span>
              </div>
            )}

            {/* End boundary tick */}
            <div
              style={{ left: '100%' }}
              className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
            >
              <div className="w-px h-2 bg-emerald-400" />
              <span className="text-[10px] font-mono text-emerald-300 mt-1 whitespace-nowrap">
                Ch.{effectiveMax.toFixed(0)}
              </span>
            </div>
          </div>
        </div>

        {/* Key Corridor Milestones Strip */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 font-mono border-t border-white/[0.06]">
          <span className="flex items-center gap-1 text-cyan-400">
            <MapPin className="w-3.5 h-3.5 text-cyan-400" />
            Roorkee (Ch. {formatChainagePlus(effectiveMin)})
          </span>
          <span className="hidden sm:inline text-slate-400">
            Active Construction Zone: Ch. 189+230 – 203+775 • Total Corridor: {totalLengthKm.toFixed(2)} km
          </span>
          <span className="flex items-center gap-1 text-emerald-400">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            Haridwar (Ch. {formatChainagePlus(effectiveMax)})
          </span>
        </div>
      </CardContent>

      {/* Floating Hover Tooltip */}
      {hoveredSegment && tooltipPos && (
        <div
          style={{
            position: 'fixed',
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            transform: 'translate(-50%, -100%)',
            pointerEvents: 'none',
            zIndex: 100
          }}
          className="bg-[#121622]/95 border border-white/20 rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs min-w-[240px] space-y-2"
        >
          {/* Header Row */}
          <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1.5">
            <span className="font-bold text-white font-mono">
              {formatChainagePlus(hoveredSegment.fromChainage)} → {formatChainagePlus(hoveredSegment.toChainage)}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase tracking-wider ${
                hoveredSegment.status === 'completed'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : hoveredSegment.status === 'in_progress'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : hoveredSegment.status === 'delayed'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
              }`}
            >
              {hoveredSegment.status === 'completed'
                ? 'Completed'
                : hoveredSegment.status === 'in_progress'
                ? 'In Progress'
                : hoveredSegment.status === 'delayed'
                ? 'Delayed'
                : 'Future Planned'}
            </span>
          </div>

          {/* Details Content */}
          <div className="space-y-1 font-mono text-[11px] text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Activity:</span>
              <span className="text-cyan-300 font-semibold">{hoveredSegment.activity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Segment Length:</span>
              <span className="text-white">{hoveredSegment.lengthM.toLocaleString()} m ({(hoveredSegment.lengthM / 1000).toFixed(3)} km)</span>
            </div>

            {hoveredSegment.isActualRow ? (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-400">Execution Date:</span>
                  <span className="text-white">
                    {hoveredSegment.date} {hoveredSegment.status === 'in_progress' && '(Active Shift)'}
                  </span>
                </div>
                {hoveredSegment.lane && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Lane:</span>
                    <span className="text-white">{hoveredSegment.lane}</span>
                  </div>
                )}
                {hoveredSegment.achievedQty !== undefined && (
                  <div className="flex justify-between border-t border-white/5 pt-1 text-emerald-300 font-semibold">
                    <span>Quantity Achieved:</span>
                    <span>{hoveredSegment.achievedQty} {hoveredSegment.unit}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="border-t border-white/5 pt-1 text-[10px] text-slate-400 italic">
                {hoveredSegment.remarks}
              </div>
            )}
          </div>
        </div>
      )}
        </Card>
      )}
    </div>
  );
};

export default LinearChainageStrip;
