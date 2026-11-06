import React, { useState, useRef, useEffect } from 'react';
import { useFilterContext, ModuleTab } from '../../context/FilterContext';
import { DPRMetadata } from '../../types/dpr';

export interface TopHeaderProps {
  metadata?: DPRMetadata;
  dataSource?: 'live_excel' | 'fallback' | 'indexeddb';
  availableDates?: string[];
  anomaliesCount?: number;
  onReload?: () => void;
  onOpenUpload?: () => void;
  onExport?: () => void;
  isLoading?: boolean;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  metadata,
  dataSource,
  availableDates = [],
  anomaliesCount,
  onExport,
  onOpenUpload,
  onReload,
  isLoading
}) => {
  const { 
    side, setSide,
    selectedActivities, setSelectedActivities,
    scope, setScope,
    dateRange, setDateRange,
    anomalyFilter, setAnomalyFilter,
    activeTab, setActiveTab,
    applyFilters, resetFilters,
    filters,
    setSelectedSingleDate
  } = useFilterContext();

  // Activity popover state
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [activityMode, setActivityMode] = useState<'single' | 'multi'>('multi');
  const activityDropdownRef = useRef<HTMLDivElement>(null);

  // Scope dropdown state
  const [isScopeOpen, setIsScopeOpen] = useState(false);
  const scopeDropdownRef = useRef<HTMLDivElement>(null);

  // Anomaly dropdown state
  const [isAnomalyOpen, setIsAnomalyOpen] = useState(false);
  const anomalyDropdownRef = useRef<HTMLDivElement>(null);

  // Filter feedback flash state
  const [filterApplied, setFilterApplied] = useState(false);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (activityDropdownRef.current && !activityDropdownRef.current.contains(target)) {
        setIsActivityOpen(false);
      }
      if (scopeDropdownRef.current && !scopeDropdownRef.current.contains(target)) {
        setIsScopeOpen(false);
      }
      if (anomalyDropdownRef.current && !anomalyDropdownRef.current.contains(target)) {
        setIsAnomalyOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const dateOptions = availableDates.length > 0
    ? availableDates
    : ['14.10.2026', '15.10.2026', '16.10.2026', '17.10.2026', '18.10.2026', '19.10.2026', '20.10.2026', '21.10.2026', '22.10.2026', '23.10.2026'];

  const activities = ['Milling', 'Tackcoat', 'DBM', 'BC'] as const;

  const handleSingleModeClick = () => {
    setActivityMode('single');
    setSelectedActivities(['Milling']);
  };

  const handleMultiModeClick = () => {
    setActivityMode('multi');
    setSelectedActivities([...activities]);
  };

  const handleActivityToggle = (act: typeof activities[number]) => {
    if (activityMode === 'single') {
      setSelectedActivities([act]);
    } else {
      if (selectedActivities.includes(act)) {
        if (selectedActivities.length > 1) {
          setSelectedActivities(selectedActivities.filter((item) => item !== act));
        }
      } else {
        setSelectedActivities([...selectedActivities, act]);
      }
    }
  };

  const handleSelectAll = () => {
    if (selectedActivities.length === activities.length) {
      // Keep at least one selected or allow empty
      setSelectedActivities(['Milling', 'Tackcoat', 'DBM', 'BC']);
    } else {
      setSelectedActivities([...activities]);
    }
  };

  const handleClearActivities = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activityMode === 'single') {
      setSelectedActivities(['Milling']);
    } else {
      setSelectedActivities(['Milling', 'Tackcoat', 'DBM', 'BC']);
    }
  };

  const handleApplyClick = () => {
    applyFilters();
    setFilterApplied(true);
    setTimeout(() => setFilterApplied(false), 1500);
  };

  return (
    <header className="w-full bg-[#040911] border-b border-white/10 select-none relative z-40 font-sans text-white">
      
      {/* =========================================================================
          TIER 1 & 2 HERO WRAPPER WITH SHARED HIGHWAY BACKDROP MATCHING IMAGE 1
          ========================================================================= */}
      <div className="w-full relative overflow-hidden bg-[#040911] border-b border-white/10">
        
        {/* Right Highway Graphic with Gradient Dissolve Mask spanning Tier 1 & 2 */}
        <div className="absolute right-0 top-0 bottom-0 w-[48%] lg:w-[44%] pointer-events-none overflow-hidden z-0 hidden md:block">
          <div className="absolute inset-0 bg-gradient-to-r from-[#040911] via-[#040911]/60 to-transparent z-10" />
          <img 
            src="/images/highway-header-banner.jpg" 
            alt="NH-334 Highway Corridor" 
            className="w-full h-full object-cover object-right"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/assets/highway-header-banner.jpg';
            }}
          />
        </div>

        {/* TIER 1: PROJECT IDENTITY, METADATA & TOP-RIGHT METRIC BADGES */}
        <div className="w-full px-6 lg:px-8 pt-7 pb-6 flex flex-wrap items-center justify-between gap-6 border-b border-white/10 relative z-10">
          
          {/* Left: Prominent Road Logo + Title Block */}
          <div className="flex items-center gap-5 lg:gap-6">
            {/* CubeTech Corporate Logo Container */}
            <div className="h-16 lg:h-[68px] px-3.5 py-1.5 rounded-2xl bg-white shadow-lg shadow-black/40 flex items-center justify-center shrink-0 border border-white/20">
              <img
                src="/cubetech-logo.png"
                alt="Cube Highways Technologies Pvt. Ltd."
                className="h-full w-auto max-h-12 lg:max-h-14 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/cubetech-logo.jpg';
                }}
              />
            </div>

            {/* Titles & Meta Details */}
            <div className="flex flex-col">
              <span className="text-[11px] font-sans tracking-wider text-slate-300 font-semibold uppercase">
                PROJECT MONITORING DASHBOARD
              </span>
              <h1 className="text-xl lg:text-[26px] font-extrabold tracking-tight text-white mt-0.5 leading-tight">
                Muzaffarnagar - Haridwar Section, NH-334 (Ch. 130+560KM to 206+220KM)
              </h1>
            </div>
          </div>

          {/* Right: Key Corridor Metric Badges */}
          <div className="flex items-center gap-8 lg:gap-10 shrink-0 relative z-20">
            {/* Corridor Length */}
            <div className="flex items-center gap-3.5">
              <div className="text-[#00E599] shrink-0">
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4 22L8.5 2H11L8 22H4ZM16 22L13 2H15.5L20 22H16ZM9 13.5H15V15.5H9V13.5Z" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-slate-300 font-sans tracking-wide">Corridor Length</span>
                <span className="text-lg lg:text-xl font-bold text-white font-mono leading-tight mt-0.5">75.660 km</span>
              </div>
            </div>

            {/* Vertical Separator */}
            <div className="h-10 w-px bg-white/20 hidden sm:block" />

            {/* Planned Completion */}
            <div className="flex items-center gap-3.5">
              <div className="text-[#00E599] shrink-0">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="2" />
                  <line x1="16" y1="2" x2="16" y2="6" strokeWidth="2" strokeLinecap="round" />
                  <line x1="8" y1="2" x2="8" y2="6" strokeWidth="2" strokeLinecap="round" />
                  <line x1="3" y1="10" x2="21" y2="10" strokeWidth="2" />
                  <circle cx="8" cy="14" r="1" fill="currentColor" />
                  <circle cx="12" cy="14" r="1" fill="currentColor" />
                  <circle cx="16" cy="14" r="1" fill="currentColor" />
                  <circle cx="8" cy="18" r="1" fill="currentColor" />
                  <circle cx="12" cy="18" r="1" fill="currentColor" />
                  <circle cx="16" cy="18" r="1" fill="currentColor" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-slate-300 font-sans tracking-wide">Planned Completion</span>
                <span className="text-lg lg:text-xl font-bold text-white font-mono leading-tight mt-0.5">Jan 2027</span>
              </div>
            </div>
          </div>

        </div>

        {/* TIER 2: NAVIGATION TABS */}
        <div className="w-full px-6 lg:px-8 py-2.5 flex items-center justify-between min-h-[60px] relative z-10 bg-[#040911]/50 backdrop-blur-[2px]">
          
          {/* Module Navigation Tabs */}
          <nav className="flex items-center gap-3 sm:gap-5 lg:gap-7 relative z-20 overflow-x-auto">
            
            {/* Tab 1: Project Overview */}
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'bg-gradient-to-b from-[#003B2A]/90 to-[#002218]/90 text-[#00E599] border border-[#00E599]/60 border-b-2 border-b-[#00E599] shadow-lg shadow-[#00E599]/20'
                  : 'text-slate-300 hover:text-white border border-transparent hover:bg-white/5'
              }`}
            >
              <svg className={`w-4 h-4 ${activeTab === 'overview' ? 'text-[#00E599]' : 'text-slate-400'}`} fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
              </svg>
              <span>Project Overview</span>
            </button>

            {/* Tab 2: Daily Analytics */}
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'analytics'
                  ? 'bg-gradient-to-b from-[#003B2A]/90 to-[#002218]/90 text-[#00E599] border border-[#00E599]/60 border-b-2 border-b-[#00E599] shadow-lg shadow-[#00E599]/20'
                  : 'text-slate-300 hover:text-white border border-transparent hover:bg-white/5'
              }`}
            >
              <svg className={`w-4 h-4 ${activeTab === 'analytics' ? 'text-[#00E599]' : 'text-slate-400'}`} fill="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="12" width="4" height="9" rx="1" />
                <rect x="10" y="7" width="4" height="14" rx="1" />
                <rect x="17" y="3" width="4" height="18" rx="1" />
              </svg>
              <span>Daily Analytics</span>
            </button>

            {/* Tab 3: Spatial / Strip Map */}
            <button
              onClick={() => setActiveTab('spatial')}
              className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'spatial'
                  ? 'bg-gradient-to-b from-[#003B2A]/90 to-[#002218]/90 text-[#00E599] border border-[#00E599]/60 border-b-2 border-b-[#00E599] shadow-lg shadow-[#00E599]/20'
                  : 'text-slate-300 hover:text-white border border-transparent hover:bg-white/5'
              }`}
            >
              <svg className={`w-4 h-4 ${activeTab === 'spatial' ? 'text-[#00E599]' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <span>Spatial / Strip Map</span>
            </button>

            {/* Tab 4: Chainage Logs & DPR */}
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'logs' || activeTab === 'dpr'
                  ? 'bg-gradient-to-b from-[#003B2A]/90 to-[#002218]/90 text-[#00E599] border border-[#00E599]/60 border-b-2 border-b-[#00E599] shadow-lg shadow-[#00E599]/20'
                  : 'text-slate-300 hover:text-white border border-transparent hover:bg-white/5'
              }`}
            >
              <svg className={`w-4 h-4 ${activeTab === 'logs' || activeTab === 'dpr' ? 'text-[#00E599]' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Chainage Logs & DPR</span>
            </button>


          </nav>

        </div>

      </div>

      {/* =========================================================================
          TIER 3: CONSOLIDATED FILTER RIBBON & INTERACTIVE ACTIVITY POPOVER
          ========================================================================= */}
      <div className="w-full px-6 py-2.5 bg-[#03070E] border-b border-white/10 relative z-30">
        
        {/* Rounded Outer Filter Ribbon Container matching reference */}
        <div className="w-full p-2.5 bg-[#070D18]/90 border border-white/10 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-lg backdrop-blur-md">
          
          {/* Left Side Filter Controls Group */}
          <div className="flex flex-wrap items-center gap-4">
            
            {/* 1. SIDE FILTER */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-gray-300 text-[11px] font-medium">
                <svg className="w-3.5 h-3.5 text-[#00E599]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span>Side</span>
              </div>
              <div className="bg-[#0B121E] border border-white/10 p-1 rounded-xl flex items-center gap-1">
                {(['LHS', 'RHS', 'Both'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSide(s)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      side === s 
                        ? 'bg-[#008B6B] text-white shadow-sm shadow-[#008B6B]/40' 
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. ACTIVITY FILTER (WITH OPEN POPOVER MATCHING REFERENCE) */}
            <div className={`flex flex-col gap-1 relative ${isActivityOpen ? 'z-50' : 'z-20'}`} ref={activityDropdownRef}>
              <div className="flex items-center gap-1.5 text-gray-300 text-[11px] font-medium">
                <svg className="w-3.5 h-3.5 text-[#00E599]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span>Activity</span>
              </div>

              {/* Trigger Button */}
              <button
                onClick={() => setIsActivityOpen(!isActivityOpen)}
                className={`bg-[#0B121E] border ${
                  isActivityOpen ? 'border-[#00E599] shadow-[0_0_10px_rgba(0,229,153,0.2)]' : 'border-white/10 hover:border-white/20'
                } rounded-xl px-3 py-1.5 flex items-center justify-between gap-3 text-xs text-white min-w-[145px] cursor-pointer transition-all`}
              >
                <div className="flex items-center gap-1.5 bg-[#008B6B] px-2 py-0.5 rounded text-[11px] font-medium">
                  <span>
                    {selectedActivities.length === activities.length
                      ? `All (${activities.length})`
                      : selectedActivities.length === 1
                        ? selectedActivities[0]
                        : `${selectedActivities.length} Selected`}
                  </span>
                  <span 
                    onClick={handleClearActivities}
                    className="text-white/80 hover:text-white cursor-pointer ml-0.5"
                    title={activityMode === 'single' ? 'Reset to Milling' : 'Reset to All'}
                  >
                    ✕
                  </span>
                </div>
                <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isActivityOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Floating Dropdown Popover */}
              {isActivityOpen && (
                <div className="absolute top-[calc(100%+6px)] left-0 w-48 bg-[#09121D] border border-white/15 rounded-xl shadow-2xl p-2.5 z-50 flex flex-col gap-2 backdrop-blur-md">
                  {/* Single vs Multi Segmented Control */}
                  <div className="bg-black/50 border border-white/10 p-0.5 rounded-lg flex items-center">
                    <button
                      onClick={handleSingleModeClick}
                      className={`w-1/2 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                        activityMode === 'single' ? 'bg-[#008B6B] text-white shadow-sm' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Single
                    </button>
                    <button
                      onClick={handleMultiModeClick}
                      className={`w-1/2 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                        activityMode === 'multi' ? 'bg-[#008B6B] text-white shadow-sm' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Multi
                    </button>
                  </div>

                  {/* Checkbox List */}
                  <div className="flex flex-col gap-1 mt-1">
                    {/* Select All - Only visible in Multi mode */}
                    {activityMode === 'multi' && (
                      <div 
                        onClick={handleSelectAll}
                        className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer text-xs font-medium text-gray-200 transition-colors ${
                          selectedActivities.length === activities.length ? 'bg-[#003B2C]/50' : ''
                        }`}
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                          selectedActivities.length === activities.length ? 'bg-[#00E599] border-[#00E599] text-black font-extrabold text-[10px]' : 'border-gray-500 bg-black/40'
                        }`}>
                          {selectedActivities.length === activities.length && '✓'}
                        </div>
                        <span>All ({activities.length})</span>
                      </div>
                    )}

                    {/* Individual activities */}
                    {activities.map((act) => {
                      const isSelected = selectedActivities.includes(act);
                      return (
                        <div
                          key={act}
                          onClick={() => handleActivityToggle(act)}
                          className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer text-xs font-medium text-gray-200 transition-colors ${
                            isSelected ? 'bg-[#003B2C]/40 text-white font-medium' : ''
                          }`}
                        >
                          <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                            isSelected ? 'bg-[#00E599] border-[#00E599] text-black font-extrabold text-[10px]' : 'border-gray-500 bg-black/40'
                          }`}>
                            {isSelected && '✓'}
                          </div>
                          <span>{act}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 3. SCOPE FILTER */}
            <div className={`flex flex-col gap-1 relative ${isScopeOpen ? 'z-50' : 'z-20'}`} ref={scopeDropdownRef}>
              <div className="flex items-center gap-1.5 text-gray-300 text-[11px] font-medium">
                <svg className="w-3.5 h-3.5 text-[#00E599]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span>Scope</span>
              </div>
              <button
                onClick={() => setIsScopeOpen(!isScopeOpen)}
                className={`bg-[#0B121E] border ${
                  isScopeOpen ? 'border-[#00E599]' : 'border-white/10 hover:border-white/20'
                } rounded-xl px-3 py-2 flex items-center justify-between gap-3 text-xs text-white min-w-[130px] cursor-pointer transition-all`}
              >
                <span>
                  {scope === 'All' ? 'All Scopes' : scope === 'DPR' ? 'Active DPR Package' : scope === 'Sec1' ? 'Section 1' : 'Section 2'}
                </span>
                <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isScopeOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Scope Dropdown Options */}
              {isScopeOpen && (
                <div className="absolute top-[calc(100%+6px)] left-0 w-64 bg-[#09121D] border border-white/15 rounded-xl shadow-2xl p-2 z-50 flex flex-col gap-1 backdrop-blur-md">
                  {[
                    { key: 'All', label: 'All Scopes (Ch. 130+560 – 206+220)' },
                    { key: 'DPR', label: 'Active DPR Package (Roorkee – Haridwar)' },
                    { key: 'Sec1', label: 'Section 1 (Muzaffarnagar – Roorkee)' },
                    { key: 'Sec2', label: 'Section 2 (Roorkee – Haridwar)' }
                  ].map((item) => (
                    <button
                      key={item.key}
                      onClick={() => {
                        setScope(item.key as any);
                        setIsScopeOpen(false);
                      }}
                      className={`text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        scope === item.key ? 'bg-[#003B2C] text-[#00E599]' : 'text-gray-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 4. DATE RANGE FILTER */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-gray-300 text-[11px] font-medium">
                <svg className="w-3.5 h-3.5 text-[#00E599]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>Date Range</span>
              </div>
              <div className="flex items-center gap-1.5 bg-[#0B121E] px-2.5 py-1.5 rounded-xl border border-white/10 text-slate-200 font-mono text-xs">
                <svg className="w-3.5 h-3.5 text-[#00E599] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <select
                  value={dateRange.start}
                  onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
                  className="bg-transparent border-none text-slate-200 focus:outline-none cursor-pointer text-xs font-mono"
                >
                  {dateOptions.map(d => (
                    <option key={`start-${d}`} value={d} className="bg-[#09121D] text-slate-200">
                      {d}
                    </option>
                  ))}
                </select>
                <span className="text-slate-500 font-sans px-0.5">to</span>
                <select
                  value={dateRange.end}
                  onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
                  className="bg-transparent border-none text-slate-200 focus:outline-none cursor-pointer text-xs font-mono"
                >
                  {dateOptions.map(d => (
                    <option key={`end-${d}`} value={d} className="bg-[#09121D] text-slate-200">
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Single Focused Date Pill with Clear */}
            {filters?.selectedSingleDate && (
              <div className="flex flex-col gap-1 justify-end">
                <div className="invisible text-[11px] font-medium select-none">Focused</div>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-mono font-bold animate-pulse">
                  <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Day: {filters.selectedSingleDate}</span>
                  <button
                    onClick={() => setSelectedSingleDate?.(null)}
                    title="Clear single date focus and show full date range"
                    className="ml-1 text-amber-400 hover:text-white p-0.5 rounded cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {/* 5. ANOMALY FILTER */}
            <div className={`flex flex-col gap-1 relative ${isAnomalyOpen ? 'z-50' : 'z-20'}`} ref={anomalyDropdownRef}>
              <div className="flex items-center gap-1.5 text-gray-300 text-[11px] font-medium">
                <svg className="w-3.5 h-3.5 text-[#00E599]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Anomaly</span>
              </div>
              <button
                onClick={() => setIsAnomalyOpen(!isAnomalyOpen)}
                className={`bg-[#0B121E] border ${
                  isAnomalyOpen ? 'border-[#00E599]' : 'border-white/10 hover:border-white/20'
                } rounded-xl px-3 py-2 flex items-center justify-between gap-3 text-xs text-white min-w-[110px] cursor-pointer transition-all`}
              >
                <span>{anomalyFilter === 'Anomalies' ? 'Flagged Only' : 'All'}</span>
                <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isAnomalyOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Anomaly Dropdown */}
              {isAnomalyOpen && (
                <div className="absolute top-[calc(100%+6px)] left-0 w-44 bg-[#09121D] border border-white/15 rounded-xl shadow-2xl p-2 z-50 flex flex-col gap-1 backdrop-blur-md">
                  <button
                    onClick={() => {
                      setAnomalyFilter('All');
                      setIsAnomalyOpen(false);
                    }}
                    className={`text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      anomalyFilter === 'All' ? 'bg-[#003B2C] text-[#00E599]' : 'text-gray-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    All Rows
                  </button>
                  <button
                    onClick={() => {
                      setAnomalyFilter('Anomalies');
                      setIsAnomalyOpen(false);
                    }}
                    className={`text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      anomalyFilter === 'Anomalies' ? 'bg-[#003B2C] text-[#00E599]' : 'text-gray-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    Flagged Anomalies Only
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* Right Side: Apply Filters & Reset Action Buttons */}
          <div className="flex items-center gap-2 self-end mb-0.5">
            {/* Apply Filters Button */}
            <button
              onClick={handleApplyClick}
              className={`bg-[#008B6B] hover:bg-[#00A37D] text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-[#008B6B]/30 transition-all cursor-pointer ${
                filterApplied ? 'ring-2 ring-[#00E599] scale-95' : ''
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <span>{filterApplied ? 'Filters Applied!' : 'Apply Filters'}</span>
            </button>

            {/* Reset Button */}
            <button
              onClick={() => resetFilters()}
              className="bg-[#0B121E] hover:bg-white/10 border border-white/15 text-gray-300 p-2.5 rounded-xl transition-all cursor-pointer"
              title="Reset Filters"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

        </div>

      </div>

    </header>
  );
};

export default TopHeader;
