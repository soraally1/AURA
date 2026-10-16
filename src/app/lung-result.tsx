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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CoughPredictionResponse } from '@/types/ai';
import { lungHistoryService, SavedCoughScan } from '@/services/lungHistoryService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function LungResultScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id?: string;
    dataJson?: string;
    audioUri?: string;
  }>();

  const [currentScan, setCurrentScan] = useState<SavedCoughScan | null>(null);
  const [historyList, setHistoryList] = useState<SavedCoughScan[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load data from ID or raw dataJson
  useEffect(() => {
    const initData = async () => {
      setIsLoading(true);
      try {
        const history = await lungHistoryService.getHistory();
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
            const parsedData: CoughPredictionResponse = JSON.parse(params.dataJson);
            const saved = await lungHistoryService.saveScan(parsedData, params.audioUri);
            setCurrentScan(saved);
            const updatedHistory = await lungHistoryService.getHistory();
            setHistoryList(updatedHistory);
            setIsLoading(false);
            return;
          } catch (e) {
            console.warn('[LungResult] Gagal parsing dataJson:', e);
          }
        }

        // Default: ambil hasil analisis terbaru jika ada
        if (history.length > 0) {
          setCurrentScan(history[0]);
        }
      } catch (err) {
        console.warn('[LungResult] Init error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initData();
  }, [params.id, params.dataJson, params.audioUri]);

  const data: CoughPredictionResponse | undefined = currentScan?.data;
  const isHealthy = data?.status === 'healthy' || data?.prediction === 'Normal';
  const isModerate = data?.status === 'moderate' || data?.severity === 'moderate';
  const statusColor = isHealthy ? '#10B981' : isModerate ? '#F59E0B' : '#EF4444';
  const statusIcon = isHealthy ? 'checkmark-circle' : isModerate ? 'alert-circle' : 'warning';
  const score = data?.health_score ?? (isHealthy ? 95 : isModerate ? 70 : 45);

  const handleSelectHistoryItem = (item: SavedCoughScan) => {
    setCurrentScan(item);
    setShowHistoryModal(false);
  };

  const handleDeleteHistoryItem = async (id: string) => {
    Alert.alert(
      'Hapus Riwayat',
      'Apakah Anda yakin ingin menghapus hasil analisis batuk ini?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            await lungHistoryService.deleteScan(id);
            const updated = await lungHistoryService.getHistory();
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
              router.replace('/lung-check');
            }
          }}
          hitSlop={12}
          accessibilityLabel="Kembali"
        >
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
        </Pressable>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Hasil Analisis Batuk</Text>
          {currentScan?.formattedDate ? (
            <Text style={styles.headerDate}>{currentScan.formattedDate}</Text>
          ) : null}
        </View>

        {/* Riwayat Button */}
        <Pressable
          style={[styles.navButton, historyList.length > 0 && styles.historyBtnActive]}
          onPress={() => setShowHistoryModal(true)}
          hitSlop={12}
          accessibilityLabel="Riwayat Analisis Batuk"
        >
          <Ionicons name="time-outline" size={22} color="#2563EB" />
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
          <Text style={styles.loadingText}>Memuat hasil analisis batuk...</Text>
        </View>
      ) : !data ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="mic-circle-outline" size={64} color="#94A3B8" />
          <Text style={styles.emptyTitle}>Belum Ada Riwayat Batuk</Text>
          <Text style={styles.emptyDesc}>
            Rekam suara batuk Anda untuk mendapatkan skrining klinis suara pernapasan berbasis AI ONNX ICBHI.
          </Text>
          <Pressable
            style={styles.primaryActionButton}
            onPress={() => router.replace('/lung-check')}
          >
            <Ionicons name="mic" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.primaryActionButtonText}>Mulai Rekam Batuk</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 100 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* 1. MODEL BADGE */}
          <View style={styles.badgeRow}>
            <View style={styles.aiBadge}>
              <Ionicons name="sparkles" size={14} color="#2563EB" />
              <Text style={styles.aiBadgeText}>
                ONNX ICBHI AI • {data.confidence != null ? `${data.confidence.toFixed(1)}% Keyakinan` : 'Teranalisis'}
              </Text>
            </View>
            <View style={[styles.severityPill, { backgroundColor: statusColor + '18' }]}>
              <Text style={[styles.severityText, { color: statusColor }]}>
                {isHealthy ? 'Normal' : data.severity ? `Tingkat ${data.severity}` : 'Perhatian'}
              </Text>
            </View>
          </View>

          {/* 2. OVERALL HEALTH SCORE & STATUS */}
          <View style={styles.scoreCard}>
            <LinearGradient
              colors={['#F8FAFC', '#F1F5F9']}
              style={styles.scoreCardGradient}
            >
              <View style={styles.scoreRow}>
                <View>
                  <Text style={styles.scoreSubTitle}>Skor Kesehatan Paru</Text>
                  <Text style={[styles.scoreValue, { color: statusColor }]}>{score}%</Text>
                </View>
                <View style={[styles.statusIconWrap, { backgroundColor: statusColor + '20' }]}>
                  <Ionicons name={statusIcon as any} size={42} color={statusColor} />
                </View>
              </View>

              <Text style={[styles.diagnosisTitle, { color: statusColor }]}>
                {isHealthy
                  ? 'Pola Suara Batuk Normal'
                  : data.prediction === 'Wheeze'
                  ? 'Terdeteksi Suara Wheezing (Mengi)'
                  : data.prediction === 'Crackle'
                  ? 'Terdeteksi Suara Crackle (Ronki)'
                  : `Pola Batuk: ${data.prediction}`}
              </Text>

              {data.clinical_interpretation ? (
                <Text style={styles.diagnosisDesc}>{data.clinical_interpretation}</Text>
              ) : null}
            </LinearGradient>
          </View>

          {/* 3. PROBABILITY DISTRIBUTION (ICBHI) */}
          {data.all_probabilities && Object.keys(data.all_probabilities).length > 0 && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="stats-chart" size={18} color="#2563EB" />
                <Text style={styles.sectionTitle}>Distribusi Probabilitas Model</Text>
              </View>

              <View style={styles.probList}>
                {Object.entries(data.all_probabilities).map(([key, rawVal]) => {
                  const probVal = typeof rawVal === 'number' ? rawVal : 0;
                  const percent = Math.min(100, Math.max(0, Math.round(probVal * 100)));
                  const isTop = key.toLowerCase() === (data.prediction || '').toLowerCase();
                  const barColor = isTop ? statusColor : '#94A3B8';

                  const labelMap: Record<string, string> = {
                    normal: 'Normal (Tanpa Suara Abnormal)',
                    wheeze: 'Wheeze / Mengi (Penyempitan Saluran)',
                    crackle: 'Crackle / Ronki (Cairan / Lendir)',
                    'crackle + wheeze': 'Kombinasi Crackle + Mengi',
                  };

                  const displayName = labelMap[key.toLowerCase()] || key;

                  return (
                    <View key={key} style={styles.probItem}>
                      <View style={styles.probLabelRow}>
                        <Text style={[styles.probName, isTop && { fontWeight: '700', color: '#1E293B' }]}>
                          {displayName}
                        </Text>
                        <Text style={[styles.probPercent, isTop && { color: barColor, fontWeight: '700' }]}>
                          {percent}%
                        </Text>
                      </View>
                      <View style={styles.probTrack}>
                        <View
                          style={[
                            styles.probFill,
                            { width: `${percent}%`, backgroundColor: barColor },
                          ]}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* 4. ENVIRONMENTAL & MOBILITY CORRELATION */}
          {data.environmental_correlation && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="leaf" size={18} color="#059669" />
                <Text style={styles.sectionTitle}>Korelasi Paparan Polusi Udara</Text>
              </View>

              <View style={styles.envGrid}>
                <View style={styles.envItem}>
                  <Text style={styles.envItemLabel}>Aktivitas Luar</Text>
                  <Text style={styles.envItemValue}>
                    {data.environmental_correlation.total_outdoor_minutes ?? 0} mnt
                  </Text>
                </View>
                <View style={styles.envItem}>
                  <Text style={styles.envItemLabel}>Rata-rata PM2.5</Text>
                  <Text style={styles.envItemValue}>
                    {data.environmental_correlation.average_outdoor_pm25 != null
                      ? `${data.environmental_correlation.average_outdoor_pm25} µg/m³`
                      : 'N/A'}
                  </Text>
                </View>
                <View style={styles.envItem}>
                  <Text style={styles.envItemLabel}>AQI Tertinggi</Text>
                  <Text style={styles.envItemValue}>
                    {data.environmental_correlation.worst_area_aqi ?? 'N/A'}
                  </Text>
                </View>
              </View>

              {data.environmental_correlation.worst_area_name && (
                <View style={styles.areaRow}>
                  <Ionicons name="location-outline" size={14} color="#64748B" />
                  <Text style={styles.areaText}>
                    Area paparan tertinggi: <Text style={{ fontWeight: '600' }}>{data.environmental_correlation.worst_area_name}</Text>
                  </Text>
                </View>
              )}

              {data.environmental_correlation.clinical_correlation_notes ? (
                <View style={styles.correlationNoteBox}>
                  <Ionicons name="information-circle" size={16} color="#0284C7" style={{ marginTop: 2 }} />
                  <Text style={styles.correlationNoteText}>
                    {data.environmental_correlation.clinical_correlation_notes}
                  </Text>
                </View>
              ) : null}
            </View>
          )}

          {/* 5. RECOMMENDATIONS */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="bulb" size={18} color="#2563EB" />
              <Text style={styles.sectionTitle}>Saran & Penanganan Mandiri</Text>
            </View>
            <View style={styles.tipsList}>
              <View style={styles.tipRow}>
                <Ionicons name="water-outline" size={16} color="#2563EB" style={styles.tipIcon} />
                <Text style={styles.tipText}>
                  Minum air hangat minimal 2-2.5 liter per hari untuk mengencerkan dahak dan melegakan tenggorokan.
                </Text>
              </View>
              <View style={styles.tipRow}>
                <Ionicons name="shield-checkmark-outline" size={16} color="#2563EB" style={styles.tipIcon} />
                <Text style={styles.tipText}>
                  Gunakan masker filter partikel (KN95/KF94) jika beraktivitas di jalan raya dengan kadar PM2.5 tinggi.
                </Text>
              </View>
              <View style={styles.tipRow}>
                <Ionicons name="bed-outline" size={16} color="#2563EB" style={styles.tipIcon} />
                <Text style={styles.tipText}>
                  Istirahat cukup dan hindari paparan asap rokok atau aerosol pembersih ruangan secara langsung.
                </Text>
              </View>
            </View>
          </View>

          {/* 6. MEDICAL DISCLAIMER */}
          <View style={styles.disclaimerBox}>
            <Ionicons name="alert-circle-outline" size={16} color="#64748B" />
            <Text style={styles.disclaimerText}>
              Pemeriksaan ini menggunakan model kecerdasan buatan (AI ONNX ICBHI) untuk skrining awal suara napas dan bukan merupakan diagnosis medis pengganti dokter spesialis paru.
            </Text>
          </View>
        </ScrollView>
      )}

      {/* ─── Bottom Action Bar ─── */}
      <View style={[styles.bottomActionBar, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        <Pressable
          style={styles.retryBtn}
          onPress={() => router.replace('/lung-check')}
        >
          <Ionicons name="refresh" size={18} color="#2563EB" style={{ marginRight: 6 }} />
          <Text style={styles.retryBtnText}>Tes Batuk Ulang</Text>
        </Pressable>

        <Pressable
          style={styles.consultBtn}
          onPress={() => router.push('/ceksekarang')}
        >
          <Ionicons name="chatbubbles" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.consultBtnText}>Konsultasi Dokter</Text>
        </Pressable>
      </View>

      {/* ─── RIWAYAT MODAL ─── */}
      <Modal
        visible={showHistoryModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowHistoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="time" size={20} color="#2563EB" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Riwayat Analisis Batuk</Text>
              </View>
              <Pressable
                onPress={() => setShowHistoryModal(false)}
                hitSlop={10}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>

            {historyList.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Ionicons name="document-text-outline" size={44} color="#94A3B8" />
                <Text style={styles.modalEmptyText}>Belum ada riwayat rekaman batuk</Text>
              </View>
            ) : (
              <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
                {historyList.map((item) => {
                  const isCurrent = item.id === currentScan?.id;
                  const itemHealthy = item.data.status === 'healthy' || item.data.prediction === 'Normal';
                  const itemColor = itemHealthy ? '#10B981' : '#F59E0B';

                  return (
                    <Pressable
                      key={item.id}
                      style={[styles.historyItemCard, isCurrent && styles.historyItemCurrent]}
                      onPress={() => handleSelectHistoryItem(item)}
                    >
                      <View style={[styles.historyItemIcon, { backgroundColor: itemColor + '18' }]}>
                        <Ionicons
                          name={itemHealthy ? 'checkmark-circle' : 'alert-circle'}
                          size={22}
                          color={itemColor}
                        />
                      </View>

                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={styles.historyItemCondition} numberOfLines={1}>
                            {item.data.prediction || 'Analisis Batuk'}
                          </Text>
                          <Text style={[styles.historyItemScore, { color: itemColor }]}>
                            {item.data.health_score ?? (itemHealthy ? 95 : 70)}%
                          </Text>
                        </View>
                        <Text style={styles.historyItemDate}>{item.formattedDate}</Text>
                      </View>

                      <Pressable
                        style={styles.deleteHistoryBtn}
                        onPress={() => handleDeleteHistoryItem(item.id)}
                        hitSlop={10}
                      >
                        <Ionicons name="trash-outline" size={17} color="#EF4444" />
                      </Pressable>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  navButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyBtnActive: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  historyBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#2563EB',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  historyBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerDate: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 14,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 20,
  },
  primaryActionButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 5,
  },
  aiBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  severityPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  severityText: {
    fontSize: 12,
    fontWeight: '700',
  },
  scoreCard: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  scoreCardGradient: {
    padding: 20,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  scoreSubTitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -1,
  },
  statusIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diagnosisTitle: {
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 6,
    lineHeight: 25,
  },
  diagnosisDesc: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  probList: {
    gap: 12,
  },
  probItem: {
    gap: 4,
  },
  probLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  probName: {
    fontSize: 13,
    color: '#475569',
  },
  probPercent: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  probTrack: {
    height: 7,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  probFill: {
    height: '100%',
    borderRadius: 4,
  },
  envGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  envItem: {
    alignItems: 'center',
    flex: 1,
  },
  envItemLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 2,
  },
  envItemValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  areaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  areaText: {
    fontSize: 12,
    color: '#64748B',
  },
  correlationNoteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0F9FF',
    borderRadius: 10,
    padding: 10,
    gap: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#0284C7',
  },
  correlationNoteText: {
    flex: 1,
    fontSize: 12,
    color: '#0369A1',
    lineHeight: 18,
  },
  tipsList: {
    gap: 10,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  tipIcon: {
    marginTop: 2,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
  },
  disclaimerBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginBottom: 20,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
  },
  bottomActionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  retryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  retryBtnText: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 14,
  },
  consultBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    backgroundColor: '#2563EB',
  },
  consultBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  modalEmptyText: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 8,
  },
  modalList: {
    marginTop: 10,
  },
  historyItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  historyItemCurrent: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  historyItemIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyItemCondition: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    maxWidth: SCREEN_WIDTH * 0.45,
  },
  historyItemScore: {
    fontSize: 14,
    fontWeight: '800',
  },
  historyItemDate: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  deleteHistoryBtn: {
    padding: 6,
    marginLeft: 6,
  },
});
