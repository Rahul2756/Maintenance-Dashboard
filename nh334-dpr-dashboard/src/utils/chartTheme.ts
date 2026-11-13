import type { ThemeMode } from '../context/ThemeContext';

export interface EChartsThemeTokens {
  isLight: boolean;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  tooltipTitle: string;
  tooltipMuted: string;
  tooltipAccent: string;
  tooltipDivider: string;
  legendText: string;
  axisLine: string;
  axisLabel: string;
  axisTitle: string;
  splitLine: string;
  asOfLine: string;
  asOfLabel: string;
  contractFinish: string;
  markAreaTint: string;
  pointBorder: string;
  plannedColor: string;
  actualColor: string;
  forecastColor: string;
  plannedBarGradient: [string, string];
  achievedBarGradient: [string, string];
  barHoverShadow: string;
}

export function getChartThemeTokens(mode: ThemeMode = 'dark'): EChartsThemeTokens {
  if (mode === 'light') {
    return {
      isLight: true,
      tooltipBg: 'rgba(255, 255, 255, 0.98)',
      tooltipBorder: '#E2E8F0',
      tooltipText: '#17212B',
      tooltipTitle: '#17212B',
      tooltipMuted: '#64748B',
      tooltipAccent: '#07966D',
      tooltipDivider: '#E5E7EB',
      legendText: '#475569',
      axisLine: '#CBD5E1',
      axisLabel: '#64748B',
      axisTitle: '#475569',
      splitLine: '#E2E8F0',
      asOfLine: '#94A3B8',
      asOfLabel: '#64748B',
      contractFinish: '#159B63',
      markAreaTint: 'rgba(7, 150, 109, 0.04)',
      pointBorder: '#FFFFFF',
      plannedColor: '#2684C7',
      actualColor: '#DC4C4C',
      forecastColor: '#DC4C4C',
      plannedBarGradient: ['#93C5FD', '#3B82F6'],
      achievedBarGradient: ['#00C98B', '#07966D'],
      barHoverShadow: 'rgba(7, 150, 109, 0.25)'
    };
  }

  return {
    isLight: false,
    tooltipBg: 'rgba(15, 23, 42, 0.96)',
    tooltipBorder: 'rgba(56, 189, 248, 0.3)',
    tooltipText: '#F8FAFC',
    tooltipTitle: '#F8FAFC',
    tooltipMuted: '#94A3B8',
    tooltipAccent: '#00E5FF',
    tooltipDivider: 'rgba(255, 255, 255, 0.12)',
    legendText: '#94A3B8',
    axisLine: 'rgba(255, 255, 255, 0.1)',
    axisLabel: '#94A3B8',
    axisTitle: '#64748B',
    splitLine: 'rgba(255, 255, 255, 0.06)',
    asOfLine: 'rgba(148, 163, 184, 0.45)',
    asOfLabel: '#94A3B8',
    contractFinish: '#10B981',
    markAreaTint: 'rgba(56, 189, 248, 0.03)',
    pointBorder: '#FFFFFF',
    plannedColor: '#3B82F6',
    actualColor: '#EF4444',
    forecastColor: '#F43F5E',
    plannedBarGradient: ['#38BDF8', '#2563EB'],
    achievedBarGradient: ['#10B981', '#059669'],
    barHoverShadow: 'rgba(16, 185, 129, 0.5)'
  };
}

