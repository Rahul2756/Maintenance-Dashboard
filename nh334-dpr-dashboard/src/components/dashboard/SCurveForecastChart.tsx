import React, { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  ActualDPRRow,
  ScheduleMilestones,
  ProjectBaseline,
  CumulativeAchievedQuantities
} from '../../types/dpr';
import {
  type DailyPlannedTargetsByActivity,
  type SCurveActivity
} from '../../utils/dailyPlannedTargetsData';
import {
  computeActivityPaceAndForecast,
  buildForecastChartOption
} from '../../utils/paceForecastUtils';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { TrendingUp, Clock, AlertTriangle, CheckCircle2, Zap } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface SCurveForecastChartProps {
  actualRows: ActualDPRRow[];
  milestones?: ScheduleMilestones;
  baseline?: ProjectBaseline;
  cumulativeAchieved?: CumulativeAchievedQuantities;
  dailyPlannedTargets?: Record<string, DailyPlannedTargetsByActivity>;
  availableDates?: string[];
  selectedDate?: string;
  side?: 'LHS' | 'RHS' | 'Both';
}

const FORECAST_ACTIVITIES: readonly SCurveActivity[] = [
  'Milling',
  'Tackcoat (DBM)',
  'DBM',
  'Tackcoat (BC)',
  'BC'
];

