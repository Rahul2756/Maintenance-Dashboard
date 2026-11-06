import React from 'react';
import {
  Layers,
  Route,
  Shield,
  Hash,
  Truck,
  Hammer,
  Sparkles,
  CheckSquare,
} from 'lucide-react';
import { ActivityDefinition } from '../../types/stripChart';

interface ActivitySidebarProps {
  activities: ActivityDefinition[];
  selectedActivityId: string; // 'all' or activity.id
  onSelectActivity: (id: string) => void;
  className?: string;
}

export const getActivityIcon = (id: string, className = 'w-4 h-4') => {
  switch (id) {
    case 'road_marking':
      return <Route className={className} />;
    case 'earthen_shoulder':
      return <Shield className={className} />;
    case 'bc_fw':
      return <Sparkles className={className} />;
    case 'composite_glass_grid':
      return <Hash className={className} />;
    case 'dbm':
      return <Truck className={className} />;
    case 'milling_dbm':
      return <Hammer className={className} />;
    default:
      return <Layers className={className} />;
  }
};

export const ActivitySidebar: React.FC<ActivitySidebarProps> = ({
  activities,
  selectedActivityId,
  onSelectActivity,
  className = '',
}) => {
  return (
    <div
      className={`w-52 sm:w-60 shrink-0 bg-[#12161D] border border-cyan-500/25 rounded-2xl p-3 flex flex-col gap-1.5 shadow-2xl select-none font-mono ${className}`}
    >
      {/* Sidebar Header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5 mb-1 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-cyan-300 font-bold text-xs uppercase tracking-wider">
        <Layers className="w-4 h-4 text-cyan-400" />
        <span>Activities ({activities.length})</span>
      </div>

      {/* "All Activities" Option */}
      <button
        type="button"
        onClick={() => onSelectActivity('all')}
        className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-mono transition-all cursor-pointer text-left ${
          selectedActivityId === 'all'
            ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/60 shadow-md shadow-cyan-500/10 font-bold'
            : 'text-slate-300 hover:text-white hover:bg-white/5 border border-transparent'
        }`}
      >
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
            selectedActivityId === 'all'
              ? 'bg-cyan-500/30 text-cyan-300'
              : 'bg-white/5 text-slate-400'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate">All Activities</div>
          <div className="text-[10px] opacity-60">Complete view</div>
        </div>
      </button>

      <div className="h-px bg-white/10 my-1 mx-2" />

      {/* Dynamic Activity List */}
      <div className="flex flex-col gap-1.5">
        {activities.map((act) => {
          const isSelected = selectedActivityId === act.id;
          return (
            <button
              key={act.id}
              type="button"
              onClick={() => onSelectActivity(act.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-mono transition-all cursor-pointer text-left group ${
                isSelected
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/60 shadow-md shadow-cyan-500/10 font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
              title={act.name}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                  isSelected
                    ? 'bg-cyan-500/30 text-cyan-300'
                    : 'bg-white/5 text-slate-400 group-hover:text-cyan-400 group-hover:bg-cyan-500/10'
                }`}
              >
                {getActivityIcon(act.id, 'w-4 h-4')}
              </div>
              <span className="text-[11px] font-medium truncate flex-1 leading-tight">
                {act.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

