import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  withSpring,
  Easing,
  interpolate,
  Extrapolation,
  cancelAnimation,
} from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import { aiService } from '@/services/aiService';
import { SkinScanData, ScanSkinContext } from '@/types/ai';
import { useAuth } from '@/context/auth-context';
import { backgroundMobilityTracker } from '@/services/backgroundMobilityTracker';
import { skinHistoryService } from '@/services/skinHistoryService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const TARGET_SIZE = Math.min(SCREEN_WIDTH * 0.78, 300);

type DetectionState = 'idle' | 'analyzing' | 'result' | 'error';

// ─── Individual Pulsing Dot ──────────────────────────────────────────
const PulsingDot: React.FC<{ delay: number }> = ({ delay }) => {
  const progress = useSharedValue(0.2);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.2, { duration: 400, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      )
    );
    return () => cancelAnimation(progress);
  }, [delay]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      {
        scale: interpolate(
          progress.value,
          [0.2, 1],
          [0.75, 1.2],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));

  return <Animated.View style={[styles.dot, dotStyle]} />;
};

const PulsingDots: React.FC = () => (
  <View style={styles.dotsRow}>
    <PulsingDot delay={0} />
    <PulsingDot delay={180} />
    <PulsingDot delay={360} />
  </View>
);

// ─── Skin Result Card (SCIN Dataset & Groq AI) ───────────────────────
const SkinResultCard: React.FC<{
  data: SkinScanData;
  onConsult: () => void;
}> = ({ data, onConsult }) => {
  const slideY = useSharedValue(40);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 500 });
    slideY.value = withSpring(0, { damping: 20, stiffness: 80 });
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: slideY.value }],
  }));

  const score = data.skin_metrics?.overall_health_score;
  const isHealthy = score != null ? score >= 80 : true;
  const isModerate = score != null ? score >= 60 : false;
  const color = isHealthy ? '#10B981' : isModerate ? '#F59E0B' : '#EF4444';
  const icon = isHealthy ? 'checkmark-circle' : isModerate ? 'alert-circle' : 'warning';

  return (
    <Animated.View style={[styles.resultCard, cardStyle]}>
      {/* SCIN + Groq AI Badge */}
      <View style={styles.modelBadgeWrap}>
        <Ionicons name="shield-checkmark" size={13} color="#2563EB" />
        <Text style={styles.modelBadgeText}>
          Groq AI {data.model_used || 'qwen/qwen3.8-27b'} • SCIN Validated
        </Text>
      </View>

      <Ionicons name={icon as any} size={44} color={color} style={{ marginTop: 4 }} />
      {score != null && <Text style={styles.resultScore}>{score}%</Text>}

      {/* Primary Condition Title */}
      <Text style={[styles.resultLabel, { color }]}>
        {data.condition_indonesian || data.condition}
      </Text>
      <Text style={styles.confidenceText}>
        {data.confidence != null ? `${data.confidence.toFixed(1)}% Akurasi • ` : ''}
        {data.fitzpatrick_skin_type ? `${data.fitzpatrick_skin_type}` : ''}
        {data.fitzpatrick_description ? ` (${data.fitzpatrick_description})` : ''}
      </Text>

      <View style={[styles.resultDivider, { backgroundColor: color + '30' }]} />
      {data.summary ? <Text style={styles.resultMessage}>{data.summary}</Text> : null}

      {/* Environmental Triad Impact (Polusi, Cuaca, UV) */}
      {data.environmental_impact && (
        <View style={styles.environmentalTriad}>
          {data.environmental_impact.pollution?.score != null && (
            <View style={styles.envPill}>
              <Ionicons name="cloud" size={12} color="#C2410C" />
              <Text style={styles.envPillLabel}>Polusi</Text>
              <Text style={styles.envPillVal}>{data.environmental_impact.pollution.score}%</Text>
            </View>
          )}
          {data.environmental_impact.weather?.score != null && (
            <View style={styles.envPill}>
              <Ionicons name="water" size={12} color="#0284C7" />
              <Text style={styles.envPillLabel}>Cuaca</Text>
              <Text style={styles.envPillVal}>{data.environmental_impact.weather.score}%</Text>
            </View>
          )}
          {data.environmental_impact.sun_uv?.score != null && (
            <View style={styles.envPill}>
              <Ionicons name="sunny" size={12} color="#D97706" />
              <Text style={styles.envPillLabel}>Sinar UV</Text>
              <Text style={styles.envPillVal}>{data.environmental_impact.sun_uv.score}%</Text>
            </View>
          )}
        </View>
      )}

      {/* Metric Pills: Hidrasi, Kemerahan, Sawar Kulit */}
      {data.skin_metrics && (
        <View style={styles.metricsPillsRow}>
          {data.skin_metrics.hydration_score != null && (
            <View style={styles.metricPill}>
              <Text style={styles.metricPillLabel}>Hidrasi</Text>
              <Text style={styles.metricPillVal}>{data.skin_metrics.hydration_score}%</Text>
            </View>
          )}
          {data.skin_metrics.redness_score != null && (
            <View style={styles.metricPill}>
              <Text style={styles.metricPillLabel}>Kemerahan</Text>
              <Text style={styles.metricPillVal}>{data.skin_metrics.redness_score}%</Text>
            </View>
          )}
          {data.skin_metrics.barrier_integrity_score != null && (
            <View style={styles.metricPill}>
              <Text style={styles.metricPillLabel}>Sawar Kulit</Text>
              <Text style={styles.metricPillVal}>{data.skin_metrics.barrier_integrity_score}%</Text>
            </View>
          )}
        </View>
      )}

      {/* Recommendations Box */}
      {data.recommendations && data.recommendations.length > 0 && (
        <View style={styles.recomBox}>
          <View style={styles.recomHeader}>
            <Ionicons name="bulb-outline" size={13} color="#2373F4" />
            <Text style={styles.recomHeaderTitle}>Rekomendasi Penanganan:</Text>
          </View>
          <Text style={styles.recomText} numberOfLines={2}>
            • {data.recommendations[0]}
          </Text>
        </View>
      )}

      {/* Medical Disclaimer */}
      {data.medical_disclaimer && (
        <Text style={styles.disclaimerText} numberOfLines={2}>
          {data.medical_disclaimer}
        </Text>
      )}

      {/* Doctor Consult CTA */}
      <Pressable onPress={onConsult} style={styles.consultCardBtn}>
        <Ionicons name="chatbubbles" size={16} color="#2373F4" style={{ marginRight: 6 }} />
        <Text style={styles.consultCardBtnText}>Konsultasi Dokter Kulit</Text>
      </Pressable>
    </Animated.View>
  );
};

