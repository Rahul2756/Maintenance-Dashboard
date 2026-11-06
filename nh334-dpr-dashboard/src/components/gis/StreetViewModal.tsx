import React, { useEffect, useRef, useState } from 'react';
import { X, ExternalLink, AlertCircle, Loader2, Compass, MapPin } from 'lucide-react';
import { StreetViewLocation } from '../../types/gis';

interface StreetViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  location: StreetViewLocation | null;
}

export const StreetViewModal: React.FC<StreetViewModalProps> = ({
  isOpen,
  onClose,
  location
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [status, setStatus] = useState<'available' | 'unavailable' | 'no_key' | 'loading'>('loading');
  const [apiKeyAvailable, setApiKeyAvailable] = useState<boolean>(false);

  const googleApiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || '';

  useEffect(() => {
    if (!isOpen || !location) return;

    setLoading(true);
    setStatus('loading');

    const googleMapsLoaded = typeof window !== 'undefined' && (window as any).google?.maps;

    // Direct Google Maps street view URL
    const { lat, lon } = location;

    if (!googleApiKey && !googleMapsLoaded) {
      setApiKeyAvailable(false);
      setStatus('no_key');
      setLoading(false);
      return;
    }

    setApiKeyAvailable(true);

    // If Google Maps is loaded or script exists, check StreetViewService
    if ((window as any).google?.maps) {
      checkPanorama(lat, lon);
    } else {
      // Load Google Maps script dynamically if key is provided
      const scriptId = 'google-maps-streetview-script';
      let script = document.getElementById(scriptId) as HTMLScriptElement;
      if (!script) {
        script = document.createElement('script');
        script.id = scriptId;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${googleApiKey}&libraries=places`;
        script.async = true;
        script.onload = () => {
          checkPanorama(lat, lon);
        };
        script.onerror = () => {
          setStatus('unavailable');
          setLoading(false);
        };
        document.head.appendChild(script);
      } else {
        const interval = setInterval(() => {
          if ((window as any).google?.maps) {
            clearInterval(interval);
            checkPanorama(lat, lon);
          }
        }, 100);
      }
    }
  }, [isOpen, location, googleApiKey]);

  const checkPanorama = (lat: number, lon: number) => {
    try {
      const google = (window as any).google;
      const svService = new google.maps.StreetViewService();
      const pos = new google.maps.LatLng(lat, lon);

      svService.getPanorama({ location: pos, radius: 250 }, (data: any, statusResult: any) => {
        if (statusResult === google.maps.StreetViewStatus.OK && data && data.location) {
          setStatus('available');
          setLoading(false);
          if (containerRef.current) {
            new google.maps.StreetViewPanorama(containerRef.current, {
              position: data.location.latLng,
              pov: { heading: location?.heading || 0, pitch: location?.pitch || 0 },
              zoom: 1,
              addressControl: true,
              fullscreenControl: true
            });
          }
        } else {
          setStatus('unavailable');
          setLoading(false);
        }
      });
    } catch (e) {
      console.warn('Street View check failed:', e);
      setStatus('unavailable');
      setLoading(false);
    }
  };

  if (!isOpen || !location) return null;

  const directGoogleMapsUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${location.lat.toFixed(6)},${location.lon.toFixed(6)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl h-[75vh] max-h-[700px] bg-[#14171C] border border-cyan-500/40 rounded-2xl shadow-2xl flex flex-col overflow-hidden font-sans">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#111317] border-b border-white/10 select-none">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs uppercase font-mono tracking-wider text-amber-400 font-bold">
                Google Maps Street View Experience
              </div>
              <div className="text-base font-bold font-mono text-white flex items-center gap-3">
                <span>{location.chainageFmt}</span>
                <span className="text-xs font-normal text-slate-400 font-mono">
                  (Lat: {location.lat.toFixed(6)}°, Lon: {location.lon.toFixed(6)}°)
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={directGoogleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-mono text-xs font-semibold transition-all"
              title="Open location directly in official Google Maps"
            >
              <span>Open in Google Maps</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Viewport */}
        <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center">
          {/* Active Street View Container */}
          <div
            ref={containerRef}
            className={`w-full h-full ${status === 'available' ? 'block' : 'hidden'}`}
          />

          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 text-slate-300 font-mono text-sm">
              <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
              <span>Querying Google Street View panorama at {location.chainageFmt}...</span>
            </div>
          )}

          {/* Unavailable State */}
          {!loading && status === 'unavailable' && (
            <div className="p-8 max-w-md text-center space-y-4 font-mono text-slate-300">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 mx-auto flex items-center justify-center text-amber-400">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Street View Imagery Unavailable at this Location</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Google Street View ground-level 360° coverage is not indexed at this exact chainage ({location.chainageFmt}). You can open Google Maps directly to inspect surrounding coverage or view satellite imagery.
              </p>
              <div className="pt-2">
                <a
                  href={directGoogleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-amber-500/20"
                >
                  <span>Launch Google Maps at {location.chainageFmt}</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          )}

          {/* No API Key State */}
          {!loading && status === 'no_key' && (
            <div className="p-8 max-w-lg text-center space-y-4 font-mono text-slate-300">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 mx-auto flex items-center justify-center text-cyan-400">
                <MapPin className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Google Maps Integration Ready</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                To embed interactive 360° panoramas directly inside the dashboard, configure <code className="text-cyan-300 bg-white/5 px-1.5 py-0.5 rounded">VITE_GOOGLE_MAPS_API_KEY</code> in your environment.
              </p>
              <p className="text-xs text-slate-400">
                You can still inspect the real Google Street View imagery directly with one click:
              </p>
              <div className="pt-2 flex justify-center gap-3">
                <a
                  href={directGoogleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-cyan-500/20"
                >
                  <span>Open Street View in Google Maps</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer info strip */}
        <div className="px-6 py-2.5 bg-[#0B0C0E] border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-slate-400">
          <div>
            Corridor: <span className="text-white">NH-334 Muzaffarnagar – Haridwar</span>
          </div>
          <div>
            Target: <span className="text-cyan-400">{location.chainageFmt}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

