import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AuthHeader } from '@/components/auth/AuthHeader';
import { AuraInput } from '@/components/auth/AuraInput';
import { GradientButton } from '@/components/auth/GradientButton';
import { SocialDivider } from '@/components/auth/SocialDivider';
import { AnimatedAuthHeader, AnimatedAuthBody } from '@/components/auth/AuthTransition';
import { useAuth } from '@/context/auth-context';
import { getErrorMessage } from '@/utils/error-mapper';
import { isProfileComplete } from '@/types/auth';
import { PageTransitionSplash } from '@/components/splash/CityBuildingSplash';

export default function RegisterScreen() {
  const router = useRouter();
  const { register, isAuthenticated, user, isLoading: isAuthLoading } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  // Auto-redirect jika user sudah login / memiliki sesi aktif
  useEffect(() => {
    if (!isAuthLoading && isAuthenticated && user) {
      if (isProfileComplete(user)) {
        router.replace('/dashboard');
      } else {
        router.replace('/complete-profile');
      }
    }
  }, [isAuthLoading, isAuthenticated, user, router]);

  if (isAuthLoading || (isAuthenticated && user)) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <PageTransitionSplash
          visible={true}
          message="Menyambungkan sesi aktif..."
        />
      </View>
    );
  }

  const validate = () => {
    const newErrors: {
      name?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    } = {};

    if (!name.trim()) {
      newErrors.name = 'Nama lengkap wajib diisi';
    } else if (name.trim().length > 100) {
      newErrors.name = 'Nama maksimal 100 karakter';
    }

    if (!email.trim()) {
      newErrors.email = 'Alamat email wajib diisi';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Format email tidak valid';
    }

    if (!password) {
      newErrors.password = 'Password wajib diisi';
    } else if (password.length < 8) {
      newErrors.password = 'Password minimal 8 karakter';
    } else if (password.length > 128) {
      newErrors.password = 'Password maksimal 128 karakter';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Konfirmasi password wajib diisi';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Password tidak cocok';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = () => {
    setServerError(null);
    if (!validate()) return;

    router.push({
      pathname: '/complete-profile',
      params: {
        name: name.trim(),
        email: email.trim(),
        password,
      },
    });
  };

  const handleGoogleRegister = () => {
    Alert.alert('Google Sign-Up', 'Fitur Google Sign-Up akan segera hadir.');
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        className="bg-white"
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {/* Curved Organic Header with swap animation */}
        <AnimatedAuthHeader>
          <AuthHeader
            title="Buat Akun"
            onSubtitleActionPress={() => router.push('/')}
          />
        </AnimatedAuthHeader>

        {/* Form Body with slide-up animation */}
        <AnimatedAuthBody delay={180}>
        <View className="px-7 pt-6 pb-12">
          {/* Server Error Alert Banner */}
          {serverError ? (
            <View className="flex-row items-center gap-2 bg-red-50 border border-red-200 p-3 rounded-xl mb-4">
              <Ionicons name="alert-circle" size={20} color="#EF4444" />
              <Text className="text-[13px] text-red-700 flex-1 font-medium">
                {serverError}
              </Text>
            </View>
          ) : null}

          {/* Full Name */}
          <AuraInput
            labelPlaceholder="Nama Lengkap"
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (serverError) setServerError(null);
              if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            error={errors.name}
          />

          {/* Email Address */}
          <AuraInput
            labelPlaceholder="Alamat Email"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (serverError) setServerError(null);
              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />

          {/* Password with Eye Box */}
          <AuraInput
            labelPlaceholder="Password"
            isPassword
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (serverError) setServerError(null);
              if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
            }}
            error={errors.password}
          />

          {/* Confirm Password with Eye Box */}
          <AuraInput
            labelPlaceholder="Konfirmasi Password"
            isPassword
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              if (serverError) setServerError(null);
              if (errors.confirmPassword) {
                setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
              }
            }}
            error={errors.confirmPassword}
          />

          {/* Forgot Password Link (as seen on the mockup) */}
          <Pressable
            onPress={() => router.push('/forgot-password')}
            className="self-start mt-0.5 mb-6 active:opacity-70"
            hitSlop={8}
          >
            <Text className="text-aura-primary text-sm font-medium">
              Lupa password kamu?
            </Text>
          </Pressable>

          {/* Action Button */}
          <GradientButton
            title="Lanjutkan"
            onPress={handleRegister}
            isLoading={isLoading}
            className="mt-1"
          />
          {/* Sudah punya akun? Masuk */}
          <Pressable
            onPress={() => router.push('/')}
            className="self-center mt-4 mb-5 py-1 active:opacity-70"
            hitSlop={8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text className="text-sm text-slate-500">
                Sudah punya akun?{' '}
              </Text>
              <Text style={{ color: '#2373F4', fontWeight: '700', fontSize: 14 }}>Masuk</Text>
            </View>
          </Pressable>

          {/* Social Divider & Google Button */}
          <SocialDivider onGooglePress={handleGoogleRegister} />
        </View>
        </AnimatedAuthBody>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
