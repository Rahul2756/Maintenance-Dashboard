import React, { useState } from 'react';
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
  const [metricView, setMetricView] = useState<'Combined' | 'Milling' | 'Tackcoat' | 'DBM' | 'BC'>('Combined');

  // Auto-sync when a single activity is selected in global filters
  React.useEffect(() => {
    if (selectedActivities && selectedActivities.length === 1) {
      setMetricView(selectedActivities[0]);
    } else if (selectedActivities && selectedActivities.length > 1 && metricView !== 'Combined' && !selectedActivities.includes(metricView as ActivityType)) {
      setMetricView('Combined');
    }
  }, [selectedActivities]);

  const dates = data.map(d => d.displayDate);

  let plannedValues: number[] = [];
  let achievedValues: number[] = [];
  let unit = 'Index';

  if (metricView === 'Milling') {
    plannedValues = data.map(d => d.millingPlanned);
    achievedValues = data.map(d => d.millingAchieved);
    unit = 'sqm';
  } else if (metricView === 'Tackcoat') {
    plannedValues = data.map(d => d.tackcoatPlanned);
    achievedValues = data.map(d => d.tackcoatAchieved);
    unit = 'sqm';
  } else if (metricView === 'DBM') {
    plannedValues = data.map(d => d.dbmPlanned);
    achievedValues = data.map(d => d.dbmAchieved);
    unit = 'Cum';
  } else if (metricView === 'BC') {
    plannedValues = data.map(() => 0);
    achievedValues = data.map(() => 0);
    unit = 'Cum';
  } else {
    // Combined production pace vs phased daily target (MT)
    plannedValues = data.map(d => Math.round(d.totalPlannedWeighted));
    achievedValues = data.map(d => Math.round(d.totalAchievedWeighted));
    unit = 'MT';
  }

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
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
        const dateStr = params[0].name;
        let html = `<div style="font-weight: 700; margin-bottom: 6px; color: #E2E8F0; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;">📅 Date: ${dateStr}</div>`;
        params.forEach(p => {
          const val = typeof p.value === 'number' ? p.value.toLocaleString() : p.value;
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
    <Card className="h-full flex flex-col">
      <CardHeader
        action={
          <div className="flex items-center gap-1 bg-[#121316] p-1 rounded-xl border border-white/10 text-xs">
            {(['Combined', 'Milling', 'Tackcoat', 'DBM', 'BC'] as const).map(tab => (
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
          Comparing daily milestone targets against execution pace (14–23 Oct 2026)
        </p>
      </CardHeader>
      <CardContent className="flex-1 p-2 sm:p-4 min-h-[300px]">
        <ReactECharts
          option={option}
          style={{ height: '100%', minHeight: '280px', width: '100%' }}
          notMerge={true}
          opts={{ renderer: 'svg' }}
        />
      </CardContent>
    </Card>
  );
};
