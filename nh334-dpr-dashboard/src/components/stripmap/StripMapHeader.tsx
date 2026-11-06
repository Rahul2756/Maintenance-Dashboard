import React from 'react';
import { Route } from 'lucide-react';
import { StripChartDataset } from '../../types/stripChart';

interface StripMapHeaderProps {
  dataset: StripChartDataset;
}

export const StripMapHeader: React.FC<StripMapHeaderProps> = ({ dataset }) => {
  const { metadata } = dataset;

  return (
    <div className="w-full relative overflow-hidden bg-[#0A0D12] border border-cyan-500/20 rounded-2xl shadow-2xl select-none">
      {/* Right Highway Graphic with Gradient Dissolve Mask */}
      <div className="absolute right-0 top-0 bottom-0 w-[55%] pointer-events-none overflow-hidden z-0 hidden md:block">
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A0D12] via-[#0A0D12]/70 to-transparent z-10" />
        <img
          src="/images/highway-header-banner.jpg"
          alt="NH-334 Highway Corridor"
          className="w-full h-full object-cover object-right opacity-45"
        />
      </div>

      {/* Header Content */}
      <div className="relative z-10 px-5 py-4 sm:py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Glowing Teal/Cyan Road Logo Box */}
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 p-0.5 shadow-lg shadow-teal-500/20 shrink-0 flex items-center justify-center">
            <div className="w-full h-full bg-[#081519] rounded-[10px] flex items-center justify-center border border-teal-400/40">
              <Route className="w-6 h-6 text-teal-300 drop-shadow-[0_0_8px_rgba(20,184,166,0.6)]" />
            </div>
          </div>

          {/* Project Title & Corridor Information */}
          <div className="space-y-0.5">
            <div className="text-[10px] sm:text-[11px] font-mono tracking-[0.2em] text-teal-400 font-bold uppercase flex items-center gap-2">
              <span>PROJECT MONITORING DASHBOARD</span>
            </div>
            <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight">
              NH-334 Linear Highway Progression Grid
            </h1>
            <p className="text-xs font-mono text-slate-400">
              Muzaffarnagar – Haridwar &nbsp;|&nbsp; Ch. {metadata.startChainage} to Ch. {metadata.endChainage} (BHS)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
