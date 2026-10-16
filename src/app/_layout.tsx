import '@/global.css';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuraColors } from '@/constants/aura-theme';
import { AuthProvider } from '@/context/auth-context';
import { applyGlobalFont } from '@/utils/apply-global-font';
import { backgroundMobilityTracker } from '@/services/backgroundMobilityTracker';

SplashScreen.preventAutoHideAsync();

const AuraNavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: AuraColors.background,
    primary: AuraColors.primary,
  },
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      applyGlobalFont();
      SplashScreen.hideAsync();

      // Mulai pelacakan mobilitas hemat daya di latar belakang secara otomatis
      backgroundMobilityTracker.startBackgroundTracking().catch((err) => {
        console.warn('[RootLayout] Background tracking init error:', err);
      });
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider value={AuraNavigationTheme}>
          <StatusBar style="light" />
          <View style={styles.container}>
            <AnimatedSplashOverlay />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: AuraColors.background },
                animation: 'slide_from_right',
              }}
            >
              <Stack.Screen
                name="index"
                options={{
                  animation: 'fade',
                  animationDuration: 300,
                }}
              />
              <Stack.Screen
                name="login"
                options={{
                  animation: 'fade',
                  animationDuration: 300,
                }}
              />
              <Stack.Screen
                name="register"
                options={{
                  animation: 'ios_from_right',
                  animationDuration: 350,
                }}
              />
              <Stack.Screen
                name="complete-profile"
                options={{
                  animation: 'ios_from_right',
                  animationDuration: 350,
                }}
              />
              <Stack.Screen name="complete-register" />
              <Stack.Screen
                name="forgot-password"
                options={{
                  animation: 'fade_from_bottom',
                  animationDuration: 350,
                }}
              />
              <Stack.Screen name="dashboard" />
              <Stack.Screen name="pollution-impact" />
              <Stack.Screen
                name="ai-pollution-impact"
                options={{
                  animation: 'slide_from_right',
                  animationDuration: 300,
                }}
              />
              <Stack.Screen name="explore" />
              <Stack.Screen
                name="lung-check"
                options={{
                  animation: 'fade_from_bottom',
                  animationDuration: 350,
                }}
              />
              <Stack.Screen
                name="skin-check"
                options={{
                  animation: 'fade_from_bottom',
                  animationDuration: 350,
                }}
              />
              <Stack.Screen
                name="skin-result"
                options={{
                  animation: 'slide_from_right',
                  animationDuration: 300,
                }}
              />
              <Stack.Screen
                name="lung-result"
                options={{
                  animation: 'slide_from_right',
                  animationDuration: 300,
                }}
              />
              <Stack.Screen name="ceksekarang" />
              <Stack.Screen
                name="kebutuhan-harian"
                options={{
                  animation: 'slide_from_right',
                  animationDuration: 300,
                }}
              />
              <Stack.Screen name="doctor-reservation" />
              <Stack.Screen name="hospital-detail" />
              <Stack.Screen name="hospital-route" />
            </Stack>
          </View>
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AuraColors.background,
  },
});
