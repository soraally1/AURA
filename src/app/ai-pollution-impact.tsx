import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  StatusBar as RNStatusBar,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { aiService } from '@/services/aiService';
import { PollutionHealthAnalysisData, PollutionHealthAnalysisContext } from '@/types/ai';
import { PageTransitionSplash } from '@/components/splash/CityBuildingSplash';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - 40 - GRID_GAP) / 2;

// ─── Custom Pixel-Perfect SVG Icons ──────────────────────────────────────────

/** Icon Oksigen (Dua busur melingkar: biru dan kuning/hijau) */
function OxygenIcon({ size = 26 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path
        d="M16 4C9.37258 4 4 9.37258 4 16C4 22.6274 9.37258 28 16 28"
        stroke="#0284C7"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <Path
        d="M16 4C22.6274 4 28 9.37258 28 16C28 22.6274 22.6274 28 16 28"
        stroke="#FACC15"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <Circle cx="16" cy="16" r="3.5" fill="#0284C7" />
    </Svg>
  );
}

/** Icon Termometer Suhu */
function ThermometerIcon({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14 14.76V5C14 3.9 13.1 3 12 3C10.9 3 10 3.9 10 5V14.76C8.79 15.68 8 17.22 8 19C8 21.21 9.79 23 12 23C14.21 23 16 21.21 16 19C16 17.22 15.21 15.68 14 14.76Z"
        stroke="#2563EB"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M12 8V14" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" />
      <Circle cx="12" cy="19" r="2" fill="#2563EB" />
      {/* Indicator lines on right */}
      <Path d="M18 6H20" stroke="#60A5FA" strokeWidth="1.5" strokeLinecap="round" />
      <Path d="M18 9H21" stroke="#60A5FA" strokeWidth="1.5" strokeLinecap="round" />
      <Path d="M18 12H20" stroke="#60A5FA" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

/** Icon Plester Kulit / Bandage */
function BandageIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Rect
        x="6"
        y="12"
        width="22"
        height="11"
        rx="5.5"
        transform="rotate(-45 6 12)"
        fill="#F6B89E"
      />
      <Rect
        x="11.5"
        y="12"
        width="11"
        height="11"
        transform="rotate(-45 11.5 12)"
        fill="#FFFFFF"
        opacity="0.9"
      />
      <Circle cx="14" cy="16" r="0.8" fill="#F6B89E" />
      <Circle cx="16" cy="14" r="0.8" fill="#F6B89E" />
      <Circle cx="16" cy="18" r="0.8" fill="#F6B89E" />
      <Circle cx="18" cy="16" r="0.8" fill="#F6B89E" />
    </Svg>
  );
}

/** Icon Gelas Air Dehidrasi */
function WaterGlassIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path
        d="M8 7L10.5 25C10.6 25.8 11.3 26.5 12.2 26.5H19.8C20.7 26.5 21.4 25.8 21.5 25L24 7H8Z"
        stroke="#38BDF8"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Water Fill */}
      <Path
        d="M9.8 13L10.5 24.5C10.5 25.1 11 25.5 11.6 25.5H20.4C21 25.5 21.5 25.1 21.5 24.5L22.2 13C20.5 14 18 13.2 16 13C14 12.8 11.5 14 9.8 13Z"
        fill="#7DD3FC"
      />
      {/* Ice Cubes */}
      <Rect
        x="13"
        y="15"
        width="4"
        height="4"
        rx="1"
        fill="#FFFFFF"
        opacity="0.85"
        transform="rotate(15 13 15)"
      />
    </Svg>
  );
}

