import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { mobilityService } from './mobilityService';
import { findNearestSemarangRoad } from './semarangRoadService';
import { MobilityWaypoint } from '@/types/mobility';

export const AURA_BACKGROUND_LOCATION_TASK = 'AURA_BACKGROUND_LOCATION_TASK';
const STORAGE_WAYPOINTS_PREFIX = 'aura_mobility_waypoints_v2_';

// Minimum distance (meters) to record a new movement breadcrumb in the trail
const MOVEMENT_BREADCRUMB_METERS = 10;
// Minimum duration in minutes at the same spot (< 35m) to classify as indoor stay
const STAY_DISTANCE_THRESHOLD_METERS = 35;
const STAY_DURATION_MINUTES = 20;

function getTodayDateString(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getStorageKeyForToday(): string {
  return `${STORAGE_WAYPOINTS_PREFIX}${getTodayDateString()}`;
}

let inMemoryWaypoints: MobilityWaypoint[] = [];
let isHydratedFromStorage = false;
let lastLocationTime = Date.now();
let foregroundWatcher: Location.LocationSubscription | null = null;

async function hydrateWaypointsFromStorage(): Promise<MobilityWaypoint[]> {
  if (isHydratedFromStorage && inMemoryWaypoints.length > 0) {
    return inMemoryWaypoints;
  }
  try {
    const raw = await AsyncStorage.getItem(getStorageKeyForToday());
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Merge persisted points with any points already collected in memory
        const merged: MobilityWaypoint[] = [...parsed];
        for (const memWp of inMemoryWaypoints) {
          const last = merged[merged.length - 1];
          if (
            !last ||
            mobilityService.getDistanceMeters(
              last.latitude,
              last.longitude,
              memWp.latitude,
              memWp.longitude
            ) >= MOVEMENT_BREADCRUMB_METERS
          ) {
            merged.push(memWp);
          }
        }
        inMemoryWaypoints = merged;
      }
    }
    isHydratedFromStorage = true;
  } catch (err) {
    console.warn('[BackgroundMobilityTracker] Storage hydrate note:', err);
  }
  return inMemoryWaypoints;
}

async function persistWaypointsToStorage(): Promise<void> {
  try {
    // Keep up to 300 breadcrumbs per day to avoid storage bloat
    const trimmed =
      inMemoryWaypoints.length > 300
        ? [
            inMemoryWaypoints[0],
            ...inMemoryWaypoints.slice(inMemoryWaypoints.length - 299),
          ]
        : inMemoryWaypoints;
    await AsyncStorage.setItem(getStorageKeyForToday(), JSON.stringify(trimmed));
  } catch (err) {
    console.warn('[BackgroundMobilityTracker] Persist note:', err);
  }
}

/**
 * Append or merge a real GPS coordinate into today's persistent trail
 */
async function appendGpsPointInternal(
  latitude: number,
  longitude: number,
  timestampMs: number = Date.now(),
  accuracyMeters?: number
): Promise<void> {
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    isNaN(latitude) ||
    isNaN(longitude)
  ) {
    return;
  }

  // Filter out very poor GPS locks (> 85m accuracy) if we already have an initial point
  if (
    inMemoryWaypoints.length > 0 &&
    typeof accuracyMeters === 'number' &&
    accuracyMeters > 85
  ) {
    return;
  }

  await hydrateWaypointsFromStorage();

  const elapsedMinutes = Math.max(
    0.2,
    Math.round(((timestampMs - lastLocationTime) / (1000 * 60)) * 10) / 10
  );
  lastLocationTime = timestampMs;

  const nearestRoad = findNearestSemarangRoad(latitude, longitude);
  const zoneName = nearestRoad?.n;
  const lastWaypoint = inMemoryWaypoints[inMemoryWaypoints.length - 1];

  if (!lastWaypoint) {
    inMemoryWaypoints.push({
      latitude,
      longitude,
      timestamp: new Date(timestampMs).toISOString(),
      duration_minutes: 1,
      is_stay: false,
      classification: 'outdoor',
      zone_name: zoneName,
    });
    await persistWaypointsToStorage();
    return;
  }

  const distMeters = mobilityService.getDistanceMeters(
    lastWaypoint.latitude,
    lastWaypoint.longitude,
    latitude,
    longitude
  );

  // If user moved >= 10 meters, record a new breadcrumb in the route trail!
  if (distMeters >= MOVEMENT_BREADCRUMB_METERS) {
    inMemoryWaypoints.push({
      latitude,
      longitude,
      timestamp: new Date(timestampMs).toISOString(),
      duration_minutes: Math.min(30, elapsedMinutes),
      is_stay: false,
      classification: 'outdoor',
      zone_name: zoneName,
    });
    await persistWaypointsToStorage();
  } else if (distMeters < STAY_DISTANCE_THRESHOLD_METERS) {
    lastWaypoint.duration_minutes =
      Math.round((lastWaypoint.duration_minutes + Math.min(15, elapsedMinutes)) * 10) /
      10;
    if (lastWaypoint.duration_minutes >= STAY_DURATION_MINUTES) {
      lastWaypoint.is_stay = true;
      lastWaypoint.classification = 'indoor';
    }
    await persistWaypointsToStorage();
  }
}

/**
 * Define Background Task at top-level module scope
 */
TaskManager.defineTask(AURA_BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) return;

  const { locations } = data as { locations: Location.LocationObject[] };
  if (!locations || locations.length === 0) return;

  for (const loc of locations) {
    await appendGpsPointInternal(
      loc.coords.latitude,
      loc.coords.longitude,
      loc.timestamp || Date.now(),
      loc.coords.accuracy ?? undefined
    );
  }

  if (inMemoryWaypoints.length >= 4 && inMemoryWaypoints.length % 4 === 0) {
    try {
      const todayStr = getTodayDateString();
      await mobilityService.sendBatch({
        date: todayStr,
        waypoints: inMemoryWaypoints.map((wp) => ({
          latitude: wp.latitude,
          longitude: wp.longitude,
          timestamp: wp.timestamp,
          duration_minutes: wp.duration_minutes,
          is_stay: wp.is_stay,
        })),
      });
    } catch {
      // Retry on next interval
    }
  }
});

