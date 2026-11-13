import React, { useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { ActualDPRRow } from '../../types/dpr';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { AlertCircle, Sliders } from 'lucide-react';
import { formatChainagePlus } from '../../utils/excelParser';
import { useTheme } from '../../context/ThemeContext';
import { getChartThemeTokens } from '../../utils/chartTheme';

interface AnomalyScatterPlotProps {
  rows: ActualDPRRow[];
  onSelectRow?: (row: ActualDPRRow) => void;
}

export const AnomalyScatterPlot: React.FC<AnomalyScatterPlotProps> = ({
  rows,
  onSelectRow
}) => {
  const { theme, isLight } = useTheme();
  const tk = getChartThemeTokens(theme);
  const [axisMode, setAxisMode] = useState<'depth' | 'width'>('depth');

  // Prepare scatter points: [ChainageMid, YVal, Size, RowObject]
  const scatterData = rows.map(r => {
    const midChainage = (r.fromChainage + r.toChainage) / 2;
    let yVal = 50; // nominal mm

    if (axisMode === 'depth') {
      yVal = r.depthMm ? r.depthMm : (r.activity === 'DBM' ? 50 : 50);
      if (r.remarks.includes('90 mm') || (r.depthM && r.depthM > 0.07)) {
        yVal = 90;
      }
    } else {
      yVal = r.widthM || 3.5;
    }

    // Size calculation (scaled between 8 and 28 px)
    const qty = r.achievedToday || 100;
    const bubbleSize = Math.max(8, Math.min(26, Math.sqrt(qty) / 3));

    let color = '#10B981'; // Emerald normal
    let glowColor = 'rgba(16, 185, 129, 0.4)';

    if (r.isAnomaly) {
      if (r.anomalyCategory === 'milling_excess_depth' || yVal >= 70) {
        color = '#EF4444'; // Crimson
        glowColor = 'rgba(239, 68, 68, 0.8)';
      } else {
        color = '#F59E0B'; // Neon amber
        glowColor = 'rgba(245, 158, 11, 0.7)';
      }
    }

    return {
      name: `${formatChainagePlus(r.fromChainage)} - ${formatChainagePlus(r.toChainage)}`,
      value: [midChainage, yVal, bubbleSize],
      itemStyle: {
        color,
        borderColor: '#FFFFFF',
        borderWidth: r.isAnomaly ? 2 : 0,
        shadowColor: glowColor,
        shadowBlur: r.isAnomaly ? 15 : 5
      },
      rawRow: r
    };
  });

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: isLight ? 'rgba(255, 255, 255, 0.98)' : 'rgba(18, 20, 26, 0.95)',
      borderColor: isLight ? '#E2E8F0' : 'rgba(255, 255, 255, 0.15)',
      borderWidth: 1,
      padding: [10, 14],
      textStyle: {
        color: isLight ? '#17212B' : '#F3F4F6',
        fontSize: 12,
        fontFamily: 'Inter, sans-serif'
      },
      formatter: (params: any) => {
        const item = params.data;
        const r: ActualDPRRow = item.rawRow;
        const statusBadge = r.isAnomaly
          ? isLight
            ? `<span style="background:#FEE2E2; color:#DC4C4C; border:1px solid rgba(220,76,76,0.35); padding:2px 6px; border-radius:4px; font-size:11px; font-weight:600;">⚠ ANOMALY: ${r.anomalyCategory.toUpperCase()}</span>`
            : `<span style="background: rgba(239,68,68,0.25); color: #FCA5A5; border: 1px solid rgba(239,68,68,0.4); padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600;">⚠ ANOMALY: ${r.anomalyCategory.toUpperCase()}</span>`
          : isLight
            ? `<span style="background:#DDF5EA; color:#159B63; border:1px solid rgba(21,155,99,0.35); padding:2px 6px; border-radius:4px; font-size:11px; font-weight:600;">✓ Standard Spec</span>`
            : `<span style="background: rgba(16,185,129,0.2); color: #6EE7B7; border: 1px solid rgba(16,185,129,0.4); padding: 2px 6px; border-radius: 4px; font-size: 11px;">✓ Standard Spec</span>`;

        const tCh = isLight ? '#07966D' : '#38BDF8';
        const tMuted = isLight ? '#64748B' : '#94A3B8';
        const tVal = isLight ? '#17212B' : '#FFF';
        const tBox = isLight ? '#F8FAFC' : 'rgba(0,0,0,0.3)';
        const tRem = isLight ? '#B45309' : '#FCD34D';

        return `
          <div style="min-width: 210px; font-family: Inter, sans-serif;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px; gap:8px;">
              <span style="font-weight:700; color:${tCh}; font-family:monospace;">${item.name}</span>
              ${statusBadge}
            </div>
            <div style="font-size: 11px; color:${tMuted}; margin-bottom: 6px;">
              Date: <span style="color:${tVal}; font-family:monospace;">${r.date}</span> | Act: <span style="color:${tVal};">${r.activity}</span> (${r.lane})
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 11px; font-family:monospace; background:${tBox}; padding:6px; border-radius:6px; margin-bottom:6px;">
              <div>Length: <span style="color:${tVal};">${r.lengthM}m</span></div>
              <div>Width: <span style="color:${tVal};">${r.widthM}m</span></div>
              <div>Depth: <span style="color:${r.depthMm && r.depthMm > 55 ? '#DC4C4C' : tVal}; font-weight:bold;">${r.depthMm || 50}mm</span></div>
              <div>Achieved: <span style="color:${tCh};">${r.achievedToday} ${r.unit}</span></div>
            </div>
            ${r.remarks ? `<div style="font-size:11px; color:${tRem}; font-style:italic; border-top:1px dashed ${isLight ? '#E2E8F0' : 'rgba(255,255,255,0.1)'}; padding-top:4px;">💬 ${r.remarks}</div>` : ''}
          </div>
        `;
      }
    },
    grid: {
      top: 35,
      left: 15,
      right: 25,
      bottom: 25,
      containLabel: true
    },
    xAxis: {
      type: 'value',
      name: 'Highway Chainage',
      nameLocation: 'middle',
      nameGap: 24,
      nameTextStyle: {
        color: tk.axisTitle,
        fontSize: 10,
        fontFamily: 'Inter, sans-serif'
      },
      min: 189.0,
      max: 204.0,
      interval: 2.0,
      splitLine: {
        lineStyle: {
          color: isLight ? '#EDF1F5' : 'rgba(255, 255, 255, 0.05)',
          type: 'dashed'
        }
      },
      axisLine: {
        lineStyle: { color: tk.axisLine }
      },
      axisLabel: {
        formatter: (val: number) => `Ch.${val.toFixed(0)}`,
        color: tk.axisLabel,
        fontSize: 10,
        fontFamily: 'JetBrains Mono, monospace'
      }
    },
    yAxis: {
      type: 'value',
      name: axisMode === 'depth' ? 'Depth (mm)' : 'Width (m)',
      nameTextStyle: {
        color: tk.axisTitle,
        fontSize: 10,
        fontFamily: 'Inter, sans-serif'
      },
      min: axisMode === 'depth' ? 30 : 2.5,
      max: axisMode === 'depth' ? 100 : 8.0,
      splitLine: {
        lineStyle: {
          color: isLight ? '#EDF1F5' : 'rgba(255, 255, 255, 0.05)',
          type: 'dashed'
        }
      },
      axisLabel: {
        color: tk.axisLabel,
        fontSize: 10,
        fontFamily: 'JetBrains Mono, monospace'
      }
    },
    series: [
      {
        name: 'Execution Stretches',
        type: 'scatter',
        symbolSize: (data: any[]) => data[2],
        data: scatterData,
        markLine: {
          silent: true,
          lineStyle: {
            color: tk.contractFinish,
            type: 'dashed',
            width: 1.5
          },
          label: {
            formatter: axisMode === 'depth' ? 'Design Depth: 50mm' : 'Std Lane: 3.5m',
            position: 'end',
            color: tk.contractFinish,
            fontSize: 10,
            fontFamily: 'JetBrains Mono, monospace'
          },
          data: [
            {
              yAxis: axisMode === 'depth' ? 50 : 3.5
            }
          ]
        }
      }
    ]
  };

  const onChartClick = (params: any) => {
    if (params.data && params.data.rawRow && onSelectRow) {
      onSelectRow(params.data.rawRow);
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader
        action={
          <div className="flex items-center gap-1 bg-[#121316] p-1 rounded-xl border border-white/10 text-xs">
            <button
              onClick={() => setAxisMode('depth')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                axisMode === 'depth'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Depth (mm)
            </button>
            <button
              onClick={() => setAxisMode('width')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                axisMode === 'width'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Width (m)
            </button>
          </div>
        }
      >
        <CardTitle icon={<AlertCircle className="w-4 h-4 text-rose-400" />}>
          Depth Variance & Anomaly Scatter
        </CardTitle>
        <p className="text-xs text-slate-400">
          Spatial distribution across highway chainage with highlighted excess depth and offset deviations
        </p>
      </CardHeader>
      <CardContent className="flex-1 p-2 sm:p-4 min-h-[300px]">
        <ReactECharts
          option={option}
          style={{ height: '100%', minHeight: '280px', width: '100%' }}
          notMerge={true}
          opts={{ renderer: 'svg' }}
          onEvents={{ click: onChartClick }}
        />
      </CardContent>
    </Card>
  );
};
