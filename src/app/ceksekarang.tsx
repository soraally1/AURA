import { DoctorItem, DOCTORS_DATA, HospitalItem, HOSPITALS_DATA } from '@/data/medical-partners';
import { hospitalService } from '@/services/hospitalService';
import { locationService } from '@/services/locationService';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Banner image natural aspect ratio (402 x 268 = 1.5)
const BANNER_HEIGHT = Math.round(SCREEN_WIDTH * (268 / 402));
const CARD_WIDTH = Math.min(312, SCREEN_WIDTH - 60);

export default function CekSekarangScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [searchQuery, setSearchQuery] = useState('');
  const [hospitals, setHospitals] = useState<HospitalItem[]>(HOSPITALS_DATA);
  const [refreshing, setRefreshing] = useState(false);

  // Load nearby hospitals from backend/Firestore with GPS location
  const loadNearbyHospitals = useCallback(async () => {
    let lat = -6.9934;
    let lon = 110.4087;

    try {
      const gps = await locationService.getCurrentGpsLocation();
      if (gps.success && gps.location) {
        lat = gps.location.lat;
        lon = gps.location.lon;
      }

      const res = await hospitalService.getNearbyHospitals(lat, lon, 25, 12);
      if (res && res.length > 0) {
        const mapped: HospitalItem[] = res.map((h) => ({
          id: h.id,
          name: h.name,
          distance: h.distance_km ? `${h.distance_km.toFixed(1).replace('.', ',')} km` : '1,5 km',
          distanceKm: h.distance_km || 1.5,
          rating: h.rating,
          address: h.address,
          openHours: h.open_hours || 'Buka 24 Jam',
          description: `Rumah sakit rujukan terakreditasi dengan fasilitas ${h.facilities.join(', ')}.`,
          coordinates: {
            lat: h.latitude,
            lon: h.longitude,
          },
          image: h.image_url ? { uri: h.image_url } : require('@/assets/dr/hospital_kariadi.jpg'),
          facilities: h.facilities.map((f) => ({ icon: 'medical-outline', label: f })),
        }));
        setHospitals(mapped);
      }
    } catch (err) {
      console.warn('[CekSekarang] Error loading hospitals:', err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNearbyHospitals();
  }, [loadNearbyHospitals]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadNearbyHospitals();
  }, [loadNearbyHospitals]);

  // Filtered doctors by search query
  const filteredDoctors = useMemo(() => {
    if (!searchQuery.trim()) return DOCTORS_DATA;
    return DOCTORS_DATA.filter((doctor) => {
      return (
        doctor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doctor.specialization.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doctor.hospital.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [searchQuery]);

  // Filtered hospitals by search query
  const filteredHospitals = useMemo(() => {
    if (!searchQuery.trim()) return hospitals;
    return hospitals.filter((h) =>
      h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.address.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, hospitals]);

  const topInset = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : insets.top;

  // Emergency Call Handler
  const handleCallEmergency = () => {
    Linking.openURL('tel:119').catch(() => {
      alert('Panggilan darurat 119 tidak didukung di perangkat ini.');
    });
  };

  return (
    <View className="flex-1 bg-[#1E6CEF]">
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-grow"
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFFFFF"
            colors={['#1E6CEF']}
          />
        }
      >
        {/* ============================================================ */}
        {/* 1. HERO BANNER: FULL-WIDTH WELCOMING WITH VIBRANT FADE      */}
        {/* ============================================================ */}
        <View
          className="w-full relative bg-white overflow-hidden"
          style={{ width: SCREEN_WIDTH, height: BANNER_HEIGHT }}
        >
          <Image
            source={require('@/assets/dr/Welcoming.png')}
            className="w-full h-full"
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            priority="high"
          />

          {/* Top Status Gradient for contrast on back button */}
          <LinearGradient
            colors={['rgba(0, 0, 0, 0.45)', 'rgba(0, 0, 0, 0.1)', 'transparent']}
            className="absolute top-0 left-0 right-0"
            style={{ height: topInset + 54 }}
            pointerEvents="none"
          />

          {/* Bottom Seamless Gradient Fade into Aura Royal Blue */}
          <LinearGradient
            colors={['transparent', 'rgba(30, 108, 239, 0.4)', 'rgba(30, 108, 239, 0.85)', '#1E6CEF']}
            className="absolute bottom-0 left-0 right-0 h-[60px]"
            pointerEvents="none"
          />

          {/* Floating Back Button (Top-Left) */}
          <Pressable
            onPress={() => router.back()}
            className="absolute left-4 z-50 w-[38px] h-[38px] rounded-full bg-white/90 items-center justify-center shadow-md active:opacity-80"
            style={{ top: topInset + 8 }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Kembali"
          >
            <Ionicons name="arrow-back" size={20} color="#1E293B" />
          </Pressable>

          {/* Floating Emergency 119 Pill (Top-Right) */}
          <Pressable
            onPress={handleCallEmergency}
            className="absolute right-4 z-50 flex-row items-center bg-[#EF4444] px-3 py-1.5 rounded-full shadow-md active:opacity-90"
            style={{ top: topInset + 8 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View className="w-2 h-2 rounded-full bg-white mr-1.5" />
            <Ionicons name="call" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text className="text-white text-xs font-bold tracking-wider">IGD 119</Text>
          </Pressable>
        </View>

        {/* ============================================================ */}
        {/* 2. COMPACT SEARCH BAR                                       */}
        {/* ============================================================ */}
        <View className="mx-4 -mt-5 z-30 mb-3.5">
          <View className="flex-row items-center bg-white rounded-[14px] px-3.5 h-[46px] shadow-lg shadow-black/15">
            <Ionicons name="search" size={17} color="#94A3B8" style={{ marginRight: 8 }} />
            <TextInput
              className="flex-1 text-[13px] text-slate-800 font-medium py-0"
              placeholder="Cari dokter spesialis atau rumah sakit..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={16} color="#94A3B8" />
              </Pressable>
            )}
          </View>
        </View>

        {/* ============================================================ */}
        {/* 3. DOKTER MITRA AURA SECTION                                */}
        {/* ============================================================ */}
        <View className="flex-row items-center justify-between px-4 mb-3">
          <Text className="text-lg font-bold text-white tracking-wide">Dokter Mitra Aura</Text>
        </View>

        {filteredDoctors.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 10, gap: 14 }}
            snapToInterval={CARD_WIDTH + 14}
            decelerationRate="fast"
          >
            {filteredDoctors.map((doctor: DoctorItem) => (
              <Pressable
                key={doctor.id}
                className="h-[168px] flex-row bg-white rounded-2xl p-3 shadow-xl shadow-black/20 relative overflow-hidden"
                style={{ width: CARD_WIDTH }}
                onPress={() =>
                  router.push({
                    pathname: '/doctor-reservation',
                    params: { doctorId: doctor.id },
                  })
                }
              >
                {/* Left Side: Soft Blue Arc & Doctor Photo */}
                <View
                  className="w-[500px] h-full relative items-center justify-end top-5"
                  style={{ width: 150, height: '100%' }}
                >
                  <View className="absolute -top-20 w-[208px] h-[208px] left-[-100] rounded-full bg-blue-50" />
                  <Image
                    source={doctor.image}
                    className="w-full h-full z-10"
                    style={{ width: '100%', height: '100%' }}
                    contentFit="contain"
                  />
                </View>

                {/* Right Side: Doctor Information */}
                <View className="flex-1 pl-2 justify-between">
                  <View>
                    <Text className="text-sm font-bold text-slate-900 mb-1" numberOfLines={1}>
                      {doctor.name}
                    </Text>

                    <View className="gap-0.5 mb-1">
                      {/* Specialization */}
                      <View className="flex-row items-center">
                        <MaterialCommunityIcons
                          name="stethoscope"
                          size={14}
                          color="#64748B"
                          style={{ marginRight: 6, opacity: 0.8 }}
                        />
                        <Text className="text-[11px] text-slate-600 font-medium flex-1" numberOfLines={1}>
                          {doctor.specialization}
                        </Text>
                      </View>

                      {/* Hospital */}
                      <View className="flex-row items-center">
                        <MaterialCommunityIcons
                          name="hospital-building"
                          size={14}
                          color="#64748B"
                          style={{ marginRight: 6, opacity: 0.8 }}
                        />
                        <Text className="text-[11px] text-slate-600 font-medium flex-1" numberOfLines={1}>
                          {doctor.hospital}
                        </Text>
                      </View>

                      {/* Satisfaction Rating (Thumbs Up) */}
                      <View className="flex-row items-center">
                        <MaterialCommunityIcons
                          name="thumb-up"
                          size={13}
                          color="#1E6CEF"
                          style={{ marginRight: 6, opacity: 0.8 }}
                        />
                        <Text className="text-[11px] font-bold text-[#1E6CEF]">{doctor.ratingPercentage}%</Text>
                      </View>
                    </View>
                  </View>

                  {/* Reservasi Sekarang Button */}
                  <Pressable
                    className="bg-[#1E6CEF] rounded-lg py-1.5 items-center justify-center w-full shadow-md shadow-blue-500/25 active:opacity-90"
                    onPress={() =>
                      router.push({
                        pathname: '/doctor-reservation',
                        params: { doctorId: doctor.id },
                      })
                    }
                  >
                    <Text className="text-white text-[11px] font-bold tracking-wide">Reservasi Sekarang</Text>
                  </Pressable>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <View className="mx-4 bg-white/15 rounded-[14px] p-5 items-center justify-center border border-white/25">
            <Ionicons name="search-outline" size={26} color="#FFFFFF" style={{ opacity: 0.8 }} />
            <Text className="text-white text-[13px] font-medium mt-2 text-center">Tidak ada dokter yang cocok dengan pencarian.</Text>
          </View>
        )}

        {/* ============================================================ */}
        {/* 4. RUMAH SAKIT TERDEKAT SECTION                             */}
        {/* ============================================================ */}
        <View className="flex-row items-center justify-between px-4 mb-3 mt-6">
          <Text className="text-lg font-bold text-white tracking-wide">Rumah Sakit Terdekat</Text>
        </View>

        {filteredHospitals.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 10, gap: 14 }}
            snapToInterval={CARD_WIDTH + 14}
            decelerationRate="fast"
          >
            {filteredHospitals.map((hospital: HospitalItem) => (
              <Pressable
                key={hospital.id}
                className="bg-white rounded-2xl overflow-hidden shadow-xl shadow-black/20"
                style={{ width: CARD_WIDTH }}
                onPress={() =>
                  router.push({
                    pathname: '/hospital-detail',
                    params: { hospitalId: hospital.id },
                  })
                }
              >
                {/* Hospital Photo */}
                <Image
                  source={hospital.image}
                  className="w-full bg-slate-200"
                  style={{ width: '100%', height: 115 }}
                  contentFit="cover"
                  transition={250}
                />

                {/* Hospital Information */}
                <View className="p-3">
                  <Text className="text-sm font-bold text-slate-900 mb-0.5" numberOfLines={1}>
                    {hospital.name}
                  </Text>

                  <Text className="text-xs font-semibold text-[#1E6CEF] mb-1" numberOfLines={1}>
                    {hospital.distance}
                  </Text>

                  {/* Stars Rating Row */}
                  <View className="flex-row items-center mb-1">
                    <Text className="text-[11px] font-bold text-amber-600 mr-1">
                      {hospital.rating.toFixed(1).replace('.', ',')}
                    </Text>
                    <View className="flex-row gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Ionicons
                          key={star}
                          name="star"
                          size={12}
                          color="#FBBF24"
                        />
                      ))}
                    </View>
                  </View>

                  {/* Address */}
                  <Text className="text-[11px] text-slate-500 leading-4 mb-2" numberOfLines={1}>
                    {hospital.address}
                  </Text>

                  {/* Status & Petunjuk Arah Trigger */}
                  <View className="flex-row items-center justify-between pt-1.5 border-t border-slate-100">
                    <Text className="text-[10px] font-semibold text-emerald-600">{hospital.openHours}</Text>
                    <Pressable
                      className="p-0.5 active:opacity-70"
                      onPress={(e) => {
                        e.stopPropagation();
                        router.push({
                          pathname: '/hospital-route',
                          params: { hospitalId: hospital.id },
                        });
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="navigate-circle" size={20} color="#1E6CEF" />
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <View className="mx-4 bg-white/15 rounded-[14px] p-5 items-center justify-center border border-white/25">
            <Ionicons name="business-outline" size={26} color="#FFFFFF" style={{ opacity: 0.8 }} />
            <Text className="text-white text-[13px] font-medium mt-2 text-center">Tidak ada rumah sakit yang cocok dengan pencarian.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