export const SCurveForecastChart: React.FC<SCurveForecastChartProps> = ({
  actualRows,
  milestones,
  baseline,
  dailyPlannedTargets,
  availableDates = [],
  selectedDate,
  side = 'Both'
}) => {
  const { theme, isLight } = useTheme();
  const [selectedActivity, setSelectedActivity] = useState<SCurveActivity>('Milling');

  const fallbackLatest =
    availableDates.length > 0
      ? availableDates[availableDates.length - 1]
      : (milestones?.reportDate || '08.11.2026');
  const effectiveReportDate = selectedDate || milestones?.reportDate || fallbackLatest;

  const model = useMemo(
    () =>
      computeActivityPaceAndForecast({
        activity: selectedActivity,
        actualRows,
        dailyPlannedTargets,
        baseline,
        reportDate: effectiveReportDate,
        startDate: milestones?.startDate || '13.10.2026',
        side
      }),
    [selectedActivity, actualRows, dailyPlannedTargets, baseline, effectiveReportDate, milestones?.startDate, side]
  );

  const option = useMemo(
    () => buildForecastChartOption(model, selectedActivity, false, theme),
    [model, selectedActivity, theme]
  );

  const slipAbs = Math.abs(model.scheduleSlipPct).toFixed(1);
  const slipStatus =
    model.scheduleSlipPct > 0.05
      ? 'ahead'
      : model.scheduleSlipPct < -0.05
      ? 'behind'
      : 'on track';

  return (
    <Card className="h-full flex flex-col bg-[#16181D]/80 backdrop-blur-md border border-white/5 rounded-2xl p-5 justify-between">
      {/* Card Header: Title + 5 Activity Tabs + Forecasted Finish Badge */}
      <CardHeader
        className="p-0 pb-3 border-b border-white/[0.04] flex-wrap gap-3"
        action={
          <div className="flex items-center gap-2.5 flex-wrap justify-end">
            {/* 5 Independent Activity Selector Tabs */}
            <div className="flex items-center bg-[#121316] p-0.5 rounded-xl border border-white/10 text-xs font-medium overflow-x-auto">
              {FORECAST_ACTIVITIES.map(act => (
                <button
                  key={act}
                  type="button"
                  onClick={() => setSelectedActivity(act)}
                  data-on-accent={isLight && selectedActivity === act ? 'true' : undefined}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    selectedActivity === act
                      ? isLight
                        ? 'bg-[#07966D] text-white font-bold shadow-sm'
                        : 'bg-blue-500/25 text-blue-300 font-bold border border-blue-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {act}
                </button>
              ))}
            </div>

            {/* Forecast Completion Indicator */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono font-bold shadow-sm ${
                !model.hasSufficientData
                  ? 'text-amber-300 bg-amber-950/40 border-amber-700/40'
                  : model.isDelayed
                  ? 'text-rose-400 bg-rose-950/40 border-rose-800/40'
                  : 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40'
              }`}
            >
              {!model.hasSufficientData ? (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              ) : model.isDelayed ? (
                <Clock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              )}
              <span>
                {model.hasSufficientData
                  ? `Forecasted Finish: ${model.projectedDateStr}`
                  : model.projectedDateStr}
              </span>
            </div>
          </div>
        }
      >
        <CardTitle icon={<TrendingUp className="w-4 h-4 text-blue-400" />}>
          S-Curve: Planned vs Actual (Cum. %) — {selectedActivity}
        </CardTitle>
        <p className="text-xs text-slate-400">
          Cumulative milestone progress ({model.unit}) with independent activity pace completion forecast
        </p>
      </CardHeader>

      {/* Main Chart Area */}
      <CardContent className="flex-1 p-0 pt-3 min-h-[290px]">
        <ReactECharts
          option={option}
          style={{ height: '100%', minHeight: '280px', width: '100%' }}
          notMerge={true}
          opts={{ renderer: 'svg' }}
        />
      </CardContent>

      {/* Footer Key Micro-Metrics Bar (4 Activity-Dependent KPI Cards) */}
      <div className="mt-3 pt-3 border-t border-white/[0.06] grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        {/* Metric 1: Current Run Rate */}
        <div className="bg-[#121316] p-2.5 rounded-xl border border-white/5 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">Current Pace</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="font-mono font-extrabold text-cyan-300">
              {model.currentPaceDaily.toFixed(2)}%
            </span>
            <span className="text-[10px] text-slate-400">/ day</span>
          </div>
        </div>

        {/* Metric 2: Required Pace */}
        <div className="bg-[#121316] p-2.5 rounded-xl border border-white/5 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">Required Pace</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="font-mono font-extrabold text-amber-300">
              {model.requiredPaceDaily.toFixed(2)}%
            </span>
            <span className="text-[10px] text-slate-400">/ day</span>
          </div>
        </div>

        {/* Metric 3: Schedule Slip */}
        <div className="bg-[#121316] p-2.5 rounded-xl border border-white/5 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">Schedule Slip</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span
              className={`font-mono font-extrabold ${
                slipStatus === 'ahead'
                  ? 'text-emerald-400'
                  : slipStatus === 'behind'
                  ? 'text-rose-400'
                  : 'text-slate-200'
              }`}
            >
              {model.scheduleSlipPct > 0.05 ? '+' : model.scheduleSlipPct < -0.05 ? '-' : ''}
              {slipAbs}%
            </span>
            <span
              className={`text-[10px] font-medium ${
                slipStatus === 'ahead'
                  ? 'text-emerald-300'
                  : slipStatus === 'behind'
                  ? 'text-rose-300'
                  : 'text-slate-400'
              }`}
            >
              {slipStatus}
            </span>
          </div>
        </div>

        {/* Metric 4: Pace Deficit Ramp */}
        <div className="bg-[#121316] p-2.5 rounded-xl border border-white/5 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">Ramp Needed</span>
          <div className="flex items-center gap-1 mt-0.5">
            <Zap className="w-3 h-3 text-amber-400 shrink-0" />
            {model.rampMultiplier !== null ? (
              <>
                <span className="font-mono font-extrabold text-white">
                  {model.rampMultiplier.toFixed(1)}x
                </span>
                <span className="text-[10px] text-slate-400">speed</span>
              </>
            ) : (
              <span className="font-mono font-extrabold text-slate-400">
                N/A <span className="text-[10px] font-normal">(no actuals)</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default SCurveForecastChart;
