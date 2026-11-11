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
import { StateFilter, STATE_BOUNDARIES } from '../../utils/stateFilterUtils';

interface GISMapCanvasProps {
  mode: MapMode;
  segments: RoadSegmentGeo[];
  selectedChainageM: number | null;
  onSelectChainage: (chainageM: number) => void;
  onSelectSegment?: (segment: RoadSegmentGeo) => void;
  pegmanActive: boolean;
  onPegmanDrop?: (lat: number, lon: number, chainageFmt: string) => void;
  colorMode?: 'status' | 'activity';
  stateFilter?: StateFilter;
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
  colorMode = 'status',
  stateFilter = 'All'
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
    segment?: RoadSegmentGeo;
  } | null>(null);

  // Re-center and adjust zoom dynamically based on active state boundaries
  useEffect(() => {
    if (stateFilter === 'Uttar Pradesh') {
      setCenter([29.62, 77.78]);
      setZoom(11.4);
    } else if (stateFilter === 'Uttarakhand') {
      setCenter([29.89, 78.02]);
      setZoom(11.0);
    } else {
      setCenter([
        (CORRIDOR_EXTENT.minLat + CORRIDOR_EXTENT.maxLat) / 2,
        (CORRIDOR_EXTENT.minLon + CORRIDOR_EXTENT.maxLon) / 2
      ]);
      setZoom(10.8);
    }
  }, [stateFilter]);

  const rawMilestones = React.useMemo(() => getMilestoneMarkers(5000), []);

  const milestones = React.useMemo(() => {
    if (!stateFilter || stateFilter === 'All') return rawMilestones;
    const boundary = STATE_BOUNDARIES[stateFilter];
    return rawMilestones.filter(m => m.chainageM >= boundary.minM && m.chainageM <= boundary.maxM);
  }, [rawMilestones, stateFilter]);

  const filteredLandmarks = React.useMemo(() => {
    if (!stateFilter || stateFilter === 'All') return NH334_LANDMARKS;
    const boundary = STATE_BOUNDARIES[stateFilter];
    return NH334_LANDMARKS.filter(lm => lm.chainageM >= boundary.minM && lm.chainageM <= boundary.maxM);
  }, [stateFilter]);

  const filteredGpsPoints = React.useMemo(() => {
    if (!stateFilter || stateFilter === 'All') return GPS_POINTS;
    const boundary = STATE_BOUNDARIES[stateFilter];
    return GPS_POINTS.filter(pt => pt.chainageM >= boundary.minM && pt.chainageM <= boundary.maxM);
  }, [stateFilter]);

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
    if (filteredGpsPoints.length > 1) {
      // Glow underlay
      ctx.beginPath();
      let started = false;
      for (const pt of filteredGpsPoints) {
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
    const hasLHS = segments.some(s => s.side === 'LHS');
    const hasRHS = segments.some(s => s.side === 'RHS');
    const isDual = hasLHS && hasRHS;

    // Helper to calculate normal offset in screen coordinates for parallel dual carriageways
    const computeOffsetPoints = (coords: [number, number][], offsetPx: number): [number, number][] => {
      const screenPts = coords.map(c => toScreen(c[0], c[1]));
      if (offsetPx === 0 || screenPts.length < 2) return screenPts;

      const res: [number, number][] = [];
      for (let i = 0; i < screenPts.length; i++) {
        let dx = 0;
        let dy = 0;
        if (i === 0) {
          dx = screenPts[1][0] - screenPts[0][0];
          dy = screenPts[1][1] - screenPts[0][1];
        } else if (i === screenPts.length - 1) {
          dx = screenPts[i][0] - screenPts[i - 1][0];
          dy = screenPts[i][1] - screenPts[i - 1][1];
        } else {
          dx = screenPts[i + 1][0] - screenPts[i - 1][0];
          dy = screenPts[i + 1][1] - screenPts[i - 1][1];
        }
        const len = Math.hypot(dx, dy) || 1;
        // Perpendicular normal: (-dy/len, dx/len)
        const nx = -dy / len;
        const ny = dx / len;
        res.push([screenPts[i][0] + nx * offsetPx, screenPts[i][1] + ny * offsetPx]);
      }
      return res;
    };

    segments.forEach((seg) => {
      if (!seg.coordinates || seg.coordinates.length < 2) return;
      if (seg.isExclusion || !seg.color || seg.status === 'dps' || seg.status === 'under_construction' || seg.status === 'himalayan') {
        // Out of Scope (DPS, Under Construction, Himalayan): No fill / blank road format
        return;
      }

      const offsetDist = isDual ? (seg.side === 'LHS' ? -3.5 : seg.side === 'RHS' ? 3.5 : 0) : 0;
      const pts = computeOffsetPoints(seg.coordinates, offsetDist);

      ctx.beginPath();
      pts.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p[0], p[1]);
        else ctx.lineTo(p[0], p[1]);
      });

      ctx.strokeStyle = seg.color || '#10B981';
      ctx.lineWidth = zoom > 12 ? (isDual ? 5 : 7) : (isDual ? 3.5 : 5);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Render status labels directly on road at suitable zoom levels
      if (zoom >= 12.2 && pts.length >= 2) {
        // Calculate total screen length of this segment
        let totalLen = 0;
        for (let i = 1; i < pts.length; i++) {
          totalLen += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        }

        // Only draw if segment has enough visual length on screen
        if (totalLen >= 30) {
          const midIdx = Math.floor(pts.length / 2);
          const midPt = pts[midIdx];

          // Check if midPt is inside visible canvas area
          if (midPt[0] >= -50 && midPt[0] <= width + 50 && midPt[1] >= -50 && midPt[1] <= height + 50) {
            let badgeText = '';
            if (seg.statusCategory === 'completed') badgeText = 'COMPLETED';
            else if (seg.statusCategory === 'dps') badgeText = 'DPS';
            else if (seg.statusCategory === 'under_construction') badgeText = 'U/C';
            else if (seg.statusCategory === 'himalayan') badgeText = 'HIMALAYAN';
            else if (seg.statusCategory === 'eligible_scope') badgeText = 'REMAINING';

            if (badgeText) {
              ctx.font = 'bold 9px monospace';
              const textWidth = ctx.measureText(badgeText).width;
              const pillW = textWidth + 8;
              const pillH = 14;

              ctx.fillStyle = 'rgba(10, 14, 20, 0.90)';
              ctx.beginPath();
              ctx.roundRect(midPt[0] - pillW / 2, midPt[1] - pillH / 2, pillW, pillH, 3);
              ctx.fill();

              ctx.strokeStyle = seg.color;
              ctx.lineWidth = 1;
              ctx.stroke();

              ctx.fillStyle = seg.color;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(badgeText, midPt[0], midPt[1]);
              ctx.textBaseline = 'alphabetic'; // reset
            }
          }
        }
      }
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
    filteredLandmarks.forEach((lm) => {
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
        // Find matching candidate segment
        const matchingSegs = segments.filter(
          s => closest.chainageM >= s.fromChainageM && closest.chainageM <= s.toChainageM
        );
        let activeSeg = matchingSegs[0];
        if (matchingSegs.length > 1) {
          let minDist = Infinity;
          for (const cand of matchingSegs) {
            for (const pt of cand.coordinates) {
              const d = (pt[0] - mouseLat) ** 2 + (pt[1] - mouseLon) ** 2;
              if (d < minDist) {
                minDist = d;
                activeSeg = cand;
              }
            }
          }
        }

        setHoverInfo({
          chainageM: closest.chainageM,
          chainageFmt: closest.chainageFmt,
          lat: mouseLat,
          lon: mouseLon,
          x: mouseX,
          y: mouseY,
          segment: activeSeg
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
      const candidates = segments.filter(
        s => closest.chainageM >= s.fromChainageM && closest.chainageM <= s.toChainageM
      );
      let bestSeg = candidates[0];
      if (candidates.length > 1) {
        let minDist = Infinity;
        for (const cand of candidates) {
          for (const pt of cand.coordinates) {
            const d = (pt[0] - clickLat) ** 2 + (pt[1] - clickLon) ** 2;
            if (d < minDist) {
              minDist = d;
              bestSeg = cand;
            }
          }
        }
      }
      if (bestSeg) onSelectSegment(bestSeg);
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
          style={{ left: hoverInfo.x + 12, top: hoverInfo.y - 48 }}
          className="absolute pointer-events-none z-30 px-3 py-2 rounded-xl bg-[#10141C]/95 backdrop-blur-md border border-cyan-500/40 text-xs font-mono shadow-2xl flex flex-col gap-1 max-w-xs animate-fade-in"
        >
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: hoverInfo.segment?.color || '#06B6D4' }}
            />
            <span className="font-bold text-white">{hoverInfo.chainageFmt}</span>
            {hoverInfo.segment && (
              <span
                className="px-1.5 py-0.2 rounded text-[10px] font-bold"
                style={{
                  backgroundColor: `${hoverInfo.segment.color}20`,
                  color: hoverInfo.segment.color,
                  border: `1px solid ${hoverInfo.segment.color}40`,
                }}
              >
                {hoverInfo.segment.statusLabel}
              </span>
            )}
          </div>
          {hoverInfo.segment && (
            <div className="text-[11px] text-slate-300 flex items-center gap-2">
              <span className="text-cyan-400 font-semibold">{hoverInfo.segment.side}</span>
              <span>•</span>
              <span className="truncate">{hoverInfo.segment.activity}</span>
              <span>•</span>
              <span className="text-slate-400">{hoverInfo.segment.lengthM}m</span>
            </div>
          )}
          <span className="text-[10px] text-slate-400">Click road section to inspect</span>
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

      {/* Floating Bottom Legend Overlay */}
      <div className="absolute bottom-4 right-4 z-20 bg-[#12161D]/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 font-mono text-[11px] text-slate-300 shadow-xl flex items-center gap-3.5 flex-wrap">
        <span className="text-slate-400 font-bold uppercase text-[10px]">Classification:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
          <span>Completed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]" />
          <span>DPS</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#D97706]" />
          <span>Under Construction</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#EC4899]" />
          <span>Himalayan</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#0284C7]" />
          <span>Remaining Scope</span>
        </div>
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

