import React, { useState, useMemo, useRef, useEffect } from 'react';
import { MapMode, RoadSegmentGeo, InspectionDetails, StreetViewLocation } from '../../types/gis';
import { ActualDPRRow, PlannedRecord, HighwaySide, ActivityType, QCTestLogItem } from '../../types/dpr';
import { StripChartDataset } from '../../types/stripChart';
import { 
  CORRIDOR_EXTENT, 
  NH334_LANDMARKS, 
  buildGeoSegments, 
  getCoordinatesAtChainage,
  getChainageAtCoordinates,
  parseChainageStrToM,
  formatChainageM,
  STATUS_COLORS,
  STRIP_ACTIVITIES
} from '../../utils/gisUtils';
import { useFilters } from '../../context/FilterContext';
import { STATE_BOUNDARIES } from '../../utils/stateFilterUtils';
import { GISMapCanvas } from './GISMapCanvas';
import { RoadInspectionPanel } from './RoadInspectionPanel';
import { StreetViewModal } from './StreetViewModal';
import { Highway3DDigitalTwin } from '../dashboard/Highway3DDigitalTwin';
import { 
  Globe, 
  Layers, 
  Map, 
  Box, 
  Maximize2, 
  Minimize2, 
  RotateCcw, 
  Search, 
  Crosshair, 
  Compass, 
  Info,
  SlidersHorizontal,
  ChevronDown,
  Navigation,
  Calendar,
  ArrowLeft,
  AlertTriangle
} from 'lucide-react';

interface GeographicalGISModuleProps {
  actualRows: ActualDPRRow[];
  plannedRecords: PlannedRecord[];
  stripDataset?: StripChartDataset | null;
  selectedChainageM?: number | null;
  onSelectChainage?: (chainageM: number) => void;
  onHighlightStripChart?: (chainageM: number) => void;
  availableDates?: string[];
  qcLogs?: QCTestLogItem[];
  selectedRow?: ActualDPRRow | null;
  onSelectRow?: (row: ActualDPRRow | null) => void;
  selectedWorkRecord?: ActualDPRRow | null;
  onClearSelectedWorkRecord?: () => void;
  onBackToTimeline?: () => void;
}

