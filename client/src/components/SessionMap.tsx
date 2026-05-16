/**
 * SessionMap — real-time geographic distribution of active user sessions.
 *
 * Renders a Google Map with one AdvancedMarkerElement per unique (lat, lng) coordinate.
 * Multiple sessions at the same location are clustered into a single pin that shows
 * the session count. Clicking a pin opens an InfoWindow with session details.
 *
 * Props:
 *   sessions — array returned by securityDashboard.getActiveSessions (must include lat/lng)
 */
import { useEffect, useRef, useCallback } from "react";
import { MapView } from "@/components/Map";

type Session = {
  id: number;
  displayName?: string | null;
  name?: string | null;
  email?: string | null;
  role: string;
  ipAddress?: string | null;
  location?: string | null;
  countryFlag?: string;
  sessionAge: number;
  mfaEnabled?: boolean | null;
  lat?: number | null;
  lng?: number | null;
};

interface SessionMapProps {
  sessions: Session[];
  className?: string;
}

/** Format session age as "Xm ago" or "Xh Ym ago" */
function fmtAge(minutes: number): string {
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`;
}

/** Build the HTML content for an InfoWindow */
function buildInfoHtml(sessions: Session[]): string {
  const rows = sessions
    .map(s => {
      const displayName = s.displayName ?? s.name ?? "Unknown";
      const email = s.email ?? "—";
      const ip = s.ipAddress ?? "—";
      const age = fmtAge(s.sessionAge);
      const mfa = s.mfaEnabled ? "✓ MFA" : "No MFA";
      const roleColor = s.role === "admin" ? "#ef4444" : "#3b82f6";
      return `
        <div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.1);font-size:12px;line-height:1.5;">
          <div style="font-weight:600;color:#f1f5f9">${displayName}</div>
          <div style="color:#94a3b8">${email}</div>
          <div style="display:flex;gap:8px;margin-top:3px;flex-wrap:wrap;">
            <span style="background:${roleColor}22;color:${roleColor};padding:1px 6px;border-radius:4px;font-size:10px;font-weight:600;text-transform:uppercase">${s.role}</span>
            <span style="color:#64748b;font-size:10px">${ip}</span>
            <span style="color:#64748b;font-size:10px">${mfa}</span>
            <span style="color:#64748b;font-size:10px">${age}</span>
          </div>
        </div>`;
    })
    .join("");

  const location = sessions[0]?.location ?? "Unknown location";
  const flag = sessions[0]?.countryFlag ?? "";

  return `
    <div style="background:#1e293b;border-radius:8px;padding:10px 12px;min-width:220px;max-width:300px;font-family:system-ui,sans-serif;">
      <div style="font-size:13px;font-weight:700;color:#e2e8f0;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
        ${flag ? `<span style="font-size:16px">${flag}</span>` : ""}
        <span>${location}</span>
        ${sessions.length > 1 ? `<span style="background:#334155;color:#94a3b8;padding:1px 6px;border-radius:10px;font-size:10px;margin-left:auto">${sessions.length} sessions</span>` : ""}
      </div>
      ${rows}
    </div>`;
}

export function SessionMap({ sessions, className }: SessionMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  /** Clear all existing markers from the map */
  const clearMarkers = useCallback(() => {
    for (const m of markersRef.current) {
      m.map = null;
    }
    markersRef.current = [];
  }, []);

  /** Place markers for all sessions that have valid lat/lng */
  const placeMarkers = useCallback((map: google.maps.Map, sessionList: Session[]) => {
    clearMarkers();

    // Close any open InfoWindow
    if (infoWindowRef.current) {
      infoWindowRef.current.close();
    }

    // Group sessions by rounded coordinate (to cluster nearby pins)
    const groups: Map<string, Session[]> = new Map();
    for (const s of sessionList) {
      if (s.lat == null || s.lng == null) continue;
      // Round to 2 decimal places (~1 km precision) for clustering
      const key = `${s.lat.toFixed(2)},${s.lng.toFixed(2)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    }

    if (groups.size === 0) return;

    // Fit map bounds to all session locations
    const bounds = new window.google.maps.LatLngBounds();

    for (const [key, groupSessions] of Array.from(groups.entries())) {
      const [latStr, lngStr] = key.split(",");
      const position = { lat: parseFloat(latStr), lng: parseFloat(lngStr) };
      bounds.extend(position);

      const count = groupSessions.length;

      // Build a custom SVG pin element
      const pinEl = document.createElement("div");
      pinEl.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        width: ${count > 1 ? "36px" : "28px"};
        height: ${count > 1 ? "36px" : "28px"};
        border-radius: 50%;
        background: ${count > 1 ? "#3b82f6" : "#22c55e"};
        border: 2.5px solid ${count > 1 ? "#1d4ed8" : "#15803d"};
        box-shadow: 0 2px 8px rgba(0,0,0,0.35);
        color: white;
        font-size: ${count > 1 ? "13px" : "11px"};
        font-weight: 700;
        font-family: system-ui, sans-serif;
        cursor: pointer;
        transition: transform 0.15s;
      `;
      pinEl.textContent = count > 1 ? String(count) : "●";
      pinEl.title = groupSessions.map(s => s.displayName ?? s.name ?? s.email ?? "User").join(", ");

      const marker = new window.google.maps.marker.AdvancedMarkerElement({
        map,
        position,
        content: pinEl,
        title: pinEl.title,
      });

      // Hover effect
      pinEl.addEventListener("mouseenter", () => {
        pinEl.style.transform = "scale(1.2)";
      });
      pinEl.addEventListener("mouseleave", () => {
        pinEl.style.transform = "scale(1)";
      });

      // Click → open InfoWindow
      marker.addListener("click", () => {
        if (!infoWindowRef.current) {
          infoWindowRef.current = new window.google.maps.InfoWindow({
            disableAutoPan: false,
          });
        }
        infoWindowRef.current.setContent(buildInfoHtml(groupSessions));
        infoWindowRef.current.open({ anchor: marker, map });
      });

      markersRef.current.push(marker);
    }

    // Fit the map to show all markers; if only one, zoom in nicely
    if (groups.size === 1) {
      const [[latStr, lngStr]] = Array.from(groups.keys()).map((k: string) => k.split(","));
      map.setCenter({ lat: parseFloat(latStr), lng: parseFloat(lngStr) });
      map.setZoom(5);
    } else {
      map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
    }
  }, [clearMarkers]);

  // When sessions change and map is ready, re-render markers
  useEffect(() => {
    if (mapRef.current) {
      placeMarkers(mapRef.current, sessions);
    }
  }, [sessions, placeMarkers]);

  const handleMapReady = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    placeMarkers(map, sessions);
  }, [sessions, placeMarkers]);

  return (
    <MapView
      className={className}
      initialCenter={{ lat: 20, lng: 0 }}
      initialZoom={2}
      onMapReady={handleMapReady}
    />
  );
}
