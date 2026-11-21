import axios from 'axios';
import { Platform } from 'react-native';
import {
  CoughMobilityContext,
  CoughPredictionResponse,
  ScanSkinContext,
  SkinCvAnalysis,
  SkinScanResponse,
  ScinMetadataResponse,
  PollutionHealthAnalysisContext,
  PollutionHealthAnalysisResponse,
  PollutionHealthIndicator,
  ActivityDiseaseRisk,
  EnvironmentalTelemetrySnapshot,
  PollutionRecommendation,
  ActivityRouteCoordinate,
  ActivityRouteProfile,
} from '@/types/ai';
import { mobilityService } from './mobilityService';
import { backgroundMobilityTracker } from './backgroundMobilityTracker';
import { TokenStorage } from './storage';
import { locationService } from './locationService';
import { navigationService } from './navigationService';
import { zonesApi } from './zonesApi';
import {
  findNearestSemarangRoad,
  getLocalRoadSegmentCoordinates,
  haversineMeters,
  searchSemarangRoads,
} from './semarangRoadService';
import { useTrackingStore } from '@/stores/trackingStore';
import { useNavigationStore } from '@/stores/navigationStore';

const DEFAULT_AI_URL =
  process.env.EXPO_PUBLIC_AI_API_URL || 'https://onnxaura.vercel.app';

export const AI_API_URL = DEFAULT_AI_URL;

