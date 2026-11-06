import React, { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import {
  StripChartDataset,
  ChainageInterval,
  StripCell,
  WorkZoneAnnotation as WorkZoneAnnotationType,
} from '../../types/stripChart';
import { ActivityRows } from './ActivityRows';
import { ChainageHeaderBand } from './ChainageHeaderBand';
import { getActivityIcon } from './ActivitySidebar';
import {
  BarChart2,
  ArrowUpDown,
  MapPin,
} from 'lucide-react';

interface StripMapGridProps {
  dataset: StripChartDataset;
  selectedActivityId: string; // 'all' or specific id
  colorMode: 'completion' | 'activity';
  onColorModeChange: (mode: 'completion' | 'activity') => void;
  scrollRatio: number;
  onScrollRatioChange: (ratio: number, currentStart: string, currentEnd: string) => void;
  scrollTrigger: { direction: 'left' | 'right'; id: number; step: 'page' | 'chunk' } | null;
  targetRatio: number | null;
}

interface HoveredCellInfo {
  side: 'LHS' | 'RHS';
  activityName: string;
  interval: ChainageInterval;
  cell: StripCell;
}

export const StripMapGrid: React.FC<StripMapGridProps> = ({
  dataset,
  selectedActivityId,
  colorMode,
  onColorModeChange,
  onScrollRatioChange,
  scrollTrigger,
  targetRatio,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [hoveredIntervalIndex, setHoveredIntervalIndex] = useState<number | null>(null);
  const [hoveredCell, setHoveredCell] = useState<HoveredCellInfo | null>(null);
  const [hoveredZone, setHoveredZone] = useState<WorkZoneAnnotationType | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const { metadata, lhsActivities, rhsActivities, intervals, lhsCells, rhsCells, lhsWorkZones, rhsWorkZones } = dataset;

  // Filter activities based on sidebar selection
  const filteredLhsActivities = useMemo(() => {
    if (selectedActivityId === 'all') return lhsActivities;
    return lhsActivities.filter((act) => act.id === selectedActivityId);
  }, [lhsActivities, selectedActivityId]);

  const filteredRhsActivities = useMemo(() => {
    if (selectedActivityId === 'all') return rhsActivities;
    return rhsActivities.filter((act) => act.id === selectedActivityId);
  }, [rhsActivities, selectedActivityId]);

  // Compute proportional column widths based strictly on lengthM
  const { columnWidths, columnOffsets, totalGridWidth } = useMemo(() => {
    const scale = 0.088; // px per metre
    const widths: number[] = [];
    const offsets: number[] = [];
    let currentOffset = 0;

    intervals.forEach((inter) => {
      offsets.push(currentOffset);
      const computed = Math.round(inter.lengthM * scale);
      const minW = inter.lengthM < 300 ? 32 : 54;
      const finalW = Math.max(computed, minW);
      widths.push(finalW);
      currentOffset += finalW;
    });

    return {
      columnWidths: widths,
      columnOffsets: offsets,
      totalGridWidth: currentOffset,
    };
  }, [intervals]);

  // Handle Scroll and update dynamic range in parent
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    const maxScroll = scrollWidth - clientWidth;
    const ratio = maxScroll > 0 ? scrollLeft / maxScroll : 0;

    const visibleStartPx = scrollLeft;
    const visibleEndPx = scrollLeft + clientWidth;

    let startIdx = 0;
    let endIdx = intervals.length - 1;

    for (let i = 0; i < columnOffsets.length; i++) {
      if (columnOffsets[i] + columnWidths[i] >= visibleStartPx) {
        startIdx = i;
        break;
      }
    }

    for (let i = startIdx; i < columnOffsets.length; i++) {
      if (columnOffsets[i] >= visibleEndPx || i === intervals.length - 1) {
        endIdx = i;
        break;
      }
    }

    const startCh = intervals[startIdx]?.fromChainage || metadata.startChainage;
    const endCh = intervals[endIdx]?.toChainage || metadata.endChainage;

    onScrollRatioChange(ratio, startCh, endCh);
  }, [columnOffsets, columnWidths, intervals, metadata, onScrollRatioChange]);

  // Programmatic scroll triggers
  useEffect(() => {
    if (!scrollTrigger || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const shift = scrollTrigger.step === 'page' ? container.clientWidth * 0.85 : 300;

    if (scrollTrigger.direction === 'left') {
      container.scrollBy({ left: -shift, behavior: 'smooth' });
    } else {
      container.scrollBy({ left: shift, behavior: 'smooth' });
    }
  }, [scrollTrigger]);

  // Programmatic slider drag
  useEffect(() => {
    if (targetRatio === null || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const maxScroll = container.scrollWidth - container.clientWidth;
    container.scrollTo({ left: maxScroll * targetRatio, behavior: 'smooth' });
  }, [targetRatio]);

  useEffect(() => {
    handleScroll();
  }, [handleScroll]);

  const handleMouseMove = (e: React.MouseEvent) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  const handleHoverCell = (info: HoveredCellInfo | null, e?: React.MouseEvent) => {
    setHoveredCell(info);
    if (info) {
      setHoveredIntervalIndex(info.interval.index);
      if (e) setTooltipPos({ x: e.clientX, y: e.clientY });
    } else {
      if (!hoveredZone) setHoveredIntervalIndex(null);
    }
  };

  const handleHoverZone = (zone: WorkZoneAnnotationType | null, e?: React.MouseEvent) => {
    setHoveredZone(zone);
    if (zone) {
      if (e) setTooltipPos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleHoverBandInterval = (idx: number | null, e?: React.MouseEvent) => {
    setHoveredIntervalIndex(idx);
    if (idx !== null && e) {
      setTooltipPos({ x: e.clientX, y: e.clientY });
    }
  };

  const activeBandInterval = hoveredIntervalIndex !== null ? intervals[hoveredIntervalIndex] : null;

  return (
    <div
      className="flex-1 bg-[#12161D] border border-cyan-500/25 rounded-2xl overflow-hidden shadow-2xl relative select-none flex flex-col font-mono"
      onMouseMove={handleMouseMove}
    >
      {/* ========================================================= */}
      {/* PANEL TOP BAR: Title, View Switcher & Inline Status Legend */}
      {/* ========================================================= */}
      <div className="px-4 py-3 bg-[#0E1218] border-b border-cyan-500/20 flex flex-wrap items-center justify-between gap-3">
        {/* Title */}
        <div className="flex items-center gap-2.5">
          <BarChart2 className="w-4 h-4 text-cyan-400" />
          <span className="text-xs sm:text-sm font-bold text-white tracking-tight">
            Chainage-wise Activity Progression
          </span>
        </div>

        {/* Center: View Toggle Pills */}
        <div className="flex items-center bg-[#080B0F] p-0.5 rounded-lg border border-white/10 text-[11px]">
          <button
            type="button"
            onClick={() => onColorModeChange('completion')}
            className={`px-3 py-1 rounded-md transition-all cursor-pointer font-medium ${
              colorMode === 'completion'
                ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Color by Completion
          </button>
          <button
            type="button"
            onClick={() => onColorModeChange('activity')}
            className={`px-3 py-1 rounded-md transition-all cursor-pointer font-medium ${
              colorMode === 'activity'
                ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Color by Activity
          </button>
        </div>

        {/* Right: Inline Status Taxonomy Legend */}
        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#10B981] border border-emerald-300" />
            <span className="text-emerald-400 font-medium">Completed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#EAB308] border border-amber-300" />
            <span className="text-amber-400 font-medium">In Progress</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#EF4444] border border-rose-300" />
            <span className="text-rose-400 font-medium">Delayed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#0284C7] border border-sky-300" />
            <span className="text-sky-400 font-medium">Future Planned</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#475569] border border-slate-400" />
            <span className="text-slate-300 font-medium">DPS Work Zone</span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MAIN GRID BODY: Fixed Sidebar + Horizontally Scrolling Area*/}
      {/* ========================================================= */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* FIXED LEFT SIDEBAR: Side Badges + Activity Names */}
        <div className="flex shrink-0 bg-[#0E1218] border-r-2 border-cyan-500/30 z-30 shadow-2xl">
          {/* Sub-column 1: Prominent LHS / CHAINAGE / RHS Vertical Badges */}
          <div className="w-16 sm:w-20 bg-[#090C10] border-r border-white/10 flex flex-col justify-between select-none">
            {/* LHS Vertical Badge */}
            <div
              style={{
                height: `${filteredLhsActivities.length * 28}px`,
              }}
              className="w-full bg-gradient-to-b from-[#0B252B] to-[#07191E] border-b border-cyan-500/30 flex flex-col items-center justify-center gap-1 text-cyan-300 p-1"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span className="text-xs sm:text-sm font-black tracking-widest text-cyan-200">
                LHS
              </span>
            </div>

            {/* CHAINAGE INTERVAL Central Badge */}
            <div className="h-[92px] w-full bg-gradient-to-b from-[#0C2B36] to-[#081F26] border-y-2 border-cyan-400/50 flex flex-col items-center justify-center gap-1 text-center p-1 shadow-inner">
              <MapPin className="w-4 h-4 text-cyan-300" />
              <span className="text-[9px] font-black text-cyan-200 uppercase tracking-tighter leading-tight">
                CHAINAGE<br />INTERVAL
              </span>
            </div>

            {/* RHS Vertical Badge */}
            <div
              style={{
                height: `${filteredRhsActivities.length * 28}px`,
              }}
              className="w-full bg-gradient-to-b from-[#0B252B] to-[#07191E] border-t border-cyan-500/30 flex flex-col items-center justify-center gap-1 text-cyan-300 p-1"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span className="text-xs sm:text-sm font-black tracking-widest text-cyan-200">
                RHS
              </span>
            </div>
          </div>

          {/* Sub-column 2: Activity Row Names & From/To/Length labels */}
          <div className="w-48 sm:w-56 flex flex-col divide-y divide-white/5 font-mono text-xs">
            {/* LHS Activity Names */}
            <div className="flex flex-col">
              {filteredLhsActivities.map((act) => (
                <div
                  key={`lhs-label-${act.id}`}
                  className="h-7 px-3 flex items-center gap-2 text-slate-300 hover:text-white hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0"
                  title={act.name}
                >
                  <div className="text-cyan-400 shrink-0">
                    {getActivityIcon(act.id, 'w-3.5 h-3.5')}
                  </div>
                  <span className="text-[11px] truncate font-medium text-slate-200">
                    {act.name}
                  </span>
                </div>
              ))}
            </div>

            {/* Central Chainage Labels (3 rows matching From, To, Length) */}
            <div className="bg-[#0C1A24] border-y-2 border-cyan-500/40 divide-y divide-white/10 font-mono">
              <div className="h-8 px-3 flex items-center justify-between text-cyan-300 font-bold text-xs sm:text-[12px]">
                <span className="tracking-tight">From</span>
              </div>
              <div className="h-8 px-3 flex items-center justify-between text-slate-100 font-bold text-xs sm:text-[12px]">
                <span className="tracking-tight">To</span>
              </div>
              <div className="h-7 px-3 flex items-center justify-between text-amber-300 font-bold text-xs sm:text-[12px] bg-[#09141D]">
                <span className="tracking-tight">Length (m)</span>
              </div>
            </div>

            {/* RHS Activity Names */}
            <div className="flex flex-col">
              {filteredRhsActivities.map((act) => (
                <div
                  key={`rhs-label-${act.id}`}
                  className="h-7 px-3 flex items-center gap-2 text-slate-300 hover:text-white hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0"
                  title={act.name}
                >
                  <div className="text-teal-400 shrink-0">
                    {getActivityIcon(act.id, 'w-3.5 h-3.5')}
                  </div>
                  <span className="text-[11px] truncate font-medium text-slate-200">
                    {act.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* HORIZONTALLY SCROLLING AREA */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-cyan-500/30 scrollbar-track-[#090A0D] bg-[#0A0D12] relative"
        >
          <div
            style={{ width: `${totalGridWidth}px` }}
            className="flex flex-col relative min-w-full"
          >
            {/* LHS Section */}
            <div className="relative">
              <ActivityRows
                side="LHS"
                activities={filteredLhsActivities}
                intervals={intervals}
                columnWidths={columnWidths}
                columnOffsets={columnOffsets}
                cellsByActivity={lhsCells}
                workZones={lhsWorkZones}
                hoveredIntervalIndex={hoveredIntervalIndex}
                colorMode={colorMode}
                onHoverCell={handleHoverCell}
                onHoverZone={handleHoverZone}
              />
            </div>

            {/* Central Chainage Information Band */}
            <ChainageHeaderBand
              intervals={intervals}
              columnWidths={columnWidths}
              hoveredIntervalIndex={hoveredIntervalIndex}
              onHoverInterval={handleHoverBandInterval}
            />

            {/* RHS Section */}
            <div className="relative">
              <ActivityRows
                side="RHS"
                activities={filteredRhsActivities}
                intervals={intervals}
                columnWidths={columnWidths}
                columnOffsets={columnOffsets}
                cellsByActivity={rhsCells}
                workZones={rhsWorkZones}
                hoveredIntervalIndex={hoveredIntervalIndex}
                colorMode={colorMode}
                onHoverCell={handleHoverCell}
                onHoverZone={handleHoverZone}
              />
            </div>

            {/* Synchronized Vertical Column Hover Highlight */}
            {hoveredIntervalIndex !== null && (
              <div
                style={{
                  left: `${columnOffsets[hoveredIntervalIndex]}px`,
                  width: `${columnWidths[hoveredIntervalIndex]}px`,
                }}
                className="absolute inset-y-0 bg-cyan-400/10 pointer-events-none border-x border-cyan-400/40 z-10"
              />
            )}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TOOLTIP POPUP                                             */}
      {/* ========================================================= */}
      {tooltipPos && (hoveredCell || hoveredZone || activeBandInterval) && (
        <div
          style={{
            position: 'fixed',
            left: `${Math.min(tooltipPos.x + 15, window.innerWidth - 300)}px`,
            top: `${Math.max(tooltipPos.y - 140, 20)}px`,
          }}
          className="z-50 pointer-events-none bg-[#14171C]/95 backdrop-blur-md border border-cyan-500/40 rounded-xl p-3 shadow-2xl text-xs font-mono w-72 animate-fade-in"
        >
          {hoveredZone && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                <span className="text-[10px] font-bold tracking-wider text-cyan-400 uppercase">
                  Special Work Zone
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white font-semibold">
                  {hoveredZone.side}
                </span>
              </div>
              <div className="text-sm font-bold text-white">{hoveredZone.label}</div>
              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                <div>
                  <span className="text-slate-400 text-[10px]">From Chainage:</span>
                  <div className="text-cyan-300 font-semibold">Ch. {hoveredZone.fromChainage}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px]">To Chainage:</span>
                  <div className="text-cyan-300 font-semibold">Ch. {hoveredZone.toChainage}</div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[11px]">
                <span className="text-slate-400">Total Length:</span>
                <span className="text-amber-300 font-bold">
                  {hoveredZone.totalLengthM.toLocaleString()} m ({(hoveredZone.totalLengthM / 1000).toFixed(2)} km)
                </span>
              </div>
            </div>
          )}

          {!hoveredZone && hoveredCell && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                <span className="text-[10px] font-bold tracking-wider text-cyan-400 uppercase">
                  {hoveredCell.side} MCW
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                    hoveredCell.cell.status === 'completed'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-white/10 text-slate-300'
                  }`}
                >
                  {hoveredCell.cell.status.replace('_', ' ')}
                </span>
              </div>
              <div className="text-sm font-bold text-white">{hoveredCell.activityName}</div>
              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                <div>
                  <span className="text-slate-400 text-[10px]">From:</span>
                  <div className="text-cyan-300 font-semibold">Ch. {hoveredCell.interval.fromChainage}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px]">To:</span>
                  <div className="text-cyan-300 font-semibold">Ch. {hoveredCell.interval.toChainage}</div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[11px]">
                <span className="text-slate-400">Interval Length:</span>
                <span className="text-amber-300 font-bold">
                  {hoveredCell.interval.lengthM.toLocaleString()} m
                </span>
              </div>
            </div>
          )}

          {!hoveredZone && !hoveredCell && activeBandInterval && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                <span className="text-[10px] font-bold tracking-wider text-cyan-400 uppercase">
                  Chainage Interval #{activeBandInterval.index + 1}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                <div>
                  <span className="text-slate-400 text-[10px]">From:</span>
                  <div className="text-cyan-300 font-bold">Ch. {activeBandInterval.fromChainage}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px]">To:</span>
                  <div className="text-cyan-300 font-bold">Ch. {activeBandInterval.toChainage}</div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[11px]">
                <span className="text-slate-400">Length:</span>
                <span className="text-amber-300 font-bold">
                  {activeBandInterval.lengthM.toLocaleString()} m
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
