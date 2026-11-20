import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import Svg, {
  G,
  Path,
  Circle,
  Text as SvgText,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Rect,
} from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import {
  JATENG_REGIONS,
  JATENG_MAP_VIEWBOX,
  JATENG_MAP_WIDTH,
  JATENG_MAP_HEIGHT,
  JatengRegionPath,
} from '@/data/jatengMapData';
import {
  jatengHealthService,
  JatengRegionHealth,
  MAP_LEGEND_RANGES,
} from '@/services/jatengHealthApi';
import { getLandmarkIcon } from './JatengLandmarkIcons';

interface JatengInteractiveMapProps {
  onSelectRegion?: (region: JatengRegionHealth) => void;
  selectedRegionId?: string;
}

type DisplayMetric = 'aqi' | 'diseases';
type MapOverlayOption = 'icons' | 'labels';

export function JatengInteractiveMap({
  onSelectRegion,
  selectedRegionId = 'reg_33_74', // Default Semarang
}: JatengInteractiveMapProps) {
  const [activeRegionId, setActiveRegionId] = useState<string>(selectedRegionId);
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);
  const [metricMode, setMetricMode] = useState<DisplayMetric>('aqi');
  const [mapOverlay, setMapOverlay] = useState<MapOverlayOption>('icons');
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Ambil data kesehatan daerah aktif dari service
  const currentRegionData = useMemo(() => {
    return jatengHealthService.getRegionData(activeRegionId);
  }, [activeRegionId]);

  const hoveredRegionData = useMemo(() => {
    return hoveredRegionId ? jatengHealthService.getRegionData(hoveredRegionId) : null;
  }, [hoveredRegionId]);

  // Handler saat wilayah dipilih (tap)
  const handleRegionPress = useCallback(
    (regionId: string) => {
      setActiveRegionId(regionId);
      const data = jatengHealthService.getRegionData(regionId);
      if (onSelectRegion && data) {
        onSelectRegion(data);
      }
    },
    [onSelectRegion]
  );

  // Penentuan warna dinamis berdasarkan mode metrik (AQI vs Kasus Penyakit)
  const getRegionFillColor = useCallback(
    (region: JatengRegionPath, isSelected: boolean, isHovered: boolean) => {
      if (isSelected) {
        return '#F59E0B'; // Highlight emas/amber untuk wilayah aktif
      }
      if (isHovered) {
        return '#38BDF8'; // Highlight biru langit saat disentuh/hover
      }

      const data = jatengHealthService.getRegionData(region.id);
      if (!data) return region.defaultColor;

      if (metricMode === 'aqi') {
        // Skala Kualitas Udara (AQI)
        if (data.aqi > 130) return '#EF4444'; // Kritis / Merah
        if (data.aqi > 110) return '#F472B6'; // Tinggi / Pink
        if (data.aqi > 80) return '#FEF08A';  // Waspada / Kuning
        if (data.aqi > 60) return '#93C5FD';  // Sedang / Biru muda
        return '#86EFAC';                     // Baik / Hijau muda
      } else {
        // Skala Total Kasus Penyakit Saluran Pernapasan (ISPA/Pneumonia)
        if (data.totalRespiratoryCases > 2800) return '#DC2626'; // Sangat Tinggi
        if (data.totalRespiratoryCases > 2000) return '#F472B6'; // Tinggi
        if (data.totalRespiratoryCases > 1400) return '#FDE047'; // Sedang-Tinggi
        if (data.totalRespiratoryCases > 900) return '#93C5FD';  // Sedang
        return '#86EFAC';                                        // Terkendali
      }
    },
    [metricMode]
  );

  // Zoom handlers
  const handleZoomIn = () => setZoomLevel((z) => Math.min(1.8, +(z + 0.2).toFixed(1)));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(0.8, +(z - 0.2).toFixed(1)));
  const handleResetZoom = () => setZoomLevel(1);

  // Tentukan info tooltip mengambang di atas peta
  const activeTooltipData = hoveredRegionData || currentRegionData;
  const activeRegionPath = JATENG_REGIONS.find((r) => r.id === (hoveredRegionId || activeRegionId));

  return (
    <View style={styles.container}>
      {/* ─── 1. HEADER PETA & FILTER MODE ─── */}
      <View style={styles.mapControlsHeader}>
        <View style={styles.headerTitleRow}>
          <View>
            <View style={styles.badgeRow}>
              <View style={styles.liveDot} />
              <Text style={styles.badgeText}>PORTAL DATA JATENG LIVE</Text>
            </View>
            <Text style={styles.mapMainTitle}>Pemetaan Dampak Polusi & Penyakit</Text>
            <Text style={styles.mapSubtitle}>35 Kabupaten & Kota di Provinsi Jawa Tengah</Text>
          </View>
        </View>

        {/* Switcher: Indeks Polusi (AQI) vs Kasus Penyakit */}
        <View style={styles.metricSwitcher}>
          <Pressable
            style={[
              styles.switcherBtn,
              metricMode === 'aqi' && styles.switcherBtnActive,
            ]}
            onPress={() => setMetricMode('aqi')}
          >
            <Ionicons
              name="cloud-outline"
              size={15}
              color={metricMode === 'aqi' ? '#FFFFFF' : '#64748B'}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.switcherText,
                metricMode === 'aqi' && styles.switcherTextActive,
              ]}
            >
              Indeks Polusi (AQI)
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.switcherBtn,
              metricMode === 'diseases' && styles.switcherBtnActive,
            ]}
            onPress={() => setMetricMode('diseases')}
          >
            <Ionicons
              name="fitness-outline"
              size={15}
              color={metricMode === 'diseases' ? '#FFFFFF' : '#64748B'}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.switcherText,
                metricMode === 'diseases' && styles.switcherTextActive,
              ]}
            >
              Kasus Penyakit Paru/ISPA
            </Text>
          </Pressable>
        </View>

        {/* Toggles Eksklusif: Hanya Logo Daerah ATAU Hanya Nama Daerah */}
        <View style={styles.toggleRow}>
          <Pressable
            style={[styles.togglePill, mapOverlay === 'icons' && styles.togglePillActive]}
            onPress={() => setMapOverlay('icons')}
          >
            <Ionicons
              name={mapOverlay === 'icons' ? 'sparkles' : 'sparkles-outline'}
              size={13}
              color={mapOverlay === 'icons' ? '#0284C7' : '#64748B'}
            />
            <Text style={[styles.togglePillText, mapOverlay === 'icons' && styles.togglePillTextActive]}>
              Hanya Logo Daerah
            </Text>
          </Pressable>

          <Pressable
            style={[styles.togglePill, mapOverlay === 'labels' && styles.togglePillActive]}
            onPress={() => setMapOverlay('labels')}
          >
            <Ionicons
              name={mapOverlay === 'labels' ? 'text' : 'text-outline'}
              size={13}
              color={mapOverlay === 'labels' ? '#0284C7' : '#64748B'}
            />
            <Text style={[styles.togglePillText, mapOverlay === 'labels' && styles.togglePillTextActive]}>
              Hanya Nama Daerah
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ─── 2. MAP CANVAS (3D CHOROPLETH DENGAN SHADOW & INTERAKTIF) ─── */}
      <View style={styles.mapCanvasWrapper}>
        {/* Floating Zoom & Reset Toolbar */}
        <View style={styles.zoomToolbar}>
          <Pressable style={styles.zoomBtn} onPress={handleZoomIn}>
            <Ionicons name="add" size={18} color="#1E293B" />
          </Pressable>
          <Pressable style={styles.zoomBtn} onPress={handleZoomOut}>
            <Ionicons name="remove" size={18} color="#1E293B" />
          </Pressable>
          {zoomLevel !== 1 && (
            <Pressable style={styles.zoomBtn} onPress={handleResetZoom}>
              <Ionicons name="refresh" size={16} color="#0284C7" />
            </Pressable>
          )}
        </View>

        {/* Peta SVG Jawa Tengah */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={styles.svgScrollContainer}
        >
          <View
            style={[
              styles.svgTransformWrapper,
              {
                transform: [{ scale: zoomLevel }],
              },
            ]}
          >
            <Svg
              width={JATENG_MAP_WIDTH}
              height={JATENG_MAP_HEIGHT}
              viewBox={JATENG_MAP_VIEWBOX}
              style={styles.mapSvg}
            >
              <Defs>
                <SvgLinearGradient id="oceanGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor="#E0F2FE" stopOpacity="0.8" />
                  <Stop offset="100%" stopColor="#BAE6FD" stopOpacity="0.6" />
                </SvgLinearGradient>
              </Defs>

              {/* Latar Belakang Laut Utara Jawa */}
              <Rect
                x="0"
                y="0"
                width={JATENG_MAP_WIDTH}
                height={JATENG_MAP_HEIGHT}
                fill="url(#oceanGrad)"
                rx="16"
              />

              {/* ─── LAYER 1: 3D AMBIENT DROP SHADOW UNDERNEATH ALL REGIONS ─── */}
              {/* Memberikan efek 3D elevasi seperti pada gambar referensi */}
              <G transform="translate(4, 12)" opacity={0.35}>
                {JATENG_REGIONS.map((region) => (
                  <Path
                    key={`shadow_${region.id}`}
                    d={region.path}
                    fill="#0F172A"
                  />
                ))}
              </G>
              <G transform="translate(2, 6)" opacity={0.25}>
                {JATENG_REGIONS.map((region) => (
                  <Path
                    key={`shadow2_${region.id}`}
                    d={region.path}
                    fill="#1E293B"
                  />
                ))}
              </G>

              {/* ─── LAYER 2: CHOROPLETH REGION PATHS (INTERAKTIF) ─── */}
              <G>
                {JATENG_REGIONS.map((region) => {
                  const isSelected = region.id === activeRegionId;
                  const isHovered = region.id === hoveredRegionId;
                  const fillColor = getRegionFillColor(region, isSelected, isHovered);

                  return (
                    <Path
                      key={region.id}
                      d={region.path}
                      fill={fillColor}
                      stroke={isSelected ? '#0F172A' : '#334155'}
                      strokeWidth={isSelected ? 2.8 : 0.8}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      onPress={() => handleRegionPress(region.id)}
                    />
                  );
                })}
              </G>

              {/* ─── LAYER 3: LABELS DAERAH (Hanya Muncul Jika Mode 'labels' Aktif) ─── */}
              {mapOverlay === 'labels' && (
                <G pointerEvents="none">
                  {JATENG_REGIONS.map((region) => {
                    const isSelected = region.id === activeRegionId;
                    const fontSize = region.isKota ? 9.5 : 8;
                    return (
                      <SvgText
                        key={`label_${region.id}`}
                        x={region.center.x}
                        y={region.center.y + 1}
                        fontSize={fontSize}
                        fontWeight={isSelected || region.isKota ? 'bold' : '600'}
                        fill={isSelected ? '#0F172A' : '#1E293B'}
                        textAnchor="middle"
                        alignmentBaseline="central"
                        stroke="#FFFFFF"
                        strokeWidth={0.8}
                      >
                        {region.shortName}
                      </SvgText>
                    );
                  })}
                </G>
              )}

              {/* ─── LAYER 4: LANDMARK VECTOR ICONS ON MAP (Hanya Muncul Jika Mode 'icons' Aktif - LANGSUNG LOGO TANPA FRAME) ─── */}
              {mapOverlay === 'icons' && (
                <G pointerEvents="none">
                  {JATENG_REGIONS.map((region) => {
                    const isSelected = region.id === activeRegionId;
                    const scale = isSelected ? 0.78 : 0.62;
                    const iconX = region.center.x - 16 * scale;
                    const iconY = region.center.y - 16 * scale;

                    return (
                      <G
                        key={`landmark_${region.id}`}
                        transform={`translate(${iconX}, ${iconY}) scale(${scale})`}
                      >
                        {/* Langsung icon vektor khas daerah tanpa frame lingkaran */}
                        {getLandmarkIcon(region.id, 32, isSelected ? '#B45309' : '#1E293B')}
                      </G>
                    );
                  })}
                </G>
              )}

              {/* ─── LAYER 5: FLOATING TOOLTIP PADA REGION AKTIF (SEPERTI REFERENSI GAMBAR) ─── */}
              {activeRegionPath && activeTooltipData && (
                <G pointerEvents="none" transform={`translate(${activeRegionPath.center.x}, ${activeRegionPath.center.y - 42})`}>
                  {/* Balon Tooltip Hitam Transparan */}
                  <Rect
                    x="-45"
                    y="-16"
                    width="90"
                    height="32"
                    rx="6"
                    fill="#1E293B"
                    opacity={0.92}
                    stroke="#FFFFFF"
                    strokeWidth={1}
                  />
                  {/* Segitiga Panah Tooltip ke Bawah */}
                  <Path d="M-6 16 L0 23 L6 16 Z" fill="#1E293B" opacity={0.92} />
                  <SvgText
                    x="0"
                    y="-3"
                    fontSize="9.5"
                    fontWeight="bold"
                    fill="#FFFFFF"
                    textAnchor="middle"
                  >
                    {activeTooltipData.shortName}
                  </SvgText>
                  <SvgText
                    x="0"
                    y="9"
                    fontSize="11"
                    fontWeight="800"
                    fill="#38BDF8"
                    textAnchor="middle"
                  >
                    {metricMode === 'aqi'
                      ? `AQI ${activeTooltipData.aqi}`
                      : `${activeTooltipData.totalRespiratoryCases} Kasus`}
                  </SvgText>
                </G>
              )}
            </Svg>
          </View>
        </ScrollView>
      </View>

      {/* ─── 3. LEGENDA WARNA PETA ─── */}
      <View style={styles.legendContainer}>
        <Text style={styles.legendTitle}>
          {metricMode === 'aqi' ? 'Indeks Polusi Udara (AQI)' : 'Kasus ISPA / Penyakit Saluran Pernapasan'}
        </Text>
        <View style={styles.legendBar}>
          {MAP_LEGEND_RANGES.map((item, index) => (
            <View key={index} style={styles.legendItem}>
              <View style={[styles.legendColorBox, { backgroundColor: item.color }]} />
              <Text style={styles.legendLabelText} numberOfLines={1}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* ─── 4. DETAIL KARTU WILAYAH TERPILIH (POPUP / BOTTOM DETAIL) ─── */}
      {currentRegionData && (
        <View style={styles.regionDetailCard}>
          {/* Header Kartu Daerah */}
          <View style={styles.detailHeaderRow}>
            <View style={styles.landmarkIconBox}>
              {getLandmarkIcon(currentRegionData.id, 28, '#0284C7')}
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.regionNameTitle}>{currentRegionData.name}</Text>
                {currentRegionData.isKota && (
                  <View style={styles.kotaBadge}>
                    <Text style={styles.kotaBadgeText}>KOTA</Text>
                  </View>
                )}
              </View>
              <Text style={styles.landmarkSubtitle}>
                Landmark: <Text style={{ fontWeight: '700', color: '#0284C7' }}>{currentRegionData.landmarkName}</Text>
              </Text>
            </View>

            {/* Badge Status AQI */}
            <View
              style={[
                styles.aqiPill,
                {
                  backgroundColor:
                    currentRegionData.aqi > 100
                      ? '#FEE2E2'
                      : currentRegionData.aqi > 75
                      ? '#FEF3C7'
                      : '#DCFCE7',
                  borderColor:
                    currentRegionData.aqi > 100
                      ? '#EF4444'
                      : currentRegionData.aqi > 75
                      ? '#F59E0B'
                      : '#22C55E',
                },
              ]}
            >
              <Text
                style={[
                  styles.aqiPillNumber,
                  {
                    color:
                      currentRegionData.aqi > 100
                        ? '#DC2626'
                        : currentRegionData.aqi > 75
                        ? '#D97706'
                        : '#16A34A',
                  },
                ]}
              >
                AQI {currentRegionData.aqi}
              </Text>
              <Text
                style={[
                  styles.aqiPillStatus,
                  {
                    color:
                      currentRegionData.aqi > 100
                        ? '#DC2626'
                        : currentRegionData.aqi > 75
                        ? '#D97706'
                        : '#16A34A',
                  },
                ]}
              >
                {currentRegionData.aqiStatus}
              </Text>
            </View>
          </View>

          {/* Indikator Utama (PM2.5, Total Kasus, Tingkat Risiko) */}
          <View style={styles.metricsRow}>
            <View style={styles.metricBlock}>
              <Text style={styles.metricLabel}>Partikulat PM2.5</Text>
              <Text style={styles.metricValue}>{currentRegionData.pm25} µg/m³</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricBlock}>
              <Text style={styles.metricLabel}>Total Kasus Paru</Text>
              <Text style={styles.metricValue}>{currentRegionData.totalRespiratoryCases.toLocaleString()} Jiwa</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricBlock}>
              <Text style={styles.metricLabel}>Skor Kerentanan</Text>
              <Text style={[styles.metricValue, { color: currentRegionData.vulnerableRiskScore > 70 ? '#EF4444' : '#0284C7' }]}>
                {currentRegionData.vulnerableRiskScore}/100
              </Text>
            </View>
          </View>

          {/* Daftar Penyakit Terkait Polusi di Wilayah Terpilih */}
          <View style={styles.diseasesSection}>
            <View style={styles.diseaseSectionHeader}>
              <Ionicons name="medical" size={16} color="#0284C7" style={{ marginRight: 6 }} />
              <Text style={styles.diseaseSectionTitle}>
                Data Penyakit Terkait Lingkungan (Dinkes Jateng / Open Data)
              </Text>
            </View>

            {currentRegionData.topDiseases.map((disease, idx) => (
              <View key={idx} style={styles.diseaseCard}>
                <View style={styles.diseaseCardLeft}>
                  <View style={styles.diseaseCategoryBadge}>
                    <Text style={styles.diseaseCategoryText}>{disease.category}</Text>
                  </View>
                  <Text style={styles.diseaseName}>{disease.name}</Text>
                  <Text style={styles.diseaseDesc}>{disease.description}</Text>
                </View>
                <View style={styles.diseaseCardRight}>
                  <Text style={styles.diseaseCases}>{disease.cases.toLocaleString()}</Text>
                  <Text style={styles.diseaseCasesLabel}>kasus</Text>
                  <View style={styles.trendRow}>
                    <Ionicons
                      name={
                        disease.trend === 'up'
                          ? 'arrow-up'
                          : disease.trend === 'down'
                          ? 'arrow-down'
                          : 'remove'
                      }
                      size={12}
                      color={
                        disease.trend === 'up'
                          ? '#EF4444'
                          : disease.trend === 'down'
                          ? '#22C55E'
                          : '#64748B'
                      }
                    />
                    <Text
                      style={[
                        styles.trendText,
                        {
                          color:
                            disease.trend === 'up'
                              ? '#EF4444'
                              : disease.trend === 'down'
                              ? '#22C55E'
                              : '#64748B',
                        },
                      ]}
                    >
                      {disease.trend === 'up' ? 'Naik' : disease.trend === 'down' ? 'Turun' : 'Stabil'}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* Rekomendasi Kesehatan */}
          <View style={styles.recommendationBox}>
            <Ionicons name="shield-checkmark" size={20} color="#0284C7" style={{ marginRight: 10, marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.recommendationTitle}>Rekomendasi Perlindungan Paru</Text>
              <Text style={styles.recommendationDesc}>
                {currentRegionData.healthRecommendation}
              </Text>
            </View>
          </View>

          {/* Attribution Sumber Terbuka */}
          <View style={styles.sourceFooter}>
            <Ionicons name="information-circle-outline" size={14} color="#94A3B8" />
            <Text style={styles.sourceFooterText}>
              Sumber: Portal Data Terbuka Pemprov Jateng (data.jatengprov.go.id) & Dinkes Prov. Jawa Tengah
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#F8FAFC',
  },
  mapControlsHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#22C55E',
    marginRight: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0284C7',
    letterSpacing: 0.8,
  },
  mapMainTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  mapSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  metricSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    marginBottom: 10,
  },
  switcherBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  switcherBtnActive: {
    backgroundColor: '#0284C7',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  switcherText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  switcherTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  togglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 5,
  },
  togglePillActive: {
    backgroundColor: '#E0F2FE',
    borderColor: '#BAE6FD',
  },
  togglePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  togglePillTextActive: {
    color: '#0284C7',
    fontWeight: '700',
  },
  mapCanvasWrapper: {
    backgroundColor: '#E0F2FE',
    position: 'relative',
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
  },
  zoomToolbar: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 50,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  zoomBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  svgScrollContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  svgTransformWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapSvg: {
    borderRadius: 16,
  },
  legendContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  legendTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  legendBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 6,
  },
  legendColorBox: {
    width: 14,
    height: 14,
    borderRadius: 3,
    marginRight: 5,
    borderWidth: 0.5,
    borderColor: '#94A3B8',
  },
  legendLabelText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#334155',
  },
  regionDetailCard: {
    margin: 16,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  detailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  landmarkIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  regionNameTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  kotaBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#0284C7',
  },
  kotaBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  landmarkSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  aqiPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  aqiPillNumber: {
    fontSize: 13,
    fontWeight: '800',
  },
  aqiPillStatus: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  metricsRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  metricBlock: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
  metricLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  diseasesSection: {
    marginBottom: 14,
  },
  diseaseSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  diseaseSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  diseaseCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  diseaseCardLeft: {
    flex: 1,
    paddingRight: 8,
  },
  diseaseCategoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    marginBottom: 3,
  },
  diseaseCategoryText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0369A1',
  },
  diseaseName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  diseaseDesc: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 2,
  },
  diseaseCardRight: {
    alignItems: 'flex-end',
  },
  diseaseCases: {
    fontSize: 15,
    fontWeight: '800',
    color: '#EF4444',
  },
  diseaseCasesLabel: {
    fontSize: 9.5,
    color: '#64748B',
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  trendText: {
    fontSize: 9.5,
    fontWeight: '700',
    marginLeft: 2,
  },
  recommendationBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    marginBottom: 12,
  },
  recommendationTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1',
  },
  recommendationDesc: {
    fontSize: 11,
    color: '#0C4A6E',
    marginTop: 3,
    lineHeight: 16,
  },
  sourceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  sourceFooterText: {
    fontSize: 9.5,
    color: '#94A3B8',
    flex: 1,
  },
});
