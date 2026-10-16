import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Path,
  Rect,
} from 'react-native-svg';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  useAudioRecorder,
  RecordingPresets,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import { aiService } from '@/services/aiService';
import { CoughPredictionResponse, CoughMobilityContext } from '@/types/ai';
import { useAuth } from '@/context/auth-context';
import { backgroundMobilityTracker } from '@/services/backgroundMobilityTracker';
import { AudioToWavConverter, AudioToWavConverterRef } from '@/components/AudioToWavConverter';
import { lungHistoryService } from '@/services/lungHistoryService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MIC_WIDTH = Math.min(SCREEN_WIDTH * 0.52, 220);
const MIC_HEIGHT = MIC_WIDTH * (465 / 266); // preserve original SVG aspect ratio (266 x 465)

type DetectionState = 'idle' | 'listening' | 'analyzing' | 'result' | 'error';

// ─── Microphone Icon (exact asset preserved) ─────────────────────────
const MicrophoneIcon: React.FC<{ width: number; height: number }> = ({
  width,
  height,
}) => (
  <Svg width={width} height={height} viewBox="0 0 266 465" fill="none">
    <Rect x="109.728" y="376.379" width="44.9491" height="59.4915" fill="#2373F4" />
    <Rect y="196.583" width="17.1864" height="42.305" fill="#578EF5" />
    <Rect x="248.542" y="196.583" width="17.1864" height="42.305" fill="#578EF5" />
    <Rect x="33.0508" y="196.583" width="19.8305" height="25.1186" fill="#578EF5" />
    <Rect x="210.203" y="196.583" width="19.8305" height="25.1186" fill="#578EF5" />
    <Rect x="14.542" y="181.387" width="22.4746" height="37.0169" rx="6" fill="white" />
    <Path
      d="M74.0382 328.137C48.9196 306.985 48.9176 261.374 49.5786 227.002C48.6974 197.917 50.9719 91.5258 51.5594 80.9131C52.2181 69.0145 61.4679 4.06973 134.187 4.896C192.356 5.55694 206.68 49.1883 212.85 70.3408C216.155 92.1544 214.172 156.934 214.173 234.273C214.175 313.771 185.089 334.747 170.547 342.68C130.885 361.188 88.1399 341.357 74.0382 328.137Z"
      fill="white"
    />
    <Path
      d="M210.204 357.879C182.177 386.963 131.543 388.946 109.729 386.302C50.8989 369.116 35.0338 338.709 22.4745 317.557C12.4271 300.635 14.9829 229.641 15.2032 202.54C16.0846 192.184 18.3769 186.411 28.4243 182.709C38.4718 179.008 37.0176 235.37 35.0346 264.014C34.5939 294.201 49.9736 356.821 115.018 365.811C196.323 377.048 213.508 316.896 221.44 304.997C229.372 293.099 227.39 264.014 228.712 222.37C229.77 189.055 232.238 182.489 233.339 183.37C238.187 176.76 248.278 174.116 249.865 216.421C251.451 258.726 248.542 286.048 246.559 295.743C246.339 303.455 238.231 328.794 210.204 357.879Z"
      fill="white"
    />
    <Path
      d="M74.0382 328.137C48.9196 306.985 48.9176 261.374 49.5786 227.002C48.6974 197.917 50.9719 91.5258 51.5594 80.9131C52.2181 69.0145 61.4679 4.06973 134.187 4.896C192.356 5.55694 206.68 49.1883 212.85 70.3408C216.155 92.1544 214.172 156.934 214.173 234.273C214.175 313.771 185.089 334.747 170.547 342.68C130.885 361.188 88.1399 341.357 74.0382 328.137Z"
      stroke="white"
    />
    <Path
      d="M210.204 357.879C182.177 386.963 131.543 388.946 109.729 386.302C50.8989 369.116 35.0338 338.709 22.4745 317.557C12.4271 300.635 14.9829 229.641 15.2032 202.54C16.0846 192.184 18.3769 186.411 28.4243 182.709C38.4718 179.008 37.0176 235.37 35.0346 264.014C34.5939 294.201 49.9736 356.821 115.018 365.811C196.323 377.048 213.508 316.896 221.44 304.997C229.372 293.099 227.39 264.014 228.712 222.37C229.77 189.055 232.238 182.489 233.339 183.37C238.187 176.76 248.278 174.116 249.865 216.421C251.451 258.726 248.542 286.048 246.559 295.743C246.339 303.455 238.231 328.794 210.204 357.879Z"
      stroke="white"
    />
    <Rect x="228.712" y="178.743" width="22.4746" height="67.4237" rx="6" fill="white" />
    <Rect x="43.6289" y="175.43" width="38.3389" height="26.4406" rx="4" fill="#2373F4" />
    <Rect x="183.763" y="175.43" width="38.3389" height="26.4406" rx="4" fill="#2373F4" />
    {/* Crosshatch lines (\ direction) */}
    <Rect x="74.9697" y="173.665" width="180.404" height="6.61016" transform="rotate(-44.5186 74.9697 173.665)" fill="#2373F4" />
    <Rect x="46.999" y="170.057" width="201.632" height="6.61016" transform="rotate(-44.5186 46.999 170.057)" fill="#2373F4" />
    <Rect x="42.292" y="141.015" width="179.067" height="6.61016" transform="rotate(-44.5186 42.292 141.015)" fill="#2373F4" />
    <Rect x="47.5664" y="103.314" width="140.676" height="6.61016" transform="rotate(-44.5186 47.5664 103.314)" fill="#2373F4" />
    <Rect x="46.1094" y="70.2307" width="94.6058" height="6.61016" transform="rotate(-44.5186 46.1094 70.2307)" fill="#2373F4" />
    {/* Crosshatch lines (/ direction) */}
    <Rect x="213.013" y="72.9766" width="92.5999" height="6.61016" transform="rotate(-135.694 213.013 72.9766)" fill="#2373F4" />
    <Rect x="216.246" y="108.456" width="148.5" height="6.61016" transform="rotate(-135.694 216.246 108.456)" fill="#2373F4" />
    <Rect x="216.804" y="142.771" width="183.39" height="6.61016" transform="rotate(-135.694 216.804 142.771)" fill="#2373F4" />
    <Rect x="215.543" y="176.699" width="211.359" height="6.61016" transform="rotate(-135.694 215.543 176.699)" fill="#2373F4" />
    <Rect x="169.272" y="195.208" width="171.853" height="6.61016" transform="rotate(-135.694 169.272 195.208)" fill="#2373F4" />
    <Rect x="125.916" y="185.188" width="111.295" height="6.61016" transform="rotate(-135.694 125.916 185.188)" fill="#2373F4" />
    <Rect x="95.5098" y="191.798" width="71.8925" height="6.61016" transform="rotate(-135.694 95.5098 191.798)" fill="#2373F4" />
    <Rect x="204.967" y="196.53" width="214.179" height="6.61016" transform="rotate(-135.694 204.967 196.53)" fill="#2373F4" />
    <Rect x="99.208" y="183.146" width="161.841" height="6.61016" transform="rotate(-44.5186 99.208 183.146)" fill="#2373F4" />
    <Rect x="133.07" y="182.843" width="113.787" height="6.61016" transform="rotate(-44.5186 133.07 182.843)" fill="#2373F4" />
    <Rect x="159.851" y="191.35" width="78.676" height="6.61016" transform="rotate(-44.5186 159.851 191.35)" fill="#2373F4" />
    {/* Mic body outline */}
    <Path
      d="M71.8979 330.278C45.795 308.899 45.7929 262.8 46.4798 228.059C45.564 198.663 47.9277 91.132 48.5383 80.4055C49.2228 68.3795 58.835 2.73894 134.404 3.57406C194.852 4.24209 209.737 48.3409 216.149 69.72C219.583 91.7672 217.522 157.241 217.524 235.408C217.526 315.758 187.3 336.959 172.188 344.976C130.973 363.683 86.5522 343.64 71.8979 330.278Z"
      stroke="white"
      strokeWidth="5"
    />
    <Rect x="79.3232" y="175.43" width="105.763" height="26.4406" rx="4" fill="#578EF5" />
    {/* Stand base */}
    <Path
      d="M62.8884 430.986C64.1028 427.948 67.045 425.955 70.317 425.955H193.308C196.285 425.955 199.017 427.609 200.397 430.248L211.407 451.302C214.18 456.602 210.366 462.959 204.385 463.009L61.494 464.195C55.807 464.243 51.8882 458.507 53.999 453.226L62.8884 430.986Z"
      fill="white"
    />
  </Svg>
);

