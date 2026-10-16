import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Dimensions,
  StyleSheet,
  ActivityIndicator,
  Modal,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { getLandscapeAsset } from '@/services/terrainService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// CityBuildingSplash — Animasi Mulus Gedung Kota Bertingkat Muncul Berurutan
// Memanfaatkan aset asli "kota.png" dipisah dalam 7 irisan arsitektur yang muncul
// satu per satu dari bawah tanah ke angkasa dengan fisika spring elastis native.
// ─────────────────────────────────────────────────────────────────────────────

interface SliceConfig {
  id: string;
  leftPct: number;
  widthPct: number;
  delay: number;
  riseRatio: number;
  damping: number;
  stiffness: number;
  mass: number;
  scaleY: number;
}

const CITY_SLICES: SliceConfig[] = [
  // Slice 0: Gedung pencakar langit kaca biru kiri (paling tinggi)
  {
    id: 'left-tall',
    leftPct: 0,
    widthPct: 16.5,
    delay: 440,
    riseRatio: 0.88,
    damping: 14,
    stiffness: 85,
    mass: 0.85,
    scaleY: 1.15,
  },
  // Slice 1: Gedung gaya klasik bertiang & atap merah kiri
  {
    id: 'left-mid',
    leftPct: 14.5,
    widthPct: 18,
    delay: 240,
    riseRatio: 0.75,
    damping: 13,
    stiffness: 95,
    mass: 0.8,
    scaleY: 1.1,
  },
  // Slice 2: Menara jarum & deretan gedung bertingkat kiri-tengah
  {
    id: 'left-spire',
    leftPct: 30.5,
    widthPct: 16,
    delay: 100,
    riseRatio: 0.65,
    damping: 14,
    stiffness: 105,
    mass: 0.75,
    scaleY: 1.06,
  },
  // Slice 3: Tengah sungai, jembatan, tugu monumen & cakrawala (MUNCUL PERTAMA)
  {
    id: 'center-skyline',
    leftPct: 44.5,
    widthPct: 20,
    delay: 0,
    riseRatio: 0.55,
    damping: 15,
    stiffness: 100,
    mass: 0.8,
    scaleY: 1.05,
  },
  // Slice 4: Deretan menara perkantoran kanan-tengah
  {
    id: 'right-spire',
    leftPct: 62.5,
    widthPct: 15,
    delay: 130,
    riseRatio: 0.65,
    damping: 14,
    stiffness: 105,
    mass: 0.75,
    scaleY: 1.06,
  },
  // Slice 5: Gedung bertingkat modern krem & papan iklan kanan
  {
    id: 'right-mid',
    leftPct: 75.5,
    widthPct: 15,
    delay: 280,
    riseRatio: 0.75,
    damping: 13,
    stiffness: 95,
    mass: 0.8,
    scaleY: 1.1,
  },
  // Slice 6: Mega-gedung pencakar langit kaca biru kanan (grand finale)
  {
    id: 'right-tall',
    leftPct: 88.5,
    widthPct: 13,
    delay: 520,
    riseRatio: 0.88,
    damping: 14,
    stiffness: 85,
    mass: 0.85,
    scaleY: 1.15,
  },
];

