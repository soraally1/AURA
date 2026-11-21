/**
 * Navigation Service
 * Handles all navigation and tracking API calls with validation and OSRM fallback.
 * Free mapping / routing: no Google Maps API key required.
 */

import {
  CalculateRouteRequest,
  NavigationRoute,
  RouteStep,
} from '@/types/navigation';
import {
  DailyHistoryResponse,
  SendTrackingWaypoint,
  StopSessionResponse,
  SyncWaypointsResponse,
} from '@/types/tracking';
import axios from 'axios';
import { api } from './api';
import { calculateOfflineSemarangRoute } from './semarangRoadService';

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const routeCache = new Map<string, { route: NavigationRoute; timestamp: number }>();

/**
 * Generate cache key from origin/destination
 */
function getCacheKey(lat1: number, lon1: number, lat2: number, lon2: number): string {
  return `${lat1.toFixed(4)},${lon1.toFixed(4)}_${lat2.toFixed(4)},${lon2.toFixed(4)}`;
}

/**
 * Map OSRM maneuver type / modifier to RouteStep maneuver
 */
function mapOsrmManeuver(type?: string, modifier?: string): RouteStep['maneuver'] {
  if (type === 'arrive') return 'arrive';
  if (type === 'roundabout' || type === 'rotary') return 'roundabout';
  if (modifier?.includes('left')) return 'turn-left';
  if (modifier?.includes('right')) return 'turn-right';
  if (modifier?.includes('u-turn') || modifier?.includes('uturn')) return 'uturn';
  return 'straight';
}

/**
 * Validate that coordinates is a valid array of [lon, lat] pairs with at least 2 points
 */
function isValidCoordinatesArray(coords: any): coords is [number, number][] {
  if (!Array.isArray(coords) || coords.length < 2) return false;
  return coords.every(
    (pt) =>
      Array.isArray(pt) &&
      pt.length >= 2 &&
      typeof pt[0] === 'number' &&
      typeof pt[1] === 'number' &&
      !isNaN(pt[0]) &&
      !isNaN(pt[1]) &&
      !(pt[0] === 0 && pt[1] === 0)
  );
}

/**
 * Fallback to free Open Source Routing Machine (OSRM)
 * Honors avoid_tolls / mode by excluding motorway segments for urban activity routing.
 */
