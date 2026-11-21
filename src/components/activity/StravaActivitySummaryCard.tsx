import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityRouteProfile,
  EnvironmentalTelemetrySnapshot,
  PollutionExposureStats,
} from '@/types/ai';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 40;
const MAP_HEIGHT = 214;

export interface StravaActivitySummaryCardProps {
  activityRoute?: ActivityRouteProfile;
  telemetry?: EnvironmentalTelemetrySnapshot;
  stats?: PollutionExposureStats;
}

export const StravaActivitySummaryCard: React.FC<
  StravaActivitySummaryCardProps
> = ({ activityRoute, telemetry, stats }) => {
  const webViewRef = useRef<WebView>(null);
  const iframeRef = useRef<any>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const animFrameRef = useRef<number | null>(null);

  const coordinates = useMemo(
    () => activityRoute?.coordinates || [],
    [activityRoute?.coordinates]
  );

  const totalDistanceKm = activityRoute?.distance_km ?? 0;
  const totalMinutes =
    activityRoute?.duration_minutes ?? stats?.total_outdoor_minutes ?? 0;
  const totalInhaledPm25 = telemetry?.inhaled_pm25_ug ?? 0;
  const feelTempC =
    telemetry?.heat_index_c !== undefined
      ? Math.round(telemetry.heat_index_c)
      : telemetry?.ambient_temp_c !== undefined
        ? Math.round(telemetry.ambient_temp_c)
        : 0;

  const exposureSeries = useMemo(
    () => activityRoute?.exposure_series || [],
    [activityRoute?.exposure_series]
  );

  const maxSeriesAqi = useMemo(
    () => (exposureSeries.length > 0 ? Math.max(...exposureSeries, 1) : 1),
    [exposureSeries]
  );

  const sendProgressToMap = useCallback(
    (t: number, replayCamera = false) => {
      if (!isMapReady) return;
      const js = `if (window.setStravaRouteProgress) { window.setStravaRouteProgress(${t.toFixed(4)}, ${replayCamera}); }`;
      if (Platform.OS === 'web') {
        try {
          iframeRef.current?.contentWindow?.eval?.(js);
        } catch {
          // ignore cross-frame eval on web
        }
        return;
      }
      webViewRef.current?.injectJavaScript(`${js};true;`);
    },
    [isMapReady]
  );

  const startFlyoverAnimation = useCallback(
    (withCameraReplay = false) => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }

      const durationMs = 2800;
      const startTime = Date.now();

      if (withCameraReplay) {
        sendProgressToMap(0, true);
      }

      const tick = () => {
        const elapsed = Date.now() - startTime;
        const rawT = Math.min(1, elapsed / durationMs);
        const easedT = 1 - Math.pow(1 - rawT, 3);
        setProgress(easedT);
        sendProgressToMap(easedT, false);

        if (rawT < 1) {
          animFrameRef.current = requestAnimationFrame(tick);
        }
      };

      animFrameRef.current = requestAnimationFrame(tick);
    },
    [sendProgressToMap]
  );

  useEffect(() => {
    if (isMapReady && coordinates.length >= 2) {
      startFlyoverAnimation(true);
    }
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isMapReady, coordinates.length, startFlyoverAnimation]);

  // Push updated route coordinates into MapLibre if route data updates dynamically
  useEffect(() => {
    if (!isMapReady || coordinates.length < 2) return;
    const payload = JSON.stringify({
      coords: coordinates.map((c) => ({
        lon: c.longitude,
        lat: c.latitude,
        aqi: c.aqi,
        label: c.label || '',
      })),
      totalKm: totalDistanceKm,
      startLabel: activityRoute?.start_label || '',
      endLabel: activityRoute?.end_label || '',
      peakLabel: activityRoute?.peak_label || '',
      peakAqi: activityRoute?.peak_aqi || 0,
    });
    const js = `if (window.loadStravaRouteData) { window.loadStravaRouteData(${payload}); }`;
    if (Platform.OS === 'web') {
      try {
        iframeRef.current?.contentWindow?.eval?.(js);
      } catch {
        // ignore
      }
    } else {
      webViewRef.current?.injectJavaScript(`${js};true;`);
    }
  }, [
    isMapReady,
    coordinates,
    totalDistanceKm,
    activityRoute?.start_label,
    activityRoute?.end_label,
    activityRoute?.peak_label,
    activityRoute?.peak_aqi,
  ]);

  const mapHtml = useMemo(() => {
    const initialPayload = JSON.stringify({
      coords: coordinates.map((c) => ({
        lon: c.longitude,
        lat: c.latitude,
        aqi: c.aqi,
        label: c.label || '',
      })),
      totalKm: totalDistanceKm,
      startLabel: activityRoute?.start_label || '',
      endLabel: activityRoute?.end_label || '',
      peakLabel: activityRoute?.peak_label || '',
      peakAqi: activityRoute?.peak_aqi || 0,
    });

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet" />
  <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    html, body, #map { width: 100%; height: 100%; overflow: hidden; background: #E2E8F0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .maplibregl-ctrl-bottom-left, .maplibregl-ctrl-bottom-right, .maplibregl-ctrl-attrib { display: none !important; }

    .puck-wrap {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      pointer-events: none;
    }
    .puck-tag {
      background: rgba(15, 23, 42, 0.92);
      border: 1.5px solid #FC4C02;
      color: #FFFFFF;
      font-size: 10px;
      font-weight: 800;
      padding: 2px 7px;
      border-radius: 999px;
      white-space: nowrap;
      margin-bottom: 5px;
      box-shadow: 0 3px 8px rgba(0,0,0,0.45);
    }
    .puck-halo {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: rgba(252, 76, 2, 0.30);
      display: flex;
      align-items: center;
      justify-content: center;
      animation: pulseStrava 1.4s ease-in-out infinite;
    }
    .puck-core {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #FC4C02;
      border: 2.2px solid #FFFFFF;
      box-shadow: 0 0 8px #FC4C02;
    }
    @keyframes pulseStrava {
      0%, 100% { transform: scale(0.92); }
      50% { transform: scale(1.22); }
    }
    .endpoint-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      border: 2px solid #FFFFFF;
      box-shadow: 0 2px 5px rgba(0,0,0,0.4);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const INITIAL_DATA = ${initialPayload};
    let routeCoords = INITIAL_DATA.coords || [];
    let totalKm = INITIAL_DATA.totalKm || 0;
    let cumDist = [];
    let totalLen = 0;
    let puckMarker = null;
    let puckTagEl = null;
    let startMarker = null;
    let endMarker = null;

    const firstPt = routeCoords[0] || { lon: 110.4203, lat: -6.9932 };

    const map = new maplibregl.Map({
      container: 'map',
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: [
              'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
          }
        },
        layers: [
          {
            id: 'osm-tiles-layer',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19
          }
        ]
      },
      center: [firstPt.lon, firstPt.lat],
      zoom: 14.5,
      pitch: 42,
      bearing: -12,
      attributionControl: false
    });

    function recomputeLengths() {
      cumDist = [0];
      totalLen = 0;
      for (let i = 0; i < routeCoords.length - 1; i++) {
        const dx = routeCoords[i + 1].lon - routeCoords[i].lon;
        const dy = routeCoords[i + 1].lat - routeCoords[i].lat;
        const d = Math.hypot(dx, dy);
        totalLen += d;
        cumDist.push(totalLen);
      }
    }

    function fitRouteCamera(animate) {
      if (!routeCoords || routeCoords.length < 2) return;
      const bounds = new maplibregl.LngLatBounds();
      routeCoords.forEach(p => bounds.extend([p.lon, p.lat]));
      map.fitBounds(bounds, {
        padding: { top: 46, bottom: 42, left: 36, right: 36 },
        pitch: 46,
        bearing: -16,
        maxZoom: 16.2,
        duration: animate ? 900 : 0
      });
    }

    function sliceAt(t) {
      if (!routeCoords || routeCoords.length === 0) return { line: [], head: firstPt };
      if (routeCoords.length === 1 || t <= 0 || totalLen <= 0) {
        return { line: [[routeCoords[0].lon, routeCoords[0].lat]], head: routeCoords[0] };
      }
      const target = Math.min(1, Math.max(0, t)) * totalLen;
      const line = [[routeCoords[0].lon, routeCoords[0].lat]];
      let head = routeCoords[0];

      for (let i = 0; i < routeCoords.length - 1; i++) {
        const segStart = cumDist[i];
        const segEnd = cumDist[i + 1];
        const segLen = segEnd - segStart;

        if (target >= segEnd) {
          line.push([routeCoords[i + 1].lon, routeCoords[i + 1].lat]);
          head = routeCoords[i + 1];
        } else {
          const frac = segLen > 0 ? (target - segStart) / segLen : 0;
          const lon = routeCoords[i].lon + (routeCoords[i + 1].lon - routeCoords[i].lon) * frac;
          const lat = routeCoords[i].lat + (routeCoords[i + 1].lat - routeCoords[i].lat) * frac;
          const aqi = Math.round(routeCoords[i].aqi + (routeCoords[i + 1].aqi - routeCoords[i].aqi) * frac);
          line.push([lon, lat]);
          head = { lon, lat, aqi };
          break;
        }
      }
      return { line, head };
    }

    window.loadStravaRouteData = function(payload) {
      if (!payload || !Array.isArray(payload.coords) || payload.coords.length < 2) return;
      routeCoords = payload.coords;
      totalKm = payload.totalKm || 0;
      recomputeLengths();

      const fullLine = routeCoords.map(c => [c.lon, c.lat]);
      const ghostSrc = map.getSource('route-ghost-src');
      if (ghostSrc) {
        ghostSrc.setData({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: fullLine }
        });
      }

      if (startMarker) startMarker.setLngLat([routeCoords[0].lon, routeCoords[0].lat]);
      if (endMarker) {
        const last = routeCoords[routeCoords.length - 1];
        endMarker.setLngLat([last.lon, last.lat]);
      }

      fitRouteCamera(false);
    };

    window.setStravaRouteProgress = function(t, replayCamera) {
      if (!map.loaded() && !map.getSource('route-active-src')) return;
      const { line, head } = sliceAt(t);

      const activeSrc = map.getSource('route-active-src');
      if (activeSrc && line.length >= 2) {
        activeSrc.setData({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: line }
        });
      }

      if (puckMarker && head) {
        puckMarker.setLngLat([head.lon, head.lat]);
        if (puckTagEl) {
          const curKm = (totalKm * t).toFixed(2);
          puckTagEl.textContent = curKm + ' km • AQI ' + (head.aqi || '');
        }
      }

      if (replayCamera) {
        fitRouteCamera(true);
      }
    };

    map.on('load', () => {
      recomputeLengths();
      const fullLine = routeCoords.length >= 2
        ? routeCoords.map(c => [c.lon, c.lat])
        : [[firstPt.lon, firstPt.lat], [firstPt.lon + 0.001, firstPt.lat + 0.001]];

      map.addSource('route-ghost-src', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: fullLine }
        }
      });

      map.addSource('route-active-src', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [fullLine[0], fullLine[0]] }
        }
      });

      map.addLayer({
        id: 'route-ghost-layer',
        type: 'line',
        source: 'route-ghost-src',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#475569',
          'line-width': 4,
          'line-opacity': 0.55,
          'line-dasharray': [2, 2]
        }
      });

      map.addLayer({
        id: 'route-casing-layer',
        type: 'line',
        source: 'route-active-src',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#FFFFFF',
          'line-width': 8.5,
          'line-opacity': 0.95
        }
      });

      map.addLayer({
        id: 'route-glow-layer',
        type: 'line',
        source: 'route-active-src',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#FC4C02',
          'line-width': 14,
          'line-opacity': 0.28,
          'line-blur': 4
        }
      });

      map.addLayer({
        id: 'route-core-layer',
        type: 'line',
        source: 'route-active-src',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#FC4C02',
          'line-width': 5,
          'line-opacity': 1
        }
      });

      // Start marker
      const startEl = document.createElement('div');
      startEl.className = 'endpoint-dot';
      startEl.style.background = '#10B981';
      startMarker = new maplibregl.Marker({ element: startEl })
        .setLngLat(fullLine[0])
        .addTo(map);

      // End marker
      const endEl = document.createElement('div');
      endEl.className = 'endpoint-dot';
      endEl.style.background = '#FC4C02';
      endMarker = new maplibregl.Marker({ element: endEl })
        .setLngLat(fullLine[fullLine.length - 1])
        .addTo(map);

      // Moving Puck marker
      const wrap = document.createElement('div');
      wrap.className = 'puck-wrap';
      puckTagEl = document.createElement('div');
      puckTagEl.className = 'puck-tag';
      puckTagEl.textContent = '0.00 km';
      const halo = document.createElement('div');
      halo.className = 'puck-halo';
      const core = document.createElement('div');
      core.className = 'puck-core';
      halo.appendChild(core);
      wrap.appendChild(puckTagEl);
      wrap.appendChild(halo);

      puckMarker = new maplibregl.Marker({ element: wrap, anchor: 'bottom' })
        .setLngLat(fullLine[0])
        .addTo(map);

      fitRouteCamera(false);

      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage('MAP_READY');
      }
    });
  </script>