function BuildingSliceItem({
  config,
  heroHeight,
  screenWidth,
  kotaAsset,
}: {
  config: SliceConfig;
  heroHeight: number;
  screenWidth: number;
  kotaAsset: any;
}) {
  const initialOffset = heroHeight * config.riseRatio;
  const translateY = useSharedValue(initialOffset);
  const opacity = useSharedValue(0.15);
  const scaleY = useSharedValue(config.scaleY);
  const scaleX = useSharedValue(0.96);

  useEffect(() => {
    translateY.value = initialOffset;
    opacity.value = 0.15;
    scaleY.value = config.scaleY;
    scaleX.value = 0.96;

    // Animasi naik dengan spring lembut & elastis
    translateY.value = withDelay(
      config.delay,
      withSpring(0, {
        damping: config.damping,
        stiffness: config.stiffness,
        mass: config.mass,
      })
    );

    // Fade-in halus ke penuh
    opacity.value = withDelay(
      config.delay,
      withTiming(1, {
        duration: 260,
        easing: Easing.out(Easing.quad),
      })
    );

    // Pemulihan squash & stretch kembali ke 1.0
    scaleY.value = withDelay(
      config.delay,
      withSpring(1.0, { damping: 12, stiffness: 110 })
    );
    scaleX.value = withDelay(
      config.delay,
      withSpring(1.0, { damping: 12, stiffness: 110 })
    );
  }, [config, heroHeight, initialOffset]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scaleY: scaleY.value },
      { scaleX: scaleX.value },
    ],
    opacity: opacity.value,
  }));

  const imageOffsetLeft = -screenWidth * (config.leftPct / 100);

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${config.leftPct}%` as any,
          width: `${config.widthPct}%` as any,
          overflow: 'hidden',
          zIndex: 2,
        },
        animStyle,
      ]}
      pointerEvents="none"
    >
      <Image
        source={kotaAsset}
        style={{
          position: 'absolute',
          top: 0,
          left: imageOffsetLeft,
          width: screenWidth,
          height: heroHeight,
        }}
        contentFit="cover"
        contentPosition="bottom"
      />
    </Animated.View>
  );
}

function CityForegroundLayer({
  heroHeight,
  kotaAsset,
}: {
  heroHeight: number;
  kotaAsset: any;
}) {
  const fgHeight = Math.round(heroHeight * 0.22);
  const translateY = useSharedValue(20);
  const opacity = useSharedValue(0.2);

  useEffect(() => {
    translateY.value = 20;
    opacity.value = 0.2;

    translateY.value = withDelay(30, withSpring(0, { damping: 15, stiffness: 100 }));
    opacity.value = withDelay(30, withTiming(1, { duration: 240 }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: fgHeight,
          overflow: 'hidden',
          zIndex: 4,
        },
        animStyle,
      ]}
    >
      <Image
        source={kotaAsset}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: heroHeight,
        }}
        contentFit="cover"
        contentPosition="bottom"
      />
    </Animated.View>
  );
}

function ShimmerParticle({
  leftPct,
  bottomStart,
  delay,
  duration,
  size,
  color,
}: {
  leftPct: number;
  bottomStart: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
}) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.4);

  useEffect(() => {
    translateY.value = 0;
    opacity.value = 0;
    scale.value = 0.4;

    translateY.value = withDelay(
      delay,
      withTiming(-80, { duration, easing: Easing.out(Easing.quad) })
    );
    opacity.value = withDelay(
      delay,
      withTiming(0.9, { duration: duration * 0.35 }, () => {
        opacity.value = withTiming(0, { duration: duration * 0.65 });
      })
    );
    scale.value = withDelay(delay, withSpring(1, { damping: 8, stiffness: 90 }));
  }, [delay, duration]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: `${leftPct}%` as any,
          bottom: bottomStart,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 4,
          elevation: 3,
          zIndex: 5,
        },
        animStyle,
      ]}
    />
  );
}

function MasterCrossfadeLayer({
  kotaAsset,
  onComplete,
}: {
  kotaAsset: any;
  onComplete?: () => void;
}) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = 0;
    opacity.value = withDelay(
      1250,
      withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) }, () => {
        if (onComplete) {
          onComplete();
        }
      })
    );
  }, [onComplete]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { zIndex: 6 }, animStyle]}
    >
      <Image
        source={kotaAsset}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition="bottom"
      />
    </Animated.View>
  );
}

export interface CityBuildingSplashProps {
  /** Tinggi container (default: 290 atau layar penuh jika fullscreen=true) */
  heroHeight?: number;
  /** Tampilkan sebagai loading/splash penuh */
  fullscreen?: boolean;
  /** Pesan teks loading di atas/bawah animasi */
  message?: string;
  /** Tampilkan spinner aktivitas */
  showSpinner?: boolean;
  /** Callback saat seluruh gedung selesai muncul (~1250ms) */
  onAnimationComplete?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * CityBuildingSplash Component
 * Dapat digunakan di hero header, banner transisi, maupun loading perpindahan antar layar.
 */
export const CityBuildingSplash: React.FC<CityBuildingSplashProps> = ({
  heroHeight = 290,
  fullscreen = false,
  message,
  showSpinner = false,
  onAnimationComplete,
  style,
}) => {
  const kotaAsset = getLandscapeAsset('kota');
  const [layoutWidth, setLayoutWidth] = useState(SCREEN_WIDTH);
  const actualHeight = fullscreen ? SCREEN_HEIGHT : heroHeight;

  return (
    <View
      onLayout={(e) => {
        const w = Math.round(e.nativeEvent.layout.width);
        if (w > 0 && w !== layoutWidth) setLayoutWidth(w);
      }}
      style={[
        fullscreen ? StyleSheet.absoluteFill : { width: '100%', height: actualHeight },
        { overflow: 'hidden' },
        style,
      ]}
      pointerEvents="none"
    >
      {/* 1. Gradasi Langit Biru Cerah (Identik dengan palet langit kota.png) */}
      <LinearGradient
        colors={['#4ABCEF', '#7CE0FB', '#D2F5FD']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* 2. Tujuh Klaster Gedung Asli kota.png Muncul Berurutan */}
      {CITY_SLICES.map((slice) => (
        <BuildingSliceItem
          key={slice.id}
          config={slice}
          heroHeight={actualHeight}
          screenWidth={layoutWidth}
          kotaAsset={kotaAsset}
        />
      ))}

      {/* 3. Lapisan Foreground Depan (Pohon, Bunga, Pagar Putih & Trotoar) */}
      <CityForegroundLayer heroHeight={actualHeight} kotaAsset={kotaAsset} />

      {/* 4. Partikel Berkilau Halus saat Gedung Mencuat ke Langit */}
      <ShimmerParticle
        leftPct={8}
        bottomStart={actualHeight * 0.3}
        delay={420}
        duration={850}
        size={7}
        color="#FFFFFF"
      />
      <ShimmerParticle
        leftPct={16}
        bottomStart={actualHeight * 0.35}
        delay={480}
        duration={800}
        size={5}
        color="#E0F2FE"
      />
      <ShimmerParticle
        leftPct={22}
        bottomStart={actualHeight * 0.28}
        delay={260}
        duration={800}
        size={6}
        color="#BAE6FD"
      />
      <ShimmerParticle
        leftPct={50}
        bottomStart={actualHeight * 0.25}
        delay={100}
        duration={750}
        size={6}
        color="#FFFFFF"
      />
      <ShimmerParticle
        leftPct={78}
        bottomStart={actualHeight * 0.3}
        delay={300}
        duration={800}
        size={6}
        color="#BAE6FD"
      />
      <ShimmerParticle
        leftPct={92}
        bottomStart={actualHeight * 0.35}
        delay={520}
        duration={850}
        size={8}
        color="#FFFFFF"
      />
      <ShimmerParticle
        leftPct={86}
        bottomStart={actualHeight * 0.28}
        delay={560}
        duration={750}
        size={5}
        color="#E0F2FE"
      />

      {/* 5. Master Seamless Crossfade untuk Kesempurnaan Visual Jangka Panjang */}
      <MasterCrossfadeLayer kotaAsset={kotaAsset} onComplete={onAnimationComplete} />

      {/* 6. Pesan / Indikator Loading Transisi (Jika ada) */}
      {(message || showSpinner) && (
        <View style={splashStyles.messageOverlay} pointerEvents="none">
          <View style={splashStyles.messageBubble}>
            {showSpinner && (
              <ActivityIndicator size="small" color="#0284C7" style={{ marginRight: 8 }} />
            )}
            {message ? <Text style={splashStyles.messageText}>{message}</Text> : null}
          </View>
        </View>
      )}
    </View>
  );
};

export interface PageTransitionSplashProps {
  visible: boolean;
  message?: string;
  minDisplayMs?: number;
  onDismiss?: () => void;
}

/**
 * PageTransitionSplash
 * Modal loading transisi layar penuh dengan animasi gedung kota AURA.
 * Dilengkapi minDisplayMs untuk mencegah flicker jika API merespon terlalu cepat.
 */
export const PageTransitionSplash: React.FC<PageTransitionSplashProps> = ({
  visible,
  message = 'Memuat Data...',
  minDisplayMs = 500,
  onDismiss,
}) => {
  const [internalVisible, setInternalVisible] = useState(visible);
  const showTimeRef = React.useRef<number>(0);

  useEffect(() => {
    let timeoutId: any = null;
    if (visible) {
      showTimeRef.current = Date.now();
      setInternalVisible(true);
    } else {
      const elapsed = Date.now() - showTimeRef.current;
      const remaining = Math.max(0, minDisplayMs - elapsed);
      timeoutId = setTimeout(() => {
        setInternalVisible(false);
      }, remaining);
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [visible, minDisplayMs]);

  if (!internalVisible) return null;

  return (
    <Modal
      visible={internalVisible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={StyleSheet.absoluteFill}>
        <CityBuildingSplash fullscreen message={message} showSpinner />
      </View>
    </Modal>
  );
};

const splashStyles = StyleSheet.create({
  messageOverlay: {
    position: 'absolute',
    bottom: 36,
    left: 20,
    right: 20,
    zIndex: 10,
    alignItems: 'center',
  },
  messageBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.15)',
  },
  messageText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
});

export default CityBuildingSplash;
