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

export interface CoughPredictionResponse {
  prediction: string; // 'Wheeze' | 'Crackle' | 'Normal' | 'Crackle + Wheeze'
  confidence: number;
  status: 'healthy' | 'moderate' | 'warning' | string;
  health_score: number;
  severity: string;
  clinical_interpretation: string;
  all_probabilities: Record<string, number>;
  environmental_correlation?: CoughEnvironmentalCorrelation;
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
 * 3. Pollution 1-Week Health Impact AI (Level Oksigen, Suhu Badan, Kulit, Dehidrasi, Rekomendasi)
 */
export interface PollutionHealthIndicator {
  value: string;
  status: string;
  description?: string;
}

export interface PollutionRecommendation {
  id: string;
  title: string;
  description: string;
  icon_type: 'mask' | 'water' | 'mobility' | string;
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

export interface PollutionHealthAnalysisData {
  oxygen_level: PollutionHealthIndicator;
  body_temperature: PollutionHealthIndicator;
  skin_condition: PollutionHealthIndicator;
  dehydration_level: PollutionHealthIndicator;
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

