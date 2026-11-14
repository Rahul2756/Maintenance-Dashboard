import React, { useState } from 'react';
import { ActualDPRRow, ActivityType, ProjectBaseline, PlannedRecord } from '../../types/dpr';
import { GitCommit, ChevronDown, ChevronUp } from 'lucide-react';
import { SpatialMapModule } from '../modules/SpatialMapModule';
import { StripChartDataset } from '../../types/stripChart';
import { useFilters } from '../../context/FilterContext';
import { STATE_BOUNDARIES } from '../../utils/stateFilterUtils';

interface LinearChainageStripProps {
  rows?: ActualDPRRow[];
  minChainage?: number;
  maxChainage?: number;
  baseline?: ProjectBaseline;
  selectedActivities?: ActivityType[];
  onSelectRow?: (row: ActualDPRRow) => void;
  plannedRecords?: PlannedRecord[];
  reportDate?: string;
  onSelectChainage?: (chainageM: number) => void;
  targetChainageM?: number | null;
  onStripDatasetLoaded?: (dataset: StripChartDataset) => void;
}

export const LinearChainageStrip: React.FC<LinearChainageStripProps> = ({
  onSelectChainage,
  targetChainageM,
  onStripDatasetLoaded
}) => {
  const { filters } = useFilters();
  const selectedState = filters.state || 'All';
  const stateBoundary = STATE_BOUNDARIES[selectedState];

  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="space-y-3">
      {/* Master Format Linear Progression Grid Header & Collapse Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#111317] p-2 rounded-xl border border-white/10 select-none shadow-lg">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm">
            <GitCommit className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              NH-334 Linear Progression Grid (
              {selectedState === 'All'
                ? 'Ch. 130+560 to 206+220'
                : `${stateBoundary.shortLabel}: Ch. ${stateBoundary.minKm.toFixed(3)} to ${stateBoundary.maxKm.toFixed(3)}`}
              )
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 font-bold">
              Master Format
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
            title={isCollapsed ? 'Expand Strip Chart' : 'Collapse Strip Chart to focus on GIS'}
          >
            {isCollapsed ? (
              <>
                <ChevronDown className="w-3.5 h-3.5 text-cyan-400" />
                <span>Show Master Strip Chart</span>
              </>
            ) : (
              <>
                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                <span>Hide / Collapse</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Official Master Format Strip Chart */}
      {!isCollapsed && (
        <SpatialMapModule
          onSelectChainage={onSelectChainage}
          targetChainageM={targetChainageM}
          onDatasetLoaded={onStripDatasetLoaded}
        />
      )}
    </div>
  );
};

export default LinearChainageStrip;
