import { zonesApi } from '@/services/zonesApi';
import { locationService } from '@/services/locationService';
import {
  terrainService,
  LandscapeType,
  classifyTerrainByName,
  getRealtimeTerrain,
  getLandscapeAsset,
  getLandscapeLabel,
  getLandscapeIcon,
} from '@/services/terrainService';
import {
  getImpactColor,
  getImpactBgColor,
  getTrafficSeverityColor,
} from '@/utils/impact-helpers';
import {
  DailyForecast,
  ImpactLevel,
  NearbyZoneResult,
  TrafficSeverity,
  WeeklyAnalysisResponse,
} from '@/types/zones';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StatusBar as RNStatusBar,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  Easing,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// CityBuildingSplash — Animasi Mulus Gedung Kota Bertingkat Muncul Berurutan
// Memanfaatkan aset asli "kota.png" dipisah dalam 7 irisan arsitektur yang muncul
// satu per satu dari bawah tanah ke angkasa dengan fisika spring elastis native.
// ─────────────────────────────────────────────────────────────────────────────

interface SliceConfig {
  id: string;
  leftPct: number;
  widthPct: number;
  delay: number;
  riseRatio: number;
  damping: number;
  stiffness: number;
  mass: number;
  scaleY: number;
}

const CITY_SLICES: SliceConfig[] = [
  // Slice 0: Gedung pencakar langit kaca biru kiri (paling tinggi)
  {
    id: 'left-tall',
    leftPct: 0,
    widthPct: 16.5,
    delay: 440,
    riseRatio: 0.88,
    damping: 14,
    stiffness: 85,
    mass: 0.85,
    scaleY: 1.15,
  },
  // Slice 1: Gedung gaya klasik bertiang & atap merah kiri
  {
    id: 'left-mid',
    leftPct: 14.5,
    widthPct: 18,
    delay: 240,
    riseRatio: 0.75,
    damping: 13,
    stiffness: 95,
    mass: 0.8,
    scaleY: 1.10,
  },
  // Slice 2: Menara jarum & deretan gedung bertingkat kiri-tengah
  {
    id: 'left-spire',
    leftPct: 30.5,
    widthPct: 16,
    delay: 100,
    riseRatio: 0.65,
    damping: 14,
    stiffness: 105,
    mass: 0.75,
    scaleY: 1.06,
  },
  // Slice 3: Tengah sungai, jembatan, tugu monumen & cakrawala (MUNCUL PERTAMA)
  {
    id: 'center-skyline',
    leftPct: 44.5,
    widthPct: 20,
    delay: 0,
    riseRatio: 0.55,
    damping: 15,
    stiffness: 100,
    mass: 0.8,
    scaleY: 1.05,
  },
  // Slice 4: Deretan menara perkantoran kanan-tengah
  {
    id: 'right-spire',
    leftPct: 62.5,
    widthPct: 15,
    delay: 130,
    riseRatio: 0.65,
    damping: 14,
    stiffness: 105,
    mass: 0.75,
    scaleY: 1.06,
  },
  // Slice 5: Gedung bertingkat modern krem & papan iklan kanan
  {
    id: 'right-mid',
    leftPct: 75.5,
    widthPct: 15,
    delay: 280,
    riseRatio: 0.75,
    damping: 13,
    stiffness: 95,
    mass: 0.8,
    scaleY: 1.10,
  },
  // Slice 6: Mega-gedung pencakar langit kaca biru kanan (grand finale)
  {
    id: 'right-tall',
    leftPct: 88.5,
    widthPct: 13,
    delay: 520,
    riseRatio: 0.88,
    damping: 14,
    stiffness: 85,
    mass: 0.85,
    scaleY: 1.15,
  },
];