export const aiService = {
  /**
   * Scan kulit menggunakan foto Base64 + data mobilitas (Groq AI qwen/qwen3.8-27b + SCIN Validation)
   * Endpoint: POST /api/skin/scan-json
   */
  scanSkin: async (
    imageBase64: string,
    context?: ScanSkinContext
  ): Promise<SkinScanResponse> => {
    // Pastikan prefix data:image tersedia jika format murni base64
    const formattedBase64 = imageBase64.startsWith('data:image')
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`;

    try {
      const res = await axios.post<SkinScanResponse>(
        `${AI_API_URL}/api/skin/scan-json`,
        {
          image_base64: formattedBase64,
          context,
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000,
        }
      );

      if (!res.data || !res.data.success) {
        throw new Error(
          (res.data as any)?.error || 'Gagal memproses analisis kulit dari server AI'
        );
      }

      return res.data;
    } catch (err: any) {
      const rawData = err?.response?.data;
      const status = err?.response?.status;
      let serverText = '';
      if (typeof rawData === 'string') {
        serverText = rawData.includes('FUNCTION_INVOCATION_FAILED')
          ? 'Server AI kulit (Vercel onnxaura) gagal booting (HTTP 500). Silakan deploy ulang backend onnxaura terbaru.'
          : rawData.slice(0, 180);
      }
      const errorMsg =
        rawData?.detail ||
        rawData?.message ||
        serverText ||
        (status >= 500
          ? `Server AI kulit bermasalah (HTTP ${status}). Pastikan layanan backend aktif.`
          : err?.message) ||
        'Tidak dapat terhubung ke server AI kulit (Groq/SCIN).';
      console.error('[aiService.scanSkin] Error:', errorMsg);
      throw new Error(errorMsg);
    }
  },

  /**
   * Fast Python CV geometry & Wood's Lamp preview on captured image (~150ms, no LLM wait).
   * Returns null silently if endpoint is unavailable so scanSkin never blocks.
   */
  previewSkinGeometry: async (imageBase64: string): Promise<SkinCvAnalysis | null> => {
    const formattedBase64 = imageBase64.startsWith('data:image')
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`;
    try {
      const res = await axios.post<{ success: boolean; cv_analysis?: SkinCvAnalysis }>(
        `${AI_API_URL}/api/skin/cv-preview`,
        { image_base64: formattedBase64 },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 12000,
        }
      );
      if (res.data?.success && res.data.cv_analysis) {
        return res.data.cv_analysis;
      }
      return null;
    } catch {
      return null;
    }
  },

  /**
   * Prediksi audio suara batuk (.wav) via ONNX ICBHI model
   * Endpoint: POST /api/predict/cough
   */
  predictCough: async (
    audioUri: string,
    mobilityData?: CoughMobilityContext
  ): Promise<CoughPredictionResponse> => {
    if (!audioUri) {
      throw new Error('File rekaman suara batuk tidak ditemukan.');
    }

    const formData = new FormData();
    formData.append('file', {
      uri: audioUri,
      name: 'cough.wav',
      type: 'audio/wav',
    } as any);

    if (mobilityData?.outdoorMinutes !== undefined) {
      formData.append('total_outdoor_minutes', String(mobilityData.outdoorMinutes));
    }
    if (mobilityData?.pm25 !== undefined) {
      formData.append('average_outdoor_pm25', String(mobilityData.pm25));
    }
    if (mobilityData?.worstArea) {
      formData.append('worst_area_name', mobilityData.worstArea);
    }
    if (mobilityData?.worstAqi !== undefined) {
      formData.append('worst_area_aqi', String(mobilityData.worstAqi));
    }
    if (mobilityData?.usia !== undefined) {
      formData.append('usia', String(mobilityData.usia));
    }

    try {
      const res = await axios.post<CoughPredictionResponse>(
        `${AI_API_URL}/api/predict/cough`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 25000,
        }
      );

      if (!res.data || !res.data.prediction) {
        throw new Error('Format respon analisis batuk tidak valid.');
      }

      return res.data;
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        'Tidak dapat terhubung ke server ONNX ICBHI batuk.';
      console.error('[aiService.predictCough] Error:', errorMsg);
      throw new Error(errorMsg);
    }
  },

  /**
   * Ambil kamus taksonomi Google SCIN
   * Endpoint: GET /api/scin/metadata
   */
  getScinMetadata: async (): Promise<ScinMetadataResponse> => {
    const res = await axios.get<ScinMetadataResponse>(`${AI_API_URL}/api/scin/metadata`, {
      timeout: 8000,
    });
    return res.data;
  },

  /**
   * Analisis Penyakit & Biometrik Aktivitas Akibat Paparan Polusi & Mikroklimat
   * Menggunakan pemodelan biofisika yang logis (tanpa klaim sensor termometer tubuh):
   * 1. Efisiensi Oksigenasi & Dosis Inhalasi PM2.5 (dari ventilasi semenit & konsentrasi PM2.5)
   * 2. Beban Termal Tubuh / Heat Index (analogi logis pengganti suhu badan, dari Suhu Udara + RH% + UV + Durasi Aktivitas)
   * 3. Paparan Barier & Oksidasi Kulit (dari deposisi PM2.5/PM10 + Indeks UV + kelembapan)
   * 4. Estimasi Defisit Cairan / Keringat (dari laju evaporasi keringat terhadap Heat Index & berat badan)
   */
  analyzePollutionHealthImpact: async (
    context?: PollutionHealthAnalysisContext
  ): Promise<PollutionHealthAnalysisResponse> => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // 1. Selalu ambil posisi GPS live perangkat & muat jejak GPS harian yang tersimpan di AsyncStorage
    const [liveGpsRes, persistedBgWaypoints] = await Promise.all([
      locationService.getCurrentGpsLocation().catch(() => null),
      backgroundMobilityTracker.getCollectedWaypointsAsync().catch(() => []),
    ]);

    const storeState = useTrackingStore.getState();
    const navState = useNavigationStore.getState();
    const bgWaypoints =
      persistedBgWaypoints.length > 0
        ? persistedBgWaypoints
        : backgroundMobilityTracker.getCollectedWaypoints();

    const latestRecordedWp =
      storeState.waypoints[storeState.waypoints.length - 1] ||
      bgWaypoints[bgWaypoints.length - 1];

    const nearestDefaultRoad = searchSemarangRoads('', 1)[0];
    const lat =
      liveGpsRes?.success && liveGpsRes.location
        ? liveGpsRes.location.lat
        : latestRecordedWp?.latitude ??
          (typeof context?.lat === 'number' && !isNaN(context.lat)
            ? context.lat
            : nearestDefaultRoad.lat);
    const lon =
      liveGpsRes?.success && liveGpsRes.location
        ? liveGpsRes.location.lon
        : latestRecordedWp?.longitude ??
          (typeof context?.lon === 'number' && !isNaN(context.lon)
            ? context.lon
            : nearestDefaultRoad.lon);

    const nearestRoadAtCurrent = findNearestSemarangRoad(lat, lon);
    const locationName =
      nearestRoadAtCurrent?.n ||
      (liveGpsRes?.success && liveGpsRes.location ? liveGpsRes.location.name : undefined) ||
      context?.location_name ||
      `${lat.toFixed(4)}, ${lon.toFixed(4)}`;

    // 2. Ambil profil user, histori perjalanan harian, zona polusi terdekat, dan telemetri cuaca/polusi Open-Meteo secara paralel
    const userProfile = await TokenStorage.getUserProfile().catch(() => null);

    const [weatherRes, airRes, nearbyZonesRes, dailyHistoryRes, dailyMobilityRes] =
      await Promise.all([
        axios
          .get('https://api.open-meteo.com/v1/forecast', {
            params: {
              latitude: lat,
              longitude: lon,
              current:
                'temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,uv_index',
              hourly: 'temperature_2m,apparent_temperature,relative_humidity_2m,uv_index',
              forecast_days: 1,
              timezone: 'auto',
            },
            timeout: 6000,
          })
          .catch(() => null),
        axios
          .get('https://air-quality-api.open-meteo.com/v1/air-quality', {
            params: {
              latitude: lat,
              longitude: lon,
              current: 'us_aqi,pm2_5,pm10',
              hourly: 'us_aqi,pm2_5,pm10',
              forecast_days: 1,
              timezone: 'auto',
            },
            timeout: 6000,
          })
          .catch(() => null),
        zonesApi.getNearbyZones(lat, lon, 8).catch(() => null),
        userProfile?.uid
          ? navigationService.getDailyHistory(userProfile.uid, today).catch(() => null)
          : Promise.resolve(null),
        userProfile?.uid
          ? mobilityService.getDailyAnalysis(today, userProfile.uid).catch(() => null)
          : Promise.resolve(null),
      ]);

    const nearbyZones = nearbyZonesRes?.nearby_zones || [];
    const currentHour = now.getHours();

    // Resolusi telemetri cuaca aktual dari Open-Meteo (current -> hourly[currentHour] -> nearbyZone.weather)
    const currentWeather = weatherRes?.data?.current;
    const hourlyWeather = weatherRes?.data?.hourly;
    const zoneWeather = nearbyZones[0]?.weather;

    const ambientTempC = Number(
      currentWeather?.temperature_2m ??
        hourlyWeather?.temperature_2m?.[currentHour] ??
        zoneWeather?.temperature_c ??
        30
    );
    const relativeHumidityPct = Number(
      currentWeather?.relative_humidity_2m ??
        hourlyWeather?.relative_humidity_2m?.[currentHour] ??
        zoneWeather?.humidity_percent ??
        70
    );
    const uvIndex = Number(
      currentWeather?.uv_index ??
        hourlyWeather?.uv_index?.[currentHour] ??
        Math.max(1, Math.round(ambientTempC - 25))
    );
    const windSpeedKmh = Number(
      currentWeather?.wind_speed_kmh ??
        currentWeather?.wind_speed_10m ??
        zoneWeather?.wind_speed_kmh ??
        10
    );

    // Resolusi telemetri polusi udara aktual dari Open-Meteo / zona terdekat
    const currentAir = airRes?.data?.current;
    const hourlyAir = airRes?.data?.hourly;
    const zoneAir =
      nearbyZonesRes?.local_environment?.air_quality || nearbyZones[0]?.air_quality;

    const livePm25 = Number(
      currentAir?.pm2_5 ??
        hourlyAir?.pm2_5?.[currentHour] ??
        zoneAir?.pm2_5 ??
        dailyMobilityRes?.stats?.average_outdoor_pm25 ??
        25
    );
    const livePm10 = Number(
      currentAir?.pm10 ??
        hourlyAir?.pm10?.[currentHour] ??
        zoneAir?.pm10 ??
        Math.round(livePm25 * 1.6 * 10) / 10
    );
    const liveAqi = Math.round(
      Number(
        currentAir?.us_aqi ??
          hourlyAir?.us_aqi?.[currentHour] ??
          zoneAir?.us_aqi ??
          context?.predicted_aqi ??
          dailyMobilityRes?.stats?.average_outdoor_aqi ??
          livePm25 * 2.4
      )
    );

    // 3. Bangun Rute Aktivitas Nyata (Priority: Active Tracking -> Active Navigation Route -> Persisted GPS Trail -> Backend Daily History -> Local Street Segment)
    let routeSource: ActivityRouteProfile['source'] = 'live_tracking';
    let rawRouteCoords: {
      latitude: number;
      longitude: number;
      timestamp?: string;
      aqi?: number;
      pm25?: number;
      label?: string;
    }[] = [];

    // Helper: jika titik-titik GPS yang terekam berjarak jauh (> 100m, misal dari Rumah ke Kawasan POJ),
    // sambungkan mengikuti geometri jalan non-tol nyata (OSRM avoid_tolls: true)
    const snapSparseWaypointsToStreets = async (
      pts: {
        latitude: number;
        longitude: number;
        timestamp?: string;
        aqi?: number;
        pm25?: number;
        label?: string;
      }[]
    ) => {
      if (pts.length < 2 || pts.length > 12) return pts;
      const stitched: typeof pts = [];

      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const segDist = haversineMeters(a.latitude, a.longitude, b.latitude, b.longitude);

        if (segDist > 100 && segDist < 35000) {
          const roadRoute = await navigationService
            .calculateRoute(
              { latitude: a.latitude, longitude: a.longitude },
              { latitude: b.latitude, longitude: b.longitude },
              { avoid_tolls: true }
            )
            .catch(() => null);

          if (roadRoute && roadRoute.coordinates.length >= 2) {
            roadRoute.coordinates.forEach(([cLon, cLat], rIdx) => {
              if (i > 0 && rIdx === 0) return;
              stitched.push({
                latitude: cLat,
                longitude: cLon,
                timestamp: rIdx === 0 ? a.timestamp : b.timestamp,
              });
            });
            continue;
          }
        }

        if (i === 0) stitched.push(a);
        stitched.push(b);
      }

      return stitched.length >= 2 ? stitched : pts;
    };

    if (storeState.waypoints.length >= 2) {
      routeSource = 'live_tracking';
      rawRouteCoords = await snapSparseWaypointsToStreets(
        storeState.waypoints.map((wp) => ({
          latitude: wp.latitude,
          longitude: wp.longitude,
          timestamp: wp.timestamp,
          aqi: wp.aqi,
          pm25: wp.pm2_5,
          label: wp.zone_name,
        }))
      );
    } else if (
      navState.activeRoute &&
      Array.isArray(navState.activeRoute.coordinates) &&
      navState.activeRoute.coordinates.length >= 2
    ) {
      routeSource = 'live_tracking';
      rawRouteCoords = navState.activeRoute.coordinates.map(([cLon, cLat]) => ({
        latitude: cLat,
        longitude: cLon,
      }));
    } else if (bgWaypoints.length >= 2) {
      routeSource = 'live_tracking';
      rawRouteCoords = await snapSparseWaypointsToStreets(
        bgWaypoints.map((wp) => ({
          latitude: wp.latitude,
          longitude: wp.longitude,
          timestamp: wp.timestamp,
          aqi: wp.aqi,
          pm25: wp.pm2_5,
          label: wp.zone_name,
        }))
      );
    } else if (
      dailyHistoryRes?.combined_waypoints &&
      dailyHistoryRes.combined_waypoints.length >= 2
    ) {
      routeSource = 'daily_history';
      rawRouteCoords = await snapSparseWaypointsToStreets(
        dailyHistoryRes.combined_waypoints.map((wp) => ({
          latitude: wp.latitude,
          longitude: wp.longitude,
          timestamp: wp.timestamp,
          aqi: wp.aqi,
          pm25: wp.pm2_5,
          label: wp.zone_name,
        }))
      );
    } else if (
      dailyMobilityRes?.waypoints &&
      dailyMobilityRes.waypoints.length >= 2
    ) {
      routeSource = 'daily_history';
      rawRouteCoords = await snapSparseWaypointsToStreets(
        dailyMobilityRes.waypoints.map((wp) => ({
          latitude: wp.latitude,
          longitude: wp.longitude,
          timestamp: wp.timestamp,
          aqi: wp.aqi,
          pm25: wp.pm2_5,
          label: wp.zone_name,
        }))
      );
    } else {
      // Pengguna belum berpindah tempat (hanya 1 titik GPS aktif):
      // Tampilkan segmen jalan lokal tepat di titik GPS pengguna saat ini (TIDAK mengarahkan ke jalan tol!)
      routeSource = 'gps_road_corridor';
      const localSeg = getLocalRoadSegmentCoordinates(lat, lon);
      rawRouteCoords = localSeg.coordinates.map(([cLon, cLat]) => ({
        latitude: cLat,
        longitude: cLon,
        label: localSeg.roadName,
      }));
    }

    // Fungsi interpolasi spasial AQI & PM2.5 nyata di setiap koordinat rute berdasarkan zona terdekat + seri hourly Open-Meteo
    const hourlyAqiArr: number[] = Array.isArray(hourlyAir?.us_aqi)
      ? hourlyAir.us_aqi.filter((v: unknown) => typeof v === 'number' && v > 0)
      : [];
    const hourlyPm25Arr: number[] = Array.isArray(hourlyAir?.pm2_5)
      ? hourlyAir.pm2_5.filter((v: unknown) => typeof v === 'number' && v > 0)
      : [];

    const computeLocalAqiAtCoord = (
      cLat: number,
      cLon: number,
      idx: number,
      totalPts: number
    ): { aqi: number; pm25: number; roadLabel: string } => {
      const road = findNearestSemarangRoad(cLat, cLon);
      const roadLabel = road?.n || locationName;

      // Inverse distance weighting terhadap zona-zona polusi terdekat
      let weightedAqi = 0;
      let weightedPm25 = 0;
      let weightSum = 0;

      for (const nz of nearbyZones) {
        const zLat = nz.zone.latitude;
        const zLon = nz.zone.longitude;
        const distKm = Math.max(0.15, haversineMeters(cLat, cLon, zLat, zLon) / 1000);
        const w = 1 / (distKm * distKm);
        const zAqi = nz.air_quality?.us_aqi || Math.round(nz.impact_score * 1.4) || liveAqi;
        const zPm25 = nz.air_quality?.pm2_5 || (zAqi / 150) * 52;
        weightedAqi += zAqi * w;
        weightedPm25 += zPm25 * w;
        weightSum += w;
      }

      const spatialAqi = weightSum > 0 ? weightedAqi / weightSum : liveAqi;
      const spatialPm25 = weightSum > 0 ? weightedPm25 / weightSum : livePm25;

      // Kombinasikan dengan fluktuasi hourly Open-Meteo sepanjang jendela waktu aktivitas
      const hourIdx =
        hourlyAqiArr.length > 0
          ? Math.min(
              hourlyAqiArr.length - 1,
              Math.max(
                0,
                Math.round(
                  ((currentHour - 2 + (idx / Math.max(1, totalPts - 1)) * 2 + 24) % 24)
                )
              )
            )
          : -1;

      const temporalAqi = hourIdx >= 0 ? hourlyAqiArr[hourIdx] : liveAqi;
      const temporalPm25 =
        hourIdx >= 0 && hourlyPm25Arr[hourIdx] ? hourlyPm25Arr[hourIdx] : livePm25;

      const finalCoordAqi = Math.max(
        15,
        Math.round(spatialAqi * 0.65 + temporalAqi * 0.35)
      );
      const finalCoordPm25 =
        Math.round((spatialPm25 * 0.65 + temporalPm25 * 0.35) * 10) / 10;

      return { aqi: finalCoordAqi, pm25: finalCoordPm25, roadLabel };
    };

    const enrichedRouteCoords: ActivityRouteCoordinate[] = rawRouteCoords.map(
      (pt, idx) => {
        const local = computeLocalAqiAtCoord(
          pt.latitude,
          pt.longitude,
          idx,
          rawRouteCoords.length
        );
        return {
          latitude: pt.latitude,
          longitude: pt.longitude,
          aqi: pt.aqi && pt.aqi > 0 ? pt.aqi : local.aqi,
          pm25: pt.pm25 && pt.pm25 > 0 ? pt.pm25 : local.pm25,
          timestamp: pt.timestamp,
          label: pt.label || local.roadLabel,
        };
      }
    );

    // Hitung total jarak nyata (Haversine) sepanjang koordinat rute
    let totalRouteMeters = 0;
    for (let i = 0; i < enrichedRouteCoords.length - 1; i++) {
      totalRouteMeters += haversineMeters(
        enrichedRouteCoords[i].latitude,
        enrichedRouteCoords[i].longitude,
        enrichedRouteCoords[i + 1].latitude,
        enrichedRouteCoords[i + 1].longitude
      );
    }
    if (storeState.totalDistance > totalRouteMeters) {
      totalRouteMeters = storeState.totalDistance;
    }
    const distanceKm = Math.max(0.1, Math.round((totalRouteMeters / 1000) * 100) / 100);

    // Hitung durasi aktivitas nyata dari timestamp waypoints / store / profil
    let recordedDurationMin = 0;
    if (storeState.elapsedSeconds > 30) {
      recordedDurationMin = Math.round(storeState.elapsedSeconds / 60);
    } else if (
      enrichedRouteCoords.length >= 2 &&
      enrichedRouteCoords[0].timestamp &&
      enrichedRouteCoords[enrichedRouteCoords.length - 1].timestamp
    ) {
      const t0 = new Date(enrichedRouteCoords[0].timestamp!).getTime();
      const t1 = new Date(
        enrichedRouteCoords[enrichedRouteCoords.length - 1].timestamp!
      ).getTime();
      if (t1 > t0) {
        recordedDurationMin = Math.round((t1 - t0) / 60000);
      }
    }

    const trackedOutdoorMin = bgWaypoints
      .filter((wp) => wp.classification === 'outdoor' && !wp.is_stay)
      .reduce((acc, wp) => acc + (wp.duration_minutes || 0), 0);
    const trackedIndoorMin = bgWaypoints
      .filter((wp) => wp.classification === 'indoor' || wp.is_stay)
      .reduce((acc, wp) => acc + (wp.duration_minutes || 0), 0);

    const estimatedWalkMinutesFromDist = Math.max(
      5,
      Math.round((distanceKm / 4.6) * 60)
    );
    const profileOutdoorMin =
      userProfile?.waktu_di_jalan && userProfile.waktu_di_jalan > 0
        ? Math.round(userProfile.waktu_di_jalan * 60)
        : 0;

    const requestedOutdoorMinutes =
      context?.total_outdoor_minutes && context.total_outdoor_minutes > 0
        ? context.total_outdoor_minutes
        : recordedDurationMin > 0
          ? recordedDurationMin
          : trackedOutdoorMin > 0
            ? trackedOutdoorMin
            : dailyHistoryRes?.daily_stats?.total_outdoor_minutes &&
                dailyHistoryRes.daily_stats.total_outdoor_minutes > 0
              ? dailyHistoryRes.daily_stats.total_outdoor_minutes
              : profileOutdoorMin > 0
                ? profileOutdoorMin
                : estimatedWalkMinutesFromDist;

    // 4. Kirim batch mobilitas nyata ke aurabackend (Groq Pulmonologist AI)
    let backendBatch: Awaited<ReturnType<typeof mobilityService.sendBatch>> | null =
      null;
    try {
      const sampleStep = Math.max(1, Math.floor(enrichedRouteCoords.length / 8));
      const sampledWaypoints = enrichedRouteCoords
        .filter((_, idx) => idx % sampleStep === 0 || idx === enrichedRouteCoords.length - 1)
        .map((pt, _, arr) => ({
          latitude: pt.latitude,
          longitude: pt.longitude,
          timestamp: pt.timestamp || new Date().toISOString(),
          duration_minutes: Math.max(
            1,
            Math.round((requestedOutdoorMinutes / Math.max(1, arr.length)) * 10) / 10
          ),
          is_stay: false,
        }));

      backendBatch = await mobilityService.sendBatch({
        user_id: userProfile?.uid,
        date: today,
        waypoints: sampledWaypoints,
      });
    } catch (err) {
      console.log(
        '[aiService.analyzePollutionHealthImpact] Menggunakan kalkulasi telemetri langsung:',
        (err as Error)?.message || err
      );
    }

    const stats = backendBatch?.stats;
    const analysis = backendBatch?.analysis;

    const outdoorMinutes = Math.max(
      1,
      Math.round(
        context?.total_outdoor_minutes ||
          recordedDurationMin ||
          stats?.total_outdoor_minutes ||
          requestedOutdoorMinutes
      )
    );
    const indoorMinutes = Math.round(
      stats?.total_indoor_minutes ||
        trackedIndoorMin ||
        dailyHistoryRes?.daily_stats?.total_indoor_minutes ||
        0
    );

    // Hitung rata-rata & puncak AQI / PM2.5 langsung dari seluruh koordinat rute nyata
    const routeAvgAqi = Math.round(
      enrichedRouteCoords.reduce((acc, c) => acc + c.aqi, 0) /
        Math.max(1, enrichedRouteCoords.length)
    );
    const routeAvgPm25 =
      Math.round(
        (enrichedRouteCoords.reduce((acc, c) => acc + c.pm25, 0) /
          Math.max(1, enrichedRouteCoords.length)) *
          10
      ) / 10;

    let peakCoord = enrichedRouteCoords[0];
    for (const c of enrichedRouteCoords) {
      if (!peakCoord || c.aqi > peakCoord.aqi) {
        peakCoord = c;
      }
    }

    const avgAqi = routeAvgAqi || liveAqi;
    const avgPm25 = routeAvgPm25 || livePm25;
    const worstAreaName =
      peakCoord?.label || stats?.worst_area_name || locationName;
    const worstAreaAqi = Math.max(
      peakCoord?.aqi || avgAqi,
      stats?.worst_area_aqi || avgAqi
    );

    const startLabel =
      enrichedRouteCoords[0]?.label ||
      findNearestSemarangRoad(
        enrichedRouteCoords[0]?.latitude ?? lat,
        enrichedRouteCoords[0]?.longitude ?? lon
      )?.n ||
      locationName;
    const endCoord = enrichedRouteCoords[enrichedRouteCoords.length - 1];
    const endLabel =
      endCoord?.label ||
      findNearestSemarangRoad(endCoord?.latitude ?? lat, endCoord?.longitude ?? lon)
        ?.n ||
      locationName;

    // Bangun seri sparkline dinamis (16 segmen) langsung dari nilai AQI di sepanjang koordinat rute
    const bucketCount = Math.min(16, Math.max(4, enrichedRouteCoords.length));
    const exposureSeries: number[] = [];
    for (let b = 0; b < bucketCount; b++) {
      const idx = Math.min(
        enrichedRouteCoords.length - 1,
        Math.floor((b / Math.max(1, bucketCount - 1)) * (enrichedRouteCoords.length - 1))
      );
      exposureSeries.push(enrichedRouteCoords[idx].aqi);
    }

    const avgSpeedKmh =
      Math.round((distanceKm / Math.max(0.05, outdoorMinutes / 60)) * 10) / 10;

    const activityRoute: ActivityRouteProfile = {
      coordinates: enrichedRouteCoords,
      distance_km: distanceKm,
      duration_minutes: outdoorMinutes,
      avg_speed_kmh: avgSpeedKmh,
      start_label: startLabel,
      end_label: endLabel,
      peak_label: worstAreaName,
      peak_aqi: worstAreaAqi,
      exposure_series: exposureSeries,
      source: routeSource,
    };

    // ─── MODEL BIOFISIKA 1: BEBAN TERMAL TUBUH (ANALOGI LOGIS SUHU & KALOR) ───
    // Rumus Steadman / NOAA Heat Index + Akumulasi Kalor Aktivitas Luar Ruangan
    const baseApparentTemp =
      typeof currentWeather?.apparent_temperature === 'number'
        ? currentWeather.apparent_temperature
        : ambientTempC +
          0.33 *
            ((relativeHumidityPct / 100) *
              6.105 *
              Math.exp((17.27 * ambientTempC) / (237.7 + ambientTempC))) -
          0.7 * (windSpeedKmh / 3.6) -
          4.0;
    const activityHeatGain =
      Math.min(2.6, (outdoorMinutes / 90) * 1.45) +
      Math.min(1.1, Math.max(0, uvIndex - 3) * 0.16);
    const heatIndexC = Math.round((baseApparentTemp + activityHeatGain) * 10) / 10;
    const thermalDeltaC = Math.round((heatIndexC - ambientTempC) * 10) / 10;

    let thermalIndicator: PollutionHealthIndicator;
    if (heatIndexC < 32.0) {
      thermalIndicator = {
        value: `${Math.round(heatIndexC)}°C`,
        status: `Sejuk (Udara ${Math.round(ambientTempC)}°C)`,
        description: 'Suhu Terasa',
        sub_label: `Kelembapan ${Math.round(relativeHumidityPct)}%`,
        severity: 'optimal',
      };
    } else if (heatIndexC < 36.0) {
      thermalIndicator = {
        value: `${Math.round(heatIndexC)}°C`,
        status: `Hangat (Udara ${Math.round(ambientTempC)}°C)`,
        description: 'Suhu Terasa',
        sub_label: `Kelembapan ${Math.round(relativeHumidityPct)}%`,
        severity: 'mild',
      };
    } else {
      thermalIndicator = {
        value: `${Math.round(heatIndexC)}°C`,
        status: `Gerah (Udara ${Math.round(ambientTempC)}°C)`,
        description: 'Suhu Terasa',
        sub_label: `Kelembapan ${Math.round(relativeHumidityPct)}%`,
        severity: 'moderate',
      };
    }

    // ─── MODEL BIOFISIKA 2: KUALITAS HIRUP PARU ───
    const weightKg =
      userProfile?.berat_badan && userProfile.berat_badan >= 25
        ? userProfile.berat_badan
        : 62;
    const minuteVentilationLpm = Math.max(11.0, Math.min(20.0, weightKg * 0.22));
    const inhaledAirLiters = Math.round(minuteVentilationLpm * outdoorMinutes);
    const inhaledPm25Ug =
      Math.round((inhaledAirLiters / 1000) * avgPm25 * 10) / 10;

    const cleanAirEfficiencyPct = Math.max(
      76,
      Math.min(
        99,
        Math.round(100 - avgPm25 * 0.16 - Math.min(8, (outdoorMinutes / 60) * 2.4))
      )
    );

    let oxygenIndicator: PollutionHealthIndicator;
    if (avgAqi <= 75) {
      oxygenIndicator = {
        value: `${cleanAirEfficiencyPct}%`,
        status: 'Udara hirup bersih',
        description: 'Kualitas Hirup',
        sub_label: `~${inhaledPm25Ug} µg debu terhirup`,
        severity: 'optimal',
      };
    } else if (avgAqi <= 120) {
      oxygenIndicator = {
        value: `${cleanAirEfficiencyPct}%`,
        status: `Terpapar ~${inhaledPm25Ug} µg debu`,
        description: 'Kualitas Hirup',
        sub_label: `Selama ${outdoorMinutes} mnt di luar`,
        severity: 'mild',
      };
    } else {
      oxygenIndicator = {
        value: `${cleanAirEfficiencyPct}%`,
        status: `Beban debu ~${inhaledPm25Ug} µg`,
        description: 'Kualitas Hirup',
        sub_label: `Udara cukup berpolusi`,
        severity: 'moderate',
      };
    }

    // ─── MODEL BIOFISIKA 3: KONDISI KULIT ───
    const dermalOxidativeScore = Math.min(
      100,
      Math.round(
        avgPm25 * 0.72 +
          livePm10 * 0.22 +
          uvIndex * 4.5 +
          Math.min(20, (outdoorMinutes / 60) * 9)
      )
    );

    let skinIndicator: PollutionHealthIndicator;
    if (dermalOxidativeScore < 40) {
      skinIndicator = {
        value: 'Aman',
        status: `Paparan UV & debu rendah`,
        description: 'Kondisi Kulit',
        severity: 'optimal',
      };
    } else if (dermalOxidativeScore < 68) {
      skinIndicator = {
        value: 'Iritasi Ringan',
        status: `Terpapar debu & UV ${uvIndex.toFixed(0)}`,
        description: 'Kondisi Kulit',
        severity: 'mild',
      };
    } else {
      skinIndicator = {
        value: 'Rawan Kusam',
        status: `Debu tinggi & UV ${uvIndex.toFixed(0)}`,
        description: 'Kondisi Kulit',
        severity: 'moderate',
      };
    }

    // ─── MODEL BIOFISIKA 4: CAIRAN HILANG (ESTIMASI KERINGAT) ───
    const baseSweatRateMlPerHour = weightKg * 4.8;
    const thermalMultiplier = 1 + Math.max(0, heatIndexC - 28.0) * 0.085;
    const hourlySweatRateMl = baseSweatRateMlPerHour * thermalMultiplier;
    const estimatedSweatLossMl = Math.max(
      90,
      Math.round((hourlySweatRateMl * (outdoorMinutes / 60)) / 10) * 10
    );
    const recommendedWaterGlasses = Math.max(
      1,
      Math.ceil(estimatedSweatLossMl / 220)
    );
    const dehydrationScorePct = Math.min(
      96,
      Math.max(18, Math.round((estimatedSweatLossMl / 750) * 100))
    );

    let dehydrationIndicator: PollutionHealthIndicator;
    if (estimatedSweatLossMl < 240) {
      dehydrationIndicator = {
        value: `~${estimatedSweatLossMl} mL`,
        status: `Minum +${recommendedWaterGlasses} gelas air`,
        description: 'Cairan Hilang',
        severity: 'optimal',
      };
    } else if (estimatedSweatLossMl < 480) {
      dehydrationIndicator = {
        value: `~${estimatedSweatLossMl} mL`,
        status: `Butuh +${recommendedWaterGlasses} gelas air`,
        description: 'Cairan Hilang',
        severity: 'mild',
      };
    } else {
      dehydrationIndicator = {
        value: `~${estimatedSweatLossMl} mL`,
        status: `Wajib minum +${recommendedWaterGlasses} gelas`,
        description: 'Cairan Hilang',
        severity: 'moderate',
      };
    }

    // ─── SKOR DAMPAK INTEGRATIF & PROFIL RISIKO PENYAKIT SPESIFIK ───
    const computedImpactScore =
      Math.round(
        Math.min(
          98,
          Math.max(
            14,
            (100 - cleanAirEfficiencyPct) * 1.45 +
              (thermalIndicator.score_pct || 40) * 0.32 +
              dermalOxidativeScore * 0.22 +
              dehydrationScorePct * 0.18
          )
        ) * 10
      ) / 10;

    const finalImpactScore =
      analysis?.impact_score && analysis.impact_score > 0
        ? Math.round(((analysis.impact_score + computedImpactScore) / 2) * 10) / 10
        : computedImpactScore;

    const finalRiskLevel =
      finalImpactScore >= 78
        ? 'Berbahaya'
        : finalImpactScore >= 58
          ? 'Tinggi'
          : finalImpactScore >= 36
            ? 'Sedang'
            : 'Rendah';

    const ispaRiskPct = Math.min(
      94,
      Math.max(
        16,
        Math.round(avgPm25 * 0.95 + (outdoorMinutes / 60) * 14 + (avgAqi > 110 ? 12 : 0))
      )
    );
    const rhinitisRiskPct = Math.min(
      92,
      Math.max(18, Math.round(livePm10 * 0.65 + avgAqi * 0.28 + (outdoorMinutes / 60) * 10))
    );
    const heatExhaustionRiskPct = Math.min(
      90,
      Math.max(12, Math.round((thermalIndicator.score_pct || 35) * 0.65 + dehydrationScorePct * 0.35))
    );
    const dermatitisRiskPct = Math.min(
      88,
      Math.max(14, Math.round(dermalOxidativeScore * 0.85))
    );

    const toRiskLabel = (pct: number): 'Rendah' | 'Sedang' | 'Tinggi' =>
      pct >= 65 ? 'Tinggi' : pct >= 38 ? 'Sedang' : 'Rendah';

    const diseaseRisks: ActivityDiseaseRisk[] = [
      {
        id: 'ispa_bronchial',
        name: 'ISPA & Iritasi Trakeobronkial Akut',
        category: 'Respirasi',
        risk_pct: ispaRiskPct,
        risk_level: toRiskLabel(ispaRiskPct),
        mechanism: `Inhalasi ~${inhaledPm25Ug} µg PM2.5 selama ${outdoorMinutes} menit aktivitas luar memicu stres oksidatif epitel bronkus dan penurunan klirens mukosiliar.`,
        early_symptoms: ['Tenggorokan gatal/kering', 'Batuk kering refleks', 'Napas terasa berat'],
        prevention_tip: 'Gunakan respirator KF94/N95 saat melewati koridor padat kendaraan.',
      },
      {
        id: 'rhinitis_mucosa',
        name: 'Rhinitis Polutan & Iritasi Konjungtiva',
        category: 'Mukosa & Alergi',
        risk_pct: rhinitisRiskPct,
        risk_level: toRiskLabel(rhinitisRiskPct),
        mechanism: `Paparan PM10 (${livePm10} µg/m³) dan emisi lalu lintas di sekitar ${worstAreaName} menstimulasi pelepasan histamin pada mukosa hidung dan lapisan air mata.`,
        early_symptoms: ['Bersin berulang', 'Hidung tersumbat/meler', 'Mata perih atau berair'],
        prevention_tip: 'Lakukan irigasi hidung dengan larutan saline (NaCl 0.9%) setelah pulang.',
      },
      {
        id: 'thermal_exhaustion',
        name: 'Kelelahan Termal (Heat Stress) & Defisit Elektrolit',
        category: 'Termoregulasi',
        risk_pct: heatExhaustionRiskPct,
        risk_level: toRiskLabel(heatExhaustionRiskPct),
        mechanism: `Beban termal terasa HI ${heatIndexC.toFixed(1)}°C (RH ${Math.round(relativeHumidityPct)}%) menguras ~${estimatedSweatLossMl} mL cairan keringat dan meningkatkan beban kardiovaskular.`,
        early_symptoms: ['Cepat lelah & pusing ringan', 'Haus berlebih', 'Konsentrasi menurun'],
        prevention_tip: `Minum bertahap minimal ${recommendedWaterGlasses * 220} mL air (${recommendedWaterGlasses} gelas) dan berteduh tiap 30 menit.`,
      },
      {
        id: 'dermal_oxidation',
        name: 'Dermatitis Kontak Partikulat & Oksidasi Barier Kulit',
        category: 'Dermatologi',
        risk_pct: dermatitisRiskPct,
        risk_level: toRiskLabel(dermatitisRiskPct),
        mechanism: `Sinergi radikal bebas polutan udara dan radiasi UV (${uvIndex.toFixed(1)}) mengoksidasi squalene sebum, menyumbat pori, dan melemahkan skin barrier.`,
        early_symptoms: ['Kulit kusam/kemerahan', 'Komedo & pori tersumbat', 'Gatal ringan di wajah'],
        prevention_tip: 'Segera cuci wajah dengan pembersih pH seimbang & gunakan sunscreen antioksidan.',
      },
    ];

    const clinicalFindings: string[] = [
      `${outdoorMinutes} menit di luar setara menghirup ~${inhaledPm25Ug} µg debu PM2.5.`,
      `Suhu udara ${Math.round(ambientTempC)}°C dengan lembap ${Math.round(relativeHumidityPct)}% terasa seperti ${Math.round(heatIndexC)}°C di tubuh.`,
      `Tubuh kehilangan ~${estimatedSweatLossMl} mL keringat (setara ${recommendedWaterGlasses} gelas air).`,
    ];

    const defaultStructuredRecommendations: PollutionRecommendation[] = [
      {
        id: '1',
        title: 'Pakai Masker',
        description: 'Cegah batuk & debu PM2.5',
        icon_type: 'mask',
      },
      {
        id: '2',
        title: `Minum +${recommendedWaterGlasses} Gelas Air`,
        description: 'Ganti keringat & cegah lemas',
        icon_type: 'water',
      },
      {
        id: '3',
        title: 'Pakai Sunscreen',
        description: 'Cegah kulit kusam & iritasi UV',
        icon_type: 'mobility',
      },
    ];

    const telemetry: EnvironmentalTelemetrySnapshot = {
      ambient_temp_c: Math.round(ambientTempC * 10) / 10,
      relative_humidity_pct: Math.round(relativeHumidityPct),
      heat_index_c: heatIndexC,
      thermal_delta_c: thermalDeltaC,
      uv_index: Math.round(uvIndex * 10) / 10,
      wind_speed_kmh: Math.round(windSpeedKmh * 10) / 10,
      outdoor_aqi: avgAqi,
      pm25_ugm3: avgPm25,
      pm10_ugm3: livePm10,
      inhaled_air_liters: inhaledAirLiters,
      inhaled_pm25_ug: inhaledPm25Ug,
      estimated_sweat_loss_ml: estimatedSweatLossMl,
      recommended_water_glasses: recommendedWaterGlasses,
    };

    const doctorDiagnosisText =
      analysis?.doctor_diagnosis ||
      `Selama ${outdoorMinutes} menit aktivitas luar ruangan di sekitar ${worstAreaName} (AQI ${avgAqi}, PM2.5 ${avgPm25} µg/m³), paru-paru Anda memventilasi sekitar ${inhaledAirLiters} liter udara dengan estimasi deposisi ${inhaledPm25Ug} µg partikulat halus. Secara simultan, suhu udara ${ambientTempC.toFixed(1)}°C dengan kelembapan ${Math.round(relativeHumidityPct)}% menghasilkan beban termal terasa (Heat Index) ${heatIndexC.toFixed(1)}°C yang memicu evaporasi keringat ~${estimatedSweatLossMl} mL. Kombinasi ini meningkatkan risiko iritasi mukosa trakeobronkial, mengentalnya sekret saluran napas bila hidrasi kurang, serta stres oksidatif pada barier kulit.`;

    const summaryText =
      analysis?.summary ||
      `Skor beban kesehatan aktivitas ${finalImpactScore}/100 (${finalRiskLevel}) dengan dosis inhalasi ${inhaledPm25Ug} µg PM2.5 dan beban termal HI ${heatIndexC.toFixed(1)}°C.`;

    return {
      success: true,
      data: {
        oxygen_level: oxygenIndicator,
        body_temperature: thermalIndicator,
        thermal_stress: thermalIndicator,
        skin_condition: skinIndicator,
        dehydration_level: dehydrationIndicator,
        telemetry,
        activity_route: activityRoute,
        disease_risks: diseaseRisks,
        clinical_findings: clinicalFindings,
        methodology_explanation:
          'Karena suhu inti tubuh tidak dapat diukur secara langsung hanya melalui perangkat lunak tanpa sensor termometer fisik, AURA memodelkan Beban Termal Tubuh (Heat Index), Dosis Inhalasi PM2.5, Evaporasi Keringat (mL), dan Oksidasi Epidermis secara matematis dari telemetri cuaca/polusi real-time, GPS mobilitas, dan antropometri Anda.',
        recommendations: defaultStructuredRecommendations,
        doctor_diagnosis: doctorDiagnosisText,
        summary: summaryText,
        impact_score: finalImpactScore,
        risk_level: finalRiskLevel,
        stats: {
          total_indoor_minutes: indoorMinutes,
          total_outdoor_minutes: outdoorMinutes,
          average_outdoor_aqi: avgAqi,
          average_outdoor_pm25: avgPm25,
          max_aqi: worstAreaAqi,
          worst_area_name: worstAreaName,
          worst_area_aqi: worstAreaAqi,
        },
        general_advice: 'Periksa ke dokter jika muncul gejala sesak, batuk menetap, atau pusing termal!',
        severity_level:
          finalRiskLevel === 'Berbahaya'
            ? 'critical'
            : finalRiskLevel === 'Tinggi'
              ? 'high'
              : finalRiskLevel === 'Sedang'
                ? 'moderate'
                : 'low',
        analyzed_at: new Date().toISOString(),
      },
    };
  },
};

