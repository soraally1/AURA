/**
 * Type Definitions for AURA AI Services:
 * 1. Cough AI (ONNX ICBHI) - Deteksi & Analisis Batuk
 * 2. Skin Multimodal (Groq AI qwen/qwen3.8-27b + Google SCIN Validation)
 */

export interface CoughEnvironmentalCorrelation {
  total_outdoor_minutes?: number;
  average_outdoor_pm25?: number;
  worst_area_name?: string;
  worst_area_aqi?: number;
  high_exposure_flag?: boolean;
  clinical_correlation_notes?: string;
}

export interface CoughAcousticRegion {
  id: string;
  label: string;
  short_tag: string;
  kind: 'normal' | 'wheeze' | 'crackle' | 'tonal' | string;
  x_start_pct: number;
  x_end_pct: number;
  y_top_pct: number;
  y_bottom_pct: number;
  time_start_sec: number;
  time_end_sec: number;
  freq_low_hz: number;
  freq_high_hz: number;
  detail: string;
}

export interface CoughMelAxisTick {
  label: string;
  freq_hz: number;
  y_pct: number;
}

export interface CoughExplanationStep {
  step: string;
  title: string;
  metric: string;
  description: string;
}

export interface CoughAcousticMetrics {
  duration_sec: number;
  window_sec: number;
  recorded_duration_sec?: number;
  peak_frequency_hz: number;
  spectral_centroid_hz: number;
  transient_burst_count: number;
  tonal_persistency_pct: number;
  low_band_pct: number;
  mid_band_pct: number;
  high_band_pct: number;
  bandpass_retention_pct?: number;
  max_energy_db?: number;
}

export interface CoughVisualization {
  spectrogram_image: string;
  waveform_envelope: number[];
  detected_regions: CoughAcousticRegion[];
  mel_axis_ticks: CoughMelAxisTick[];
  bandpass_box?: {
    y_top_pct: number;
    y_bottom_pct: number;
  };
  acoustic_metrics: CoughAcousticMetrics;
  explanation_steps: CoughExplanationStep[];
  visual_summary?: string;
}

export interface CoughPredictionResponse {
  prediction: string; // 'Wheeze' | 'Crackle' | 'Normal' | 'Crackle + Wheeze'
  confidence: number;
  status: 'healthy' | 'moderate' | 'warning' | string;
  health_score: number;
  severity: string;
  clinical_interpretation: string;
  all_probabilities: Record<string, number>;
  environmental_correlation?: CoughEnvironmentalCorrelation;
  visualization?: CoughVisualization;
}

export interface CoughMobilityContext {
  outdoorMinutes?: number;
  pm25?: number;
  worstArea?: string;
  worstAqi?: number;
  usia?: number;
}

export interface ScanSkinContext {
  total_outdoor_minutes?: number;
  total_indoor_minutes?: number;
  average_outdoor_aqi?: number;
  average_outdoor_pm25?: number;
  max_aqi?: number;
  worst_area_name?: string;
  worst_area_aqi?: number;
  city?: string;
  temperature?: number;
  relative_humidity?: number;
  uv_index?: number;
  wind_speed?: number;
  pm10?: number;
  usia?: number;
  tinggi_badan?: number;
  berat_badan?: number;
}

export interface EnvironmentalFactor {
  score: number;
  level: string; // 'Rendah' | 'Sedang' | 'Tinggi'
  analysis: string;
}

export interface SkinEnvironmentalImpact {
  pollution: EnvironmentalFactor;
  weather: EnvironmentalFactor;
  sun_uv: EnvironmentalFactor;
}

export interface SkinMetrics {
  overall_health_score: number;
  hydration_score: number;
  redness_score: number;
  barrier_integrity_score: number;
  pollution_clog_score: number;
  uv_damage_score: number;
}

export interface ScinValidation {
  primary_condition: string;
  textures: string[];
  symptoms: string[];
  body_part: string;
  is_scin_verified: boolean;
}

export interface FaceGeometry {
  detected: boolean;
  tilt_deg: number;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  landmarks: {
    forehead: [number, number];
    left_eye: [number, number];
    right_eye: [number, number];
    nose_tip: [number, number];
    left_cheek: [number, number];
    right_cheek: [number, number];
    mouth_center: [number, number];
    chin: [number, number];
  };
  contour: [number, number][];
  t_zone: [number, number][];
  left_cheek_zone: [number, number][];
  right_cheek_zone: [number, number][];
}

export interface SkinCvMetrics {
  tzone_sebum_fluorescence: number;
  erythema_index: number;
  melanin_uv_contrast: number;
  uniformity_score: number;
  skin_coverage_pct: number;
  image_width: number;
  image_height: number;
}

export interface SkinCvAnalysis {
  face_geometry: FaceGeometry;
  cropped_face_image?: string;
  woodlamp_image: string;
  geometry_mesh_image: string;
  micro_analysis_image: string;
  cv_metrics: SkinCvMetrics;
  woods_lamp_findings: string[];
}

