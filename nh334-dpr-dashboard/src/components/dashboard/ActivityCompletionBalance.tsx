import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ActualDPRRow, ProjectBaseline, ActivityType, HighwaySide } from '../../types/dpr';
import { computeActivityProgressMetrics, MetricMode } from '../../utils/analyticsCalculations';
import {
  BarChart3,
  Layers,
  Truck,
  Droplets
} from 'lucide-react';

interface ActivityCompletionBalanceProps {
  actualRows: ActualDPRRow[];
  baseline?: ProjectBaseline;
  selectedActivities?: ActivityType[];
  side?: HighwaySide;
}

export const ActivityCompletionBalance: React.FC<ActivityCompletionBalanceProps> = ({
  actualRows,
  baseline,
  selectedActivities,
  side = 'Both'
}) => {
  const [metricMode, setMetricMode] = useState<MetricMode>('quantity');
  const [hoveredActivity, setHoveredActivity] = useState<string | null>(null);
  const [frozenActivity, setFrozenActivity] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close frozen tooltip when clicking outside the component
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFrozenActivity(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Authoritative calculations from shared analyticsCalculations
  const allMetrics = useMemo(() => {
    return computeActivityProgressMetrics(actualRows, baseline, side);
  }, [actualRows, baseline, side]);

  // Filter activities based on global selection
  const displayedMetrics = useMemo(() => {
    if (!selectedActivities || selectedActivities.length === 0) return allMetrics;
    return allMetrics.filter(m => selectedActivities.includes(m.activity));
  }, [allMetrics, selectedActivities]);

  const fmt = (num: number, decimals = 1) =>
    num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });

  const isQuantity = metricMode === 'quantity';

  // Activity-specific icon matching reference image 2
  const getActivityIcon = (activity: ActivityType) => {
    switch (activity) {
      case 'Milling':
        return <Truck className="w-5 h-5 text-teal-300" />;
      case 'Tackcoat':
        return <Droplets className="w-5 h-5 text-teal-300" />;
      case 'DBM':
        return <Layers className="w-5 h-5 text-teal-300" />;
      case 'BC':
        // Crisp highway road lane icon matching reference image (/ : \)
        return (
          <svg
            className="w-5 h-5 text-teal-300"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 19L9 5" />
            <path d="M20 19L15 5" />
            <path d="M12 5V8" />
            <path d="M12 11V14" />
            <path d="M12 17V20" />
          </svg>
        );
      default:
        return <Layers className="w-5 h-5 text-teal-300" />;
    }
  };

  return (
    <div
      ref={containerRef}
      className="h-full rounded-2xl bg-[#101820] border border-cyan-500/30 p-5 sm:p-6 shadow-2xl shadow-cyan-950/20 flex flex-col justify-between font-sans select-none relative overflow-hidden"
    >
      {/* Background ambient radial tint */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* ============================================================== */}
      {/* 1. Header Section: Title + Subtitle & Toggle Controls          */}
      {/* ============================================================== */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Activity-wise Completion & Balance
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Work progress against contractual target
              </p>
            </div>
          </div>

          {/* Segmented Control Toggle: [ Quantity ] [ Linear Length ] */}
          <div className="flex items-center bg-[#070D12] p-1 rounded-xl border border-white/10 text-xs font-mono self-start sm:self-auto shadow-inner">
            <button
              type="button"
              onClick={() => setMetricMode('quantity')}
              data-on-accent={metricMode === 'quantity' ? 'true' : undefined}
              className={`px-4 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                metricMode === 'quantity'
                  ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-md shadow-emerald-950/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Quantity
            </button>
            <button
              type="button"
              onClick={() => setMetricMode('linear')}
              data-on-accent={metricMode === 'linear' ? 'true' : undefined}
              className={`px-4 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                metricMode === 'linear'
                  ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-md shadow-emerald-950/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Linear Length
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 2. Legend (Below Header, Aligned to Right)                     */}
        {/* ============================================================== */}
        <div className="flex items-center justify-end gap-5 mt-2.5 mb-2.5 text-xs font-medium text-slate-300">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-sm bg-[#10B981] shadow-sm shadow-emerald-500/40" />
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-sm bg-[#F59E0B] shadow-sm shadow-amber-500/40" />
            <span>Remaining</span>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. Main Horizontal Stacked Bar Chart Area                      */}
      {/* ============================================================== */}
      <div className="flex-1 flex flex-col justify-evenly gap-3 py-1">
        {displayedMetrics.length === 0 ? (
          <div className="py-12 text-center text-slate-500 font-mono text-xs">
            No matching activity data available for the active filters.
          </div>
        ) : (
          displayedMetrics.map(item => {
            const target = isQuantity ? item.targetQuantity : item.targetLengthM;
            const achieved = isQuantity ? item.achievedQuantity : item.achievedLengthM;
            const remaining = isQuantity ? item.remainingQuantity : item.remainingLengthM;
            const percent = isQuantity
              ? item.quantityCompletionPercent
              : item.linearCompletionPercent;
            const unit = isQuantity ? item.unit : item.linearUnit;

            // Bar visual representation
            const rawCompleted = Math.min(100, Math.max(0, percent));
            const rawRemaining = Math.max(0, 100 - rawCompleted);

            // Minimum visual width ensuring text fits inside small segments as in Reference Image 2
            const visualCompleted =
              rawCompleted > 0 ? Math.min(100, Math.max(rawCompleted, 5.5)) : 0;
            const visualRemaining = 100 - visualCompleted;

            const isHovered = hoveredActivity === item.activity;
            const isFrozen = frozenActivity === item.activity;
            const isVisible = isFrozen || (frozenActivity === null && isHovered);

            return (
              <div
                key={item.activity}
                onMouseEnter={() => setHoveredActivity(item.activity)}
                onMouseLeave={() => setHoveredActivity(null)}
                onClick={() => setFrozenActivity(prev => prev === item.activity ? null : item.activity)}
                className={`relative group rounded-xl transition-all duration-150 p-1.5 -mx-1.5 cursor-pointer ${
                  isFrozen
                    ? 'bg-cyan-500/[0.1] ring-1 ring-teal-400/50'
                    : isHovered
                    ? 'bg-cyan-500/[0.04]'
                    : ''
                }`}
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  {/* Left Column: Dedicated Activity Label & Icon */}
                  <div className="w-32 sm:w-40 flex items-center gap-3 shrink-0">
                    <div className="w-11 h-11 rounded-xl bg-[#0F1D24] border border-teal-500/30 flex items-center justify-center text-teal-300 shrink-0 shadow-sm">
                      {getActivityIcon(item.activity)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm sm:text-base font-bold text-white tracking-wide truncate">
                        {item.activity}
                      </div>
                      <div className="text-xs text-slate-400 font-medium font-mono">
                        ({unit})
                      </div>
                    </div>
                  </div>

                  {/* Middle Column: Stacked Bar with Vertical Grid Background */}
                  <div className="flex-1 relative flex items-center">
                    {/* Vertical Gridlines aligned across rows */}
                    <div className="absolute inset-0 pointer-events-none flex">
                      {[0, 20, 40, 60, 80, 100].map(val => (
                        <div
                          key={val}
                          style={{ left: `${val}%` }}
                          className="absolute top-0 bottom-0 border-l border-white/[0.06]"
                        />
                      ))}
                    </div>

                    {/* Thick Horizontal Stacked Bar */}
                    <div className="w-full h-9 sm:h-10 bg-[#17202A] rounded-xl overflow-hidden flex relative shadow-inner border border-white/5">
                      {/* Green Completed Segment (#10B981) */}
                      {visualCompleted > 0 && (
                        <div
                          style={{ width: `${visualCompleted}%` }}
                          data-on-accent="true"
                          className="h-full bg-[#10B981] flex items-center justify-center transition-all duration-500 relative border-r border-[#0B1319]/30"
                        >
                          <span className="text-xs font-bold font-mono text-white drop-shadow-sm px-1.5 whitespace-nowrap">
                            {fmt(percent, 1)}%
                          </span>
                        </div>
                      )}

                      {/* Orange Remaining Segment (#F59E0B) */}
                      {visualRemaining > 0 && (
                        <div
                          style={{ width: `${visualRemaining}%` }}
                          data-on-accent="true"
                          className="h-full bg-[#F59E0B] flex items-center justify-center transition-all duration-500 relative"
                        >
                          <span className="text-xs font-bold font-mono text-white drop-shadow-sm px-1.5 whitespace-nowrap">
                            {fmt(rawRemaining, 1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Completion Percentage with Vertical Divider */}
                  <div className="w-24 sm:w-28 pl-4 border-l border-white/[0.08] text-right shrink-0">
                    <div className="text-xl sm:text-2xl font-bold font-mono text-[#10B981] leading-none tracking-tight">
                      {fmt(percent, 1)}%
                    </div>
                    <div className="text-[11px] text-slate-400 font-medium mt-1">
                      Completed
                    </div>
                  </div>
                </div>

                {/* Interactive Tooltip Card (Freezable on Click) */}
                {isVisible && (
                  <div
                    onClick={(e) => {
                      // Clicking the tooltip also toggles/keeps freeze
                      e.stopPropagation();
                      setFrozenActivity(prev => prev === item.activity ? null : item.activity);
                    }}
                    className={`absolute left-36 sm:left-44 top-full mt-1 z-30 p-3 rounded-xl bg-[#081017] shadow-2xl backdrop-blur-md text-xs font-mono text-slate-200 min-w-[270px] ${
                      isFrozen
                        ? 'border-2 border-teal-400 shadow-teal-500/30 ring-2 ring-teal-500/20'
                        : 'border border-teal-500/40'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-1.5 border-b border-white/10 font-bold">
                      <div className="flex items-center gap-1.5">
                        <span className="text-white">{item.activity} Details</span>
                        {isFrozen && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-teal-500/20 text-teal-300 rounded border border-teal-500/40 font-mono">
                            🔒 Frozen
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400">{fmt(percent, 1)}%</span>
                        {isFrozen && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFrozenActivity(null);
                            }}
                            className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer transition-colors"
                            title="Unfreeze tooltip"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1 mt-2 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Achieved:</span>
                        <span className="text-white font-bold">
                          {fmt(achieved, isQuantity && item.activity === 'DBM' ? 2 : 1)} {unit}
                          {!isQuantity && ` (${(achieved / 1000).toFixed(2)} km)`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Target:</span>
                        <span className="text-slate-300 font-semibold">
                          {fmt(target, isQuantity && item.activity === 'DBM' ? 2 : 1)} {unit}
                          {!isQuantity && ` (${(target / 1000).toFixed(2)} km)`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Remaining Balance:</span>
                        <span className="text-amber-400 font-bold">
                          {fmt(remaining, isQuantity && item.activity === 'DBM' ? 2 : 1)} {unit}
                          {!isQuantity && ` (${(remaining / 1000).toFixed(2)} km)`}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Shared X-Axis (0% - 100%) Precisely Aligned to Center Bar Column */}
        <div className="flex items-center gap-3 sm:gap-4 mt-2">
          {/* Offset matching left activity label column */}
          <div className="w-32 sm:w-40 shrink-0" />

          {/* Axis Line with Ticks and Labels */}
          <div className="flex-1 relative pt-1 border-t border-white/15">
            <div className="relative w-full h-5">
              {[0, 20, 40, 60, 80, 100].map(val => (
                <div
                  key={val}
                  style={{ left: `${val}%` }}
                  className="absolute -top-1 -translate-x-1/2 flex flex-col items-center"
                >
                  <div className="w-px h-1.5 bg-white/40" />
                  <span className="text-[11px] font-mono text-slate-400 mt-0.5 font-medium">
                    {val}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Offset matching right completion column with divider padding */}
          <div className="w-24 sm:w-28 pl-4 shrink-0" />
        </div>
      </div>
    </div>
  );
};

export default ActivityCompletionBalance;
