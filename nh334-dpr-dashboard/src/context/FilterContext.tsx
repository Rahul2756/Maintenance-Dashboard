import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { ActivityType, ActualDPRRow, GlobalFilterState } from '../types/dpr';

export type { GlobalFilterState };

export type ModuleTab = 'all' | 'overview' | 'analytics' | 'spatial' | 'logs' | 'dpr';

export interface ChainagePresetInfo {
  scope: 'All' | 'DPR' | 'Sec1' | 'Sec2';
  from: number;
  to: number;
  label: string;
  shortLabel: string;
  lengthKm: number;
  description: string;
}

export const CHAINAGE_PRESETS: Record<'All' | 'DPR' | 'Sec1' | 'Sec2', ChainagePresetInfo> = {
  All: {
    scope: 'All',
    from: 130.560,
    to: 206.220,
    label: 'Full Corridor (Muzaffarnagar - Haridwar)',
    shortLabel: 'All (75.7 km)',
    lengthKm: 75.66,
    description: 'Ch. 130+560 to Km 206+220 BHS (Full Contractual Scope)'
  },
  DPR: {
    scope: 'DPR',
    from: 169.000,
    to: 206.220,
    label: 'Active DPR Package (Roorkee - Haridwar)',
    shortLabel: 'DPR (37.2 km)',
    lengthKm: 37.22,
    description: 'Ch. 169+000 to Km 206+220 BHS (Active Daily Execution Corridor)'
  },
  Sec1: {
    scope: 'Sec1',
    from: 130.560,
    to: 169.000,
    label: 'Section 1 (Muzaffarnagar - Roorkee)',
    shortLabel: 'Sec 1 (38.4 km)',
    lengthKm: 38.44,
    description: 'Ch. 130+560 to Km 169+000 BHS (Upcoming Phase Scope)'
  },
  Sec2: {
    scope: 'Sec2',
    from: 169.000,
    to: 206.220,
    label: 'Section 2 (Roorkee - Haridwar)',
    shortLabel: 'Sec 2 (37.2 km)',
    lengthKm: 37.22,
    description: 'Ch. 169+000 to Km 206+220 BHS (Current Maintenance Package)'
  }
};

export const DEFAULT_FILTER_STATE: GlobalFilterState = {
  side: 'Both',
  selectedActivities: ['Milling', 'Tackcoat', 'DBM', 'BC'],
  dateRange: { start: '14.10.2026', end: '01.11.2026' },
  selectedSingleDate: '01.11.2026',
  chainageScope: 'DPR',
  chainageBounds: { from: 169.000, to: 206.220 },
  anomaliesOnly: false,
  searchQuery: ''
};

