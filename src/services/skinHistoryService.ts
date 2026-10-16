import AsyncStorage from '@react-native-async-storage/async-storage';
import { SkinScanData } from '@/types/ai';

const SKIN_HISTORY_STORAGE_KEY = '@aura_skin_scan_history_v1';
const MAX_HISTORY_ITEMS = 30;

export interface SavedSkinScan {
  id: string;
  timestamp: string; // ISO string
  formattedDate: string;
  imageUri?: string;
  data: SkinScanData;
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

export const skinHistoryService = {
  /**
   * Menyimpan hasil scan kulit baru ke memori lokal HP
   */
  async saveScan(data: SkinScanData, imageUri?: string): Promise<SavedSkinScan> {
    try {
      const now = new Date();
      const newScan: SavedSkinScan = {
        id: `skin_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: now.toISOString(),
        formattedDate: formatDateIndo(now),
        imageUri,
        data,
      };

      const existingHistory = await this.getHistory();
      const updatedHistory = [newScan, ...existingHistory].slice(0, MAX_HISTORY_ITEMS);

      await AsyncStorage.setItem(
        SKIN_HISTORY_STORAGE_KEY,
        JSON.stringify(updatedHistory)
      );

      return newScan;
    } catch (err) {
      console.warn('[skinHistoryService] Error saving scan:', err);
      // Tetap kembalikan object agar flow UI tidak terganggu
      return {
        id: `skin_temp_${Date.now()}`,
        timestamp: new Date().toISOString(),
        formattedDate: formatDateIndo(new Date()),
        imageUri,
        data,
      };
    }
  },

  /**
   * Mengambil semua riwayat scan kulit
   */
  async getHistory(): Promise<SavedSkinScan[]> {
    try {
      const raw = await AsyncStorage.getItem(SKIN_HISTORY_STORAGE_KEY);
      if (!raw) return [];
      const parsed: SavedSkinScan[] = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn('[skinHistoryService] Error loading history:', err);
      return [];
    }
  },

  /**
   * Mengambil 1 hasil scan berdasarkan ID
   */
  async getScanById(id: string): Promise<SavedSkinScan | null> {
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
        SKIN_HISTORY_STORAGE_KEY,
        JSON.stringify(filtered)
      );
    } catch (err) {
      console.warn('[skinHistoryService] Error deleting scan:', err);
    }
  },

  /**
   * Menghapus seluruh riwayat scan kulit
   */
  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.removeItem(SKIN_HISTORY_STORAGE_KEY);
    } catch (err) {
      console.warn('[skinHistoryService] Error clearing history:', err);
    }
  },
};
