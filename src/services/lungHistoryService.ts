import AsyncStorage from '@react-native-async-storage/async-storage';
import { CoughPredictionResponse } from '@/types/ai';

const LUNG_HISTORY_STORAGE_KEY = '@aura_lung_cough_history_v1';
const MAX_HISTORY_ITEMS = 30;

export interface SavedCoughScan {
  id: string;
  timestamp: string; // ISO string
  formattedDate: string;
  audioUri?: string;
  data: CoughPredictionResponse;
}

function formatDateIndo(date: Date): string {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'
  ];
  const d = date.getDate();
  const m = months[date.getMonth()];
  const y = date.getFullYear();
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${d} ${m} ${y}, ${h}:${min}`;
}

export const lungHistoryService = {
  /**
   * Menyimpan hasil analisis batuk baru ke storage lokal
   */
  async saveScan(data: CoughPredictionResponse, audioUri?: string): Promise<SavedCoughScan> {
    try {
      const now = new Date();
      const newScan: SavedCoughScan = {
        id: `cough_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: now.toISOString(),
        formattedDate: formatDateIndo(now),
        audioUri,
        data,
      };

      const existingHistory = await this.getHistory();
      const updatedHistory = [newScan, ...existingHistory].slice(0, MAX_HISTORY_ITEMS);

      await AsyncStorage.setItem(
        LUNG_HISTORY_STORAGE_KEY,
        JSON.stringify(updatedHistory)
      );

      return newScan;
    } catch (err) {
      console.warn('[lungHistoryService] Error saving scan:', err);
      return {
        id: `cough_temp_${Date.now()}`,
        timestamp: new Date().toISOString(),
        formattedDate: formatDateIndo(new Date()),
        audioUri,
        data,
      };
    }
  },

  /**
   * Mengambil semua riwayat analisis batuk
   */
  async getHistory(): Promise<SavedCoughScan[]> {
    try {
      const raw = await AsyncStorage.getItem(LUNG_HISTORY_STORAGE_KEY);
      if (!raw) return [];
      const parsed: SavedCoughScan[] = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn('[lungHistoryService] Error loading history:', err);
      return [];
    }
  },

  /**
   * Mengambil 1 hasil scan batuk berdasarkan ID
   */
  async getScanById(id: string): Promise<SavedCoughScan | null> {
    const list = await this.getHistory();
    return list.find((item) => item.id === id) || null;
  },

  /**
   * Menghapus 1 item riwayat
   */
  async deleteScan(id: string): Promise<void> {
    try {
      const list = await this.getHistory();
      const filtered = list.filter((item) => item.id !== id);
      await AsyncStorage.setItem(
        LUNG_HISTORY_STORAGE_KEY,
        JSON.stringify(filtered)
      );
    } catch (err) {
      console.warn('[lungHistoryService] Error deleting scan:', err);
    }
  },

  /**
   * Menghapus seluruh riwayat scan batuk
   */
  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.removeItem(LUNG_HISTORY_STORAGE_KEY);
    } catch (err) {
      console.warn('[lungHistoryService] Error clearing history:', err);
    }
  },
};
