import React, { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import {
  ActualDPRRow,
  ScheduleMilestones,
  ProjectBaseline,
  CumulativeAchievedQuantities,
  DailyProgressComparison
} from '../../types/dpr';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { TrendingUp, AlertTriangle, Calendar, Layers } from 'lucide-react';

interface SCurveActualChartProps {
  actualRows: ActualDPRRow[];
  milestones?: ScheduleMilestones;
  baseline?: ProjectBaseline;
  cumulativeAchieved?: CumulativeAchievedQuantities;
  dailyComparisons?: DailyProgressComparison[];
  availableDates?: string[];
}

export const SCurveActualChart: React.FC<SCurveActualChartProps> = ({
  actualRows,
  milestones,
  baseline,
  cumulativeAchieved,
  dailyComparisons = [],
  availableDates = []
}) => {
  // Toggle between Daily progression (14-23 Oct) and Contractual Milestones (15 & 23 Oct)
  const [viewMode, setViewMode] = useState<'daily' | 'milestones'>('daily');
  // Toggle between Focused Y-Axis (0-12%) and Full Contractual Axis (0-100%)
  const [yAxisMode, setYAxisMode] = useState<'focus' | 'full'>('focus');

  // Compute dynamic actual progress up to latest DPR report date (23.10.2026)
  const metrics = useMemo(() => {
    const daysElapsed = Math.max(1, milestones?.daysElapsed || 10);

    // Calculate actual cumulative % from DPR data
    let currentActualPct = 4.6;
    let oct15ActualPct = 0.2;

    if (baseline && baseline.totalMillingTargetSqm > 0 && cumulativeAchieved) {
      const millingWeight = 0.35;
      const dbmWeight = 0.45;
      const bcWeight = 0.20;

      const millingRatio = cumulativeAchieved.millingSqm / baseline.totalMillingTargetSqm;
      const dbmRatio = cumulativeAchieved.dbmCum / baseline.totalDbmTargetCum;
      const bcRatio = (cumulativeAchieved.bcCum || 0) / (baseline.totalBcTargetCum || 39171.5);

      const calculated = (millingRatio * millingWeight + dbmRatio * dbmWeight + bcRatio * bcWeight) * 100;
      if (calculated > 0) {
        currentActualPct = Math.round(calculated * 10) / 10;
      }
    }

    // Daily pace
    const dailyPace = currentActualPct / daysElapsed;
    const currentPlannedPct = 8.25; // Contractual milestone at 23-Oct
    const scheduleVariancePct = currentActualPct - currentPlannedPct;

    return {
      currentActualPct,
      oct15ActualPct,
      currentPlannedPct,
      dailyPace,
      scheduleVariancePct
    };
  }, [milestones, baseline, cumulativeAchieved, actualRows]);

  // Chart data calculations
  const { categories, plannedData, actualData } = useMemo(() => {
    if (viewMode === 'milestones') {
      // Contractual Milestones strictly up to latest actual report date
      const cats = ['15-Oct', '23-Oct'];
      const plan = [1.6, 8.25];
      const act = [metrics.oct15ActualPct, metrics.currentActualPct];
      return { categories: cats, plannedData: plan, actualData: act };
    }

    // Daily DPR progression strictly till actual completed date (14 Oct – 23 Oct)
    const dates = availableDates.length > 0
      ? availableDates
      : ['14.10.2026', '15.10.2026', '16.10.2026', '17.10.2026', '18.10.2026', '19.10.2026', '20.10.2026', '21.10.2026', '22.10.2026', '23.10.2026'];

    const cats: string[] = [];
    const plan: number[] = [];
    const act: number[] = [];

    // Milestone reference: Day 1 (14 Oct) to Day 10 (23 Oct = 8.25%)
    const totalDays = dates.length;
    let accumulatedActualCum = 0;
    const totalActualDbmCum = 1451.25;

    dates.forEach((d, idx) => {
      const [dayNum, monthNum] = d.split('.');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthLabel = months[Number(monthNum) - 1] || 'Oct';
      cats.push(`${dayNum}-${monthLabel}`);

      // Contractual Planned S-curve interpolation from 0.8% up to 8.25%
      // 14-Oct: 0.8%, 15-Oct: 1.6% ... 23-Oct: 8.25%
      const dayFactor = (idx + 1) / totalDays;
      // Realistic S-curve weighting across the initial 10 days
      const sFactor = Math.pow(dayFactor, 1.25);
      const plannedVal = Number((sFactor * 8.25).toFixed(2));
      plan.push(plannedVal);

      // Actual daily accumulation in Cum
      const dayComp = dailyComparisons.find(c => c.date === d);
      if (dayComp) {
        accumulatedActualCum += dayComp.dbmAchieved;
      } else {
        const dayRows = actualRows.filter(r => r.date === d && r.activity === 'DBM');
        const daySum = dayRows.reduce((acc, r) => acc + (r.achievedToday || 0), 0);
        accumulatedActualCum += daySum;
      }

      const ratio = totalActualDbmCum > 0 ? Math.min(1, accumulatedActualCum / totalActualDbmCum) : dayFactor;
      const actualVal = Number((ratio * metrics.currentActualPct).toFixed(2));
      act.push(actualVal);
    });

    // Anchor exact final actual value to 23-Oct
    if (act.length > 0) {
      act[act.length - 1] = metrics.currentActualPct;
      plan[plan.length - 1] = 8.25;
    }

    return { categories: cats, plannedData: plan, actualData: act };
  }, [viewMode, availableDates, dailyComparisons, actualRows, metrics]);

  // ECharts Configuration strictly showing Plan vs Actual (NO forecast series)
  const option: echarts.EChartsOption = {
    backgroundColor: 'transparent',
    grid: {
      top: 36,
      right: 20,
      bottom: 40,
      left: 45,
      containLabel: true
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0F1218',
      borderColor: 'rgba(255, 255, 255, 0.15)',
      borderWidth: 1,
      padding: [10, 14],
      textStyle: {
        color: '#FFFFFF',
        fontSize: 11
      },
      axisPointer: {
        type: 'cross',
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.25)',
          type: 'dashed'
        }
      },
      formatter: (params: any) => {
        if (!Array.isArray(params) || params.length === 0) return '';
        const date = params[0].name;
        let content = `<div class="font-mono text-xs font-bold text-white border-b border-white/10 pb-1.5 mb-2">${date} Cumulative Progress</div>`;

        params.forEach((p: any) => {
          if (p.value !== null && p.value !== undefined) {
            content += `
              <div class="flex items-center justify-between gap-4 py-0.5 text-xs">
                <span class="flex items-center gap-1.5" style="color: ${p.color}">
                  <span class="inline-block w-2 h-2 rounded-full" style="background-color: ${p.color}"></span>
                  ${p.seriesName}:
                </span>
                <span class="font-mono font-bold text-white">${Number(p.value).toFixed(2)}%</span>
              </div>
            `;
          }
        });

        if (params.length >= 2) {
          const planVal = Number(params[0].value || 0);
          const actVal = Number(params[1].value || 0);
          const diff = actVal - planVal;
          const diffColor = diff >= 0 ? '#10B981' : '#F43F5E';
          content += `
            <div class="border-t border-white/10 pt-1.5 mt-1.5 flex items-center justify-between text-xs font-mono">
              <span class="text-slate-400">Variance:</span>
              <span style="color: ${diffColor}; font-weight: bold;">${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%</span>
            </div>
          `;
        }

        return content;
      }
    },
    legend: {
      top: 0,
      right: 0,
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: {
        color: '#94A3B8',
        fontSize: 11
      },
      data: ['Planned Target (%)', 'Actual Achieved (%)']
    },
    xAxis: {
      type: 'category',
      data: categories,
      boundaryGap: false,
      axisLine: {
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      },
      axisTick: {
        alignWithLabel: true,
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      },
      axisLabel: {
        color: '#94A3B8',
        fontSize: 10,
        fontFamily: 'monospace',
        interval: 0,
        rotate: 0
      }
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: yAxisMode === 'full' ? 100 : 10,
      interval: yAxisMode === 'full' ? 20 : 2,
      axisLabel: {
        formatter: '{value}%',
        color: '#94A3B8',
        fontSize: 10,
        fontFamily: 'monospace'
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.06)',
          type: 'dashed'
        }
      }
    },
    series: [
      // 1. Planned S-Curve (Solid Blue Line with subtle gradient fill)
      {
        name: 'Planned Target (%)',
        type: 'line',
        smooth: 0.35,
        symbol: 'circle',
        symbolSize: 6,
        showSymbol: true,
        itemStyle: {
          color: '#3B82F6',
          borderColor: '#FFFFFF',
          borderWidth: 1.5
        },
        lineStyle: {
          color: '#3B82F6',
          width: 2.5,
          shadowColor: 'rgba(59, 130, 246, 0.4)',
          shadowBlur: 6
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(59, 130, 246, 0.22)' },
            { offset: 1, color: 'rgba(59, 130, 246, 0.0)' }
          ])
        },
        data: plannedData
      },
      // 2. Actual Achieved S-Curve (Solid Red / Neon Rose Line)
      {
        name: 'Actual Achieved (%)',
        type: 'line',
        smooth: 0.35,
        symbol: 'diamond',
        symbolSize: 8,
        showSymbol: true,
        itemStyle: {
          color: '#EF4444',
          borderColor: '#FFFFFF',
          borderWidth: 2
        },
        lineStyle: {
          color: '#EF4444',
          width: 3.2,
          shadowColor: 'rgba(239, 68, 68, 0.6)',
          shadowBlur: 8
        },
        data: actualData,
        markPoint: {
          symbol: 'pin',
          symbolSize: 38,
          itemStyle: {
            color: '#EF4444',
            shadowColor: 'rgba(239, 68, 68, 0.8)',
            shadowBlur: 10
          },
          label: {
            formatter: `${metrics.currentActualPct}%`,
            fontSize: 9,
            fontWeight: 'bold',
            color: '#FFFFFF',
            offset: [0, -2]
          },
          data: [
            {
              name: 'Latest Actual',
              coord: [categories[categories.length - 1], metrics.currentActualPct]
            }
          ]
        }
      }
      // Note: Pace Forecast series and Contract Finish line are completely eliminated
    ]
  };

  return (
    <Card className="h-full flex flex-col bg-[#16181D]/80 backdrop-blur-md border border-white/5 rounded-2xl p-5 justify-between">
      {/* Card Header with Execution Status Badge & View Controls */}
      <CardHeader
        className="p-0 pb-3 border-b border-white/[0.04]"
        action={
          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Toggle: Daily vs Milestones */}
            <div className="flex items-center bg-[#121316] p-0.5 rounded-lg border border-white/10 text-[11px] font-mono">
              <button
                onClick={() => setViewMode('daily')}
                className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                  viewMode === 'daily'
                    ? 'bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Daily cumulative progression (14 to 23 Oct)"
              >
                Daily (10 Days)
              </button>
              <button
                onClick={() => setViewMode('milestones')}
                className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                  viewMode === 'milestones'
                    ? 'bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Contractual milestone points to date"
              >
                Milestones
              </button>
            </div>

            {/* Y-Axis Scale Toggle: Focused (0-12%) vs Full (0-100%) */}
            <div className="flex items-center bg-[#121316] p-0.5 rounded-lg border border-white/10 text-[11px] font-mono">
              <button
                onClick={() => setYAxisMode(yAxisMode === 'focus' ? 'full' : 'focus')}
                className="px-2 py-0.5 rounded text-slate-300 hover:text-white transition-all cursor-pointer"
                title="Toggle Y-Axis range between 0-10% and 0-100%"
              >
                Axis: {yAxisMode === 'focus' ? '0–10%' : '0–100%'}
              </button>
            </div>

            {/* Execution Status Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono font-bold shadow-sm text-rose-400 bg-rose-950/40 border-rose-800/40">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>Actual: {metrics.currentActualPct}% vs Plan: {metrics.currentPlannedPct}%</span>
            </div>
          </div>
        }
      >
        <CardTitle icon={<TrendingUp className="w-4 h-4 text-blue-400" />}>
          S-Curve: Planned vs Actual (Execution To-Date)
        </CardTitle>
        <p className="text-xs text-slate-400">
          Cumulative progress comparison strictly up to actual completed date (14–23 Oct) • No Forecast
        </p>
      </CardHeader>

      {/* Main Chart Area */}
      <CardContent className="flex-1 p-0 pt-3 min-h-[250px]">
        <ReactECharts
          option={option}
          style={{ height: '100%', minHeight: '240px', width: '100%' }}
          notMerge={true}
          opts={{ renderer: 'svg' }}
        />
      </CardContent>

      {/* Footer Key Execution Micro-Metrics Bar */}
      <div className="mt-3 pt-3 border-t border-white/[0.06] grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        {/* Metric 1: Current Run Rate */}
        <div className="bg-[#121316] p-2 rounded-xl border border-white/5 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">Current Pace</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="font-mono font-extrabold text-cyan-300">
              {metrics.dailyPace.toFixed(2)}%
            </span>
            <span className="text-[10px] text-slate-400">/ day</span>
          </div>
        </div>

        {/* Metric 2: Planned Milestone Target */}
        <div className="bg-[#121316] p-2 rounded-xl border border-white/5 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">Planned Target</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="font-mono font-extrabold text-blue-400">
              {metrics.currentPlannedPct}%
            </span>
            <span className="text-[10px] text-slate-400">to date</span>
          </div>
        </div>

        {/* Metric 3: Actual Completed */}
        <div className="bg-[#121316] p-2 rounded-xl border border-white/5 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">Actual Completed</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="font-mono font-extrabold text-rose-400">
              {metrics.currentActualPct}%
            </span>
            <span className="text-[10px] text-slate-400">achieved</span>
          </div>
        </div>

        {/* Metric 4: Schedule Slip */}
        <div className="bg-[#121316] p-2 rounded-xl border border-white/5 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">Schedule Slip</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="font-mono font-extrabold text-rose-400">
              {metrics.scheduleVariancePct.toFixed(1)}%
            </span>
            <span className="text-[10px] text-rose-300 font-medium">lag</span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default SCurveActualChart;

