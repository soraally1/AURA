/**
 * Universal Navigation Screen
 * Navigate to any destination with turn-by-turn directions, GPS guidance, and health warnings.
 * Free mapping: OpenStreetMap + MapLibre WebView (no Google Maps API key / never black screen)
 * Road dataset: Powered by extracted Semarang GeoPackage (semarang.gpkg -> 11,800+ roads & POIs).
 */

import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  OsmMapView,
  OsmMapViewHandle,
  OsmMarkerItem,
  OsmPolylineItem,
} from '@/components/map/OsmMapView';
import { navigationService } from '@/services/navigationService';
import { backgroundMobilityTracker } from '@/services/backgroundMobilityTracker';
import {
  findNearestSemarangRoad,
  haversineMeters,
  highwayTypeLabel,
  searchSemarangRoads,
} from '@/services/semarangRoadService';
import { useNavigationStore } from '@/stores/navigationStore';
import { HealthWarning, MapMarker, RouteStep } from '@/types/navigation';

interface SearchDestinationItem {
  name: string;
  subtitle?: string;
  lat: number;
  lon: number;
  source?: 'gpkg' | 'osm';
}

const POPULAR_SEMARANG_POIS: SearchDestinationItem[] = [
  { name: 'Kawasan POJ City (Pearl of Java)', subtitle: 'Kawasan Pesisir • Marina Semarang', lat: -6.9472, lon: 110.3882, source: 'gpkg' },
  { name: 'Pantai Marina Semarang', subtitle: 'Wisata Pesisir • Semarang Barat', lat: -6.9488, lon: 110.3895, source: 'gpkg' },
  { name: 'RSUP Dr. Kariadi', subtitle: 'Rumah Sakit • Semarang Selatan', lat: -7.0015, lon: 110.4128, source: 'gpkg' },
  { name: 'Simpang Lima Semarang', subtitle: 'Pusat Kota • Semarang Tengah', lat: -6.9904, lon: 110.4227, source: 'gpkg' },
  { name: 'Lawang Sewu', subtitle: 'Landmark • Tugu Muda', lat: -6.9839, lon: 110.4104, source: 'gpkg' },
  { name: 'Stadion Jatidiri', subtitle: 'Olahraga • Gajahmungkur', lat: -7.021, lon: 110.4074, source: 'gpkg' },
  { name: 'Kelenteng Sam Poo Kong', subtitle: 'Wisata • Semarang Barat', lat: -6.9965, lon: 110.3985, source: 'gpkg' },
  { name: 'Kota Lama Semarang', subtitle: 'Kawasan Bersejarah • Semarang Utara', lat: -6.9682, lon: 110.4281, source: 'gpkg' },
  { name: 'Bandara Ahmad Yani', subtitle: 'Bandara • Semarang Barat', lat: -6.9749, lon: 110.3789, source: 'gpkg' },
];