// ─── Sound Wave SVG Asset (exact from reference) ──────────────────────
const SoundWaveIcon: React.FC<{ width: number; height: number }> = ({
  width,
  height,
}) => (
  <Svg width={width} height={height} viewBox="0 0 68 93" fill="none">
    <Path
      d="M3.19727 67.5508C15.9082 56.671 18.0694 40.5977 7.02539 25.1094"
      stroke="white"
      strokeWidth="5.5"
      strokeLinecap="round"
    />
    <Path
      d="M24.2827 79.5244C44.7578 61.6441 46.9081 33.3276 28.1108 13.125"
      stroke="white"
      strokeWidth="5.5"
      strokeLinecap="round"
    />
    <Path
      d="M45.3677 90.0717C73.6069 66.6163 75.7463 26.057 49.1958 3.14062"
      stroke="white"
      strokeWidth="5.5"
      strokeLinecap="round"
    />
  </Svg>
);

// ─── Animated Dual Sound Waves ────────────────────────────────────────
const AnimatedSoundWaves: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const waveAnim = useSharedValue(0);

  useEffect(() => {
    if (isActive) {
      waveAnim.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 700, easing: Easing.in(Easing.quad) })
        ),
        -1,
        false
      );
    } else {
      cancelAnimation(waveAnim);
      waveAnim.value = withTiming(0, { duration: 300 });
    }
    return () => cancelAnimation(waveAnim);
  }, [isActive]);

  const rightWaveStyle = useAnimatedStyle(() => {
    const scale = interpolate(waveAnim.value, [0, 0.5, 1], [0.75, 1.15, 0.95], Extrapolation.CLAMP);
    const opacity = interpolate(waveAnim.value, [0, 0.2, 0.8, 1], [0, 0.9, 1, 0.2], Extrapolation.CLAMP);
    const translateX = interpolate(waveAnim.value, [0, 1], [0, 8], Extrapolation.CLAMP);
    const translateY = interpolate(waveAnim.value, [0, 1], [0, -6], Extrapolation.CLAMP);

    return {
      opacity,
      transform: [
        { scale },
        { translateX },
        { translateY },
      ],
    };
  });

  const leftWaveStyle = useAnimatedStyle(() => {
    const scale = interpolate(waveAnim.value, [0, 0.5, 1], [0.75, 1.15, 0.95], Extrapolation.CLAMP);
    const opacity = interpolate(waveAnim.value, [0, 0.2, 0.8, 1], [0, 0.9, 1, 0.2], Extrapolation.CLAMP);
    const translateX = interpolate(waveAnim.value, [0, 1], [0, -8], Extrapolation.CLAMP);
    const translateY = interpolate(waveAnim.value, [0, 1], [0, -6], Extrapolation.CLAMP);

    return {
      opacity,
      transform: [
        { scaleX: -1 }, // Mirror wave for left side
        { scale },
        { translateX },
        { translateY },
      ],
    };
  });

  const WAVE_HEIGHT = MIC_HEIGHT * 0.23;
  const WAVE_WIDTH = WAVE_HEIGHT * (68 / 93);

  if (!isActive) return null;

  return (
    <>
      <Animated.View style={[styles.rightWavePos, rightWaveStyle]}>
        <SoundWaveIcon width={WAVE_WIDTH} height={WAVE_HEIGHT} />
      </Animated.View>

      <Animated.View style={[styles.leftWavePos, leftWaveStyle]}>
        <SoundWaveIcon width={WAVE_WIDTH} height={WAVE_HEIGHT} />
      </Animated.View>
    </>
  );
};

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