/** Icon Masker Medis untuk Rekomendasi */
function MaskIcon({ size = 26 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Rect x="6" y="10" width="20" height="12" rx="4" fill="#38BDF8" />
      {/* Pleat lines */}
      <Path d="M7 13.5H25" stroke="#BAE6FD" strokeWidth="1.2" />
      <Path d="M7 16.5H25" stroke="#BAE6FD" strokeWidth="1.2" />
      <Path d="M7 19.5H25" stroke="#BAE6FD" strokeWidth="1.2" />
      {/* Ear loops */}
      <Path
        d="M6 12C3 13 3 19 6 20"
        stroke="#93C5FD"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <Path
        d="M26 12C29 13 29 19 26 20"
        stroke="#93C5FD"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Icon Mobil Merah untuk Rekomendasi Mobilitas */
function RedCarIcon({ size = 26 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Car Roof */}
      <Path
        d="M10 13L12 9H20L22 13H10Z"
        fill="#EF4444"
      />
      {/* Car Window */}
      <Path
        d="M11 12.5L12.5 9.8H19.5L21 12.5H11Z"
        fill="#FEE2E2"
      />
      {/* Car Body */}
      <Rect x="6" y="13" width="20" height="8" rx="2" fill="#DC2626" />
      {/* Headlights */}
      <Circle cx="8" cy="16" r="1.2" fill="#FEF08A" />
      <Circle cx="24" cy="16" r="1.2" fill="#FEF08A" />
      {/* Wheels */}
      <Circle cx="10" cy="21" r="2.5" fill="#1E293B" />
      <Circle cx="10" cy="21" r="1" fill="#94A3B8" />
      <Circle cx="22" cy="21" r="2.5" fill="#1E293B" />
      <Circle cx="22" cy="21" r="1" fill="#94A3B8" />
    </Svg>
  );
}

export default function AiPollutionImpactScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    lat,
    lon,
    name,
    zone_id,
    average_risk_score,
    peak_risk_day,
    outdoor_minutes,
  } = useLocalSearchParams<{
    lat?: string;
    lon?: string;
    name?: string;
    zone_id?: string;
    average_risk_score?: string;
    peak_risk_day?: string;
    outdoor_minutes?: string;
  }>();

  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<PollutionHealthAnalysisData | null>(null);
  const hasRunRef = useRef(false);

  // 1-Click AI Analysis Trigger from Backend
  const runAiAnalysis = useCallback(async (isManualRetry = false) => {
    if (!isManualRetry && hasRunRef.current) return;
    hasRunRef.current = true;

    setIsLoading(true);
    try {
      const context: PollutionHealthAnalysisContext = {
        lat: lat ? parseFloat(lat) : undefined,
        lon: lon ? parseFloat(lon) : undefined,
        location_name: name || 'Lokasi Terpilih',
        zone_id: zone_id,
        average_risk_score: average_risk_score
          ? parseFloat(average_risk_score)
          : undefined,
        peak_risk_day: peak_risk_day,
        total_outdoor_minutes: outdoor_minutes
          ? parseFloat(outdoor_minutes)
          : undefined,
      };

      const res = await aiService.analyzePollutionHealthImpact(context);
      if (res && res.data) {
        setData(res.data);
      }
    } catch (err) {
      console.warn('[AiPollutionImpact] Error running analysis:', err);
    } finally {
      setIsLoading(false);
    }
  }, [lat, lon, name, zone_id, average_risk_score, peak_risk_day, outdoor_minutes]);

  useEffect(() => {
    runAiAnalysis();
  }, [runAiAnalysis]);

  const topInset =
    Platform.OS === 'android'
      ? (RNStatusBar.currentHeight || 24) + 8
      : insets.top + 6;

  return (
    <View style={styles.container}>
      <RNStatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: topInset, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header Row with Back Button */}
        <View style={styles.topHeaderBar}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Kembali"
          >
            <Ionicons name="arrow-back" size={24} color="#0284C7" />
          </Pressable>
        </View>

        {/* Title Section matching Mockup */}
        <View style={styles.titleContainer}>
          <Text style={styles.primaryTitle}>Analisis Dampak</Text>
          <Text style={styles.primaryTitle}>Akibat Polusi Dalam</Text>
          <Text style={styles.heroWeeklyText}>1 Minggu</Text>

          {/* Doctor Advisory Link */}
          <View style={styles.doctorNoticeRow}>
            <Pressable onPress={() => router.push('/ceksekarang')}>
              <Text style={styles.doctorNoticeLink}>Periksa ke dokter </Text>
            </Pressable>
            <Text style={styles.doctorNoticeSub}>jika muncul gejala serius!</Text>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator size="large" color="#0284C7" />
            <Text style={styles.loadingTitle}>Sedang Menganalisis dengan AI...</Text>
            <Text style={styles.loadingSubtitle}>
              Menghubungkan data paparan polusi 1 minggu ke model inferensi kesehatan
            </Text>
          </View>
        ) : data ? (
          <>
            {/* ─── 4-Card Grid Health Metrics (2x2) ────────────────────────── */}
            <View style={styles.gridContainer}>
              {/* 1. Level Oksigen */}
              <LinearGradient
                colors={['#3884F7', '#2567EC']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.metricCard}
              >
                <View style={styles.cardTopRow}>
                  <View style={{ flex: 1, paddingRight: 6 }}>
                    <Text style={styles.metricBigValue}>
                      {data.oxygen_level.value}
                    </Text>
                    <Text numberOfLines={2} style={styles.metricSubStatus}>
                      {data.oxygen_level.status}
                    </Text>
                  </View>
                  <View style={styles.cardIconCircle}>
                    <OxygenIcon size={24} />
                  </View>
                </View>
                <Text style={styles.metricBottomLabel}>Level Oksigen</Text>
              </LinearGradient>

              {/* 2. Suhu Badan */}
              <LinearGradient
                colors={['#3884F7', '#2567EC']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.metricCard}
              >
                <View style={styles.cardTopRow}>
                  <View style={{ flex: 1, paddingRight: 6 }}>
                    <Text style={styles.metricBigValue}>
                      {data.body_temperature.value}
                    </Text>
                    <Text numberOfLines={2} style={styles.metricSubStatus}>
                      {data.body_temperature.status}
                    </Text>
                  </View>
                  <View style={styles.cardIconCircle}>
                    <ThermometerIcon size={22} />
                  </View>
                </View>
                <Text style={styles.metricBottomLabel}>Suhu Badan</Text>
              </LinearGradient>

              {/* 3. Kondisi Kulit */}
              <LinearGradient
                colors={['#3884F7', '#2567EC']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.metricCard}
              >
                <View style={styles.cardTopRow}>
                  <View style={{ flex: 1, paddingRight: 6 }}>
                    <Text style={styles.metricMediumValue}>
                      {data.skin_condition.value}
                    </Text>
                    <Text numberOfLines={2} style={styles.metricSubStatus}>
                      {data.skin_condition.status}
                    </Text>
                  </View>
                  <View style={styles.cardIconCircle}>
                    <BandageIcon size={22} />
                  </View>
                </View>
                <Text style={styles.metricBottomLabel}>Kondisi Kulit</Text>
              </LinearGradient>

              {/* 4. Tingkat Dehidrasi */}
              <LinearGradient
                colors={['#3884F7', '#2567EC']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.metricCard}
              >
                <View style={styles.cardTopRow}>
                  <View style={{ flex: 1, paddingRight: 6 }}>
                    <Text style={styles.metricMediumValue}>
                      {data.dehydration_level.value}
                    </Text>
                    <Text numberOfLines={2} style={styles.metricSubStatus}>
                      {data.dehydration_level.status}
                    </Text>
                  </View>
                  <View style={styles.cardIconCircle}>
                    <WaterGlassIcon size={22} />
                  </View>
                </View>
                <Text style={styles.metricBottomLabel}>Tingkat Dehidrasi</Text>
              </LinearGradient>
            </View>

            {/* ─── Bottom Section: Rekomendasi Tindakan ───────────────────── */}
            <View style={styles.recommendationsSection}>
              {/* Badge Rekomendasi Tindakan (Left rounded pill) */}
              <View style={styles.recommendationBadge}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={20}
                  color="#FFFFFF"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.recommendationBadgeText}>
                  Rekomendasi Tindakan
                </Text>
              </View>

              {/* Sub-label */}
              <Text style={styles.actionStepsSubtitle}>
                Langkah yang bisa kamu lakukan sekarang
              </Text>

              {/* Blue Unified Action Card */}
              <LinearGradient
                colors={['#2567EC', '#1D57DE']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.actionCardContainer}
              >
                {data.recommendations.map((item, index) => {
                  const isLast = index === data.recommendations.length - 1;

                  return (
                    <React.Fragment key={item.id || index}>
                      <View style={styles.actionItemRow}>
                        {/* Circular Icon Container */}
                        <View style={styles.actionIconCircle}>
                          {item.icon_type === 'mask' || item.title.toLowerCase().includes('masker') ? (
                            <MaskIcon size={24} />
                          ) : item.icon_type === 'water' || item.title.toLowerCase().includes('minum') ? (
                            <WaterGlassIcon size={22} />
                          ) : (
                            <RedCarIcon size={22} />
                          )}
                        </View>

                        {/* Title and Description */}
                        <View style={styles.actionTextCol}>
                          <Text style={styles.actionItemTitle}>{item.title}</Text>
                          <Text style={styles.actionItemDesc}>{item.description}</Text>
                        </View>
                      </View>

                      {!isLast && <View style={styles.actionItemDivider} />}
                    </React.Fragment>
                  );
                })}
              </LinearGradient>

                {/* ─── Kartu Diagnosa Dokter Spesialis Paru AI (Groq Engine) ─── */}
                {data.doctor_diagnosis && (
                  <View style={styles.doctorDiagnosisCard}>
                    <View style={styles.doctorHeaderRow}>
                      <View style={styles.doctorIconBox}>
                        <Ionicons name="medical" size={18} color="#0284C7" />
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.doctorNameTitle}>dr. Spesialis Pulmonologi AI</Text>
                        <Text style={styles.doctorSubTitle}>Groq LLM Engine • Berdasarkan Paparan Mobilitas</Text>
                      </View>
                    </View>

                    <Text style={styles.doctorDiagnosisText}>
                      "{data.doctor_diagnosis}"
                    </Text>

                    {data.stats && (
                      <View style={styles.exposureStatsRow}>
                        <View style={styles.statChip}>
                          <Ionicons name="time-outline" size={13} color="#64748B" />
                          <Text style={styles.statChipText}>
                            Outdoor: {Math.round(data.stats.total_outdoor_minutes || 0)}m
                          </Text>
                        </View>
                        {data.stats.worst_area_name && (
                          <View style={styles.statChip}>
                            <Ionicons name="location-outline" size={13} color="#EF4444" />
                            <Text numberOfLines={1} style={styles.statChipText}>
                              {data.stats.worst_area_name}
                            </Text>
                          </View>
                        )}
                        {typeof data.stats.average_outdoor_aqi === 'number' && (
                          <View style={styles.statChip}>
                            <Ionicons name="speedometer-outline" size={13} color="#D97706" />
                            <Text style={styles.statChipText}>
                              AQI: {Math.round(data.stats.average_outdoor_aqi)}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                )}

                {/* Button Re-analisis */}
                <Pressable
                  style={styles.reanalyzeButton}
                  onPress={() => runAiAnalysis(true)}
                >
                  <Ionicons name="sparkles" size={16} color="#0284C7" style={{ marginRight: 6 }} />
                  <Text style={styles.reanalyzeButtonText}>Analisis Ulang dengan AI</Text>
                </Pressable>
              </View>
            </>
          ) : null}
      </ScrollView>

      {/* Fullscreen AI Analysis Transition & Loading Splash */}
      <PageTransitionSplash
        visible={isLoading}
        message="Dokter AI sedang menganalisis data paparan polusi..."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    flexGrow: 1,
  },
  topHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 26,
  },
  primaryTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: '#1E6CEF',
    textAlign: 'center',
    lineHeight: 28,
  },
  heroWeeklyText: {
    fontSize: 48,
    fontWeight: '900',
    color: '#1E293B',
    textAlign: 'center',
    lineHeight: 56,
    marginVertical: 4,
    letterSpacing: -0.5,
  },
  doctorNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  doctorNoticeLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E6CEF',
  },
  doctorNoticeSub: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  loadingWrapper: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 16,
  },
  loadingSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 280,
    lineHeight: 18,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: GRID_GAP,
    marginBottom: 24,
  },
  metricCard: {
    width: CARD_WIDTH,
    height: 126,
    borderRadius: 20,
    padding: 14,
    justifyContent: 'space-between',
    shadowColor: '#1E6CEF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  metricBigValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 32,
  },
  metricMediumValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 19,
  },
  metricSubStatus: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.88)',
    marginTop: 2,
    lineHeight: 13,
  },
  cardIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  metricBottomLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  recommendationsSection: {
    marginTop: 6,
  },
  recommendationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E6CEF',
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#1E6CEF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  recommendationBadgeText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  actionStepsSubtitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 14,
    marginBottom: 12,
  },
  actionCardContainer: {
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#1E6CEF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 3,
  },
  actionItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  actionIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionTextCol: {
    flex: 1,
    marginLeft: 14,
  },
  actionItemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionItemDesc: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.88)',
    marginTop: 2,
    lineHeight: 16,
  },
  actionItemDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginVertical: 4,
  },
  reanalyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    borderRadius: 16,
    paddingVertical: 12,
    marginTop: 20,
  },
  reanalyzeButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284C7',
  },
  doctorDiagnosisCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    padding: 16,
    marginTop: 18,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  doctorHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  doctorIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doctorNameTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  doctorSubTitle: {
    fontSize: 11,
    color: '#0284C7',
    fontWeight: '600',
    marginTop: 1,
  },
  doctorDiagnosisText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#334155',
    fontStyle: 'italic',
    fontWeight: '500',
  },
  exposureStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    maxWidth: 180,
  },
  statChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    marginLeft: 4,
  },
});
