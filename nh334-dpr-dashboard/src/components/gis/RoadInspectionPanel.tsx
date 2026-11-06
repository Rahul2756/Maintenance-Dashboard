import React from 'react';
import { InspectionDetails } from '../../types/gis';
import { formatChainageM } from '../../utils/gisUtils';
import { 
  X, 
  MapPin, 
  Compass, 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ExternalLink, 
  Copy, 
  Check, 
  ShieldCheck,
  Maximize2
} from 'lucide-react';

interface RoadInspectionPanelProps {
  details: InspectionDetails | null;
  onClose: () => void;
  onOpenStreetView?: (lat: number, lon: number, chainageFmt: string) => void;
  onHighlightInStripChart?: (chainageM: number) => void;
}

export const RoadInspectionPanel: React.FC<RoadInspectionPanelProps> = ({
  details,
  onClose,
  onOpenStreetView,
  onHighlightInStripChart
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!details) return null;

  const { chainageM, chainageFmt, lat, lon, nearestLandmark, segment, actualRow } = details;

  const handleCopyCoords = () => {
    navigator.clipboard.writeText(`${lat.toFixed(6)}, ${lon.toFixed(6)}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const status = segment?.status || (actualRow ? 'completed' : 'planned');
  const activityName = segment?.activity || actualRow?.activity || 'Corridor Baseline';
  const side = segment?.side || actualRow?.side || 'BHS';
  const lengthM = segment?.lengthM || actualRow?.lengthM || 1000;

  return (
    <div className="absolute bottom-4 left-4 z-30 w-96 max-w-[calc(100vw-2rem)] bg-[#12161D]/95 backdrop-blur-md border border-cyan-500/30 rounded-2xl shadow-2xl shadow-black/80 text-slate-100 overflow-hidden font-sans animate-fade-in">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-cyan-950/60 to-slate-900/60 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-mono tracking-wider text-cyan-400 font-bold">
              Road Inspection Details
            </div>
            <div className="text-sm font-bold font-mono text-white flex items-center gap-2">
              <span>{chainageFmt || formatChainageM(chainageM)}</span>
              <span className="text-[11px] font-normal text-slate-400">({(chainageM / 1000).toFixed(3)} km)</span>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          title="Close details"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body Content */}
      <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar text-xs">
        {/* Section Coordinates & Location */}
        <div className="bg-[#0B0C0E]/70 rounded-xl p-3 border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-cyan-400" /> GPS Coordinates
            </span>
            <button
              onClick={handleCopyCoords}
              className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 font-mono transition-colors"
              title="Copy GPS coordinates"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <div className="font-mono text-xs text-white bg-black/40 px-2.5 py-1.5 rounded-lg border border-white/5 flex items-center justify-between">
            <span>Lat: {lat.toFixed(6)}° N</span>
            <span className="text-slate-500">|</span>
            <span>Lon: {lon.toFixed(6)}° E</span>
          </div>
          {nearestLandmark && (
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-0.5">
              <span className="text-cyan-400 font-medium">Near:</span>
              <span className="text-slate-200">{nearestLandmark}</span>
            </div>
          )}
        </div>

        {/* Section Span & Carriageway Details */}
        <div className="bg-[#0B0C0E]/70 rounded-xl p-3 border border-white/5 space-y-2">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400" /> Section Scope & Geometry
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="bg-white/[0.02] p-2 rounded-lg border border-white/5">
              <span className="text-[10px] text-slate-400 block">Span Length</span>
              <span className="text-white font-bold">{lengthM.toLocaleString()} m</span>
              <span className="text-[10px] text-slate-500 block">({(lengthM / 1000).toFixed(3)} km)</span>
            </div>
            <div className="bg-white/[0.02] p-2 rounded-lg border border-white/5">
              <span className="text-[10px] text-slate-400 block">Carriageway Side</span>
              <span className="text-cyan-300 font-bold">{side}</span>
              <span className="text-[10px] text-slate-500 block">
                {actualRow?.lane ? `Lane: ${actualRow.lane}` : 'Main Carriageway (MCW)'}
              </span>
            </div>
          </div>
        </div>

        {/* Activity & Execution Progress */}
        <div className="bg-[#0B0C0E]/70 rounded-xl p-3 border border-white/5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" /> Activity Execution
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase tracking-wider ${
                status === 'completed'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : status === 'in_progress'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : status === 'delayed'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : status === 'dps'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                  : status === 'under_construction'
                  ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                  : status === 'himalayan'
                  ? 'bg-rose-600/20 text-rose-400 border border-rose-600/40'
                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              }`}
            >
              {status.replace('_', ' ')}
            </span>
          </div>

          <div className="space-y-1.5 font-mono text-xs">
            <div className="flex justify-between py-1 border-b border-white/5">
              <span className="text-slate-400">Activity:</span>
              <span className="text-cyan-300 font-bold">{activityName}</span>
            </div>
            {actualRow?.achievedToday !== undefined && (
              <div className="flex justify-between py-1 border-b border-white/5 text-emerald-300 font-semibold">
                <span>Achieved Qty:</span>
                <span>{actualRow.achievedToday.toLocaleString()} {actualRow.unit || 'sqm'}</span>
              </div>
            )}
            {actualRow?.date && (
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Execution Date:</span>
                <span className="text-white">{actualRow.date}</span>
              </div>
            )}
            {actualRow?.remarks && (
              <div className="py-1 text-[11px] text-slate-400 italic">
                Note: {actualRow.remarks}
              </div>
            )}
          </div>
        </div>

        {/* Quality & QC Details */}
        <div className="bg-[#0B0C0E]/70 rounded-xl p-3 border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Quality & Compliance
            </span>
            {actualRow?.isAnomaly ? (
              <span className="text-rose-400 flex items-center gap-1 text-[10px] font-bold">
                <AlertTriangle className="w-3 h-3" /> Anomaly Flag
              </span>
            ) : (
              <span className="text-emerald-400 flex items-center gap-1 text-[10px] font-bold">
                <CheckCircle2 className="w-3 h-3" /> QC Verified
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="bg-white/[0.02] p-2 rounded-lg border border-white/5">
              <span className="text-[10px] text-slate-400 block">Design Thickness</span>
              <span className="text-white font-semibold">
                {actualRow?.depthMm ? `${actualRow.depthMm} mm` : '50 mm (DBM)'}
              </span>
            </div>
            <div className="bg-white/[0.02] p-2 rounded-lg border border-white/5">
              <span className="text-[10px] text-slate-400 block">Anomaly Status</span>
              <span className={actualRow?.isAnomaly ? 'text-rose-400 font-bold' : 'text-emerald-400 font-semibold'}>
                {actualRow?.isAnomaly ? actualRow.anomalyDescription || 'Flagged' : 'Normal / Passed'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-1">
          {onOpenStreetView && (
            <button
              onClick={() => onOpenStreetView(lat, lon, chainageFmt || formatChainageM(chainageM))}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold font-mono text-xs transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <span>Inspect in Street View</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}

          {onHighlightInStripChart && (
            <button
              onClick={() => onHighlightInStripChart(chainageM)}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-semibold font-mono text-xs transition-all cursor-pointer"
              title="Scroll and highlight in Strip Chart"
            >
              <span>Strip Chart</span>
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

