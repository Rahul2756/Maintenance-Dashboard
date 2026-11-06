import React from 'react';
import {
  ActivityDefinition,
  ChainageInterval,
  StripCell,
  WorkZoneAnnotation as WorkZoneAnnotationType,
} from '../../types/stripChart';
import { WorkZoneAnnotation } from './WorkZoneAnnotation';

interface ActivityRowsProps {
  side: 'LHS' | 'RHS';
  activities: ActivityDefinition[];
  intervals: ChainageInterval[];
  columnWidths: number[];
  columnOffsets: number[];
  cellsByActivity: Record<string, StripCell[]>;
  workZones: WorkZoneAnnotationType[];
  hoveredIntervalIndex: number | null;
  colorMode: 'completion' | 'activity';
  onHoverCell: (
    info: {
      side: 'LHS' | 'RHS';
      activityName: string;
      interval: ChainageInterval;
      cell: StripCell;
    } | null,
    event?: React.MouseEvent
  ) => void;
  onHoverZone: (zone: WorkZoneAnnotationType | null, event?: React.MouseEvent) => void;
}

const getActivityColorClass = (id: string) => {
  switch (id) {
    case 'road_marking':
      return 'bg-cyan-500 hover:bg-cyan-400 text-cyan-950';
    case 'earthen_shoulder':
      return 'bg-amber-500 hover:bg-amber-400 text-amber-950';
    case 'bc_fw':
      return 'bg-emerald-500 hover:bg-emerald-400 text-emerald-950';
    case 'composite_glass_grid':
      return 'bg-indigo-500 hover:bg-indigo-400 text-indigo-950';
    case 'dbm':
      return 'bg-teal-500 hover:bg-teal-400 text-teal-950';
    case 'milling_dbm':
      return 'bg-rose-500 hover:bg-rose-400 text-rose-950';
    default:
      return 'bg-slate-600 hover:bg-slate-500 text-white';
  }
};

export const ActivityRows: React.FC<ActivityRowsProps> = ({
  side,
  activities,
  intervals,
  columnWidths,
  columnOffsets,
  cellsByActivity,
  workZones,
  hoveredIntervalIndex,
  colorMode,
  onHoverCell,
  onHoverZone,
}) => {
  return (
    <div className="relative flex flex-col divide-y divide-black/40 font-mono select-none">
      {/* Activity Rows */}
      {activities.map((act) => {
        const rowCells = cellsByActivity[act.id] || [];

        return (
          <div key={act.id} className="flex h-7 items-center relative group">
            {/* Interval Cells */}
            {intervals.map((inter, idx) => {
              const width = columnWidths[idx] || 60;
              const cell = rowCells[idx] || { status: 'planned', text: null, cellAddr: '' };
              const isHovered = hoveredIntervalIndex === idx;

              let colorClass = 'bg-[#181D26] hover:bg-[#202734] border border-black/40';
              let textStatus = 'Planned';

              if (colorMode === 'completion') {
                if (cell.status === 'completed') {
                  colorClass = 'bg-[#10B981] hover:bg-[#059669] border border-emerald-400/30 text-white font-bold shadow-sm shadow-emerald-500/10';
                  textStatus = 'Completed';
                } else if (cell.status === 'dps') {
                  colorClass = 'bg-[#334155] hover:bg-[#475569] border border-slate-500/30 text-slate-200';
                  textStatus = 'DPS Work Zone';
                } else if (cell.status === 'under_construction') {
                  colorClass = 'bg-[#EAB308] hover:bg-[#CA8A04] border border-amber-600/30 text-amber-950 font-bold';
                  textStatus = 'Under Construction';
                } else if (cell.status === 'himalayan') {
                  colorClass = 'bg-[#EA580C] hover:bg-[#C2410C] border border-orange-500/30 text-white font-bold';
                  textStatus = 'Himalayan';
                } else {
                  // Reference image shows delayed (red) or planned (cyan)
                  // For unexecuted intervals:
                  colorClass = 'bg-[#0284C7]/80 hover:bg-[#0369A1] border border-sky-400/30 text-sky-100';
                  textStatus = 'Future Planned';
                }
              } else {
                // Color by layer
                if (cell.status === 'completed') {
                  colorClass = `${getActivityColorClass(act.id)} border border-white/20 font-bold shadow-sm`;
                  textStatus = `${act.name} (Completed)`;
                } else {
                  colorClass = 'bg-[#1A222D] hover:bg-[#222C3A] border border-black/40 text-slate-500';
                  textStatus = `${act.name} (Planned)`;
                }
              }

              return (
                <div
                  key={`${act.id}-${inter.index}`}
                  style={{ width: `${width}px`, minWidth: `${width}px` }}
                  onMouseEnter={(e) =>
                    onHoverCell(
                      {
                        side,
                        activityName: act.name,
                        interval: inter,
                        cell,
                      },
                      e
                    )
                  }
                  onMouseLeave={() => onHoverCell(null)}
                  className={`h-full flex items-center justify-center p-0.5 cursor-pointer relative ${
                    isHovered ? 'z-10' : ''
                  }`}
                  title={`${side} - ${act.name} | Ch. ${inter.fromChainage} to ${inter.toChainage} (${inter.lengthM}m) | ${textStatus}`}
                >
                  <div
                    className={`w-full h-full rounded-[3px] transition-all flex items-center justify-center ${colorClass} ${
                      isHovered ? 'ring-2 ring-white scale-y-105 shadow-lg' : ''
                    }`}
                  >
                    {cell.status === 'completed' && width >= 48 && (
                      <span className="text-[8px] font-bold text-emerald-950 px-0.5 truncate">
                        ✓
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Special Work Zone Overlay Blocks */}
      <div className="absolute inset-0 pointer-events-none z-20">
        {workZones.map((zone) => {
          const startLeft = columnOffsets[zone.startIndex] || 0;
          const endRight = (columnOffsets[zone.endIndex] || 0) + (columnWidths[zone.endIndex] || 60);
          const totalWidth = Math.max(endRight - startLeft, 20);

          return (
            <WorkZoneAnnotation
              key={zone.id}
              zone={zone}
              leftPx={startLeft}
              widthPx={totalWidth}
              onHoverZone={onHoverZone}
            />
          );
        })}
      </div>
    </div>
  );
};
