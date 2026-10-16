export type ImpactLevel = 'Aman' | 'Waspada' | 'Berbahaya';
export type TrafficSeverity = 'Lancar' | 'Sedang' | 'Padat' | 'Sangat Padat';

export interface AirQuality {
  pm2_5: number;
  pm10: number;
  carbon_monoxide: number;
  nitrogen_dioxide?: number;
  sulphur_dioxide?: number;
  ozone?: number;
  us_aqi: number;
  time?: string;
}

export interface Zone {
  id: string;
  name: string;
  description: string;
  category: 'traffic_corridor' | 'industrial_area' | 'intersection' | 'transit_hub' | string;
  latitude: number;
  longitude: number;
  geohash?: string;
  radius_meters: number;
  congestion_base_level: TrafficSeverity;
  congestion_index: number;
  peak_hours: string[];
  pollution_sources: string[];
  historical_traffic_factor?: Record<string, number>;
}

export interface NearbyZoneResult {
  zone: Zone;
  distance_km: number;
  air_quality?: AirQuality;
  congestion_status: TrafficSeverity;
  impact_score: number;
  impact_level: ImpactLevel;
}

export interface NearbyZonesData {
  user_coordinates: {
    latitude: number;
    longitude: number;
  };
  search_radius_km: number;
  zones_found_count: number;
  nearby_zones: NearbyZoneResult[];
  local_environment?: {
    air_quality?: AirQuality;
    hourly_aq?: {
      time: string[];
      pm2_5: number[];
      pm10: number[];
      carbon_monoxide: number[];
      nitrogen_dioxide: number[];
      us_aqi: number[];
    };
    source?: string;
  };
  summary_advice: string;
}

export interface DailyForecast {
  date: string; // YYYY-MM-DD
  day_name: string; // Senin, Selasa, dst.
  health_risk_score: number; // 0 - 100
  impact_level: ImpactLevel;
  predicted_pm2_5: number;
  predicted_pm10: number;
  predicted_co: number;
  predicted_aqi: number;
  traffic_congestion_idx: number;
  traffic_severity: TrafficSeverity;
  humidity_percent: number;
  wind_speed_kmh: number;
  wind_direction_deg?: number;
  wind_direction_compass: string;
  dispersion_condition: string;
  precipitation_mm: number;
  temperature_c?: number;
  weather_condition?: string;
  summary: string;
  recommendations: string[];
}

export interface WeeklyAnalysisResponse {
  location_name: string;
  latitude: number;
  longitude: number;
  zone_category?: string;
  generated_at?: string;
  overall_weekly_status: ImpactLevel;
  average_risk_score: number;
  peak_risk_day: string;
  daily_forecast: DailyForecast[];
  general_advice: string[];
}