// ═════════════════════════════════════════════════════════════════════
// ─── Main Screen ─────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════
export default function SkinCheckScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const cameraRef = useRef<CameraView>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState<'off' | 'on'>('off');

  const [state, setState] = useState<DetectionState>('idle');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [skinResult, setSkinResult] = useState<SkinScanData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Animated Continuous & Scanning Laser Beam
  const laserY = useSharedValue(0);

  useEffect(() => {
    const speed = state === 'analyzing' ? 800 : 1600;
    laserY.value = withRepeat(
      withSequence(
        withTiming(TARGET_SIZE - 6, { duration: speed, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: speed, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, [state]);

  const laserStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: laserY.value }],
  }));

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/dashboard');
    }
  };

  const toggleCameraFacing = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  const toggleFlash = () => {
    setFlash((current) => (current === 'off' ? 'on' : 'off'));
  };

  // Start AI analysis (TANPA DUMMY DATA)
  const runAnalysis = async (uri: string, base64?: string | null) => {
    setPhotoUri(uri);
    setState('analyzing');

    // Ambil data mobilitas real dari background tracker pengguna (tanpa dummy)
    const waypoints = backgroundMobilityTracker.getCollectedWaypoints();
    let totalOutdoor = 0;
    let totalIndoor = 0;
    waypoints.forEach((wp) => {
      if (wp.classification === 'indoor' || wp.is_stay) {
        totalIndoor += wp.duration_minutes;
      } else {
        totalOutdoor += wp.duration_minutes;
      }
    });

    const context: ScanSkinContext = {
      total_outdoor_minutes: totalOutdoor > 0 ? totalOutdoor : undefined,
      total_indoor_minutes: totalIndoor > 0 ? totalIndoor : undefined,
      city: 'Semarang',
      usia: user?.usia,
      tinggi_badan: user?.tinggi_badan,
      berat_badan: user?.berat_badan,
    };

    try {
      if (!base64 && !uri) {
        throw new Error('Foto kulit tidak ditemukan.');
      }

      const res = await aiService.scanSkin(base64 || uri, context);
      if (res && res.data) {
        // Simpan hasil ke riwayat lokal & buka dedicated page hasil analisis
        const saved = await skinHistoryService.saveScan(res.data, uri);
        setState('idle');
        setPhotoUri(null);
        router.push({
          pathname: '/skin-result',
          params: { id: saved.id },
        });
        return;
      }
      throw new Error('Format respon analisis kulit tidak valid.');
    } catch (err: any) {
      console.error('[SkinScan] Scan API error:', err);
      setErrorMessage(
        err?.message ||
          'Tidak dapat terhubung ke server AI kulit Groq/SCIN. Pastikan koneksi internet stabil.'
      );
      setState('error');
    }
  };

  // Shutter trigger button: Capture live camera photo
  const handleCapturePhoto = async () => {
    if (state !== 'idle') return;

    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        setErrorMessage('Izin kamera ditolak. Silakan izinkan akses kamera di pengaturan perangkat.');
        setState('error');
        return;
      }
    }

    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.85,
          base64: true,
        });
        if (photo?.uri) {
          runAnalysis(photo.uri, photo.base64);
          return;
        }
      } catch (err: any) {
        console.error('[SkinScan] takePictureAsync failed:', err);
        setErrorMessage('Gagal mengambil foto dari kamera: ' + (err?.message || 'Kamera tidak merespon'));
        setState('error');
        return;
      }
    }

    setErrorMessage('Kamera belum siap. Pastikan perangkat memiliki modul kamera yang aktif.');
    setState('error');
  };

  // Pick from gallery
  const handleLaunchGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        runAnalysis(asset.uri, asset.base64);
      }
    } catch (err: any) {
      console.error('[SkinScan] Gallery error:', err);
      setErrorMessage('Gagal memilih foto dari galeri: ' + (err?.message || 'Error'));
      setState('error');
    }
  };

  const handleRetry = () => {
    setPhotoUri(null);
    setSkinResult(null);
    setErrorMessage(null);
    setState('idle');
  };

  return (
    <View style={styles.root}>
      {/* ─── 1. FULLSCREEN LIVE CAMERA VIEW ─── */}
      {permission?.granted && state === 'idle' ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          flash={flash}
        />
      ) : photoUri ? (
        <Image
          source={{ uri: photoUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      ) : (
        <LinearGradient
          colors={['#57B9F8', '#40A3F5', '#2B80F4', '#1B65DD']}
          locations={[0, 0.25, 0.65, 1]}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Top & Bottom Cinematic Gradient Overlays */}
      <LinearGradient
        colors={['rgba(15, 23, 42, 0.75)', 'transparent']}
        style={styles.topVignette}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', 'rgba(15, 23, 42, 0.85)']}
        style={styles.bottomVignette}
        pointerEvents="none"
      />

      {/* ─── 2. TOP NAVIGATION & BALANCED SWITCHER BAR ─── */}
      <View style={[styles.topNavBar, { paddingTop: insets.top + 8 }]}>
        <Pressable
          style={styles.circleBtn}
          onPress={handleBack}
          hitSlop={12}
          accessibilityLabel="Kembali"
        >
          <Ionicons name="arrow-back" size={22} color="white" />
        </Pressable>

        {/* Centered Segmented Switcher */}
        <View style={styles.segmentedControl}>
          <Pressable
            style={styles.segmentOption}
            onPress={() => router.replace('/lung-check')}
          >
            <Ionicons name="mic-outline" size={14} color="rgba(255,255,255,0.75)" style={{ marginRight: 4 }} />
            <Text style={styles.segmentTextInactive}>Deteksi Batuk</Text>
          </Pressable>

          <View style={[styles.segmentOption, styles.segmentOptionActive]}>
            <Ionicons name="scan" size={14} color="#2373F4" style={{ marginRight: 4 }} />
            <Text style={styles.segmentTextActive}>Scan Kulit</Text>
          </View>
        </View>

        {/* Camera Controls (Flip / Flash / History) */}
        <View style={styles.cameraControlsRow}>
          {permission?.granted && state === 'idle' ? (
            <>
              <Pressable
                style={styles.circleBtnSmall}
                onPress={() => router.push('/skin-result')}
                accessibilityLabel="Riwayat Analisis Kulit"
              >
                <Ionicons name="time-outline" size={18} color="white" />
              </Pressable>
              <Pressable style={styles.circleBtnSmall} onPress={toggleFlash}>
                <Ionicons
                  name={flash === 'on' ? 'flash' : 'flash-off'}
                  size={18}
                  color={flash === 'on' ? '#FFB433' : 'white'}
                />
              </Pressable>
              <Pressable style={styles.circleBtnSmall} onPress={toggleCameraFacing}>
                <Ionicons name="camera-reverse" size={18} color="white" />
              </Pressable>
            </>
          ) : (
            <Pressable
              style={styles.circleBtnSmall}
              onPress={() => router.push('/skin-result')}
              accessibilityLabel="Riwayat Analisis Kulit"
            >
              <Ionicons name="time-outline" size={18} color="white" />
            </Pressable>
          )}
        </View>
      </View>

      {/* ─── 3. PERMISSION PROMPT IF NOT GRANTED ─── */}
      {!permission?.granted && state === 'idle' && (
        <View style={styles.permissionCard}>
          <Ionicons name="camera" size={38} color="#FFFFFF" style={{ marginBottom: 10 }} />
          <Text style={styles.permissionTitle}>Akses Kamera Diperlukan</Text>
          <Text style={styles.permissionDesc}>
            AURA membutuhkan akses kamera untuk memindai kondisi kulit Anda secara real-time.
          </Text>
          <Pressable style={styles.permissionBtn} onPress={requestPermission}>
            <Text style={styles.permissionBtnText}>Izinkan Kamera</Text>
          </Pressable>
        </View>
      )}

      {/* ─── 4. RETICLE SCANNING BINGKAI OVERLAY ─── */}
      {(state === 'idle' || state === 'analyzing') && (
        <View style={styles.reticleWrapper}>
          <View style={[styles.reticleTargetBox, { width: TARGET_SIZE, height: TARGET_SIZE }]}>
            {/* 4 Precise Corner Brackets */}
            <View style={[styles.cornerBracket, styles.cornerTL]} />
            <View style={[styles.cornerBracket, styles.cornerTR]} />
            <View style={[styles.cornerBracket, styles.cornerBL]} />
            <View style={[styles.cornerBracket, styles.cornerBR]} />

            {/* Faint Center Reticle Crosshair */}
            <View style={styles.crosshairDot} />

            {/* Animated Laser Scanning Beam */}
            <Animated.View
              style={[
                styles.laserBeam,
                {
                  backgroundColor: state === 'analyzing' ? '#65D0F4' : '#2373F4',
                  shadowColor: state === 'analyzing' ? '#65D0F4' : '#2373F4',
                },
                laserStyle,
              ]}
            >
              <LinearGradient
                colors={
                  state === 'analyzing'
                    ? ['rgba(101, 208, 244, 0)', 'rgba(101, 208, 244, 1)', 'rgba(101, 208, 244, 0)']
                    : ['rgba(35, 115, 244, 0)', 'rgba(35, 115, 244, 1)', 'rgba(35, 115, 244, 0)']
                }
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>

          {/* Live Scanner Status Badge */}
          <View style={styles.liveScannerBadge}>
            <View style={[styles.liveDot, { backgroundColor: state === 'analyzing' ? '#EF4444' : '#10B981' }]} />
            <Text style={styles.liveScannerBadgeText}>
              {state === 'idle'
                ? 'ARAHKAN AREA KULIT KE TENGAH BINGKAI'
                : 'AI SEDANG MENGANALISIS STRUKTUR KULIT...'}
            </Text>
          </View>

          {state === 'analyzing' && <PulsingDots />}
        </View>
      )}

      {/* ─── 5. RESULT DASHBOARD ─── */}
      {state === 'result' && skinResult ? (
        <View style={styles.centerArea}>
          <SkinResultCard
            data={skinResult}
            onConsult={() => router.push('/ceksekarang')}
          />
        </View>
      ) : state === 'error' ? (
        <View style={styles.centerArea}>
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={54} color="#EF4444" />
            <Text style={styles.errorTitle}>Analisis Kulit Gagal</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <Pressable style={styles.retryActionBtn} onPress={handleRetry}>
              <Ionicons name="refresh" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.retryActionBtnText}>Ambil Foto Ulang</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* ─── 6. BOTTOM SHUTTER / CONTROLS BAR ─── */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 28 }]}>
        {state === 'idle' && (
          <View style={styles.idleBottomContainer}>
            <View style={styles.shutterRow}>
              {/* Gallery button */}
              <Pressable
                style={styles.sideControlBtn}
                onPress={handleLaunchGallery}
                hitSlop={8}
                accessibilityLabel="Pilih dari Galeri"
              >
                <Ionicons name="images" size={24} color="#FFFFFF" />
                <Text style={styles.sideControlBtnText}>Galeri</Text>
              </Pressable>

              {/* Big Circular Camera Shutter Button */}
              <Pressable
                style={styles.shutterOuterRing}
                onPress={handleCapturePhoto}
                accessibilityLabel="Ambil Foto dan Pindai Kulit"
              >
                <View style={styles.shutterInnerButton}>
                  <Ionicons name="scan" size={28} color="#2373F4" />
                </View>
              </Pressable>

              {/* Flip camera button */}
              <Pressable
                style={styles.sideControlBtn}
                onPress={toggleCameraFacing}
                hitSlop={8}
                accessibilityLabel="Putar Kamera"
              >
                <Ionicons name="camera-reverse" size={24} color="#FFFFFF" />
                <Text style={styles.sideControlBtnText}>Putar</Text>
              </Pressable>
            </View>
          </View>
        )}

        {(state === 'result' || state === 'error') && (
          <View style={styles.resultBtns}>
            <Pressable style={styles.retryBtn} onPress={handleRetry}>
              <Ionicons name="refresh" size={18} color="#2373F4" />
              <Text style={styles.retryBtnTxt}>Pindai Ulang</Text>
            </Pressable>
            <Pressable style={styles.homeBtn} onPress={handleBack}>
              <Text style={styles.homeBtnTxt}>Kembali</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════
// ─── STYLES (Rock-solid, beautiful layout matching design mockup) ────
// ═════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0F172A',
    position: 'relative',
  },
  topVignette: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 160,
    zIndex: 10,
  },
  bottomVignette: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 220,
    zIndex: 10,
  },

  /* Top Nav Bar */
  topNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 25,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  circleBtnSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Segmented Switcher */
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 999,
    padding: 3,
    alignItems: 'center',
  },
  segmentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  segmentOptionActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentTextActive: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2373F4',
  },
  segmentTextInactive: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  /* Permission Card */
  permissionCard: {
    position: 'absolute',
    top: '40%',
    left: '8%',
    right: '8%',
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    zIndex: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  permissionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  permissionDesc: {
    color: '#94A3B8',
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  permissionBtn: {
    backgroundColor: '#2373F4',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 999,
  },
  permissionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  /* Reticle Box */
  reticleWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 15,
  },
  reticleTargetBox: {
    position: 'relative',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cornerBracket: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#2373F4',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3.5,
    borderLeftWidth: 3.5,
    borderTopLeftRadius: 12,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3.5,
    borderRightWidth: 3.5,
    borderTopRightRadius: 12,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3.5,
    borderLeftWidth: 3.5,
    borderBottomLeftRadius: 12,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3.5,
    borderRightWidth: 3.5,
    borderBottomRightRadius: 12,
  },
  crosshairDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  laserBeam: {
    position: 'absolute',
    left: 4,
    right: 4,
    height: 2.5,
    zIndex: 10,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 3,
  },

  /* Live Scanner Badge */
  liveScannerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    marginTop: 20,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  liveScannerBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  /* Analyzing dots */
  dotsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },

  /* Center area */
  centerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },

  /* Result Card */
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingVertical: 28,
    paddingHorizontal: 22,
    alignItems: 'center',
    width: '88%',
    maxWidth: 340,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 10,
  },
  modelBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 4,
  },
  modelBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#2563EB',
  },
  resultScore: {
    fontSize: 52,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 6,
    letterSpacing: -1,
  },
  resultLabel: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },
  confidenceText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  resultDivider: {
    width: '55%',
    height: 3,
    borderRadius: 2,
    marginVertical: 12,
  },
  resultMessage: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  environmentalTriad: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    width: '100%',
  },
  envPill: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  envPillLabel: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  envPillVal: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#1E293B',
  },
  metricsPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    width: '100%',
  },
  metricPill: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  metricPillLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 2,
  },
  metricPillVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  recomBox: {
    width: '100%',
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  recomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  recomHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  recomText: {
    fontSize: 10.5,
    color: '#1E40AF',
    lineHeight: 15,
  },
  disclaimerText: {
    fontSize: 10,
    color: '#94A3B8',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 10,
    lineHeight: 14,
  },
  consultCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
  },
  consultCardBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2373F4',
  },

  /* Error card */
  errorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    width: '90%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 10,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  retryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2373F4',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
    marginTop: 18,
  },
  retryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  /* Bottom Controls Bar */
  bottomBar: {
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 20,
  },
  idleBottomContainer: {
    width: '100%',
    alignItems: 'center',
  },
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 300,
    paddingHorizontal: 10,
  },
  sideControlBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideControlBtnText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '700',
    marginTop: 2,
  },
  shutterOuterRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  shutterInnerButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Result action buttons */
  resultBtns: {
    flexDirection: 'row',
    gap: 14,
    width: '88%',
    maxWidth: 340,
    justifyContent: 'center',
  },
  retryBtn: {
    flex: 1,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 999,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  retryBtnTxt: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2373F4',
  },
  homeBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingVertical: 15,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeBtnTxt: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
});
