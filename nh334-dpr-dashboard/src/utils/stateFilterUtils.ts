import { ActualDPRRow, PlannedRecord, ProjectBaseline, StretchWiseTemplateRow } from '../types/dpr';
import {
  StripChartDataset,
  ChainageInterval,
  StripCell,
  WorkZoneAnnotation,
  CompletedWorkSubInterval,
  StripChartMetadata
} from '../types/stripChart';

export type StateFilter = 'All' | 'Uttar Pradesh' | 'Uttarakhand';

export interface StateBoundaryConfig {
  state: StateFilter;
  label: string;
  shortLabel: string;
  minKm: number;
  maxKm: number;
  minM: number;
  maxM: number;
  lengthKm: number;
  geographicEndKm?: number;
}

/**
 * Central State Boundaries Reference Configuration
 * - Uttar Pradesh: Ch. 130+560 to 151+360 (20.80 km)
 * - Uttarakhand (intersected with active project corridor Ch. 206+220): Ch. 151+360 to 206+220 (54.86 km)
 * - Full Corridor: Ch. 130+560 to 206+220 (75.66 km)
 */
export const STATE_BOUNDARIES: Record<StateFilter, StateBoundaryConfig> = {
  'All': {
    state: 'All',
    label: 'All States',
    shortLabel: 'All States',
    minKm: 130.560,
    maxKm: 206.220,
    minM: 130560,
    maxM: 206220,
    lengthKm: 75.66
  },
  'Uttar Pradesh': {
    state: 'Uttar Pradesh',
    label: 'Uttar Pradesh',
    shortLabel: 'UP',
    minKm: 130.560,
    maxKm: 151.360,
    minM: 130560,
    maxM: 151360,
    lengthKm: 20.80
  },
  'Uttarakhand': {
    state: 'Uttarakhand',
    label: 'Uttarakhand',
    shortLabel: 'UK',
    minKm: 151.360,
    maxKm: 206.220,
    minM: 151360,
    maxM: 206220,
    lengthKm: 54.86,
    geographicEndKm: 209.120
  }
};

/**
 * Calculates chainage overlap and proportional splitting ratio for a given segment against state boundaries
 */
export function getRecordStateOverlap(
  fromKm: number,
  toKm: number,
  state: StateFilter
): {
  included: boolean;
  overlapKm: number;
  ratio: number;
  clippedFromKm: number;
  clippedToKm: number;
} {
  if (state === 'All') {
    return {
      included: true,
      overlapKm: Math.abs(toKm - fromKm),
      ratio: 1.0,
      clippedFromKm: fromKm,
      clippedToKm: toKm
    };
  }

  const boundary = STATE_BOUNDARIES[state];
  const minCh = Math.min(fromKm, toKm);
  const maxCh = Math.max(fromKm, toKm);
  const span = maxCh - minCh;

  if (span <= 0) {
    const inside = minCh >= boundary.minKm && minCh <= boundary.maxKm;
    return {
      included: inside,
      overlapKm: 0,
      ratio: inside ? 1.0 : 0,
      clippedFromKm: fromKm,
      clippedToKm: toKm
    };
  }

  const overlapStart = Math.max(minCh, boundary.minKm);
  const overlapEnd = Math.min(maxCh, boundary.maxKm);

  if (overlapEnd <= overlapStart) {
    return {
      included: false,
      overlapKm: 0,
      ratio: 0,
      clippedFromKm: fromKm,
      clippedToKm: toKm
    };
  }

  const overlapKm = overlapEnd - overlapStart;
  const ratio = overlapKm / span;
  const isAscending = fromKm <= toKm;

  return {
    included: true,
    overlapKm,
    ratio,
    clippedFromKm: isAscending ? overlapStart : overlapEnd,
    clippedToKm: isAscending ? overlapEnd : overlapStart
  };
}

/**
 * Filter and split actual DPR rows by state with boundary splitting at Ch. 151+360
 */
