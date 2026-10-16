import React, { useMemo } from 'react';
import { View, Text, Pressable, Dimensions, StyleSheet, ActivityIndicator, Platform, StatusBar } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NearbyZoneResult, ImpactLevel } from '@/types/zones';

export interface UserLocationProp {
  lat: number;
  lon: number;
  name?: string;
  isRealtime?: boolean;
}

interface SemarangMapCardProps {
  onSearchPress?: () => void;
  onMapPress?: () => void;
  onBannerPress?: () => void;
  onProfilePress?: () => void;
  userLocation?: UserLocationProp;
  nearbyZones?: NearbyZoneResult[];
  isLoading?: boolean;
  userName?: string;
  outdoorMinutes?: number;
  waktuDiJalan?: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Cartoon Cloud SVG Component (Matches User Mockup) ───────────────────────
function CartoonCloud({ width = 52, height = 30 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 52 30" fill="none">
      <Path
        d="M13 30C5.82 30 0 24.18 0 17C0 10.37 4.96 4.9 11.43 4.1C13.41 1.62 16.44 0 19.8 0C25.07 0 29.47 3.75 30.45 8.85C31.75 8.3 33.18 8 34.7 8C39.67 8 43.7 12.03 43.7 17C43.7 17.38 43.68 17.75 43.62 18.11C46.68 19.26 48.88 22.25 48.88 25.75C48.88 29.75 45.63 30 42 30H13Z"
        fill="#FFFFFF"
      />
    </Svg>
  );
}

function getMarkerColor(level: ImpactLevel): string {
  switch (level) {
    case 'Aman':
      return '#10B981';
    case 'Waspada':
      return '#F59E0B';
    case 'Berbahaya':
      return '#EF4444';
    default:
      return '#1E6CEF';
  }
}

function getMarkerGlow(level: ImpactLevel): string {
  switch (level) {
    case 'Aman':
      return 'rgba(16, 185, 129, 0.35)';
    case 'Waspada':
      return 'rgba(245, 158, 11, 0.35)';
    case 'Berbahaya':
      return 'rgba(239, 68, 68, 0.35)';
    default:
      return 'rgba(30, 108, 239, 0.35)';
  }
}

export const SemarangMapCard: React.FC<SemarangMapCardProps> = ({
  onSearchPress,
  onMapPress,
  onBannerPress,
  onProfilePress,
  userLocation,
  nearbyZones = [],
  isLoading = false,
  userName = 'FREYA JAWANTARA',
  outdoorMinutes,
  waktuDiJalan = 2,
}) => {
  const insets = useSafeAreaInsets();
  const handleOpenMap = onMapPress || onSearchPress;

  const lat = userLocation?.lat ?? -6.9932;
  const lon = userLocation?.lon ?? 110.4203;

  const topBarTop = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 14) + 6;
  const cardHeight = 356 + (insets.top > 0 ? insets.top : 16);

