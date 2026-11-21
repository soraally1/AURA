import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

export interface OsmLatLng {
  latitude: number;
  longitude: number;
}

export interface OsmPolylineItem {
  id: string;
  coordinates: OsmLatLng[];
  color?: string;
  width?: number;
  opacity?: number;
}

export interface OsmMarkerItem {
  id: string;
  latitude: number;
  longitude: number;
  title?: string;
  color?: string;
  badgeText?: string;
  variant?: 'pin' | 'alert' | 'replay';
}

export interface OsmCircleItem {
  id: string;
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  color?: string;
  strokeColor?: string;
}

export interface OsmMapViewHandle {
  flyTo: (latitude: number, longitude: number, zoom?: number) => void;
  fitBounds: (coords: OsmLatLng[], paddingPx?: number) => void;
}

interface OsmMapViewProps {
  style?: StyleProp<ViewStyle>;
  initialCenter?: OsmLatLng;
  initialZoom?: number;
  userLocation?: OsmLatLng | null;
  followUserLocation?: boolean;
  polylines?: OsmPolylineItem[];
  markers?: OsmMarkerItem[];
  circles?: OsmCircleItem[];
  onMarkerPress?: (markerId: string) => void;
  onMapReady?: () => void;
}

export const OsmMapView = forwardRef<OsmMapViewHandle, OsmMapViewProps>(
  function OsmMapView(
    {
      style,
      initialCenter = { latitude: -6.9932, longitude: 110.4203 },
      initialZoom = 13.5,
      userLocation,
      followUserLocation = false,
      polylines = [],
      markers = [],
      circles = [],
      onMarkerPress,
      onMapReady,
    },
    ref
  ) {
    const webViewRef = useRef<WebView>(null);
    const iframeRef = useRef<any>(null);
    const [isReady, setIsReady] = useState(false);

    const runScript = (js: string) => {
      if (!isReady) return;
      if (Platform.OS === 'web') {
        try {
          iframeRef.current?.contentWindow?.eval?.(js);
        } catch {
          // ignore cross-context web eval errors
        }
        return;
      }
      webViewRef.current?.injectJavaScript(`${js};true;`);
    };

    useImperativeHandle(
      ref,
      () => ({
        flyTo(latitude: number, longitude: number, zoom = 15) {
          runScript(
            `if (window.osmFlyTo) window.osmFlyTo(${longitude}, ${latitude}, ${zoom});`
          );
        },
        fitBounds(coords: OsmLatLng[], paddingPx = 60) {
          if (!coords || coords.length === 0) return;
          const payload = JSON.stringify(
            coords.map((c) => [c.longitude, c.latitude])
          );
          runScript(
            `if (window.osmFitBounds) window.osmFitBounds(${payload}, ${paddingPx});`
          );
        },
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [isReady]
    );

    const mapHtml = useMemo(() => {
      const initCenterLon = initialCenter.longitude;
      const initCenterLat = initialCenter.latitude;
      const initZ = initialZoom;

      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet" />
  <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    html, body, #map {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #E2E8F0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .maplibregl-ctrl-bottom-left, .maplibregl-ctrl-bottom-right, .maplibregl-ctrl-attrib {
      display: none !important;
    }
    .user-radar {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      pointer-events: none;
    }
    .user-radar-ring {
      position: absolute;
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: rgba(30, 108, 239, 0.24);
      animation: pulseRing 2s infinite ease-out;
    }
    @keyframes pulseRing {
      0% { transform: scale(0.5); opacity: 0.9; }
      100% { transform: scale(1.45); opacity: 0; }
    }
    .user-radar-dot {
      width: 15px;
      height: 15px;
      border-radius: 50%;
      background: #1E6CEF;
      border: 3px solid #FFFFFF;
      box-shadow: 0 2px 6px rgba(30, 108, 239, 0.6);
      z-index: 2;
    }
    .pin-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
    }
    .pin-badge {
      background: #1E6CEF;
      color: #FFFFFF;
      font-size: 10px;
      font-weight: 800;
      padding: 2px 7px;
      border-radius: 8px;
      margin-bottom: 3px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      white-space: nowrap;
    }
    .pin-dot {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: 3px solid #FFFFFF;
      box-shadow: 0 2px 8px rgba(0,0,0,0.32);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #FFFFFF;
      font-size: 11px;
      font-weight: 900;
    }
    .pin-label {
      margin-top: 3px;
      background: rgba(255,255,255,0.95);
      color: #0F172A;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 999px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.16);
      white-space: nowrap;
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var mapReady = false;
    var pendingActions = [];
    var userMarker = null;
    var activeMarkers = [];

    var map = new maplibregl.Map({
      container: 'map',
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap'
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
      center: [${initCenterLon}, ${initCenterLat}],
      zoom: ${initZ},
      attributionControl: false
    });

    function postToRN(msg) {
      var str = JSON.stringify(msg);
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(str);
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage(str, '*');
      }
    }

    map.on('load', function() {
      map.addSource('lines-src', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      map.addLayer({
        id: 'lines-layer-casing',
        type: 'line',
        source: 'lines-src',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#FFFFFF',
          'line-width': ['+', ['get', 'width'], 3],
          'line-opacity': 0.85
        }
      });
      map.addLayer({
        id: 'lines-layer',
        type: 'line',
        source: 'lines-src',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['get', 'width'],
          'line-opacity': ['get', 'opacity']
        }
      });

      map.addSource('circles-src', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      map.addLayer({
        id: 'circles-layer',
        type: 'circle',
        source: 'circles-src',
        paint: {
          'circle-radius': 5,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': ['get', 'strokeColor'],
          'circle-opacity': 0.78
        }
      });

      mapReady = true;
      for (var i = 0; i < pendingActions.length; i++) {
        pendingActions[i]();
      }
      pendingActions = [];
      postToRN({ type: 'MAP_READY' });
    });

    function withMap(fn) {
      if (mapReady) fn();
      else pendingActions.push(fn);
    }

    window.osmSetUserLocation = function(lon, lat, shouldFly) {
      withMap(function() {
        if (!userMarker) {
          var el = document.createElement('div');
          el.className = 'user-radar';
          el.innerHTML = '<div class="user-radar-ring"></div><div class="user-radar-dot"></div>';
          userMarker = new maplibregl.Marker({ element: el }).setLngLat([lon, lat]).addTo(map);
        } else {
          userMarker.setLngLat([lon, lat]);
        }
        if (shouldFly) {
          map.easeTo({ center: [lon, lat], duration: 400 });
        }
      });
    };

    window.osmSetPolylines = function(items) {
      withMap(function() {
        var features = (items || [])
          .filter(function(p) { return p.coords && p.coords.length > 1; })
          .map(function(p) {
            return {
              type: 'Feature',
              properties: {
                color: p.color || '#1E6CEF',
                width: p.width || 5,
                opacity: p.opacity != null ? p.opacity : 0.95
              },
              geometry: {
                type: 'LineString',
                coordinates: p.coords
              }
            };
          });
        map.getSource('lines-src').setData({
          type: 'FeatureCollection',
          features: features
        });
      });
    };

    window.osmSetCircles = function(items) {
      withMap(function() {
        var features = (items || []).map(function(c) {
          return {
            type: 'Feature',
            properties: {
              color: c.color || '#10B981',
              strokeColor: c.strokeColor || '#FFFFFF'
            },
            geometry: {
              type: 'Point',
              coordinates: [c.lon, c.lat]
            }
          };
        });
        map.getSource('circles-src').setData({
          type: 'FeatureCollection',
          features: features
        });
      });
    };

    window.osmSetMarkers = function(items) {
      withMap(function() {
        for (var i = 0; i < activeMarkers.length; i++) {
          activeMarkers[i].remove();
        }
        activeMarkers = [];
        (items || []).forEach(function(m) {
          var el = document.createElement('div');
          el.className = 'pin-wrap';
          var html = '';
          if (m.badgeText) {
            html += '<div class="pin-badge">' + m.badgeText + '</div>';
          }
          var bg = m.color || '#EF4444';
          var sym = m.variant === 'alert' ? '!' : m.variant === 'pin' ? '★' : '';
          html += '<div class="pin-dot" style="background:' + bg + '">' + sym + '</div>';
          if (m.title && m.variant !== 'replay') {
            html += '<div class="pin-label">' + m.title + '</div>';
          }
          el.innerHTML = html;
          el.addEventListener('click', function(ev) {
            ev.stopPropagation();
            postToRN({ type: 'MARKER_PRESS', id: m.id });
          });
          var mk = new maplibregl.Marker({ element: el })
            .setLngLat([m.lon, m.lat])
            .addTo(map);
          activeMarkers.push(mk);
        });
      });
    };

    window.osmFlyTo = function(lon, lat, zoom) {
      withMap(function() {
        map.flyTo({ center: [lon, lat], zoom: zoom || 15, duration: 500 });
      });
    };

    window.osmFitBounds = function(coords, paddingPx) {
      withMap(function() {
        if (!coords || coords.length === 0) return;
        if (coords.length === 1) {
          map.flyTo({ center: coords[0], zoom: 15, duration: 500 });
          return;
        }
        var bounds = coords.reduce(function(b, c) {
          return b.extend(c);
        }, new maplibregl.LngLatBounds(coords[0], coords[0]));
        map.fitBounds(bounds, { padding: paddingPx || 60, duration: 600, maxZoom: 16 });
      });
    };
  </script>
</body>
</html>`;
      // Intentionally construct template once so WebView never reloads on data updates
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sync User Location
    useEffect(() => {
      if (!userLocation) return;
      runScript(
        `if (window.osmSetUserLocation) window.osmSetUserLocation(${userLocation.longitude}, ${userLocation.latitude}, ${followUserLocation ? 'true' : 'false'});`
      );
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userLocation?.latitude, userLocation?.longitude, followUserLocation, isReady]);

    // Sync Polylines
    useEffect(() => {
      const payload = JSON.stringify(
        polylines.map((p) => ({
          id: p.id,
          color: p.color,
          width: p.width,
          opacity: p.opacity,
          coords: p.coordinates.map((c) => [c.longitude, c.latitude]),
        }))
      );
      runScript(
        `if (window.osmSetPolylines) window.osmSetPolylines(${payload});`
      );
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [polylines, isReady]);

    // Sync Circles
    useEffect(() => {
      const payload = JSON.stringify(
        circles.map((c) => ({
          id: c.id,
          lat: c.latitude,
          lon: c.longitude,
          color: c.color,
          strokeColor: c.strokeColor,
        }))
      );
      runScript(`if (window.osmSetCircles) window.osmSetCircles(${payload});`);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [circles, isReady]);

    // Sync Markers
    useEffect(() => {
      const payload = JSON.stringify(
        markers.map((m) => ({
          id: m.id,
          lat: m.latitude,
          lon: m.longitude,
          title: m.title,
          color: m.color,
          badgeText: m.badgeText,
          variant: m.variant,
        }))
      );
      runScript(`if (window.osmSetMarkers) window.osmSetMarkers(${payload});`);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [markers, isReady]);

    const handleMessage = (event: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        if (msg.type === 'MAP_READY') {
          setIsReady(true);
          onMapReady?.();
        } else if (msg.type === 'MARKER_PRESS' && msg.id) {
          onMarkerPress?.(msg.id);
        }
      } catch {
        // ignore malformed WebView messages
      }
    };

    if (Platform.OS === 'web') {
      return (
        <View style={[styles.container, style]}>
          <iframe
            ref={iframeRef}
            srcDoc={mapHtml}
            onLoad={() => {
              setIsReady(true);
              onMapReady?.();
            }}
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        </View>
      );
    }

    return (
      <View style={[styles.container, style]}>
        <WebView
          ref={webViewRef}
          source={{ html: mapHtml, baseUrl: 'https://aura.health.app' }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
          mixedContentMode="always"
          onMessage={handleMessage}
          scrollEnabled={false}
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: '#E2E8F0',
  },
});
