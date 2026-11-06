import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MapMode, RoadSegmentGeo } from '../../types/gis';
import { 
  GPS_POINTS, 
  CORRIDOR_EXTENT, 
  NH334_LANDMARKS, 
  getMilestoneMarkers, 
  getCoordinatesAtChainage,
  getChainageAtCoordinates,
  formatChainageM
} from '../../utils/gisUtils';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Compass, 
  Navigation, 
  MapPin, 
  Layers,
  Crosshair
} from 'lucide-react';

interface GISMapCanvasProps {
  mode: MapMode;
  segments: RoadSegmentGeo[];
  selectedChainageM: number | null;
  onSelectChainage: (chainageM: number) => void;
  onSelectSegment?: (segment: RoadSegmentGeo) => void;
  pegmanActive: boolean;
  onPegmanDrop?: (lat: number, lon: number, chainageFmt: string) => void;
  colorMode?: 'status' | 'activity';
}

// Tile URL generators
const getTileUrl = (x: number, y: number, z: number, mode: MapMode): string => {
  if (mode === 'roadmap') {
    const subdomains = ['a', 'b', 'c'];
    const s = subdomains[(x + y) % subdomains.length];
    return `https://${s}.tile.openstreetmap.org/${z}/${x}/${y}.png`;
  }
  // satellite and hybrid use Esri World Imagery
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
};

const getOverlayTileUrl = (x: number, y: number, z: number): string => {
  return `https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/${z}/${y}/${x}`;
};

// Web Mercator conversions
function projectLatLon(lat: number, lon: number, zoom: number): [number, number] {
  const scale = 256 * Math.pow(2, zoom);
  const x = ((lon + 180) / 360) * scale;
  const sinLat = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
  return [x, y];
}

function unprojectLatLon(x: number, y: number, zoom: number): [number, number] {
  const scale = 256 * Math.pow(2, zoom);
  const lon = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return [lat, lon];
}

// Global in-memory tile cache
const tileCache = new Map<string, HTMLImageElement>();