interface FilterContextType {
  filters: GlobalFilterState;
  setFilters: React.Dispatch<React.SetStateAction<GlobalFilterState>>;
  activeModule: ModuleTab;
  setActiveModule: (module: ModuleTab) => void;
  scrollToModule: (module: ModuleTab) => void;
  setSide: (side: 'LHS' | 'RHS' | 'Both') => void;
  toggleActivity: (activity: ActivityType, singleMode?: boolean) => void;
  setSelectedActivities: (activities: ActivityType[]) => void;
  selectAllActivities: () => void;
  setDateRange: (range: { start: string; end: string }) => void;
  setSelectedSingleDate: (date: string | null) => void;
  setSelectedDate: (date: string | null) => void;
  selectedDate: string;
  setChainageScope: (scope: 'All' | 'DPR' | 'Sec1' | 'Sec2') => void;
  setChainageBounds: (bounds: { from: number; to: number }) => void;
  setAnomaliesOnly: (val: boolean | ((prev: boolean) => boolean)) => void;
  setSearchQuery: (query: string) => void;
  resetFilters: (availableDates?: string[]) => void;
  isFiltered: boolean;
  filterStats: {
    activeFilterCount: number;
    hasSingleDate: boolean;
    hasSideFilter: boolean;
    hasActivityFilter: boolean;
    hasChainageFilter: boolean;
    hasAnomalyFilter: boolean;
    hasSearchFilter: boolean;
  };
  // Convenience properties matching TopHeader blueprint
  side: 'LHS' | 'RHS' | 'Both';
  selectedActivities: ActivityType[];
  scope: 'All' | 'DPR' | 'Sec1' | 'Sec2';
  setScope: (scope: 'All' | 'DPR' | 'Sec1' | 'Sec2') => void;
  dateRange: { start: string; end: string };
  anomalyFilter: string;
  setAnomalyFilter: (val: string | boolean) => void;
  activeTab: ModuleTab;
  setActiveTab: (tab: ModuleTab) => void;
  applyFilters: () => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export const FilterProvider: React.FC<{
  children: React.ReactNode;
  initialDates?: string[];
}> = ({ children, initialDates }) => {
  const [filters, setFilters] = useState<GlobalFilterState>(() => {
    if (initialDates && initialDates.length > 0) {
      return {
        ...DEFAULT_FILTER_STATE,
        dateRange: {
          start: initialDates[0],
          end: initialDates[initialDates.length - 1]
        }
      };
    }
    return DEFAULT_FILTER_STATE;
  });

  const [activeModule, setActiveModule] = useState<ModuleTab>('overview');

  // Module switch handler
  const scrollToModule = useCallback((mod: ModuleTab) => {
    const target = mod === 'dpr' ? 'logs' : mod;
    setActiveModule(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Filter setters with bi-directional safety
  const setSide = useCallback((side: 'LHS' | 'RHS' | 'Both') => {
    setFilters(prev => ({ ...prev, side }));
  }, []);

  const toggleActivity = useCallback((activity: ActivityType, singleMode: boolean = false) => {
    setFilters(prev => {
      if (singleMode) {
        return { ...prev, selectedActivities: [activity] };
      }
      const exists = prev.selectedActivities.includes(activity);
      if (exists) {
        if (prev.selectedActivities.length === 1) return prev; // Keep at least one
        return {
          ...prev,
          selectedActivities: prev.selectedActivities.filter(a => a !== activity)
        };
      }
      return {
        ...prev,
        selectedActivities: [...prev.selectedActivities, activity]
      };
    });
  }, []);

  const setSelectedActivities = useCallback((activities: ActivityType[]) => {
    if (activities.length === 0) return;
    setFilters(prev => ({ ...prev, selectedActivities: activities }));
  }, []);

  const selectAllActivities = useCallback(() => {
    setFilters(prev => ({
      ...prev,
      selectedActivities: ['Milling', 'Tackcoat', 'DBM', 'BC']
    }));
  }, []);

  const setDateRange = useCallback((range: { start: string; end: string }) => {
    setFilters(prev => ({ ...prev, dateRange: range, selectedSingleDate: null }));
  }, []);

  const setSelectedSingleDate = useCallback((date: string | null) => {
    setFilters(prev => ({
      ...prev,
      selectedSingleDate: date,
      dateRange: date ? { start: prev.dateRange.start, end: date } : prev.dateRange
    }));
  }, []);

  const setSelectedDate = setSelectedSingleDate;

  const setChainageScope = useCallback((scope: 'All' | 'DPR' | 'Sec1' | 'Sec2') => {
    const preset = CHAINAGE_PRESETS[scope];
    setFilters(prev => ({
      ...prev,
      chainageScope: scope,
      chainageBounds: { from: preset.from, to: preset.to }
    }));
  }, []);

  const setChainageBounds = useCallback((bounds: { from: number; to: number }) => {
    setFilters(prev => {
      // Check if matches known presets
      let matchedScope: 'All' | 'DPR' | 'Sec1' | 'Sec2' = prev.chainageScope;
      for (const [key, preset] of Object.entries(CHAINAGE_PRESETS)) {
        if (
          Math.abs(preset.from - bounds.from) < 0.05 &&
          Math.abs(preset.to - bounds.to) < 0.05
        ) {
          matchedScope = key as 'All' | 'DPR' | 'Sec1' | 'Sec2';
          break;
        }
      }
      return {
        ...prev,
        chainageBounds: bounds,
        chainageScope: matchedScope
      };
    });
  }, []);

  const setAnomaliesOnly = useCallback((val: boolean | ((prev: boolean) => boolean)) => {
    setFilters(prev => ({
      ...prev,
      anomaliesOnly: typeof val === 'function' ? val(prev.anomaliesOnly) : val
    }));
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setFilters(prev => ({ ...prev, searchQuery: query }));
  }, []);

  const resetFilters = useCallback((availableDates?: string[]) => {
    const latest = availableDates?.[availableDates.length - 1] || '01.11.2026';
    const earliest = availableDates?.[0] || '14.10.2026';
    setFilters({
      side: 'Both',
      selectedActivities: ['Milling', 'Tackcoat', 'DBM', 'BC'],
      dateRange: {
        start: earliest,
        end: latest
      },
      selectedSingleDate: latest,
      chainageScope: 'DPR',
      chainageBounds: { from: 169.000, to: 206.220 },
      anomaliesOnly: false,
      searchQuery: ''
    });
  }, []);

  const filterStats = useMemo(() => {
    const hasSingleDate = filters.selectedSingleDate !== null;
    const hasSideFilter = filters.side !== 'Both';
    const hasActivityFilter = filters.selectedActivities.length !== 4;
    const hasChainageFilter = filters.chainageScope !== 'DPR';
    const hasAnomalyFilter = filters.anomaliesOnly;
    const hasSearchFilter = filters.searchQuery.trim().length > 0;

    const count =
      (hasSingleDate ? 1 : 0) +
      (hasSideFilter ? 1 : 0) +
      (hasActivityFilter ? 1 : 0) +
      (hasChainageFilter ? 1 : 0) +
      (hasAnomalyFilter ? 1 : 0) +
      (hasSearchFilter ? 1 : 0);

    return {
      activeFilterCount: count,
      hasSingleDate,
      hasSideFilter,
      hasActivityFilter,
      hasChainageFilter,
      hasAnomalyFilter,
      hasSearchFilter
    };
  }, [filters]);

  const isFiltered = filterStats.activeFilterCount > 0;

  const applyFilters = useCallback(() => {
    // Re-affirm filter state (triggers any listeners/subscribers)
    setFilters(prev => ({ ...prev }));
  }, []);

  const selectedDate = filters.selectedSingleDate || filters.dateRange.end || '01.11.2026';

  const value = useMemo(
    () => ({
      filters,
      setFilters,
      activeModule,
      setActiveModule,
      scrollToModule,
      setSide,
      toggleActivity,
      setSelectedActivities,
      selectAllActivities,
      setDateRange,
      setSelectedSingleDate,
      setSelectedDate,
      selectedDate,
      setChainageScope,
      setChainageBounds,
      setAnomaliesOnly,
      setSearchQuery,
      resetFilters,
      isFiltered,
      filterStats,
      // Convenience properties
      side: filters.side,
      selectedActivities: filters.selectedActivities,
      scope: filters.chainageScope,
      setScope: setChainageScope,
      dateRange: filters.dateRange,
      anomalyFilter: filters.anomaliesOnly ? 'Anomalies' : 'All',
      setAnomalyFilter: (val: string | boolean) => {
        setAnomaliesOnly(typeof val === 'string' ? val === 'Anomalies' : Boolean(val));
      },
      activeTab: activeModule,
      setActiveTab: scrollToModule,
      applyFilters
    }),
    [
      filters,
      activeModule,
      scrollToModule,
      setSide,
      toggleActivity,
      setSelectedActivities,
      selectAllActivities,
      setDateRange,
      setSelectedSingleDate,
      setSelectedDate,
      selectedDate,
      setChainageScope,
      setChainageBounds,
      setAnomaliesOnly,
      setSearchQuery,
      resetFilters,
      isFiltered,
      filterStats,
      applyFilters
    ]
  );

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
};

export const useFilters = (): FilterContextType => {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
};

export const useFilterContext = useFilters;

/**
 * High-performance row matcher adhering to unified global filter state
 */
export function rowMatchesGlobalFilter(row: ActualDPRRow, filters: GlobalFilterState): boolean {
  // 1. Single Date filter
  if (filters.selectedSingleDate) {
    if (row.date !== filters.selectedSingleDate) return false;
  } else {
    // Date range filter
    const parseDMY = (s: string) => {
      const parts = s.split('.').map(Number);
      return new Date(parts[2], parts[1] - 1, parts[0]).getTime();
    };
    try {
      const rTime = parseDMY(row.date);
      const sTime = parseDMY(filters.dateRange.start);
      const eTime = parseDMY(filters.dateRange.end);
      if (rTime < sTime || rTime > eTime) return false;
    } catch {
      // fallback
    }
  }

  // 2. Side filter ('Both' accepts all, otherwise must match 'LHS' or 'RHS')
  if (filters.side !== 'Both') {
    if (row.side !== filters.side) return false;
  }

  // 3. Activity filter
  if (!filters.selectedActivities.includes(row.activity)) return false;

  // 4. Chainage bounds filter: row overlap [from, to]
  const rowMin = Math.min(row.fromChainage, row.toChainage);
  const rowMax = Math.max(row.fromChainage, row.toChainage);
  if (rowMax < filters.chainageBounds.from || rowMin > filters.chainageBounds.to) {
    return false;
  }

  // 5. Anomalies only filter
  if (filters.anomaliesOnly && !row.isAnomaly) return false;

  // 6. Search query filter
  if (filters.searchQuery.trim()) {
    const q = filters.searchQuery.toLowerCase().trim();
    const str = `${row.date} ${row.activity} ${row.lane} ${row.side} ${row.fromChainage} ${row.toChainage} ${row.remarks} ${row.anomalyDescription}`.toLowerCase();
    if (!str.includes(q)) return false;
  }

  return true;
}
