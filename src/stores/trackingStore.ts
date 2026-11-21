/**
 * Tracking Store - Zustand
 * Manages state for active journey tracking with incremental sync
 */

import { SendTrackingWaypoint, TrackingSession, TrackingSessionStats, TrackingWaypoint } from '@/types/tracking';
import { create } from 'zustand';

/**
 * Calculate distance between two lat/lon points in meters using Haversine formula
 */
function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

interface TrackingState {
  // State
  activeSession: TrackingSession | null;
  isTracking: boolean;
  waypoints: TrackingWaypoint[];
  lastSyncedIndex: number;
  stats: TrackingSessionStats | null;
  syncStatus: 'idle' | 'syncing' | 'synced' | 'failed';
  totalDistance: number; // meters traveled
  elapsedSeconds: number;
  currentSpeed: number; // m/s

  // Actions
  startTracking: (sessionName?: string) => void;
  addWaypoint: (waypoint: TrackingWaypoint) => void;
  updateStats: (stats: TrackingSessionStats) => void;
  setSyncStatus: (status: 'idle' | 'syncing' | 'synced' | 'failed') => void;
  stopTracking: () => void;
  resetTracking: () => void;
  getUnsyncedWaypoints: () => SendTrackingWaypoint[];
  markWaypointsSynced: (count: number) => void;
  getWaypointsForSync: () => SendTrackingWaypoint[];
  setActiveSession: (session: TrackingSession) => void;
  setCurrentSpeed: (speed: number) => void;
  incrementElapsedSeconds: () => void;
}

const initialState = {
  activeSession: null,
  isTracking: false,
  waypoints: [],
  lastSyncedIndex: 0,
  stats: null,
  syncStatus: 'idle' as const,
  totalDistance: 0,
  elapsedSeconds: 0,
  currentSpeed: 0,
};

export const useTrackingStore = create<TrackingState>((set, get) => ({
  ...initialState,

  startTracking: (sessionName?: string) => {
    const newSession: TrackingSession = {
      session_id: '',
      session_name: sessionName || `Perjalanan ${new Date().toLocaleTimeString('id-ID')}`,
      started_at: new Date().toISOString(),
      status: 'active',
      waypoints: [],
    };

    set({
      activeSession: newSession,
      isTracking: true,
      waypoints: [],
      lastSyncedIndex: 0,
      totalDistance: 0,
      elapsedSeconds: 0,
      syncStatus: 'idle',
      currentSpeed: 0,
    });
  },

  addWaypoint: (waypoint: TrackingWaypoint) =>
    set((state) => {
      if (!state.isTracking) return state;

      let additionalDistance = 0;
      // Ignore GPS jitter (> 0.5m and < 800m between ticks)
      if (state.waypoints.length > 0) {
        const prev = state.waypoints[state.waypoints.length - 1];
        const dist = calculateHaversineDistance(
          prev.latitude,
          prev.longitude,
          waypoint.latitude,
          waypoint.longitude
        );
        if (dist >= 1.5 && dist <= 800) {
          additionalDistance = dist;
        }
      }

      const newWaypoints = [...state.waypoints, waypoint];
      const newTotalDistance = state.totalDistance + additionalDistance;

      return {
        waypoints: newWaypoints,
        totalDistance: newTotalDistance,
        activeSession: state.activeSession
          ? {
              ...state.activeSession,
              waypoints: newWaypoints,
              distance_km: newTotalDistance / 1000,
            }
          : null,
      };
    }),

  updateStats: (stats: TrackingSessionStats) =>
    set({
      stats,
    }),

  setSyncStatus: (status: 'idle' | 'syncing' | 'synced' | 'failed') =>
    set({
      syncStatus: status,
    }),

  stopTracking: () =>
    set((state) => ({
      isTracking: false,
      activeSession: state.activeSession
        ? {
            ...state.activeSession,
            ended_at: new Date().toISOString(),
            status: 'completed',
            distance_km: state.totalDistance / 1000,
            duration_minutes: Math.round(state.elapsedSeconds / 60),
          }
        : null,
    })),

  resetTracking: () => set(initialState),

  getUnsyncedWaypoints: () => {
    const { waypoints, lastSyncedIndex } = get();
    const unsynced = waypoints.slice(lastSyncedIndex);
    return unsynced.map((wp) => ({
      latitude: wp.latitude,
      longitude: wp.longitude,
      timestamp: wp.timestamp,
      accuracy_meters: wp.accuracy_meters,
      speed_mps: wp.speed_mps,
      heading: wp.heading,
    }));
  },

  markWaypointsSynced: (count: number) => {
    set((state) => ({
      lastSyncedIndex: Math.min(state.waypoints.length, state.lastSyncedIndex + count),
      syncStatus: 'synced',
    }));
  },

  getWaypointsForSync: () => {
    const { waypoints } = get();
    return waypoints.map((wp) => ({
      latitude: wp.latitude,
      longitude: wp.longitude,
      timestamp: wp.timestamp,
      accuracy_meters: wp.accuracy_meters,
      speed_mps: wp.speed_mps,
      heading: wp.heading,
    }));
  },

  setActiveSession: (session: TrackingSession) =>
    set({
      activeSession: session,
    }),

  setCurrentSpeed: (speed: number) =>
    set({
      currentSpeed: Math.max(0, speed),
    }),

  incrementElapsedSeconds: () =>
    set((state) => ({
      elapsedSeconds: state.elapsedSeconds + 1,
    })),
}));