// ─── Result Card with ONNX ICBHI & Pollution Correlation ───────────
const ResultCard: React.FC<{
  result: CoughPredictionResponse;
  onConsult: () => void;
}> = ({ result, onConsult }) => {
  const slideY = useSharedValue(40);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 550 });
    slideY.value = withSpring(0, { damping: 20, stiffness: 80 });
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: slideY.value }],
  }));

  const isHealthy = result.status === 'healthy' || result.prediction === 'Normal';
  const isModerate = result.status === 'moderate' || result.severity === 'moderate';
  const color = isHealthy ? '#10B981' : isModerate ? '#F59E0B' : '#EF4444';
  const icon = isHealthy ? 'checkmark-circle' : isModerate ? 'alert-circle' : 'warning';
  const label = isHealthy ? 'Normal' : result.prediction || (isModerate ? 'Cukup Baik' : 'Perlu Perhatian');

  return (
    <Animated.View style={[styles.resultCard, cardStyle]}>
      {/* ONNX AI Badge */}
      <View style={styles.modelBadgeWrap}>
        <Ionicons name="sparkles" size={12} color="#2373F4" />
        <Text style={styles.modelBadgeText}>
          ONNX ICBHI AI • {result.confidence != null ? `${result.confidence.toFixed(1)}% Keyakinan` : 'Teranalisis'}
        </Text>
      </View>

      <Ionicons name={icon as any} size={46} color={color} style={{ marginTop: 6 }} />
      {result.health_score != null && (
        <Text style={styles.resultScore}>{result.health_score}%</Text>
      )}
      <Text style={[styles.resultLabel, { color }]}>{label}</Text>
      <View style={[styles.resultDivider, { backgroundColor: color + '30' }]} />
      {result.clinical_interpretation ? (
        <Text style={styles.resultMessage}>{result.clinical_interpretation}</Text>
      ) : null}

      {/* Environmental Correlation Box */}
      {result.environmental_correlation && (
        <View style={styles.correlationBox}>
          <View style={styles.correlationHeader}>
            <Ionicons name="leaf" size={13} color="#059669" />
            <Text style={styles.correlationTitle}>Korelasi Paparan Polusi:</Text>
          </View>
          <Text style={styles.correlationNotes} numberOfLines={3}>
            {result.environmental_correlation.clinical_correlation_notes ||
              `Paparan outdoor: ${result.environmental_correlation.total_outdoor_minutes ?? 0} mnt${
                result.environmental_correlation.average_outdoor_pm25 != null
                  ? `, PM2.5: ${result.environmental_correlation.average_outdoor_pm25} µg/m³`
                  : ''
              }`}
          </Text>
        </View>
      )}

      {/* Probability Pills */}
      {result.all_probabilities && (
        <View style={styles.metricsPillsRow}>
          {Object.entries(result.all_probabilities).slice(0, 3).map(([key, val]) => (
            <View key={key} style={styles.metricPill}>
              <Text style={styles.metricPillLabel} numberOfLines={1}>{key}</Text>
              <Text style={styles.metricPillVal}>{val}%</Text>
            </View>
          ))}
        </View>
      )}

      {/* Consult Doctor CTA */}
      <Pressable onPress={onConsult} style={styles.consultCardBtn}>
        <Ionicons name="chatbubbles" size={16} color="#2373F4" style={{ marginRight: 6 }} />
        <Text style={styles.consultCardBtnText}>Konsultasi Dokter</Text>
      </Pressable>
    </Animated.View>
  );
};

