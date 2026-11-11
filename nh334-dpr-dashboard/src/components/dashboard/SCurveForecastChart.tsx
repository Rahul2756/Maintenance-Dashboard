import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import {
  ActualDPRRow,
  ScheduleMilestones,
  ProjectBaseline,
  CumulativeAchievedQuantities
} from '../../types/dpr';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { TrendingUp, Clock, AlertTriangle, CheckCircle2, Zap } from 'lucide-react';

interface SCurveForecastChartProps {
  actualRows: ActualDPRRow[];
  milestones?: ScheduleMilestones;
  baseline?: ProjectBaseline;
  cumulativeAchieved?: CumulativeAchievedQuantities;
}

export const SCurveForecastChart: React.FC<SCurveForecastChartProps> = ({
  actualRows,
  milestones,
  baseline,
  cumulativeAchieved
}) => {
  // Milestone timeline specifications according to contractual Baseline Schedule
  const milestoneTimeline = useMemo(() => {
    return [
      { label: '15-Oct', plannedPct: 1.6, dayOffset: 2 },
      { label: '23-Oct', plannedPct: 8.25, dayOffset: 10 },
      { label: '31-Oct', plannedPct: 14.9, dayOffset: 18 },
      { label: '15-Nov', plannedPct: 29.7, dayOffset: 33 },
      { label: '30-Nov', plannedPct: 48.0, dayOffset: 48 },
      { label: '15-Dec', plannedPct: 73.7, dayOffset: 63 },
      { label: '31-Dec', plannedPct: 99.0, dayOffset: 79 },
      { label: '15-Jan', plannedPct: 100.0, dayOffset: 94 },
      { label: '31-Jan', plannedPct: 100.0, dayOffset: 110 }
    ];
  }, []);

  // Compute dynamic actual progress and pace forecasting
  const forecastMetrics = useMemo(() => {
    const daysElapsed = Math.max(1, milestones?.daysElapsed || 10);
    const targetDaysRemaining = Math.max(1, milestones?.daysRemaining || 69);

    // Calculate actual cumulative % from DPR data
    // Contractual weight benchmark: 2.4% physical completion as of 23.10.2026
    let currentActualPct = 2.4;
    let oct15ActualPct = 0.1;

    if (baseline && baseline.totalMillingTargetSqm > 0 && cumulativeAchieved) {
      // Physical progress weighted across main layers
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

    // Daily pace (run rate % per day)
    const dailyPace = currentActualPct / daysElapsed;
    const remainingPct = Math.max(0, 100 - currentActualPct);
    const daysToComplete = dailyPace > 0 ? Math.round(remainingPct / dailyPace) : 410;

    // Projected Finish Date calculation from current report date (23.10.2026)
    const reportDate = new Date(2026, 9, 23); // 23 Oct 2026
    const projectedFinishDate = new Date(reportDate.getTime() + daysToComplete * 86400000);

    const contractCompletionDate = new Date(2026, 11, 31); // 31 Dec 2026
    const isDelayed = projectedFinishDate.getTime() > contractCompletionDate.getTime();

    const formatShortDate = (d: Date): string => {
      const day = String(d.getDate()).padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${day}-${months[d.getMonth()]}-${d.getFullYear()}`;
    };

    const projectedDateStr = formatShortDate(projectedFinishDate);

    // Required daily pace to finish by 31-Dec-2026
    const requiredPaceDaily = remainingPct / targetDaysRemaining;
    const paceMultiplier = dailyPace > 0 ? (requiredPaceDaily / dailyPace).toFixed(1) : '5.9';

    // Variance at report date (23-Oct): Actual vs Planned (8.25%)
    const currentPlannedPct = 8.25;
    const scheduleVariancePct = currentActualPct - currentPlannedPct;

    return {
      currentActualPct,
      oct15ActualPct,
      dailyPace,
      remainingPct,
      daysToComplete,
      projectedDateStr,
      isDelayed,
      requiredPaceDaily,
      paceMultiplier,
      scheduleVariancePct
    };
  }, [milestones, baseline, cumulativeAchieved, actualRows]);

  // Build ECharts Series Data
  const categories = milestoneTimeline.map(m => m.label);
  const plannedData = milestoneTimeline.map(m => m.plannedPct);

  // Actual S-Curve (Plotted up to latest DPR report date '23-Oct')
  const actualData: (number | null)[] = milestoneTimeline.map(m => {
    if (m.label === '15-Oct') return forecastMetrics.oct15ActualPct;
    if (m.label === '23-Oct') return forecastMetrics.currentActualPct;
    return null;
  });

  // Pace Forecast Line (Dashed continuation line starting from '23-Oct' onwards)
  const forecastData: (number | null)[] = milestoneTimeline.map(m => {
    if (m.dayOffset < 10) return null;
    if (m.dayOffset === 10) return forecastMetrics.currentActualPct;
    const daysSinceReport = m.dayOffset - 10;
    const projected = forecastMetrics.currentActualPct + daysSinceReport * forecastMetrics.dailyPace;
    return Math.min(100, Math.round(projected * 10) / 10);
  });

  // ECharts Configuration
  const option: echarts.EChartsOption = {
    backgroundColor: 'transparent',
    grid: {
      top: 36,
      right: 20,
      bottom: 48,
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
        let content = `<div class="font-mono text-xs font-bold text-white border-b border-white/10 pb-1.5 mb-2">${date} Progress Comparison</div>`;

        params.forEach((p: any) => {
          if (p.value !== null && p.value !== undefined) {
            content += `
              <div class="flex items-center justify-between gap-4 py-0.5 text-xs">
                <span class="flex items-center gap-1.5" style="color: ${p.color}">
                  <span class="inline-block w-2 h-2 rounded-full" style="background-color: ${p.color}"></span>
                  ${p.seriesName}:
                </span>
                <span class="font-mono font-bold text-white">${Number(p.value).toFixed(1)}%</span>
              </div>
            `;
          }
        });

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
      data: ['Planned Target (%)', 'Actual Achieved (%)', 'Pace Forecast (Dotted)']
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
        interval: 'auto',
        hideOverlap: true,
        rotate: categories.length > 12 ? 35 : 0,
        showMinLabel: true,
        showMaxLabel: true,
        margin: 10
      }
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      interval: 20,
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
      // 1. Planned S-Curve (Solid Blue Line)
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
      // 2. Actual S-Curve (Solid Red / Neon Rose Line)
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
            formatter: `${forecastMetrics.currentActualPct}%`,
            fontSize: 9,
            fontWeight: 'bold',
            color: '#FFFFFF',
            offset: [0, -2]
          },
          data: [
            {
              name: 'Latest Actual',
              coord: ['23-Oct', forecastMetrics.currentActualPct]
            }
          ]
        }
      },
      // 3. Pace Forecast Line (Dotted / Dashed Continuation Line)
      {
        name: 'Pace Forecast (Dotted)',
        type: 'line',
        smooth: 0.35,
        symbol: 'circle',
        symbolSize: 5,
        showSymbol: true,
        itemStyle: {
          color: '#F43F5E',
          borderColor: '#FFFFFF',
          borderWidth: 1
        },
        lineStyle: {
          color: '#F43F5E',
          width: 2.2,
          type: 'dashed',
          dashOffset: 4,
          shadowColor: 'rgba(244, 63, 94, 0.4)',
          shadowBlur: 6
        },
        data: forecastData,
        markLine: {
          symbol: ['none', 'none'],
          silent: true,
          data: [
            {
              xAxis: '31-Dec',
              lineStyle: {
                color: '#10B981',
                type: 'dotted',
                width: 1.5
              },
              label: {
                formatter: 'Contract Finish\n(31 Dec)',
                position: 'insideEndTop',
                color: '#10B981',
                fontSize: 9,
                fontWeight: 'bold'
              }
            }
          ]
        }
      }
    ]
  };

  return (
    <Card className="h-full flex flex-col bg-[#16181D]/80 backdrop-blur-md border border-white/5 rounded-2xl p-5 justify-between">
      {/* Card Header with Forecast Status Badge */}
      <CardHeader
        className="p-0 pb-3 border-b border-white/[0.04]"
        action={
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono font-bold shadow-sm ${
              forecastMetrics.isDelayed
                ? 'text-rose-400 bg-rose-950/40 border-rose-800/40'
                : 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40'
            }`}
          >
            {forecastMetrics.isDelayed ? (
              <Clock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            )}
            <span>Forecasted Finish: {forecastMetrics.projectedDateStr}</span>
          </div>
        }
      >
        <CardTitle icon={<TrendingUp className="w-4 h-4 text-blue-400" />}>
          S-Curve: Planned vs Actual (Cum. %)
        </CardTitle>
        <p className="text-xs text-slate-400">
          Cumulative milestone progress with trendline completion forecast
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

      {/* Footer Key Micro-Metrics Bar */}
      <div className="mt-3 pt-3 border-t border-white/[0.06] grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        {/* Metric 1: Current Run Rate */}
        <div className="bg-[#121316] p-2 rounded-xl border border-white/5 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">Current Pace</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="font-mono font-extrabold text-cyan-300">
              {forecastMetrics.dailyPace.toFixed(2)}%
            </span>
            <span className="text-[10px] text-slate-400">/ day</span>
          </div>
        </div>

        {/* Metric 2: Required Pace */}
        <div className="bg-[#121316] p-2 rounded-xl border border-white/5 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">Required Pace</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="font-mono font-extrabold text-amber-300">
              {forecastMetrics.requiredPaceDaily.toFixed(2)}%
            </span>
            <span className="text-[10px] text-slate-400">/ day</span>
          </div>
        </div>

        {/* Metric 3: Schedule Variance */}
        <div className="bg-[#121316] p-2 rounded-xl border border-white/5 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">Schedule Slip</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="font-mono font-extrabold text-rose-400">
              {forecastMetrics.scheduleVariancePct.toFixed(1)}%
            </span>
            <span className="text-[10px] text-rose-300 font-medium">lag</span>
          </div>
        </div>

        {/* Metric 4: Pace Deficit Ramp */}
        <div className="bg-[#121316] p-2 rounded-xl border border-white/5 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">Ramp Needed</span>
          <div className="flex items-center gap-1 mt-0.5">
            <Zap className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="font-mono font-extrabold text-white">
              {forecastMetrics.paceMultiplier}x
            </span>
            <span className="text-[10px] text-slate-400">speed</span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default SCurveForecastChart;
