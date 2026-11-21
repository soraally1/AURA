import axios from 'axios';
import * as FileSystem from 'expo-file-system/legacy';
import { api } from './api';
import { AI_API_URL } from './aiService';

function hashText(str: string): string {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export interface ProfileDraft {
  usia: number | null;
  tinggi_badan: number | null;
  berat_badan: number | null;
  waktu_di_jalan: number | null;
}

export interface VoiceChatMessage {
  role: 'assistant' | 'user';
  content: string;
}

export interface VoiceAgentTurnResponse {
  transcript?: string;
  assistant_reply: string;
  updated_profile: ProfileDraft;
  newly_filled: string[];
  missing_fields: string[];
  is_complete: boolean;
  ready_to_submit: boolean;
  model_used?: string;
}

const ttsInFlightCache = new Map<string, Promise<string | null>>();

export const voiceAgentService = {
  /**
   * Memulai percakapan atau mengirim giliran teks ke agen registrasi dinamis (GROQ_AURA_AGENT di aurabackend).
   */
  sendTextTurn: async (params: {
    userName?: string;
    userMessage?: string;
    history: VoiceChatMessage[];
    currentProfile: ProfileDraft;
  }): Promise<VoiceAgentTurnResponse> => {
    const res = await api.post<{ success: boolean; data: VoiceAgentTurnResponse }>(
      '/api/agent/registration-chat',
      {
        user_name: params.userName || '',
        user_message: params.userMessage || '',
        history: params.history,
        current_profile: params.currentProfile,
      },
      { timeout: 20000 }
    );
    if (!res.data?.success || !res.data.data) {
      throw new Error('Respon agen registrasi tidak valid.');
    }
    return res.data.data;
  },

  /**
   * Mengirim audio rekaman suara pengguna ke server aurabackend untuk STT (Groq Whisper)
   * sekaligus ekstraksi form dinamis & balasan suara AI dalam 1 request.
   */
  sendVoiceTurn: async (params: {
    audioUri: string;
    userName?: string;
    history: VoiceChatMessage[];
    currentProfile: ProfileDraft;
  }): Promise<VoiceAgentTurnResponse> => {
    const formData = new FormData();
    const isWav = params.audioUri.toLowerCase().endsWith('.wav');
    formData.append('file', {
      uri: params.audioUri,
      name: isWav ? 'speech.wav' : 'speech.m4a',
      type: isWav ? 'audio/wav' : 'audio/mp4',
    } as any);
    formData.append('user_name', params.userName || '');
    formData.append('history', JSON.stringify(params.history));
    formData.append('current_profile', JSON.stringify(params.currentProfile));

    const res = await api.post<{ success: boolean; data: VoiceAgentTurnResponse }>(
      '/api/agent/voice-turn',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 25000,
      }
    );
    if (!res.data?.success || !res.data.data) {
      throw new Error('Gagal memproses suara pada agen registrasi.');
    }
    return res.data.data;
  },

  /**
   * Sintesis suara natural Bahasa Indonesia langsung dari model neural ONNX self-hosted
   * (/api/tts di onnxaura) dengan cache lokal & in-flight deduplication.
   */
  synthesizeSpeechUri: async (text: string): Promise<string | null> => {
    const clean = text.trim();
    if (!clean) return null;

    const cachePath = `${FileSystem.cacheDirectory}aura_tts_${hashText(clean)}.wav`;
    try {
      const info = await FileSystem.getInfoAsync(cachePath);
      if (info.exists && (info.size ?? 0) > 1024) {
        return cachePath;
      }
    } catch {
      // ignore cache check error
    }

    const existing = ttsInFlightCache.get(cachePath);
    if (existing) {
      return existing;
    }

    const reqPromise = (async (): Promise<string | null> => {
      try {
        const res = await axios.post<{
          success: boolean;
          audio_base64?: string;
          data?: { audio_base64?: string };
        }>(
          `${AI_API_URL}/api/tts`,
          { text: clean, speed: 1.02, format: 'json' },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 12000,
          }
        );

        const audioBase64 = res.data?.audio_base64 || res.data?.data?.audio_base64;
        if (res.data?.success && audioBase64) {
          await FileSystem.writeAsStringAsync(cachePath, audioBase64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          return cachePath;
        }
        return null;
      } catch {
        return null;
      } finally {
        ttsInFlightCache.delete(cachePath);
      }
    })();

    ttsInFlightCache.set(cachePath, reqPromise);
    return reqPromise;
  },
};
