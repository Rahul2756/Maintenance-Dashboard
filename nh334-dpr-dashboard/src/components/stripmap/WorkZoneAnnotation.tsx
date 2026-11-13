import React from 'react';
import { HardHat, Construction, Mountain, AlertCircle } from 'lucide-react';
import { WorkZoneAnnotation as WorkZoneAnnotationType } from '../../types/stripChart';

interface WorkZoneAnnotationProps {
  zone: WorkZoneAnnotationType;
  leftPx: number;
  widthPx: number;
  onHoverZone: (zone: WorkZoneAnnotationType | null, event?: React.MouseEvent) => void;
}

export const WorkZoneAnnotation: React.FC<WorkZoneAnnotationProps> = ({
  zone,
  leftPx,
  widthPx,
  onHoverZone,
}) => {
  // Visual styles per work zone type
  const styleConfig = React.useMemo(() => {
    switch (zone.status) {
      case 'dps':
        return {
          bg: 'bg-[#2E3748]/90 backdrop-blur-[2px]',
          border: 'border-slate-400',
          text: 'text-white font-bold',
          badgeBg: 'bg-[#1E2532] text-slate-100 border-slate-500/70',
          glow: 'shadow-lg shadow-black/50',
          icon: <HardHat className="w-3.5 h-3.5 text-amber-300 shrink-0" />,
        };
      case 'under_construction':
        return {
          bg: 'bg-[#7A6E3B]/90 backdrop-blur-[2px]',
          border: 'border-[#EAB308]',
          text: 'text-amber-100 font-bold',
          badgeBg: 'bg-[#4E441E] text-amber-200 border-[#CA8A04]',
          glow: 'shadow-lg shadow-amber-950/50',
          icon: <Construction className="w-3.5 h-3.5 text-amber-300 shrink-0" />,
        };
      case 'himalayan':
        return {
          bg: 'bg-[#B43403]/90 backdrop-blur-[2px]',
          border: 'border-orange-400',
          text: 'text-orange-100 font-bold',
          badgeBg: 'bg-[#5C1A01] text-orange-200 border-orange-500/70',
          glow: 'shadow-lg shadow-orange-950/50',
          icon: <Mountain className="w-3.5 h-3.5 text-orange-300 shrink-0" />,
        };
      default:
        return {
          bg: 'bg-cyan-900/80',
          border: 'border-cyan-500',
          text: 'text-cyan-100',
          badgeBg: 'bg-cyan-950 text-cyan-200 border-cyan-500',
          glow: 'shadow-md',
          icon: <AlertCircle className="w-3.5 h-3.5 text-cyan-300 shrink-0" />,
        };
    }
  }, [zone.status]);

  return (
    <div
      style={{
        left: `${leftPx}px`,
        width: `${widthPx}px`,
      }}
      onMouseEnter={(e) => onHoverZone(zone, e)}
      onMouseLeave={() => onHoverZone(null)}
      className={`preserve-dark absolute inset-y-0.5 rounded-lg border-2 ${styleConfig.border} ${styleConfig.bg} ${styleConfig.glow} z-20 flex items-center justify-center p-1 overflow-hidden transition-all cursor-pointer pointer-events-auto hover:brightness-110 hover:z-30`}
      data-on-accent="true"
      title={`${zone.label} (${zone.fromChainage} to ${zone.toChainage}, ${(zone.totalLengthM / 1000).toFixed(2)} km)`}
    >
      {/* Dynamic Badge strictly bounded within widthPx without horizontal overflow */}
      {widthPx >= 180 ? (
        <div
          className={`px-3 py-1 rounded-lg border text-[11px] font-mono tracking-wider uppercase shadow-md flex items-center gap-2 max-w-full overflow-hidden ${styleConfig.badgeBg}`}
        >
          {styleConfig.icon}
          <span className={`${styleConfig.text} truncate font-bold`}>{zone.label}</span>
          <span className="opacity-75 text-[9px] shrink-0 font-normal">
            ({zone.fromChainage} – {zone.toChainage})
          </span>
        </div>
      ) : widthPx >= 75 ? (
        <div
          className={`px-2 py-0.5 rounded-md border text-[10px] font-mono tracking-tight uppercase shadow-sm max-w-full overflow-hidden flex items-center gap-1.5 text-center ${styleConfig.badgeBg}`}
        >
          {styleConfig.icon}
          <span className={`${styleConfig.text} truncate block font-bold`}>{zone.label}</span>
        </div>
      ) : (
        <div
          className={`px-1 py-0.5 rounded border text-[9px] font-mono tracking-tighter uppercase shadow-sm max-w-full overflow-hidden text-center ${styleConfig.badgeBg}`}
        >
          <span className={`${styleConfig.text} truncate block font-bold`}>
            {zone.type === 'HIMALAYAN' ? 'Himalayan' : zone.type === 'DPS' ? 'DPS' : 'U/C'}
          </span>
        </div>
      )}
    </div>
  );
};
