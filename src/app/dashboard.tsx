import { SemarangMapCard } from '@/components/dashboard/SemarangMapCard';
import { FullscreenSemarangMapModal } from '@/components/dashboard/FullscreenSemarangMapModal';
import { AuraColors } from '@/constants/aura-theme';
import { useAuth } from '@/context/auth-context';
import { zonesApi } from '@/services/zonesApi';
import { mapScraperService } from '@/services/mapScraperService';
import { locationService } from '@/services/locationService';
import { isProfileComplete } from '@/types/auth';
import { DailyForecast, ImpactLevel, NearbyZoneResult, WeeklyAnalysisResponse } from '@/types/zones';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import { mobilityService } from '@/services/mobilityService';
import { backgroundMobilityTracker } from '@/services/backgroundMobilityTracker';
import { ExposureStats } from '@/types/mobility';
import { PageTransitionSplash } from '@/components/splash/AuraCloudSplash';

function getAqiGradient(aqi: number): [string, string] {
  if (aqi <= 50) return ['#34D399', '#10B981']; // Aman
  if (aqi <= 100) return ['#FBBF24', '#F59E0B']; // Waspada
  return ['#F87171', '#EF4444']; // Berbahaya
}

function getWeatherGradient(condition: string): [string, string, string] {
  if (condition === 'Hujan') return ['#1D4ED8', '#2563EB', '#3B82F6'];
  if (condition === 'Berasap' || condition === 'Asap' || condition === 'Hazy') {
    return ['#334155', '#475569', '#64748B'];
  }
  if (condition === 'Berawan') return ['#3B82F6', '#60A5FA', '#93C5FD'];
  return ['#2563EB', '#3B82F6', '#60A5FA']; // Cerah
}

function getImpactGradient(level: ImpactLevel): [string, string] {
  if (level === 'Aman') return ['#10B981', '#059669'];
  if (level === 'Waspada') return ['#F59E0B', '#D97706'];
  return ['#EF4444', '#DC2626']; // Berbahaya
}

function getImpactRingColors(level: ImpactLevel): [string, string, string] {
  if (level === 'Aman') return ['#D1FAE5', '#A7F3D0', '#6EE7B7'];
  if (level === 'Waspada') return ['#FEF08A', '#FDE047', '#FB923C'];
  return ['#FEE2E2', '#FCA5A5', '#F87171']; // Berbahaya
}