async function fetchOsrmRoute(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
  options?: { mode?: 'driving' | 'walking'; avoid_tolls?: boolean }
): Promise<NavigationRoute> {
  const excludeParam =
    options?.avoid_tolls !== false || options?.mode === 'walking'
      ? '&exclude=motorway'
      : '';
  const url = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson&steps=true${excludeParam}`;
  const response = await axios.get(url, { timeout: 10000 });

  const osrmRoute = response.data?.routes?.[0];
  if (!osrmRoute || !osrmRoute.geometry?.coordinates) {
    throw new Error('OSRM returned no valid route');
  }

  const coordinates: [number, number][] = osrmRoute.geometry.coordinates;
  const legs = osrmRoute.legs?.[0];
  const stepsRaw = legs?.steps || [];

  const steps: RouteStep[] = stepsRaw.map((step: any, index: number) => {
    const maneuverType = step.maneuver?.type;
    const modifier = step.maneuver?.modifier;
    const startLon = step.intersections?.[0]?.location?.[0] ?? origin.longitude;
    const startLat = step.intersections?.[0]?.location?.[1] ?? origin.latitude;
    const nextStep = stepsRaw[index + 1];
    const endLon = nextStep?.intersections?.[0]?.location?.[0] ?? destination.longitude;
    const endLat = nextStep?.intersections?.[0]?.location?.[1] ?? destination.latitude;

    let instruction = step.name ? `Ikuti ${step.name}` : 'Lurus terus';
    if (maneuverType === 'arrive') {
      instruction = 'Sampai di tujuan';
    } else if (modifier?.includes('left')) {
      instruction = `Belok kiri ke ${step.name || 'jalan berikutnya'}`;
    } else if (modifier?.includes('right')) {
      instruction = `Belok kanan ke ${step.name || 'jalan berikutnya'}`;
    } else if (modifier?.includes('uturn')) {
      instruction = 'Putar balik';
    }

    return {
      instruction,
      distance_meters: Math.round(step.distance || 0),
      duration_seconds: Math.round(step.duration || 0),
      maneuver: mapOsrmManeuver(maneuverType, modifier),
      start_location: { latitude: startLat, longitude: startLon },
      end_location: { latitude: endLat, longitude: endLon },
    };
  });

  return {
    route_id: `osrm_${Date.now()}`,
    distance_meters: Math.round(osrmRoute.distance || 0),
    duration_seconds: Math.round(osrmRoute.duration || 0),
    polyline: '',
    coordinates,
    steps: steps.length > 0 ? steps : [
      {
        instruction: 'Menuju tujuan',
        distance_meters: Math.round(osrmRoute.distance || 0),
        duration_seconds: Math.round(osrmRoute.duration || 0),
        maneuver: 'straight',
        start_location: origin,
        end_location: destination,
      },
    ],
    traffic_segments: [],
    // Clean data: No fake fabricated health warnings or fake traffic markers
    health_warnings: [],
    map_markers: [],
  };
}

export const navigationService = {
  /**
   * Calculate route between origin and destination with response validation and OSRM fallback
   */
  async calculateRoute(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    options?: { mode?: 'driving' | 'walking'; avoid_tolls?: boolean }
  ): Promise<NavigationRoute> {
    const cacheKey = getCacheKey(origin.latitude, origin.longitude, destination.latitude, destination.longitude);

    // 1. Check cache
    const cached = routeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
      return cached.route;
    }

    // 2. Try backend API first
    try {
      const payload: CalculateRouteRequest = {
        origin,
        destination,
        mode: options?.mode || 'driving',
        avoid_tolls: options?.avoid_tolls || false,
      };

      const response = await api.post('/api/v1/navigation/calculate-route', payload, {
        timeout: 8000,
      });

      const data = response.data?.data;

      // Validate backend response: coordinates must be valid non-empty array and distance > 0
      if (
        response.data?.success &&
        data &&
        isValidCoordinatesArray(data.coordinates) &&
        typeof data.distance_meters === 'number' &&
        data.distance_meters > 0
      ) {
        const validatedRoute: NavigationRoute = {
          route_id: data.route_id || `backend_${Date.now()}`,
          distance_meters: data.distance_meters,
          duration_seconds: data.duration_seconds || Math.round(data.distance_meters / 10),
          polyline: data.polyline || '',
          coordinates: data.coordinates,
          steps: Array.isArray(data.steps) && data.steps.length > 0 ? data.steps : [
            {
              instruction: 'Menuju tujuan',
              distance_meters: data.distance_meters,
              duration_seconds: data.duration_seconds || 0,
              maneuver: 'straight',
              start_location: origin,
              end_location: destination,
            },
          ],
          traffic_segments: Array.isArray(data.traffic_segments) ? data.traffic_segments : [],
          health_warnings: Array.isArray(data.health_warnings) ? data.health_warnings : [],
          map_markers: Array.isArray(data.map_markers) ? data.map_markers : [],
        };

        routeCache.set(cacheKey, { route: validatedRoute, timestamp: Date.now() });
        return validatedRoute;
      } else {
        console.warn(
          '[NavigationService] Backend route response invalid or empty, falling back to OSRM:',
          data
        );
      }
    } catch (err: any) {
      console.warn('[NavigationService] Backend route API unavailable, using OSRM:', err?.message || err);
    }

    // 3. Fallback to free OSRM (excluding toll roads by default)
    try {
      const osrmRoute = await fetchOsrmRoute(origin, destination, options);
      routeCache.set(cacheKey, { route: osrmRoute, timestamp: Date.now() });
      return osrmRoute;
    } catch (osrmErr: any) {
      console.warn('[NavigationService] OSRM route fetch failed, trying offline Semarang GPKG router:', osrmErr?.message || osrmErr);
      const localRoute = calculateOfflineSemarangRoute(origin, destination);
      if (localRoute && isValidCoordinatesArray(localRoute.coordinates)) {
        routeCache.set(cacheKey, { route: localRoute, timestamp: Date.now() });
        return localRoute;
      }
      throw new Error('Gagal mendapatkan rute navigasi. Periksa koneksi internet Anda.');
    }
  },

  /**
   * Start a new tracking session
   */
  async startTrackingSession(
    userId: string,
    startLocation: { latitude: number; longitude: number },
    sessionName?: string
  ): Promise<{ session_id: string }> {
    const payload = {
      user_id: userId,
      session_name: sessionName || `Perjalanan ${new Date().toLocaleTimeString('id-ID')}`,
      start_location: {
        latitude: startLocation.latitude,
        longitude: startLocation.longitude,
        timestamp: new Date().toISOString(),
      },
    };

    const response = await api.post('/api/v1/tracking/start-session', payload, {
      timeout: 10000,
    });

    if (response.data?.success && response.data?.data?.session_id) {
      return { session_id: response.data.data.session_id };
    }

    throw new Error(response.data?.error || 'Gagal memulai sesi tracking di server');
  },

  /**
   * Sync collected waypoints during tracking
   */
  async syncWaypoints(
    sessionId: string,
    waypoints: SendTrackingWaypoint[],
    isFinal: boolean,
    userId?: string
  ): Promise<SyncWaypointsResponse> {
    if (!sessionId) {
      throw new Error('Session ID tidak valid untuk sinkronisasi waypoints');
    }

    if (!waypoints || waypoints.length === 0) {
      return {
        success: true,
        synced_count: 0,
        session_id: sessionId,
        total_waypoints: 0,
        last_sync_at: new Date().toISOString(),
      };
    }

    const payload = {
      session_id: sessionId,
      user_id: userId,
      waypoints,
      is_final: isFinal,
    };

    const response = await api.post('/api/v1/tracking/sync-waypoints', payload, {
      timeout: 12000,
    });

    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }

    throw new Error(response.data?.error || 'Gagal menyinkronkan waypoints ke server');
  },

  /**
   * Stop tracking session and retrieve stats
   */
  async stopTrackingSession(
    sessionId: string,
    endLocation: { latitude: number; longitude: number },
    userId?: string
  ): Promise<StopSessionResponse> {
    if (!sessionId) {
      throw new Error('Session ID tidak ditemukan untuk menghentikan tracking');
    }

    const payload = {
      session_id: sessionId,
      user_id: userId,
      end_location: {
        latitude: endLocation.latitude,
        longitude: endLocation.longitude,
        timestamp: new Date().toISOString(),
      },
    };

    const response = await api.post('/api/v1/tracking/stop-session', payload, {
      timeout: 12000,
    });

    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }

    throw new Error(response.data?.error || 'Gagal mengakhiri sesi tracking di server');
  },

  /**
   * Get daily journey history for date (YYYY-MM-DD)
   */
  async getDailyHistory(userId: string, date: string): Promise<DailyHistoryResponse> {
    try {
      const response = await api.get('/api/v1/tracking/daily-history', {
        params: {
          user_id: userId,
          date,
        },
        timeout: 10000,
      });

      if (response.data?.success && response.data?.data) {
        const data = response.data.data;
        return {
          date: data.date || date,
          sessions: Array.isArray(data.sessions) ? data.sessions : [],
          combined_waypoints: Array.isArray(data.combined_waypoints) ? data.combined_waypoints : [],
          daily_stats: data.daily_stats || {
            total_outdoor_minutes: 0,
            total_indoor_minutes: 0,
            average_outdoor_aqi: 0,
            average_outdoor_pm25: 0,
            max_aqi: 0,
            worst_area_name: '-',
            worst_area_aqi: 0,
            waypoints_processed: 0,
          },
        };
      }
    } catch (err: any) {
      console.warn('[NavigationService] Get daily history failed:', err?.message || err);
    }

    // Default clean empty response (no fabricated fake stats)
    return {
      date,
      sessions: [],
      combined_waypoints: [],
      daily_stats: {
        total_outdoor_minutes: 0,
        total_indoor_minutes: 0,
        average_outdoor_aqi: 0,
        average_outdoor_pm25: 0,
        max_aqi: 0,
        worst_area_name: '-',
        worst_area_aqi: 0,
        waypoints_processed: 0,
      },
    };
  },
};
