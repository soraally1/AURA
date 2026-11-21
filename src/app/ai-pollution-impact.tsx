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
import {
  PollutionHealthAnalysisData,
  PollutionHealthAnalysisContext,
} from '@/types/ai';
import { PageTransitionSplash } from '@/components/splash/AuraCloudSplash';
import { StravaActivitySummaryCard } from '@/components/activity/StravaActivitySummaryCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - 40 - GRID_GAP) / 2;

// ─── Clean Visual SVG Icons ─────────────────────────────────────────────────

function OxygenIcon({ size = 24 }: { size?: number }) {
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
      <Path d="M18 6H20" stroke="#60A5FA" strokeWidth="1.5" strokeLinecap="round" />
      <Path d="M18 9H21" stroke="#60A5FA" strokeWidth="1.5" strokeLinecap="round" />
      <Path d="M18 12H20" stroke="#60A5FA" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

function BandageIcon({ size = 22 }: { size?: number }) {
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

function WaterGlassIcon({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path
        d="M8 7L10.5 25C10.6 25.8 11.3 26.5 12.2 26.5H19.8C20.7 26.5 21.4 25.8 21.5 25L24 7H8Z"
        stroke="#38BDF8"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <Path
        d="M9.8 13L10.5 24.5C10.5 25.1 11 25.5 11.6 25.5H20.4C21 25.5 21.5 25.1 21.5 24.5L22.2 13C20.5 14 18 13.2 16 13C14 12.8 11.5 14 9.8 13Z"
        fill="#7DD3FC"
      />
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

function MaskIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Rect x="6" y="10" width="20" height="12" rx="4" fill="#38BDF8" />
      <Path d="M7 13.5H25" stroke="#BAE6FD" strokeWidth="1.2" />
      <Path d="M7 16.5H25" stroke="#BAE6FD" strokeWidth="1.2" />
      <Path d="M7 19.5H25" stroke="#BAE6FD" strokeWidth="1.2" />
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

function SunShieldIcon({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="5" fill="#F59E0B" />
      <Path d="M12 2V4" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
      <Path d="M12 20V22" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
      <Path d="M4.93 4.93L6.34 6.34" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
      <Path d="M17.66 17.66L19.07 19.07" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
      <Path d="M2 12H4" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
      <Path d="M20 12H22" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
      <Path d="M4.93 19.07L6.34 17.66" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
      <Path d="M17.66 6.34L19.07 4.93" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
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

  const runAiAnalysis = useCallback(
    async (isManualRetry = false) => {
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
    },
    [lat, lon, name, zone_id, average_risk_score, peak_risk_day, outdoor_minutes]
  );

  useEffect(() => {
    runAiAnalysis();
  }, [runAiAnalysis]);

  const topInset =
    Platform.OS === 'android'
      ? (RNStatusBar.currentHeight || 24) + 8
      : insets.top + 6;

  const thermal = data?.thermal_stress || data?.body_temperature;
  const outdoorMin = Math.round(
    data?.activity_route?.duration_minutes ??
      data?.stats?.total_outdoor_minutes ??
      0
  );
  const ambientC = Math.round(data?.telemetry?.ambient_temp_c ?? 0);
  const feelC = Math.round(data?.telemetry?.heat_index_c ?? ambientC);
  const pm25Ug = data?.telemetry?.inhaled_pm25_ug ?? 0;
  const glasses = data?.telemetry?.recommended_water_glasses ?? 0;

  return (
    <View style={styles.container}>
      <RNStatusBar barStyle="dark-content" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: topInset, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header Row */}
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

        {/* Title Section */}
        <View style={styles.titleContainer}>
          <Text style={styles.primaryTitle}>Analisis Penyakit</Text>
          <Text style={styles.primaryTitle}>Berdasarkan Aktivitas</Text>
          <Text style={styles.heroWeeklyText}>&amp; Polusi</Text>

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
          </View>
        ) : data ? (
          <>
            {/* ─── Strava-Style Real Map Card (HANYA tampil jika ada data tracking dari Firestore) ─── */}
            {data.activity_route && data.activity_route.coordinates.length >= 2 ? (
              <StravaActivitySummaryCard
                activityRoute={data.activity_route}
                telemetry={data.telemetry}
                stats={data.stats}
              />
            ) : null}

            {/* ─── 4-Card Grid (2x2) Visual & Minimal Text ───────────────── */}
            <View style={styles.gridContainer}>
              {/* 1. Kualitas Hirup */}
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
                    <Text numberOfLines={1} style={styles.metricSubStatus}>
                      {data.oxygen_level.status}
                    </Text>
                  </View>
                  <View style={styles.cardIconCircle}>
                    <OxygenIcon size={24} />
                  </View>
                </View>
                <Text style={styles.metricBottomLabel}>Kualitas Hirup</Text>
              </LinearGradient>

              {/* 2. Suhu Terasa (Analogi Suhu & Lembap ke Tubuh) */}
              {thermal && (
                <LinearGradient
                  colors={['#3884F7', '#2567EC']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.metricCard}
                >
                  <View style={styles.cardTopRow}>
                    <View style={{ flex: 1, paddingRight: 6 }}>
                      <Text style={styles.metricBigValue}>
                        {thermal.value}
                      </Text>
                      <Text numberOfLines={1} style={styles.metricSubStatus}>
                        {thermal.status}
                      </Text>
                    </View>
                    <View style={styles.cardIconCircle}>
                      <ThermometerIcon size={22} />
                    </View>
                  </View>
                  <Text style={styles.metricBottomLabel}>Suhu Terasa</Text>
                </LinearGradient>
              )}

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
                    <Text numberOfLines={1} style={styles.metricSubStatus}>
                      {data.skin_condition.status}
                    </Text>
                  </View>
                  <View style={styles.cardIconCircle}>
                    <BandageIcon size={22} />
                  </View>
                </View>
                <Text style={styles.metricBottomLabel}>Kondisi Kulit</Text>
              </LinearGradient>

              {/* 4. Cairan Hilang */}
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
                    <Text numberOfLines={1} style={styles.metricSubStatus}>
                      {data.dehydration_level.status}
                    </Text>
                  </View>
                  <View style={styles.cardIconCircle}>
                    <WaterGlassIcon size={22} />
                  </View>
                </View>
                <Text style={styles.metricBottomLabel}>Cairan Hilang</Text>
              </LinearGradient>
            </View>

            {/* ─── Visual Analogy Strip (Icons + Arrows, Zero Paragraph) ─── */}
            <View style={styles.visualAnalogyCard}>
              <View style={styles.analogyFlowRow}>
                <View style={styles.analogyPill}>
                  <Ionicons name="walk" size={16} color="#2563EB" />
                  <Text style={styles.analogyPillText}>{outdoorMin} mnt Luar</Text>
                </View>
                <Ionicons name="arrow-forward" size={14} color="#94A3B8" />
                <View style={styles.analogyPill}>
                  <Ionicons name="cloud-outline" size={16} color="#0284C7" />
                  <Text style={styles.analogyPillText}>{pm25Ug} µg Debu</Text>
                </View>
              </View>

              <View style={styles.analogyFlowRow}>
                <View style={styles.analogyPill}>
                  <Ionicons name="sunny" size={16} color="#F59E0B" />
                  <Text style={styles.analogyPillText}>Udara {ambientC}°C</Text>
                </View>
                <Ionicons name="arrow-forward" size={14} color="#94A3B8" />
                <View style={styles.analogyPill}>
                  <Ionicons name="thermometer" size={16} color="#EA580C" />
                  <Text style={styles.analogyPillText}>Terasa {feelC}°C</Text>
                </View>
              </View>

              <View style={[styles.analogyFlowRow, { marginBottom: 0 }]}>
                <View style={styles.analogyPill}>
                  <Ionicons name="flame" size={16} color="#EF4444" />
                  <Text style={styles.analogyPillText}>{data.dehydration_level.value} Keringat</Text>
                </View>
                <Ionicons name="arrow-forward" size={14} color="#94A3B8" />
                <View style={styles.analogyPill}>
                  <Ionicons name="water" size={16} color="#0284C7" />
                  <Text style={styles.analogyPillText}>+{glasses} Gelas Air</Text>
                </View>
              </View>
            </View>

            {/* ─── Bottom Section: Rekomendasi Tindakan ───────────────────── */}
            <View style={styles.recommendationsSection}>
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

              <LinearGradient
                colors={['#2567EC', '#1D57DE']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.actionCardContainer}
              >
                {data.recommendations.slice(0, 3).map((item, index, arr) => {
                  const isLast = index === arr.length - 1;
                  const lower = item.title.toLowerCase();

                  return (
                    <React.Fragment key={item.id || index}>
                      <View style={styles.actionItemRow}>
                        <View style={styles.actionIconCircle}>
                          {item.icon_type === 'mask' || lower.includes('masker') ? (
                            <MaskIcon size={24} />
                          ) : item.icon_type === 'water' || lower.includes('minum') ? (
                            <WaterGlassIcon size={22} />
                          ) : (
                            <SunShieldIcon size={22} />
                          )}
                        </View>

                        <View style={styles.actionTextCol}>
                          <Text style={styles.actionItemTitle}>{item.title}</Text>
                          <Text numberOfLines={1} style={styles.actionItemDesc}>
                            {item.description}
                          </Text>
                        </View>
                      </View>

                      {!isLast && <View style={styles.actionItemDivider} />}
                    </React.Fragment>
                  );
                })}
              </LinearGradient>
            </View>
          </>
        ) : null}
      </ScrollView>

      <PageTransitionSplash
        visible={isLoading}
        message="Menganalisis aktivitas & polusi..."
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
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  trackingHeaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  trackingHeaderPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
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
    marginBottom: 22,
  },
  primaryTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: '#1E6CEF',
    textAlign: 'center',
    lineHeight: 28,
  },
  heroWeeklyText: {
    fontSize: 38,
    fontWeight: '900',
    color: '#1E293B',
    textAlign: 'center',
    lineHeight: 46,
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
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: GRID_GAP,
    marginBottom: 14,
  },
  metricCard: {
    width: CARD_WIDTH,
    height: 124,
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
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 30,
  },
  metricMediumValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 22,
  },
  metricSubStatus: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.90)',
    marginTop: 3,
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
  visualAnalogyCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  analogyFlowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  analogyPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginHorizontal: 4,
  },
  analogyPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  recommendationsSection: {
    marginTop: 2,
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
    marginBottom: 12,
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
  actionCardContainer: {
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  },
  actionItemDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginVertical: 4,
  },
});
