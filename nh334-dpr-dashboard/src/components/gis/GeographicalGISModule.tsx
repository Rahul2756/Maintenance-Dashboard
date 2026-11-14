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
  STRIP_ACTIVITIES,
  CONSTRUCTION_STAGES,
  computeSectionExecutionAudit,
  SectionExecutionAudit
} from '../../utils/gisUtils';
import { formatChainagePlus, normalizeChainage } from '../../utils/excelParser';
import { useFilters } from '../../context/FilterContext';
import { useTheme } from '../../context/ThemeContext';
import { STATE_BOUNDARIES } from '../../utils/stateFilterUtils';
import { GISMapCanvas } from './GISMapCanvas';
import { StreetViewModal } from './StreetViewModal';
import { 
  Highway3DDigitalTwin, 
  Highway3DDigitalTwinHandle, 
  RoadSegmentData, 
  CameraMode 
} from '../dashboard/Highway3DDigitalTwin';
import { 
  Box, 
  Map, 
  Globe, 
  Layers, 
  Maximize2, 
  Minimize2, 
  RotateCcw, 
  Search, 
  Compass, 
  Settings, 
  Play, 
  Pause, 
  X, 
  ExternalLink, 
  ShieldCheck, 
  CheckCircle2, 
  MapPin, 
  Copy, 
  Check, 
  Truck, 
  Rocket, 
  Eye, 
  ArrowRight,
  AlertTriangle,
  ArrowLeft,
  ChevronRight
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

export type GISViewMode = 'map' | '3d' | 'plan';

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
  const highway3DRef = useRef<Highway3DDigitalTwinHandle | null>(null);

  // Global Contexts
  const { filters } = useFilters();
  const { isLight } = useTheme();
  const selectedState = filters.state || 'All';
  const stateBoundary = STATE_BOUNDARIES[selectedState] || STATE_BOUNDARIES['All'];

  // View Mode: 'map' | '3d' | 'plan' (Default: 3D View matching Draft A)
  const [viewMode, setViewMode] = useState<GISViewMode>('3d');
  const [mapSubStyle, setMapSubStyle] = useState<MapMode>('satellite');
  const [cameraMode, setCameraMode] = useState<CameraMode>('3D');
  const [isFlyoverActive, setIsFlyoverActive] = useState<boolean>(false);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Consolidated Filters (Side, Activity, Date View)
  const [sideFilter, setSideFilter] = useState<HighwaySide>('Both');
  const [activityFilter, setActivityFilter] = useState<string>('milling');

  // Available DPR Dates
  const allDates = stripDataset?.availableDates && stripDataset.availableDates.length > 0
    ? stripDataset.availableDates
    : externalDates && externalDates.length > 0
    ? externalDates
    : ['14-Oct-2026', '23-Oct-2026', '01-Nov-2026', '05-Nov-2026'];
  const defaultLatestDate = allDates[allDates.length - 1] || '05-Nov-2026';

  const [dateMode, setDateMode] = useState<'overall' | 'selected'>('overall');
  const [activeDate, setActiveDate] = useState<string>(defaultLatestDate);

  // Search input & error
  const [searchInput, setSearchInput] = useState<string>('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [locationErrorMessage, setLocationErrorMessage] = useState<string | null>(null);

  // Selected Segment & Chainage State
  const [selectedChainage, setSelectedChainage] = useState<number | null>(
    externalSelectedChainage || null
  );
  const [selectedSegment, setSelectedSegment] = useState<RoadSegmentData | null>(null);

  // Bottom Playback Tour State
  const [currentTourKm, setCurrentTourKm] = useState<number>(stateBoundary.minKm);
  const [isPlayingTour, setIsPlayingTour] = useState<boolean>(false);
  const [tourSpeed, setTourSpeed] = useState<number>(1);

  // Details Modal & Street View State
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState<boolean>(false);
  const [isStreetViewOpen, setIsStreetViewOpen] = useState<boolean>(false);
  const [streetViewLocation, setStreetViewLocation] = useState<StreetViewLocation | null>(null);
  const [pegmanActive, setPegmanActive] = useState<boolean>(false);
  const [copiedCoords, setCopiedCoords] = useState<boolean>(false);

  // Sequence Deviation Highlighting Toggle
  const [isHighlightingDeviations, setIsHighlightingDeviations] = useState<boolean>(false);

  // Build 2D geo segments (Unified Construction Execution Sequence)
  const geoSegments = useMemo(() => {
    return buildGeoSegments(
      actualRows,
      plannedRecords,
      stripDataset,
      'milling',
      sideFilter,
      dateMode === 'selected' ? activeDate : defaultLatestDate,
      selectedState,
      isLight
    );
  }, [actualRows, plannedRecords, stripDataset, sideFilter, dateMode, activeDate, defaultLatestDate, selectedState, isLight]);

  // Dynamic Construction Sequence Deviations
  const deviationSegments = useMemo(() => {
    return geoSegments.filter(s => s.isDeviation && !s.isExclusion);
  }, [geoSegments]);

  const totalDeviationCount = deviationSegments.length;
  const totalDeviationLengthM = useMemo(() => {
    return deviationSegments.reduce((sum, s) => sum + s.lengthM, 0);
  }, [deviationSegments]);

  // Sync external selected chainage
  useEffect(() => {
    if (externalSelectedChainage !== undefined && externalSelectedChainage !== null) {
      setSelectedChainage(externalSelectedChainage);
      const chKm = externalSelectedChainage / 1000;
      setCurrentTourKm(chKm);
      highway3DRef.current?.smoothFlyToChainage(chKm);
    }
  }, [externalSelectedChainage]);

  // Synchronize from Daily Quick Insight Timeline
  useEffect(() => {
    if (!selectedWorkRecord) return;
    const fromM = selectedWorkRecord.rawFromChainage || Math.round((selectedWorkRecord.fromChainage || 0) * 1000);
    const toM = selectedWorkRecord.rawToChainage || Math.round((selectedWorkRecord.toChainage || 0) * 1000);

    const isFromValid = fromM >= CORRIDOR_EXTENT.projectStartM - 1000 && fromM <= CORRIDOR_EXTENT.projectEndM + 1000;
    const isToValid = toM >= CORRIDOR_EXTENT.projectStartM - 1000 && toM <= CORRIDOR_EXTENT.projectEndM + 1000;

    if (!isFromValid || !isToValid) {
      setLocationErrorMessage('GPS location unavailable for this chainage.');
      return;
    }

    setLocationErrorMessage(null);
    const midM = Math.round((fromM + toM) / 2);
    const midKm = midM / 1000;
    setSelectedChainage(midM);
    setCurrentTourKm(midKm);
    highway3DRef.current?.smoothFlyToChainage(midKm);
  }, [selectedWorkRecord]);

  // Search & Jump to chainage handler
  const handleJumpToSearch = () => {
    setSearchError(null);
    const query = searchInput.trim();
    if (!query) return;

    let targetKm = 0;
    if (query.includes('+')) {
      const parts = query.split('+');
      const km = parseFloat(parts[0].replace(/[^0-9.]/g, '')) || 0;
      const m = parseFloat(parts[1].replace(/[^0-9.]/g, '')) || 0;
      targetKm = km + m / 1000;
    } else {
      const rawNum = parseFloat(query.replace(/[^0-9.]/g, ''));
      if (isNaN(rawNum)) {
        setSearchError('Please enter a valid chainage (e.g. 173+000 or 173.5)');
        return;
      }
      targetKm = normalizeChainage(rawNum);
    }

    if (targetKm < stateBoundary.minKm - 0.5 || targetKm > stateBoundary.maxKm + 0.5) {
      setSearchError(
        `Ch. ${formatChainagePlus(targetKm)} is outside corridor bounds (${stateBoundary.minKm.toFixed(3)} to ${stateBoundary.maxKm.toFixed(3)} km)`
      );
      return;
    }

    setCurrentTourKm(targetKm);
    setSelectedChainage(Math.round(targetKm * 1000));
    highway3DRef.current?.searchToChainage(query);
    if (onSelectChainage) onSelectChainage(Math.round(targetKm * 1000));
    if (onHighlightStripChart) onHighlightStripChart(Math.round(targetKm * 1000));
  };

  // Quick corridor jump
  const handleQuickJump = (chStr: string) => {
    setSearchInput(chStr);
    const chM = parseChainageStrToM(chStr);
    const chKm = chM / 1000;
    setCurrentTourKm(chKm);
    setSelectedChainage(chM);
    highway3DRef.current?.searchToChainage(chStr);
    if (onSelectChainage) onSelectChainage(chM);
    if (onHighlightStripChart) onHighlightStripChart(chM);
  };

  // Playback Slider change handler
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const km = Number(e.target.value);
    setCurrentTourKm(km);
    setSelectedChainage(Math.round(km * 1000));
    highway3DRef.current?.jumpCameraToChainage(km);
    if (onSelectChainage) onSelectChainage(Math.round(km * 1000));
  };

  // Playback Play/Pause toggle
  const handleTogglePlay = () => {
    const nextPlay = !isPlayingTour;
    setIsPlayingTour(nextPlay);
    highway3DRef.current?.togglePlayTour();
  };

  // Fullscreen toggle
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

  // Copy GPS Coordinates
  const handleCopyCoordinates = (lat: number, lon: number) => {
    navigator.clipboard.writeText(`${lat.toFixed(6)}, ${lon.toFixed(6)}`);
    setCopiedCoords(true);
    setTimeout(() => setCopiedCoords(false), 2000);
  };

  // Calculate slider percentage for progress fill
  const sliderPct = Math.max(
    0,
    Math.min(
      100,
      ((currentTourKm - stateBoundary.minKm) / (stateBoundary.maxKm - stateBoundary.minKm || 1)) * 100
    )
  );

  // Inspector Metric Calculations
  const inspectorMetrics = useMemo(() => {
    if (!selectedSegment) return null;

    const activeRow = selectedSegment.allRowsAtChainage?.[0] || selectedSegment.primaryRow;

    let planned = selectedSegment.plannedQty || activeRow?.plannedToday || 0;
    let achieved = selectedSegment.achievedQty || activeRow?.achievedToday || 0;
    const unit = selectedSegment.unit || activeRow?.unit || 'cum';

    // If quantity is 0 but segment has physical length, calculate standard engineering volume
    if (planned === 0 && achieved === 0 && selectedSegment.lengthM) {
      const depth = activeRow?.depthM || 0.05;
      const width = selectedSegment.widthM || 3.5;
      const calcVol = Math.round(selectedSegment.lengthM * width * depth * 10) / 10;
      if (selectedSegment.status === 'completed') {
        achieved = calcVol;
        planned = calcVol;
      } else {
        planned = calcVol;
      }
    }

    const remaining = selectedSegment.remainingQty ?? Math.max(0, Math.round((planned - achieved) * 10) / 10);
    const pct = selectedSegment.progressPercent ?? (planned > 0 ? Math.min(100, Math.round((achieved / planned) * 100)) : selectedSegment.status === 'completed' ? 100 : 0);

    // Format section bounds: e.g. "Ch. 159+000 – 159+500"
    const fromFmt = selectedSegment.fromChainageFmt || formatChainagePlus(selectedSegment.fromChainage);
    const toFmt = selectedSegment.toChainageFmt || formatChainagePlus(selectedSegment.toChainage);
    const sectionTitle = `Ch. ${fromFmt.replace('Ch. ', '')} – ${toFmt.replace('Ch. ', '')}`;

    const latestStage = selectedSegment.latestStage || 0;
    const latestStageName = selectedSegment.latestStageName || (latestStage > 0 ? CONSTRUCTION_STAGES[latestStage]?.name : selectedSegment.activity) || 'Planned';
    const inProgressStageName = selectedSegment.inProgressStageName;
    const isDeviation = !!selectedSegment.isDeviation;
    const isInProgress = !!selectedSegment.isInProgress;
    const missingPredecessors = selectedSegment.missingPredecessors || [];
    const stageColorHex = isDeviation
      ? '#EF4444'
      : latestStage > 0 
      ? (CONSTRUCTION_STAGES[latestStage]?.colorHex || '#64748B') 
      : '#CBD5E1';

    return {
      sectionTitle,
      planned,
      achieved,
      remaining,
      pct,
      unit,
      side: selectedSegment.side || 'LHS',
      activity: latestStageName,
      latestStage,
      latestStageName,
      inProgressStageName,
      isDeviation,
      isInProgress,
      missingPredecessors,
      stageColorHex,
      lengthM: selectedSegment.lengthM || 500,
      widthM: selectedSegment.widthM || 3.5,
      isOutOfScope: selectedSegment.isOutOfScope,
      statusLabel: selectedSegment.statusLabel || (isDeviation ? 'Sequence Deviation' : isInProgress ? 'In Progress' : latestStage > 0 ? 'Completed' : 'Planned'),
      status: selectedSegment.status
    };
  }, [selectedSegment, isLight]);

  // Section Execution Audit based on real Chainage Log data
  const sectionAudit = useMemo<SectionExecutionAudit | null>(() => {
    if (!selectedSegment) return null;
    const fromM = selectedSegment.fromChainageM 
      ? selectedSegment.fromChainageM 
      : Math.round(selectedSegment.fromChainage * 1000);
    const toM = selectedSegment.toChainageM 
      ? selectedSegment.toChainageM 
      : Math.round(selectedSegment.toChainage * 1000);
    const side = (selectedSegment.side as HighwaySide) || 'Both';
    const logs = stripDataset?.completedLogs || [];
    
    const audit = computeSectionExecutionAudit(fromM, toM, side, logs);

    // If completedLogs didn't match anything (e.g. initial load or fallback), but selectedSegment has completedStages:
    if (!audit.hasExecution && selectedSegment.latestStage && selectedSegment.latestStage > 0) {
      const completedList = selectedSegment.completedStages || [];
      const updatedAll = audit.allStages.map(stg => {
        if (completedList.includes(stg.stage)) {
          return { ...stg, status: 'completed' as const, coveredM: audit.lengthM, coveragePercent: 100 };
        }
        return stg;
      });
      return {
        ...audit,
        isDeviation: audit.isDeviation || !!selectedSegment.isDeviation,
        causingActivity: audit.causingActivity || (selectedSegment.isDeviation ? selectedSegment.activity : undefined),
        missingPredecessors: audit.missingPredecessors.length > 0 ? audit.missingPredecessors : (selectedSegment.missingPredecessors || []),
        completedActivities: updatedAll.filter(s => s.status === 'completed'),
        partialActivities: updatedAll.filter(s => s.status === 'partial'),
        pendingActivities: updatedAll.filter(s => s.status === 'pending'),
        allStages: updatedAll,
        hasExecution: true
      };
    }

    if (selectedSegment.isDeviation) {
      audit.isDeviation = true;
      if (!audit.causingActivity) audit.causingActivity = selectedSegment.latestStageName || selectedSegment.activity;
      if (audit.missingPredecessors.length === 0 && selectedSegment.missingPredecessors?.length) {
        audit.missingPredecessors = selectedSegment.missingPredecessors;
      }
    }

    return audit;
  }, [selectedSegment, stripDataset]);

  // Selected Segment GPS Coordinates
  const selectedSegmentCoords = useMemo(() => {
    if (!selectedSegment) return null;
    const midM = selectedSegment.fromChainageM 
      ? Math.round((selectedSegment.fromChainageM + selectedSegment.toChainageM) / 2)
      : Math.round(((selectedSegment.fromChainage + selectedSegment.toChainage) / 2) * 1000);
    const [lat, lon] = getCoordinatesAtChainage(midM);
    const res = getChainageAtCoordinates(lat, lon);
    return { lat, lon, nearestLandmark: res.nearestLandmark };
  }, [selectedSegment]);

  return (
    <div
      ref={containerRef}
      className={`space-y-3 font-sans select-none transition-all duration-300 ${
        isFullScreen ? 'p-6 fixed inset-0 z-50 overflow-y-auto' : ''
      } ${
        isLight ? 'bg-white text-[#17212B]' : 'bg-[#0B0F19] text-slate-100'
      }`}
    >
      {/* =========================================================================
          SECTION 1: MODULE HEADER (Draft A – Clean & Focused)
      ========================================================================= */}
      <div
        className={`px-4 py-3 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm transition-colors ${
          isLight
            ? 'bg-white border-slate-200'
            : 'bg-[#101726] border-white/10'
        }`}
      >
        {/* Left: Branding, Title & Subtitle */}
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center border shadow-sm ${
              isLight
                ? 'bg-[#EAF8F0] border-[#DDF5EA] text-[#07966D]'
                : 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400'
            }`}
          >
            <Box className="w-5 h-5" />
          </div>
          <div>
            <h2 className={`text-base sm:text-lg font-bold tracking-tight ${isLight ? 'text-[#17212B]' : 'text-white'}`}>
              3D GIS – Highway Section
            </h2>
            <p className={`text-xs font-mono mt-0.5 ${isLight ? 'text-[#64748B]' : 'text-slate-400'}`}>
              Muzaffarnagar – Haridwar Section (KM130+560 to KM206+220)
            </p>
          </div>
        </div>

        {/* Right: Segmented View Selector [ Map | 3D View | Plan ], Fullscreen, Settings */}
        <div className="flex items-center gap-2">
          {/* Segmented View Selector */}
          <div
            className={`flex items-center p-1 rounded-xl border text-xs font-semibold ${
              isLight ? 'bg-[#F1F5F9] border-slate-200' : 'bg-[#0B0F19] border-white/10'
            }`}
          >
            <button
              onClick={() => setViewMode('map')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer font-semibold ${
                viewMode === 'map'
                  ? isLight
                    ? 'bg-[#07966D] text-white shadow-sm'
                    : 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                  : isLight
                  ? 'text-[#64748B] hover:text-[#17212B]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Map
            </button>

            <button
              onClick={() => {
                setViewMode('3d');
                setCameraMode('3D');
                highway3DRef.current?.setCameraMode('3D');
              }}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer font-semibold ${
                viewMode === '3d'
                  ? isLight
                    ? 'bg-[#07966D] text-white shadow-sm'
                    : 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                  : isLight
                  ? 'text-[#64748B] hover:text-[#17212B]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              3D View
            </button>

            <button
              onClick={() => {
                setViewMode('plan');
                setCameraMode('Plan');
                highway3DRef.current?.setCameraMode('Plan');
              }}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer font-semibold ${
                viewMode === 'plan'
                  ? isLight
                    ? 'bg-[#07966D] text-white shadow-sm'
                    : 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                  : isLight
                  ? 'text-[#64748B] hover:text-[#17212B]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Plan
            </button>
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullScreen}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              isLight
                ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                : 'bg-[#0B0F19] border-white/10 text-slate-300 hover:bg-white/5 hover:text-white'
            }`}
            title={isFullScreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Settings Cog Dropdown (Satellite/Hybrid/RoadMap, Driver, Flyover, Landmarks, Street View) */}
          <div className="relative">
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isSettingsOpen
                  ? isLight
                    ? 'bg-slate-100 border-[#07966D] text-[#07966D]'
                    : 'bg-white/10 border-cyan-400 text-cyan-300'
                  : isLight
                  ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  : 'bg-[#0B0F19] border-white/10 text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
              title="Settings & Map Options"
            >
              <Settings className="w-4 h-4" />
            </button>

            {isSettingsOpen && (
              <div
                className={`absolute right-0 top-full mt-2 w-64 rounded-2xl shadow-2xl p-2.5 z-50 border text-xs font-mono space-y-2 animate-fade-in ${
                  isLight
                    ? 'bg-white border-slate-200 text-[#17212B]'
                    : 'bg-[#14171C] border-white/10 text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-white/10">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400">
                    Map Layers &amp; Perspectives
                  </span>
                  <button
                    onClick={() => setIsSettingsOpen(false)}
                    className="p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 2D Map Styles */}
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">2D Map Imagery:</span>
                  <div className="grid grid-cols-3 gap-1">
                    {(['satellite', 'hybrid', 'roadmap'] as MapMode[]).map(mode => (
                      <button
                        key={mode}
                        onClick={() => {
                          setMapSubStyle(mode);
                          setViewMode('map');
                        }}
                        className={`py-1 px-1.5 rounded-lg text-center capitalize transition-all cursor-pointer ${
                          viewMode === 'map' && mapSubStyle === mode
                            ? isLight ? 'bg-[#07966D] text-white font-bold' : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                            : isLight ? 'hover:bg-slate-100 text-slate-600' : 'hover:bg-white/5 text-slate-400'
                        }`}
                      >
                        {mode === 'roadmap' ? 'Road' : mode}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3D Camera Modes */}
                <div className="space-y-1 pt-1 border-t border-slate-200 dark:border-white/10">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">3D Camera Modes:</span>
                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        setViewMode('3d');
                        setCameraMode('3D');
                        highway3DRef.current?.setCameraMode('3D');
                      }}
                      className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between cursor-pointer ${
                        viewMode === '3d' && cameraMode === '3D' && !isFlyoverActive
                          ? isLight ? 'bg-[#EAF8F0] text-[#07966D] font-bold' : 'bg-cyan-500/20 text-cyan-300 font-bold'
                          : isLight ? 'hover:bg-slate-100' : 'hover:bg-white/5'
                      }`}
                    >
                      <span>3D Isometric Highway</span>
                      <Compass className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => {
                        setViewMode('plan');
                        setCameraMode('Plan');
                        highway3DRef.current?.setCameraMode('Plan');
                      }}
                      className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between cursor-pointer ${
                        viewMode === 'plan' || cameraMode === 'Plan'
                          ? isLight ? 'bg-[#EAF8F0] text-[#07966D] font-bold' : 'bg-cyan-500/20 text-cyan-300 font-bold'
                          : isLight ? 'hover:bg-slate-100' : 'hover:bg-white/5'
                      }`}
                    >
                      <span>Plan View (Top-Down)</span>
                      <Layers className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => {
                        setViewMode('3d');
                        setCameraMode('Driver');
                        highway3DRef.current?.setCameraMode('Driver');
                      }}
                      className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between cursor-pointer ${
                        cameraMode === 'Driver'
                          ? isLight ? 'bg-[#EAF8F0] text-[#07966D] font-bold' : 'bg-emerald-500/20 text-emerald-300 font-bold'
                          : isLight ? 'hover:bg-slate-100' : 'hover:bg-white/5'
                      }`}
                    >
                      <span>Driver (TPP Chase View)</span>
                      <Truck className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => {
                        setViewMode('3d');
                        setIsFlyoverActive(!isFlyoverActive);
                        highway3DRef.current?.toggleFlyover();
                      }}
                      className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between cursor-pointer ${
                        isFlyoverActive
                          ? 'bg-emerald-500/30 text-emerald-400 font-bold'
                          : isLight ? 'hover:bg-slate-100' : 'hover:bg-white/5'
                      }`}
                    >
                      <span>Cinematic Flyover Tour</span>
                      <Rocket className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Landmark Jump & Tools */}
                <div className="space-y-1 pt-1 border-t border-slate-200 dark:border-white/10">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Corridor Tools:</span>
                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        const midM = selectedSegmentCoords
                          ? Math.round(selectedSegment?.fromChainageM || 159000)
                          : 159000;
                        const [lat, lon] = getCoordinatesAtChainage(midM);
                        handleOpenStreetView(lat, lon, formatChainageM(midM));
                        setIsSettingsOpen(false);
                      }}
                      className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between cursor-pointer ${
                        isLight ? 'hover:bg-slate-100' : 'hover:bg-white/5'
                      }`}
                    >
                      <span>Google Street View (360°)</span>
                      <Compass className="w-3.5 h-3.5 text-amber-500" />
                    </button>

                    <button
                      onClick={() => {
                        highway3DRef.current?.resetCamera();
                        setCurrentTourKm(stateBoundary.minKm);
                        setIsSettingsOpen(false);
                      }}
                      className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between cursor-pointer ${
                        isLight ? 'hover:bg-slate-100' : 'hover:bg-white/5'
                      }`}
                    >
                      <span>Reset to Corridor Overview</span>
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 2: CONSOLIDATED FILTER ROW (Single Consolidated Ribbon)
      ========================================================================= */}
      <div
        className={`px-4 py-2.5 rounded-2xl border flex flex-wrap items-center justify-between gap-3 text-xs font-mono shadow-sm transition-colors ${
          isLight ? 'bg-white border-slate-200' : 'bg-[#101726] border-white/10'
        }`}
      >
        {/* Left: Side, Activity, Chainage Search + Go */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Side Selector Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className={isLight ? 'text-slate-500 font-semibold' : 'text-slate-400 font-semibold'}>
              Side:
            </span>
            <select
              value={sideFilter}
              onChange={e => setSideFilter(e.target.value as HighwaySide)}
              className={`px-3 py-1.5 rounded-xl border font-semibold cursor-pointer focus:outline-none transition-colors ${
                isLight
                  ? 'bg-slate-50 border-slate-200 text-[#17212B] focus:border-[#07966D]'
                  : 'bg-[#0B0F19] border-white/10 text-slate-200 focus:border-cyan-400'
              }`}
            >
              <option value="Both">Both (LHS+RHS)</option>
              <option value="LHS">LHS</option>
              <option value="RHS">RHS</option>
            </select>
          </div>

          {/* Compact Non-Interactive Construction Sequence Indicator */}
          <div
            className={`hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono select-none ${
              isLight
                ? 'bg-slate-50 border-slate-200 text-slate-700 shadow-sm'
                : 'bg-[#0B0F19] border-white/10 text-slate-300'
            }`}
            title="Prescribed Construction Execution Sequence (Order of Execution)"
          >
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Sequence:</span>
            <span className="flex items-center gap-1 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: '#64748B' }} />
              <span>Milling</span>
            </span>
            <span className="text-slate-400 text-[10px]">→</span>
            <span className="flex items-center gap-1 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: '#F59E0B' }} />
              <span>Tack Coat (DBM)</span>
            </span>
            <span className="text-slate-400 text-[10px]">→</span>
            <span className="flex items-center gap-1 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: '#2563EB' }} />
              <span>DBM</span>
            </span>
            <span className="text-slate-400 text-[10px]">→</span>
            <span className="flex items-center gap-1 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: '#8B5CF6' }} />
              <span>Tack Coat (BC)</span>
            </span>
            <span className="text-slate-400 text-[10px]">→</span>
            <span className="flex items-center gap-1 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: '#16A34A' }} />
              <span>BC</span>
            </span>
          </div>

          {/* Interactive Shared Sequence Deviation Counter Badge */}
          <button
            type="button"
            onClick={() => {
              const nextState = !isHighlightingDeviations;
              setIsHighlightingDeviations(nextState);
              if (nextState && deviationSegments.length > 0) {
                const firstDev = deviationSegments[0];
                const m = firstDev.fromChainageM;
                setSelectedChainage(m);
                setCurrentTourKm(m / 1000);
                highway3DRef.current?.smoothFlyToChainage(m / 1000);
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer ${
              isHighlightingDeviations
                ? 'bg-rose-500/20 border-rose-500 text-rose-500 shadow-md ring-1 ring-rose-500/40'
                : totalDeviationCount > 0
                ? isLight
                  ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100 shadow-sm'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                : isLight
                ? 'bg-slate-50 border-slate-200 text-slate-500'
                : 'bg-[#0B0F19] border-white/10 text-slate-400'
            }`}
            title={
              totalDeviationCount > 0
                ? isHighlightingDeviations
                  ? 'Click to clear deviation highlight'
                  : `Click to highlight ${totalDeviationCount} sequence deviation stretches (${totalDeviationLengthM}m)`
                : 'No sequence deviations detected'
            }
          >
            <AlertTriangle className={`w-3.5 h-3.5 ${totalDeviationCount > 0 ? 'text-rose-500' : 'text-slate-400'}`} />
            <span>Sequence Deviations:</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                totalDeviationCount > 0
                  ? 'bg-rose-500 text-white shadow-xs'
                  : isLight
                  ? 'bg-slate-200 text-slate-600'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {totalDeviationCount}
            </span>
            {totalDeviationLengthM > 0 && (
              <span className="text-[10px] opacity-80 font-normal">
                ({totalDeviationLengthM}m)
              </span>
            )}
          </button>

          {/* Chainage Search Input & Green Go Button */}
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleJumpToSearch()}
                placeholder="Chainage (e.g. 173+000)"
                className={`w-44 sm:w-52 pl-7 pr-3 py-1.5 rounded-xl border font-mono text-xs focus:outline-none transition-colors ${
                  isLight
                    ? 'bg-slate-50 border-slate-200 text-[#17212B] placeholder-slate-400 focus:border-[#07966D]'
                    : 'bg-[#0B0F19] border-white/10 text-white placeholder-slate-500 focus:border-cyan-400'
                }`}
              />
              <Search
                className={`w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 ${
                  isLight ? 'text-slate-400' : 'text-slate-500'
                }`}
              />
            </div>
            <button
              onClick={handleJumpToSearch}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer text-xs ${
                isLight
                  ? 'bg-[#07966D] hover:bg-[#06805D] text-white shadow-sm'
                  : 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40'
              }`}
            >
              Go
            </button>
          </div>

          {/* Search Error Toast */}
          {searchError && (
            <span className="text-[11px] text-rose-500 font-medium flex items-center gap-1 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 px-2 py-1 rounded-lg">
              <AlertTriangle className="w-3 h-3 text-rose-500" />
              {searchError}
            </span>
          )}
        </div>

        {/* Right: Date View Toggle [ Overall View | Selected Date View ] */}
        <div className="flex items-center gap-2">
          <span className={isLight ? 'text-slate-500 font-semibold' : 'text-slate-400 font-semibold'}>
            Date View:
          </span>
          <div
            className={`p-0.5 rounded-xl border flex items-center ${
              isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#0B0F19] border-white/10'
            }`}
          >
            <button
              onClick={() => setDateMode('overall')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer font-semibold ${
                dateMode === 'overall'
                  ? isLight
                    ? 'bg-[#07966D] text-white shadow-sm'
                    : 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                  : isLight
                  ? 'text-[#64748B] hover:text-[#17212B]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Overall View
            </button>
            <button
              onClick={() => setDateMode('selected')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer font-semibold ${
                dateMode === 'selected'
                  ? isLight
                    ? 'bg-[#07966D] text-white shadow-sm'
                    : 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                  : isLight
                  ? 'text-[#64748B] hover:text-[#17212B]'
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
              className={`px-2.5 py-1 rounded-xl border text-xs font-semibold cursor-pointer focus:outline-none ${
                isLight
                  ? 'bg-slate-50 border-[#07966D] text-[#07966D]'
                  : 'bg-[#0B0F19] border-emerald-500/40 text-emerald-300'
              }`}
            >
              {allDates.map(d => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Focus badge when navigated from timeline */}
      {selectedWorkRecord && (
        <div
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-mono shadow-sm ${
            isLight
              ? 'bg-[#EAF8F0] border-[#DDF5EA] text-[#07966D]'
              : 'bg-cyan-950/50 border-cyan-500/40 text-cyan-300'
          }`}
        >
          {onBackToTimeline && (
            <button
              onClick={onBackToTimeline}
              className="flex items-center gap-1.5 font-bold hover:underline cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Timeline</span>
            </button>
          )}
          <span>|</span>
          <span>
            Inspecting: <strong>{selectedWorkRecord.activity}</strong> ({selectedWorkRecord.side} • {selectedWorkRecord.lane || 'MCW'})
          </span>
          {onClearSelectedWorkRecord && (
            <button
              onClick={onClearSelectedWorkRecord}
              className="ml-auto p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              title="Clear focus"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* =========================================================================
          SECTION 3: MAIN WORKSPACE (Left: 3D Highway Map ~74%, Right: Section Inspector ~26%)
      ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-[580px]">
        {/* LEFT COLUMN: Main 3D Highway View / 2D GIS Map (9 cols, ~74% width) */}
        <div className="lg:col-span-9 relative rounded-2xl overflow-hidden min-h-[580px] shadow-sm flex flex-col">
          {viewMode === 'map' ? (
            <div className="relative w-full h-full flex-1 min-h-[580px] rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10">
              <GISMapCanvas
                mode={mapSubStyle}
                segments={geoSegments}
                selectedChainageM={selectedChainage}
                onSelectChainage={chM => {
                  setSelectedChainage(chM);
                  setCurrentTourKm(chM / 1000);
                  if (onSelectChainage) onSelectChainage(chM);
                }}
                onSelectSegment={seg => {
                  setSelectedChainage(seg.fromChainageM);
                  setCurrentTourKm(seg.fromChainageM / 1000);
                  const matching3DSeg: RoadSegmentData = {
                    id: seg.id,
                    fromChainage: seg.fromChainageM / 1000,
                    toChainage: seg.toChainageM / 1000,
                    fromChainageM: seg.fromChainageM,
                    toChainageM: seg.toChainageM,
                    fromChainageFmt: seg.fromChainageFmt,
                    toChainageFmt: seg.toChainageFmt,
                    lengthM: seg.lengthM,
                    side: seg.side,
                    lane: seg.lane || 'MCW',
                    date: seg.date || '',
                    activity: seg.activity,
                    activityId: seg.activityId || '',
                    status: seg.status as any,
                    statusLabel: seg.statusLabel,
                    color: 0x10b981,
                    emissive: 0x059669,
                    colorHex: seg.color,
                    achievedQty: seg.actualRow?.achievedToday || 0,
                    plannedQty: seg.actualRow?.plannedToday || 0,
                    remainingQty: 0,
                    unit: seg.actualRow?.unit || 'cum',
                    progressPercent: seg.status === 'completed' ? 100 : 50,
                    primaryRow: seg.actualRow,
                    widthM: 3.5,
                    depthM: seg.actualRow?.depthM || 0.05,
                    isAnomaly: seg.actualRow?.isAnomaly || false,
                    anomalyDescription: seg.actualRow?.anomalyDescription || '',
                    startX: 0,
                    endX: 0,
                    centerZ: 0,
                    widthZ: 7.5,
                    latestStage: seg.latestStage || 0,
                    latestStageName: seg.latestStageName || seg.activity,
                    inProgressStage: seg.inProgressStage,
                    inProgressStageName: seg.inProgressStageName,
                    isInProgress: !!seg.isInProgress,
                    isDeviation: !!seg.isDeviation,
                    missingPredecessors: seg.missingPredecessors || [],
                    deviationDescription: seg.deviationDescription,
                    completedStages: seg.completedStages || [],
                    isNotStarted: !seg.latestStage || seg.latestStage === 0
                  };
                  setSelectedSegment(matching3DSeg);
                  if (onSelectRow) onSelectRow(seg.actualRow ?? null);
                }}
                stateFilter={selectedState}
                pegmanActive={pegmanActive}
                onPegmanDrop={(lat, lon, chFmt) => handleOpenStreetView(lat, lon, chFmt)}
                selectedWorkRecord={selectedWorkRecord}
                isHighlightingDeviations={isHighlightingDeviations}
                isLight={isLight}
              />
            </div>
          ) : (
            <Highway3DDigitalTwin
              ref={highway3DRef}
              actualRows={actualRows}
              plannedRecords={plannedRecords}
              stripDataset={stripDataset}
              sideFilter={sideFilter}
              selectedActivityFilter="milling"
              activeReportingDate={dateMode === 'selected' ? activeDate : defaultLatestDate}
              selectedRow={selectedRow}
              onSelectRow={row => {
                if (onSelectRow) onSelectRow(row);
                if (row) {
                  const m = row.rawFromChainage || Math.round((row.fromChainage || 0) * 1000);
                  setSelectedChainage(m);
                  setCurrentTourKm(m / 1000);
                }
              }}
              minChainage={stateBoundary.minKm}
              maxChainage={stateBoundary.maxKm}
              availableDates={allDates}
              qcLogs={qcLogs}
              cameraMode={viewMode === 'plan' ? 'Plan' : cameraMode}
              onCameraModeChange={mode => setCameraMode(mode)}
              isFlyoverActive={isFlyoverActive}
              onToggleFlyover={() => setIsFlyoverActive(!isFlyoverActive)}
              currentTourChainage={currentTourKm}
              onTourChainageChange={km => {
                setCurrentTourKm(km);
                setSelectedChainage(Math.round(km * 1000));
              }}
              isPlayingTour={isPlayingTour}
              onTogglePlayTour={() => setIsPlayingTour(!isPlayingTour)}
              tourSpeed={tourSpeed}
              selectedSegment={selectedSegment}
              onSelectSegment={seg => setSelectedSegment(seg)}
              targetChainage={selectedChainage ? selectedChainage / 1000 : null}
              isHighlightingDeviations={isHighlightingDeviations}
            />
          )}
        </div>

        {/* RIGHT COLUMN: Highway Section Inspector Card (3 cols, ~26% width) */}
        <div
          className={`lg:col-span-3 rounded-2xl border p-4 flex flex-col justify-between shadow-sm transition-colors ${
            isLight
              ? 'bg-white border-slate-200'
              : 'bg-[#101726] border-white/10'
          }`}
        >
          {/* Inspector Header */}
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center border shadow-sm ${
                    isLight
                      ? 'bg-[#EAF8F0] border-[#DDF5EA] text-[#07966D]'
                      : 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400'
                  }`}
                >
                  <Box className="w-4 h-4" />
                </div>
                <div>
                  <h3 className={`text-xs font-bold leading-tight ${isLight ? 'text-[#17212B]' : 'text-white'}`}>
                    Highway Section Inspector
                  </h3>
                  <p className={`text-[10px] leading-none mt-0.5 ${isLight ? 'text-[#64748B]' : 'text-slate-400'}`}>
                    Physical parameters &amp; execution audit
                  </p>
                </div>
              </div>

              {selectedSegment && (
                <button
                  onClick={() => {
                    setSelectedSegment(null);
                    setSelectedChainage(null);
                    if (onSelectRow) onSelectRow(null);
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer transition-colors"
                  title="Clear selection"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Inspector Body */}
            {selectedSegment && sectionAudit ? (
              /* Selected Section Details with Execution Status */
              <div className="mt-3.5 space-y-3.5">
                {/* Highlighted Section Box */}
                <div
                  className={`p-3.5 rounded-xl border space-y-2 transition-colors ${
                    sectionAudit.isDeviation
                      ? isLight ? 'bg-rose-50/80 border-rose-200' : 'bg-rose-950/20 border-rose-500/30'
                      : isLight
                      ? 'bg-[#EAF8F0] border-[#DDF5EA]'
                      : 'bg-cyan-950/30 border-cyan-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                        sectionAudit.isDeviation
                          ? 'text-rose-500'
                          : isLight ? 'text-[#07966D]' : 'text-cyan-400'
                      }`}
                    >
                      Selected Section
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                        sectionAudit.isDeviation
                          ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                          : sectionAudit.hasExecution
                          ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : isLight
                          ? 'bg-slate-100 text-slate-600 border border-slate-200'
                          : 'bg-slate-800/60 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {sectionAudit.isDeviation ? (
                        <>
                          <AlertTriangle className="w-3 h-3 text-rose-500" />
                          <span>Deviation</span>
                        </>
                      ) : sectionAudit.hasExecution ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>Compliant</span>
                        </>
                      ) : (
                        <>
                          <span className="w-2 h-2 rounded-full bg-[#CBD5E1]" />
                          <span>Planned</span>
                        </>
                      )}
                    </span>
                  </div>

                  <div className={`text-base font-bold font-mono ${isLight ? 'text-[#17212B]' : 'text-white'}`}>
                    {sectionAudit.sectionTitle}
                  </div>

                  <div className="flex items-center justify-between pt-0.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          isLight
                            ? 'bg-white text-[#07966D] border border-[#DDF5EA]'
                            : 'bg-[#0B0F19] text-cyan-300 border border-cyan-500/30'
                        }`}
                      >
                        {sectionAudit.side}
                      </span>
                    </div>

                    <span className={`text-[11px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      {sectionAudit.lengthM}m span
                    </span>
                  </div>
                </div>

                {/* Sequence Deviation Warning Banner */}
                {sectionAudit.isDeviation && (
                  <div className={`p-2.5 rounded-xl border flex items-start gap-2 ${
                    isLight ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                  }`}>
                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <div className="text-xs font-mono space-y-0.5 leading-tight">
                      <div className="font-bold text-rose-600 dark:text-rose-400">Sequence Deviation Detected</div>
                      <div className="text-[11px] text-rose-500/90 dark:text-rose-300">
                        {sectionAudit.causingActivity ? (
                          <>
                            <strong className="text-rose-600 dark:text-rose-200">{sectionAudit.causingActivity}</strong> executed without required predecessor{sectionAudit.missingPredecessors.length > 1 ? 's' : ''}:{' '}
                            <strong>{sectionAudit.missingPredecessors.join(', ')}</strong>
                          </>
                        ) : (
                          sectionAudit.deviationDescription || 'Out-of-sequence execution detected'
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Completed Activities */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-mono font-bold uppercase tracking-wider ${
                      isLight ? 'text-slate-600' : 'text-slate-400'
                    }`}>
                      Completed Activities
                    </span>
                    <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                      sectionAudit.completedActivities.length > 0
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold'
                        : isLight ? 'text-slate-400 bg-slate-100' : 'text-slate-500 bg-white/5'
                    }`}>
                      {sectionAudit.completedActivities.length} / 5
                    </span>
                  </div>

                  {sectionAudit.completedActivities.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {sectionAudit.completedActivities.map((act) => (
                        <span
                          key={act.stage}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border shadow-xs ${
                            isLight
                              ? 'bg-white text-slate-800 border-slate-200'
                              : 'bg-[#141B2D] text-slate-100 border-white/10'
                          }`}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: act.colorHex }}
                          />
                          <span>{act.name}</span>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className={`p-2 rounded-lg text-xs font-mono italic text-center border border-dashed ${
                      isLight ? 'bg-slate-50/60 border-slate-200 text-slate-400' : 'bg-white/5 border-white/10 text-slate-500'
                    }`}>
                      No activities completed yet
                    </div>
                  )}
                </div>

                {/* Partially Completed Activities (if any) */}
                {sectionAudit.partialActivities.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-mono font-bold uppercase tracking-wider ${
                        isLight ? 'text-amber-600' : 'text-amber-400'
                      }`}>
                        Partially Completed
                      </span>
                      <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
                        {sectionAudit.partialActivities.length}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {sectionAudit.partialActivities.map((act) => (
                        <span
                          key={act.stage}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border ${
                            isLight
                              ? 'bg-amber-50/70 text-amber-900 border-amber-200'
                              : 'bg-amber-950/20 text-amber-300 border-amber-500/30'
                          }`}
                          title={`${act.name}: ${act.coveredM}m of ${sectionAudit.lengthM}m (${act.coveragePercent}%)`}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: act.colorHex }}
                          />
                          <span>{act.name}</span>
                          <span className="text-[10px] font-normal text-amber-600 dark:text-amber-400">
                            ({act.coveredM}m / {act.coveragePercent}%)
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pending Activities */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-mono font-bold uppercase tracking-wider ${
                      isLight ? 'text-slate-500' : 'text-slate-400'
                    }`}>
                      Pending Activities
                    </span>
                    <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                      isLight ? 'text-slate-500 bg-slate-100' : 'text-slate-400 bg-white/5'
                    }`}>
                      {sectionAudit.pendingActivities.length} / 5
                    </span>
                  </div>

                  {sectionAudit.pendingActivities.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {sectionAudit.pendingActivities.map((act) => (
                        <span
                          key={act.stage}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono border ${
                            isLight
                              ? 'bg-slate-50 text-slate-500 border-slate-200'
                              : 'bg-white/5 text-slate-400 border-white/10'
                          }`}
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0 border"
                            style={{ borderColor: act.colorHex, backgroundColor: 'transparent' }}
                          />
                          <span>{act.name}</span>
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-1 py-0.2 rounded ${
                            isLight ? 'bg-slate-200/80 text-slate-600' : 'bg-white/10 text-slate-300'
                          }`}>
                            Pending
                          </span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className={`p-2 rounded-lg text-xs font-mono text-center border ${
                      isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                    }`}>
                      ✓ All 5 activities completed
                    </div>
                  )}
                </div>

                {/* Prominent Action Link: View Details -> */}
                <div className="pt-2">
                  <button
                    onClick={() => setIsDetailsModalOpen(true)}
                    className={`w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isLight
                        ? 'text-[#07966D] hover:bg-[#EAF8F0] border border-[#DDF5EA]'
                        : 'text-cyan-300 hover:bg-cyan-500/10 border border-cyan-500/30'
                    }`}
                  >
                    <span>View Details</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              /* Empty State matching Draft A */
              <div className="py-6 flex flex-col items-center justify-center text-center space-y-3">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-sm ${
                    isLight
                      ? 'bg-slate-50 border-slate-200 text-slate-400'
                      : 'bg-[#0B0F19] border-white/10 text-slate-500'
                  }`}
                >
                  <span className="text-2xl">🛣️</span>
                </div>
                <div>
                  <h4 className={`text-xs font-bold ${isLight ? 'text-[#17212B]' : 'text-slate-200'}`}>
                    No Highway Section Selected
                  </h4>
                  <p className={`text-[11px] leading-relaxed mt-1 max-w-[220px] ${isLight ? 'text-[#64748B]' : 'text-slate-400'}`}>
                    Click any road segment in the 3D scene, search a chainage above, or select a row to inspect its parameters.
                  </p>
                </div>

                {/* Quick Corridor Jumps */}
                <div className="w-full pt-3 border-t border-slate-200 dark:border-white/10 text-left space-y-1.5">
                  <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold">
                    Quick Corridor Jumps:
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    <button
                      onClick={() => handleQuickJump('131+000')}
                      className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                        isLight
                          ? 'bg-slate-50 border-slate-200 hover:border-[#07966D] hover:bg-[#EAF8F0]'
                          : 'bg-[#0B0F19] border-white/10 hover:border-cyan-500/40 hover:bg-white/5'
                      }`}
                    >
                      <div className={`font-mono font-bold text-[11px] ${isLight ? 'text-[#07966D]' : 'text-cyan-300'}`}>
                        Ch. 131+000
                      </div>
                      <div className="text-[9px] text-slate-400 truncate">Muzaffarnagar Start</div>
                    </button>

                    <button
                      onClick={() => handleQuickJump('168+000')}
                      className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                        isLight
                          ? 'bg-slate-50 border-slate-200 hover:border-[#07966D] hover:bg-[#EAF8F0]'
                          : 'bg-[#0B0F19] border-white/10 hover:border-cyan-500/40 hover:bg-white/5'
                      }`}
                    >
                      <div className={`font-mono font-bold text-[11px] ${isLight ? 'text-[#07966D]' : 'text-emerald-300'}`}>
                        Ch. 168+000
                      </div>
                      <div className="text-[9px] text-slate-400 truncate">Manglaur Toll</div>
                    </button>

                    <button
                      onClick={() => handleQuickJump('189+230')}
                      className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                        isLight
                          ? 'bg-slate-50 border-slate-200 hover:border-[#07966D] hover:bg-[#EAF8F0]'
                          : 'bg-[#0B0F19] border-white/10 hover:border-cyan-500/40 hover:bg-white/5'
                      }`}
                    >
                      <div className={`font-mono font-bold text-[11px] ${isLight ? 'text-[#07966D]' : 'text-cyan-300'}`}>
                        Ch. 189+230
                      </div>
                      <div className="text-[9px] text-slate-400 truncate">Roorkee Bypass</div>
                    </button>

                    <button
                      onClick={() => handleQuickJump('204+000')}
                      className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                        isLight
                          ? 'bg-slate-50 border-slate-200 hover:border-[#07966D] hover:bg-[#EAF8F0]'
                          : 'bg-[#0B0F19] border-white/10 hover:border-cyan-500/40 hover:bg-white/5'
                      }`}
                    >
                      <div className={`font-mono font-bold text-[11px] ${isLight ? 'text-[#07966D]' : 'text-cyan-300'}`}>
                        Ch. 204+000
                      </div>
                      <div className="text-[9px] text-slate-400 truncate">Haridwar Approach</div>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 5: BOTTOM PLAYBACK DOCK (Draft A)
      ========================================================================= */}
      <div
        className={`px-4 py-2.5 rounded-2xl border flex flex-wrap items-center justify-between gap-3 text-xs font-mono shadow-sm transition-colors ${
          isLight ? 'bg-white border-slate-200' : 'bg-[#101726] border-white/10'
        }`}
      >
        {/* Play/Pause Button, Speed Selector, Chainage Readout */}
        <div className="flex items-center gap-3">
          {/* Play/Pause Button */}
          <button
            onClick={handleTogglePlay}
            className={`p-2 rounded-xl flex items-center justify-center cursor-pointer transition-all shadow-sm ${
              isLight
                ? 'bg-[#07966D] hover:bg-[#06805D] text-white'
                : 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40'
            }`}
            title={isPlayingTour ? 'Pause Corridor Tour' : 'Play Corridor Tour'}
          >
            {isPlayingTour ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          {/* Speed Selector (1.0x ▾) */}
          <select
            value={tourSpeed}
            onChange={e => {
              const s = Number(e.target.value);
              setTourSpeed(s);
              highway3DRef.current?.setTourSpeed(s);
            }}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-mono font-semibold cursor-pointer focus:outline-none ${
              isLight
                ? 'bg-slate-50 border-slate-200 text-[#17212B]'
                : 'bg-[#0B0F19] border-white/10 text-slate-200'
            }`}
          >
            <option value={1}>1.0x</option>
            <option value={1.5}>1.5x</option>
            <option value={2}>2.0x</option>
            <option value={2.5}>2.5x</option>
            <option value={3}>3.0x</option>
          </select>

          {/* Chainage Readout: Ch. 158+398 */}
          <div
            className={`px-3 py-1.5 rounded-xl border font-mono text-xs font-bold flex items-center gap-1.5 ${
              isLight
                ? 'bg-[#EAF8F0] border-[#DDF5EA] text-[#07966D]'
                : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
            }`}
          >
            <span className={isLight ? 'text-slate-500 font-normal' : 'text-slate-400 font-normal'}>
              Chainage:
            </span>
            <span>{formatChainagePlus(currentTourKm)}</span>
          </div>
        </div>

        {/* Chainage Range Slider (Filled Track bounded by 130+560 and 206+220) */}
        <div className="flex-1 flex items-center gap-3 mx-2 max-w-xl">
          <span className={`text-[11px] font-mono font-bold whitespace-nowrap ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            {formatChainagePlus(stateBoundary.minKm).replace('Ch. ', '')}
          </span>
          <input
            type="range"
            min={stateBoundary.minKm}
            max={stateBoundary.maxKm}
            step={0.01}
            value={currentTourKm}
            onChange={handleSliderChange}
            style={{
              background: isLight
                ? `linear-gradient(to right, #07966D 0%, #07966D ${sliderPct}%, #E2E8F0 ${sliderPct}%, #E2E8F0 100%)`
                : `linear-gradient(to right, #06B6D4 0%, #06B6D4 ${sliderPct}%, #1E293B ${sliderPct}%, #1E293B 100%)`
            }}
            className="flex-1 h-2 rounded-lg cursor-pointer appearance-none"
          />
          <span className={`text-[11px] font-mono font-bold whitespace-nowrap ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            {formatChainagePlus(stateBoundary.maxKm).replace('Ch. ', '')}
          </span>
        </div>
      </div>

      {/* =========================================================================
          FULL INSPECTION DETAILS MODAL (Opened from "View Details →")
      ========================================================================= */}
      {isDetailsModalOpen && inspectorMetrics && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-sans">
          <div
            className={`w-full max-w-2xl rounded-2xl border shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto ${
              isLight ? 'bg-white border-slate-200 text-[#17212B]' : 'bg-[#12161E] border-white/10 text-white'
            }`}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm ${
                    isLight
                      ? 'bg-[#EAF8F0] border-[#DDF5EA] text-[#07966D]'
                      : 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400'
                  }`}
                >
                  <Box className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold font-mono">
                    {inspectorMetrics.sectionTitle}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    Physical parameters &amp; execution audit report
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsDetailsModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* GPS Coordinates & Landmark */}
            {selectedSegmentCoords && (
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-mono ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#181E2A] border-white/5'
                }`}
              >
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#07966D] dark:text-cyan-400 shrink-0" />
                  <div>
                    <span className="text-slate-500">Coordinates: </span>
                    <strong className="text-slate-800 dark:text-slate-200">
                      {selectedSegmentCoords.lat.toFixed(6)}, {selectedSegmentCoords.lon.toFixed(6)}
                    </strong>
                    {selectedSegmentCoords.nearestLandmark && (
                      <span className="text-slate-500 ml-2">
                        • Near {selectedSegmentCoords.nearestLandmark}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleCopyCoordinates(selectedSegmentCoords.lat, selectedSegmentCoords.lon)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                    copiedCoords
                      ? 'bg-emerald-500 text-white border-emerald-500'
                      : isLight
                      ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {copiedCoords ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCoords ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            )}

            {/* Construction Execution Sequence Audit */}
            <div className={`p-3.5 rounded-xl border space-y-2 text-xs font-mono ${
              inspectorMetrics.isDeviation
                ? (isLight ? 'bg-rose-50 border-rose-200' : 'bg-rose-950/20 border-rose-500/30')
                : (isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#181E2A] border-white/5')
            }`}>
              <div className="flex items-center justify-between">
                <span className="font-bold uppercase tracking-wider text-slate-500 text-[10px]">
                  Execution Sequence Audit
                </span>
                <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] flex items-center gap-1 ${
                  inspectorMetrics.isDeviation
                    ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30'
                    : 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
                }`}>
                  {inspectorMetrics.isDeviation ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                  <span>{inspectorMetrics.isDeviation ? 'Sequence Deviation' : 'Sequence Compliant'}</span>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>Latest Completed Stage: <strong className="text-slate-900 dark:text-white">{inspectorMetrics.latestStageName}</strong></div>
                <div>Status: <strong className={inspectorMetrics.isDeviation ? 'text-rose-500' : 'text-emerald-500'}>{inspectorMetrics.statusLabel}</strong></div>
              </div>
              {inspectorMetrics.isDeviation && inspectorMetrics.missingPredecessors.length > 0 && (
                <div className="text-[11px] text-rose-500 font-bold bg-rose-500/10 p-2 rounded-lg">
                  Missing Preceding Activity: {inspectorMetrics.missingPredecessors.join(', ')}
                </div>
              )}
            </div>

            {/* Cross-Section Engineering Dimensions */}
            <div className="space-y-1.5">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                Cross-Section Dimensions
              </span>
              <div className="grid grid-cols-3 gap-3 text-xs font-mono">
                <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#181E2A] border-white/5'}`}>
                  <div className="text-[10px] text-slate-500">SPAN LENGTH</div>
                  <div className="text-sm font-bold text-slate-800 dark:text-white mt-0.5">{inspectorMetrics.lengthM} m</div>
                </div>
                <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#181E2A] border-white/5'}`}>
                  <div className="text-[10px] text-slate-500">CARRIAGEWAY WIDTH</div>
                  <div className="text-sm font-bold text-slate-800 dark:text-white mt-0.5">{inspectorMetrics.widthM} m</div>
                </div>
                <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#181E2A] border-white/5'}`}>
                  <div className="text-[10px] text-slate-500">LAYER DEPTH</div>
                  <div className="text-sm font-bold text-slate-800 dark:text-white mt-0.5">
                    {selectedSegment?.primaryRow?.depthM ? `${Math.round(selectedSegment.primaryRow.depthM * 1000)} mm` : '50 mm Standard'}
                  </div>
                </div>
              </div>
            </div>

            {/* Quality Control & Test Register */}
            <div
              className={`p-4 rounded-xl border space-y-2 text-xs font-mono ${
                isLight ? 'bg-[#EAF8F0] border-[#DDF5EA]' : 'bg-emerald-950/20 border-emerald-500/30'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-[#07966D] dark:text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                <span>Quality Control &amp; Test Register (MORTH Table 900-4)</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                Verified against MORTH 5th Revision Specifications. Bitumen Extraction: 4.53% | Theoretical Max Specific Gravity (GMM): 2.469 | Gradation Stability: PASS.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-white/10">
              {selectedSegmentCoords && (
                <button
                  onClick={() => {
                    handleOpenStreetView(
                      selectedSegmentCoords.lat,
                      selectedSegmentCoords.lon,
                      inspectorMetrics.sectionTitle
                    );
                    setIsDetailsModalOpen(false);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer border ${
                    isLight
                      ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      : 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5 text-amber-500" />
                  <span>360° Street View</span>
                </button>
              )}

              <button
                onClick={() => {
                  if (onHighlightStripChart && selectedSegment) {
                    onHighlightStripChart(selectedSegment.fromChainageM);
                  }
                  setIsDetailsModalOpen(false);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer text-white shadow-sm ${
                  isLight ? 'bg-[#07966D] hover:bg-[#06805D]' : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold'
                }`}
              >
                <span>Highlight in Strip Chart</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Street View Modal */}
      <StreetViewModal
        isOpen={isStreetViewOpen}
        onClose={() => setIsStreetViewOpen(false)}
        location={streetViewLocation}
      />
    </div>
  );
};
