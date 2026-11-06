import { ActualDPRRow, ProjectBaseline, ActivityType, HighwaySide } from '../types/dpr';
import { calculateUniqueLinearLength } from './excelParser';

export type MetricMode = 'quantity' | 'linear';

export interface ActivityProgressMetrics {
  activity: ActivityType;
  unit: string;
  linearUnit: string;

  // Quantity mode
  targetQuantity: number;
  achievedQuantity: number;
  remainingQuantity: number;
  quantityCompletionPercent: number;
  isQuantityOverachieved: boolean;
  quantityOverachievementPercent: number;

  // Linear mode
  targetLengthM: number;
  achievedLengthM: number;
  remainingLengthM: number;
  linearCompletionPercent: number;
  isLinearOverachieved: boolean;
  linearOverachievementPercent: number;

  // Side breakdown (Quantity)
  lhsTargetQuantity: number;
  lhsAchievedQuantity: number;
  lhsQuantityPercent: number;
  rhsTargetQuantity: number;
  rhsAchievedQuantity: number;
  rhsQuantityPercent: number;
  quantityDiffPP: number; // LHS % - RHS % (positive => LHS ahead)

  // Side breakdown (Linear)
  lhsTargetLengthM: number;
  lhsAchievedLengthM: number;
  lhsLinearPercent: number;
  rhsTargetLengthM: number;
  rhsAchievedLengthM: number;
  rhsLinearPercent: number;
  linearDiffPP: number; // LHS % - RHS % (positive => LHS ahead)
}

/**
 * Standard contractual targets from Revised Work program-R-1_05-11-2026.xlsx (WP-R1) baseline
 */
const BASELINE_TARGETS = {
  Milling: {
    totalQty: 681284.0,
    unit: 'Sqm',
    totalLen: 91176,
    lhsQty: 253249.5,
    rhsQty: 262048.5,
    lhsLen: 43758,
    rhsLen: 47418
  },
  Tackcoat: {
    totalQty: 1848270.0,
    unit: 'Sqm',
    totalLen: 103286,
    lhsQty: 715181.75,
    rhsQty: 779403.25,
    lhsLen: 49358,
    rhsLen: 53928
  },
  DBM: {
    totalQty: 37026.246,
    unit: 'Cum',
    totalLen: 91176,
    lhsQty: 14108.658,
    rhsQty: 14297.588,
    lhsLen: 43758,
    rhsLen: 47418
  },
  BC: {
    totalQty: 46679.48, // In Cum from Work Program
    unit: 'Cum',
    totalLen: 103286,
    lhsQty: 18477.29,
    rhsQty: 20694.19,
    lhsLen: 49358,
    rhsLen: 53928
  }
};

/**
 * Computes unified, rigorous progress metrics for both visualisations
 * using the actual DPR rows and immutable Work Program BOQ targets.
 */
