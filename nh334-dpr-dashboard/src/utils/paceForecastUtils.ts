import * as echarts from 'echarts';
import type { ThemeMode } from '../context/ThemeContext';
import { getChartThemeTokens } from './chartTheme';
import { ActualDPRRow, HighwaySide, ProjectBaseline } from '../types/dpr';
import {
  CONTRACTUAL_TARGETS_5,
  DEFAULT_DAILY_PLANNED_TARGETS,
  type DailyPlannedTargetsByActivity,
  type SCurveActivity
} from './dailyPlannedTargetsData';

export type ForecastActivityKey = SCurveActivity | 'Tackcoat';

export const MS_PER_DAY = 86400000;
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Parse DD.MM.YYYY into local midnight epoch ms. */
export function parseDmyToMs(dateStr: string): number {
  const parts = String(dateStr || '').trim().split(/[./-]/);
  if (parts.length !== 3) return NaN;
  const d = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const y = parseInt(parts[2], 10);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return NaN;
  return new Date(y, m, d).getTime();
}

export function formatFullDate(ms: number): string {
  const d = new Date(ms);
  const day = String(d.getDate()).padStart(2, '0');
  return `${day}-${SHORT_MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

export function formatShortTick(ms: number, includeYear: boolean): string {
  const d = new Date(ms);
  const day = String(d.getDate()).padStart(2, '0');
  const yr = String(d.getFullYear()).slice(-2);
  return includeYear ? `${day}-${SHORT_MONTHS[d.getMonth()]}-${yr}` : `${day}-${SHORT_MONTHS[d.getMonth()]}`;
}

export function getForecastActivityUnit(act: ForecastActivityKey): 'Sqm' | 'Cum' {
  return act === 'DBM' || act === 'BC' ? 'Cum' : 'Sqm';
}

export function matchesForecastActivity(row: ActualDPRRow, act: ForecastActivityKey): boolean {
  const raw = String(row.rawActivity || row.activity || '').trim().toLowerCase();
  if (act === 'Milling') return raw.includes('milling');
  if (act === 'Tackcoat') return raw.includes('tack');
  if (act === 'Tackcoat (DBM)') return raw.includes('tack') && !raw.includes('bc');
  if (act === 'DBM') return raw.includes('dbm') && !raw.includes('tack');
  if (act === 'Tackcoat (BC)') return raw.includes('tack') && raw.includes('bc');
  if (act === 'BC') return (raw.includes('bc') || raw.includes('bituminous')) && !raw.includes('tack');
  return false;
}

function getPlannedQtyFromEntry(entry: DailyPlannedTargetsByActivity, act: ForecastActivityKey): number {
  if (act === 'Tackcoat') {
    return (entry['Tackcoat (DBM)'] || 0) + (entry['Tackcoat (BC)'] || 0);
  }
  return entry[act] || 0;
}

export function resolveForecastActivityTarget(
  act: ForecastActivityKey,
  baseline?: ProjectBaseline,
  side: HighwaySide = 'Both',
  explicitScaleRatio?: number
): { targetQty: number; plannedScaleRatio: number } {
  const fallback =
    act === 'Tackcoat'
      ? 1848270.5
      : CONTRACTUAL_TARGETS_5[act]?.target || 681284;

  let bothTarget = fallback;
  if (baseline) {
    if (act === 'Milling') bothTarget = baseline.totalMillingTargetSqm || fallback;
    else if (act === 'Tackcoat') bothTarget = baseline.totalTackcoatTargetSqm || fallback;
    else if (act === 'Tackcoat (DBM)') {
      bothTarget = Number(((baseline.totalTackcoatTargetSqm || 1848270.5) * (681283.75 / 1848270.5)).toFixed(1));
    } else if (act === 'Tackcoat (BC)') {
      bothTarget = Number(((baseline.totalTackcoatTargetSqm || 1848270.5) * (1166986.75 / 1848270.5)).toFixed(1));
    } else if (act === 'DBM') bothTarget = baseline.totalDbmTargetCum || fallback;
    else if (act === 'BC') bothTarget = baseline.totalBcTargetCum || fallback;
  }

  if (explicitScaleRatio !== undefined) {
    const safeRatio = Math.max(0, explicitScaleRatio);
    return {
      targetQty: bothTarget * safeRatio,
      plannedScaleRatio: safeRatio
    };
  }

  if (side === 'Both' || side === 'ALL' || side === 'BHS') {
    return { targetQty: bothTarget, plannedScaleRatio: 1 };
  }

  const sideBaseline = side === 'LHS' ? baseline?.lhs : baseline?.rhs;
  if (!sideBaseline) {
    return { targetQty: bothTarget * 0.5, plannedScaleRatio: 0.5 };
  }

  const totalTackTarget = baseline?.totalTackcoatTargetSqm || 0;
  let sideTarget = bothTarget * 0.5;

  if (act === 'Milling' && sideBaseline.millingTargetSqm > 0) {
    sideTarget = sideBaseline.millingTargetSqm;
  } else if (act === 'DBM' && sideBaseline.dbmTargetCum > 0) {
    sideTarget = sideBaseline.dbmTargetCum;
  } else if (act === 'BC' && sideBaseline.bcTargetCum && sideBaseline.bcTargetCum > 0) {
    sideTarget = sideBaseline.bcTargetCum;
  } else if (
    (act === 'Tackcoat' || act === 'Tackcoat (DBM)' || act === 'Tackcoat (BC)') &&
    sideBaseline.tackcoatTargetSqm > 0 &&
    totalTackTarget > 0
  ) {
    sideTarget = bothTarget * (sideBaseline.tackcoatTargetSqm / totalTackTarget);
  }

  const ratio = bothTarget > 0 ? sideTarget / bothTarget : 0.5;
  return { targetQty: sideTarget, plannedScaleRatio: ratio };
}

export interface ActivityForecastTooltipPoint {
  planPct: number;
  planQty: number;
  actPct: number | null;
  actQty: number | null;
  forecastPct: number | null;
}

export interface ActivityForecastResult {
  unit: 'Sqm' | 'Cum';
  chartStartMs: number;
  reportMs: number;
  contractFinishMs: number;
  horizonEndMs: number;
  spansMultipleYears: boolean;
  daysElapsed: number;
  targetDaysRemaining: number;
  hasSufficientData: boolean;
  isCompleted: boolean;
  currentActualPct: number;
  currentPlannedPct: number;
  /** Average actual cumulative % per calendar day */
  currentPaceDaily: number;
  /** Average planned cumulative % per calendar day */
  plannedPaceDaily: number;
  /** Planned % - Actual % (positive = behind schedule, negative = ahead) */
  lagPct: number;
  /** Actual % - Planned % (negative = behind, positive = ahead) */
  scheduleSlipPct: number;
  requiredPaceDaily: number;
  rampMultiplier: number | null;
  projectedDateStr: string;
  projectedFinishMs: number | null;
  isDelayed: boolean;
  plannedSeries: [number, number][];
  actualSeries: [number, number | null][];
  forecastSeries: [number, number | null][];
  tooltipLookup: Map<number, ActivityForecastTooltipPoint>;
}

export interface ActivityForecastInput {
  activity: ForecastActivityKey;
  actualRows: ActualDPRRow[];
  dailyPlannedTargets?: Record<string, DailyPlannedTargetsByActivity>;
  baseline?: ProjectBaseline;
  reportDate: string;
  startDate?: string;
  contractCompletionDate?: string;
  side?: HighwaySide;
  /** Scales applicable target & daily planned quantities to filtered subset (e.g. Stretch + Lane + Side). */
  targetScaleRatio?: number;
  /** Optional custom extractor for filtered/clipped row Achieved Today quantity. */
  getRowAchievedQty?: (row: ActualDPRRow) => number;
}

/**
 * Shared pace, lag, and completion forecast computation matching SCurveForecastChart methodology.
 */
export function computeActivityPaceAndForecast(input: ActivityForecastInput): ActivityForecastResult {
  const {
    activity,
    actualRows,
    dailyPlannedTargets,
    baseline,
    reportDate,
    startDate = '13.10.2026',
    contractCompletionDate = '31.12.2026',
    side = 'Both',
    targetScaleRatio,
    getRowAchievedQty
  } = input;

  const unit = getForecastActivityUnit(activity);
  const { targetQty, plannedScaleRatio } = resolveForecastActivityTarget(
    activity,
    baseline,
    side,
    targetScaleRatio
  );

  const plannedMap =
    dailyPlannedTargets && Object.keys(dailyPlannedTargets).length > 0
      ? dailyPlannedTargets
      : DEFAULT_DAILY_PLANNED_TARGETS;

  const plannedEntries = Object.entries(plannedMap)
    .map(([k, v]) => ({
      time: parseDmyToMs(k),
      qty: getPlannedQtyFromEntry(v, activity) * plannedScaleRatio
    }))
    .filter(e => !isNaN(e.time))
    .sort((a, b) => a.time - b.time);

  const startMs = parseDmyToMs(startDate) || parseDmyToMs('13.10.2026');
  const chartStartMs = parseDmyToMs('12.10.2026');
  const contractFinishMs = parseDmyToMs(contractCompletionDate) || parseDmyToMs('31.12.2026');
  const minHorizonMs = parseDmyToMs('31.01.2027');

  const parsedReportMs = parseDmyToMs(reportDate);
  const reportMs = !isNaN(parsedReportMs) ? parsedReportMs : parseDmyToMs('08.11.2026');

  const daysElapsed = Math.max(1, Math.round((reportMs - startMs) / MS_PER_DAY));
  const targetDaysRemaining = Math.max(1, Math.round((contractFinishMs - reportMs) / MS_PER_DAY));

  const dailyActualMap = new Map<number, number>();
  let totalActualQty = 0;

  actualRows.forEach(r => {
    if (!matchesForecastActivity(r, activity)) return;
    const rMs = parseDmyToMs(r.date);
    if (isNaN(rMs) || rMs > reportMs) return;
    const qty = getRowAchievedQty ? getRowAchievedQty(r) : (r.achievedToday || 0);
    if (qty <= 0) return;
    totalActualQty += qty;
    dailyActualMap.set(rMs, (dailyActualMap.get(rMs) || 0) + qty);
  });

  const currentActualPct = targetQty > 0 ? Number(((totalActualQty / targetQty) * 100).toFixed(2)) : 0;

  const getCumPlannedQtyAt = (ts: number): number => {
    let sum = 0;
    for (const p of plannedEntries) {
      if (p.time <= ts) sum += p.qty;
      else break;
    }
    return sum;
  };

  const cumPlannedAtReport = getCumPlannedQtyAt(reportMs);
  const currentPlannedPct = targetQty > 0 ? Number(((cumPlannedAtReport / targetQty) * 100).toFixed(2)) : 0;

  const hasSufficientData = totalActualQty > 0 && currentActualPct > 0 && targetQty > 0;
  const isCompleted = hasSufficientData && currentActualPct >= 100;
  const currentPaceDaily = hasSufficientData ? currentActualPct / daysElapsed : 0;
  const plannedPaceDaily = targetQty > 0 ? currentPlannedPct / daysElapsed : 0;
  const lagPct = currentPlannedPct - currentActualPct;
  const scheduleSlipPct = currentActualPct - currentPlannedPct;
  const remainingPct = Math.max(0, 100 - currentActualPct);

  let projectedFinishMs: number | null = null;
  if (isCompleted) {
    projectedFinishMs = reportMs;
  } else if (hasSufficientData && currentPaceDaily > 0) {
    const daysToComplete = Math.round(remainingPct / currentPaceDaily);
    projectedFinishMs = reportMs + daysToComplete * MS_PER_DAY;
  }

  const isDelayed = projectedFinishMs !== null && projectedFinishMs > contractFinishMs;
  const projectedDateStr = isCompleted
    ? `Completed (${formatFullDate(reportMs)})`
    : projectedFinishMs !== null
    ? formatFullDate(projectedFinishMs)
    : 'Insufficient data for forecast';

  const requiredPaceDaily = remainingPct / targetDaysRemaining;
  const rampMultiplier = currentPaceDaily > 0 ? requiredPaceDaily / currentPaceDaily : null;

  const horizonEndMs = Math.max(minHorizonMs, projectedFinishMs ?? minHorizonMs);
  const tsSet = new Set<number>();

  const dailyCapMs = (horizonEndMs - chartStartMs) / MS_PER_DAY <= 180 ? horizonEndMs : minHorizonMs;
  for (let t = chartStartMs; t <= dailyCapMs; t += MS_PER_DAY) {
    tsSet.add(t);
  }

  if (horizonEndMs > dailyCapMs) {
    for (let t = dailyCapMs + 7 * MS_PER_DAY; t < horizonEndMs; t += 7 * MS_PER_DAY) {
      tsSet.add(t);
    }
    tsSet.add(horizonEndMs);
  }

  tsSet.add(reportMs);
  tsSet.add(contractFinishMs);
  if (projectedFinishMs !== null) tsSet.add(projectedFinishMs);

  const sortedTs = Array.from(tsSet).sort((a, b) => a - b);
  const actualDayKeys = Array.from(dailyActualMap.keys()).sort((a, b) => a - b);

  const getCumActualQtyAt = (ts: number): number => {
    let sum = 0;
    for (const k of actualDayKeys) {
      if (k <= ts) sum += dailyActualMap.get(k) || 0;
      else break;
    }
    return sum;
  };

  const plannedSeries: [number, number][] = [];
  const actualSeries: [number, number | null][] = [];
  const forecastSeries: [number, number | null][] = [];
  const tooltipLookup = new Map<number, ActivityForecastTooltipPoint>();

  for (const ts of sortedTs) {
    const planQty = getCumPlannedQtyAt(ts);
    const rawPlanPct = targetQty > 0 ? Number(((planQty / targetQty) * 100).toFixed(2)) : 0;
    const plottedPlanPct = Math.min(100, rawPlanPct);
    plannedSeries.push([ts, plottedPlanPct]);

    let actPct: number | null = null;
    let actQty: number | null = null;
    if (ts <= reportMs) {
      actQty = getCumActualQtyAt(ts);
      actPct = targetQty > 0 ? Number(((actQty / targetQty) * 100).toFixed(2)) : 0;
    }
    actualSeries.push([ts, actPct]);

    let forecastPct: number | null = null;
    if (hasSufficientData && !isCompleted) {
      if (ts === reportMs) {
        forecastPct = currentActualPct;
      } else if (ts > reportMs) {
        const daysAhead = (ts - reportMs) / MS_PER_DAY;
        forecastPct = Math.min(100, Number((currentActualPct + daysAhead * currentPaceDaily).toFixed(1)));
      }
    }
    forecastSeries.push([ts, forecastPct]);

    tooltipLookup.set(ts, {
      planPct: rawPlanPct,
      planQty,
      actPct,
      actQty,
      forecastPct
    });
  }

  const spansMultipleYears = horizonEndMs - chartStartMs > 330 * MS_PER_DAY;

  return {
    unit,
    chartStartMs,
    reportMs,
    contractFinishMs,
    horizonEndMs,
    spansMultipleYears,
    daysElapsed,
    targetDaysRemaining,
    hasSufficientData,
    isCompleted,
    currentActualPct,
    currentPlannedPct,
    currentPaceDaily,
    plannedPaceDaily,
    lagPct,
    scheduleSlipPct,
    requiredPaceDaily,
    rampMultiplier,
    projectedDateStr,
    projectedFinishMs,
    isDelayed,
    plannedSeries,
    actualSeries,
    forecastSeries,
    tooltipLookup
  };
}

/** Shared ECharts configuration for Planned vs Actual vs Pace Forecast S-Curve visuals. */
export function buildForecastChartOption(
  model: ActivityForecastResult,
  activityLabel: string,
  compact: boolean = false,
  theme: ThemeMode = 'dark'
): echarts.EChartsOption {
  const tk = getChartThemeTokens(theme);
  const isLight = tk.isLight;
  const ttText = isLight ? '#17212B' : '#FFFFFF';
  const ttMuted = isLight ? '#64748B' : '#94A3B8';
  const ttSub = isLight ? '#475569' : '#CBD5E1';
  const ttDivider = isLight ? '#E5E7EB' : 'rgba(255,255,255,0.12)';
  const ttPlanLabel = isLight ? '#2563EB' : '#60A5FA';
  const ttActLabel = isLight ? '#DC4C4C' : '#EF4444';
  const ttFcLabel = isLight ? '#DC4C4C' : '#FB7185';
  const ttFcVal = isLight ? '#B91C1C' : '#FDA4AF';
  const ttActHdr = isLight ? '#07966D' : '#93C5FD';
  const ttHistTag = isLight ? '#2684C7' : '#38BDF8';

  const isMilestoneTimestamp = (ts: number): boolean => {
    if (ts === model.reportMs || ts === model.contractFinishMs || ts === model.horizonEndMs) return true;
    const d = new Date(ts);
    if (d.getDate() === 15) return true;
    return new Date(ts + MS_PER_DAY).getDate() === 1;
  };

  const milestoneSymbolSize = (size: number) => (val: any) =>
    Array.isArray(val) && val[1] !== null && val[1] !== undefined && isMilestoneTimestamp(val[0]) ? size : 0;

  return {
    backgroundColor: 'transparent',
    grid: compact
      ? { top: 32, right: 18, bottom: 28, left: 40, containLabel: true }
      : { top: 36, right: 24, bottom: 44, left: 48, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: isLight ? 'rgba(255, 255, 255, 0.98)' : '#0F1218',
      borderColor: isLight ? '#E2E8F0' : 'rgba(255, 255, 255, 0.15)',
      borderWidth: 1,
      padding: [10, 14],
      textStyle: { color: ttText, fontSize: 11 },
      axisPointer: {
        type: 'cross',
        lineStyle: { color: isLight ? 'rgba(100, 116, 139, 0.35)' : 'rgba(255, 255, 255, 0.25)', type: 'dashed' }
      },
      formatter: (params: any) => {
        if (!Array.isArray(params) || params.length === 0) return '';
        const rawTs = Array.isArray(params[0].value) ? params[0].value[0] : params[0].axisValue;
        const ts = Number(rawTs);
        const info = model.tooltipLookup.get(ts);
        const dateTitle = formatFullDate(ts);
        const isFuture = ts > model.reportMs;
        const periodTag = isFuture
          ? `<span style="color:${ttFcLabel};font-size:10px;margin-left:6px;">[Projected]</span>`
          : `<span style="color:${ttHistTag};font-size:10px;margin-left:6px;">[Historical]</span>`;

        if (!info) return `<div style="font-family:monospace;font-size:12px;color:${ttText}">${dateTitle}</div>`;

        let html = `
          <div style="font-family: Inter, sans-serif; font-size: 11px; min-width: 225px;">
            <div style="font-weight: 700; color: ${ttText}; border-bottom: 1px solid ${ttDivider}; padding-bottom: 5px; margin-bottom: 6px; display:flex; align-items:center; justify-content:space-between;">
              <span>${dateTitle}</span>${periodTag}
            </div>
            <div style="font-size: 10px; color: ${ttMuted}; margin-bottom: 6px;">
              Activity: <strong style="color: ${ttActHdr};">${activityLabel}</strong> (${model.unit})
            </div>
            <div style="display:flex; justify-content:space-between; gap:14px; margin:3px 0; font-family:monospace;">
              <span style="color:${ttPlanLabel};">● Planned Target:</span>
              <span style="font-weight:700; color:${ttText};">${info.planPct.toFixed(2)}%</span>
            </div>
            <div style="display:flex; justify-content:space-between; gap:14px; margin:1px 0 5px 0; font-family:monospace; font-size:10px; color:${ttMuted};">
              <span>  Cum. Planned Qty:</span>
              <span style="color:${ttSub};">${info.planQty.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${model.unit}</span>
            </div>
        `;

        if (info.actPct !== null && info.actQty !== null) {
          html += `
            <div style="display:flex; justify-content:space-between; gap:14px; margin:3px 0; font-family:monospace;">
              <span style="color:${ttActLabel};">◆ Actual Achieved:</span>
              <span style="font-weight:700; color:${ttText};">${info.actPct.toFixed(2)}%</span>
            </div>
            <div style="display:flex; justify-content:space-between; gap:14px; margin:1px 0 5px 0; font-family:monospace; font-size:10px; color:${ttMuted};">
              <span>  Cum. Actual Qty:</span>
              <span style="color:${ttSub};">${info.actQty.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${model.unit}</span>
            </div>
          `;
        }

        if (info.forecastPct !== null) {
          html += `
            <div style="display:flex; justify-content:space-between; gap:14px; margin:3px 0; font-family:monospace;">
              <span style="color:${ttFcLabel};">┄ Pace Forecast:</span>
              <span style="font-weight:700; color:${ttFcVal};">${info.forecastPct.toFixed(1)}%</span>
            </div>
          `;
        }

        if (info.actPct !== null) {
          const slip = info.actPct - info.planPct;
          const slipColor = slip >= 0 ? (isLight ? '#159B63' : '#10B981') : (isLight ? '#DC4C4C' : '#F43F5E');
          const slipSign = slip >= 0 ? '+' : '';
          html += `
            <div style="border-top:1px solid ${ttDivider}; padding-top:4px; margin-top:6px; display:flex; justify-content:space-between; gap:14px; font-family:monospace; font-weight:700;">
              <span style="color:${ttMuted};">Variance vs Plan:</span>
              <span style="color:${slipColor};">${slipSign}${slip.toFixed(2)}%</span>
            </div>
          `;
        }

        html += '</div>';
        return html;
      }
    },
    legend: {
      top: 0,
      right: 0,
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: tk.legendText, fontSize: compact ? 10 : 11 },
      data: ['Planned Target (%)', 'Actual Achieved (%)', 'Pace Forecast (Dotted)']
    },
    xAxis: {
      type: 'time',
      min: model.chartStartMs,
      max: model.horizonEndMs,
      boundaryGap: ['0%', '2%'],
      axisLine: { lineStyle: { color: tk.axisLine } },
      axisTick: { lineStyle: { color: tk.axisLine } },
      axisLabel: {
        color: tk.axisLabel,
        fontSize: 10,
        fontFamily: 'monospace',
        hideOverlap: true,
        margin: 8,
        formatter: (value: number) => formatShortTick(value, model.spansMultipleYears)
      }
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      interval: 20,
      axisLabel: { formatter: '{value}%', color: tk.axisLabel, fontSize: 10, fontFamily: 'monospace' },
      splitLine: { lineStyle: { color: tk.splitLine, type: 'dashed' } }
    },
    series: [
      {
        name: 'Planned Target (%)',
        type: 'line',
        smooth: 0.3,
        symbol: 'circle',
        symbolSize: milestoneSymbolSize(compact ? 5 : 6),
        showSymbol: true,
        itemStyle: { color: tk.plannedColor, borderColor: '#FFFFFF', borderWidth: 1.5 },
        lineStyle: {
          color: tk.plannedColor,
          width: 2.5,
          shadowColor: isLight ? 'rgba(38, 132, 199, 0.18)' : 'rgba(59, 130, 246, 0.4)',
          shadowBlur: 6
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: isLight ? 'rgba(38, 132, 199, 0.14)' : 'rgba(59, 130, 246, 0.22)' },
            { offset: 1, color: isLight ? 'rgba(38, 132, 199, 0.0)' : 'rgba(59, 130, 246, 0.0)' }
          ])
        },
        markArea: {
          silent: true,
          itemStyle: { color: tk.markAreaTint },
          data: [[{ xAxis: model.chartStartMs }, { xAxis: model.reportMs }]]
        },
        data: model.plannedSeries
      },
      {
        name: 'Actual Achieved (%)',
        type: 'line',
        smooth: 0.25,
        connectNulls: false,
        symbol: 'diamond',
        symbolSize: milestoneSymbolSize(compact ? 6 : 7),
        showSymbol: true,
        itemStyle: { color: tk.actualColor, borderColor: '#FFFFFF', borderWidth: 2 },
        lineStyle: {
          color: tk.actualColor,
          width: 3.2,
          shadowColor: isLight ? 'rgba(220, 76, 76, 0.22)' : 'rgba(239, 68, 68, 0.6)',
          shadowBlur: 8
        },
        data: model.actualSeries,
        markPoint: model.hasSufficientData
          ? {
              symbol: 'pin',
              symbolSize: compact ? 34 : 40,
              itemStyle: {
                color: tk.actualColor,
                shadowColor: isLight ? 'rgba(220, 76, 76, 0.35)' : 'rgba(239, 68, 68, 0.8)',
                shadowBlur: 10
              },
              label: {
                formatter: `${model.currentActualPct.toFixed(1)}%`,
                fontSize: 9,
                fontWeight: 'bold',
                color: '#FFFFFF',
                offset: [0, -2]
              },
              data: [{ name: 'Latest Actual', coord: [model.reportMs, Math.min(100, model.currentActualPct)] }]
            }
          : undefined
      },
      {
        name: 'Pace Forecast (Dotted)',
        type: 'line',
        smooth: 0.15,
        connectNulls: false,
        symbol: 'circle',
        symbolSize: milestoneSymbolSize(compact ? 4 : 5),
        showSymbol: true,
        itemStyle: { color: tk.forecastColor, borderColor: '#FFFFFF', borderWidth: 1 },
        lineStyle: {
          color: tk.forecastColor,
          width: 2.2,
          type: 'dashed',
          dashOffset: 4,
          shadowColor: isLight ? 'rgba(220, 76, 76, 0.16)' : 'rgba(244, 63, 94, 0.4)',
          shadowBlur: 6
        },
        data: model.forecastSeries,
        markLine: {
          symbol: ['none', 'none'],
          silent: true,
          data: [
            {
              xAxis: model.reportMs,
              lineStyle: { color: tk.asOfLine, type: 'dashed', width: 1.2 },
              label: {
                formatter: `As of ${formatShortTick(model.reportMs, false)}`,
                position: 'insideStartTop',
                color: tk.asOfLabel,
                fontSize: 9,
                fontFamily: 'monospace'
              }
            },
            {
              xAxis: model.contractFinishMs,
              lineStyle: { color: tk.contractFinish, type: 'dotted', width: 1.8 },
              label: {
                formatter: `Contract Finish\n(${formatShortTick(model.contractFinishMs, false)})`,
                position: 'insideEndTop',
                color: tk.contractFinish,
                fontSize: 9,
                fontWeight: 'bold'
              }
            }
          ]
        }
      }
    ]
  };
}