function BuildingSliceItem({
  config,
  heroHeight,
  screenWidth,
  kotaAsset,
}: {
  config: SliceConfig;
  heroHeight: number;
  screenWidth: number;
  kotaAsset: any;
}) {
  const initialOffset = heroHeight * config.riseRatio;
  const translateY = useSharedValue(initialOffset);
  const opacity = useSharedValue(0.15);
  const scaleY = useSharedValue(config.scaleY);
  const scaleX = useSharedValue(0.96);

  useEffect(() => {
    translateY.value = initialOffset;
    opacity.value = 0.15;
    scaleY.value = config.scaleY;
    scaleX.value = 0.96;

    // Animasi naik dengan spring lembut & elastis
    translateY.value = withDelay(
      config.delay,
      withSpring(0, {
        damping: config.damping,
        stiffness: config.stiffness,
        mass: config.mass,
      })
    );

    // Fade-in halus ke penuh
    opacity.value = withDelay(
      config.delay,
      withTiming(1, {
        duration: 260,
        easing: Easing.out(Easing.quad),
      })
    );

    // Pemulihan squash & stretch kembali ke 1.0
    scaleY.value = withDelay(
      config.delay,
      withSpring(1.0, { damping: 12, stiffness: 110 })
    );
    scaleX.value = withDelay(
      config.delay,
      withSpring(1.0, { damping: 12, stiffness: 110 })
    );
  }, [config, heroHeight, initialOffset]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scaleY: scaleY.value },
      { scaleX: scaleX.value },
    ],
    opacity: opacity.value,
  }));

  const imageOffsetLeft = -screenWidth * (config.leftPct / 100);

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${config.leftPct}%` as any,
          width: `${config.widthPct}%` as any,
          overflow: 'hidden',
          zIndex: 2,
        },
        animStyle,
      ]}
      pointerEvents="none"
    >
      <Image
        source={kotaAsset}
        style={{
          position: 'absolute',
          top: 0,
          left: imageOffsetLeft,
          width: screenWidth,
          height: heroHeight,
        }}
        contentFit="cover"
        contentPosition="bottom"
      />
    </Animated.View>
  );
}

function CityForegroundLayer({
  heroHeight,
  kotaAsset,
}: {
  heroHeight: number;
  kotaAsset: any;
}) {
  const fgHeight = Math.round(heroHeight * 0.22);
  const translateY = useSharedValue(20);
  const opacity = useSharedValue(0.2);

  useEffect(() => {
    translateY.value = 20;
    opacity.value = 0.2;

    translateY.value = withDelay(
      30,
      withSpring(0, { damping: 15, stiffness: 100 })
    );
    opacity.value = withDelay(
      30,
      withTiming(1, { duration: 240 })
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: fgHeight,
          overflow: 'hidden',
          zIndex: 4,
        },
        animStyle,
      ]}
    >
      <Image
        source={kotaAsset}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: heroHeight,
        }}
        contentFit="cover"
        contentPosition="bottom"
      />
    </Animated.View>
  );
}

function ShimmerParticle({
  leftPct,
  bottomStart,
  delay,
  duration,
  size,
  color,
}: {
  leftPct: number;
  bottomStart: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
}) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.4);

  useEffect(() => {
    translateY.value = 0;
    opacity.value = 0;
    scale.value = 0.4;

    translateY.value = withDelay(
      delay,
      withTiming(-80, { duration, easing: Easing.out(Easing.quad) })
    );
    opacity.value = withDelay(
      delay,
      withTiming(0.9, { duration: duration * 0.35 }, () => {
        opacity.value = withTiming(0, { duration: duration * 0.65 });
      })
    );
    scale.value = withDelay(
      delay,
      withSpring(1, { damping: 8, stiffness: 90 })
    );
  }, [delay, duration]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: `${leftPct}%` as any,
          bottom: bottomStart,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 4,
          elevation: 3,
          zIndex: 5,
        },
        animStyle,
      ]}
    />
  );
}

function MasterCrossfadeLayer({
  kotaAsset,
}: {
  kotaAsset: any;
}) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = 0;
    // Setelah seluruh gedung selesai naik dan stabil (~1250ms), crossfade ke gambar utuh
    opacity.value = withDelay(
      1250,
      withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) })
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { zIndex: 6 }, animStyle]}
    >
      <Image
        source={kotaAsset}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition="bottom"
      />
    </Animated.View>
  );
}

function CityBuildingSplash({
  heroHeight,
}: {
  heroHeight: number;
}) {
  const kotaAsset = getLandscapeAsset('kota');
  const [layoutWidth, setLayoutWidth] = useState(SCREEN_WIDTH);

  return (
    <View
      onLayout={(e) => {
        const w = Math.round(e.nativeEvent.layout.width);
        if (w > 0 && w !== layoutWidth) setLayoutWidth(w);
      }}
      style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}
      pointerEvents="none"
    >
      {/* 1. Gradasi Langit Biru Cerah (Identik dengan palet langit kota.png) */}
      <LinearGradient
        colors={['#4ABCEF', '#7CE0FB', '#D2F5FD']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* 2. Tujuh Klaster Gedung Asli kota.png Muncul Berurutan */}
      {CITY_SLICES.map((slice) => (
        <BuildingSliceItem
          key={slice.id}
          config={slice}
          heroHeight={heroHeight}
          screenWidth={layoutWidth}
          kotaAsset={kotaAsset}
        />
      ))}

      {/* 3. Lapisan Foreground Depan (Pohon, Bunga, Pagar Putih & Trotoar) */}
      <CityForegroundLayer
        heroHeight={heroHeight}
        kotaAsset={kotaAsset}
      />

      {/* 4. Partikel Berkilau Halus saat Gedung Mencuat ke Langit */}
      <ShimmerParticle leftPct={8} bottomStart={heroHeight * 0.3} delay={420} duration={850} size={7} color="#FFFFFF" />
      <ShimmerParticle leftPct={16} bottomStart={heroHeight * 0.35} delay={480} duration={800} size={5} color="#E0F2FE" />
      <ShimmerParticle leftPct={22} bottomStart={heroHeight * 0.28} delay={260} duration={800} size={6} color="#BAE6FD" />
      <ShimmerParticle leftPct={50} bottomStart={heroHeight * 0.25} delay={100} duration={750} size={6} color="#FFFFFF" />
      <ShimmerParticle leftPct={78} bottomStart={heroHeight * 0.3} delay={300} duration={800} size={6} color="#BAE6FD" />
      <ShimmerParticle leftPct={92} bottomStart={heroHeight * 0.35} delay={520} duration={850} size={8} color="#FFFFFF" />
      <ShimmerParticle leftPct={86} bottomStart={heroHeight * 0.28} delay={560} duration={750} size={5} color="#E0F2FE" />

      {/* 5. Master Seamless Crossfade untuk Kesempurnaan Visual Jangka Panjang */}
      <MasterCrossfadeLayer kotaAsset={kotaAsset} />
    </View>
  );
}

export interface LocationItem {
  id?: string;
  name: string;
  lat: number;
  lon: number;
  zone_id?: string;
  landscape: LandscapeType;
  elevation?: number;
  terrainReason?: string;
  distance_km?: number;
  impact_level?: ImpactLevel;
  congestion_status?: TrafficSeverity;
  isRealtime?: boolean;
}

// Fallback coordinates only used if device GPS permission is explicitly denied
const DEFAULT_FALLBACK_COORDS: LocationItem = {
  name: 'Lokasi Default (Semarang)',
  lat: -6.988,
  lon: 110.415,
  landscape: 'kota',
  elevation: 6,
  terrainReason: 'Kawasan Perkotaan',
};


// Weather Icons
function SunnyIcon({ size = 36 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <Circle cx="20" cy="20" r="10" fill="#FACC15" />
      <Circle cx="20" cy="4" r="2.2" fill="#FACC15" />
      <Circle cx="20" cy="36" r="2.2" fill="#FACC15" />
      <Circle cx="4" cy="20" r="2.2" fill="#FACC15" />
      <Circle cx="36" cy="20" r="2.2" fill="#FACC15" />
      <Circle cx="8.7" cy="8.7" r="2.2" fill="#FACC15" />
      <Circle cx="31.3" cy="31.3" r="2.2" fill="#FACC15" />
      <Circle cx="8.7" cy="31.3" r="2.2" fill="#FACC15" />
      <Circle cx="31.3" cy="8.7" r="2.2" fill="#FACC15" />
    </Svg>
  );
}

function PartlyCloudyIcon({ size = 38 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      <Circle cx="30" cy="15" r="7" fill="#FACC15" />
      <Circle cx="30" cy="4" r="1.6" fill="#FACC15" />
      <Circle cx="38" cy="8" r="1.6" fill="#FACC15" />
      <Circle cx="41" cy="15" r="1.6" fill="#FACC15" />
      <Path
        d="M12 32C8.7 32 6 29.3 6 26C6 23.1 8.1 20.7 10.9 20.1C11.6 15.6 15.4 12 20 12C24.1 12 27.6 14.8 28.7 18.7C29.6 18.2 30.7 18 31.8 18C35.2 18 38 20.8 38 24.2C38 24.4 38 24.6 38 24.8C39.2 25.7 40 27.2 40 28.8C40 31.7 37.7 34 34.8 34H12Z"
        fill="#DCEEFA"
      />
    </Svg>
  );
}

function RainyIcon({ size = 38 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      <Path
        d="M12 24C9 24 7 21.8 7 19C7 16.5 8.9 14.4 11.4 13.9C12.1 9.9 15.5 7 19.5 7C23.1 7 26.2 9.4 27.2 12.8C28 12.3 29 12 30 12C33 12 35.5 14.5 35.5 17.5C36.6 18.3 37.3 19.6 37.3 21C37.3 23.5 35.3 25.5 32.8 25.5H12Z"
        fill="#93C5FD"
      />
      <Path d="M14 28L11 34" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" />
      <Path d="M21 28L18 34" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" />
      <Path d="M28 28L25 34" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" />
    </Svg>
  );
}

function getWeatherIcon(forecast: DailyForecast) {
  if (forecast.precipitation_mm > 0.5) {
    return <RainyIcon size={36} />;
  }
  if (forecast.humidity_percent > 65 || forecast.dispersion_condition.includes('Normal')) {
    return <PartlyCloudyIcon size={38} />;
  }
  return <SunnyIcon size={36} />;
}

const HERO_HEIGHT = Math.max(340, Math.round(SCREEN_WIDTH * (320 / 402)));

export default function PollutionImpactScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const searchParams = useLocalSearchParams<{
    zone_id?: string;
    lat?: string;
    lon?: string;
    name?: string;
  }>();

  // Active Selected Location
  const [currentLocation, setCurrentLocation] = useState<LocationItem>(() => {
    if (searchParams.lat && searchParams.lon) {
      const locName = searchParams.name || 'Lokasi Terpilih';
      return {
        name: locName,
        lat: parseFloat(searchParams.lat),
        lon: parseFloat(searchParams.lon),
        zone_id: searchParams.zone_id,
        landscape: classifyTerrainByName(locName),
        isRealtime: true,
      };
    }
    return DEFAULT_FALLBACK_COORDS;
  });

  // User Device GPS Location State
  const [userGpsLocation, setUserGpsLocation] = useState<LocationItem | null>(null);
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [gpsPermissionDenied, setGpsPermissionDenied] = useState(false);

  // Dynamic Real-time Nearby Hotspots (Purely from API, no dummy data)
  const [realtimeNearbyZones, setRealtimeNearbyZones] = useState<LocationItem[]>([]);
  const [isLoadingNearby, setIsLoadingNearby] = useState(false);

  // Real-time Terrain state bound strictly to user's real-time position
  const [activeLandscape, setActiveLandscape] = useState<LandscapeType>(
    currentLocation.landscape
  );
  const [terrainInfo, setTerrainInfo] = useState<string>('Memuat bentang alam...');

  const [analysisData, setAnalysisData] = useState<WeeklyAnalysisResponse | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [animKey, setAnimKey] = useState(0);

  // Update landscape strictly according to real-time location & elevation
  const syncRealtimeLandscape = useCallback(
    async (lat: number, lon: number, name: string, category: string = '') => {
      const result = await terrainService.getRealtimeTerrain(lat, lon, name, category);
      setActiveLandscape(result.landscape);
      setTerrainInfo(result.reason);
    },
    []
  );

  // Function to acquire device GPS coordinates in real-time
  const fetchDeviceGpsLocation = useCallback(async (): Promise<LocationItem | null> => {
    setIsLocatingGps(true);
    try {
      const res = await locationService.getCurrentGpsLocation();
      if (!res.success) {
        if (res.permissionDenied) {
          setGpsPermissionDenied(true);
        }
        return null;
      }
      setGpsPermissionDenied(false);

      if (res.location) {
        const gpsItem: LocationItem = {
          name: res.location.name,
          lat: res.location.lat,
          lon: res.location.lon,
          landscape: res.location.landscape,
          elevation: res.location.elevation,
          terrainReason: res.location.terrainReason,
          isRealtime: true,
        };
        setUserGpsLocation(gpsItem);
        return gpsItem;
      }
      return null;
    } catch (err: any) {
      console.warn('[GPS] Failed getting device position:', err);
      return null;
    } finally {
      setIsLocatingGps(false);
    }
  }, []);

  // Fetch Real-time Nearby Hotspot Zones around a coordinate
  const fetchNearbyHotspots = useCallback(async (lat: number, lon: number) => {
    setIsLoadingNearby(true);
    try {
      const res = await zonesApi.getNearbyZones(lat, lon, 30);
      if (res && res.nearby_zones && res.nearby_zones.length > 0) {
        const mapped: LocationItem[] = res.nearby_zones.map((nz: NearbyZoneResult) => ({
          id: nz.zone.id,
          name: nz.zone.name,
          lat: nz.zone.latitude,
          lon: nz.zone.longitude,
          zone_id: nz.zone.id,
          distance_km: nz.distance_km,
          impact_level: nz.impact_level,
          congestion_status: nz.congestion_status,
          landscape: classifyTerrainByName(nz.zone.name, nz.zone.category),
          isRealtime: true,
        }));
        setRealtimeNearbyZones(mapped);
      } else {
        setRealtimeNearbyZones([]);
      }
    } catch (err) {
      console.warn('[NearbyZones] Failed fetching dynamic zones:', err);
      setRealtimeNearbyZones([]);
    } finally {
      setIsLoadingNearby(false);
    }
  }, []);

  // Fetch 7-Day Forecast Analysis from Backend
  const fetchAnalysis = useCallback(async (isPullRefresh = false) => {
    if (isPullRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);
    setAnimKey((k) => k + 1);

    try {
      const data = await zonesApi.getWeeklyAnalysis({
        zone_id: currentLocation.zone_id,
        lat: currentLocation.lat,
        lon: currentLocation.lon,
        name: currentLocation.name,
      });
      setAnalysisData(data);
      if (data.daily_forecast && data.daily_forecast.length > 0) {
        setSelectedDayIndex(0);
      }

      // Automatically sync real-time landscape strictly from user's current coordinates
      await syncRealtimeLandscape(
        currentLocation.lat,
        currentLocation.lon,
        data.location_name || currentLocation.name,
        data.zone_category || ''
      );
    } catch (err: any) {
      console.warn('[WeeklyAnalysis] Error fetching data:', err);
      setErrorMessage(
        err?.message || 'Gagal memuat data analisis dampak polusi 7 hari.'
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentLocation, syncRealtimeLandscape]);

  // Initial mount: Acquire real GPS position if no coordinate params were passed
  useEffect(() => {
    const initLocation = async () => {
      if (!searchParams.lat || !searchParams.lon) {
        const gps = await fetchDeviceGpsLocation();
        if (gps) {
          setCurrentLocation(gps);
          setActiveLandscape(gps.landscape);
          if (gps.terrainReason) setTerrainInfo(gps.terrainReason);
        }
      } else {
        fetchDeviceGpsLocation();
        syncRealtimeLandscape(
          currentLocation.lat,
          currentLocation.lon,
          currentLocation.name
        );
      }
    };
    initLocation();
  }, [fetchDeviceGpsLocation, searchParams.lat, searchParams.lon, currentLocation.lat, currentLocation.lon, currentLocation.name, syncRealtimeLandscape]);

  // Whenever currentLocation changes, fetch 7-day analysis & nearby zones
  useEffect(() => {
    fetchAnalysis();
    fetchNearbyHotspots(currentLocation.lat, currentLocation.lon);
  }, [fetchAnalysis, fetchNearbyHotspots, currentLocation.lat, currentLocation.lon]);

  const topPadding =
    Platform.OS === 'android'
      ? (RNStatusBar.currentHeight || 24) + 10
      : insets.top + 8;

  const selectedDay: DailyForecast | undefined =
    analysisData?.daily_forecast?.[selectedDayIndex];

  // Handler to explicitly switch to User GPS
  const handleUseMyGps = async () => {
    const gps = await fetchDeviceGpsLocation();
    if (gps) {
      setCurrentLocation(gps);
      setActiveLandscape(gps.landscape);
      if (gps.terrainReason) setTerrainInfo(gps.terrainReason);
      setShowLocationPicker(false);
    } else if (gpsPermissionDenied) {
      Alert.alert(
        'Izin Lokasi Diperlukan',
        'Mohon berikan izin akses lokasi/GPS pada perangkat Anda agar AURA dapat menganalisis polusi dan cuaca di sekitar Anda secara real-time.'
      );
    }
  };

  return (
    <View style={styles.container}>
      <RNStatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              fetchAnalysis(true);
              fetchNearbyHotspots(currentLocation.lat, currentLocation.lon);
            }}
            tintColor="#0284C7"
          />
        }
      >
        {/* Top Sky + Landmark Hero Container with DYNAMIC REALTIME LANDSCAPE IMAGE */}
        <View style={[styles.heroWrapper, { height: HERO_HEIGHT }]}>
          {activeLandscape === 'kota' ? (
            /* ── KOTA: Animasi Mulus Gedung Bertingkat Muncul Berurutan dari Aset kota.png ── */
            <CityBuildingSplash key={animKey} heroHeight={HERO_HEIGHT} />
          ) : (
            /* ── Non-kota: standard static image hero ── */
            <Image
              source={getLandscapeAsset(activeLandscape)}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              contentPosition="bottom"
              transition={300}
            />
          )}

          <View style={[styles.heroContentOverlay, { paddingTop: topPadding }]}>
            {/* Header Navigation Bar */}
            <View style={styles.headerBar}>
              <Pressable
                onPress={() => router.back()}
                style={styles.backButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="arrow-back" size={22} color="#0284C7" />
              </Pressable>

              {/* Location Picker Trigger */}
              <Pressable
                onPress={() => setShowLocationPicker(true)}
                style={styles.headerLocationButton}
              >
                <Ionicons
                  name={currentLocation.zone_id ? 'location' : 'navigate-circle'}
                  size={16}
                  color="#0284C7"
                />
                <Text numberOfLines={1} style={styles.headerLocationTitle}>
                  {analysisData?.location_name || currentLocation.name}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#64748B" />
              </Pressable>

              <Pressable
                onPress={() => {
                  setAnimKey((k) => k + 1);
                  fetchAnalysis();
                  fetchNearbyHotspots(currentLocation.lat, currentLocation.lon);
                }}
                style={styles.backButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="refresh" size={20} color="#0284C7" />
              </Pressable>
            </View>

            {/* REAL-TIME TERRAIN BADGE INDICATOR (Derived from User's exact GPS & Altitude) */}
            <View style={styles.terrainBadgeContainer}>
              <View style={styles.realtimeTerrainPill}>
                <Ionicons
                  name={getLandscapeIcon(activeLandscape) as any}
                  size={13}
                  color="#0284C7"
                  style={{ marginRight: 5 }}
                />
                <Text style={styles.realtimeTerrainText}>
                  {terrainInfo || getLandscapeLabel(activeLandscape)}
                </Text>
              </View>
            </View>

            {/* AQI / Risk Display in Sky */}
            <View style={styles.aqiInfoContainer}>
              {selectedDay ? (
                <>
                  <Text style={styles.aqiNumber}>
                    {selectedDay.predicted_aqi > 0
                      ? selectedDay.predicted_aqi
                      : Math.round(selectedDay.health_risk_score)}
                  </Text>
                  <Text style={styles.aqiSubtitle}>
                    {selectedDay.predicted_aqi > 0
                      ? 'Prediksi Indeks Kualitas Udara'
                      : 'Skor Risiko Dampak Kesehatan'}
                  </Text>

                  {/* Impact Status Badge */}
                  <View
                    style={[
                      styles.impactLevelBadge,
                      {
                        backgroundColor: getImpactColor(selectedDay.impact_level),
                      },
                    ]}
                  >
                    <Text style={styles.impactLevelBadgeText}>
                      {selectedDay.impact_level}
                    </Text>
                  </View>
                </>
              ) : (
                <View style={{ alignItems: 'center', marginTop: 20 }}>
                  <ActivityIndicator size="small" color="#0284C7" />
                  <Text style={styles.aqiSubtitle}>
                    {isLocatingGps
                      ? 'Menghubungkan GPS & Cuaca...'
                      : 'Memuat Prakiraan Cuaca & Polusi...'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Observation & Forecast Section (Soft Aqua Background) */}
        <LinearGradient
          colors={['#EBF8FD', '#DEF2FA', '#D4EDF7']}
          style={styles.detailsGradientSection}
        >
          {/* Error Banner with Retry */}
          {errorMessage && (
            <View style={styles.errorCard}>
              <Ionicons name="alert-circle" size={24} color="#EF4444" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.errorTitle}>Koneksi API Terkendala</Text>
                <Text style={styles.errorDesc}>{errorMessage}</Text>
              </View>
              <Pressable style={styles.retryButton} onPress={() => fetchAnalysis()}>
                <Text style={styles.retryButtonText}>Ulangi</Text>
              </Pressable>
            </View>
          )}

          {/* 1. KARTU RINGKASAN MINGGUAN (Weekly Overview Card) */}
          {analysisData && (
            <View style={styles.weeklySummaryCard}>
              <View style={styles.weeklySummaryHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.weeklySummarySubtitle}>Prakiraan 7 Hari</Text>
                  <Text style={styles.weeklySummaryTitle}>Status Risiko Lingkungan</Text>
                </View>

                {/* Overall Status Badge */}
                <View
                  style={[
                    styles.overallBadge,
                    {
                      backgroundColor: getImpactBgColor(
                        analysisData.overall_weekly_status
                      ),
                      borderColor: getImpactColor(analysisData.overall_weekly_status),
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor: getImpactColor(
                          analysisData.overall_weekly_status
                        ),
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.overallBadgeText,
                      {
                        color: getImpactColor(analysisData.overall_weekly_status),
                      },
                    ]}
                  >
                    {analysisData.overall_weekly_status}
                  </Text>
                </View>
              </View>

              {/* Metrics Row: Average Risk Score & Peak Risk Day */}
              <View style={styles.weeklyMetricsRow}>
                {/* Average Risk Score */}
                <View style={styles.metricBlock}>
                  <Text style={styles.metricBlockLabel}>Rata-rata Risiko</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                    <Text style={styles.metricBlockValue}>
                      {analysisData.average_risk_score.toFixed(1)}
                    </Text>
                    <Text style={styles.metricBlockUnit}>/100</Text>
                  </View>
                  <View style={styles.progressBarTrack}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.min(
                            100,
                            Math.max(0, analysisData.average_risk_score)
                          )}%`,
                          backgroundColor: getImpactColor(
                            analysisData.overall_weekly_status
                          ),
                        },
                      ]}
                    />
                  </View>
                </View>

                <View style={styles.metricDivider} />

                {/* Peak Risk Day */}
                <View style={styles.metricBlock}>
                  <Text style={styles.metricBlockLabel}>Hari Paling Rawan</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <Ionicons name="warning" size={18} color="#EF4444" style={{ marginRight: 6 }} />
                    <Text numberOfLines={1} style={styles.peakDayText}>
                      {analysisData.peak_risk_day || 'Tidak ada'}
                    </Text>
                  </View>
                  <Text style={styles.peakDaySubtext}>
                    Kurangi mobilitas di luar ruangan
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* 2. HORIZONTAL CALENDAR / DAY CAROUSEL (7 Days) */}
          <View style={[styles.sectionHeader, { marginTop: 18 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="calendar-outline" size={18} color="#0284C7" style={{ marginRight: 6 }} />
              <Text style={styles.sectionTitle}>Pilih Hari Prakiraan</Text>
            </View>
            <Text style={styles.sectionSubtitle}>Ketuk untuk rincian harian</Text>
          </View>

          {isLoading && !analysisData ? (
            <View style={styles.loadingCarouselWrapper}>
              <ActivityIndicator size="small" color="#0284C7" />
              <Text style={styles.loadingText}>Menyiapkan kalender prakiraan 7 hari...</Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.forecastScrollContent}
            >
              {analysisData?.daily_forecast?.map((item, index) => {
                const isSelected = index === selectedDayIndex;
                const impactCol = getImpactColor(item.impact_level);

                return (
                  <Pressable
                    key={item.date || index}
                    onPress={() => setSelectedDayIndex(index)}
                    style={[
                      styles.forecastCard,
                      isSelected && styles.forecastCardActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.forecastDay,
                        isSelected && styles.forecastDayActive,
                      ]}
                    >
                      {item.day_name}
                    </Text>

                    <Text style={styles.forecastDateText}>
                      {item.date ? item.date.slice(5) : ''}
                    </Text>

                    <View style={styles.forecastIconWrapper}>
                      {getWeatherIcon(item)}
                    </View>

                    {/* Risk Score Pill */}
                    <View
                      style={[
                        styles.forecastScorePill,
                        { backgroundColor: impactCol },
                      ]}
                    >
                      <Text style={styles.forecastScorePillText}>
                        {Math.round(item.health_risk_score)}
                      </Text>
                    </View>

                    {/* Status Text */}
                    <Text
                      style={[
                        styles.forecastStatusSmall,
                        { color: impactCol },
                      ]}
                    >
                      {item.impact_level}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {/* 3. RINCIAN HARI TERPILIH (Selected Day Details) */}
          {selectedDay && (
            <>
              <View style={[styles.sectionHeader, { marginTop: 22 }]}>
                <View>
                  <Text style={styles.sectionTitle}>
                    Detail {selectedDay.day_name} ({selectedDay.date})
                  </Text>
                  <Text style={styles.sectionSubtitle}>
                    {selectedDay.summary}
                  </Text>
                </View>
              </View>

              {/* Traffic Severity & Congestion Banner */}
              <View style={styles.trafficBannerCard}>
                <View style={styles.trafficBannerLeft}>
                  <Ionicons name="car-outline" size={22} color="#0284C7" />
                  <View style={{ marginLeft: 10 }}>
                    <Text style={styles.trafficBannerTitle}>Tingkat Kemacetan</Text>
                    <Text style={styles.trafficBannerSub}>
                      Indeks Beban: {Math.round(selectedDay.traffic_congestion_idx)}%
                    </Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.trafficBadge,
                    {
                      backgroundColor: getTrafficSeverityColor(
                        selectedDay.traffic_severity
                      ),
                    },
                  ]}
                >
                  <Text style={styles.trafficBadgeText}>
                    {selectedDay.traffic_severity}
                  </Text>
                </View>
              </View>

              {/* 2x4 Environmental & Weather Metrics Grid */}
              <View style={styles.gridContainer}>
                {/* PM2.5 */}
                <View style={styles.observationCard}>
                  <Image
                    source={require('@/assets/indexmap/Ellipse 321.png')}
                    style={styles.observationIcon}
                    contentFit="contain"
                  />
                  <View style={styles.observationTextCol}>
                    <Text style={styles.observationLabel}>PM2.5</Text>
                    <Text style={styles.observationValue}>
                      {selectedDay.predicted_pm2_5.toFixed(1)} µg/m³
                    </Text>
                  </View>
                </View>

                {/* PM10 */}
                <View style={styles.observationCard}>
                  <Image
                    source={require('@/assets/indexmap/Ellipse 321.png')}
                    style={styles.observationIcon}
                    contentFit="contain"
                  />
                  <View style={styles.observationTextCol}>
                    <Text style={styles.observationLabel}>PM10</Text>
                    <Text style={styles.observationValue}>
                      {selectedDay.predicted_pm10.toFixed(1)} µg/m³
                    </Text>
                  </View>
                </View>

                {/* Carbon Monoxide (CO) */}
                <View style={styles.observationCard}>
                  <Image
                    source={require('@/assets/indexmap/Ellipse 321-1.png')}
                    style={styles.observationIcon}
                    contentFit="contain"
                  />
                  <View style={styles.observationTextCol}>
                    <Text style={styles.observationLabel}>CO (Karbon)</Text>
                    <Text style={styles.observationValue}>
                      {Math.round(selectedDay.predicted_co)} µg/m³
                    </Text>
                  </View>
                </View>

                {/* Kecepatan Angin */}
                <View style={styles.observationCard}>
                  <Image
                    source={require('@/assets/indexmap/Ellipse 321-2.png')}
                    style={styles.observationIcon}
                    contentFit="contain"
                  />
                  <View style={styles.observationTextCol}>
                    <Text style={styles.observationLabel}>Angin</Text>
                    <Text style={styles.observationValue}>
                      {selectedDay.wind_speed_kmh.toFixed(1)} km/h
                    </Text>
                  </View>
                </View>

                {/* Arah Angin */}
                <View style={styles.observationCard}>
                  <View style={[styles.observationIcon, styles.iconFallback]}>
                    <Ionicons name="compass-outline" size={22} color="#0284C7" />
                  </View>
                  <View style={styles.observationTextCol}>
                    <Text style={styles.observationLabel}>Arah Angin</Text>
                    <Text style={styles.observationValue}>
                      {selectedDay.wind_direction_compass || 'Utara'}
                    </Text>
                  </View>
                </View>

                {/* Kelembapan */}
                <View style={styles.observationCard}>
                  <Image
                    source={require('@/assets/indexmap/Ellipse 321-3.png')}
                    style={styles.observationIcon}
                    contentFit="contain"
                  />
                  <View style={styles.observationTextCol}>
                    <Text style={styles.observationLabel}>Kelembapan</Text>
                    <Text style={styles.observationValue}>
                      {Math.round(selectedDay.humidity_percent)}%
                    </Text>
                  </View>
                </View>

                {/* Curah Hujan */}
                <View style={styles.observationCard}>
                  <View style={[styles.observationIcon, styles.iconFallback]}>
                    <Ionicons name="rainy-outline" size={22} color="#0284C7" />
                  </View>
                  <View style={styles.observationTextCol}>
                    <Text style={styles.observationLabel}>Curah Hujan</Text>
                    <Text style={styles.observationValue}>
                      {selectedDay.precipitation_mm.toFixed(1)} mm
                    </Text>
                  </View>
                </View>

                {/* Kondisi Dispersi */}
                <View style={styles.observationCard}>
                  <View style={[styles.observationIcon, styles.iconFallback]}>
                    <Ionicons name="leaf-outline" size={22} color="#10B981" />
                  </View>
                  <View style={styles.observationTextCol}>
                    <Text style={styles.observationLabel}>Dispersi</Text>
                    <Text numberOfLines={1} style={styles.observationValue}>
                      {selectedDay.dispersion_condition}
                    </Text>
                  </View>
                </View>
              </View>
            </>
          )}

          {/* Bottom Spacing */}
          <View style={{ height: insets.bottom + 40 }} />
        </LinearGradient>
      </ScrollView>

      {/* MODAL: Switch Location (Real-time User GPS & Real-time Nearby Hotspots) */}
      <Modal
        visible={showLocationPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLocationPicker(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowLocationPicker(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Pilih Titik Lokasi Analisis</Text>
                <Text style={styles.modalSubtitle}>
                  Didukung deteksi posisi GPS perangkat & zona real-time
                </Text>
              </View>
              <Pressable
                onPress={() => setShowLocationPicker(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color="#64748B" />
              </Pressable>
            </View>

            {/* REAL-TIME DEVICE GPS CARD (TAP TO USE LIVE GPS) */}
            <Pressable
              onPress={handleUseMyGps}
              style={[
                styles.gpsLiveCard,
                !currentLocation.zone_id && styles.gpsLiveCardActive,
              ]}
            >
              <View style={styles.gpsLiveIconBox}>
                <Ionicons name="navigate" size={20} color="#0284C7" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.gpsLiveTitle}>
                    {userGpsLocation ? userGpsLocation.name : 'Gunakan GPS Lokasi Saya'}
                  </Text>
                  <View style={styles.liveGpsBadge}>
                    <View style={styles.realtimePulse} />
                    <Text style={styles.liveGpsBadgeText}>GPS Live</Text>
                  </View>
                </View>
                <Text style={styles.gpsLiveSub}>
                  {userGpsLocation
                    ? `Koordinat: ${userGpsLocation.lat.toFixed(4)}, ${userGpsLocation.lon.toFixed(4)} • ${userGpsLocation.terrainReason || ''}`
                    : 'Ketuk untuk sinkronisasi koordinat GPS perangkat'}
                </Text>
              </View>
              {isLocatingGps ? (
                <ActivityIndicator size="small" color="#0284C7" />
              ) : (
                <Ionicons
                  name={!currentLocation.zone_id ? 'checkmark-circle' : 'chevron-forward'}
                  size={20}
                  color={!currentLocation.zone_id ? '#0284C7' : '#94A3B8'}
                />
              )}
            </Pressable>

            {/* NEARBY HOTSPOT ZONES SECTION HEADER */}
            <View style={styles.realtimeBar}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="radio" size={16} color="#0284C7" style={{ marginRight: 6 }} />
                <Text style={styles.realtimeBarLabel}>Hotspot Sekitar Lokasi Anda (Real-Time)</Text>
              </View>
              <Pressable
                onPress={() => fetchNearbyHotspots(currentLocation.lat, currentLocation.lon)}
                style={styles.refreshZonesBtn}
              >
                {isLoadingNearby ? (
                  <ActivityIndicator size="small" color="#0284C7" />
                ) : (
                  <>
                    <Ionicons name="sync" size={14} color="#0284C7" />
                    <Text style={styles.refreshZonesText}>Perbarui</Text>
                  </>
                )}
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 320, marginTop: 4 }} showsVerticalScrollIndicator={false}>
              {realtimeNearbyZones.length > 0 ? (
                realtimeNearbyZones.map((loc, idx) => {
                  const isSelected =
                    currentLocation.zone_id === loc.zone_id ||
                    (Math.abs(currentLocation.lat - loc.lat) < 0.001 &&
                      Math.abs(currentLocation.lon - loc.lon) < 0.001);

                  return (
                    <Pressable
                      key={loc.id || `${loc.lat}-${loc.lon}-${idx}`}
                      style={[
                        styles.locationOption,
                        isSelected && styles.locationOptionSelected,
                      ]}
                      onPress={async () => {
                        const terrain = await getRealtimeTerrain(loc.lat, loc.lon, loc.name);
                        const updated: LocationItem = {
                          ...loc,
                          landscape: terrain.landscape,
                          elevation: terrain.elevation,
                          terrainReason: terrain.reason,
                        };
                        setCurrentLocation(updated);
                        setActiveLandscape(terrain.landscape);
                        setTerrainInfo(terrain.reason);
                        setShowLocationPicker(false);
                      }}
                    >
                      <View
                        style={[
                          styles.landscapeIconBox,
                          { backgroundColor: isSelected ? '#E0F2FE' : '#F1F5F9' },
                        ]}
                      >
                        <Ionicons
                          name={getLandscapeIcon(loc.landscape) as any}
                          size={20}
                          color={isSelected ? '#0284C7' : '#64748B'}
                        />
                      </View>

                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.locationOptionName,
                            isSelected && styles.locationOptionNameSelected,
                          ]}
                        >
                          {loc.name}
                        </Text>

                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 6 }}>
                          {/* Terrain pill */}
                          <View style={styles.terrainPill}>
                            <Text style={styles.terrainPillText}>
                              {getLandscapeLabel(loc.landscape)}
                            </Text>
                          </View>

                          {/* Distance */}
                          {typeof loc.distance_km === 'number' && (
                            <Text style={styles.locationOptionCoords}>
                              {loc.distance_km.toFixed(1)} km
                            </Text>
                          )}

                          {/* Impact Level Badge */}
                          {loc.impact_level && (
                            <View
                              style={[
                                styles.smallImpactBadge,
                                { backgroundColor: getImpactBgColor(loc.impact_level) },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.smallImpactText,
                                  { color: getImpactColor(loc.impact_level) },
                                ]}
                              >
                                {loc.impact_level}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={22} color="#0284C7" />
                      )}
                    </Pressable>
                  );
                })
              ) : (
                <View style={styles.emptyHotspotsBox}>
                  <Ionicons name="shield-checkmark" size={32} color="#10B981" />
                  <Text style={styles.emptyHotspotsTitle}>
                    Tidak Ada Zona Kritis di Sekitar Anda
                  </Text>
                  <Text style={styles.emptyHotspotsSub}>
                    Dalam radius 30 km dari lokasi Anda tidak ditemukan titik kemacetan pekat atau polusi berbahaya.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#4CBDE3',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  heroWrapper: {
    width: '100%',
    backgroundColor: '#4CBDE3',
    position: 'relative',
    overflow: 'hidden',
  },
  heroContentOverlay: {
    ...StyleSheet.absoluteFill,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 4,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 4,
  },
  headerLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    maxWidth: SCREEN_WIDTH - 120,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  headerLocationTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginHorizontal: 6,
  },
  terrainBadgeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  realtimeTerrainPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  realtimeTerrainText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0284C7',
    letterSpacing: 0.3,
  },
  aqiInfoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  aqiNumber: {
    fontSize: 66,
    fontWeight: '800',
    color: '#1E293B',
    lineHeight: 70,
    letterSpacing: -1,
  },
  aqiSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginTop: 2,
  },
  impactLevelBadge: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 16,
  },
  impactLevelBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  detailsGradientSection: {
    flex: 1,
    paddingTop: 18,
    paddingHorizontal: 18,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#991B1B',
  },
  errorDesc: {
    fontSize: 12,
    color: '#B91C1C',
    marginTop: 2,
  },
  retryButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginLeft: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  weeklySummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 16,
  },
  weeklySummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  weeklySummarySubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0284C7',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  weeklySummaryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 2,
  },
  overallBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  overallBadgeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  weeklyMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
  },
  metricBlock: {
    flex: 1,
  },
  metricBlockLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  metricBlockValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E293B',
  },
  metricBlockUnit: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    marginLeft: 2,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  metricDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 14,
  },
  peakDayText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EF4444',
    flex: 1,
  },
  peakDaySubtext: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 3,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  loadingCarouselWrapper: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
  },
  forecastScrollContent: {
    paddingRight: 18,
    gap: 10,
    paddingVertical: 4,
  },
  forecastCard: {
    width: 92,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  forecastCardActive: {
    borderColor: '#0284C7',
    backgroundColor: '#F0F9FF',
    transform: [{ translateY: -2 }],
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 4,
  },
  forecastDay: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  forecastDayActive: {
    color: '#0284C7',
  },
  forecastDateText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  forecastIconWrapper: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
  },
  forecastScorePill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 2,
  },
  forecastScorePillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  forecastStatusSmall: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  trafficBannerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  trafficBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trafficBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  trafficBannerSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  trafficBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  trafficBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  observationCard: {
    width: (SCREEN_WIDTH - 36 - 10) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 2,
  },
  observationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  iconFallback: {
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  observationTextCol: {
    marginLeft: 10,
    flex: 1,
    justifyContent: 'center',
  },
  observationLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 2,
  },
  observationValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  recommendationsContainer: {
    gap: 8,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  recommendationIconBox: {
    marginRight: 10,
    marginTop: 1,
  },
  recommendationText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: '#334155',
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 13,
    color: '#64748B',
    fontStyle: 'italic',
    padding: 10,
  },
  generalAdviceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  generalAdviceItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  generalAdviceBullet: {
    color: '#F59E0B',
    fontSize: 16,
    fontWeight: '800',
    marginRight: 8,
    marginTop: -2,
  },
  generalAdviceText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: '#475569',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  gpsLiveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
  },
  gpsLiveCardActive: {
    backgroundColor: '#F0F9FF',
    borderColor: '#0284C7',
  },
  gpsLiveIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gpsLiveTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  liveGpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  liveGpsBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0284C7',
    marginLeft: 4,
  },
  gpsLiveSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  realtimeBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  realtimePulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0284C7',
  },
  realtimeBarLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  refreshZonesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  refreshZonesText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  locationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    marginBottom: 8,
  },
  locationOptionSelected: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1.5,
    borderColor: '#0284C7',
  },
  landscapeIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationOptionName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
  },
  locationOptionNameSelected: {
    color: '#0284C7',
  },
  locationOptionCoords: {
    fontSize: 11,
    color: '#64748B',
  },
  terrainPill: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  terrainPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  smallImpactBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  smallImpactText: {
    fontSize: 10,
    fontWeight: '800',
  },
  emptyHotspotsBox: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  emptyHotspotsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 8,
    textAlign: 'center',
  },
  emptyHotspotsSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 16,
  },
});