export default function DashboardScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Dynamic user GPS location & nearby hotspots
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lon: number;
    name: string;
    isRealtime?: boolean;
  }>({
    lat: -6.9932,
    lon: 110.4203,
    name: 'Semarang, Jawa Tengah',
    isRealtime: false,
  });
  const [nearbyZones, setNearbyZones] = useState<NearbyZoneResult[]>([]);
  const [analysisData, setAnalysisData] = useState<WeeklyAnalysisResponse | null>(null);
  const [mobilityStats, setMobilityStats] = useState<ExposureStats | null>(null);
  const [simulatedMinutes, setSimulatedMinutes] = useState<number | null>(null);
  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Jika user belum melengkapi profil tentang kamu, wajib redirect ke complete-profile
  useEffect(() => {
    if (user && !isProfileComplete(user)) {
      router.replace('/complete-profile');
    }
  }, [user, router]);

  // Load real-time GPS, nearby hotspot zones, and 7-day prediction
  const loadDashboardData = useCallback(async (isPull = false) => {
    if (isPull) {
      setIsRefreshing(true);
    } else {
      setIsLoadingData(true);
    }

    try {
      setIsLoadingLocation(true);
      let activeCoords = userLocation;

      const gpsRes = await locationService.getCurrentGpsLocation();
      if (gpsRes.success && gpsRes.location) {
        activeCoords = {
          lat: gpsRes.location.lat,
          lon: gpsRes.location.lon,
          name: gpsRes.location.name,
          isRealtime: true,
        };
        setUserLocation(activeCoords);
      }
      setIsLoadingLocation(false);

      // 1. Scrape real-time nearby hotspots (traffic, pollution, weather, transit) for the interactive map
      const nearbyRes = await mapScraperService.scrapeRealtimeRegion(
        activeCoords.lat,
        activeCoords.lon,
        10,
        activeCoords.name
      );
      if (nearbyRes && nearbyRes.nearby_zones) {
        setNearbyZones(nearbyRes.nearby_zones);
      }

      // 2. Fetch dynamic weather, AQI, and impact analysis
      const analysisRes = await zonesApi.getWeeklyAnalysis({
        lat: activeCoords.lat,
        lon: activeCoords.lon,
        name: activeCoords.name,
      });
      setAnalysisData(analysisRes);

      // 3. Fetch data riil durasi di jalan hari ini & paparan polusi dari aurabackend
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const mobilityRes = await mobilityService.getDailyAnalysis(todayStr, user?.uid);
        if (mobilityRes && mobilityRes.stats) {
          setMobilityStats(mobilityRes.stats);
        } else {
          // Hitung dari waypoints in-memory GPS yang telah terkumpul secara riil
          const collected = backgroundMobilityTracker.getCollectedWaypoints();
          let outdoor = 0;
          let indoor = 0;
          collected.forEach((wp) => {
            if (wp.classification === 'indoor' || wp.is_stay) {
              indoor += wp.duration_minutes;
            } else {
              outdoor += wp.duration_minutes;
            }
          });

          setMobilityStats({
            total_outdoor_minutes: outdoor,
            total_indoor_minutes: indoor,
            average_outdoor_aqi: 0,
            average_outdoor_pm25: 0,
            max_aqi: 0,
            worst_area_name: '-',
            worst_area_aqi: 0,
            waypoints_processed: collected.length,
          });
        }
      } catch {
        // Jika offline atau belum ada data di backend, gunakan data in-memory aktual dari GPS tracker
        const collected = backgroundMobilityTracker.getCollectedWaypoints();
        let outdoor = 0;
        let indoor = 0;
        collected.forEach((wp) => {
          if (wp.classification === 'indoor' || wp.is_stay) {
            indoor += wp.duration_minutes;
          } else {
            outdoor += wp.duration_minutes;
          }
        });

        setMobilityStats({
          total_outdoor_minutes: outdoor,
          total_indoor_minutes: indoor,
          average_outdoor_aqi: 0,
          average_outdoor_pm25: 0,
          max_aqi: 0,
          worst_area_name: '-',
          worst_area_aqi: 0,
          waypoints_processed: collected.length,
        });
      }
    } catch (err: any) {
      console.warn('[Dashboard] Error fetching dynamic dashboard data:', err);
    } finally {
      setIsLoadingData(false);
      setIsRefreshing(false);
      setIsLoadingLocation(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleLogout = async () => {
    Alert.alert('Konfirmasi Logout', 'Apakah Anda yakin ingin keluar dari akun Aura?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluar',
        style: 'destructive',
        onPress: async () => {
          setIsLoggingOut(true);
          try {
            await logout();
            setShowAccountModal(false);
          } finally {
            setIsLoggingOut(false);
          }
        },
      },
    ]);
  };

  const insets = useSafeAreaInsets();
  const topPadding =
    Platform.OS === 'android'
      ? (StatusBar.currentHeight || 24) + 12
      : Math.max(insets.top, 12);

  // Dynamic Today Weather & Air Quality Calculation
  const todayForecast: DailyForecast | undefined = analysisData?.daily_forecast?.[0];
  const aqiValue = todayForecast
    ? Math.round(
        todayForecast.predicted_aqi > 0
          ? todayForecast.predicted_aqi
          : todayForecast.health_risk_score
      )
    : 146;
  const tempValue = todayForecast
    ? Math.round(
        todayForecast.temperature_c ??
          (todayForecast as any).temperature ??
          (33 - (todayForecast.precipitation_mm > 0.5 ? 4 : 0))
      )
    : 33;
  const isRainy = (todayForecast?.precipitation_mm ?? 0) > 0.5;
  const isCloudy =
    (todayForecast?.humidity_percent ?? 0) > 70 ||
    (todayForecast?.dispersion_condition ?? '').toLowerCase().includes('normal');
  const isSmoky =
    (todayForecast?.weather_condition ?? '').toLowerCase().includes('asap') ||
    (todayForecast?.dispersion_condition ?? '').toLowerCase().includes('asap') ||
    (todayForecast?.dispersion_condition ?? '').toLowerCase().includes('haze');

  const weatherCondition =
    todayForecast?.weather_condition ||
    (isRainy ? 'Hujan' : isSmoky ? 'Berasap' : isCloudy ? 'Berawan' : 'Cerah');
  const impactLevelValue: ImpactLevel = todayForecast?.impact_level || 'Waspada';

  const ringColors = getImpactRingColors(impactLevelValue);

  const [transitionSplash, setTransitionSplash] = useState<{
    visible: boolean;
    message: string;
  }>({ visible: false, message: '' });

  const navigateToPollutionMap = () => {
    setTransitionSplash({
      visible: true,
      message: 'Membuka Peta Analisis Penyakit...',
    });
    setTimeout(() => {
      router.push({
        pathname: '/pollution-impact',
        params: {
          lat: userLocation.lat.toString(),
          lon: userLocation.lon.toString(),
          name: userLocation.name,
          mode: 'map',
        },
      });
      setTimeout(() => {
        setTransitionSplash({ visible: false, message: '' });
      }, 600);
    }, 450);
  };

  const navigateTo7DayForecast = () => {
    setTransitionSplash({
      visible: true,
      message: 'Menyiapkan Prakiraan Cuaca 7 Hari...',
    });
    setTimeout(() => {
      router.push({
        pathname: '/pollution-impact',
        params: {
          lat: userLocation.lat.toString(),
          lon: userLocation.lon.toString(),
          name: userLocation.name,
          mode: 'forecast',
        },
      });
      setTimeout(() => {
        setTransitionSplash({ visible: false, message: '' });
      }, 600);
    }, 450);
  };

  const navigateToPollutionImpact = (customMessage?: unknown) => {
    navigateTo7DayForecast();
  };

  // ─── Durasi di Luar Ruangan (Riil atau Simulasi Menit untuk Testing) ───
  const outdoorMinutes =
    simulatedMinutes !== null
      ? simulatedMinutes
      : mobilityStats
        ? mobilityStats.total_outdoor_minutes
        : 0;

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        style={{ flex: 1, backgroundColor: '#FFFFFF' }}
        contentContainerStyle={{ paddingTop: 0, paddingBottom: 50 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadDashboardData(true)}
            tintColor="#0284C7"
          />
        }
      >
        {/* 1. TOP DYNAMIC MAP CARD WITH SEARCH BAR & REAL-TIME HOTSPOTS */}
        <SemarangMapCard
          userLocation={userLocation}
          nearbyZones={nearbyZones}
          isLoading={isLoadingLocation}
          onSearchPress={() => setIsMapFullscreen(true)}
          onMapPress={() => setIsMapFullscreen(true)}
          onBannerPress={() => setShowSimulateModal(true)}
          onProfilePress={() => setShowAccountModal(true)}
          userName={user?.name || 'FREYA JAWANTARA'}
          outdoorMinutes={outdoorMinutes}
        />

        {/* 2. SWIPEABLE FEATURE NAVIGATION ITEMS (BELOW MAP) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            gap: 14,
            alignItems: 'flex-start',
          }}
          style={{ marginTop: 18 }}
        >
          {/* 1. Cek Kesehatan Paru (Fitur AI Respirasi) */}
          <Pressable
            onPress={() => router.push('/lung-check')}
            style={({ pressed }) => [
              {
                alignItems: 'center',
                width: 92,
                opacity: pressed ? 0.78 : 1,
                transform: [{ scale: pressed ? 0.95 : 1 }],
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Cek Kesehatan Paru"
            hitSlop={6}
          >
            <Image
              source={require('@/assets/homepage/Group 723.png')}
              style={{ width: 76, height: 76 }}
              contentFit="contain"
            />
            <Text
              style={{
                color: '#1E293B',
                fontSize: 11.5,
                fontWeight: '700',
                textAlign: 'center',
                marginTop: 6,
                lineHeight: 15,
              }}
            >
              Cek Kesehatan{'\n'}Paru
            </Text>
          </Pressable>

          {/* 2. Skin Analyst (Fitur AI Dermal VLM) */}
          <Pressable
            onPress={() => router.push('/skin-check')}
            style={({ pressed }) => [
              {
                alignItems: 'center',
                width: 92,
                opacity: pressed ? 0.78 : 1,
                transform: [{ scale: pressed ? 0.95 : 1 }],
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Skin Analyst"
            hitSlop={6}
          >
            <Image
              source={require('@/assets/homepage/skin_analyst_icon.png')}
              style={{ width: 76, height: 76 }}
              contentFit="contain"
            />
            <Text
              style={{
                color: '#1E293B',
                fontSize: 11.5,
                fontWeight: '700',
                textAlign: 'center',
                marginTop: 6,
                lineHeight: 15,
              }}
            >
              Skin{'\n'}Analyst
            </Text>
          </Pressable>

          {/* 3. Peta Analisis Penyakit (Peta 3D & Open Data Dinkes) */}
          <Pressable
            onPress={navigateToPollutionMap}
            style={({ pressed }) => [
              {
                alignItems: 'center',
                width: 104,
                opacity: pressed ? 0.78 : 1,
                transform: [{ scale: pressed ? 0.95 : 1 }],
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Peta Analisis Penyakit"
            hitSlop={6}
          >
            <Image
              source={require('@/assets/homepage/Group 724.png')}
              style={{ width: 76, height: 76 }}
              contentFit="contain"
            />
            <Text
              style={{
                color: '#1E293B',
                fontSize: 11,
                fontWeight: '700',
                textAlign: 'center',
                marginTop: 6,
                lineHeight: 14,
              }}
            >
              Peta Analisis{'\n'}Penyakit
            </Text>
          </Pressable>

          {/* 4. Prakiraan 7 Hari (AI Cuaca & Polusi) */}
          <Pressable
            onPress={navigateTo7DayForecast}
            style={({ pressed }) => [
              {
                alignItems: 'center',
                width: 96,
                opacity: pressed ? 0.78 : 1,
                transform: [{ scale: pressed ? 0.95 : 1 }],
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Prakiraan 7 Hari"
            hitSlop={6}
          >
            <Svg width={76} height={76} viewBox="0 0 76 76" fill="none">
              <Defs>
                <SvgLinearGradient id="f7Bg" x1="10" y1="4" x2="66" y2="74" gradientUnits="userSpaceOnUse">
                  <Stop offset="0" stopColor="#EFF8FF" />
                  <Stop offset="0.52" stopColor="#93D5FB" />
                  <Stop offset="1" stopColor="#3B82F6" />
                </SvgLinearGradient>
              </Defs>
              {/* Squircle backdrop matching Group 723/724/725 */}
              <Rect x="0" y="0" width="76" height="76" rx="20" fill="url(#f7Bg)" />
              {/* Decorative top-right ring arc */}
              <Circle
                cx="66"
                cy="12"
                r="22"
                stroke="#60A5FA"
                strokeOpacity="0.45"
                strokeWidth="7"
              />
              {/* Warm Sun */}
              <Circle cx="26" cy="24" r="10.5" fill="#FDE047" />
              <Circle cx="26" cy="24" r="7.5" fill="#FACC15" />
              {/* Soft White Weather Cloud */}
              <Path
                d="M17 42.5C13.6 42.5 11 39.9 11 36.7C11 33.8 13.1 31.4 15.9 30.9C16.9 26.6 20.8 23.5 25.3 23.5C29.4 23.5 33 26.1 34.3 29.8C35.2 29.3 36.2 29 37.3 29C40.9 29 43.8 31.9 43.8 35.5C45.3 36.4 46.2 38 46.2 39.8C46.2 42.4 44.1 44.5 41.5 44.5H17V42.5Z"
                fill="#FFFFFF"
              />
              {/* Tilted Mini 7-Day Forecast Calendar Badge (bottom-right) */}
              <Rect
                x="35"
                y="37"
                width="31"
                height="29"
                rx="7.5"
                fill="#FFFFFF"
                stroke="#BFDBFE"
                strokeWidth="1.2"
              />
              <Rect x="35" y="37" width="31" height="9" rx="4.5" fill="#1E40AF" />
              <Rect x="41" y="34" width="3.2" height="6" rx="1.6" fill="#38BDF8" />
              <Rect x="57" y="34" width="3.2" height="6" rx="1.6" fill="#38BDF8" />
              {/* 7-day status pills inside calendar */}
              <Rect x="39.5" y="50" width="6" height="4.5" rx="1.5" fill="#10B981" />
              <Rect x="47.5" y="50" width="6" height="4.5" rx="1.5" fill="#38BDF8" />
              <Rect x="55.5" y="50" width="6" height="4.5" rx="1.5" fill="#F59E0B" />
              <Rect x="39.5" y="57.5" width="6" height="4.5" rx="1.5" fill="#38BDF8" />
              <Rect x="47.5" y="57.5" width="6" height="4.5" rx="1.5" fill="#10B981" />
              <Rect x="55.5" y="57.5" width="6" height="4.5" rx="1.5" fill="#60A5FA" />
            </Svg>
            <Text
              style={{
                color: '#1E293B',
                fontSize: 11,
                fontWeight: '700',
                textAlign: 'center',
                marginTop: 6,
                lineHeight: 14,
              }}
            >
              Prakiraan{'\n'}7 Hari
            </Text>
          </Pressable>

          {/* 5. Mulai Periksa (Navigasi ke Dokter & Rumah Sakit Mitra) */}
          <Pressable
            onPress={() => router.push('/ceksekarang')}
            style={({ pressed }) => [
              {
                alignItems: 'center',
                width: 92,
                opacity: pressed ? 0.78 : 1,
                transform: [{ scale: pressed ? 0.95 : 1 }],
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Mulai Periksa Dokter"
            hitSlop={6}
          >
            <Image
              source={require('@/assets/homepage/Group 725.png')}
              style={{ width: 76, height: 76 }}
              contentFit="contain"
            />
            <Text
              style={{
                color: '#1E293B',
                fontSize: 11.5,
                fontWeight: '700',
                textAlign: 'center',
                marginTop: 6,
                lineHeight: 15,
              }}
            >
              Mulai{'\n'}Periksa
            </Text>
          </Pressable>
        </ScrollView>

        {/* 3. DYNAMIC STATUS HORIZONTAL CAROUSEL CARDS */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
          style={{ marginTop: 22 }}
        >
          {/* Card 1: Kualitas Udara (Dynamic AQI & Gradient) */}
          <Pressable
            onPress={navigateToPollutionImpact}
            style={{
              width: 175,
              height: 245,
              borderRadius: 28,
              overflow: 'hidden',
              backgroundColor: '#F59E0B',
              shadowColor: '#F59E0B',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 10,
              elevation: 5,
            }}
          >
            <LinearGradient
              colors={getAqiGradient(aqiValue)}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={{ width: '100%', height: '100%', padding: 16, position: 'relative' }}
            >
              {/* Cloud Decorations (PNG) */}
              <Image
                source={require('@/assets/homepage/basil_cloud-solid.png')}
                style={{ width: 44, height: 32, position: 'absolute', top: 12, left: 12 }}
                contentFit="contain"
              />
              <Image
                source={require('@/assets/homepage/si_cloud-fill.png')}
                style={{ width: 38, height: 28, position: 'absolute', top: 32, right: 12 }}
                contentFit="contain"
              />

              {/* Sparkle Stars */}
              <Ionicons
                name="sparkles"
                size={9}
                color="#FFFFFF"
                style={{ position: 'absolute', top: 22, left: 95 }}
              />
              <Ionicons
                name="sparkles"
                size={11}
                color="#FFFFFF"
                style={{ position: 'absolute', top: 62, left: 24 }}
              />

              {/* Smoke Graphic at Bottom (Asap 2.png) */}
              <Image
                source={require('@/assets/homepage/Asap 2.png')}
                style={{
                  position: 'absolute',
                  bottom: -4,
                  right: -30,
                  width: 210,
                  height: 112,
                }}
                contentFit="cover"
              />

              {/* Center Air Quality Content */}
              <View
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  alignItems: 'center',
                  zIndex: 10,
                  paddingTop: 10,
                }}
              >
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontSize: 13,
                    fontWeight: '600',
                    textAlign: 'center',
                    marginBottom: 2,
                    textShadowColor: 'rgba(0,0,0,0.15)',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 2,
                  }}
                >
                  Kualitas udara
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'baseline',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 48,
                      fontWeight: '900',
                      letterSpacing: -1.5,
                      textShadowColor: 'rgba(0,0,0,0.15)',
                      textShadowOffset: { width: 0, height: 1 },
                      textShadowRadius: 3,
                    }}
                  >
                    {aqiValue}
                  </Text>
                  <Text
                    style={{
                      color: '#FFFFFF',
                      opacity: 0.9,
                      fontSize: 11,
                      fontWeight: '700',
                      marginLeft: 4,
                      marginBottom: 5,
                    }}
                  >
                    AQI (US)
                  </Text>
                </View>
                {isLoadingData && (
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginTop: 4 }} />
                )}
              </View>
            </LinearGradient>
          </Pressable>

          {/* Card 2: Cuaca Saat Ini (Dynamic Suhu, Kondisi, & Icon) */}
          <Pressable
            onPress={navigateToPollutionImpact}
            style={{
              width: 175,
              height: 245,
              borderRadius: 28,
              overflow: 'hidden',
              backgroundColor: '#2563EB',
              shadowColor: '#2563EB',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 10,
              elevation: 5,
            }}
          >
            <LinearGradient
              colors={getWeatherGradient(weatherCondition)}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={{ width: '100%', height: '100%', padding: 16, position: 'relative' }}
            >
              {/* Cloud Decorations (PNG) */}
              <Image
                source={require('@/assets/homepage/basil_cloud-solid.png')}
                style={{ width: 40, height: 30, position: 'absolute', top: 28, left: 12 }}
                contentFit="contain"
              />
              <Image
                source={require('@/assets/homepage/si_cloud-fill.png')}
                style={{ width: 52, height: 38, position: 'absolute', top: 14, right: 12 }}
                contentFit="contain"
              />

              {/* Weather Content with Dynamic Icon */}
              <View
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  alignItems: 'center',
                  zIndex: 10,
                }}
              >
                <Ionicons
                  name={isRainy ? 'rainy' : isSmoky ? 'cloudy' : isCloudy ? 'cloud' : 'sunny'}
                  size={24}
                  color={isRainy ? '#93C5FD' : isSmoky ? '#CBD5E1' : isCloudy ? '#E0F2FE' : '#FDE047'}
                  style={{ alignSelf: 'center', marginBottom: 6 }}
                />
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontSize: 13,
                    fontWeight: '600',
                    textAlign: 'center',
                    textShadowColor: 'rgba(0,0,0,0.15)',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 2,
                  }}
                >
                  Cuaca Saat Ini
                </Text>
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontSize: 48,
                    fontWeight: '900',
                    textAlign: 'center',
                    marginVertical: 1,
                    letterSpacing: -1.5,
                    textShadowColor: 'rgba(0,0,0,0.15)',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 3,
                  }}
                >
                  {tempValue}°C
                </Text>
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontSize: 14,
                    fontWeight: '700',
                    textAlign: 'center',
                  }}
                >
                  {weatherCondition}
                </Text>
              </View>
            </LinearGradient>
          </Pressable>

          {/* Card 3: Tingkat Kualitas (Dynamic Impact Level & Concentric Aura Rings) */}
          <Pressable
            onPress={navigateToPollutionImpact}
            style={{
              width: 175,
              height: 245,
              borderRadius: 28,
              overflow: 'hidden',
              backgroundColor: '#EF4444',
              shadowColor: '#EF4444',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 10,
              elevation: 5,
            }}
          >
            <LinearGradient
              colors={getImpactGradient(impactLevelValue)}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={{ width: '100%', height: '100%', padding: 16, position: 'relative' }}
            >
              {/* Concentric Aura Rings in Top-Left Corner matching impact level */}
              <View
                style={{
                  position: 'absolute',
                  top: -35,
                  left: -35,
                  width: 140,
                  height: 140,
                }}
              >
                <Svg width="140" height="140" viewBox="0 0 140 140">
                  <Circle cx="25" cy="25" r="70" fill={ringColors[0]} opacity={0.35} />
                  <Circle cx="25" cy="25" r="50" fill={ringColors[1]} opacity={0.55} />
                  <Circle cx="25" cy="25" r="30" fill={ringColors[2]} opacity={0.85} />
                </Svg>
              </View>

              {/* Quality Rating Content */}
              <View
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  alignItems: 'center',
                  zIndex: 10,
                  paddingTop: 16,
                }}
              >
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontSize: 13,
                    fontWeight: '600',
                    textAlign: 'center',
                    textShadowColor: 'rgba(0,0,0,0.15)',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 2,
                  }}
                >
                  Tingkat Kualitas
                </Text>
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontSize: 34,
                    fontWeight: '900',
                    textAlign: 'center',
                    marginTop: 6,
                    letterSpacing: -0.5,
                    textShadowColor: 'rgba(0,0,0,0.15)',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 3,
                  }}
                >
                  {impactLevelValue}
                </Text>
                {todayForecast?.traffic_severity && (
                  <Text
                    style={{
                      color: 'rgba(255, 255, 255, 0.9)',
                      fontSize: 11,
                      fontWeight: '700',
                      marginTop: 4,
                      textAlign: 'center',
                    }}
                  >
                    Macet: {todayForecast.traffic_severity}
                  </Text>
                )}
              </View>
            </LinearGradient>
          </Pressable>
        </ScrollView>

        {/* 4. SOLUTION / MEDICINE BANNER (Obat 1.png) -> Kebutuhan Harian */}
        <Pressable
          onPress={() => router.push('/kebutuhan-harian' as any)}
          style={{
            marginHorizontal: 16,
            marginTop: 22,
            borderRadius: 16,
            overflow: 'hidden',
            shadowColor: '#2563EB',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.18,
            shadowRadius: 10,
            elevation: 4,
          }}
        >
          <LinearGradient
            colors={['#38BDF8', '#2563EB', '#1D4ED8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            {/* Pills Image */}
            <Image
              source={require('@/assets/homepage/Obat 1.png')}
              style={{ width: 68, height: 68 }}
              contentFit="contain"
            />

            {/* Middle text */}
            <Text
              style={{
                color: '#FFFFFF',
                fontWeight: '700',
                fontSize: 13,
                flex: 1,
                marginHorizontal: 10,
                lineHeight: 18,
              }}
            >
              Jangan lupa untuk cek kebutuhan kamu, menghadapi solusi!
            </Text>

            {/* Cek Button */}
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 999,
                paddingHorizontal: 20,
                paddingVertical: 7,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                elevation: 2,
              }}
            >
              <Text style={{ color: '#1E293B', fontWeight: '700', fontSize: 12 }}>Cek</Text>
            </View>
          </LinearGradient>
        </Pressable>

        {/* 5. DOCTOR RECOMMENDATION CARD (drbunga.png) - Doctor image over the top of card */}
        <View
          style={{
            marginHorizontal: 16,
            marginTop: 48,
            backgroundColor: '#FFFFFF',
            borderWidth: 1.5,
            borderColor: '#60A5FA',
            borderRadius: 20,
            paddingVertical: 18,
            paddingRight: 16,
            paddingLeft: 132,
            minHeight: 132,
            justifyContent: 'center',
            position: 'relative',
            shadowColor: '#3B82F6',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 6,
            elevation: 2,
          }}
        >
          {/* Doctor Photo - Extending over the top of the card */}
          <Image
            source={require('@/assets/homepage/drbunga.png')}
            style={{
              position: 'absolute',
              bottom: 0,
              left: -23,
              width: 185,
              height: 172,
            }}
            contentFit="contain"
          />

          {/* Doctor Info */}
          <View style={{ justifyContent: 'center' }}>
            <Text
              style={{
                color: '#1E293B',
                fontSize: 18,
                fontWeight: '800',
                letterSpacing: -0.3,
              }}
            >
              dr. Apung Setiawati
            </Text>
            <Text style={{ color: '#64748B', fontSize: 13, fontWeight: '500', marginTop: 3 }}>
              Kedokteran Umum
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14 }}>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/doctor-reservation',
                    params: { doctorId: 'dr-apung' },
                  })
                }
                style={{
                  backgroundColor: '#2563EB',
                  borderRadius: 999,
                  paddingHorizontal: 26,
                  paddingVertical: 8,
                  shadowColor: '#2563EB',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.25,
                  shadowRadius: 4,
                  elevation: 2,
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>Detail</Text>
              </Pressable>

              <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 16, gap: 5 }}>
                <Ionicons name="thumbs-up" size={16} color="#2563EB" />
                <Text style={{ color: '#2563EB', fontSize: 13, fontWeight: '700' }}>100%</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 6. ACCOUNT & LOGOUT CARD ON DASHBOARD */}
        <View
          style={{
            marginHorizontal: 16,
            marginTop: 22,
            backgroundColor: '#F8FAFC',
            borderRadius: 18,
            padding: 14,
            borderWidth: 1,
            borderColor: '#E2E8F0',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <Pressable
            onPress={() => setShowAccountModal(true)}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: '#EFF6FF',
                borderWidth: 1,
                borderColor: '#BFDBFE',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="person" size={18} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: '800', color: '#0F172A' }}>
                {user?.name || 'Pengguna AURA'}
              </Text>
              <Text numberOfLines={1} style={{ fontSize: 11.5, color: '#64748B', marginTop: 1 }}>
                {user?.email || 'Ketuk untuk detail profil'}
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={handleLogout}
            disabled={isLoggingOut}
            accessibilityRole="button"
            accessibilityLabel="Logout"
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: pressed ? '#FFE4E6' : '#FFF1F2',
              borderWidth: 1,
              borderColor: '#FECDD3',
              paddingHorizontal: 14,
              paddingVertical: 9,
              borderRadius: 999,
            })}
          >
            {isLoggingOut ? (
              <ActivityIndicator size="small" color="#E11D48" />
            ) : (
              <>
                <Ionicons name="log-out-outline" size={16} color="#E11D48" />
                <Text style={{ color: '#E11D48', fontSize: 12.5, fontWeight: '800' }}>
                  Logout
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>

      {/* ACCOUNT & PROFILE MODAL */}
      <Modal
        visible={showAccountModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAccountModal(false)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '85%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="person" size={20} color={AuraColors.primary} />
                </View>
                <View>
                  <Text style={{ color: '#1E293B', fontSize: 16, fontWeight: '700' }}>
                    {user?.name || 'Pengguna Aura'}
                  </Text>
                  <Text style={{ color: '#64748B', fontSize: 12 }}>{user?.email || '-'}</Text>
                </View>
              </View>
              <Pressable
                onPress={() => setShowAccountModal(false)}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="close" size={18} color="#64748B" />
              </Pressable>
            </View>

            <ScrollView style={{ marginVertical: 16 }} showsVerticalScrollIndicator={false}>
              <Text style={{ color: '#1E293B', fontSize: 14, fontWeight: '700', marginBottom: 12 }}>
                Data Profil Pengguna
              </Text>

              <View style={{ backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F1F5F9' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}>
                  <Text style={{ color: '#64748B', fontSize: 12 }}>Usia</Text>
                  <Text style={{ color: '#1E293B', fontSize: 12, fontWeight: '700' }}>
                    {user?.usia !== undefined && user?.usia !== null ? `${user.usia} tahun` : '-'}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}>
                  <Text style={{ color: '#64748B', fontSize: 12 }}>Tinggi Badan</Text>
                  <Text style={{ color: '#1E293B', fontSize: 12, fontWeight: '700' }}>
                    {user?.tinggi_badan !== undefined && user?.tinggi_badan !== null
                      ? `${user.tinggi_badan} cm`
                      : '-'}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}>
                  <Text style={{ color: '#64748B', fontSize: 12 }}>Berat Badan</Text>
                  <Text style={{ color: '#1E293B', fontSize: 12, fontWeight: '700' }}>
                    {user?.berat_badan !== undefined && user?.berat_badan !== null
                      ? `${user.berat_badan} kg`
                      : '-'}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                  <Text style={{ color: '#64748B', fontSize: 12 }}>Waktu di Jalan</Text>
                  <Text style={{ color: '#1E293B', fontSize: 12, fontWeight: '700' }}>
                    {user?.waktu_di_jalan !== undefined && user?.waktu_di_jalan !== null
                      ? `${user.waktu_di_jalan} jam/hari`
                      : '-'}
                  </Text>
                </View>
              </View>

              {/* Action: Ubah Profil */}
              <Pressable
                onPress={() => {
                  setShowAccountModal(false);
                  router.push('/complete-profile');
                }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', paddingVertical: 12, borderRadius: 12, marginTop: 16 }}
              >
                <Ionicons name="create-outline" size={16} color={AuraColors.primary} />
                <Text style={{ color: AuraColors.primary, fontSize: 12, fontWeight: '700' }}>
                  Ubah Profil Tentang Kamu
                </Text>
              </Pressable>

              {/* Action: Logout */}
              <Pressable
                onPress={handleLogout}
                disabled={isLoggingOut}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FFF1F2', borderWidth: 1, borderColor: '#FECDD3', paddingVertical: 12, borderRadius: 12, marginTop: 16 }}
              >
                {isLoggingOut ? (
                  <ActivityIndicator size="small" color="#E11D48" />
                ) : (
                  <>
                    <Ionicons name="log-out-outline" size={16} color="#E11D48" />
                    <Text style={{ color: '#E11D48', fontSize: 12, fontWeight: '700' }}>
                      Keluar Akun
                    </Text>
                  </>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Fullscreen Interactive Semarang Map Modal */}
      <FullscreenSemarangMapModal
        visible={isMapFullscreen}
        userLocation={userLocation}
        onClose={() => setIsMapFullscreen(false)}
      />

      {/* Modal Simulasi Menit Durasi Luar Ruangan (Mode Pengujian & Testing) */}
      <Modal
        visible={showSimulateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSimulateModal(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            justifyContent: 'flex-end',
          }}
          onPress={() => setShowSimulateModal(false)}
        >
          <Pressable
            style={{
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              paddingBottom: Platform.OS === 'ios' ? 40 : 24,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <View>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A' }}>
                  Aktivitas Luar Ruangan
                </Text>
                <Text style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                  Durasi saat ini:{' '}
                  <Text style={{ fontWeight: '800', color: '#1E6CEF' }}>
                    {outdoorMinutes >= 60
                      ? `${(outdoorMinutes / 60).toFixed(1).replace(/\.0$/, '')} jam (${outdoorMinutes} mnt)`
                      : `${outdoorMinutes} menit`}
                  </Text>
                </Text>
              </View>

              <Pressable
                onPress={() => setShowSimulateModal(false)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: '#F1F5F9',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>

            {/* Subtitle & Quick Options */}
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: '#475569',
                marginBottom: 10,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Pilih Simulasi Menit (Testing Mode)
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {[
                { label: '0 mnt (Reset)', mins: 0 },
                { label: '15 mnt', mins: 15 },
                { label: '30 mnt', mins: 30 },
                { label: '45 mnt', mins: 45 },
                { label: '60 mnt (1 jam)', mins: 60 },
                { label: '90 mnt (1.5 jam)', mins: 90 },
                { label: '120 mnt (2 jam)', mins: 120 },
              ].map((opt) => {
                const isSelected = outdoorMinutes === opt.mins;
                return (
                  <Pressable
                    key={opt.mins}
                    onPress={() => {
                      setSimulatedMinutes(opt.mins);
                    }}
                    style={{
                      paddingVertical: 9,
                      paddingHorizontal: 14,
                      borderRadius: 14,
                      backgroundColor: isSelected ? '#1E6CEF' : '#F8FAFC',
                      borderWidth: 1.5,
                      borderColor: isSelected ? '#1E6CEF' : '#E2E8F0',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '700',
                        color: isSelected ? '#FFFFFF' : '#334155',
                      }}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* AI Diagnosis Action Button */}
            <Pressable
              onPress={() => {
                setShowSimulateModal(false);
                setTransitionSplash({
                  visible: true,
                  message: 'Menghubungkan ke Dokter Paru AI...',
                });
                setTimeout(() => {
                  router.push({
                    pathname: '/ai-pollution-impact' as any,
                    params: {
                      lat: userLocation.lat.toString(),
                      lon: userLocation.lon.toString(),
                      name: userLocation.name,
                      average_risk_score: todayForecast
                        ? String(Math.round(todayForecast.health_risk_score))
                        : '68',
                      outdoor_minutes: outdoorMinutes.toString(),
                    },
                  });
                  setTimeout(() => {
                    setTransitionSplash({ visible: false, message: '' });
                  }, 600);
                }, 450);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#1E6CEF',
                paddingVertical: 14,
                borderRadius: 16,
                gap: 8,
                shadowColor: '#1E6CEF',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              <Ionicons name="sparkles" size={18} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontSize: 14.5, fontWeight: '700' }}>
                Lihat Diagnosa Dokter Paru AI ({outdoorMinutes} mnt)
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Page Transition Splash Animation */}
      <PageTransitionSplash
        visible={transitionSplash.visible}
        message={transitionSplash.message}
      />
    </SafeAreaView>
  );
}