export const backgroundMobilityTracker = {
  /**
   * Starts continuous GPS tracking:
   * 1. Hydrates today's persisted trail from AsyncStorage
   * 2. Captures immediate high-accuracy GPS position (e.g. user's starting point / home)
   * 3. Starts a foreground Location.watchPositionAsync watcher (works 100% in Expo Go on Android & iOS!)
   * 4. Optionally registers background location updates if supported by the runtime
   */
  async startBackgroundTracking(): Promise<boolean> {
    if (Platform.OS === 'web') return false;

    try {
      await hydrateWaypointsFromStorage();

      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        console.warn('[BackgroundMobilityTracker] Foreground location permission denied.');
        return false;
      }

      // Capture immediate initial GPS fix so user's origin is always recorded
      await this.captureCurrentGpsPosition();

      // Start foreground watcher (works reliably in Expo Go on Android where background task is disabled)
      if (!foregroundWatcher) {
        foregroundWatcher = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 4000,
            distanceInterval: 10,
          },
          (loc) => {
            void appendGpsPointInternal(
              loc.coords.latitude,
              loc.coords.longitude,
              loc.timestamp || Date.now(),
              loc.coords.accuracy ?? undefined
            );
          }
        );
      }

      // Attempt background task registration if supported (non-blocking for Expo Go)
      try {
        const isBgAvailable = await Location.isBackgroundLocationAvailableAsync();
        if (isBgAvailable) {
          const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
          if (bgStatus === 'granted') {
            const hasStarted = await Location.hasStartedLocationUpdatesAsync(
              AURA_BACKGROUND_LOCATION_TASK
            );
            if (!hasStarted) {
              await Location.startLocationUpdatesAsync(AURA_BACKGROUND_LOCATION_TASK, {
                accuracy: Location.Accuracy.Balanced,
                timeInterval: 2 * 60 * 1000,
                distanceInterval: 35,
                deferredUpdatesInterval: 2 * 60 * 1000,
                deferredUpdatesDistance: 50,
                showsBackgroundLocationIndicator: false,
                pausesUpdatesAutomatically: true,
                foregroundService: {
                  notificationTitle: 'AURA Perlindungan Keseharian',
                  notificationBody:
                    'Mendeteksi mobilitas & paparan polusi secara hemat daya di latar belakang.',
                  notificationColor: '#2373F4',
                },
              });
            }
          }
        }
      } catch {
        // Expected in Expo Go on Android; foreground watcher above handles tracking seamlessly
      }

      return true;
    } catch (err) {
      console.warn('[BackgroundMobilityTracker] Start tracking note:', err);
      return false;
    }
  },

  /**
   * Manually record a known GPS coordinate into today's persistent trail
   */
  async recordGpsCoordinate(
    latitude: number,
    longitude: number,
    accuracyMeters?: number
  ): Promise<void> {
    await appendGpsPointInternal(latitude, longitude, Date.now(), accuracyMeters);
  },

  /**
   * Actively queries the device's current GPS position and appends it to today's trail
   */
  async captureCurrentGpsPosition(): Promise<{
    latitude: number;
    longitude: number;
  } | null> {
    if (Platform.OS === 'web') return null;
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return null;

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      await appendGpsPointInternal(
        loc.coords.latitude,
        loc.coords.longitude,
        loc.timestamp || Date.now(),
        loc.coords.accuracy ?? undefined
      );
      return {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
    } catch {
      return null;
    }
  },

  async stopBackgroundTracking(): Promise<void> {
    if (foregroundWatcher) {
      foregroundWatcher.remove();
      foregroundWatcher = null;
    }
    if (Platform.OS === 'web') return;
    try {
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(
        AURA_BACKGROUND_LOCATION_TASK
      );
      if (hasStarted) {
        await Location.stopLocationUpdatesAsync(AURA_BACKGROUND_LOCATION_TASK);
      }
    } catch {
      // ignore
    }
  },

  async isTrackingActive(): Promise<boolean> {
    if (foregroundWatcher) return true;
    if (Platform.OS === 'web') return false;
    try {
      return await Location.hasStartedLocationUpdatesAsync(AURA_BACKGROUND_LOCATION_TASK);
    } catch {
      return false;
    }
  },

  async syncBatchNow(userId?: string): Promise<boolean> {
    try {
      await hydrateWaypointsFromStorage();
      await this.captureCurrentGpsPosition();
      if (inMemoryWaypoints.length === 0) return false;

      const todayStr = getTodayDateString();
      await mobilityService.sendBatch({
        user_id: userId,
        date: todayStr,
        waypoints: inMemoryWaypoints.map((wp) => ({
          latitude: wp.latitude,
          longitude: wp.longitude,
          timestamp: wp.timestamp,
          duration_minutes: wp.duration_minutes,
          is_stay: wp.is_stay,
        })),
      });

      return true;
    } catch (err) {
      console.warn('[BackgroundMobilityTracker] Manual sync failed:', err);
      return false;
    }
  },

  getCollectedWaypoints(): MobilityWaypoint[] {
    return inMemoryWaypoints;
  },

  async getCollectedWaypointsAsync(): Promise<MobilityWaypoint[]> {
    await hydrateWaypointsFromStorage();
    await this.captureCurrentGpsPosition();
    return inMemoryWaypoints;
  },
};
