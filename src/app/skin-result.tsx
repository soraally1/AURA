import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
  Modal,
  Alert,
  StatusBar as RNStatusBar,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SkinScanData } from '@/types/ai';
import { skinHistoryService, SavedSkinScan } from '@/services/skinHistoryService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function SkinResultScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id?: string;
    dataJson?: string;
    imageUri?: string;
  }>();

  const [currentScan, setCurrentScan] = useState<SavedSkinScan | null>(null);
  const [historyList, setHistoryList] = useState<SavedSkinScan[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load data from ID or raw dataJson
  useEffect(() => {
    const initData = async () => {
      setIsLoading(true);
      try {
        const history = await skinHistoryService.getHistory();
        setHistoryList(history);

        if (params.id) {
          const found = history.find((h) => h.id === params.id);
          if (found) {
            setCurrentScan(found);
            setIsLoading(false);
            return;
          }
        }

        if (params.dataJson) {
          try {
            const parsedData: SkinScanData = JSON.parse(params.dataJson);
            const saved = await skinHistoryService.saveScan(parsedData, params.imageUri);
            setCurrentScan(saved);
            const updatedHistory = await skinHistoryService.getHistory();
            setHistoryList(updatedHistory);
            setIsLoading(false);
            return;
          } catch (e) {
            console.warn('[SkinResult] Failed parsing dataJson:', e);
          }
        }

        // Default to the most recent scan if available
        if (history.length > 0) {
          setCurrentScan(history[0]);
        }
      } catch (err) {
        console.warn('[SkinResult] Init error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initData();
  }, [params.id, params.dataJson, params.imageUri]);

  const data: SkinScanData | undefined = currentScan?.data;
  const score = data?.skin_metrics?.overall_health_score;
  const isHealthy = score != null ? score >= 80 : true;
  const isModerate = score != null ? score >= 60 : false;
  const statusColor = isHealthy ? '#10B981' : isModerate ? '#F59E0B' : '#EF4444';
  const statusIcon = isHealthy ? 'checkmark-circle' : isModerate ? 'alert-circle' : 'warning';

  const handleSelectHistoryItem = (item: SavedSkinScan) => {
    setCurrentScan(item);
    setShowHistoryModal(false);
  };

  const handleDeleteHistoryItem = async (id: string) => {
    Alert.alert(
      'Hapus Riwayat',
      'Apakah Anda yakin ingin menghapus hasil analisis ini?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            await skinHistoryService.deleteScan(id);
            const updated = await skinHistoryService.getHistory();
            setHistoryList(updated);
            if (currentScan?.id === id) {
              setCurrentScan(updated[0] || null);
            }
          },
        },
      ]
    );
  };

  const topPadding =
    Platform.OS === 'android'
      ? (RNStatusBar.currentHeight || 24) + 10
      : insets.top + 8;

  return (
    <View style={styles.container}>
      <RNStatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent />

      {/* ─── Top Header Navigation ─── */}
      <View style={[styles.headerBar, { paddingTop: topPadding }]}>
        <Pressable
          style={styles.navButton}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/dashboard');
            }
          }}
          hitSlop={12}
          accessibilityLabel="Kembali"
        >
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
        </Pressable>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Hasil Analisis Kulit</Text>
          {currentScan?.formattedDate ? (
            <Text style={styles.headerDate}>{currentScan.formattedDate}</Text>
          ) : null}
        </View>

        {/* Riwayat Button */}
        <Pressable
          style={[styles.navButton, historyList.length > 0 && styles.historyBtnActive]}
          onPress={() => setShowHistoryModal(true)}
          hitSlop={12}
          accessibilityLabel="Riwayat Analisis"
        >
          <Ionicons name="time-outline" size={22} color="#0284C7" />
          {historyList.length > 1 && (
            <View style={styles.historyBadge}>
              <Text style={styles.historyBadgeText}>{historyList.length}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* ─── Main Content ─── */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Memuat hasil analisis...</Text>
        </View>
      ) : !data ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={54} color="#94A3B8" />
          <Text style={styles.emptyTitle}>Belum Ada Hasil Analisis</Text>
          <Text style={styles.emptyDesc}>
            Lakukan pemindaian foto kulit untuk mendapatkan analisis AI & dataset SCIN.
          </Text>
          <Pressable
            style={styles.primaryActionButton}
            onPress={() => router.replace('/skin-check')}
          >
            <Ionicons name="scan" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.primaryActionText}>Mulai Pindai Kulit</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 90 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* AI Model & Validation Header Pill */}
          <View style={styles.aiBadgeWrap}>
            <Ionicons name="shield-checkmark" size={14} color="#2563EB" />
            <Text style={styles.aiBadgeText}>
              Groq AI {data.model_used || 'qwen/qwen3.8-27b'} • SCIN Validated
            </Text>
          </View>

          {/* Photo Thumbnail (If Available) */}
          {currentScan?.imageUri ? (
            <View style={styles.photoPreviewCard}>
              <Image
                source={{ uri: currentScan.imageUri }}
                style={styles.photoThumb}
                contentFit="cover"
              />
              <View style={styles.photoOverlayBadge}>
                <Ionicons name="camera" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.photoOverlayText}>Foto Terpindai</Text>
              </View>
            </View>
          ) : null}

          {/* Big Score Display */}
          <View style={styles.scoreBlock}>
            <View style={[styles.statusIconCircle, { backgroundColor: statusColor + '18' }]}>
              <Ionicons name={statusIcon as any} size={48} color={statusColor} />
            </View>
            {score != null ? (
              <Text style={styles.scoreNumber}>{score}%</Text>
            ) : null}
            <Text style={[styles.conditionTitle, { color: statusColor }]}>
              {data.condition_indonesian || data.condition}
            </Text>
            <Text style={styles.confidenceSub}>
              {data.confidence != null ? `${data.confidence.toFixed(1)}% Akurasi • ` : ''}
              {data.fitzpatrick_skin_type ? `${data.fitzpatrick_skin_type}` : ''}
              {data.fitzpatrick_description ? ` (${data.fitzpatrick_description})` : ''}
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: statusColor + '25' }]} />

          {/* Clinical Summary */}
          {data.summary ? (
            <View style={styles.summaryBox}>
              <Text style={styles.summaryText}>{data.summary}</Text>
            </View>
          ) : null}

          {/* ─── 6-Card Environmental & Skin Health Grid ─── */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Indikator Pengaruh Lingkungan & Kulit</Text>
          </View>

          <View style={styles.gridRow}>
            {/* 1. Polusi */}
            <View style={styles.gridCard}>
              <View style={[styles.gridIconBox, { backgroundColor: '#FFEDD5' }]}>
                <Ionicons name="cloud" size={16} color="#EA580C" />
              </View>
              <Text style={styles.gridLabel}>Polusi</Text>
              <Text style={styles.gridValue}>
                {data.environmental_impact?.pollution?.score ?? 15}%
              </Text>
            </View>

            {/* 2. Cuaca */}
            <View style={styles.gridCard}>
              <View style={[styles.gridIconBox, { backgroundColor: '#E0F2FE' }]}>
                <Ionicons name="water" size={16} color="#0284C7" />
              </View>
              <Text style={styles.gridLabel}>Cuaca</Text>
              <Text style={styles.gridValue}>
                {data.environmental_impact?.weather?.score ?? 20}%
              </Text>
            </View>

            {/* 3. Sinar UV */}
            <View style={styles.gridCard}>
              <View style={[styles.gridIconBox, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="sunny" size={16} color="#D97706" />
              </View>
              <Text style={styles.gridLabel}>Sinar UV</Text>
              <Text style={styles.gridValue}>
                {data.environmental_impact?.sun_uv?.score ?? 25}%
              </Text>
            </View>

            {/* 4. Hidrasi */}
            <View style={styles.gridCard}>
              <View style={[styles.gridIconBox, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="fitness-outline" size={16} color="#16A34A" />
              </View>
              <Text style={styles.gridLabel}>Hidrasi</Text>
              <Text style={styles.gridValue}>
                {data.skin_metrics?.hydration_score ?? 85}%
              </Text>
            </View>

            {/* 5. Kemerahan */}
            <View style={styles.gridCard}>
              <View style={[styles.gridIconBox, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="flame" size={16} color="#DC2626" />
              </View>
              <Text style={styles.gridLabel}>Kemerahan</Text>
              <Text style={styles.gridValue}>
                {data.skin_metrics?.redness_score ?? 5}%
              </Text>
            </View>

            {/* 6. Sawar Kulit */}
            <View style={styles.gridCard}>
              <View style={[styles.gridIconBox, { backgroundColor: '#F3E8FF' }]}>
                <Ionicons name="shield-outline" size={16} color="#9333EA" />
              </View>
              <Text style={styles.gridLabel}>Sawar Kulit</Text>
              <Text style={styles.gridValue}>
                {data.skin_metrics?.barrier_integrity_score ?? 90}%
              </Text>
            </View>
          </View>

          {/* ─── Recommendations Box ─── */}
          {data.recommendations && data.recommendations.length > 0 ? (
            <View style={styles.recomContainer}>
              <View style={styles.recomHeaderRow}>
                <Ionicons name="bulb" size={16} color="#2563EB" />
                <Text style={styles.recomHeaderTitle}>Rekomendasi Penanganan:</Text>
              </View>
              {data.recommendations.map((rec, i) => (
                <View key={i} style={styles.recomItemRow}>
                  <Text style={styles.recomBullet}>•</Text>
                  <Text style={styles.recomItemText}>{rec}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Medical Disclaimer */}
          <View style={styles.disclaimerContainer}>
            <Ionicons name="information-circle-outline" size={15} color="#94A3B8" style={{ marginRight: 6 }} />
            <Text style={styles.disclaimerText}>
              {data.medical_disclaimer ||
                'Hasil analisis ini merupakan skrining berbasis AI dan dataset SCIN. Bukan diagnosis medis resmi dari dokter spesialis.'}
            </Text>
          </View>
        </ScrollView>
      )}

      {/* ─── Bottom Persistent Action Bar ─── */}
      {data ? (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable
            style={styles.rescanButton}
            onPress={() => router.replace('/skin-check')}
          >
            <Ionicons name="refresh" size={18} color="#0284C7" />
            <Text style={styles.rescanButtonText}>Pindai Ulang</Text>
          </Pressable>

          <Pressable
            style={styles.consultButton}
            onPress={() => router.push('/doctor-reservation' as any)}
          >
            <Ionicons name="chatbubbles" size={18} color="#FFFFFF" />
            <Text style={styles.consultButtonText}>Konsultasi Dokter</Text>
          </Pressable>
        </View>
      ) : null}

      {/* ─── History Modal ─── */}
      <Modal
        visible={showHistoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowHistoryModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowHistoryModal(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Riwayat Analisis Kulit</Text>
                <Text style={styles.modalSubtitle}>
                  Tersimpan di perangkat Anda ({historyList.length} pemindaian)
                </Text>
              </View>
              <Pressable
                onPress={() => setShowHistoryModal(false)}
                hitSlop={12}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={22} color="#64748B" />
              </Pressable>
            </View>

            {historyList.length === 0 ? (
              <View style={styles.emptyHistoryWrap}>
                <Ionicons name="time-outline" size={40} color="#CBD5E1" />
                <Text style={styles.emptyHistoryText}>Belum ada riwayat pemindaian.</Text>
              </View>
            ) : (
              <ScrollView
                style={{ maxHeight: 420 }}
                showsVerticalScrollIndicator={false}
              >
                {historyList.map((item) => {
                  const isSelected = item.id === currentScan?.id;
                  const itemScore = item.data?.skin_metrics?.overall_health_score;
                  const itemHealthy = itemScore != null ? itemScore >= 80 : true;
                  const itemColor = itemHealthy ? '#10B981' : '#F59E0B';

                  return (
                    <Pressable
                      key={item.id}
                      style={[
                        styles.historyCard,
                        isSelected && styles.historyCardActive,
                      ]}
                      onPress={() => handleSelectHistoryItem(item)}
                    >
                      <View style={styles.historyCardLeft}>
                        <View style={[styles.historyScoreBox, { backgroundColor: itemColor + '18' }]}>
                          <Text style={[styles.historyScoreVal, { color: itemColor }]}>
                            {itemScore != null ? `${itemScore}%` : 'AI'}
                          </Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text numberOfLines={1} style={styles.historyCardTitle}>
                            {item.data?.condition_indonesian || item.data?.condition || 'Pemeriksaan Kulit'}
                          </Text>
                          <Text style={styles.historyCardDate}>{item.formattedDate}</Text>
                        </View>
                      </View>

                      <Pressable
                        onPress={() => handleDeleteHistoryItem(item.id)}
                        hitSlop={8}
                        style={{ padding: 6 }}
                      >
                        <Ionicons name="trash-outline" size={18} color="#94A3B8" />
                      </Pressable>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    zIndex: 10,
  },
  navButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  historyBtnActive: {
    borderColor: '#0284C7',
    backgroundColor: '#F0F9FF',
  },
  historyBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#0284C7',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  historyBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  headerTitleContainer: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerDate: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 16,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 6,
    marginBottom: 20,
  },
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284C7',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  aiBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 16,
  },
  aiBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
    marginLeft: 6,
  },
  photoPreviewCard: {
    width: '100%',
    height: 180,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  photoThumb: {
    width: '100%',
    height: '100%',
  },
  photoOverlayBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  photoOverlayText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  scoreBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  statusIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  scoreNumber: {
    fontSize: 54,
    fontWeight: '900',
    color: '#0F172A',
    lineHeight: 60,
    letterSpacing: -1,
  },
  conditionTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 25,
    marginTop: 8,
    paddingHorizontal: 12,
  },
  confidenceSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 6,
    paddingHorizontal: 16,
  },
  divider: {
    height: 1.5,
    width: '100%',
    marginVertical: 18,
    borderRadius: 1,
  },
  summaryBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  summaryText: {
    fontSize: 13.5,
    color: '#334155',
    lineHeight: 21,
    fontWeight: '500',
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: 0.2,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
    marginBottom: 20,
  },
  gridCard: {
    width: (SCREEN_WIDTH - 40 - 20) / 3,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  gridIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  gridLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 2,
  },
  gridValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  recomContainer: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
  },
  recomHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  recomHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1D4ED8',
    marginLeft: 6,
  },
  recomItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  recomBullet: {
    color: '#2563EB',
    fontSize: 16,
    fontWeight: '900',
    marginRight: 8,
    marginTop: -2,
  },
  recomItemText: {
    flex: 1,
    fontSize: 13,
    color: '#1E3A8A',
    lineHeight: 19,
    fontWeight: '500',
  },
  disclaimerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginBottom: 20,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 16,
    fontStyle: 'italic',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
  rescanButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1.5,
    borderColor: '#0284C7',
    paddingVertical: 14,
    borderRadius: 16,
  },
  rescanButtonText: {
    color: '#0284C7',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 6,
  },
  consultButton: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E6CEF',
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: '#1E6CEF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  consultButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  emptyHistoryWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyHistoryText: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 10,
    fontWeight: '500',
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  historyCardActive: {
    backgroundColor: '#F0F9FF',
    borderColor: '#0284C7',
  },
  historyCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  historyScoreBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyScoreVal: {
    fontSize: 14,
    fontWeight: '900',
  },
  historyCardTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  historyCardDate: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
});
