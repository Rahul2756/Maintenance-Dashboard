import React from 'react';
import { InspectionDetails } from '../../types/gis';
import { formatChainageM } from '../../utils/gisUtils';
import { useTheme } from '../../context/ThemeContext';
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
  Maximize2,
  ArrowLeft,
  Calendar,
  FileText
} from 'lucide-react';

interface RoadInspectionPanelProps {
  details: InspectionDetails | null;
  onClose: () => void;
  onOpenStreetView?: (lat: number, lon: number, chainageFmt: string) => void;
  onHighlightInStripChart?: (chainageM: number) => void;
  onBackToTimeline?: () => void;
}

export const RoadInspectionPanel: React.FC<RoadInspectionPanelProps> = ({
  details,
  onClose,
  onOpenStreetView,
  onHighlightInStripChart,
  onBackToTimeline
}) => {
  const { isLight } = useTheme();
  const [copied, setCopied] = React.useState(false);

  if (!details) return null;

  const { chainageM, chainageFmt, lat, lon, nearestLandmark, segment, actualRow } = details;

  const handleCopyCoords = () => {
    navigator.clipboard.writeText(`${lat.toFixed(6)}, ${lon.toFixed(6)}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const status = segment?.statusCategory || segment?.status || (actualRow ? 'completed' : 'eligible_scope');
  const statusLabel = segment?.statusLabel || (status === 'completed' ? 'Completed by Our Team' : status === 'dps' ? 'Work Done by DPS' : status === 'under_construction' ? 'Under Construction' : status === 'himalayan' ? 'Himalayan' : 'Remaining Eligible Scope');
  const activityName = segment?.activity || actualRow?.activity || 'Corridor Baseline';
  const side = segment?.side || actualRow?.side || 'BHS';
  const lengthM = segment?.lengthM || actualRow?.lengthM || 1000;
  const fromChFmt = segment?.fromChainageFmt || formatChainageM(chainageM);
  const toChFmt = segment?.toChainageFmt;

  const getStatusColor = () => {
    switch (status) {
      case 'completed': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'dps': return 'bg-purple-900/40 text-purple-300 border-purple-500/40';
      case 'under_construction': return 'bg-amber-900/40 text-amber-300 border-amber-500/40';
      case 'himalayan': return 'bg-pink-900/40 text-pink-300 border-pink-500/40';
      default: return 'bg-sky-950/40 text-sky-300 border-sky-500/40';
    }
  };

  return (
    <div
      className={`absolute bottom-4 left-4 z-30 w-96 max-w-[calc(100vw-2rem)] backdrop-blur-md rounded-2xl overflow-hidden font-sans animate-fade-in ${
        isLight
          ? 'bg-white/98 border border-slate-300 shadow-xl text-[#17212B]'
          : 'bg-[#12161D]/95 border border-cyan-500/30 shadow-2xl shadow-black/80 text-slate-100'
      }`}
    >
      {/* Panel Header */}
      <div
        className={`flex items-center justify-between px-4 py-3 border-b ${
          isLight
            ? 'bg-[#F8FAFC] border-slate-200'
            : 'bg-gradient-to-r from-cyan-950/60 to-slate-900/60 border-white/10'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-mono tracking-wider text-cyan-400 font-bold">
              Highway Section Inspector
            </div>
            <div className="text-sm font-bold font-mono text-white flex items-center gap-1.5">
              <span>{fromChFmt}</span>
              {toChFmt && (
                <>
                  <span className="text-slate-500">→</span>
                  <span>{toChFmt}</span>
                </>
              )}
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
      <div className="p-4 space-y-3.5 max-h-[70vh] overflow-y-auto custom-scrollbar text-xs">
        {/* Back to Daily Timeline button */}
        {onBackToTimeline && (
          <button
            onClick={onBackToTimeline}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 hover:text-white font-mono text-xs font-semibold transition-all shadow-md shadow-cyan-500/10 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Daily Timeline</span>
          </button>
        )}

        {/* Selected Daily DPR Work Entry Details (Requirement 3) */}
        {actualRow && (
          <div className="bg-cyan-950/30 rounded-xl p-3 border border-cyan-500/40 space-y-2.5">
            <div className="flex items-center justify-between text-[11px] font-mono text-cyan-400 uppercase tracking-wider font-bold">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" /> Selected Daily DPR Entry
              </span>
              <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/30">
                {actualRow.date}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-black/50 p-2 rounded-lg border border-white/5">
                <span className="text-[10px] text-slate-400 block">Activity</span>
                <span className="text-cyan-300 font-bold">{actualRow.activity}</span>
              </div>
              <div className="bg-black/50 p-2 rounded-lg border border-white/5">
                <span className="text-[10px] text-slate-400 block">Side & Lane</span>
                <span className="text-white font-bold">{actualRow.side} • {actualRow.lane || 'MCW'}</span>
              </div>
              <div className="bg-black/50 p-2 rounded-lg border border-white/5">
                <span className="text-[10px] text-slate-400 block">Executed Span</span>
                <span className="text-white font-bold">{actualRow.lengthM || lengthM} m</span>
                <span className="text-[10px] text-slate-500 block">
                  {formatChainageM(actualRow.rawFromChainage || Math.round(actualRow.fromChainage * 1000))} → {formatChainageM(actualRow.rawToChainage || Math.round(actualRow.toChainage * 1000))}
                </span>
              </div>
              <div className="bg-black/50 p-2 rounded-lg border border-white/5">
                <span className="text-[10px] text-slate-400 block">Achieved Output</span>
                <span className="text-emerald-400 font-bold">
                  {actualRow.achievedToday > 0 ? `${actualRow.achievedToday.toLocaleString()} ${actualRow.unit || 'sqm'}` : 'Recorded'}
                </span>
                {actualRow.id && (
                  <span className="text-[10px] text-slate-500 block">
                    ID: #{actualRow.id}
                  </span>
                )}
              </div>
            </div>

            {actualRow.boqItem && (
              <div className="text-[11px] font-mono text-slate-300 bg-black/50 px-2.5 py-1.5 rounded-lg border border-white/5">
                <span className="text-slate-400 text-[10px] block">BOQ Description:</span>
                <span className="truncate block text-slate-200 font-semibold">{actualRow.boqItem}</span>
              </div>
            )}

            {actualRow.isAnomaly ? (
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-rose-300 bg-rose-950/40 p-2 rounded-lg border border-rose-500/30">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>DPR Log Flagged Anomaly</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 bg-emerald-950/30 p-1.5 rounded-lg border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Verified Field Log Record</span>
              </div>
            )}
          </div>
        )}
        {/* Status Category Badge Strip */}
        <div className="flex items-center justify-between bg-[#0B0C0E]/70 p-2.5 rounded-xl border border-white/5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Classification:</span>
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase tracking-wider border ${getStatusColor()}`}>
            {statusLabel}
          </span>
        </div>

        {/* Section Coordinates & Location */}
        <div className="bg-[#0B0C0E]/70 rounded-xl p-3 border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-cyan-400" /> GPS Alignment Coordinates
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
                Lane: {segment?.lane || actualRow?.lane || 'MCW'}
              </span>
            </div>
          </div>
        </div>

        {/* Activity & Matching Excel Source Details */}
        <div className="bg-[#0B0C0E]/70 rounded-xl p-3 border border-white/5 space-y-2">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-cyan-400" /> Activity & Source Provenance
          </div>

          <div className="space-y-1.5 font-mono text-xs">
            <div className="flex justify-between py-1 border-b border-white/5">
              <span className="text-slate-400">Activity:</span>
              <span className="text-cyan-300 font-bold">{activityName}</span>
            </div>

            {/* If completed work with log records */}
            {segment?.logRecords && segment.logRecords.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="text-[10px] text-slate-400 font-bold uppercase">
                  Matching Chainage Log Records ({segment.logRecords.length}):
                </div>
                {segment.logRecords.map((log, idx) => (
                  <div key={idx} className="bg-black/30 p-2 rounded-lg border border-white/5 space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-white font-semibold">Row {log.logRowIndex} • {log.activity}</span>
                      <span className="text-emerald-400 font-bold">{log.date}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Lane: {log.lane}</span>
                      <span>Length: {log.lengthM}m</span>
                      {log.achievedQty !== undefined && <span>Qty: {log.achievedQty} {log.unit || ''}</span>}
                    </div>
                    {log.hasConflict && (
                      <div className="text-[10px] text-amber-300 flex items-center gap-1 bg-amber-950/40 p-1 rounded border border-amber-500/20">
                        <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                        <span>Overlap: {log.overlapM}m with {log.conflictType} zone</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* If Fixed Exclusion */}
            {segment?.isExclusion && (
              <div className="p-2 rounded-lg bg-purple-950/20 border border-purple-500/20 space-y-1">
                <div className="text-purple-300 font-semibold text-[11px]">
                  Fixed Exclusion Interval ({fromChFmt} – {toChFmt})
                </div>
                <div className="text-[10px] text-slate-400">
                  Authority: Work defined in Strip Chart as not in team's scope.
                </div>
              </div>
            )}

            {/* If Remaining Scope */}
            {status === 'eligible_scope' && (
              <div className="p-2 rounded-lg bg-sky-950/20 border border-sky-500/20 space-y-1">
                <div className="text-sky-300 font-semibold text-[11px]">
                  Eligible for Maintenance Execution
                </div>
                <div className="text-[10px] text-slate-400">
                  Work is planned within contractual scope, not yet recorded as completed.
                </div>
              </div>
            )}

            <div className="flex justify-between py-1 text-[11px] text-slate-400">
              <span>Source:</span>
              <span className="text-slate-300 font-mono truncate max-w-[200px]">
                {segment?.sourceWorkbook || 'final_sheet.xlsx'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-1">
          {onOpenStreetView && (
            <button
              onClick={() => onOpenStreetView(lat, lon, fromChFmt)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold font-mono text-xs transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <span>Street View</span>
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