export default function UniversalNavigationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    destLat?: string;
    destLon?: string;
    destName?: string;
  }>();

  const navigationStore = useNavigationStore();
  const mapViewRef = useRef<OsmMapViewHandle>(null);
  const locationWatcherRef = useRef<Location.LocationSubscription | null>(null);
  const initialParamHandledRef = useRef(false);

  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [osmResults, setOsmResults] = useState<SearchDestinationItem[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number }>({
    latitude: -6.9932,
    longitude: 110.4203,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedWarning, setSelectedWarning] = useState<HealthWarning | null>(null);
  const [showWarningDetail, setShowWarningDetail] = useState(false);
  const [showAllStepsModal, setShowAllStepsModal] = useState(false);
  const [destinationLabel, setDestinationLabel] = useState<string>('Tujuan Anda');

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/dashboard');
    }
  };

  // Fetch initial user location on mount
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const nextPos = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
          setUserLocation(nextPos);
          mapViewRef.current?.flyTo(nextPos.latitude, nextPos.longitude, 14);
        }
      } catch (err) {
        console.warn('[UniversalNav] Location permission note:', err);
      }
    })();

    return () => {
      if (locationWatcherRef.current) {
        locationWatcherRef.current.remove();
        locationWatcherRef.current = null;
      }
    };
  }, []);

  // Offline matches from extracted semarang.gpkg roads & POIs
  const localRoadSuggestions = useMemo<SearchDestinationItem[]>(() => {
    const q = searchQuery.trim();
    if (!q) return POPULAR_SEMARANG_POIS;

    const matchedPois = POPULAR_SEMARANG_POIS.filter((poi) =>
      poi.name.toLowerCase().includes(q.toLowerCase())
    );
    const roadMatches = searchSemarangRoads(q, 14).map((r) => ({
      name: r.n,
      subtitle: `${highwayTypeLabel(r.h)} • Data Jalan Semarang`,
      lat: r.lat,
      lon: r.lon,
      source: 'gpkg' as const,
    }));

    const seenNames = new Set(matchedPois.map((p) => p.name.toLowerCase()));
    const combined = [...matchedPois];
    for (const road of roadMatches) {
      if (!seenNames.has(road.name.toLowerCase())) {
        seenNames.add(road.name.toLowerCase());
        combined.push(road);
      }
    }
    return combined;
  }, [searchQuery]);

  // Combined suggestions: offline Semarang GPKG roads + optional Nominatim OSM matches
  const allSuggestions = useMemo(() => {
    if (osmResults.length === 0) return localRoadSuggestions;
    const seen = new Set(localRoadSuggestions.map((x) => x.name.toLowerCase()));
    const extra = osmResults.filter((r) => !seen.has(r.name.toLowerCase()));
    return [...localRoadSuggestions, ...extra];
  }, [localRoadSuggestions, osmResults]);

  // Nearest Semarang street to user's current coordinate
  const currentRoad = useMemo(
    () => findNearestSemarangRoad(userLocation.latitude, userLocation.longitude),
    [userLocation.latitude, userLocation.longitude]
  );

  // Free OpenStreetMap Nominatim lookup when user presses Search (never uses Google Geocoder)
  const handlePerformSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;

    setIsGeocoding(true);
    setShowSearchSuggestions(true);
    try {
      const searchStr = q.toLowerCase().includes('semarang')
        ? q
        : `${q}, Semarang`;
      const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=id&limit=6&q=${encodeURIComponent(
        searchStr
      )}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'AURA-HealthNav/1.0',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json)) {
          const mapped: SearchDestinationItem[] = json
            .map((item: any) => ({
              name: String(item.display_name || q).split(',')[0].trim(),
              subtitle: String(item.display_name || 'OpenStreetMap').slice(0, 65),
              lat: parseFloat(item.lat),
              lon: parseFloat(item.lon),
              source: 'osm' as const,
            }))
            .filter((x) => !isNaN(x.lat) && !isNaN(x.lon));
          setOsmResults(mapped);
        }
      }
    } catch (err) {
      console.warn('[UniversalNav] Nominatim search skipped, using offline Semarang road data:', err);
      setOsmResults([]);
    } finally {
      setIsGeocoding(false);
    }
  };

  // Handle route calculation
  const handleCalculateRoute = useCallback(
    async (destination: { name: string; lat: number; lon: number }) => {
      setIsLoading(true);
      setShowSearchSuggestions(false);
      setSearchQuery('');
      setOsmResults([]);
      setDestinationLabel(destination.name);

      try {
        let originLat = userLocation.latitude;
        let originLon = userLocation.longitude;

        // Pastikan menggunakan titik GPS perangkat terbaru sebelum menghitung rute
        try {
          const { status } = await Location.getForegroundPermissionsAsync();
          if (status === 'granted') {
            const freshLoc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
            });
            originLat = freshLoc.coords.latitude;
            originLon = freshLoc.coords.longitude;
            setUserLocation({ latitude: originLat, longitude: originLon });
            void backgroundMobilityTracker.recordGpsCoordinate(
              originLat,
              originLon,
              freshLoc.coords.accuracy ?? undefined
            );
          }
        } catch {
          // Gunakan userLocation terakhir bila GPS timeout
        }

        const route = await navigationService.calculateRoute(
          { latitude: originLat, longitude: originLon },
          { latitude: destination.lat, longitude: destination.lon },
          { avoid_tolls: true }
        );

        if (!route || !Array.isArray(route.coordinates) || route.coordinates.length < 2) {
          Alert.alert('Rute Tidak Ditemukan', 'Tidak dapat menghitung rute ke tujuan ini.');
          return;
        }

        navigationStore.setRoute(route);
        navigationStore.startNavigation();

        const routePts = route.coordinates.map(([lon, lat]) => ({
          latitude: lat,
          longitude: lon,
        }));
        mapViewRef.current?.fitBounds(routePts, 80);
      } catch (err: any) {
        Alert.alert(
          'Gagal Menghitung Rute',
          err?.message || 'Periksa koneksi internet Anda atau coba tujuan di area Semarang.'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [navigationStore, userLocation.latitude, userLocation.longitude]
  );

  // Auto-trigger route if navigated with explicit destination query params
  useEffect(() => {
    if (initialParamHandledRef.current) return;
    if (params.destLat && params.destLon) {
      const lat = parseFloat(params.destLat);
      const lon = parseFloat(params.destLon);
      if (!isNaN(lat) && !isNaN(lon)) {
        initialParamHandledRef.current = true;
        const timer = setTimeout(() => {
          void handleCalculateRoute({
            name: params.destName || 'Tujuan Terpilih',
            lat,
            lon,
          });
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, [params.destLat, params.destLon, params.destName, handleCalculateRoute]);

  // Turn-by-Turn GPS Watcher during active navigation
  useEffect(() => {
    if (!navigationStore.isNavigating || !navigationStore.activeRoute) {
      if (locationWatcherRef.current) {
        locationWatcherRef.current.remove();
        locationWatcherRef.current = null;
      }
      return;
    }

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        locationWatcherRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 2000,
            distanceInterval: 5,
          },
          (loc) => {
            const currentPos = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            };
            setUserLocation(currentPos);
            void backgroundMobilityTracker.recordGpsCoordinate(
              loc.coords.latitude,
              loc.coords.longitude,
              loc.coords.accuracy ?? undefined
            );

            navigationStore.updatePosition({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              heading: loc.coords.heading || 0,
              accuracy_meters: loc.coords.accuracy || 10,
              timestamp: Date.now(),
            });

            const steps = navigationStore.activeRoute?.steps;
            const stepIdx = navigationStore.currentStepIndex;
            if (steps && steps[stepIdx]) {
              const step = steps[stepIdx];
              const distToEnd = haversineMeters(
                loc.coords.latitude,
                loc.coords.longitude,
                step.end_location.latitude,
                step.end_location.longitude
              );

              if (distToEnd <= 30 && stepIdx < steps.length - 1) {
                navigationStore.updateCurrentStep(stepIdx + 1);
              }
            }
          }
        );
      } catch (err) {
        console.warn('[UniversalNav] Watcher start error:', err);
      }
    })();

    return () => {
      if (locationWatcherRef.current) {
        locationWatcherRef.current.remove();
        locationWatcherRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigationStore.isNavigating, navigationStore.activeRoute?.route_id]);

  const handleStopNavigation = () => {
    Alert.alert('Akhiri Navigasi', 'Apakah Anda ingin mengakhiri sesi navigasi rute ini?', [
      { text: 'Lanjutkan', style: 'cancel' },
      {
        text: 'Akhiri',
        style: 'destructive',
        onPress: () => {
          navigationStore.clearRoute();
          if (locationWatcherRef.current) {
            locationWatcherRef.current.remove();
            locationWatcherRef.current = null;
          }
        },
      },
    ]);
  };

  const isNavigating = navigationStore.isNavigating && !!navigationStore.activeRoute;
  const currentStep =
    isNavigating && navigationStore.activeRoute?.steps
      ? navigationStore.activeRoute.steps[navigationStore.currentStepIndex]
      : null;
  const totalSteps = navigationStore.activeRoute?.steps?.length || 0;

  const topPadding =
    Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : insets.top + 8;

  const getManeuverIcon = (maneuver?: RouteStep['maneuver']) => {
    switch (maneuver) {
      case 'turn-left':
        return 'arrow-back';
      case 'turn-right':
        return 'arrow-forward';
      case 'uturn':
        return 'return-up-back';
      case 'roundabout':
        return 'sync';
      case 'arrive':
        return 'flag';
      default:
        return 'arrow-up';
    }
  };

  // Map overlays passed to OSM WebView MapLibre renderer
  const mapPolylines = useMemo<OsmPolylineItem[]>(() => {
    if (
      !isNavigating ||
      !Array.isArray(navigationStore.activeRoute?.coordinates) ||
      navigationStore.activeRoute!.coordinates.length < 2
    ) {
      return [];
    }
    return [
      {
        id: navigationStore.activeRoute!.route_id || 'active-route',
        color: '#1E6CEF',
        width: 6,
        coordinates: navigationStore.activeRoute!.coordinates.map(([lon, lat]) => ({
          latitude: lat,
          longitude: lon,
        })),
      },
    ];
  }, [isNavigating, navigationStore.activeRoute]);

  const mapMarkers = useMemo<OsmMarkerItem[]>(() => {
    if (!isNavigating || !navigationStore.activeRoute) return [];
    const list: OsmMarkerItem[] = [];
    const coords = navigationStore.activeRoute.coordinates;
    if (Array.isArray(coords) && coords.length > 0) {
      const last = coords[coords.length - 1];
      list.push({
        id: 'destination-pin',
        latitude: last[1],
        longitude: last[0],
        title: destinationLabel,
        color: '#EF4444',
        variant: 'pin',
      });
    }
    if (Array.isArray(navigationStore.mapMarkers)) {
      navigationStore.mapMarkers.forEach((m: MapMarker) => {
        list.push({
          id: m.marker_id,
          latitude: m.location.latitude,
          longitude: m.location.longitude,
          title: m.title,
          color: m.color || '#F59E0B',
          variant: 'alert',
        });
      });
    }
    return list;
  }, [isNavigating, navigationStore.activeRoute, navigationStore.mapMarkers, destinationLabel]);

  const handleMarkerPress = (markerId: string) => {
    const markerObj = navigationStore.mapMarkers?.find((m) => m.marker_id === markerId);
    if (!markerObj) return;
    const warning = navigationStore.healthWarnings?.find(
      (w) => w.warning_id === markerId || w.title === markerObj.title
    );
    if (warning) {
      setSelectedWarning(warning);
      setShowWarningDetail(true);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#E2E8F0' }}>
      <StatusBar barStyle="dark-content" />

      {/* OpenStreetMap / MapLibre GL Map (Zero Google Maps API key / Never Black) */}
      <OsmMapView
        ref={mapViewRef}
        style={{ flex: 1 }}
        initialCenter={userLocation}
        initialZoom={14}
        userLocation={userLocation}
        followUserLocation={isNavigating}
        polylines={mapPolylines}
        markers={mapMarkers}
        onMarkerPress={handleMarkerPress}
      />

      {/* Top Bar: Search Bar / Navigation Header */}
      {!isNavigating ? (
        <View
          style={{
            position: 'absolute',
            top: topPadding,
            left: 16,
            right: 16,
            zIndex: 100,
          }}
        >
          {/* Search Box */}
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 24,
              paddingHorizontal: 12,
              paddingVertical: 10,
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 1.5,
              borderColor: '#3B82F6',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.15,
              shadowRadius: 6,
              elevation: 4,
            }}
          >
            <Pressable
              onPress={handleBack}
              hitSlop={8}
              style={{ paddingRight: 6 }}
            >
              <Ionicons name="arrow-back" size={22} color="#1E293B" />
            </Pressable>

            <TextInput
              style={{
                flex: 1,
                fontSize: 14,
                color: '#1E293B',
                paddingVertical: 2,
              }}
              placeholder="Cari nama jalan / tujuan Semarang (GPKG)..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                setShowSearchSuggestions(true);
              }}
              onSubmitEditing={handlePerformSearch}
              returnKeyType="search"
              onFocus={() => setShowSearchSuggestions(true)}
            />

            {isGeocoding ? (
              <ActivityIndicator size="small" color="#1E6CEF" style={{ marginRight: 6 }} />
            ) : searchQuery.trim() ? (
              <Pressable onPress={handlePerformSearch} hitSlop={8} style={{ paddingHorizontal: 6 }}>
                <Ionicons name="search" size={20} color="#1E6CEF" />
              </Pressable>
            ) : null}

            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => {
                  setSearchQuery('');
                  setOsmResults([]);
                }}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </Pressable>
            )}
          </View>

          {/* Current Semarang Road Context Chip */}
          {!showSearchSuggestions && currentRoad && (
            <View
              style={{
                marginTop: 8,
                alignSelf: 'flex-start',
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(255,255,255,0.94)',
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderWidth: 1,
                borderColor: '#E2E8F0',
              }}
            >
              <Ionicons name="compass" size={14} color="#1E6CEF" style={{ marginRight: 6 }} />
              <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#0F172A' }}>
                Dekat {currentRoad.n}
              </Text>
            </View>
          )}

          {/* Search Suggestions Dropdown (Offline Semarang GPKG Roads + POIs + OSM) */}
          {showSearchSuggestions && allSuggestions.length > 0 && (
            <View
              style={{
                marginTop: 8,
                backgroundColor: '#FFFFFF',
                borderRadius: 16,
                maxHeight: 280,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 10,
                elevation: 5,
                borderWidth: 1,
                borderColor: '#E2E8F0',
                overflow: 'hidden',
              }}
            >
              <FlatList
                data={allSuggestions}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => handleCalculateRoute(item)}
                    style={({ pressed }) => [
                      {
                        paddingVertical: 11,
                        paddingHorizontal: 14,
                        borderBottomWidth: 1,
                        borderBottomColor: '#F1F5F9',
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: pressed ? '#F8FAFC' : '#FFFFFF',
                      },
                    ]}
                  >
                    <Ionicons
                      name={item.source === 'osm' ? 'globe-outline' : 'navigate-circle-outline'}
                      size={18}
                      color="#1E6CEF"
                      style={{ marginRight: 10 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, color: '#1E293B', fontWeight: '700' }}>
                        {item.name}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#64748B' }} numberOfLines={1}>
                        {item.subtitle || `${item.lat.toFixed(4)}, ${item.lon.toFixed(4)}`}
                      </Text>
                    </View>
                    <Ionicons name="arrow-forward" size={16} color="#94A3B8" />
                  </Pressable>
                )}
                keyExtractor={(item, index) => `${item.name}-${index}`}
              />
            </View>
          )}
        </View>
      ) : (
        /* Active Navigation Header Banner */
        <View
          style={{
            position: 'absolute',
            top: topPadding,
            left: 16,
            right: 16,
            backgroundColor: '#1E6CEF',
            borderRadius: 20,
            padding: 16,
            shadowColor: '#1E6CEF',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 5,
            zIndex: 100,
          }}
        >
          {currentStep ? (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <Ionicons name={getManeuverIcon(currentStep.maneuver) as any} size={26} color="#FFFFFF" />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }} numberOfLines={2}>
                    {currentStep.instruction}
                  </Text>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
                    Langkah {navigationStore.currentStepIndex + 1} dari {totalSteps} • {currentStep.distance_meters} m
                  </Text>
                </View>
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 12,
                  paddingTop: 10,
                  borderTopWidth: 1,
                  borderTopColor: 'rgba(255,255,255,0.2)',
                }}
              >
                <Pressable
                  disabled={navigationStore.currentStepIndex === 0}
                  onPress={() => navigationStore.updateCurrentStep(Math.max(0, navigationStore.currentStepIndex - 1))}
                  style={{ opacity: navigationStore.currentStepIndex === 0 ? 0.3 : 1, padding: 4 }}
                >
                  <Text style={{ fontSize: 12, color: '#FFFFFF', fontWeight: '600' }}>← Langkah Lalu</Text>
                </Pressable>

                <Pressable
                  onPress={() => setShowAllStepsModal(true)}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.25)',
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                    borderRadius: 12,
                  }}
                >
                  <Text style={{ fontSize: 11, color: '#FFFFFF', fontWeight: '700' }}>Semua Langkah</Text>
                </Pressable>

                <Pressable
                  disabled={navigationStore.currentStepIndex >= totalSteps - 1}
                  onPress={() => navigationStore.updateCurrentStep(Math.min(totalSteps - 1, navigationStore.currentStepIndex + 1))}
                  style={{ opacity: navigationStore.currentStepIndex >= totalSteps - 1 ? 0.3 : 1, padding: 4 }}
                >
                  <Text style={{ fontSize: 12, color: '#FFFFFF', fontWeight: '600' }}>Berikutnya →</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Rute siap. Mengikuti posisi GPS...</Text>
          )}
        </View>
      )}

      {/* Recenter GPS Floating Button */}
      <Pressable
        onPress={() => mapViewRef.current?.flyTo(userLocation.latitude, userLocation.longitude, 15)}
        style={{
          position: 'absolute',
          right: 16,
          bottom: isNavigating ? insets.bottom + 110 : insets.bottom + 24,
          width: 46,
          height: 46,
          borderRadius: 23,
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 6,
          elevation: 4,
          zIndex: 95,
        }}
      >
        <Ionicons name="locate" size={22} color="#1E6CEF" />
      </Pressable>

      {/* Bottom Floating Bar during Navigation */}
      {isNavigating && (
        <View
          style={{
            position: 'absolute',
            bottom: insets.bottom + 16,
            left: 16,
            right: 16,
            zIndex: 90,
          }}
        >
          {Array.isArray(navigationStore.healthWarnings) && navigationStore.healthWarnings.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 10 }}
            >
              {navigationStore.healthWarnings.map((warning) => (
                <Pressable
                  key={warning.warning_id}
                  onPress={() => {
                    setSelectedWarning(warning);
                    setShowWarningDetail(true);
                  }}
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 14,
                    padding: 12,
                    marginRight: 10,
                    width: 260,
                    borderLeftWidth: 4,
                    borderLeftColor: warning.color || '#EF4444',
                    shadowColor: '#000',
                    shadowOpacity: 0.1,
                    shadowRadius: 5,
                    elevation: 3,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E293B' }}>{warning.title}</Text>
                  <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }} numberOfLines={1}>
                    {warning.message}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 20,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <View>
              <Text style={{ fontSize: 12, color: '#64748B' }}>Total Rute ke {destinationLabel}</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E293B' }}>
                {((navigationStore.activeRoute?.distance_meters || 0) / 1000).toFixed(1)} km •{' '}
                {Math.round((navigationStore.activeRoute?.duration_seconds || 0) / 60)} menit
              </Text>
            </View>

            <Pressable
              onPress={handleStopNavigation}
              style={{
                backgroundColor: '#EF4444',
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 18,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Ionicons name="stop" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>Akhiri</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <View
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            marginLeft: -40,
            marginTop: -40,
            width: 80,
            height: 80,
            borderRadius: 20,
            backgroundColor: 'rgba(0,0,0,0.75)',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
          }}
        >
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      )}

      {/* All Steps Modal */}
      <Modal visible={showAllStepsModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 20,
              maxHeight: '75%',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E293B' }}>Langkah Navigasi</Text>
              <Pressable onPress={() => setShowAllStepsModal(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {navigationStore.activeRoute?.steps?.map((step, idx) => (
                <Pressable
                  key={idx}
                  onPress={() => {
                    navigationStore.updateCurrentStep(idx);
                    setShowAllStepsModal(false);
                  }}
                  style={{
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: '#F1F5F9',
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: idx === navigationStore.currentStepIndex ? '#EFF6FF' : 'transparent',
                    borderRadius: 10,
                    paddingHorizontal: 8,
                  }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: idx === navigationStore.currentStepIndex ? '#1E6CEF' : '#E2E8F0',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <Ionicons
                      name={getManeuverIcon(step.maneuver) as any}
                      size={16}
                      color={idx === navigationStore.currentStepIndex ? '#FFFFFF' : '#475569'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#1E293B' }}>{step.instruction}</Text>
                    <Text style={{ fontSize: 11, color: '#64748B' }}>{step.distance_meters} meter</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Warning Detail Modal */}
      <Modal visible={showWarningDetail} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              maxHeight: '75%',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#1E293B' }}>Detail Peringatan Kesehatan</Text>
              <Pressable onPress={() => setShowWarningDetail(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </Pressable>
            </View>

            {selectedWarning && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E293B' }}>{selectedWarning.title}</Text>
                <Text style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>{selectedWarning.message}</Text>

                <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
                  <View style={{ backgroundColor: '#F1F5F9', borderRadius: 10, padding: 10, flex: 1 }}>
                    <Text style={{ fontSize: 11, color: '#64748B' }}>AQI</Text>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E293B' }}>{selectedWarning.aqi}</Text>
                  </View>
                  <View style={{ backgroundColor: '#F1F5F9', borderRadius: 10, padding: 10, flex: 1 }}>
                    <Text style={{ fontSize: 11, color: '#64748B' }}>PM2.5</Text>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E293B' }}>{selectedWarning.pm2_5} µg/m³</Text>
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
