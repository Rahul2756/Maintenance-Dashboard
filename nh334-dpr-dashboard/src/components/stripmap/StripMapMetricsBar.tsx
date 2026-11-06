import React, { useMemo } from 'react';
import { Route, Target, CheckCircle2, Clock, AlertTriangle, Layers } from 'lucide-react';
import { StripChartDataset } from '../../types/stripChart';

interface StripMapMetricsBarProps {
  dataset: StripChartDataset;
}

export const StripMapMetricsBar: React.FC<StripMapMetricsBarProps> = ({ dataset }) => {
  const { metadata, lhsCells, rhsCells, intervals, lhsWorkZones, rhsWorkZones } = dataset;

  const metrics = useMemo(() => {
    const totalM = metadata.totalLengthM || 75840;

    // Completed intervals
    const completedSet = new Set<number>();
    Object.values(lhsCells).forEach((cells) => {
      cells.forEach((c, idx) => {
        if (c.status === 'completed') completedSet.add(idx);
      });
    });
    Object.values(rhsCells).forEach((cells) => {
      cells.forEach((c, idx) => {
        if (c.status === 'completed') completedSet.add(idx);
      });
    });

    let completedM = 0;
    completedSet.forEach((idx) => {
      completedM += intervals[idx]?.lengthM || 0;
    });

    // DPS & In Progress
    const allDps = [...lhsWorkZones, ...rhsWorkZones].filter((z) => z.status === 'dps');
    const dpsM = allDps.reduce((acc, z) => acc + z.totalLengthM, 0) / 2; // Average over both sides

    // Under construction / Delayed
    const allUc = [...lhsWorkZones, ...rhsWorkZones].filter((z) => z.status === 'under_construction');
    const ucM = allUc.reduce((acc, z) => acc + z.totalLengthM, 0) / 2;

    // Remaining future scope
    const futureM = Math.max(0, totalM - completedM - dpsM - ucM);

    return {
      corridorKm: (totalM / 1000).toFixed(3),
      chainageText: `Ch. ${metadata.startChainage} – ${metadata.endChainage}`,
      completedKm: (completedM / 1000).toFixed(2),
      completedPct: ((completedM / totalM) * 100).toFixed(2),
      inProgressKm: (dpsM / 1000).toFixed(2),
      inProgressPct: ((dpsM / totalM) * 100).toFixed(2),
      delayedKm: (ucM / 1000).toFixed(2),
      delayedPct: ((ucM / totalM) * 100).toFixed(2),
      futureKm: (futureM / 1000).toFixed(2),
      futurePct: ((futureM / totalM) * 100).toFixed(2),
    };
  }, [dataset, intervals, lhsCells, lhsWorkZones, metadata, rhsCells, rhsWorkZones]);

  return (
    <div className="w-full grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5 sm:gap-3 select-none font-mono">
      {/* 1. Corridor Length */}
      <div className="bg-[#12161D] border border-cyan-500/20 rounded-xl px-3.5 py-2.5 flex items-center gap-3 shadow-lg hover:border-cyan-500/40 transition-colors">
        <div className="w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0">
          <Route className="w-4 h-4 text-cyan-400" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Corridor Length</div>
          <div className="text-sm sm:text-base font-extrabold text-white truncate">
            {metrics.corridorKm} <span className="text-xs font-normal text-slate-400">km</span>
          </div>
        </div>
      </div>

      {/* 2. Total Chainage */}
      <div className="bg-[#12161D] border border-cyan-500/20 rounded-xl px-3.5 py-2.5 flex items-center gap-3 shadow-lg hover:border-cyan-500/40 transition-colors">
        <div className="w-9 h-9 rounded-lg bg-teal-500/15 border border-teal-500/30 flex items-center justify-center shrink-0">
          <Target className="w-4 h-4 text-teal-400" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Total Chainage</div>
          <div className="text-xs sm:text-[13px] font-bold text-teal-200 truncate">
            {metrics.chainageText}
          </div>
        </div>
      </div>

      {/* 3. Completed */}
      <div className="bg-[#12161D] border border-emerald-500/30 bg-emerald-950/10 rounded-xl px-3.5 py-2.5 flex items-center gap-3 shadow-lg hover:border-emerald-500/50 transition-colors">
        <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/20">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Completed</div>
          <div className="text-sm sm:text-base font-extrabold text-emerald-400 truncate">
            {metrics.completedKm} <span className="text-xs font-normal">km</span>{' '}
            <span className="text-[10px] text-emerald-500 font-normal">({metrics.completedPct}%)</span>
          </div>
        </div>
      </div>

      {/* 4. In Progress / DPS */}
      <div className="bg-[#12161D] border border-amber-500/30 bg-amber-950/10 rounded-xl px-3.5 py-2.5 flex items-center gap-3 shadow-lg hover:border-amber-500/50 transition-colors">
        <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 shadow-sm shadow-amber-500/20">
          <Clock className="w-4 h-4 text-amber-400" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">In Progress</div>
          <div className="text-sm sm:text-base font-extrabold text-amber-300 truncate">
            {metrics.inProgressKm} <span className="text-xs font-normal">km</span>{' '}
            <span className="text-[10px] text-amber-400 font-normal">({metrics.inProgressPct}%)</span>
          </div>
        </div>
      </div>

      {/* 5. Delayed / U-C */}
      <div className="bg-[#12161D] border border-rose-500/30 bg-rose-950/10 rounded-xl px-3.5 py-2.5 flex items-center gap-3 shadow-lg hover:border-rose-500/50 transition-colors">
        <div className="w-9 h-9 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0 shadow-sm shadow-rose-500/20">
          <AlertTriangle className="w-4 h-4 text-rose-400" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Delayed</div>
          <div className="text-sm sm:text-base font-extrabold text-rose-400 truncate">
            {metrics.delayedKm} <span className="text-xs font-normal">km</span>{' '}
            <span className="text-[10px] text-rose-400 font-normal">({metrics.delayedPct}%)</span>
          </div>
        </div>
      </div>

      {/* 6. Future Scope */}
      <div className="bg-[#12161D] border border-cyan-500/30 bg-cyan-950/10 rounded-xl px-3.5 py-2.5 flex items-center gap-3 shadow-lg hover:border-cyan-500/50 transition-colors">
        <div className="w-9 h-9 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0 shadow-sm shadow-cyan-500/20">
          <Layers className="w-4 h-4 text-cyan-400" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Future Scope</div>
          <div className="text-sm sm:text-base font-extrabold text-cyan-300 truncate">
            {metrics.futureKm} <span className="text-xs font-normal">km</span>{' '}
            <span className="text-[10px] text-cyan-400 font-normal">({metrics.futurePct}%)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