export function filterAndSplitRowsByState(
  rows: ActualDPRRow[],
  state: StateFilter
): ActualDPRRow[] {
  if (!rows || rows.length === 0 || state === 'All') {
    return rows;
  }

  const result: ActualDPRRow[] = [];

  for (const r of rows) {
    const overlap = getRecordStateOverlap(r.fromChainage, r.toChainage, state);
    if (!overlap.included || overlap.ratio <= 0) {
      continue;
    }

    if (overlap.ratio >= 0.9999) {
      // Record entirely within state
      result.push(r);
    } else {
      // Record crosses state boundary: split quantities proportionally
      const ratio = overlap.ratio;
      const clippedFromKm = Number(overlap.clippedFromKm.toFixed(3));
      const clippedToKm = Number(overlap.clippedToKm.toFixed(3));
      const rawFrom = Math.round(clippedFromKm * 1000);
      const rawTo = Math.round(clippedToKm * 1000);
      const splitLengthM = Math.round(r.lengthM * ratio);

      result.push({
        ...r,
        id: `${r.id}-${state === 'Uttar Pradesh' ? 'UP' : 'UK'}`,
        fromChainage: Math.min(clippedFromKm, clippedToKm),
        toChainage: Math.max(clippedFromKm, clippedToKm),
        rawFromChainage: rawFrom,
        rawToChainage: rawTo,
        lengthM: splitLengthM,
        achievedToday: Number((r.achievedToday * ratio).toFixed(2)),
        cumulativeAchieved: Number((r.cumulativeAchieved * ratio).toFixed(2)),
        plannedToday: r.plannedToday !== null ? Number((r.plannedToday * ratio).toFixed(2)) : null
      });
    }
  }

  return result;
}

/**
 * Filter and split planned records by state
 */
export function filterAndSplitPlannedRecordsByState(
  records: PlannedRecord[],
  state: StateFilter
): PlannedRecord[] {
  if (!records || records.length === 0 || state === 'All') {
    return records;
  }

  const result: PlannedRecord[] = [];

  for (const r of records) {
    if (!r.chainageFrom && !r.chainageTo) {
      const boundary = STATE_BOUNDARIES[state];
      const ratio = boundary.lengthKm / 75.66;
      result.push({
        ...r,
        totalQty: r.totalQty ? Number((r.totalQty * ratio).toFixed(2)) : 0,
        lengthM: Math.round(r.lengthM * ratio),
        millingAreaSqm: Number((r.millingAreaSqm * ratio).toFixed(2)),
        dbmVolumeCum: Number((r.dbmVolumeCum * ratio).toFixed(2)),
        dbmMT: Number((r.dbmMT * ratio).toFixed(2))
      });
      continue;
    }

    const overlap = getRecordStateOverlap(r.chainageFrom, r.chainageTo, state);
    if (!overlap.included || overlap.ratio <= 0) {
      continue;
    }

    if (overlap.ratio >= 0.9999) {
      result.push(r);
    } else {
      const ratio = overlap.ratio;
      result.push({
        ...r,
        chainageFrom: overlap.clippedFromKm,
        chainageTo: overlap.clippedToKm,
        totalQty: r.totalQty ? Number((r.totalQty * ratio).toFixed(2)) : 0,
        lengthM: Math.round(r.lengthM * ratio),
        millingAreaSqm: Number((r.millingAreaSqm * ratio).toFixed(2)),
        dbmVolumeCum: Number((r.dbmVolumeCum * ratio).toFixed(2)),
        dbmMT: Number((r.dbmMT * ratio).toFixed(2))
      });
    }
  }

  return result;
}

/**
 * Filter and proportionally scale stretch-wise template rows by state
 */