export function computeActivityProgressMetrics(
  rows: ActualDPRRow[],
  baseline?: ProjectBaseline,
  sideFilter: HighwaySide = 'Both'
): ActivityProgressMetrics[] {
  const activities: ActivityType[] = ['Milling', 'Tackcoat', 'DBM', 'BC'];

  return activities.map(activity => {
    const base = BASELINE_TARGETS[activity];

    // Determine baseline targets (respecting side-filter if specified for overall visual)
    let targetQuantity = base.totalQty;
    let targetLengthM = base.totalLen;

    if (baseline) {
      if (activity === 'Milling') {
        targetQuantity = baseline.totalMillingTargetSqm || base.totalQty;
        targetLengthM = baseline.millingPlannedLengthM || base.totalLen;
      } else if (activity === 'Tackcoat') {
        targetQuantity = baseline.totalTackcoatTargetSqm || base.totalQty;
        targetLengthM = baseline.tackcoatPlannedLengthM || base.totalLen;
      } else if (activity === 'DBM') {
        targetQuantity = baseline.totalDbmTargetCum || base.totalQty;
        targetLengthM = baseline.dbmPlannedLengthM || base.totalLen;
      } else if (activity === 'BC') {
        targetQuantity = baseline.totalBcTargetCum || base.totalQty;
        targetLengthM = baseline.totalBcTargetLengthM || base.totalLen;
      }
    }

    // Side-specific baseline targets
    let lhsTargetQuantity = base.lhsQty;
    let rhsTargetQuantity = base.rhsQty;
    let lhsTargetLengthM = base.lhsLen;
    let rhsTargetLengthM = base.rhsLen;

    if (baseline?.lhs && baseline?.rhs) {
      if (activity === 'Milling') {
        lhsTargetQuantity = baseline.lhs.millingTargetSqm || base.lhsQty;
        rhsTargetQuantity = baseline.rhs.millingTargetSqm || base.rhsQty;
        lhsTargetLengthM = baseline.lhs.millingLengthM || base.lhsLen;
        rhsTargetLengthM = baseline.rhs.millingLengthM || base.rhsLen;
      } else if (activity === 'Tackcoat') {
        lhsTargetQuantity = baseline.lhs.tackcoatTargetSqm || base.lhsQty;
        rhsTargetQuantity = baseline.rhs.tackcoatTargetSqm || base.rhsQty;
        lhsTargetLengthM = baseline.lhs.tackcoatLengthM || base.lhsLen;
        rhsTargetLengthM = baseline.rhs.tackcoatLengthM || base.rhsLen;
      } else if (activity === 'DBM') {
        lhsTargetQuantity = baseline.lhs.dbmTargetCum || base.lhsQty;
        rhsTargetQuantity = baseline.rhs.dbmTargetCum || base.rhsQty;
        lhsTargetLengthM = baseline.lhs.dbmLengthM || base.lhsLen;
        rhsTargetLengthM = baseline.rhs.dbmLengthM || base.rhsLen;
      } else if (activity === 'BC') {
        lhsTargetQuantity = baseline.lhs.bcTargetCum || base.lhsQty;
        rhsTargetQuantity = baseline.rhs.bcTargetCum || base.rhsQty;
        lhsTargetLengthM = baseline.lhs.bcLengthM || base.lhsLen;
        rhsTargetLengthM = baseline.rhs.bcLengthM || base.rhsLen;
      }
    }

    // If overall side filter is set to LHS or RHS, adjust overall target
    if (sideFilter === 'LHS') {
      targetQuantity = lhsTargetQuantity;
      targetLengthM = lhsTargetLengthM;
    } else if (sideFilter === 'RHS') {
      targetQuantity = rhsTargetQuantity;
      targetLengthM = rhsTargetLengthM;
    }

    // Filter rows for this specific activity
    const activityRows = rows.filter(r => r.activity === activity);

    let achievedQuantity = 0;
    let lhsAchievedQuantity = 0;
    let rhsAchievedQuantity = 0;

    activityRows.forEach(r => {
      let q = r.achievedToday || 0;
      const u = (r.unit || '').trim().toLowerCase();

      // DBM target and metrics are in Cum (only for DBM)
      if (activity === 'DBM') {
        if (u.includes('mt') || u.includes('ton')) {
          q = q / 2.38; // Convert MT to Cum if recorded in MT
        }
      }
      // Conversion for BC (target is in Cum)
      else if (activity === 'BC') {
        if (u.includes('mt') || u.includes('ton')) {
          q = q / 2.35; // Convert MT to Cum if recorded in MT
        }
      }

      // Overall achieved (filtered according to sideFilter in rows)
      achievedQuantity += q;

      // Side breakdown
      if (r.side === 'LHS') {
        lhsAchievedQuantity += q;
      } else if (r.side === 'RHS') {
        rhsAchievedQuantity += q;
      }
    });

    // Unique non-overlapping linear physical length calculation
    const achievedLengthM = calculateUniqueLinearLength(activityRows, activity, sideFilter).meters;
    const lhsAchievedLengthM = calculateUniqueLinearLength(activityRows, activity, 'LHS').meters;
    const rhsAchievedLengthM = calculateUniqueLinearLength(activityRows, activity, 'RHS').meters;

    // Quantity calculations
    const remainingQuantity = Math.max(0, targetQuantity - achievedQuantity);
    const quantityCompletionPercent =
      targetQuantity > 0 ? (achievedQuantity / targetQuantity) * 100 : 0;
    const isQuantityOverachieved = achievedQuantity > targetQuantity;
    const quantityOverachievementPercent = isQuantityOverachieved
      ? Math.max(0, quantityCompletionPercent - 100)
      : 0;

    // Linear calculations
    const remainingLengthM = Math.max(0, targetLengthM - achievedLengthM);
    const linearCompletionPercent =
      targetLengthM > 0 ? (achievedLengthM / targetLengthM) * 100 : 0;
    const isLinearOverachieved = achievedLengthM > targetLengthM;
    const linearOverachievementPercent = isLinearOverachieved
      ? Math.max(0, linearCompletionPercent - 100)
      : 0;

    // Side breakdown percentages
    const lhsQuantityPercent =
      lhsTargetQuantity > 0 ? (lhsAchievedQuantity / lhsTargetQuantity) * 100 : 0;
    const rhsQuantityPercent =
      rhsTargetQuantity > 0 ? (rhsAchievedQuantity / rhsTargetQuantity) * 100 : 0;
    const quantityDiffPP = lhsQuantityPercent - rhsQuantityPercent;

    const lhsLinearPercent =
      lhsTargetLengthM > 0 ? (lhsAchievedLengthM / lhsTargetLengthM) * 100 : 0;
    const rhsLinearPercent =
      rhsTargetLengthM > 0 ? (rhsAchievedLengthM / rhsTargetLengthM) * 100 : 0;
    const linearDiffPP = lhsLinearPercent - rhsLinearPercent;

    return {
      activity,
      unit: base.unit,
      linearUnit: 'm',
      targetQuantity,
      achievedQuantity,
      remainingQuantity,
      quantityCompletionPercent,
      isQuantityOverachieved,
      quantityOverachievementPercent,
      targetLengthM,
      achievedLengthM,
      remainingLengthM,
      linearCompletionPercent,
      isLinearOverachieved,
      linearOverachievementPercent,
      lhsTargetQuantity,
      lhsAchievedQuantity,
      lhsQuantityPercent,
      rhsTargetQuantity,
      rhsAchievedQuantity,
      rhsQuantityPercent,
      quantityDiffPP,
      lhsTargetLengthM,
      lhsAchievedLengthM,
      lhsLinearPercent,
      rhsTargetLengthM,
      rhsAchievedLengthM,
      rhsLinearPercent,
      linearDiffPP
    };
  });
}