export interface SkinScanData {
  condition: string;
  condition_indonesian: string;
  confidence: number;
  fitzpatrick_skin_type: string;
  fitzpatrick_description: string;
  model_used: string;
  scin_validation: ScinValidation;
  environmental_impact: SkinEnvironmentalImpact;
  skin_metrics: SkinMetrics;
  severity: 'mild' | 'moderate' | 'severe' | string;
  recommendations: string[];
  summary: string;
  medical_disclaimer: string;
  cv_analysis?: SkinCvAnalysis;
}

export interface SkinScanResponse {
  success: boolean;
  data: SkinScanData;
}

export interface ScinMetadataResponse {
  fitzpatrick_types: Record<string, string>;
  scin_textures: string[];
  scin_symptoms: string[];
  environmental_conditions: Record<string, string[]>;
}

/**
 * 3. Pollution & Activity Health Impact AI
 *    (Oksigenasi & Dosis Hirup, Beban Termal Tubuh / Heat Index, Barier Kulit, Defisit Cairan, Risiko Penyakit & Rekomendasi)
 */
export interface PollutionHealthIndicator {
  value: string;
  status: string;
  description?: string;
  sub_label?: string;
  score_pct?: number;
  severity?: 'optimal' | 'mild' | 'moderate' | 'high';
  analogy_note?: string;
  formula_basis?: string;
}

export interface ActivityDiseaseRisk {
  id: string;
  name: string;
  category: 'Respirasi' | 'Mukosa & Alergi' | 'Termoregulasi' | 'Dermatologi';
  risk_pct: number;
  risk_level: 'Rendah' | 'Sedang' | 'Tinggi';
  mechanism: string;
  early_symptoms: string[];
  prevention_tip: string;
}

export interface EnvironmentalTelemetrySnapshot {
  ambient_temp_c: number;
  relative_humidity_pct: number;
  heat_index_c: number;
  thermal_delta_c: number;
  uv_index: number;
  wind_speed_kmh: number;
  outdoor_aqi: number;
  pm25_ugm3: number;
  pm10_ugm3: number;
  inhaled_air_liters: number;
  inhaled_pm25_ug: number;
  estimated_sweat_loss_ml: number;
  recommended_water_glasses: number;
}

export interface PollutionRecommendation {
  id: string;
  title: string;
  description: string;
  icon_type: 'mask' | 'water' | 'mobility' | 'skin' | string;
  priority?: 'Utama' | 'Tinggi' | 'Rutin';
  metric_badge?: string;
}

export interface PollutionExposureStats {
  total_indoor_minutes?: number;
  total_outdoor_minutes?: number;
  average_outdoor_aqi?: number;
  average_outdoor_pm25?: number;
  max_aqi?: number;
  worst_area_name?: string;
  worst_area_aqi?: number;
}

export interface ActivityRouteCoordinate {
  latitude: number;
  longitude: number;
  aqi: number;
  pm25: number;
  timestamp?: string;
  label?: string;
}

export interface ActivityRouteProfile {
  coordinates: ActivityRouteCoordinate[];
  distance_km: number;
  duration_minutes: number;
  avg_speed_kmh: number;
  start_label: string;
  end_label: string;
  peak_label: string;
  peak_aqi: number;
  exposure_series: number[];
  source: 'live_tracking' | 'daily_history' | 'gps_road_corridor';
}

export interface PollutionHealthAnalysisData {
  oxygen_level: PollutionHealthIndicator;
  /**
   * Analogi Biometrik Beban Termal Tubuh (Heat Index & Akumulasi Kalor Aktivitas).
   * Disimpan juga pada key `body_temperature` untuk kompatibilitas mundur.
   */
  body_temperature: PollutionHealthIndicator;
  thermal_stress?: PollutionHealthIndicator;
  skin_condition: PollutionHealthIndicator;
  dehydration_level: PollutionHealthIndicator;
  telemetry?: EnvironmentalTelemetrySnapshot;
  activity_route?: ActivityRouteProfile;
  disease_risks?: ActivityDiseaseRisk[];
  clinical_findings?: string[];
  methodology_explanation?: string;
  recommendations: PollutionRecommendation[];
  general_advice?: string;
  doctor_advice?: string;
  doctor_diagnosis?: string;
  summary?: string;
  impact_score?: number;
  risk_level?: string;
  stats?: PollutionExposureStats;
  severity_level?: 'low' | 'moderate' | 'high' | 'critical' | string;
  analyzed_at?: string;
}

export interface PollutionHealthAnalysisResponse {
  success: boolean;
  data: PollutionHealthAnalysisData;
  message?: string;
}

export interface PollutionHealthAnalysisContext {
  lat?: number;
  lon?: number;
  location_name?: string;
  zone_id?: string;
  average_risk_score?: number;
  peak_risk_day?: string;
  predicted_aqi?: number;
  total_outdoor_minutes?: number;
}

