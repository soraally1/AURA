/**
 * Active Tracking Screen
 * Real-time journey recording with hybrid smart sync and live health metrics.
 * Free mapping: OpenStreetMap / native MapKit without Google Maps API key.
 */

import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StatusBar,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  OsmMapView,
  OsmMapViewHandle,
  OsmPolylineItem,
} from '@/components/map/OsmMapView';
import { useAuth } from '@/context/auth-context';
import { navigationService } from '@/services/navigationService';
import { backgroundMobilityTracker } from '@/services/backgroundMobilityTracker';
import { findNearestSemarangRoad } from '@/services/semarangRoadService';
import { zonesApi } from '@/services/zonesApi';
import { useTrackingStore } from '@/stores/trackingStore';
import { TrackingWaypoint } from '@/types/tracking';

function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatDistance(meters: number): string {
  if (!meters || meters < 1000) return `${Math.round(meters || 0)} m`;
  return `${((meters || 0) / 1000).toFixed(2)} km`;
}

function formatSpeed(mps: number): string {
  return `${Math.round((mps || 0) * 3.6)} km/h`;
}

export default function ActiveTrackingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const trackingStore = useTrackingStore();
  const mapViewRef = useRef<OsmMapViewHandle>(null);
  const locationWatcherRef = useRef<Location.LocationSubscription | null>(null);
  const sessionIdRef = useRef<string>('');
  const isSyncingRef = useRef<boolean>(false);

  const [isStarting, setIsStarting] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [currentAQI, setCurrentAQI] = useState<number | null>(null);

  // Sync ref with store on mount/changes
  useEffect(() => {
    if (trackingStore.activeSession?.session_id) {
      sessionIdRef.current = trackingStore.activeSession.session_id;
    }
  }, [trackingStore.activeSession?.session_id]);

  // Fetch initial location on mount
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setUserLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });

          // Fetch nearest zone AQI
          const zonesRes = await zonesApi.getNearbyZones(loc.coords.latitude, loc.coords.longitude, 10);
          const aqi =
            zonesRes?.nearby_zones?.[0]?.air_quality?.us_aqi ??
            zonesRes?.local_environment?.air_quality?.us_aqi;
          if (typeof aqi === 'number') {
            setCurrentAQI(aqi);
          }
        }
      } catch (err) {
        console.warn('[ActiveTracking] Initial location fetch note:', err);
      }
    })();

    return () => {
      if (locationWatcherRef.current) {
        locationWatcherRef.current.remove();
        locationWatcherRef.current = null;
      }
    };
  }, []);

  // Sync unsynced waypoints helper
  const performSync = async (isFinal: boolean = false) => {
    const sessionId = sessionIdRef.current;
    if (!sessionId || isSyncingRef.current) return;

    const state = useTrackingStore.getState();
    const unsynced = state.getUnsyncedWaypoints();
    if (unsynced.length === 0 && !isFinal) return;

    try {
      isSyncingRef.current = true;
      state.setSyncStatus('syncing');

      const syncRes = await navigationService.syncWaypoints(
        sessionId,
        unsynced,
        isFinal,
        user?.uid
      );

      if (syncRes.success) {
        state.markWaypointsSynced(unsynced.length);
      } else {
        state.setSyncStatus('failed');
      }
    } catch (err) {
      console.warn('[ActiveTracking] Sync waypoints error:', err);
      useTrackingStore.getState().setSyncStatus('failed');
    } finally {
      isSyncingRef.current = false;
    }
  };

  // Start tracking session
  const handleStartTracking = async () => {
    setIsStarting(true);

    try {
      // 0. Ensure user is logged in
      if (!user?.uid) {
        Alert.alert(
          'Login Diperlukan',
          'Silakan masuk terlebih dahulu untuk mulai merekam perjalanan Anda.',
          [
            { text: 'Batal', style: 'cancel' },
            { text: 'Login', onPress: () => router.push('/') },
          ]
        );
        setIsStarting(false);
        return;
      }

      // 1. Request permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Izin Lokasi Diperlukan', 'AURA membutuhkan izin lokasi untuk melacak perjalanan Anda.');
        setIsStarting(false);
        return;
      }

      // 2. Get current location
      const initialLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const startCoord = {
        latitude: initialLoc.coords.latitude,
        longitude: initialLoc.coords.longitude,
      };
      setUserLocation(startCoord);

      // 3. Start backend session (with offline/local fallback so GPS tracking never fails)
      let activeSessionId = `local_${Date.now()}`;
      try {
        if (user?.uid) {
          const sessionResponse = await navigationService.startTrackingSession(
            user.uid,
            startCoord
          );
          if (sessionResponse?.session_id) {
            activeSessionId = sessionResponse.session_id;
          }
        }
      } catch (sessionErr) {
        console.warn('[ActiveTracking] Using local tracking session ID:', sessionErr);
      }

      sessionIdRef.current = activeSessionId;
      void backgroundMobilityTracker.recordGpsCoordinate(
        startCoord.latitude,
        startCoord.longitude,
        initialLoc.coords.accuracy ?? undefined
      );

      // 4. Update store
      useTrackingStore.getState().startTracking();
      useTrackingStore.getState().setActiveSession({
        session_id: activeSessionId,
        session_name: `Perjalanan ${new Date().toLocaleTimeString('id-ID')}`,
        started_at: new Date().toISOString(),
        status: 'active',
        waypoints: [],
      });

      // 5. Add initial waypoint
      const initialWaypoint: TrackingWaypoint = {
        latitude: startCoord.latitude,
        longitude: startCoord.longitude,
        timestamp: new Date().toISOString(),
        accuracy_meters: initialLoc.coords.accuracy || 10,
        speed_mps: initialLoc.coords.speed || 0,
        heading: initialLoc.coords.heading || 0,
        classification: 'outdoor',
        is_stay: false,
        aqi: currentAQI || undefined,
      };
      useTrackingStore.getState().addWaypoint(initialWaypoint);

      // 6. Start watching GPS position (every 2-3s or 5m)
      locationWatcherRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2500,
          distanceInterval: 5,
        },
        (location) => {
          const newWaypoint: TrackingWaypoint = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            timestamp: new Date().toISOString(),
            accuracy_meters: location.coords.accuracy || 10,
            speed_mps: location.coords.speed || 0,
            heading: location.coords.heading || 0,
            classification: 'outdoor',
            is_stay: false,
            aqi: currentAQI || undefined,
          };

          setUserLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });

          // Always read latest state from Zustand to avoid stale closure
          const storeState = useTrackingStore.getState();
          storeState.addWaypoint(newWaypoint);
          storeState.setCurrentSpeed(location.coords.speed || 0);
          void backgroundMobilityTracker.recordGpsCoordinate(
            location.coords.latitude,
            location.coords.longitude,
            location.coords.accuracy ?? undefined
          );

          // Auto-sync every 3 unsynced waypoints so Firestore always has up-to-date route points
          const unsyncedCount = storeState.waypoints.length - storeState.lastSyncedIndex;
          if (unsyncedCount >= 3) {
            performSync(false);
          }
        }
      );
    } catch (err: any) {
      Alert.alert('Gagal Memulai Tracking', err?.message || 'Terjadi kesalahan saat memulai sesi tracking.');
    } finally {
      setIsStarting(false);
    }
  };

  // Stop tracking session
  const handleStopTracking = async () => {
    if (locationWatcherRef.current) {
      locationWatcherRef.current.remove();
      locationWatcherRef.current = null;
    }

    const currentState = useTrackingStore.getState();
    const sessionId = sessionIdRef.current || currentState.activeSession?.session_id;

    if (!sessionId) {
      currentState.stopTracking();
      router.back();
      return;
    }

    try {
      // 1. Final sync unsynced waypoints
      await performSync(true);

      // 2. Stop session at backend
      const lastWp = currentState.waypoints[currentState.waypoints.length - 1];
      const endLocation = lastWp
        ? { latitude: lastWp.latitude, longitude: lastWp.longitude }
        : (userLocation || { latitude: -6.9932, longitude: 110.4203 });

      const stopResponse = await navigationService.stopTrackingSession(
        sessionId,
        endLocation,
        user?.uid
      );

      currentState.stopTracking();

      const dist = stopResponse.distance_km ?? (currentState.totalDistance / 1000);
      const dur = stopResponse.duration_minutes ?? Math.round(currentState.elapsedSeconds / 60);

      Alert.alert(
        'Perjalanan Selesai!',
        `Jarak: ${dist.toFixed(2)} km\nDurasi: ${dur} menit\nData perjalanan Anda telah tersimpan.`,
        [{ text: 'Lihat Riwayat', onPress: () => router.replace('/daily-journey') }]
      );
    } catch (err: any) {
      currentState.stopTracking();
      Alert.alert('Tracking Dihentikan', 'Sesi dihentikan lokal. ' + (err?.message || ''));
      router.back();
    }
  };

  // Timer interval for elapsed time
  useEffect(() => {
    if (!trackingStore.isTracking) return;

    const timer = setInterval(() => {
      useTrackingStore.getState().incrementElapsedSeconds();
    }, 1000);

    return () => clearInterval(timer);
  }, [trackingStore.isTracking]);

  // Center map on user location
  useEffect(() => {
    if (userLocation && mapViewRef.current && trackingStore.waypoints.length > 1) {
      mapViewRef.current.flyTo(userLocation.latitude, userLocation.longitude, 15.5);
    }
  }, [userLocation, trackingStore.waypoints.length]);

  const trailPolylines = useMemo<OsmPolylineItem[]>(() => {
    if (trackingStore.waypoints.length < 2) return [];
    return [
      {
        id: 'tracking-trail',
        color: '#10B981',
        width: 5,
        coordinates: trackingStore.waypoints.map((wp: TrackingWaypoint) => ({
          latitude: wp.latitude,
          longitude: wp.longitude,
        })),
      },
    ];
  }, [trackingStore.waypoints]);

  const currentRoadLabel = useMemo(() => {
    if (!userLocation) return null;
    return findNearestSemarangRoad(userLocation.latitude, userLocation.longitude)?.n || null;
  }, [userLocation]);

  const topPadding = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : insets.top + 8;

  return (
    <View style={{ flex: 1, backgroundColor: '#E2E8F0' }}>
      <StatusBar barStyle="dark-content" />

      {/* OpenStreetMap / MapLibre Map (No Google Maps API key / Never Black) */}
      <OsmMapView
        ref={mapViewRef}
        style={{ flex: 1 }}
        initialCenter={userLocation || { latitude: -6.9932, longitude: 110.4203 }}
        initialZoom={14.5}
        userLocation={userLocation}
        followUserLocation={trackingStore.isTracking}
        polylines={trailPolylines}
      />

      {!trackingStore.isTracking && currentRoadLabel && (
        <View
          style={{
            position: 'absolute',
            top: topPadding + 52,
            left: 16,
            backgroundColor: 'rgba(255,255,255,0.94)',
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 6,
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#E2E8F0',
            zIndex: 40,
          }}
        >
          <Ionicons name="compass" size={14} color="#1E6CEF" style={{ marginRight: 6 }} />
          <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#0F172A' }}>
            {currentRoadLabel}
          </Text>
        </View>
      )}

      {/* Stats Panel (Top) */}
      {trackingStore.isTracking && (
        <View
          style={{
            position: 'absolute',
            top: topPadding,
            left: 16,
            right: 16,
            backgroundColor: '#FFFFFF',
            borderRadius: 18,
            padding: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 2 }}>Waktu</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E293B' }}>
                {formatTime(trackingStore.elapsedSeconds)}
              </Text>
            </View>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 2 }}>Jarak</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E293B' }}>
                {formatDistance(trackingStore.totalDistance)}
              </Text>
            </View>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 2 }}>Kecepatan</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E293B' }}>
                {formatSpeed(trackingStore.currentSpeed)}
              </Text>
            </View>
            {currentAQI !== null && (
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 2 }}>AQI</Text>
                <View
                  style={{
                    backgroundColor: currentAQI > 150 ? '#EF4444' : currentAQI > 100 ? '#F59E0B' : '#10B981',
                    borderRadius: 8,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>{currentAQI}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Sync Status Badge */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 10 }}>
            {trackingStore.syncStatus === 'syncing' && (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#1E6CEF" />
                <Text style={{ fontSize: 11, color: '#1E6CEF', marginLeft: 6 }}>Menyinkronkan data...</Text>
              </View>
            )}
            {trackingStore.syncStatus === 'synced' && (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                <Text style={{ fontSize: 11, color: '#10B981', marginLeft: 4 }}>Tersinkron ({trackingStore.waypoints.length} titik)</Text>
              </View>
            )}
            {trackingStore.syncStatus === 'failed' && (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="alert-circle" size={14} color="#EF4444" />
                <Text style={{ fontSize: 11, color: '#EF4444', marginLeft: 4 }}>Sync tertunda</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Start/Stop Button (Bottom) */}
      <View
        style={{
          position: 'absolute',
          bottom: insets.bottom + 24,
          left: 0,
          right: 0,
          alignItems: 'center',
          zIndex: 50,
        }}
      >
        {!trackingStore.isTracking ? (
          <Pressable
            onPress={handleStartTracking}
            disabled={isStarting}
            style={({ pressed }) => [
              {
                backgroundColor: '#1E6CEF',
                borderRadius: 28,
                paddingHorizontal: 36,
                paddingVertical: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#1E6CEF',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.35,
                shadowRadius: 8,
                elevation: 5,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            {isStarting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="radio-button-on" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>Mulai Tracking</Text>
              </>
            )}
          </Pressable>
        ) : (
          <Pressable
            onPress={handleStopTracking}
            style={({ pressed }) => [
              {
                backgroundColor: '#EF4444',
                borderRadius: 28,
                paddingHorizontal: 36,
                paddingVertical: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#EF4444',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.35,
                shadowRadius: 8,
                elevation: 5,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Ionicons name="stop-circle" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>Selesaikan Tracking</Text>
          </Pressable>
        )}
      </View>

      {/* Back / Close Button */}
      <Pressable
        onPress={() => {
          if (trackingStore.isTracking) {
            Alert.alert(
              'Hentikan Tracking?',
              'Tracking sedang aktif. Apakah Anda ingin menghentikan sesi ini?',
              [
                { text: 'Lanjutkan Melacak', style: 'cancel' },
                { text: 'Hentikan', onPress: handleStopTracking, style: 'destructive' },
              ]
            );
          } else {
            router.back();
          }
        }}
        style={{
          position: 'absolute',
          top: topPadding,
          left: 16,
          zIndex: 100,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: '#FFFFFF',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 5,
            elevation: 3,
          }}
        >
          <Ionicons name="close" size={22} color="#1E293B" />
        </View>
      </Pressable>
    </View>
  );
}
