import React, { useState, useEffect, useCallback } from 'react';
import { StripChartDataset } from '../../types/stripChart';
import { fetchOrLoadStripChartDataset } from '../../utils/stripChartExcelParser';
import { StripMapHeader } from '../stripmap/StripMapHeader';
import { StripMapMetricsBar } from '../stripmap/StripMapMetricsBar';
import { ActivitySidebar } from '../stripmap/ActivitySidebar';
import { StripMapGrid } from '../stripmap/StripMapGrid';
import { StripMapNavigation } from '../stripmap/StripMapNavigation';
import { Loader2 } from 'lucide-react';

export interface SpatialMapModuleProps {
  onSelectChainage?: (chainageM: number) => void;
  targetChainageM?: number | null;
  onDatasetLoaded?: (dataset: StripChartDataset) => void;
}

export const SpatialMapModule: React.FC<SpatialMapModuleProps> = ({
  onSelectChainage,
  targetChainageM,
  onDatasetLoaded,
}) => {
  const [dataset, setDataset] = useState<StripChartDataset | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedActivityId, setSelectedActivityId] = useState<string>('all');
  const [colorMode, setColorMode] = useState<'completion' | 'activity'>('completion');
  const [scrollRatio, setScrollRatio] = useState<number>(0);
  const [currentStartCh, setCurrentStartCh] = useState<string>('130+560');
  const [currentEndCh, setCurrentEndCh] = useState<string>('140+000');
  const [scrollTrigger, setScrollTrigger] = useState<{
    direction: 'left' | 'right';
    id: number;
    step: 'page' | 'chunk';
  } | null>(null);
  const [targetRatio, setTargetRatio] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchOrLoadStripChartDataset();
        if (isMounted) {
          setDataset(data);
          setCurrentStartCh(data.metadata.startChainage);
          setCurrentEndCh(
            data.intervals[Math.min(14, data.intervals.length - 1)]?.toChainage || data.metadata.endChainage
          );
          if (onDatasetLoaded) {
            onDatasetLoaded(data);
          }
        }
      } catch (err) {
        console.error('Failed to load strip chart dataset:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [onDatasetLoaded]);

  // Two-way synchronization: Scroll strip chart to target chainage if selected externally
  useEffect(() => {
    if (targetChainageM !== null && targetChainageM !== undefined && dataset && dataset.intervals.length > 0) {
      const idx = dataset.intervals.findIndex(
        it => targetChainageM >= it.fromM && targetChainageM <= it.toM
      );
      if (idx !== -1) {
        const ratio = Math.max(0, Math.min(1, idx / (dataset.intervals.length - 1)));
        setScrollRatio(ratio);
        setTargetRatio(ratio);
      }
    }
  }, [targetChainageM, dataset]);

  const handleScrollRatioChange = useCallback(
    (ratio: number, start: string, end: string) => {
      setScrollRatio(ratio);
      setCurrentStartCh(start);
      setCurrentEndCh(end);
      setTargetRatio(null);
    },
    []
  );

  const handleScrollLeft = (step: 'page' | 'chunk' = 'page') => {
    setScrollTrigger({ direction: 'left', id: Date.now(), step });
  };

  const handleScrollRight = (step: 'page' | 'chunk' = 'page') => {
    setScrollTrigger({ direction: 'right', id: Date.now(), step });
  };

  const handleScrollToRatio = (ratio: number) => {
    setScrollRatio(ratio);
    setTargetRatio(ratio);
  };

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'ArrowLeft') {
        handleScrollLeft('chunk');
      } else if (e.key === 'ArrowRight') {
        handleScrollRight('chunk');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (loading || !dataset) {
    return (
      <div className="bg-[#12161D] border border-cyan-500/20 rounded-2xl p-16 flex flex-col items-center justify-center gap-3 font-mono text-slate-400 select-none shadow-2xl">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        <span className="text-sm font-semibold text-slate-300">
          Loading NH-334 Linear Highway Progression Grid...
        </span>
      </div>
    );
  }

  const canScrollLeft = scrollRatio > 0.005;
  const canScrollRight = scrollRatio < 0.995;
  const totalLengthKm = (dataset.metadata.totalLengthM / 1000).toFixed(3);

  return (
    <div className="space-y-4 font-sans select-none">
      {/* 1. Header Section with Highway Graphic Banner */}
      <StripMapHeader dataset={dataset} />

      {/* 2. Top Summary KPI Metrics Bar (6 Cards) */}
      <StripMapMetricsBar dataset={dataset} />

      {/* 3. Main Composition: Left Dedicated Activity Filter Sidebar + Right Progression Grid */}
      <div className="flex flex-col lg:flex-row items-stretch gap-4">
        {/* Left Vertical Activity Filter Sidebar */}
        <ActivitySidebar
          activities={dataset.lhsActivities}
          selectedActivityId={selectedActivityId}
          onSelectActivity={setSelectedActivityId}
        />

        {/* Right Main Progression Grid Panel */}
        <StripMapGrid
          dataset={dataset}
          selectedActivityId={selectedActivityId}
          colorMode={colorMode}
          onColorModeChange={setColorMode}
          scrollRatio={scrollRatio}
          onScrollRatioChange={handleScrollRatioChange}
          scrollTrigger={scrollTrigger}
          targetRatio={targetRatio}
        />
      </div>

      {/* 4. Bottom Horizontal Navigation Bar with Slider */}
      <StripMapNavigation
        currentStartCh={currentStartCh}
        currentEndCh={currentEndCh}
        totalStartCh={dataset.metadata.startChainage}
        totalEndCh={dataset.metadata.endChainage}
        totalLengthKm={totalLengthKm}
        scrollRatio={scrollRatio}
        canScrollLeft={canScrollLeft}
        canScrollRight={canScrollRight}
        onScrollLeft={handleScrollLeft}
        onScrollRight={handleScrollRight}
        onScrollToRatio={handleScrollToRatio}
      />
    </div>
  );
};