export const GeographicalGISModule: React.FC<GeographicalGISModuleProps> = ({
  actualRows,
  plannedRecords,
  stripDataset = null,
  selectedChainageM: externalSelectedChainage,
  onSelectChainage,
  onHighlightStripChart,
  availableDates: externalDates = [],
  qcLogs = [],
  selectedRow = null,
  onSelectRow,
  selectedWorkRecord = null,
  onClearSelectedWorkRecord,
  onBackToTimeline
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Read Global State Filter
  const { filters } = useFilters();
  const selectedState = filters.state || 'All';
  const stateBoundary = STATE_BOUNDARIES[selectedState];

  // Map Mode: satellite | hybrid | roadmap | 3d (Default to 3D GIS)
  const [mapMode, setMapMode] = useState<MapMode>('3d');
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);

  // Synchronized Filters (Default activity is Milling; strictly 5 core activities, All Activities completely removed)
  const [sideFilter, setSideFilter] = useState<HighwaySide>('Both');
  const [activityFilter, setActivityFilter] = useState<string>('milling');
  
  // Date View State (Overall View vs Selected Date View)
  const allDates = stripDataset?.availableDates && stripDataset.availableDates.length > 0
    ? stripDataset.availableDates
    : externalDates && externalDates.length > 0
    ? externalDates
    : ['14-Oct-2026', '23-Oct-2026', '01-Nov-2026', '05-Nov-2026'];
  const defaultLatestDate = allDates[allDates.length - 1] || '05-Nov-2026';

  const [dateMode, setDateMode] = useState<'overall' | 'selected'>('overall');
  const [activeDate, setActiveDate] = useState<string>(defaultLatestDate);

  // Search & Jump
  const [searchInput, setSearchInput] = useState<string>('');
  const [selectedChainage, setSelectedChainage] = useState<number | null>(
    externalSelectedChainage || null
  );

  // Inspection details
  const [inspectionDetails, setInspectionDetails] = useState<InspectionDetails | null>(null);
  const [locationErrorMessage, setLocationErrorMessage] = useState<string | null>(null);

  // Street view modal state
  const [isStreetViewOpen, setIsStreetViewOpen] = useState<boolean>(false);
  const [streetViewLocation, setStreetViewLocation] = useState<StreetViewLocation | null>(null);
  const [pegmanActive, setPegmanActive] = useState<boolean>(false);

  // Build geocoded segments based on filters (Exact Strip Chart Classification)
  const geoSegments = useMemo(() => {
    return buildGeoSegments(
      actualRows,
      plannedRecords,
      stripDataset,
      activityFilter,
      sideFilter,
      dateMode === 'selected' ? activeDate : defaultLatestDate,
      selectedState
    );
  }, [actualRows, plannedRecords, stripDataset, activityFilter, sideFilter, dateMode, activeDate, defaultLatestDate, selectedState]);

  // Sync external selected chainage
  useEffect(() => {
    if (externalSelectedChainage !== undefined && externalSelectedChainage !== null) {
      setSelectedChainage(externalSelectedChainage);
      const [lat, lon] = getCoordinatesAtChainage(externalSelectedChainage);
      const chainageFmt = formatChainageM(externalSelectedChainage);
      const res = getChainageAtCoordinates(lat, lon);

      const matchingSeg = geoSegments.find(
        s => externalSelectedChainage >= s.fromChainageM && externalSelectedChainage <= s.toChainageM
      );

      setInspectionDetails({
        chainageM: externalSelectedChainage,
        chainageFmt,
        lat,
        lon,
        nearestLandmark: res.nearestLandmark,
        segment: matchingSeg,
      });
    }
  }, [externalSelectedChainage, geoSegments]);

  // Synchronize and focus when navigating from Daily Quick Insight Timeline
  useEffect(() => {
    if (!selectedWorkRecord) return;

    const fromM = selectedWorkRecord.rawFromChainage || Math.round((selectedWorkRecord.fromChainage || 0) * 1000);
    const toM = selectedWorkRecord.rawToChainage || Math.round((selectedWorkRecord.toChainage || 0) * 1000);

    // Validate chainage against road extent (Requirement 5)
    const isFromValid = fromM >= CORRIDOR_EXTENT.projectStartM - 1000 && fromM <= CORRIDOR_EXTENT.projectEndM + 1000;
    const isToValid = toM >= CORRIDOR_EXTENT.projectStartM - 1000 && toM <= CORRIDOR_EXTENT.projectEndM + 1000;

    if (!isFromValid || !isToValid) {
      setLocationErrorMessage('GPS location unavailable for this chainage.');
      return;
    }

    setLocationErrorMessage(null);
    const midM = Math.round((fromM + toM) / 2);
    setSelectedChainage(midM);

    const [lat, lon] = getCoordinatesAtChainage(midM);
    const fromChFmt = formatChainageM(fromM);
    const toChFmt = formatChainageM(toM);
    const res = getChainageAtCoordinates(lat, lon);

    // Find any intersecting classification segment for rich provenance
    const matchingSeg = geoSegments.find(
      s => (fromM >= s.fromChainageM && fromM <= s.toChainageM) || (toM >= s.fromChainageM && toM <= s.toChainageM)
    );

    setInspectionDetails({
      chainageM: midM,
      chainageFmt: `${fromChFmt} → ${toChFmt}`,
      lat,
      lon,
      nearestLandmark: res.nearestLandmark,
      segment: matchingSeg,
      actualRow: selectedWorkRecord,
      selectedSection: {
        fromM,
        toM,
        fromChainageFmt: fromChFmt,
        toChainageFmt: toChFmt,
        side: selectedWorkRecord.side,
        lane: selectedWorkRecord.lane,
        activity: selectedWorkRecord.activity,
        lengthM: selectedWorkRecord.lengthM || Math.abs(toM - fromM)
      }
    });
  }, [selectedWorkRecord, geoSegments]);

  // Segment selection handler
  const handleSelectSegment = (segment: RoadSegmentGeo) => {
    setSelectedChainage(segment.fromChainageM);
    const [lat, lon] = getCoordinatesAtChainage(segment.fromChainageM);
    const res = getChainageAtCoordinates(lat, lon);

    setInspectionDetails({
      chainageM: segment.fromChainageM,
      chainageFmt: segment.fromChainageFmt,
      lat,
      lon,
      nearestLandmark: res.nearestLandmark,
      segment,
    });

    if (onSelectChainage) onSelectChainage(segment.fromChainageM);
    if (onHighlightStripChart) onHighlightStripChart(segment.fromChainageM);
  };

  // Chainage selection handler
  const handleSelectChainage = (chainageM: number) => {
    setSelectedChainage(chainageM);
    const [lat, lon] = getCoordinatesAtChainage(chainageM);
    const chainageFmt = formatChainageM(chainageM);
    const res = getChainageAtCoordinates(lat, lon);

    const matchingSeg = geoSegments.find(
      s => chainageM >= s.fromChainageM && chainageM <= s.toChainageM
    );

    setInspectionDetails({
      chainageM,
      chainageFmt,
      lat,
      lon,
      nearestLandmark: res.nearestLandmark,
      segment: matchingSeg,
    });

    if (onSelectChainage) onSelectChainage(chainageM);
    if (onHighlightStripChart) onHighlightStripChart(chainageM);
  };

  // Jump to Chainage search
  const handleJumpToSearch = () => {
    if (!searchInput.trim()) return;
    const chM = parseChainageStrToM(searchInput);
    if (chM >= stateBoundary.minM - 500 && chM <= stateBoundary.maxM + 500) {
      handleSelectChainage(chM);
      setSearchInput('');
    } else {
      alert(`Chainage Ch. ${formatChainageM(chM, '')} is outside ${stateBoundary.label} corridor bounds (Ch. ${formatChainageM(stateBoundary.minM, '')} to ${formatChainageM(stateBoundary.maxM, '')})`);
    }
  };

  // Jump to Landmark
  const handleJumpToLandmark = (lm: (typeof NH334_LANDMARKS)[0]) => {
    handleSelectChainage(lm.chainageM);
  };

  // Open Street View
  const handleOpenStreetView = (lat: number, lon: number, chainageFmt: string) => {
    setStreetViewLocation({
      lat,
      lon,
      chainageFmt,
      chainageM: parseChainageStrToM(chainageFmt)
    });
    setIsStreetViewOpen(true);
    setPegmanActive(false);
  };

  // Pegman Drop
  const handlePegmanDrop = (lat: number, lon: number, chainageFmt: string) => {
    handleOpenStreetView(lat, lon, chainageFmt);
  };

  // Full Screen toggle
  const toggleFullScreen = () => {
    if (!containerRef.current) return;
    if (!isFullScreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
      setIsFullScreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullScreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`space-y-4 font-sans select-none ${
        isFullScreen ? 'p-6 bg-[#0B0C0E] fixed inset-0 z-50 overflow-y-auto' : ''
      }`}
    >
      {/* 1. Module Header with Vaulto Dark Styling */}
      <div className="bg-[#14171C] border border-cyan-500/20 rounded-2xl p-5 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/10 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/10">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-bold flex items-center gap-2">
              <span>Section 02 // Geographical GIS Module</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 font-mono text-[10px]">Verified 798 GPS Alignment</span>
            </div>
            <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
              NH-334 Geographical GIS & Highway Digital Twin
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Interactive Corridor Inspection | Muzaffarnagar – Haridwar | {selectedState === 'All' ? 'Ch. 130+560 to Ch. 206+220' : `${selectedState} (Ch. ${stateBoundary.minKm.toFixed(3)} to Ch. ${stateBoundary.maxKm.toFixed(3)})`}
            </p>
          </div>
        </div>

        {/* Quick Corridor Badges */}
        <div className="flex items-center gap-2.5 font-mono text-xs">
          <div className="bg-[#0B0C0E] px-3 py-1.5 rounded-xl border border-white/5 flex items-center gap-2 text-slate-300">
            <Navigation className="w-3.5 h-3.5 text-cyan-400" />
            <span>Span: <strong className="text-white">{stateBoundary.lengthKm.toFixed(3)} km</strong></span>
          </div>
          <div className="bg-[#0B0C0E] px-3 py-1.5 rounded-xl border border-white/5 flex items-center gap-2 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Ch. {stateBoundary.minKm.toFixed(3)} → {stateBoundary.maxKm.toFixed(3)}</span>
          </div>
        </div>
      </div>

      {/* 2. Map Control Toolbar & Mode Selector */}
      <div className="bg-[#14171C] border border-white/10 rounded-2xl p-3 shadow-xl flex flex-wrap items-center justify-between gap-3">
        {/* Left: Mode Switcher Pills */}
        <div className="flex items-center bg-[#0B0C0E] p-1 rounded-xl border border-white/10 text-xs font-mono">
          <button
            onClick={() => setMapMode('satellite')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer font-semibold ${
              mapMode === 'satellite'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span>Satellite</span>
          </button>

          <button
            onClick={() => setMapMode('hybrid')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer font-semibold ${
              mapMode === 'hybrid'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-teal-400" />
            <span>Hybrid</span>
          </button>

          <button
            onClick={() => setMapMode('roadmap')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer font-semibold ${
              mapMode === 'roadmap'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Map className="w-3.5 h-3.5 text-amber-400" />
            <span>Road Map</span>
          </button>

          <button
            onClick={() => setMapMode('3d')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer font-semibold ${
              mapMode === '3d'
                ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>3D GIS</span>
          </button>
        </div>

        {/* Middle: Chainage Search & Landmark Quick-Jump */}
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleJumpToSearch()}
              placeholder="Search chainage e.g. 189+230 or 189.23..."
              className="w-full bg-[#0B0C0E] border border-white/10 rounded-xl px-3.5 py-1.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <button
            onClick={handleJumpToSearch}
            className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Jump</span>
          </button>

          {/* Landmark Dropdown */}
          <div className="relative group">
            <button className="px-3 py-1.5 rounded-xl bg-[#0B0C0E] hover:bg-white/5 border border-white/10 text-slate-300 font-mono text-xs flex items-center gap-1.5 cursor-pointer transition-all">
              <span>Landmarks</span>
              <ChevronDown className="w-3 h-3 text-slate-500" />
            </button>
            <div className="absolute right-0 top-full mt-1.5 hidden group-hover:block z-40 w-56 bg-[#14171C] border border-white/10 rounded-xl shadow-2xl p-1.5 space-y-1 font-mono text-xs">
              {NH334_LANDMARKS.map(lm => (
                <button
                  key={lm.name}
                  onClick={() => handleJumpToLandmark(lm)}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/5 text-slate-300 hover:text-white flex items-center justify-between"
                >
                  <span className="truncate">{lm.name.split(' (')[0]}</span>
                  <span className="text-[10px] text-cyan-400 font-bold">{lm.chainageFmt}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Action Controls */}
        <div className="flex items-center gap-2">
          {/* Pegman Street View Toggle */}
          <button
            onClick={() => setPegmanActive(!pegmanActive)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs font-semibold transition-all cursor-pointer ${
              pegmanActive
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30'
                : 'bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300'
            }`}
            title="Click Pegman, then click highway to view 360° Street View"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Street View</span>
          </button>

          {/* Reset / Full Corridor */}
          <button
            onClick={() => handleSelectChainage(stateBoundary.minM)}
            className="w-8 h-8 rounded-xl bg-[#0B0C0E] hover:bg-white/5 border border-white/10 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title={`Reset to corridor start (Ch. ${formatChainageM(stateBoundary.minM, '')})`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Full Screen */}
          <button
            onClick={toggleFullScreen}
            className="w-8 h-8 rounded-xl bg-[#0B0C0E] hover:bg-white/5 border border-white/10 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Toggle full screen"
          >
            {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 3. Layer Controls Filter Bar (Side, Activity, Status) */}
      <div className="bg-[#14171C] border border-white/10 rounded-2xl px-4 py-2.5 shadow-xl flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        {/* Carriageway Side Filter */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-semibold">Side:</span>
          {(['Both', 'LHS', 'RHS'] as HighwaySide[]).map(side => (
            <button
              key={side}
              onClick={() => setSideFilter(side)}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer font-semibold ${
                sideFilter === side
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {side === 'Both' ? 'Both (BHS)' : side}
            </button>
          ))}
        </div>

        {/* Maintenance Activity Filter (Synchronized with Strip Chart) */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-400 font-semibold">Activity:</span>
          {STRIP_ACTIVITIES.map(act => (
            <button
              key={act.id}
              onClick={() => setActivityFilter(act.id)}
              className={`px-2 py-0.8 rounded-lg transition-all cursor-pointer font-semibold text-[11px] ${
                activityFilter === act.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {act.name}
            </button>
          ))}
        </div>

        {/* Date Mode Filter (Overall vs Selected Date) */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-semibold flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            <span>Date View:</span>
          </span>
          <div className="flex items-center bg-[#0B0C0E] p-0.5 rounded-lg border border-white/10">
            <button
              onClick={() => setDateMode('overall')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer font-semibold ${
                dateMode === 'overall'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Overall View
            </button>
            <button
              onClick={() => setDateMode('selected')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer font-semibold ${
                dateMode === 'selected'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Selected Date View
            </button>
          </div>

          {dateMode === 'selected' && allDates.length > 0 && (
            <select
              value={activeDate}
              onChange={e => setActiveDate(e.target.value)}
              className="bg-[#0B0C0E] border border-emerald-500/40 text-emerald-300 text-xs font-mono rounded-lg px-2.5 py-1 focus:outline-none cursor-pointer"
            >
              {allDates.map(d => (
                <option key={d} value={d} className="bg-[#12161D] text-white">
                  {d}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Status Legend Pills (Progress Categories & Out of Scope No Fill) */}
        <div className="flex items-center gap-4 flex-wrap text-xs font-mono">
          <div className="flex items-center gap-1.5 text-slate-300" title="Completed segments">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] shadow-sm shadow-[#10B981]/50" />
            <span className="text-emerald-300 font-medium">Completed</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-300" title="In-progress segments">
            <span className="w-2.5 h-2.5 rounded-full bg-[#06B6D4] shadow-sm shadow-[#06B6D4]/50" />
            <span className="text-cyan-300 font-medium">In Progress</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-300" title="Planned future segments">
            <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6] shadow-sm shadow-[#3B82F6]/50" />
            <span className="text-blue-300 font-medium">Planned</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-300" title="Delayed / Overdue uncompleted segments">
            <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] shadow-sm shadow-[#EF4444]/50" />
            <span className="text-rose-300 font-medium">Delayed</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400" title="Work Done by DPS, Himalayan, Under Construction (Out of Scope - No Fill / Blank Road)">
            <span className="w-2.5 h-2.5 rounded-full border border-slate-500 bg-transparent" />
            <span className="text-slate-400 font-medium">Out of Scope (No Fill)</span>
          </div>
        </div>
      </div>

      {/* 4. Main Viewport: 2D GIS Engine (Satellite / Hybrid / Road Map) OR 3D Digital Twin */}
      <div className="relative">
        {/* Unmapped Chainage Warning Overlay (Requirement 5) */}
        {locationErrorMessage && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 px-4 py-2.5 rounded-xl bg-amber-950/95 border border-amber-500/50 text-amber-200 font-mono text-xs shadow-2xl flex items-center gap-2.5 animate-bounce">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{locationErrorMessage}</span>
            <button
              onClick={() => setLocationErrorMessage(null)}
              className="ml-2 text-slate-400 hover:text-white cursor-pointer"
              title="Dismiss warning"
            >
              ✕
            </button>
          </div>
        )}

        {/* Floating Focus Badge Overlay when Navigated from Daily Timeline */}
        {selectedWorkRecord && (
          <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-[#12161D]/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-cyan-500/40 font-mono text-xs text-white shadow-xl">
            {onBackToTimeline && (
              <button
                onClick={onBackToTimeline}
                className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 font-bold cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Timeline</span>
              </button>
            )}
            <span className="text-slate-500">|</span>
            <span className="text-slate-300">
              Focusing: <span className="text-cyan-300 font-bold">{selectedWorkRecord.activity}</span> ({selectedWorkRecord.side} • {selectedWorkRecord.lane || 'MCW'})
            </span>
            {onClearSelectedWorkRecord && (
              <button
                onClick={onClearSelectedWorkRecord}
                className="ml-1 text-slate-400 hover:text-white cursor-pointer"
                title="Clear focus"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {mapMode === '3d' ? (
          <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
            <Highway3DDigitalTwin
              actualRows={actualRows}
              plannedRecords={plannedRecords}
              stripDataset={stripDataset}
              sideFilter={sideFilter}
              selectedActivityFilter={activityFilter}
              onActivityChange={(actId) => setActivityFilter(actId)}
              onSideChange={(side) => setSideFilter(side)}
              activeReportingDate={dateMode === 'selected' ? activeDate : defaultLatestDate}
              selectedRow={selectedRow}
              onSelectRow={row => {
                if (onSelectRow) onSelectRow(row);
                if (row) {
                  const m = row.rawFromChainage || Math.round((row.fromChainage || 0) * 1000);
                  handleSelectChainage(m);
                }
              }}
              minChainage={stateBoundary.minKm}
              maxChainage={stateBoundary.maxKm}
              availableDates={allDates}
              qcLogs={qcLogs}
            />
          </div>
        ) : (
          <GISMapCanvas
            mode={mapMode}
            segments={geoSegments}
            selectedChainageM={selectedChainage}
            onSelectChainage={handleSelectChainage}
            onSelectSegment={handleSelectSegment}
            stateFilter={selectedState}
            pegmanActive={pegmanActive}
            onPegmanDrop={handlePegmanDrop}
            selectedWorkRecord={selectedWorkRecord}
          />
        )}

        {/* Floating Road Inspection Detail Panel */}
        {inspectionDetails && (
          <RoadInspectionPanel
            details={inspectionDetails}
            onClose={() => setInspectionDetails(null)}
            onOpenStreetView={handleOpenStreetView}
            onHighlightInStripChart={(m) => {
              if (onHighlightStripChart) onHighlightStripChart(m);
            }}
            onBackToTimeline={onBackToTimeline}
          />
        )}
      </div>

      {/* 5. Google Street View Modal */}
      <StreetViewModal
        isOpen={isStreetViewOpen}
        onClose={() => setIsStreetViewOpen(false)}
        location={streetViewLocation}
      />
    </div>
  );
};

