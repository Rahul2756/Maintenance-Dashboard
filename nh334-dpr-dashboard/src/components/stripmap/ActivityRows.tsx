import React from 'react';
import {
  ActivityDefinition,
  ChainageInterval,
  StripCell,
  WorkZoneAnnotation,
  CompletedWorkSubInterval,
  SubIntervalFill,
} from '../../types/stripChart';
import { computeSubFills, formatChainage } from '../../utils/stripChartExcelParser';

export interface HoveredSliceInfo {
  side: 'LHS' | 'RHS';
  activityId: string;
  activityName: string;
  interval: ChainageInterval;
  fill: SubIntervalFill;
  statusCategory: 'dps' | 'under_construction' | 'himalayan' | 'completed' | 'eligible_scope';
  statusLabel: string;
}

interface ActivityRowsProps {
  side: 'LHS' | 'RHS';
  activities: ActivityDefinition[];
  intervals: ChainageInterval[];
  columnWidths: number[];
  columnOffsets: number[];
  cellsByActivity: Record<string, StripCell[]>;
  workZones: WorkZoneAnnotation[];
  hoveredIntervalIndex: number | null;
  completedLogs: CompletedWorkSubInterval[];
  selectedDate: string | null;
  onHoverSlice: (info: HoveredSliceInfo | null, event?: React.MouseEvent) => void;
  onClickSlice: (info: HoveredSliceInfo) => void;
}

export const ActivityRows: React.FC<ActivityRowsProps> = ({
  side,
  activities,
  intervals,
  columnWidths,
  columnOffsets,
  cellsByActivity,
  workZones,
  hoveredIntervalIndex,
  completedLogs,
  selectedDate,
  onHoverSlice,
  onClickSlice,
}) => {
  return (
    <div className="relative flex flex-col divide-y divide-black/40 font-mono select-none">
      {activities.map((act) => {
        return (
          <div key={`${side}-${act.id}`} className="flex h-7 items-center relative group">
            {intervals.map((inter, idx) => {
              const width = columnWidths[idx] || 60;
              const isHoveredCol = hoveredIntervalIndex === idx;

              // Compute proportional sub-interval fills for this segment
              const fills = computeSubFills(
                inter,
                side,
                act.id,
                completedLogs,
                workZones,
                selectedDate
              );

              return (
                <div
                  key={`${side}-${act.id}-${inter.index}`}
                  style={{ width: `${width}px`, minWidth: `${width}px` }}
                  className={`h-full relative flex items-center border-r border-black/40 transition-colors ${
                    isHoveredCol ? 'ring-1 ring-cyan-400/50 z-20' : ''
                  }`}
                >
                  {fills.map((fill, fIdx) => {
                    let bgClass = 'bg-[#0E2033] border-cyan-500/20';
                    let statusCategory: 'dps' | 'under_construction' | 'himalayan' | 'completed' | 'eligible_scope' = 'eligible_scope';
                    let statusLabel = 'Eligible Work Scope';

                    if (fill.isExclusion) {
                      if (fill.exclusionType === 'dps') {
                        bgClass = 'bg-purple-900/60 border-purple-500/50 hover:bg-purple-800/80 text-purple-200';
                        statusCategory = 'dps';
                        statusLabel = 'Work Done by DPS';
                      } else if (fill.exclusionType === 'under_construction') {
                        bgClass = 'bg-amber-900/60 border-amber-500/50 hover:bg-amber-800/80 text-amber-200';
                        statusCategory = 'under_construction';
                        statusLabel = 'Under Construction';
                      } else if (fill.exclusionType === 'himalayan') {
                        bgClass = 'bg-pink-900/60 border-pink-500/50 hover:bg-pink-800/80 text-pink-200';
                        statusCategory = 'himalayan';
                        statusLabel = 'Himalayan';
                      }
                    } else if (fill.isCompleted) {
                      bgClass = 'bg-emerald-500 hover:bg-emerald-400 border-emerald-300 shadow-sm shadow-emerald-500/30 text-white font-bold animate-fade-in';
                      statusCategory = 'completed';
                      statusLabel = 'Completed by Our Team';
                    } else {
                      bgClass = 'bg-sky-950/40 hover:bg-sky-900/60 border-sky-500/20 text-sky-300';
                      statusCategory = 'eligible_scope';
                      statusLabel = 'Remaining Eligible Scope';
                    }

                    const sliceInfo: HoveredSliceInfo = {
                      side,
                      activityId: act.id,
                      activityName: act.name,
                      interval: inter,
                      fill,
                      statusCategory,
                      statusLabel,
                    };

                    const hasConflict = fill.logRecords.some(l => l.hasConflict);

                    return (
                      <div
                        key={`fill-${inter.index}-${fIdx}`}
                        style={{
                          left: `${fill.startPct}%`,
                          width: `${fill.widthPct}%`,
                        }}
                        onMouseEnter={(e) => onHoverSlice(sliceInfo, e)}
                        onMouseLeave={() => onHoverSlice(null)}
                        onClick={() => onClickSlice(sliceInfo)}
                        className={`absolute top-0.5 bottom-0.5 rounded-[2px] border transition-all duration-100 cursor-pointer flex items-center justify-center overflow-hidden ${bgClass} ${
                          hasConflict ? 'ring-1 ring-amber-400' : ''
                        }`}
                        title={`${statusLabel}: Ch. ${formatChainage(fill.fromM)} to ${formatChainage(fill.toM)} (${fill.lengthM}m)`}
                      >
                        {/* Text label inside slice if wide enough */}
                        {fill.widthPct > 65 && width > 50 && (
                          <span className="text-[9px] font-bold truncate px-1 drop-shadow-sm select-none">
                            {fill.isCompleted
                              ? 'DONE'
                              : fill.isExclusion
                              ? fill.exclusionType === 'dps'
                                ? 'DPS'
                                : fill.exclusionType === 'under_construction'
                                ? 'U/C'
                                : 'HIM'
                              : ''}
                          </span>
                        )}
                        {hasConflict && (
                          <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping" />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