export function filterStretchWiseTemplateByState(
  template: StretchWiseTemplateRow[] | undefined,
  state: StateFilter
): StretchWiseTemplateRow[] {
  if (!template || template.length === 0 || state === 'All') {
    return template || [];
  }

  // Stretch 1 spans Ch. 130+560 to 167+250 (36.69 km total)
  // UP portion: Ch. 130+560 to 151+360 (20.80 km) -> ratio 20.80 / 36.69
  // UK portion: Ch. 151+360 to 167+250 (15.89 km) -> ratio 15.89 / 36.69
  const upRatio = 20.80 / 36.69;
  const ukRatio = 15.89 / 36.69;

  return template.map(r => {
    let s1 = r.stretch1PlannedKm;
    let s2 = r.stretch2PlannedKm;
    let s3 = r.stretch3PlannedKm;

    if (state === 'Uttar Pradesh') {
      s1 = Number((r.stretch1PlannedKm * upRatio).toFixed(3));
      s2 = 0;
      s3 = 0;
    } else if (state === 'Uttarakhand') {
      s1 = Number((r.stretch1PlannedKm * ukRatio).toFixed(3));
      // Stretches 2 & 3 are 100% within Uttarakhand
    }

    const total = Number((s1 + s2 + s3).toFixed(3));

    return {
      ...r,
      stretch1PlannedKm: s1,
      stretch2PlannedKm: s2,
      stretch3PlannedKm: s3,
      totalPlannedKm: total
    };
  });
}

/**
 * Filter Project Baseline by state
 */
export function filterBaselineByState(
  baseline: ProjectBaseline,
  state: StateFilter
): ProjectBaseline {
  if (state === 'All') {
    return baseline;
  }

  const boundary = STATE_BOUNDARIES[state];
  const isUp = state === 'Uttar Pradesh';

  // State BOQ targets derived from Work Program chainage line items:
  // UP: Milling: 186235.7, Tack: 493585.7, DBM: 10761.6, BC: 12162.5
  // UK: Milling: 495048.3, Tack: 1354684.8, DBM: 26264.6, BC: 34517.0
  const millingTargetSqm = isUp ? 186235.7 : 495048.3;
  const tackcoatTargetSqm = isUp ? 493585.7 : 1354684.8;
  const dbmTargetCum = isUp ? 10761.6 : 26264.6;
  const dbmTargetMT = Number((dbmTargetCum * 2.38).toFixed(2));
  const bcTargetCum = isUp ? 12162.5 : 34517.0;
  const bcTargetMT = Number((bcTargetCum * 2.35).toFixed(2));

  // Linear target lengths split from Stretch-wise Summary:
  // Milling & DBM: UP = 43097 m, UK = 104131 m
  // Tack: UP = 68249 m, UK = 166865 m
  // BC: UP = 29545 m, UK = 73741 m
  const millingLenM = isUp ? 43097 : 104131;
  const dbmLenM = isUp ? 43097 : 104131;
  const tackLenM = isUp ? 68249 : 166865;
  const bcLenM = isUp ? 29545 : 73741;

  // Carriageway LHS & RHS breakdown
  const lhsMillingLenM = isUp ? 22416 : 49941;
  const rhsMillingLenM = isUp ? 20681 : 54190;
  const lhsDbmLenM = isUp ? 22416 : 49941;
  const rhsDbmLenM = isUp ? 20681 : 54190;
  const lhsTackLenM = isUp ? 35025 : 80090;
  const rhsTackLenM = isUp ? 33225 : 86774;
  const lhsBcLenM = isUp ? 14555 : 34803;
  const rhsBcLenM = isUp ? 14990 : 38938;

  const stateRatio = boundary.lengthKm / 75.66;

  return {
    ...baseline,
    minChainage: boundary.minKm,
    maxChainage: boundary.maxKm,
    totalScopeKm: boundary.lengthKm,
    totalMillingTargetSqm: millingTargetSqm,
    totalTackcoatTargetSqm: tackcoatTargetSqm,
    totalDbmTargetCum: dbmTargetCum,
    totalDbmTargetMT: dbmTargetMT,
    totalBcTargetCum: bcTargetCum,
    totalBcTargetMT: bcTargetMT,
    totalPlannedLengthM: millingLenM,
    millingPlannedLengthM: millingLenM,
    dbmPlannedLengthM: dbmLenM,
    tackcoatPlannedLengthM: tackLenM,
    totalBcTargetLengthM: bcLenM,
    lhs: baseline.lhs ? {
      ...baseline.lhs,
      millingTargetSqm: Number((baseline.lhs.millingTargetSqm * stateRatio).toFixed(1)),
      tackcoatTargetSqm: Number((baseline.lhs.tackcoatTargetSqm * stateRatio).toFixed(1)),
      dbmTargetCum: Number((baseline.lhs.dbmTargetCum * stateRatio).toFixed(2)),
      dbmTargetMT: Number((baseline.lhs.dbmTargetCum * stateRatio * 2.38).toFixed(2)),
      bcTargetCum: baseline.lhs.bcTargetCum ? Number((baseline.lhs.bcTargetCum * stateRatio).toFixed(2)) : undefined,
      bcTargetMT: baseline.lhs.bcTargetCum ? Number((baseline.lhs.bcTargetCum * stateRatio * 2.35).toFixed(2)) : undefined,
      millingLengthM: lhsMillingLenM,
      dbmLengthM: lhsDbmLenM,
      tackcoatLengthM: lhsTackLenM,
      bcLengthM: lhsBcLenM
    } : undefined,
    rhs: baseline.rhs ? {
      ...baseline.rhs,
      millingTargetSqm: Number((baseline.rhs.millingTargetSqm * stateRatio).toFixed(1)),
      tackcoatTargetSqm: Number((baseline.rhs.tackcoatTargetSqm * stateRatio).toFixed(1)),
      dbmTargetCum: Number((baseline.rhs.dbmTargetCum * stateRatio).toFixed(2)),
      dbmTargetMT: Number((baseline.rhs.dbmTargetCum * stateRatio * 2.38).toFixed(2)),
      bcTargetCum: baseline.rhs.bcTargetCum ? Number((baseline.rhs.bcTargetCum * stateRatio).toFixed(2)) : undefined,
      bcTargetMT: baseline.rhs.bcTargetCum ? Number((baseline.rhs.bcTargetCum * stateRatio * 2.35).toFixed(2)) : undefined,
      millingLengthM: rhsMillingLenM,
      dbmLengthM: rhsDbmLenM,
      tackcoatLengthM: rhsTackLenM,
      bcLengthM: rhsBcLenM
    } : undefined,
    stretchWiseTemplate: filterStretchWiseTemplateByState(baseline.stretchWiseTemplate, state)
  };
}