export const GISMapCanvas: React.FC<GISMapCanvasProps> = ({
  mode,
  segments,
  selectedChainageM,
  onSelectChainage,
  onSelectSegment,
  pegmanActive,
  onPegmanDrop,
  colorMode = 'status'
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Viewport state: Center [lat, lon] and zoom level
  const [center, setCenter] = useState<[number, number]>([
    (CORRIDOR_EXTENT.minLat + CORRIDOR_EXTENT.maxLat) / 2,
    (CORRIDOR_EXTENT.minLon + CORRIDOR_EXTENT.maxLon) / 2
  ]);
  const [zoom, setZoom] = useState<number>(10.8);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{
    chainageM: number;
    chainageFmt: string;
    lat: number;
    lon: number;
    x: number;
    y: number;
  } | null>(null);

  const milestones = React.useMemo(() => getMilestoneMarkers(5000), []);

  // Fit Full Corridor
  const handleFitFullCorridor = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const midLat = (CORRIDOR_EXTENT.minLat + CORRIDOR_EXTENT.maxLat) / 2;
    const midLon = (CORRIDOR_EXTENT.minLon + CORRIDOR_EXTENT.maxLon) / 2;
    setCenter([midLat, midLon]);

    // Fit bounding box
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);

    const latSpan = CORRIDOR_EXTENT.maxLat - CORRIDOR_EXTENT.minLat;
    const lonSpan = CORRIDOR_EXTENT.maxLon - CORRIDOR_EXTENT.minLon;

    const zoomX = Math.log2((w / 256) / (lonSpan / 360));
    const zoomY = Math.log2((h / 256) / (latSpan / 180));
    const fitZoom = Math.max(9.5, Math.min(13, Math.min(zoomX, zoomY) - 0.4));

    setZoom(fitZoom);
  }, []);

  // Jump to selected chainage if set externally
  useEffect(() => {
    if (selectedChainageM !== null && selectedChainageM !== undefined) {
      const coords = getCoordinatesAtChainage(selectedChainageM);
      setCenter(coords);
      if (zoom < 13) setZoom(13.8);
    }
  }, [selectedChainageM]);

  // Main canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Center in world coordinates
    const [centerWorldX, centerWorldY] = projectLatLon(center[0], center[1], zoom);
    const viewportLeft = centerWorldX - width / 2;
    const viewportTop = centerWorldY - height / 2;

    // Convert lat/lon to screen coordinates
    const toScreen = (lat: number, lon: number): [number, number] => {
      const [wx, wy] = projectLatLon(lat, lon, zoom);
      return [wx - viewportLeft, wy - viewportTop];
    };

    // 1. Clear background
    ctx.fillStyle = mode === 'roadmap' ? '#181E24' : '#0B0D11';
    ctx.fillRect(0, 0, width, height);

    // 2. Render Map Tiles
    const tileZoom = Math.floor(zoom);
    const tileScale = Math.pow(2, zoom - tileZoom);
    const tileSize = 256 * tileScale;

    // Compute visible tile bounds
    const minTileX = Math.floor((centerWorldX - width / 2) / 256 / Math.pow(2, zoom - tileZoom));
    const maxTileX = Math.floor((centerWorldX + width / 2) / 256 / Math.pow(2, zoom - tileZoom));
    const minTileY = Math.floor((centerWorldY - height / 2) / 256 / Math.pow(2, zoom - tileZoom));
    const maxTileY = Math.floor((centerWorldY + height / 2) / 256 / Math.pow(2, zoom - tileZoom));

    const totalTilesAtZoom = Math.pow(2, tileZoom);

    for (let tx = minTileX; tx <= maxTileX; tx++) {
      for (let ty = minTileY; ty <= maxTileY; ty++) {
        if (ty < 0 || ty >= totalTilesAtZoom) continue;
        const normalizedTx = ((tx % totalTilesAtZoom) + totalTilesAtZoom) % totalTilesAtZoom;

        const tileWorldX = tx * 256 * tileScale;
        const tileWorldY = ty * 256 * tileScale;
        const screenX = tileWorldX - viewportLeft;
        const screenY = tileWorldY - viewportTop;

        const tileUrl = getTileUrl(normalizedTx, ty, tileZoom, mode);
        let img = tileCache.get(tileUrl);

        if (!img) {
          img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = tileUrl;
          img.onload = () => {
            // trigger redraw
            setCenter(c => [c[0], c[1]]);
          };
          tileCache.set(tileUrl, img);
        }

        if (img.complete && img.naturalWidth !== 0) {
          ctx.drawImage(img, screenX, screenY, tileSize, tileSize);
        }

        // Draw Hybrid Overlay (labels & boundaries)
        if (mode === 'hybrid') {
          const overlayUrl = getOverlayTileUrl(normalizedTx, ty, tileZoom);
          let overlayImg = tileCache.get(overlayUrl);
          if (!overlayImg) {
            overlayImg = new Image();
            overlayImg.crossOrigin = 'anonymous';
            overlayImg.src = overlayUrl;
            overlayImg.onload = () => setCenter(c => [c[0], c[1]]);
            tileCache.set(overlayUrl, overlayImg);
          }
          if (overlayImg.complete && overlayImg.naturalWidth !== 0) {
            ctx.drawImage(overlayImg, screenX, screenY, tileSize, tileSize);
          }
        }
      }
    }

    // 3. Render Base NH-334 Polyline (Real GPS Alignment glow & route trace)
    if (GPS_POINTS.length > 1) {
      // Glow underlay
      ctx.beginPath();
      let started = false;
      for (const pt of GPS_POINTS) {
        const [sx, sy] = toScreen(pt.lat, pt.lon);
        if (!started) {
          ctx.moveTo(sx, sy);
          started = true;
        } else {
          ctx.lineTo(sx, sy);
        }
      }
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)'; // Cyan glow
      ctx.lineWidth = zoom > 12 ? 14 : 9;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Main corridor road line
      ctx.strokeStyle = '#1E293B'; // Dark asphalt base
      ctx.lineWidth = zoom > 12 ? 8 : 5;
      ctx.stroke();
    }

    // 4. Render Maintenance Activity & Work Zone Segments
    segments.forEach((seg) => {
      if (!seg.coordinates || seg.coordinates.length < 2) return;

      ctx.beginPath();
      seg.coordinates.forEach((c, idx) => {
        const [sx, sy] = toScreen(c[0], c[1]);
        if (idx === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });

      ctx.strokeStyle = seg.color || '#10B981';
      ctx.lineWidth = zoom > 12 ? 6 : 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    });

    // 5. Render Milestone Markers (Regular 5km / 10km intervals)
    milestones.forEach((m) => {
      const [sx, sy] = toScreen(m.lat, m.lon);
      if (sx < -50 || sx > width + 50 || sy < -50 || sy > height + 50) return;

      const isMajor = m.isMajor;

      // Marker circle
      ctx.beginPath();
      ctx.arc(sx, sy, isMajor ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = isMajor ? '#06B6D4' : '#E2E8F0';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#0B0D11';
      ctx.stroke();

      // Chainage label
      if (zoom > 10.5 || isMajor) {
        ctx.font = isMajor ? 'bold 11px monospace' : '9px monospace';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 4;
        ctx.fillText(m.chainageFmt, sx, sy - 9);
        ctx.shadowBlur = 0;
      }
    });

    // 6. Render Major Project Landmarks (Purquazi, Roorkee, Haridwar, etc.)
    NH334_LANDMARKS.forEach((lm) => {
      const [sx, sy] = toScreen(lm.lat, lm.lon);
      if (sx < -100 || sx > width + 100 || sy < -100 || sy > height + 100) return;

      // Landmark pin
      ctx.beginPath();
      ctx.arc(sx, sy, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#F59E0B'; // Amber landmark
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      // Pin center dot
      ctx.beginPath();
      ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#0B0D11';
      ctx.fill();

      // Landmark title pill
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      const text = lm.name.split(' (')[0];
      const textWidth = ctx.measureText(text).width;

      // Pill background
      ctx.fillStyle = 'rgba(18, 22, 29, 0.9)';
      ctx.beginPath();
      ctx.roundRect(sx - textWidth / 2 - 6, sy + 10, textWidth + 12, 18, 4);
      ctx.fill();
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Text
      ctx.fillStyle = '#FBBF24';
      ctx.fillText(text, sx, sy + 22);
    });

    // 7. Render Selected Chainage Pulse Marker
    if (selectedChainageM !== null && selectedChainageM !== undefined) {
      const [selLat, selLon] = getCoordinatesAtChainage(selectedChainageM);
      const [sx, sy] = toScreen(selLat, selLon);

      // Pulse ring
      ctx.beginPath();
      ctx.arc(sx, sy, 14, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.6)';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Target center
      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#06B6D4';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      // Tag
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      const label = formatChainageM(selectedChainageM);
      ctx.fillStyle = '#06B6D4';
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 4;
      ctx.fillText(label, sx, sy - 18);
      ctx.shadowBlur = 0;
    }
  }, [center, zoom, mode, segments, selectedChainageM, milestones]);

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isDragging && dragStart) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;

      const [centerWx, centerWy] = projectLatLon(center[0], center[1], zoom);
      const newWx = centerWx - dx;
      const newWy = centerWy - dy;
      const [newLat, newLon] = unprojectLatLon(newWx, newWy, zoom);

      setCenter([newLat, newLon]);
      setDragStart({ x: e.clientX, y: e.clientY });
    } else {
      // Hover detection along highway
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const [centerWx, centerWy] = projectLatLon(center[0], center[1], zoom);
      const worldX = centerWx - rect.width / 2 + mouseX;
      const worldY = centerWy - rect.height / 2 + mouseY;
      const [mouseLat, mouseLon] = unprojectLatLon(worldX, worldY, zoom);

      const closest = getChainageAtCoordinates(mouseLat, mouseLon);
      if (closest.distanceM <= (zoom > 12 ? 300 : 1500)) {
        setHoverInfo({
          chainageM: closest.chainageM,
          chainageFmt: closest.chainageFmt,
          lat: mouseLat,
          lon: mouseLon,
          x: mouseX,
          y: mouseY
        });
      } else {
        setHoverInfo(null);
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  // Wheel zoom handler
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const zoomDelta = -e.deltaY * 0.002;
    const newZoom = Math.max(9, Math.min(18, zoom + zoomDelta));

    // Zoom centered towards mouse position
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const [centerWx, centerWy] = projectLatLon(center[0], center[1], zoom);
    const mouseWorldX = centerWx - rect.width / 2 + mouseX;
    const mouseWorldY = centerWy - rect.height / 2 + mouseY;
    const [mouseLat, mouseLon] = unprojectLatLon(mouseWorldX, mouseWorldY, zoom);

    const [newCenterWx, newCenterWy] = projectLatLon(mouseLat, mouseLon, newZoom);
    const updatedCenterWx = newCenterWx - (mouseX - rect.width / 2);
    const updatedCenterWy = newCenterWy - (mouseY - rect.height / 2);
    const [newLat, newLon] = unprojectLatLon(updatedCenterWx, updatedCenterWy, newZoom);

    setZoom(newZoom);
    setCenter([newLat, newLon]);
  };

  // Canvas Click: Inspect chainage or drop Pegman
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const [centerWx, centerWy] = projectLatLon(center[0], center[1], zoom);
    const worldX = centerWx - rect.width / 2 + mouseX;
    const worldY = centerWy - rect.height / 2 + mouseY;
    const [clickLat, clickLon] = unprojectLatLon(worldX, worldY, zoom);

    const closest = getChainageAtCoordinates(clickLat, clickLon);

    // If pegman is active, trigger Street View drop
    if (pegmanActive && onPegmanDrop) {
      const [hLat, hLon] = getCoordinatesAtChainage(closest.chainageM);
      onPegmanDrop(hLat, hLon, closest.chainageFmt);
      return;
    }

    // Normal inspection click
    onSelectChainage(closest.chainageM);

    // Check if clicked segment matches any active road segment
    if (onSelectSegment) {
      const matching = segments.find(
        s => closest.chainageM >= s.fromChainageM && closest.chainageM <= s.toChainageM
      );
      if (matching) onSelectSegment(matching);
    }
  };

  return (
    <div className="relative w-full h-[620px] rounded-2xl overflow-hidden bg-[#0B0D11] select-none border border-white/10 shadow-2xl">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleClick}
        className={`w-full h-full block ${
          pegmanActive ? 'cursor-crosshair' : isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      />

      {/* Floating Hover Tooltip */}
      {hoverInfo && !isDragging && (
        <div
          style={{ left: hoverInfo.x + 12, top: hoverInfo.y - 36 }}
          className="absolute pointer-events-none z-30 px-3 py-1.5 rounded-lg bg-[#14171C]/95 backdrop-blur-md border border-cyan-500/40 text-cyan-300 font-mono text-xs shadow-xl flex items-center gap-2"
        >
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span className="font-bold text-white">{hoverInfo.chainageFmt}</span>
          <span className="text-[10px] text-slate-400">Click to inspect</span>
        </div>
      )}

      {/* Left Top Coordinate / Info Strip */}
      <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2 bg-[#12161D]/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/10 text-xs font-mono text-slate-300 shadow-lg">
        <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
          <Navigation className="w-3.5 h-3.5" /> NH-334
        </span>
        <span className="text-slate-600">|</span>
        <span>Center: {center[0].toFixed(5)}°N, {center[1].toFixed(5)}°E</span>
        <span className="text-slate-600">|</span>
        <span>Zoom: {zoom.toFixed(1)}x</span>
        <span className="text-slate-600">|</span>
        <span className="text-slate-400">
          Source: {mode === 'roadmap' ? 'OpenStreetMap' : 'Esri World Imagery (0.5m High-Res)'}
        </span>
      </div>

      {/* Right Top Map Controls Overlay */}
      <div className="absolute top-4 right-4 z-20 flex flex-col items-center gap-1.5 bg-[#12161D]/90 backdrop-blur-md p-1.5 rounded-xl border border-white/10 shadow-xl">
        <button
          onClick={() => setZoom(z => Math.min(18, z + 0.8))}
          className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <button
          onClick={() => setZoom(z => Math.max(9, z - 0.8))}
          className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <div className="w-5 h-[1px] bg-white/10 my-0.5" />

        <button
          onClick={handleFitFullCorridor}
          className="w-8 h-8 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 flex items-center justify-center transition-colors cursor-pointer"
          title="Fit Full Corridor (Ch. 130+560 to 206+220)"
        >
          <Crosshair className="w-4 h-4" />
        </button>
      </div>

      {/* Pegman Mode Active Notification Banner */}
      {pegmanActive && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl bg-amber-500/90 text-slate-950 font-bold font-mono text-xs shadow-2xl flex items-center gap-2 animate-bounce">
          <Compass className="w-4 h-4" />
          <span>Click anywhere along the highway to open Google Street View 360° panorama</span>
        </div>
      )}
    </div>
  );
};

