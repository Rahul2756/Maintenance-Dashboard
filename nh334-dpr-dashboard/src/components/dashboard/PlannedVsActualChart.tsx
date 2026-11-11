import React, { useState, useRef, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { DailyProgressComparison, ActivityType } from '../../types/dpr';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { BarChart3 } from 'lucide-react';

interface PlannedVsActualChartProps {
  data: DailyProgressComparison[];
  selectedActivities?: ActivityType[];
}

export const PlannedVsActualChart: React.FC<PlannedVsActualChartProps> = ({
  data,
  selectedActivities
}) => {
  const [metricView, setMetricView] = useState<ActivityType>('Milling');
  const [frozenIndex, setFrozenIndex] = useState<number | null>(null);
  const [frozenPos, setFrozenPos] = useState<{ x: number; y: number } | null>(null);
  const chartRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastHoveredIndexRef = useRef<number | null>(null);

  // Auto-sync when a single activity is selected in global filters
  React.useEffect(() => {
    if (selectedActivities && selectedActivities.length === 1) {
      setMetricView(selectedActivities[0]);
    } else if (selectedActivities && selectedActivities.length > 0 && !selectedActivities.includes(metricView)) {
      setMetricView(selectedActivities[0]);
    }
  }, [selectedActivities]);

  const dates = data.map(d => d.displayDate);

  let plannedValues: number[] = [];
  let achievedValues: number[] = [];
  let unit = 'Sqm';

  if (metricView === 'Milling') {
    plannedValues = data.map(d => Number((d.millingPlanned || 0).toFixed(1)));
    achievedValues = data.map(d => Math.round(d.millingAchieved || 0));
    unit = 'Sqm';
  } else if (metricView === 'Tackcoat') {
    plannedValues = data.map(d => Number((d.tackcoatPlanned || 0).toFixed(1)));
    achievedValues = data.map(d => Math.round(d.tackcoatAchieved || 0));
    unit = 'Sqm';
  } else if (metricView === 'DBM') {
    plannedValues = data.map(d => Number((d.dbmPlanned || 0).toFixed(2)));
    achievedValues = data.map(d => Number((d.dbmAchieved || 0).toFixed(2)));
    unit = 'Cum';
  } else if (metricView === 'BC') {
    plannedValues = data.map(d => Number((d.bcPlanned || 0).toFixed(2)));
    achievedValues = data.map(d => Number((d.bcAchieved || 0).toFixed(2)));
    unit = 'Cum';
  }

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
        if (xIdx >= 0 && xIdx < dates.length) {
          setFrozenIndex(prev => {
            if (prev === xIdx) return null;
            const width = chartInstance.getWidth();
            const height = chartInstance.getHeight();
            const [px, py] = chartInstance.convertToPixel({ gridIndex: 0 }, [
              xIdx,
              Math.max(plannedValues[xIdx] || 0, achievedValues[xIdx] || 0)
            ]);
            const tooltipWidth = 240;
            let left = px > width - tooltipWidth - 20 ? px - tooltipWidth - 15 : px + 15;
            left = Math.max(10, Math.min(left, width - tooltipWidth - 10));
            const top = Math.max(10, Math.min(py - 40, height - 160));
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
  }, [dates, plannedValues, achievedValues]);

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      show: frozenIndex === null,
      trigger: 'axis',
      enterable: true,
      axisPointer: {
        type: 'shadow'
      },
      backgroundColor: 'rgba(18, 20, 26, 0.95)',
      borderColor: 'rgba(255, 255, 255, 0.12)',
      borderWidth: 1,
      textStyle: {
        color: '#F3F4F6',
        fontSize: 12,
        fontFamily: 'Inter, sans-serif'
      },
      padding: [10, 14],
      formatter: (params: any[]) => {
        if (!params || params.length === 0) return '';
        lastHoveredIndexRef.current = params[0].dataIndex;
        const dateStr = params[0].name;
        let html = `<div style="font-weight: 700; margin-bottom: 4px; color: #E2E8F0; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;">📅 Date: ${dateStr}</div>`;
        html += `<div style="font-size: 11px; margin-bottom: 6px; color: #00e5ff; font-weight: 600;">Activity: ${metricView}</div>`;
        params.forEach(p => {
          const val = typeof p.value === 'number' ? p.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : p.value;
          const marker = `<span style="display:inline-block;margin-right:6px;border-radius:3px;width:10px;height:10px;background-color:${p.color.colorStops ? p.color.colorStops[0].color : p.color};"></span>`;
          html += `<div style="display: flex; justify-content: space-between; gap: 16px; margin: 3px 0; font-family: monospace;">
            <span style="color: #94A3B8;">${marker} ${p.seriesName}</span>
            <span style="font-weight: 600; color: #FFFFFF;">${val} ${p.seriesType === 'line' ? '%' : unit}</span>
          </div>`;
        });
        return html;
      }
    },
    legend: {
      data: ['Planned Target', 'Actual Achieved'],
      top: 0,
      right: 10,
      textStyle: {
        color: '#94A3B8',
        fontSize: 11,
        fontFamily: 'Inter, sans-serif'
      },
      itemGap: 16,
      icon: 'roundRect'
    },
    grid: {
      top: 40,
      left: 10,
      right: 15,
      bottom: 25,
      containLabel: true
    },
    xAxis: [
      {
        type: 'category',
        data: dates,
        axisPointer: {
          type: 'shadow'
        },
        axisLine: {
          lineStyle: { color: 'rgba(255, 255, 255, 0.1)' }
        },
        axisLabel: {
          color: '#94A3B8',
          fontSize: 11,
          fontFamily: 'JetBrains Mono, monospace'
        }
      }
    ],
    yAxis: [
      {
        type: 'value',
        name: unit,
        nameTextStyle: {
          color: '#64748B',
          fontSize: 10,
          fontFamily: 'JetBrains Mono, monospace'
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.05)',
            type: 'dashed'
          }
        },
        axisLabel: {
          color: '#64748B',
          fontSize: 10,
          fontFamily: 'JetBrains Mono, monospace'
        }
      }
    ],
    series: [
      {
        name: 'Planned Target',
        type: 'bar',
        barMaxWidth: 18,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(99, 102, 241, 0.8)' },
              { offset: 1, color: 'rgba(79, 70, 229, 0.2)' }
            ]
          },
          borderRadius: [4, 4, 0, 0]
        },
        data: plannedValues
      },
      {
        name: 'Actual Achieved',
        type: 'bar',
        barMaxWidth: 18,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(6, 182, 212, 0.95)' },
              { offset: 1, color: 'rgba(6, 182, 212, 0.25)' }
            ]
          },
          borderRadius: [4, 4, 0, 0]
        },
        data: achievedValues
      }
    ]
  };

  return (
    <Card ref={containerRef} className="h-full flex flex-col relative select-none">
      <CardHeader
        action={
          <div className="flex items-center gap-1 bg-[#121316] p-1 rounded-xl border border-white/10 text-xs">
            {(['Milling', 'Tackcoat', 'DBM', 'BC'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setMetricView(tab)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${metricView === tab
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>
        }
      >
        <CardTitle icon={<BarChart3 className="w-4 h-4" />}>
          Planned vs Actual Daily Progress
        </CardTitle>
        <p className="text-xs text-slate-400">
          Comparing daily milestone targets against execution pace ({data.length > 0 ? `${data[0].displayDate}–${data[data.length - 1].displayDate} 2026` : '14–23 Oct 2026'})
        </p>
      </CardHeader>
      <CardContent className="flex-1 p-2 sm:p-4 min-h-[300px] relative">
        <ReactECharts
          ref={chartRef}
          option={option}
          style={{ height: '100%', minHeight: '280px', width: '100%' }}
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
            className="p-3.5 rounded-xl bg-[#0F1318]/95 border-2 border-cyan-400 shadow-2xl backdrop-blur-md text-xs font-mono text-slate-200 min-w-[250px] shadow-cyan-500/30 ring-2 ring-cyan-500/20 pointer-events-auto"
          >
            <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-white/10 font-bold">
              <div className="flex items-center gap-1.5">
                <span className="text-white font-sans">📅 Date: {dates[frozenIndex]}</span>
                <span className="text-[9px] px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 rounded border border-cyan-500/40 font-mono font-semibold">
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
            <div className="text-[11px] mb-2 text-[#00e5ff] font-semibold font-mono">
              Activity: {metricView}
            </div>
            <div className="space-y-1.5 text-xs font-mono">
              <div className="flex justify-between items-center gap-4">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block shrink-0 shadow-sm" />
                  Planned Target
                </span>
                <span className="font-bold text-white">
                  {(plannedValues[frozenIndex] || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} {unit}
                </span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#00e5ff] inline-block shrink-0 shadow-sm" />
                  Actual Achieved
                </span>
                <span className="font-bold text-white">
                  {(achievedValues[frozenIndex] || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} {unit}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