// ═════════════════════════════════════════════════════════════════════
// ─── Main Screen ─────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════
export default function LungCheckScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const converterRef = useRef<AudioToWavConverterRef>(null);

  const [state, setState] = useState<DetectionState>('idle');
  const [timer, setTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [resultData, setResultData] = useState<CoughPredictionResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/dashboard');
    }
  };

  // Mic pulse animation
  const micScale = useSharedValue(1);

  useEffect(() => {
    if (state === 'listening') {
      micScale.value = withRepeat(
        withSequence(
          withTiming(1.035, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.97, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      cancelAnimation(micScale);
      micScale.value = withTiming(1, { duration: 250 });
    }
    return () => cancelAnimation(micScale);
  }, [state]);

  const micAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: micScale.value }],
  }));

  // Button micro-interaction
  const btnScale = useSharedValue(1);
  const btnAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
  }));

  // Timer counter for 5s recording
  useEffect(() => {
    if (state === 'listening') {
      setTimer(0);
      timerRef.current = setInterval(() => {
        setTimer((t) => t + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state]);

  // Transition from listening to analyzing after 5s
  useEffect(() => {
    if (state === 'listening' && timer >= 5) {
      handleStop();
    }
  }, [timer, state]);

  // Process audio with ONNX ICBHI model (TANPA DUMMY DATA)
  useEffect(() => {
    if (state !== 'analyzing') return;

    let isMounted = true;
    const processCoughAudio = async () => {
      try {
        if (audioRecorder.isRecording) {
          await audioRecorder.stop();
        }
      } catch {
        // ignore
      }

      const uri = audioRecorder.uri || recordedUri;
      if (!uri) {
        if (isMounted) {
          setErrorMessage('File audio rekaman batuk tidak ditemukan. Silakan tekan tombol Mulai dan batuk ke arah mikrofon.');
          setState('error');
        }
        return;
      }

      // Ambil data mobilitas real dari background tracker pengguna (tanpa data palsu)
      const waypoints = backgroundMobilityTracker.getCollectedWaypoints();
      let totalOutdoor = 0;
      waypoints.forEach((wp) => {
        if (wp.classification === 'outdoor') {
          totalOutdoor += wp.duration_minutes;
        }
      });

      const mobilityContext: CoughMobilityContext = {
        outdoorMinutes: totalOutdoor > 0 ? totalOutdoor : undefined,
        usia: user?.usia,
      };

      // ─── Konversi file audio rekaman (.m4a/.aac) ke standar WAV 16-bit PCM (16kHz) sebelum dikirim ───
      let finalAudioUri = uri;
      try {
        if (converterRef.current) {
          console.log('[CoughCheck] Mengonversi audio batuk ke format WAV 16kHz sebelum dikirim ke server AI...');
          finalAudioUri = await converterRef.current.convertToWav(uri, 16000);
          console.log('[CoughCheck] Konversi ke WAV berhasil:', finalAudioUri);
        }
      } catch (convErr: any) {
        console.warn('[CoughCheck] Konversi ke WAV gagal, fallback ke original:', convErr?.message || convErr);
      }

      try {
        const response = await aiService.predictCough(finalAudioUri, mobilityContext);
        if (isMounted) {
          // Simpan hasil ke riwayat lokal & buka dedicated result page
          const saved = await lungHistoryService.saveScan(response, finalAudioUri);
          setState('idle');
          setRecordedUri(null);
          router.push({
            pathname: '/lung-result',
            params: { id: saved.id },
          });
        }
      } catch (err: any) {
        console.error('[CoughCheck] AI prediction failed:', err);
        if (isMounted) {
          setErrorMessage(
            err?.message ||
              'Tidak dapat terhubung ke server ONNX ICBHI batuk. Pastikan koneksi internet stabil.'
          );
          setState('error');
        }
      }
    };

    processCoughAudio();

    return () => {
      isMounted = false;
    };
  }, [state]);

  const handleStart = async () => {
    btnScale.value = withSequence(
      withTiming(0.93, { duration: 100 }),
      withSpring(1, { damping: 12, stiffness: 220 })
    );

    try {
      const perm = await requestRecordingPermissionsAsync();
      if (perm.granted) {
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });
        await audioRecorder.prepareToRecordAsync();
        audioRecorder.record();
        setState('listening');
      } else {
        setErrorMessage('Izin rekaman mikrofon ditolak. Silakan izinkan akses mikrofon di pengaturan perangkat Anda.');
        setState('error');
      }
    } catch (err: any) {
      console.warn('[CoughCheck] Record start error:', err);
      setErrorMessage('Gagal mengaktifkan mikrofon: ' + (err?.message || 'Error'));
      setState('error');
    }
  };

  const handleStop = async () => {
    try {
      if (audioRecorder.isRecording) {
        await audioRecorder.stop();
        setRecordedUri(audioRecorder.uri);
      }
    } catch (err) {
      console.warn('[CoughCheck] Record stop error:', err);
    }
    setState('analyzing');
  };

  const handleRetry = () => {
    setResultData(null);
    setRecordedUri(null);
    setErrorMessage(null);
    setState('idle');
  };

  return (
    <View style={styles.root}>
      {/* Background Gradient — explicit absoluteFill guarantees it NEVER collapses to white */}
      <LinearGradient
        colors={['#57B9F8', '#40A3F5', '#2B80F4', '#1B65DD']}
        locations={[0, 0.25, 0.65, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* ─── 1. TOP NAVIGATION & BALANCED CENTERED SWITCHER BAR ─── */}
      <View style={[styles.topNavBar, { paddingTop: insets.top + 8 }]}>
        <Pressable
          style={styles.backBtn}
          onPress={handleBack}
          hitSlop={12}
          accessibilityLabel="Kembali"
        >
          <Ionicons name="arrow-back" size={22} color="white" />
        </Pressable>

        {/* Centered Segmented Switcher */}
        <View style={styles.segmentedControl}>
          <View style={[styles.segmentOption, styles.segmentOptionActive]}>
            <Ionicons name="mic" size={14} color="#2373F4" style={{ marginRight: 4 }} />
            <Text style={styles.segmentTextActive}>Deteksi Batuk</Text>
          </View>

          <Pressable
            style={styles.segmentOption}
            onPress={() => router.replace('/skin-check')}
          >
            <Ionicons name="scan-outline" size={14} color="rgba(255,255,255,0.75)" style={{ marginRight: 4 }} />
            <Text style={styles.segmentTextInactive}>Scan Kulit</Text>
          </Pressable>
        </View>

        {/* Riwayat Batuk Button */}
        <Pressable
          style={styles.backBtn}
          onPress={() => router.push('/lung-result')}
          hitSlop={12}
          accessibilityLabel="Riwayat Analisis Batuk"
        >
          <Ionicons name="time-outline" size={22} color="white" />
        </Pressable>
      </View>

      {/* ─── 2. TITLE & SUBTITLE ─── */}
      <View style={styles.titleWrap}>
        <Text style={styles.title}>
          {state === 'idle' && 'Deteksi Batuk'}
          {state === 'listening' && 'Mendengarkan Batuk...'}
          {state === 'analyzing' && 'Menganalisis Suara Batuk...'}
          {state === 'result' && 'Hasil Analisis Batuk'}
          {state === 'error' && 'Analisis Batuk Gagal'}
        </Text>
        {state !== 'result' && state !== 'error' && (
          <Text style={styles.subtitle}>
            {state === 'idle' && 'Batukkan ke mikrofon untuk analisis suara batuk Anda'}
            {state === 'listening' &&
              `Silakan batuk ke arah mikrofon (${timer}/5 detik)`}
            {state === 'analyzing' && 'Model ONNX ICBHI sedang memproses pola audio batuk...'}
          </Text>
        )}
      </View>

      {/* ─── 3. CENTER INTERACTIVE MICROPHONE AREA ─── */}
      {state === 'idle' || state === 'listening' || state === 'analyzing' ? (
        <View style={styles.centerArea}>
          <Animated.View style={micAnimStyle}>
            <View style={styles.micContainer}>
              {/* Animated Sound Waves (Left & Right) active during listening */}
              <AnimatedSoundWaves isActive={state === 'listening'} />

              {/* Microphone SVG */}
              <MicrophoneIcon width={MIC_WIDTH} height={MIC_HEIGHT} />
            </View>
          </Animated.View>

          {state === 'analyzing' && <PulsingDots />}
        </View>
      ) : state === 'result' && resultData ? (
        <View style={styles.centerArea}>
          <ResultCard
            result={resultData}
            onConsult={() => router.push('/ceksekarang')}
          />
        </View>
      ) : state === 'error' ? (
        <View style={styles.centerArea}>
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={54} color="#EF4444" />
            <Text style={styles.errorTitle}>Koneksi Server AI Gagal</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <Pressable style={styles.retryActionBtn} onPress={handleRetry}>
              <Ionicons name="refresh" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.retryActionBtnText}>Coba Lagi</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* ─── 4. BOTTOM BUTTON BAR ─── */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 36 }]}>
        {state === 'idle' && (
          <Animated.View style={[styles.startBtnWrap, btnAnimStyle]}>
            <Pressable style={styles.startBtn} onPress={handleStart}>
              <Text style={styles.startBtnTxt}>Mulai</Text>
            </Pressable>
          </Animated.View>
        )}

        {state === 'listening' && (
          <Pressable style={styles.stopBtn} onPress={handleStop}>
            <Ionicons name="stop" size={18} color="#EF4444" />
            <Text style={styles.stopBtnTxt}>Selesai Batuk</Text>
          </Pressable>
        )}

        {(state === 'result' || state === 'error') && (
          <View style={styles.resultBtns}>
            <Pressable style={styles.retryBtn} onPress={handleRetry}>
              <Ionicons name="refresh" size={18} color="#2373F4" />
              <Text style={styles.retryBtnTxt}>Cek Ulang</Text>
            </Pressable>
            <Pressable style={styles.homeBtn} onPress={handleBack}>
              <Text style={styles.homeBtnTxt}>Kembali</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Hidden Web Audio WAV Converter for universal cross-platform M4A->WAV conversion */}
      <AudioToWavConverter ref={converterRef} />
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════
// ─── STYLES (Rock-solid, beautiful layout matching design mockup) ────
// ═════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1E6FE3', // Fallback color so screen is NEVER white
  },

  /* Top Navigation Bar with True Center Alignment */
  topNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 25,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnSpacer: {
    width: 40,
    height: 40,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
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

  titleWrap: {
    alignItems: 'center',
    paddingHorizontal: 28,
    marginTop: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 13.5,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
    maxWidth: 320,
  },

  centerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Mic + waves layout */
  micContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightWavePos: {
    position: 'absolute',
    top: MIC_HEIGHT * 0.05,
    right: -MIC_WIDTH * 0.25,
    zIndex: 10,
  },
  leftWavePos: {
    position: 'absolute',
    top: MIC_HEIGHT * 0.05,
    left: -MIC_WIDTH * 0.25,
    zIndex: 10,
  },

  /* Analyzing dots */
  dotsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
  },
  dot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },

  /* Result card */
  resultCard: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '88%',
    maxWidth: 340,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 10,
  },
  resultScore: {
    fontSize: 54,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 8,
    letterSpacing: -1,
  },
  resultLabel: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 2,
  },
  resultDivider: {
    width: '55%',
    height: 3,
    borderRadius: 2,
    marginVertical: 14,
  },
  resultMessage: {
    fontSize: 13.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
  },

  metricsPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    width: '100%',
    justifyContent: 'center',
  },
  metricPill: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
  correlationBox: {
    width: '100%',
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  correlationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  correlationTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  correlationNotes: {
    fontSize: 10.5,
    color: '#166534',
    lineHeight: 15,
  },
  consultCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
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

  /* Bottom buttons */
  bottomBar: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  startBtnWrap: {
    width: '85%',
    maxWidth: 360,
  },
  startBtn: {
    backgroundColor: '#ffffff',
    paddingVertical: 17,
    borderRadius: 999,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtnTxt: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2373F4',
    textAlign: 'center',
  },

  stopBtn: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 999,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  stopBtnTxt: {
    fontSize: 16,
    fontWeight: '700',
    color: '#EF4444',
  },

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