/**
 * Filter daily planned targets by state
 */
export function filterDailyPlannedTargetsByState<T extends Record<string, any>>(
  dailyTargets: Record<string, T>,
  state: StateFilter
): Record<string, T> {
  if (state === 'All') {
    return dailyTargets;
  }

  const boundary = STATE_BOUNDARIES[state];
  const ratio = boundary.lengthKm / 75.66;
  const result: Record<string, T> = {};

  for (const [date, val] of Object.entries(dailyTargets)) {
    const scaled: any = { ...val };
    for (const [k, v] of Object.entries(val)) {
      if (typeof v === 'number') {
        scaled[k] = Number((v * ratio).toFixed(2));
      }
    }
    result[date] = scaled;
  }

  return result;
}

function formatMToChainage(metres: number): string {
  const km = Math.floor(metres / 1000);
  const m = Math.abs(metres % 1000);
  return `${km}+${String(m).padStart(3, '0')}`;
}

/**
 * Filter and clip Strip Chart dataset by state boundaries
 */
export function filterStripChartDatasetByState(
  dataset: StripChartDataset | null | undefined,
  state: StateFilter
): StripChartDataset | null {
  if (!dataset) return null;
  if (!state || state === 'All') return dataset;

  const boundary = STATE_BOUNDARIES[state];
  const minM = boundary.minM;
  const maxM = boundary.maxM;

  // Find intervals that overlap with [minM, maxM]
  const keepIndices: number[] = [];
  dataset.intervals.forEach((inter, idx) => {
    const interMin = Math.min(inter.fromM, inter.toM);
    const interMax = Math.max(inter.fromM, inter.toM);
    if (interMax > minM && interMin < maxM) {
      keepIndices.push(idx);
    }
  });

  if (keepIndices.length === 0) {
    return dataset;
  }

  // Remap and clip intervals at boundaries
  const filteredIntervals: ChainageInterval[] = keepIndices.map((origIdx, newIdx) => {
    const orig = dataset.intervals[origIdx];
    const clippedFromM = Math.max(orig.fromM, minM);
    const clippedToM = Math.min(orig.toM, maxM);
    const lenM = Math.max(0, clippedToM - clippedFromM);
    return {
      ...orig,
      index: newIdx,
      fromM: clippedFromM,
      toM: clippedToM,
      lengthM: lenM,
      calculatedLengthM: lenM,
      fromChainage: formatMToChainage(clippedFromM),
      toChainage: formatMToChainage(clippedToM),
    };
  });

  // Remap cells for all activities
  const filteredLhsCells: Record<string, StripCell[]> = {};
  const filteredRhsCells: Record<string, StripCell[]> = {};

  Object.keys(dataset.lhsCells || {}).forEach(actId => {
    filteredLhsCells[actId] = keepIndices.map(idx => dataset.lhsCells[actId]?.[idx] || { status: 'eligible_scope', text: null, cellAddr: '' });
  });

  Object.keys(dataset.rhsCells || {}).forEach(actId => {
    filteredRhsCells[actId] = keepIndices.map(idx => dataset.rhsCells[actId]?.[idx] || { status: 'eligible_scope', text: null, cellAddr: '' });
  });

  // Filter and clip work zones
  const remapWorkZones = (zones: WorkZoneAnnotation[]): WorkZoneAnnotation[] => {
    if (!zones) return [];
    return zones
      .filter(z => {
        const zMin = Math.min(z.fromM, z.toM);
        const zMax = Math.max(z.fromM, z.toM);
        return zMax > minM && zMin < maxM;
      })
      .map((z, i) => {
        const clippedFromM = Math.max(z.fromM, minM);
        const clippedToM = Math.min(z.toM, maxM);
        return {
          ...z,
          id: `${z.id}-${state === 'Uttar Pradesh' ? 'UP' : 'UK'}-${i}`,
          fromM: clippedFromM,
          toM: clippedToM,
          fromChainage: formatMToChainage(clippedFromM),
          toChainage: formatMToChainage(clippedToM),
          totalLengthM: Math.max(0, clippedToM - clippedFromM),
        };
      });
  };

  // Filter and clip completed logs
  const filteredLogs: CompletedWorkSubInterval[] = (dataset.completedLogs || [])
    .filter(l => {
      const lMin = Math.min(l.fromM, l.toM);
      const lMax = Math.max(l.fromM, l.toM);
      return lMax > minM && lMin < maxM;
    })
    .map(l => {
      const clippedFromM = Math.max(l.fromM, minM);
      const clippedToM = Math.min(l.toM, maxM);
      const ratio = l.lengthM > 0 ? (clippedToM - clippedFromM) / l.lengthM : 1;
      return {
        ...l,
        fromM: clippedFromM,
        toM: clippedToM,
        lengthM: Math.max(0, clippedToM - clippedFromM),
        achievedQty: l.achievedQty !== undefined ? Number((l.achievedQty * ratio).toFixed(2)) : undefined,
      };
    });

  const firstInter = filteredIntervals[0];
  const lastInter = filteredIntervals[filteredIntervals.length - 1];

  const metadata: StripChartMetadata = {
    ...dataset.metadata,
    title: `${dataset.metadata.title} [${boundary.label}]`,
    startChainage: firstInter?.fromChainage || formatMToChainage(minM),
    endChainage: lastInter?.toChainage || formatMToChainage(maxM),
    startM: minM,
    endM: maxM,
    totalLengthM: maxM - minM,
    totalIntervals: filteredIntervals.length,
    chainageSpanText: `Ch. ${formatMToChainage(minM)} to ${formatMToChainage(maxM)} (${boundary.lengthKm.toFixed(2)} km)`,
  };

  return {
    ...dataset,
    metadata,
    intervals: filteredIntervals,
    lhsCells: filteredLhsCells,
    rhsCells: filteredRhsCells,
    lhsWorkZones: remapWorkZones(dataset.lhsWorkZones),
    rhsWorkZones: remapWorkZones(dataset.rhsWorkZones),
    completedLogs: filteredLogs,
  };
}