</body>
</html>`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedDistance = (totalDistanceKm * progress).toFixed(2);
  const animatedMinutes = Math.max(0, Math.round(totalMinutes * progress));
  const animatedPm25 = (totalInhaledPm25 * progress).toFixed(1);

  const routeTitle =
    activityRoute?.start_label &&
    activityRoute?.end_label &&
    activityRoute.start_label !== activityRoute.end_label
      ? `${activityRoute.start_label} → ${activityRoute.end_label}`
      : activityRoute?.peak_label || stats?.worst_area_name || '';

  if (!activityRoute || !activityRoute.coordinates || activityRoute.coordinates.length < 2) {
    return null;
  }

  return (
    <View style={styles.cardWrapper}>
      {/* ─── REAL MAPLIBRE GL 3D FLYOVER MAP CANVAS ───────────────────────── */}
      <View style={styles.mapCanvasContainer}>
        {Platform.OS === 'web' ? (
          <iframe
            ref={iframeRef}
            title="Strava Activity Map"
            srcDoc={mapHtml}
            onLoad={() => setIsMapReady(true)}
            style={{ width: '100%', height: '100%', border: 'none' } as any}
          />
        ) : (
          <WebView
            ref={webViewRef}
            originWhitelist={['*']}
            source={{ html: mapHtml, baseUrl: 'https://aura.health.app' }}
            style={styles.webView}
            scrollEnabled={false}
            bounces={false}
            javaScriptEnabled
            domStorageEnabled
            mixedContentMode="always"
            userAgent="Mozilla/5.0 (Linux; Android 14; AURA-Health) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
            onMessage={(e) => {
              if (e.nativeEvent.data === 'MAP_READY') {
                setIsMapReady(true);
              }
            }}
          />
        )}

        {/* Top Overlay Bar: Real Route Name + Replay Button */}
        <View style={styles.topOverlayBar} pointerEvents="box-none">
          <View style={styles.stravaBrandPill}>
            <View style={styles.stravaOrangeDot}>
              <Ionicons name="navigate" size={10} color="#FFFFFF" />
            </View>
            <Text numberOfLines={1} style={styles.stravaBrandText}>
              {routeTitle}
            </Text>
          </View>

          <Pressable
            onPress={() => startFlyoverAnimation(true)}
            style={styles.replayBtn}
            hitSlop={8}
          >
            <Ionicons name="play" size={11} color="#FFFFFF" />
            <Text style={styles.replayBtnText}>Putar</Text>
          </Pressable>
        </View>

        {/* Bottom Dynamic Exposure Sparkline (Computed 100% from Route Coordinates) */}
        {exposureSeries.length > 0 && (
          <View style={styles.sparklineRow} pointerEvents="none">
            {exposureSeries.map((aqiVal, idx) => {
              const barRatio = idx / Math.max(1, exposureSeries.length - 1);
              const isFilled = barRatio <= progress;
              const heightPct = Math.max(0.22, Math.min(1, aqiVal / maxSeriesAqi));
              const barColor =
                aqiVal >= 120 ? '#FC4C02' : aqiVal >= 85 ? '#F59E0B' : '#10B981';

              return (
                <View
                  key={idx}
                  style={[
                    styles.sparkBar,
                    {
                      height: Math.round(heightPct * 22) + 3,
                      backgroundColor: isFilled
                        ? barColor
                        : 'rgba(148, 163, 184, 0.25)',
                    },
                  ]}
                />
              );
            })}
          </View>
        )}
      </View>

      {/* ─── STRAVA 4-COLUMN DYNAMIC STATS BAR ────────────────────────────── */}
      <LinearGradient
        colors={['#111827', '#1E293B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.statsFooter}
      >
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>JARAK</Text>
          <View style={styles.statValueRow}>
            <Text style={styles.statBigNumber}>{animatedDistance}</Text>
            <Text style={styles.statUnit}>km</Text>
          </View>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statCol}>
          <Text style={styles.statLabel}>DURASI</Text>
          <View style={styles.statValueRow}>
            <Text style={styles.statBigNumber}>{animatedMinutes}</Text>
            <Text style={styles.statUnit}>mnt</Text>
          </View>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statCol}>
          <Text style={styles.statLabel}>DEBU HIRUP</Text>
          <View style={styles.statValueRow}>
            <Text style={[styles.statBigNumber, { color: '#FB923C' }]}>
              {animatedPm25}
            </Text>
            <Text style={styles.statUnit}>µg</Text>
          </View>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statCol}>
          <Text style={styles.statLabel}>SUHU TERASA</Text>
          <View style={styles.statValueRow}>
            <Text style={[styles.statBigNumber, { color: '#38BDF8' }]}>
              {feelTempC}°
            </Text>
            <Text style={styles.statUnit}>C</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  cardWrapper: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 5,
  },
  mapCanvasContainer: {
    width: CARD_WIDTH,
    height: MAP_HEIGHT,
    position: 'relative',
    backgroundColor: '#0B1120',
  },
  webView: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  topOverlayBar: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stravaBrandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.84)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    maxWidth: CARD_WIDTH * 0.72,
  },
  stravaOrangeDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FC4C02',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  stravaBrandText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  replayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FC4C02',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  replayBtnText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  sparklineRow: {
    position: 'absolute',
    bottom: 6,
    left: 14,
    right: 14,
    height: 25,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 3,
  },
  sparkBar: {
    flex: 1,
    borderRadius: 2,
  },
  statsFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  statBigNumber: {
    fontSize: 16.5,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  statUnit: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
});