  // MapLibre GL 3D GIS HTML Template with custom markers matching Semarang street geometry
  const mapHtml = useMemo(() => {
    const zonesData = (nearbyZones.length > 0 ? nearbyZones : []).map((nz) => ({
      lat: nz.zone.latitude,
      lon: nz.zone.longitude,
      color: getMarkerColor(nz.impact_level),
      glow: getMarkerGlow(nz.impact_level),
      name: nz.zone.name,
      level: nz.impact_level,
    }));

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet" />
  <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    body, html, #map { width: 100%; height: 100%; overflow: hidden; background: #E2E8F0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .maplibregl-ctrl-bottom-left, .maplibregl-ctrl-bottom-right, .maplibregl-ctrl-attrib { display: none !important; }

    /* Custom Red Location Pin */
    .custom-red-pin {
      width: 28px;
      height: 36px;
      position: relative;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      transition: transform 0.2s ease;
    }
    .custom-red-pin:hover {
      transform: scale(1.15);
    }
    .pin-head {
      width: 24px;
      height: 24px;
      background: #EF4444;
      border: 2px solid #FFFFFF;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 3px 6px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .pin-inner-circle {
      width: 8px;
      height: 8px;
      background: #FFFFFF;
      border-radius: 50%;
    }
    .pin-label {
      position: absolute;
      top: 28px;
      background: rgba(15, 23, 42, 0.85);
      color: #FFFFFF;
      font-size: 8px;
      font-weight: 700;
      padding: 2px 5px;
      border-radius: 4px;
      white-space: nowrap;
      pointer-events: none;
      box-shadow: 0 1px 3px rgba(0,0,0,0.25);
    }

    /* User Realtime Radar Pulse */
    .user-radar-container {
      width: 44px;
      height: 44px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .user-radar-wave {
      position: absolute;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: rgba(30, 108, 239, 0.28);
      animation: radarPing 2.2s cubic-bezier(0, 0, 0.2, 1) infinite;
    }
    .user-radar-core {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #1E6CEF;
      border: 2.5px solid #FFFFFF;
      box-shadow: 0 2px 6px rgba(30, 108, 239, 0.5);
      z-index: 2;
    }

    @keyframes radarPing {
      0% { transform: scale(0.4); opacity: 0.9; }
      75%, 100% { transform: scale(1.4); opacity: 0; }
    }
  </style>
</head>
<body>
  <div id="map"></div>

  <script>
    var lat = ${lat};
    var lon = ${lon};
    var zones = ${JSON.stringify(zonesData)};

    var map = new maplibregl.Map({
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
      center: [lon, lat],
      zoom: 13.4,
      pitch: 28,
      bearing: -5,
      interactive: false,
      attributionControl: false
    });

    map.on('load', function() {
      // 1. User Position Pulsing Radar
      var userEl = document.createElement('div');
      userEl.className = 'user-radar-container';
      userEl.innerHTML = '<div class="user-radar-wave"></div><div class="user-radar-core"></div>';
      new maplibregl.Marker({ element: userEl })
        .setLngLat([lon, lat])
        .addTo(map);

      // 2. Semarang Iconic Landmarks (Sam Poo Kong, Stadion Jatidiri, Djomblang)
      var landmarks = [
        { name: 'SAM POO KONG', lon: 110.3985, lat: -6.9965 },
        { name: 'Masjid Agung Jawa Tengah (MAJT)', lon: 110.4455, lat: -6.9839 },
        { name: 'Stadion Jatidiri', lon: 110.4074, lat: -7.0210 },
        { name: 'PERUM SINGATARA', lon: 110.4475, lat: -7.0095 },
        { name: 'Simpang Lima', lon: 110.4227, lat: -6.9904 }
      ];

      landmarks.forEach(function(lm) {
        var el = document.createElement('div');
        el.className = 'custom-red-pin';
        el.innerHTML = '<div class="pin-head"><div class="pin-inner-circle"></div></div><div class="pin-label">' + lm.name + '</div>';
        new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([lm.lon, lm.lat])
          .addTo(map);
      });
    });
  </script>
</body>
</html>
    `;
  }, [lat, lon, nearbyZones]);

  // Perhitungan Durasi di Luar Ruangan Riil (Hanya dari data aktual pelacakan)
  const { displayValue, displayUnit } = useMemo(() => {
    const mins = typeof outdoorMinutes === 'number' ? outdoorMinutes : 0;

    if (mins >= 60) {
      const hours = mins / 60;
      const val = Number(hours.toFixed(1)).toString().replace(/\.0$/, '');
      return { displayValue: val, displayUnit: 'jam' };
    }

    if (mins > 0) {
      return { displayValue: Math.round(mins).toString(), displayUnit: 'menit' };
    }

    return { displayValue: '0', displayUnit: 'menit' };
  }, [outdoorMinutes]);

  return (
    <View style={[styles.container, { height: cardHeight }]}>
      {/* 1. 3D GIS MAP VIEW EMBED */}
      <WebView
        originWhitelist={['*']}
        source={{ html: mapHtml }}
        style={styles.webView}
        scrollEnabled={false}
        overScrollMode="never"
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scalesPageToFit={false}
        pointerEvents="none"
      />

      {/* 2. TOP FLOATING SEARCH BAR: "Temukan lokasi anda..." */}
      <View style={[styles.topSearchBarOverlay, { top: topBarTop }]}>
        <Pressable
          style={styles.searchBarBox}
          onPress={handleOpenMap}
          accessibilityRole="button"
          accessibilityLabel="Temukan lokasi anda"
        >
          <Ionicons name="search" size={21} color="#2563EB" style={{ marginRight: 10 }} />
          <Text style={styles.searchPlaceholderText}>Temukan lokasi anda...</Text>
          {isLoading && (
            <ActivityIndicator size="small" color="#2563EB" style={{ marginLeft: 'auto' }} />
          )}
        </Pressable>
      </View>

      {/* 3. MIDDLE TAP OVERLAY TO OPEN FULLSCREEN MAP */}
      <Pressable
        onPress={handleOpenMap}
        style={[styles.middleMapTapArea, { top: topBarTop + 54 }]}
        accessibilityRole="button"
        accessibilityLabel="Buka Peta Interaktif"
      />

      {/* 4. BOTTOM WELCOME & OUTDOOR DURATION BADGE BAR */}
      <View style={styles.welcomeBannerOverlay} pointerEvents="box-none">
        <Pressable
          style={styles.welcomeBannerPressable}
          onPress={onBannerPress || handleOpenMap}
          accessibilityRole="button"
          accessibilityLabel="Selamat Datang & Durasi Luar Ruangan"
        >
          <LinearGradient
            colors={['#1665F4', '#1E6FEF', '#3888F8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.8 }}
            style={styles.welcomeBannerGradient}
          >
            {/* Decorative Cartoon Clouds on Right (Exact layout matching mockup) */}
            <View style={styles.cloudDecorationContainer} pointerEvents="none">
              {/* Cloud 1 (Top right) */}
              <View style={styles.cloud1Position}>
                <CartoonCloud width={50} height={28} />
              </View>

              {/* Cloud 2 (Peeking from far right edge) */}
              <View style={styles.cloud2Position}>
                <CartoonCloud width={48} height={28} />
              </View>

              {/* Cloud 3 (Floating in middle) */}
              <View style={styles.cloud3Position}>
                <CartoonCloud width={52} height={29} />
              </View>

              {/* Cloud 4 (Peeking from bottom edge) */}
              <View style={styles.cloud4Position}>
                <CartoonCloud width={54} height={30} />
              </View>
            </View>

            {/* Left Content Column */}
            <View style={styles.welcomeLeftContent}>
              <Text style={styles.welcomeGreetingText}>Halo! Selamat Datang</Text>
              <Text numberOfLines={1} style={styles.welcomeUserNameText}>
                {userName ? userName.toUpperCase() : 'FREYA JAWANTARA'}
              </Text>

              {/* Thin White Divider Line */}
              <View style={styles.welcomeDividerLine} />

              {/* Duration Row */}
              <View style={styles.durationRow}>
                <View>
                  <Text style={styles.durationItalicText}>Lama Waktu Di</Text>
                  <Text style={styles.durationItalicText}>Luar Ruangan</Text>
                </View>

                <View style={styles.durationNumberRow}>
                  <Text style={[styles.durationBigNumber, displayValue.length > 2 && { fontSize: 26 }]}>
                    {displayValue}
                  </Text>
                  <Text style={styles.durationUnitText}>{displayUnit}</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
    position: 'relative',
  },
  webView: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E2E8F0',
  },

  /* ─── TOP SEARCH BAR OVERLAY ─── */
  topSearchBarOverlay: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 30,
  },
  searchBarBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.8,
    borderColor: '#3B82F6',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  searchPlaceholderText: {
    color: '#2563EB',
    fontSize: 14.5,
    fontWeight: '500',
    letterSpacing: -0.2,
  },

  /* Middle map touch area */
  middleMapTapArea: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    zIndex: 10,
  },

  /* ─── BOTTOM WELCOME & OUTDOOR DURATION BANNER OVERLAY ─── */
  welcomeBannerOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    right: 14,
    zIndex: 30,
  },
  welcomeBannerPressable: {
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#1E6CEF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  welcomeBannerGradient: {
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 18,
    position: 'relative',
    minHeight: 106,
    justifyContent: 'center',
  },

  /* Decorative Clouds Container on Right */
  cloudDecorationContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 135,
    overflow: 'hidden',
    borderTopRightRadius: 22,
    borderBottomRightRadius: 22,
  },
  cloud1Position: {
    position: 'absolute',
    top: -4,
    right: 32,
    opacity: 0.98,
  },
  cloud2Position: {
    position: 'absolute',
    top: 24,
    right: -14,
    opacity: 0.98,
  },
  cloud3Position: {
    position: 'absolute',
    top: 40,
    right: 64,
    opacity: 0.98,
  },
  cloud4Position: {
    position: 'absolute',
    bottom: -10,
    right: 26,
    opacity: 0.98,
  },

  /* Left Welcome Content */
  welcomeLeftContent: {
    justifyContent: 'center',
    zIndex: 10,
    maxWidth: '75%',
  },
  welcomeGreetingText: {
    fontSize: 13.5,
    fontWeight: '500',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  welcomeUserNameText: {
    fontSize: 19,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  welcomeDividerLine: {
    height: 1.2,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    width: 155,
    marginVertical: 6,
  },

  /* Duration row at bottom of banner */
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  durationItalicText: {
    fontSize: 13,
    fontWeight: '700',
    fontStyle: 'italic',
    color: '#FFFFFF',
    lineHeight: 16.5,
  },
  durationNumberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginLeft: 10,
  },
  durationBigNumber: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 38,
    letterSpacing: -1,
  },
  durationUnitText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#FFFFFF',
    marginLeft: 3,
    marginBottom: 2,
  },
});
