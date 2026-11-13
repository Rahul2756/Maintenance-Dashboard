import React, { useState, useMemo } from 'react';
import { ActualDPRRow, ProjectBaseline, ActivityType, HighwaySide } from '../../types/dpr';
import { computeActivityProgressMetrics, MetricMode } from '../../utils/analyticsCalculations';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Split, Layers, Ruler, ArrowUpRight, ArrowDownRight, Equal, Info } from 'lucide-react';

interface LHSRHSProgressComparisonProps {
  actualRows: ActualDPRRow[];
  baseline?: ProjectBaseline;
  selectedActivities?: ActivityType[];
  globalSide?: HighwaySide;
}

export const LHSRHSProgressComparison: React.FC<LHSRHSProgressComparisonProps> = ({
  actualRows,
  baseline,
  selectedActivities,
  globalSide = 'Both'
}) => {
  const [metricMode, setMetricMode] = useState<MetricMode>('quantity');
  const [hoveredActivity, setHoveredActivity] = useState<string | null>(null);

  // Compute metrics across both LHS and RHS rows
  const allMetrics = useMemo(() => {
    return computeActivityProgressMetrics(actualRows, baseline, 'Both');
  }, [actualRows, baseline]);

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

  return (
    <Card className="h-full bg-[#14171C] border border-white/[0.08] shadow-2xl flex flex-col font-sans select-none">
      <CardHeader
        className="pb-3 border-b border-white/[0.06]"
        action={
          <div className="flex items-center gap-1.5 bg-[#0B0C0E] p-1 rounded-xl border border-white/10 text-xs font-mono">
            <button
              type="button"
              onClick={() => setMetricMode('quantity')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all cursor-pointer font-semibold ${
                metricMode === 'quantity'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Quantity</span>
            </button>
            <button
              type="button"
              onClick={() => setMetricMode('linear')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all cursor-pointer font-semibold ${
                metricMode === 'linear'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Ruler className="w-3.5 h-3.5 text-emerald-400" />
              <span>Linear Length</span>
            </button>
          </div>
        }
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-sm">
            <Split className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold flex items-center gap-1.5">
              <span>Executive Progress Visual 02</span>
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span className="text-slate-400">Side-by-Side Execution Variance</span>
            </div>
            <h3 className="text-base font-bold text-white tracking-tight">
              LHS vs RHS Progress Comparison
            </h3>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-4">
        {/* Subtitle / Legend */}
        <div className="flex items-center justify-between text-xs font-mono bg-[#0B0C0E]/60 px-3 py-1.5 rounded-lg border border-white/5">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400" />
              <span className="text-cyan-300 font-semibold">LHS (Left Carriageway)</span>
            </span>
            <span className="text-slate-600">|</span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />
              <span className="text-emerald-300 font-semibold">RHS (Right Carriageway)</span>
            </span>
          </div>

          <div className="text-[11px] text-slate-400">
            {globalSide !== 'Both' && (
              <span className="text-amber-400 font-medium">
                Highlighting {globalSide} (other side de-emphasized)
              </span>
            )}
          </div>
        </div>

        {/* Grouped Horizontal Bars */}
        <div className="space-y-4 flex-1 flex flex-col justify-around py-1">
          {displayedMetrics.length === 0 ? (
            <div className="p-8 text-center text-slate-500 font-mono text-xs">
              No matching activity data available for the active filters.
            </div>
          ) : (
            displayedMetrics.map(item => {
              const isQuantity = metricMode === 'quantity';
              const unit = isQuantity ? item.unit : item.linearUnit;

              const lhsAchieved = isQuantity ? item.lhsAchievedQuantity : item.lhsAchievedLengthM;
              const lhsTarget = isQuantity ? item.lhsTargetQuantity : item.lhsTargetLengthM;
              const lhsPercent = isQuantity ? item.lhsQuantityPercent : item.lhsLinearPercent;

              const rhsAchieved = isQuantity ? item.rhsAchievedQuantity : item.rhsAchievedLengthM;
              const rhsTarget = isQuantity ? item.rhsTargetQuantity : item.rhsTargetLengthM;
              const rhsPercent = isQuantity ? item.rhsQuantityPercent : item.rhsLinearPercent;

              const diffPP = isQuantity ? item.quantityDiffPP : item.linearDiffPP;

              // Opacity based on global filter
              const isLhsDimmed = globalSide === 'RHS';
              const isRhsDimmed = globalSide === 'LHS';

              const isHovered = hoveredActivity === item.activity;

              return (
                <div
                  key={item.activity}
                  onMouseEnter={() => setHoveredActivity(item.activity)}
                  onMouseLeave={() => setHoveredActivity(null)}
                  className={`p-3 rounded-xl transition-all duration-150 border ${
                    isHovered
                      ? 'bg-white/[0.04] border-cyan-500/30 shadow-lg shadow-black/40'
                      : 'bg-white/[0.015] border-white/5'
                  }`}
                >
                  {/* Top line: Activity & Percentage-Point Difference Indicator */}
                  <div className="flex items-center justify-between text-xs font-mono mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{item.activity}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300 font-semibold">
                        {unit}
                      </span>
                    </div>

                    {/* Difference Pill (Percentage Points) */}
                    <div>
                      {Math.abs(diffPP) < 0.05 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 border border-white/10 text-slate-300">
                          <Equal className="w-3 h-3 text-slate-400" />
                          <span>Parity (0.0%)</span>
                        </span>
                      ) : diffPP > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                          <ArrowUpRight className="w-3 h-3 text-cyan-400" />
                          <span>LHS +{fmt(diffPP, 1)} percentage points</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                          <ArrowDownRight className="w-3 h-3 text-emerald-400" />
                          <span>RHS +{fmt(Math.abs(diffPP), 1)} percentage points</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Paired Bars: LHS on top, RHS on bottom */}
                  <div className="space-y-1.5">
                    {/* LHS Bar */}
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className={`font-semibold ${isLhsDimmed ? 'text-slate-500' : 'text-cyan-300'}`}>
                          LHS Carriageway
                        </span>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className={isLhsDimmed ? 'text-slate-500' : 'text-slate-300'}>
                            {fmt(lhsAchieved, isQuantity && item.activity === 'DBM' ? 2 : 0)} / {fmt(lhsTarget, isQuantity && item.activity === 'DBM' ? 2 : 0)} {unit}
                          </span>
                          <span className={`font-bold font-mono text-xs ${isLhsDimmed ? 'text-slate-500' : 'text-cyan-400'}`}>
                            {fmt(lhsPercent, 1)}%
                          </span>
                        </div>
                      </div>

                      <div className="w-full h-2.5 bg-[#1E232B] rounded-full overflow-hidden border border-white/5">
                        <div
                          style={{ width: `${Math.min(100, Math.max(0, lhsPercent))}%` }}
                          className={`h-full bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full transition-all duration-500 ${
                            isLhsDimmed ? 'opacity-35' : 'opacity-100 shadow-sm shadow-cyan-500/30'
                          }`}
                        />
                      </div>
                    </div>

                    {/* RHS Bar */}
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className={`font-semibold ${isRhsDimmed ? 'text-slate-500' : 'text-emerald-300'}`}>
                          RHS Carriageway
                        </span>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className={isRhsDimmed ? 'text-slate-500' : 'text-slate-300'}>
                            {fmt(rhsAchieved, isQuantity && item.activity === 'DBM' ? 2 : 0)} / {fmt(rhsTarget, isQuantity && item.activity === 'DBM' ? 2 : 0)} {unit}
                          </span>
                          <span className={`font-bold font-mono text-xs ${isRhsDimmed ? 'text-slate-500' : 'text-emerald-400'}`}>
                            {fmt(rhsPercent, 1)}%
                          </span>
                        </div>
                      </div>

                      <div className="w-full h-2.5 bg-[#1E232B] rounded-full overflow-hidden border border-white/5">
                        <div
                          style={{ width: `${Math.min(100, Math.max(0, rhsPercent))}%` }}
                          className={`h-full bg-gradient-to-r from-emerald-600 to-teal-400 rounded-full transition-all duration-500 ${
                            isRhsDimmed ? 'opacity-35' : 'opacity-100 shadow-sm shadow-emerald-500/30'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Executive Footnote */}
        <div className="text-[10px] font-mono text-slate-500 flex items-center justify-between border-t border-white/5 pt-2">
          <span>Side-specific baselines parsed directly from Work Program detail records</span>
          <span className="text-cyan-400/80">Independent Carriageway Analysis</span>
        </div>
      </CardContent>
    </Card>
  );
};

