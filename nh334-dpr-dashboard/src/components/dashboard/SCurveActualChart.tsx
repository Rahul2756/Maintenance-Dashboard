import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import {
  ActualDPRRow,
  ScheduleMilestones,
  ProjectBaseline,
  CumulativeAchievedQuantities,
  DailyProgressComparison
} from '../../types/dpr';
import {
  DEFAULT_DAILY_PLANNED_TARGETS,
  CONTRACTUAL_TARGETS_5,
  type DailyPlannedTargetsByActivity,
  type SCurveActivity
} from '../../utils/dailyPlannedTargetsData';
import { Card, CardContent } from '../ui/Card';
import { TrendingUp, AlertTriangle } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { getChartThemeTokens } from '../../utils/chartTheme';
import { dmyToIsoSafe } from '../../context/FilterContext';

interface SCurveActualChartProps {
  actualRows: ActualDPRRow[];
  milestones?: ScheduleMilestones;
  baseline?: ProjectBaseline;
  cumulativeAchieved?: CumulativeAchievedQuantities;
  dailyComparisons?: DailyProgressComparison[];
  availableDates?: string[];
  dailyPlannedTargets?: Record<string, DailyPlannedTargetsByActivity>;
  dateRange?: { start: string; end: string };
}

export const SCurveActualChart: React.FC<SCurveActualChartProps> = ({
  actualRows,
  availableDates = [],
  dailyPlannedTargets,
  baseline,
  dateRange
}) => {
  const { theme, isLight } = useTheme();
  const tk = getChartThemeTokens(theme);
  // Activity selector with exactly FIVE independent options (default: Milling)
  const [selectedActivity, setSelectedActivity] = useState<SCurveActivity>('Milling');
  const [frozenState, setFrozenState] = useState<{ index: number; rangeKey: string } | null>(null);
  const [frozenPos, setFrozenPos] = useState<{ x: number; y: number } | null>(null);
  const chartRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastHoveredIndexRef = useRef<number | null>(null);

  // Toggle between Daily progression and Contractual Milestones
  const [viewMode, setViewMode] = useState<'daily' | 'milestones'>('daily');
  // Toggle between Focused Y-Axis (0-15%) and Full Contractual Axis (0-100%)
  const [yAxisMode, setYAxisMode] = useState<'focus' | 'full'>('focus');

  // Exact 5-activity matching rule against Chainage Log records
  const matchesActivity = (r: ActualDPRRow, act: SCurveActivity): boolean => {
    const raw = String(r.rawActivity || r.activity || '').trim().toLowerCase();
    if (act === 'Milling') {
      return raw.includes('milling');
    }
    if (act === 'Tackcoat (DBM)') {
      return raw.includes('tack') && !raw.includes('bc');
    }
    if (act === 'DBM') {
      return raw.includes('dbm') && !raw.includes('tack');
    }
    if (act === 'Tackcoat (BC)') {
      return raw.includes('tack') && raw.includes('bc');
    }
    if (act === 'BC') {
      return (raw.includes('bc') || raw.includes('bituminous')) && !raw.includes('tack');
    }
    return false;
  };

  // Activity target and unit dynamically reflecting state baseline
  const targetInfo = CONTRACTUAL_TARGETS_5[selectedActivity] || { target: 681284, unit: 'Sqm' };
  const unit = targetInfo.unit;

  const totalActivityTarget = useMemo(() => {
    if (baseline) {
      if (selectedActivity === 'Milling') return baseline.totalMillingTargetSqm;
      if (selectedActivity === 'Tackcoat (DBM)') return Number(((baseline.totalTackcoatTargetSqm || 1848270.5) * (681283.75 / 1848270.5)).toFixed(1));
      if (selectedActivity === 'Tackcoat (BC)') return Number(((baseline.totalTackcoatTargetSqm || 1848270.5) * (1166986.75 / 1848270.5)).toFixed(1));
      if (selectedActivity === 'DBM') return baseline.totalDbmTargetCum;
      if (selectedActivity === 'BC') return baseline.totalBcTargetCum || 46679.48;
    }
    return targetInfo.target;
  }, [baseline, selectedActivity, targetInfo.target]);

  // Active planned target dictionary (pre-computed SSOT fallback merged with dynamic Excel fetch)
  const plannedMap = useMemo(() => {
    return dailyPlannedTargets && Object.keys(dailyPlannedTargets).length > 0
      ? dailyPlannedTargets
      : DEFAULT_DAILY_PLANNED_TARGETS;
  }, [dailyPlannedTargets]);

  // Pre-index planned entries with timestamps for running cumulative calculation
  const plannedEntries = useMemo(() => {
    return Object.entries(plannedMap).map(([k, v]) => {
      const parts = k.split('.');
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);
      return {
        dateStr: k,
        time: new Date(y, m, d).getTime(),
        qty: v[selectedActivity] || 0
      };
    });
  }, [plannedMap, selectedActivity]);

  // Sorted list of unique DPR dates
  const allSortedDates = useMemo(() => {
    const rawDates = availableDates.length > 0
      ? availableDates
      : Array.from(new Set(actualRows.map(r => r.date)));

    return [...rawDates].sort((a, b) => {
      const [d1, m1, y1] = a.split('.').map(Number);
      const [d2, m2, y2] = b.split('.').map(Number);
      return new Date(y1, m1 - 1, d1).getTime() - new Date(y2, m2 - 1, d2).getTime();
    });
  }, [availableDates, actualRows]);

  const startIso = dateRange?.start ? dmyToIsoSafe(dateRange.start) : '';
  const endIso = dateRange?.end ? dmyToIsoSafe(dateRange.end) : '';
  const minIso = startIso && endIso ? (startIso <= endIso ? startIso : endIso) : '';
  const maxIso = startIso && endIso ? (startIso <= endIso ? endIso : startIso) : '';
  const currentRangeKey = `${minIso}|${maxIso}`;
  const frozenIndex = frozenState && frozenState.rangeKey === currentRangeKey ? frozenState.index : null;
  const setFrozenIndex = useCallback((updater: number | null | ((prev: number | null) => number | null)) => {
    setFrozenState(prev => {
      const prevIdx = prev && prev.rangeKey === currentRangeKey ? prev.index : null;
      const nextIdx = typeof updater === 'function' ? updater(prevIdx) : updater;
      return nextIdx === null ? null : { index: nextIdx, rangeKey: currentRangeKey };
    });
  }, [currentRangeKey]);

  const sortedDates = useMemo(() => {
    if (!maxIso) return allSortedDates;
    // Accumulate up to To Date so cumulative progress remains accurate up to To Date
    return allSortedDates.filter(d => dmyToIsoSafe(d) <= maxIso);
  }, [allSortedDates, maxIso]);

  // Running cumulative calculations for the selected activity
  const chartData = useMemo(() => {
    const fullCats: string[] = [];
    const fullPlanPct: number[] = [];
    const fullActPct: number[] = [];
    const fullPlanQty: number[] = [];
    const fullActQty: number[] = [];
    const inRangeIndices: number[] = [];

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let runningActualQty = 0;

    sortedDates.forEach((d, idx) => {
      const [dayNum, monthNum, yearNum] = d.split('.').map(Number);
      const monthLabel = months[monthNum - 1] || 'Oct';
      const cat = `${dayNum}-${monthLabel}`;
      fullCats.push(cat);

      const dIso = dmyToIsoSafe(d);
      if (!minIso || !maxIso || (dIso >= minIso && dIso <= maxIso)) {
        inRangeIndices.push(idx);
      }

      // 1. Cumulative Actual Quantity: sum of daily achieved in Column O up to date d
      const dayRows = actualRows.filter(r => r.date === d && matchesActivity(r, selectedActivity));
      const dayActual = dayRows.reduce((sum, r) => sum + (r.achievedToday || 0), 0);
      runningActualQty += dayActual;
      fullActQty.push(runningActualQty);

      // 2. Cumulative Planned Quantity: sum of all distributed daily planned quantities up to date d
      const dTime = new Date(yearNum, monthNum - 1, dayNum).getTime();
      const cumPlannedQty = plannedEntries
        .filter(p => p.time <= dTime)
        .reduce((sum, p) => sum + p.qty, 0);
      fullPlanQty.push(cumPlannedQty);

      // 3. Percentages relative to contractual target (Column J denominator)
      const planPct = totalActivityTarget > 0 ? Number(((cumPlannedQty / totalActivityTarget) * 100).toFixed(2)) : 0;
      const actPct = totalActivityTarget > 0 ? Number(((runningActualQty / totalActivityTarget) * 100).toFixed(2)) : 0;

      fullPlanPct.push(planPct);
      fullActPct.push(actPct);
    });

    if (viewMode === 'milestones') {
      const milestoneKeys = ['15.10.2026', '23.10.2026', '01.11.2026'];
      const indices: number[] = [];
      milestoneKeys.forEach(k => {
        const idx = sortedDates.indexOf(k);
        if (idx >= 0) indices.push(idx);
      });
      if (indices.length === 0 && sortedDates.length > 0) {
        indices.push(0, sortedDates.length - 1);
      }

      return {
        categories: indices.map(i => fullCats[i]),
        plannedData: indices.map(i => fullPlanPct[i]),
        actualData: indices.map(i => fullActPct[i]),
        plannedQtys: indices.map(i => fullPlanQty[i]),
        actualQtys: indices.map(i => fullActQty[i]),
        allActualPcts: fullActPct,
        allPlannedPcts: fullPlanPct
      };
    }

    const displayIndices = inRangeIndices.length > 0 ? inRangeIndices : fullCats.map((_, i) => i);

    return {
      categories: displayIndices.map(i => fullCats[i]),
      plannedData: displayIndices.map(i => fullPlanPct[i]),
      actualData: displayIndices.map(i => fullActPct[i]),
      plannedQtys: displayIndices.map(i => fullPlanQty[i]),
      actualQtys: displayIndices.map(i => fullActQty[i]),
      allActualPcts: fullActPct,
      allPlannedPcts: fullPlanPct
    };
  }, [sortedDates, actualRows, selectedActivity, plannedEntries, totalActivityTarget, viewMode, minIso, maxIso]);

  // Latest progress metrics for footer cards & header badge
  const metrics = useMemo(() => {
    const totalDays = Math.max(1, sortedDates.length);
    const latestActualPct = chartData.allActualPcts.length > 0
      ? chartData.allActualPcts[chartData.allActualPcts.length - 1]
      : 0;
    const latestPlannedPct = chartData.allPlannedPcts.length > 0
      ? chartData.allPlannedPcts[chartData.allPlannedPcts.length - 1]
      : 0;

    const dailyPace = latestActualPct / totalDays;
    const scheduleVariancePct = latestPlannedPct - latestActualPct; // positive = lag, negative = ahead

    return {
      latestActualPct,
      latestPlannedPct,
      dailyPace,
      scheduleVariancePct
    };
  }, [sortedDates, chartData]);

  // Determine dynamic Y-axis upper limit for focused view mode
  const yAxisMax = useMemo(() => {
    if (yAxisMode === 'full') return 100;
    const peakPct = Math.max(...chartData.plannedData, ...chartData.actualData, 5);
    return Math.max(10, Math.ceil((peakPct * 1.25) / 5) * 5);
  }, [yAxisMode, chartData]);

  // Dismiss frozen tooltip on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFrozenIndex(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Listen to clicks on the chart canvas to freeze/unfreeze tooltips
  useEffect(() => {
    const chartInstance = chartRef.current?.getEchartsInstance();
    if (!chartInstance) return;

    const zr = chartInstance.getZr();
    const handleZrClick = (event: any) => {
      const pointInPixel = [event.offsetX, event.offsetY];
      if (chartInstance.containPixel('grid', pointInPixel)) {
        const pointInGrid = chartInstance.convertFromPixel({ gridIndex: 0 }, pointInPixel);
        const xIdx = Math.round(pointInGrid[0]);
        if (xIdx >= 0 && xIdx < chartData.categories.length) {
          setFrozenIndex(prev => {
            if (prev === xIdx) return null;
            const width = chartInstance.getWidth();
            const height = chartInstance.getHeight();
            const yVal = Math.max(chartData.actualData[xIdx] || 0, chartData.plannedData[xIdx] || 0);
            const [px, py] = chartInstance.convertToPixel({ gridIndex: 0 }, [xIdx, yVal]);
            const tooltipWidth = 270;
            let left = px > width - tooltipWidth - 20 ? px - tooltipWidth - 15 : px + 15;
            left = Math.max(10, Math.min(left, width - tooltipWidth - 10));
            const top = Math.max(10, Math.min(py - 50, height - 210));
            setFrozenPos({ x: left, y: top });
            return xIdx;
          });
        }
      }
    };

    zr.on('click', handleZrClick);
    return () => {
      zr.off('click', handleZrClick);
    };
  }, [chartData, setFrozenIndex]);

  // S-Curve ECharts configuration
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
      show: frozenIndex === null,
      trigger: 'axis',
      enterable: true,
      backgroundColor: isLight ? 'rgba(255, 255, 255, 0.98)' : '#0F1218',
      borderColor: isLight ? '#E2E8F0' : 'rgba(255, 255, 255, 0.15)',
      borderWidth: 1,
      padding: [10, 14],
      textStyle: {
        color: isLight ? '#17212B' : '#FFFFFF',
        fontSize: 11
      },
      axisPointer: {
        type: 'cross',
        lineStyle: {
          color: isLight ? 'rgba(100, 116, 139, 0.35)' : 'rgba(255, 255, 255, 0.25)',
          type: 'dashed'
        }
      },
      formatter: (params: any) => {
        if (!Array.isArray(params) || params.length === 0) return '';
        const dateLabel = params[0].name;
        const dataIdx = params[0].dataIndex;
        lastHoveredIndexRef.current = dataIdx;

        const planPct = chartData.plannedData[dataIdx] !== undefined ? chartData.plannedData[dataIdx] : 0;
        const actPct = chartData.actualData[dataIdx] !== undefined ? chartData.actualData[dataIdx] : 0;
        const planQty = chartData.plannedQtys[dataIdx] !== undefined ? chartData.plannedQtys[dataIdx] : 0;
        const actQty = chartData.actualQtys[dataIdx] !== undefined ? chartData.actualQtys[dataIdx] : 0;

        const variance = actPct - planPct;
        const varColor = variance >= 0 ? (isLight ? '#159B63' : '#10B981') : (isLight ? '#DC4C4C' : '#F43F5E');
        const varSign = variance >= 0 ? '+' : '';
        const tText = isLight ? '#17212B' : '#FFFFFF';
        const tMuted = isLight ? '#64748B' : '#94A3B8';
        const tSub = isLight ? '#475569' : '#E2E8F0';
        const tDiv = isLight ? '#E5E7EB' : 'rgba(255,255,255,0.12)';
        const tPlan = isLight ? '#2563EB' : '#60A5FA';
        const tAct = isLight ? '#DC4C4C' : '#EF4444';
        const tHdrAct = isLight ? '#07966D' : '#93C5FD';

        return `
          <div style="font-family: Inter, sans-serif; font-size: 11px; min-width: 210px;">
            <div style="font-weight: 700; color: ${tText}; border-bottom: 1px solid ${tDiv}; padding-bottom: 4px; margin-bottom: 6px;">
              📅 ${dateLabel} Cumulative Progress
            </div>
            <div style="font-size: 11px; color: ${isLight ? '#07966D' : '#60A5FA'}; font-weight: 600; margin-bottom: 6px;">
              Activity: <span style="color: ${tHdrAct};">${selectedActivity}</span> (${unit})
            </div>
            <div style="display: flex; justify-content: space-between; gap: 12px; margin: 3px 0; font-family: monospace;">
              <span style="color: ${tPlan};">● Planned Target (%):</span>
              <span style="font-weight: 700; color: ${tText};">${planPct.toFixed(2)}%</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 12px; margin: 2px 0 5px 0; font-family: monospace; font-size: 10px; color: ${tMuted};">
              <span>  Cum. Planned Qty:</span>
              <span style="color: ${tSub};">${planQty.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${unit}</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 12px; margin: 3px 0; font-family: monospace;">
              <span style="color: ${tAct};">◆ Actual Achieved (%):</span>
              <span style="font-weight: 700; color: ${tText};">${actPct.toFixed(2)}%</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 12px; margin: 2px 0 5px 0; font-family: monospace; font-size: 10px; color: ${tMuted};">
              <span>  Cum. Actual Qty:</span>
              <span style="color: ${tSub};">${actQty.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${unit}</span>
            </div>
            <div style="border-top: 1px solid ${tDiv}; padding-top: 4px; margin-top: 6px; display: flex; justify-content: space-between; gap: 12px; font-family: monospace; font-weight: 700;">
              <span style="color: ${tMuted};">Variance:</span>
              <span style="color: ${varColor};">${varSign}${variance.toFixed(2)}%</span>
            </div>
          </div>
        `;
      }
    },
    legend: {
      top: 0,
      right: 0,
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: {
        color: tk.legendText,
        fontSize: 11
      },
      data: ['Planned Target (%)', 'Actual Achieved (%)']
    },
    xAxis: {
      type: 'category',
      data: chartData.categories,
      boundaryGap: false,
      axisLine: {
        lineStyle: {
          color: tk.axisLine
        }
      },
      axisTick: {
        alignWithLabel: true,
        lineStyle: {
          color: tk.axisLine
        }
      },
      axisLabel: {
        color: tk.axisLabel,
        fontSize: 10,
        fontFamily: 'monospace',
        interval: 'auto',
        hideOverlap: true,
        rotate: chartData.categories.length > 12 ? 35 : 0,
        showMinLabel: true,
        showMaxLabel: true,
        margin: 10
      }
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: yAxisMax,
      interval: yAxisMode === 'full' ? 20 : undefined,
      axisLabel: {
        formatter: '{value}%',
        color: tk.axisLabel,
        fontSize: 10,
        fontFamily: 'monospace'
      },
      splitLine: {
        lineStyle: {
          color: tk.splitLine,
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
        data: chartData.plannedData
      },
      // 2. Actual Achieved S-Curve (Solid Red Line with diamond symbol & markPoint pin)
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
        data: chartData.actualData,
        markPoint: {
          symbol: 'pin',
          symbolSize: 38,
          itemStyle: {
            color: '#EF4444',
            shadowColor: 'rgba(239, 68, 68, 0.8)',
            shadowBlur: 10
          },
          label: {
            formatter: `${metrics.latestActualPct.toFixed(1)}%`,
            fontSize: 9,
            fontWeight: 'bold',
            color: '#FFFFFF',
            offset: [0, -2]
          },
          data: chartData.categories.length > 0 ? [
            {
              name: 'Latest Actual',
              coord: [chartData.categories[chartData.categories.length - 1], metrics.latestActualPct]
            }
          ] : []
        }
      }
    ]
  };

  return (
    <Card ref={containerRef} className="h-full flex flex-col bg-[#16181D]/80 backdrop-blur-md border border-white/5 rounded-2xl p-5 justify-between relative select-none">
      {/* Card Header with Activity Selector, View Controls & Status Badge */}
      <div className="pb-3 border-b border-white/[0.04] flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-400 shrink-0" />
          <h3 className="text-sm font-bold text-white tracking-wide whitespace-nowrap">
            S-Curve: Planned vs Actual (Execution To-Date)
          </h3>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Activity Selector (5 independent options, Milling as default) */}
          <div className="flex items-center bg-[#121316] p-0.5 rounded-xl border border-white/10 text-xs font-medium">
            {(['Milling', 'Tackcoat (DBM)', 'DBM', 'Tackcoat (BC)', 'BC'] as const).map(act => (
              <button
                key={act}
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

          {/* View Mode Toggle: Daily vs Milestones */}
          <div className="flex items-center bg-[#121316] p-0.5 rounded-lg border border-white/10 text-[11px] font-mono">
            <button
              onClick={() => setViewMode('daily')}
              data-on-accent={isLight && viewMode === 'daily' ? 'true' : undefined}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                viewMode === 'daily'
                  ? isLight
                    ? 'bg-[#07966D] text-white font-bold shadow-xs'
                    : 'bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
              title={`Daily cumulative progression (${chartData.categories.length} Days)`}
            >
              Daily ({chartData.categories.length} Days)
            </button>
            <button
              onClick={() => setViewMode('milestones')}
              data-on-accent={isLight && viewMode === 'milestones' ? 'true' : undefined}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                viewMode === 'milestones'
                  ? isLight
                    ? 'bg-[#07966D] text-white font-bold shadow-xs'
                    : 'bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Contractual milestone points to date"
            >
              Milestones
            </button>
          </div>

          {/* Y-Axis Scale Toggle: Focused vs Full */}
          <div className="flex items-center bg-[#121316] p-0.5 rounded-lg border border-white/10 text-[11px] font-mono">
            <button
              onClick={() => setYAxisMode(yAxisMode === 'focus' ? 'full' : 'focus')}
              className="px-2 py-0.5 rounded text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Toggle Y-Axis range between focused and 0-100%"
            >
              Axis: {yAxisMode === 'focus' ? `0–${yAxisMax}%` : '0–100%'}
            </button>
          </div>

          {/* Execution Status Badge */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono font-bold shadow-sm ${
            metrics.scheduleVariancePct > 0
              ? 'text-rose-400 bg-rose-950/40 border-rose-800/40'
              : 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40'
          }`}>
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Actual: {metrics.latestActualPct.toFixed(1)}% vs Plan: {metrics.latestPlannedPct.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Main Chart Area */}
      <CardContent className="flex-1 p-0 pt-3 min-h-[250px] relative">
        <ReactECharts
          ref={chartRef}
          option={option}
          style={{ height: '100%', minHeight: '240px', width: '100%' }}
          notMerge={true}
          opts={{ renderer: 'svg' }}
        />

        {/* Freezable Tooltip Box Overlay */}
        {frozenIndex !== null && frozenPos && (
          <div
            style={{
              position: 'absolute',
              left: `${frozenPos.x}px`,
              top: `${frozenPos.y}px`,
              zIndex: 40
            }}
            onClick={(e) => e.stopPropagation()}
            className={`p-3.5 rounded-xl border-2 backdrop-blur-md text-xs font-mono min-w-[270px] pointer-events-auto ${
              isLight
                ? 'bg-white/98 border-[#07966D] text-[#17212B] shadow-xl'
                : 'bg-[#0F1218]/95 border-blue-400 shadow-2xl text-slate-200 shadow-blue-500/30 ring-2 ring-blue-500/20'
            }`}
          >
            {/* Header: Date + Frozen Pill + Close Button */}
            <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-white/10 font-bold">
              <div className="flex items-center gap-1.5">
                <span className="text-white font-sans text-xs">📅 {chartData.categories[frozenIndex]} Cumulative Progress</span>
                <span className="text-[9px] px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded border border-blue-500/40 font-mono font-semibold">
                  🔒 Frozen
                </span>
              </div>
              <button
                type="button"
                onClick={() => setFrozenIndex(null)}
                className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer transition-colors"
                title="Unfreeze tooltip"
              >
                ✕
              </button>
            </div>

            <div className="text-[11px] text-blue-400 font-semibold mb-2 font-mono">
              Activity: <span className="text-blue-300">{selectedActivity}</span> ({unit})
            </div>

            {(() => {
              const planPct = chartData.plannedData[frozenIndex] !== undefined ? chartData.plannedData[frozenIndex] : 0;
              const actPct = chartData.actualData[frozenIndex] !== undefined ? chartData.actualData[frozenIndex] : 0;
              const planQty = chartData.plannedQtys[frozenIndex] !== undefined ? chartData.plannedQtys[frozenIndex] : 0;
              const actQty = chartData.actualQtys[frozenIndex] !== undefined ? chartData.actualQtys[frozenIndex] : 0;
              const variance = actPct - planPct;
              const varColor = variance >= 0 ? '#10B981' : '#F43F5E';
              const varSign = variance >= 0 ? '+' : '';

              return (
                <div className="space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-blue-400">● Planned Target (%):</span>
                    <span className="font-bold text-white">{planPct.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between items-center gap-3 text-[10px] text-slate-400">
                    <span>  Cum. Planned Qty:</span>
                    <span className="text-slate-200">{planQty.toLocaleString(undefined, { maximumFractionDigits: 1 })} {unit}</span>
                  </div>
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-red-400">◆ Actual Achieved (%):</span>
                    <span className="font-bold text-white">{actPct.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between items-center gap-3 text-[10px] text-slate-400">
                    <span>  Cum. Actual Qty:</span>
                    <span className="text-slate-200">{actQty.toLocaleString(undefined, { maximumFractionDigits: 1 })} {unit}</span>
                  </div>
                  <div className="border-t border-white/10 pt-1.5 mt-1.5 flex justify-between items-center gap-3 font-bold">
                    <span className="text-slate-400">Variance:</span>
                    <span style={{ color: varColor }}>{varSign}{variance.toFixed(2)}%</span>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </CardContent>

      {/* Footer Key Execution Micro-Metrics Bar */}
      <div className="mt-3 pt-3 border-t border-white/[0.06] grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        {/* Metric 1: Current Pace */}
        <div className="bg-[#121316] p-2 rounded-xl border border-white/5 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">Current Pace</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="font-mono font-extrabold text-cyan-300">
              {metrics.dailyPace.toFixed(2)}%
            </span>
            <span className="text-[10px] text-slate-400">/ day</span>
          </div>
        </div>

        {/* Metric 2: Planned Target */}
        <div className="bg-[#121316] p-2 rounded-xl border border-white/5 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">Planned Target</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="font-mono font-extrabold text-blue-400">
              {metrics.latestPlannedPct.toFixed(2)}%
            </span>
            <span className="text-[10px] text-slate-400">to date</span>
          </div>
        </div>

        {/* Metric 3: Actual Completed */}
        <div className="bg-[#121316] p-2 rounded-xl border border-white/5 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">Actual Completed</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="font-mono font-extrabold text-rose-400">
              {metrics.latestActualPct.toFixed(2)}%
            </span>
            <span className="text-[10px] text-slate-400">achieved</span>
          </div>
        </div>

        {/* Metric 4: Schedule Slip */}
        <div className="bg-[#121316] p-2 rounded-xl border border-white/5 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">Schedule Slip</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className={`font-mono font-extrabold ${metrics.scheduleVariancePct > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {Math.abs(metrics.scheduleVariancePct).toFixed(1)}%
            </span>
            <span className={`text-[10px] font-medium ${metrics.scheduleVariancePct > 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
              {metrics.scheduleVariancePct > 0 ? 'lag' : metrics.scheduleVariancePct < 0 ? 'lead' : 'on track'}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default SCurveActualChart;
