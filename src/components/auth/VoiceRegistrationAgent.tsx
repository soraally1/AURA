import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import {
  useAudioRecorder,
  createAudioPlayer,
  AudioPlayer,
  RecordingPresets,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import {
  AudioToWavConverter,
  AudioToWavConverterRef,
} from '@/components/AudioToWavConverter';
import {
  ProfileDraft,
  VoiceChatMessage,
  VoiceAgentTurnResponse,
  voiceAgentService,
} from '@/services/voiceAgentService';

type AgentPhase = 'initializing' | 'speaking' | 'ready' | 'listening' | 'processing';

const MONO_RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  sampleRate: 44100,
  numberOfChannels: 1,
  bitRate: 128000,
  isMeteringEnabled: true,
  android: {
    extension: '.m4a',
    outputFormat: 'mpeg4' as const,
    audioEncoder: 'aac' as const,
    sampleRate: 44100,
    audioSource: 'mic' as const,
  },
};

interface VoiceRegistrationAgentProps {
  userName?: string;
  profile: ProfileDraft;
  onProfileChange: (next: ProfileDraft) => void;
  onReadyToSubmit: (draft: ProfileDraft) => void;
  onSwitchToManual: () => void;
  isSubmitting?: boolean;
}

export const VoiceRegistrationAgent: React.FC<VoiceRegistrationAgentProps> = ({
  userName,
  profile,
  onProfileChange,
  onReadyToSubmit,
  onSwitchToManual,
  isSubmitting = false,
}) => {
  const audioRecorder = useAudioRecorder(MONO_RECORDING_OPTIONS);
  const converterRef = useRef<AudioToWavConverterRef>(null);

  const [messages, setMessages] = useState<VoiceChatMessage[]>([]);
  const [phase, setPhase] = useState<AgentPhase>('initializing');
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(true);
  const [autoListen, setAutoListen] = useState<boolean>(true);
  const [micLevelPct, setMicLevelPct] = useState<number>(0);
  const [typedText, setTypedText] = useState<string>('');
  const [agentError, setAgentError] = useState<string | null>(null);

  const profileRef = useRef<ProfileDraft>(profile);
  const messagesRef = useRef<VoiceChatMessage[]>(messages);
  const recordModeRef = useRef<'pcm' | 'native'>('pcm');
  const phaseRef = useRef<AgentPhase>(phase);
  const isMountedRef = useRef<boolean>(true);
  const hasSpokenInTurnRef = useRef<boolean>(false);
  const lastVoiceTsRef = useRef<number>(0);
  const listenStartTsRef = useRef<number>(0);
  const finishListeningRef = useRef<(() => Promise<void>) | null>(null);
  const startListeningRef = useRef<(() => Promise<void>) | null>(null);
  const ttsPlayerRef = useRef<AudioPlayer | null>(null);
  const ttsSubRef = useRef<{ remove: () => void } | null>(null);
  const speakSeqRef = useRef<number>(0);

  const stopAllTtsPlayback = useCallback(() => {
    speakSeqRef.current += 1;
    try {
      Speech.stop();
    } catch {
      // ignore
    }
    try {
      ttsSubRef.current?.remove();
    } catch {
      // ignore
    }
    ttsSubRef.current = null;
    try {
      ttsPlayerRef.current?.pause();
      ttsPlayerRef.current?.remove();
    } catch {
      // ignore
    }
    ttsPlayerRef.current = null;
  }, []);

  const updatePhase = useCallback((nextPhase: AgentPhase) => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  }, []);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopAllTtsPlayback();
    };
  }, [stopAllTtsPlayback]);

  const speakWithOsFallback = useCallback(
    async (text: string, shouldAutoListenAfter: boolean, seqId: number) => {
      if (!isMountedRef.current || seqId !== speakSeqRef.current) return;
      let bestVoice: string | undefined;
      try {
        const voices = await Speech.getAvailableVoicesAsync();
        const idVoices = voices.filter((v) =>
          v.language.toLowerCase().startsWith('id')
        );
        const preferred =
          idVoices.find(
            (v) =>
              v.quality === Speech.VoiceQuality.Enhanced ||
              v.identifier.toLowerCase().includes('network')
          ) || idVoices[0];
        bestVoice = preferred?.identifier;
      } catch {
        bestVoice = undefined;
      }

      if (!isMountedRef.current || seqId !== speakSeqRef.current) return;
      Speech.speak(text, {
        language: 'id-ID',
        voice: bestVoice,
        pitch: 0.98,
        rate: 0.96,
        onDone: () => {
          if (!isMountedRef.current || seqId !== speakSeqRef.current) return;
          if (shouldAutoListenAfter && autoListen && phaseRef.current === 'speaking') {
            void startListeningRef.current?.();
          } else {
            updatePhase('ready');
          }
        },
        onStopped: () => {
          if (isMountedRef.current && phaseRef.current === 'speaking') {
            updatePhase('ready');
          }
        },
        onError: () => {
          if (isMountedRef.current) {
            updatePhase('ready');
          }
        },
      });
    },
    [autoListen, updatePhase]
  );

  const speakAssistantReply = useCallback(
    (text: string, shouldAutoListenAfter: boolean) => {
      if (!isMountedRef.current) return;
      stopAllTtsPlayback();
      const seqId = speakSeqRef.current;

      if (!ttsEnabled) {
        updatePhase('ready');
        return;
      }

      updatePhase('speaking');
      void (async () => {
        try {
          const wavUri = await voiceAgentService.synthesizeSpeechUri(text);
          if (!isMountedRef.current || seqId !== speakSeqRef.current) return;

          if (wavUri) {
            await setAudioModeAsync({
              allowsRecording: false,
              playsInSilentMode: true,
              shouldRouteThroughEarpiece: false,
            });
            if (!isMountedRef.current || seqId !== speakSeqRef.current) return;

            const player = createAudioPlayer(wavUri, { updateInterval: 100 });
            ttsPlayerRef.current = player;
            ttsSubRef.current = player.addListener('playbackStatusUpdate', (st) => {
              if (!isMountedRef.current || seqId !== speakSeqRef.current) return;
              if (st.didJustFinish) {
                try {
                  ttsSubRef.current?.remove();
                } catch {
                  // ignore
                }
                ttsSubRef.current = null;
                try {
                  player.remove();
                } catch {
                  // ignore
                }
                if (ttsPlayerRef.current === player) {
                  ttsPlayerRef.current = null;
                }
                if (
                  shouldAutoListenAfter &&
                  autoListen &&
                  phaseRef.current === 'speaking'
                ) {
                  void startListeningRef.current?.();
                } else {
                  updatePhase('ready');
                }
              }
            });
            player.play();
            return;
          }
        } catch {
          // fall through to OS voice fallback below
        }

        void speakWithOsFallback(text, shouldAutoListenAfter, seqId);
      })();
    },
    [ttsEnabled, autoListen, stopAllTtsPlayback, speakWithOsFallback, updatePhase]
  );

  const applyAgentTurnResponse = useCallback(
    (res: VoiceAgentTurnResponse, userTranscript?: string) => {
      if (!isMountedRef.current) return;

      const appended: VoiceChatMessage[] = [];
      if (userTranscript && userTranscript.trim()) {
        appended.push({ role: 'user', content: userTranscript.trim() });
      }
      if (res.assistant_reply && res.assistant_reply.trim()) {
        appended.push({ role: 'assistant', content: res.assistant_reply.trim() });
      }

      const nextHistory = [...messagesRef.current, ...appended];
      messagesRef.current = nextHistory;
      setMessages(nextHistory);

      if (res.updated_profile) {
        profileRef.current = res.updated_profile;
        onProfileChange(res.updated_profile);
      }

      if (res.ready_to_submit && res.is_complete) {
        stopAllTtsPlayback();
        updatePhase('ready');
        onReadyToSubmit(res.updated_profile || profileRef.current);
        return;
      }

      speakAssistantReply(res.assistant_reply, !res.is_complete);
    },
    [onProfileChange, onReadyToSubmit, speakAssistantReply, stopAllTtsPlayback, updatePhase]
  );

  // Initial conversational greeting from AI Agent
  useEffect(() => {
    let active = true;
    const bootConversation = async () => {
      try {
        setAgentError(null);
        const res = await voiceAgentService.sendTextTurn({
          userName,
          userMessage: '',
          history: [],
          currentProfile: profileRef.current,
        });
        if (!active) return;
        applyAgentTurnResponse(res);
      } catch (err: any) {
        if (!active) return;
        const fallbackGreeting = `Halo${userName ? ` ${userName}` : ''}! Saya asisten suara AURA. Sekarang usia kamu berapa tahun?`;
        const nextHistory: VoiceChatMessage[] = [
          { role: 'assistant', content: fallbackGreeting },
        ];
        messagesRef.current = nextHistory;
        setMessages(nextHistory);
        const status = err?.response?.status;
        if (status === 404) {
          setAgentError(
            'Endpoint AI agent di server belum terdeploy. Silakan deploy aurabackend terbaru ke Vercel.'
          );
        }
        speakAssistantReply(fallbackGreeting, false);
      }
    };

    void bootConversation();
    return () => {
      active = false;
    };
    // Run once on mount for dynamic greeting
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopAudioAndSubmitTurn = useCallback(async () => {
    if (phaseRef.current !== 'listening') return;
    updatePhase('processing');
    setMicLevelPct(0);
    setAgentError(null);

    try {
      let audioUri: string | null = null;
      if (recordModeRef.current === 'pcm' && converterRef.current) {
        const wavRes = await converterRef.current.stopDirectPcmRecording(16000);
        audioUri = wavRes.uri;
        if (wavRes.isSilent) {
          throw new Error(
            'Suara belum terdengar. Ketuk tombol mikrofon dan ucapkan jawabanmu lebih dekat ke mic.'
          );
        }
      } else {
        if (audioRecorder.isRecording) {
          await audioRecorder.stop();
        }
        const rawUri = audioRecorder.uri;
        if (!rawUri) {
          throw new Error('File rekaman suara tidak ditemukan.');
        }
        audioUri = rawUri;
        if (converterRef.current) {
          try {
            const wavRes = await converterRef.current.convertToWav(rawUri, 16000);
            audioUri = wavRes.uri;
          } catch {
            // Groq Whisper also accepts .m4a directly if WebView decoder skips
          }
        }
      }

      const res = await voiceAgentService.sendVoiceTurn({
        audioUri: audioUri!,
        userName,
        history: messagesRef.current,
        currentProfile: profileRef.current,
      });
      applyAgentTurnResponse(res, res.transcript);
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Gagal memproses suara. Silakan coba lagi.';
      setAgentError(msg);
      updatePhase('ready');
    }
  }, [audioRecorder, applyAgentTurnResponse, userName, updatePhase]);

  useEffect(() => {
    finishListeningRef.current = stopAudioAndSubmitTurn;
  }, [stopAudioAndSubmitTurn]);

  const startListening = useCallback(async () => {
    if (phaseRef.current === 'listening' || phaseRef.current === 'processing') return;

    stopAllTtsPlayback();

    setAgentError(null);
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      setAgentError(
        'Izin mikrofon ditolak. Aktifkan izin mikrofon atau gunakan mode Isi Manual.'
      );
      updatePhase('ready');
      return;
    }

    hasSpokenInTurnRef.current = false;
    listenStartTsRef.current = Date.now();
    lastVoiceTsRef.current = Date.now();
    setMicLevelPct(0);

    try {
      let pcmStarted = false;
      if (converterRef.current) {
        try {
          pcmStarted = await converterRef.current.startDirectPcmRecording((pct) => {
            if (!isMountedRef.current) return;
            setMicLevelPct(pct);
            if (pct >= 18) {
              hasSpokenInTurnRef.current = true;
              lastVoiceTsRef.current = Date.now();
            }
          });
        } catch {
          pcmStarted = false;
        }
      }

      if (pcmStarted) {
        recordModeRef.current = 'pcm';
        updatePhase('listening');
        return;
      }

      recordModeRef.current = 'native';
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldRouteThroughEarpiece: false,
      });
      await audioRecorder.prepareToRecordAsync(MONO_RECORDING_OPTIONS);
      audioRecorder.record();
      updatePhase('listening');
    } catch (err: any) {
      setAgentError(err?.message || 'Gagal membuka mikrofon.');
      updatePhase('ready');
    }
  }, [audioRecorder, stopAllTtsPlayback, updatePhase]);

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  // Poll native metering + VAD silence auto-finish + 10s safety cap while listening
  useEffect(() => {
    if (phase !== 'listening') return;
    const intervalId = setInterval(() => {
      if (recordModeRef.current === 'native') {
        try {
          const st = audioRecorder.getStatus();
          if (typeof st?.metering === 'number') {
            const pct = Math.max(0, Math.min(100, Math.round(((st.metering + 60) / 55) * 100)));
            setMicLevelPct(pct);
            if (pct >= 20) {
              hasSpokenInTurnRef.current = true;
              lastVoiceTsRef.current = Date.now();
            }
          }
        } catch {
          // ignore
        }
      }

      const now = Date.now();
      const totalElapsed = now - listenStartTsRef.current;
      const silentElapsed = now - lastVoiceTsRef.current;

      // Auto-submit cleanly after user finishes speaking and pauses ~1.6s, or 10s max turn
      if ((hasSpokenInTurnRef.current && silentElapsed >= 1650 && totalElapsed >= 1400) || totalElapsed >= 10000) {
        void finishListeningRef.current?.();
      }
    }, 140);

    return () => clearInterval(intervalId);
  }, [phase, audioRecorder]);

  const handleSendTyped = async () => {
    const clean = typedText.trim();
    if (!clean || phase === 'processing') return;
    try {
      Speech.stop();
    } catch {
      // ignore
    }
    setTypedText('');
    setAgentError(null);
    updatePhase('processing');

    try {
      const res = await voiceAgentService.sendTextTurn({
        userName,
        userMessage: clean,
        history: messagesRef.current,
        currentProfile: profileRef.current,
      });
      applyAgentTurnResponse(res, clean);
    } catch (err: any) {
      setAgentError(
        err?.response?.data?.error?.message ||
          err?.message ||
          'Gagal mengirim pesan ke asisten AURA.'
      );
      updatePhase('ready');
    }
  };

  const fields = [
    {
      key: 'usia' as const,
      label: 'Usia',
      value: profile.usia !== null ? `${profile.usia} thn` : 'Belum diisi',
      filled: profile.usia !== null,
      icon: 'calendar-outline' as const,
    },
    {
      key: 'tinggi_badan' as const,
      label: 'Tinggi Badan',
      value: profile.tinggi_badan !== null ? `${profile.tinggi_badan} cm` : 'Belum diisi',
      filled: profile.tinggi_badan !== null,
      icon: 'resize-outline' as const,
    },
    {
      key: 'berat_badan' as const,
      label: 'Berat Badan',
      value: profile.berat_badan !== null ? `${profile.berat_badan} kg` : 'Belum diisi',
      filled: profile.berat_badan !== null,
      icon: 'fitness-outline' as const,
    },
    {
      key: 'waktu_di_jalan' as const,
      label: 'Di Jalan / Hari',
      value:
        profile.waktu_di_jalan !== null
          ? `${profile.waktu_di_jalan} jam`
          : 'Belum diisi',
      filled: profile.waktu_di_jalan !== null,
      icon: 'walk-outline' as const,
    },
  ];

  const filledCount = fields.filter((f) => f.filled).length;
  const allComplete = filledCount === 4;

  return (
    <View style={styles.root}>
      {/* Live Dynamic Profile Slots Card */}
      <View style={styles.slotsCard}>
        <View style={styles.slotsHeaderRow}>
          <View style={styles.slotsBadge}>
            <Ionicons name="sparkles" size={12} color="#1E6CEF" />
            <Text style={styles.slotsBadgeText}>PENGISIAN FORM OTOMATIS</Text>
          </View>
          <Text style={styles.slotsCountText}>{filledCount}/4 Terisi</Text>
        </View>

        <View style={styles.slotsGrid}>
          {fields.map((f) => (
            <Pressable
              key={f.key}
              onPress={onSwitchToManual}
              style={[styles.slotItem, f.filled && styles.slotItemFilled]}
            >
              <View style={styles.slotTop}>
                <Ionicons
                  name={f.icon}
                  size={14}
                  color={f.filled ? '#1E6CEF' : '#94A3B8'}
                />
                <Text style={styles.slotLabel}>{f.label}</Text>
                {f.filled && (
                  <Ionicons name="checkmark-circle" size={15} color="#10B981" />
                )}
              </View>
              <Text
                style={[styles.slotValue, !f.filled && styles.slotValueEmpty]}
                numberOfLines={1}
              >
                {f.value}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Voice Controls Header Toggles */}
      <View style={styles.controlsStrip}>
        <Pressable
          style={[styles.togglePill, ttsEnabled && styles.togglePillActive]}
          onPress={() => {
            if (ttsEnabled) stopAllTtsPlayback();
            setTtsEnabled((v) => !v);
          }}
        >
          <Ionicons
            name={ttsEnabled ? 'volume-high' : 'volume-mute'}
            size={14}
            color={ttsEnabled ? '#1E6CEF' : '#64748B'}
          />
          <Text style={[styles.togglePillText, ttsEnabled && styles.togglePillTextActive]}>
            Suara AI: {ttsEnabled ? 'Aktif' : 'Mati'}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.togglePill, autoListen && styles.togglePillActive]}
          onPress={() => setAutoListen((v) => !v)}
        >
          <Ionicons
            name="sync"
            size={13}
            color={autoListen ? '#1E6CEF' : '#64748B'}
          />
          <Text style={[styles.togglePillText, autoListen && styles.togglePillTextActive]}>
            Auto-Dengar: {autoListen ? 'Ya' : 'Manual'}
          </Text>
        </Pressable>
      </View>

      {/* Conversation Bubbles */}
      <View style={styles.chatCard}>
        {messages.length === 0 ? (
          <View style={styles.initRow}>
            <ActivityIndicator size="small" color="#1E6CEF" />
            <Text style={styles.initText}>Menyiapkan percakapan dengan AURA AI...</Text>
          </View>
        ) : (
          messages.slice(-6).map((m, idx) => {
            const isAi = m.role === 'assistant';
            return (
              <View
                key={`${m.role}-${idx}`}
                style={[styles.bubbleRow, isAi ? styles.bubbleLeft : styles.bubbleRight]}
              >
                <Pressable
                  disabled={!isAi}
                  onPress={() => isAi && speakAssistantReply(m.content, false)}
                  style={[styles.bubble, isAi ? styles.aiBubble : styles.userBubble]}
                >
                  <View style={styles.bubbleMeta}>
                    <Text
                      style={[
                        styles.bubbleSender,
                        isAi ? styles.aiSenderText : styles.userSenderText,
                      ]}
                    >
                      {isAi ? 'AURA AI' : 'Kamu (Suara)'}
                    </Text>
                    {isAi && (
                      <Ionicons name="volume-medium-outline" size={13} color="#1E6CEF" />
                    )}
                  </View>
                  <Text style={[styles.bubbleBody, isAi ? styles.aiBody : styles.userBody]}>
                    {m.content}
                  </Text>
                </Pressable>
              </View>
            );
          })
        )}
      </View>

      {/* Error Alert Banner */}
      {agentError ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color="#DC2626" />
          <Text style={styles.errorText}>{agentError}</Text>
        </View>
      ) : null}

      {/* Interactive Voice Mic Button */}
      <View style={styles.micSection}>
        {phase === 'listening' && (
          <View style={styles.levelWrap}>
            <Text style={styles.levelLabel}>
              {micLevelPct >= 18
                ? 'Suara terdengar • Berhenti otomatis setelah jeda'
                : 'Silakan ucapkan jawabanmu...'}
            </Text>
            <View style={styles.levelTrack}>
              <View
                style={[
                  styles.levelFill,
                  {
                    width: `${Math.max(6, micLevelPct)}%`,
                    backgroundColor: micLevelPct >= 18 ? '#10B981' : '#60A5FA',
                  },
                ]}
              />
            </View>
          </View>
        )}

        <Pressable
          disabled={phase === 'processing' || phase === 'initializing' || isSubmitting}
          onPress={() => {
            if (phase === 'listening') {
              void stopAudioAndSubmitTurn();
            } else {
              void startListening();
            }
          }}
          style={styles.micPressable}
        >
          <LinearGradient
            colors={
              phase === 'listening'
                ? ['#EF4444', '#DC2626']
                : phase === 'speaking'
                ? ['#0EA5E9', '#1E6CEF']
                : ['#2563EB', '#1D4ED8']
            }
            style={styles.micButton}
          >
            {phase === 'processing' || phase === 'initializing' ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Ionicons
                name={
                  phase === 'listening'
                    ? 'stop-circle'
                    : phase === 'speaking'
                    ? 'mic-outline'
                    : 'mic'
                }
                size={22}
                color="#FFFFFF"
              />
            )}
            <Text style={styles.micButtonText}>
              {phase === 'initializing'
                ? 'Menghubungkan Asisten...'
                : phase === 'speaking'
                ? 'AURA Berbicara (Ketuk untuk Jawab)'
                : phase === 'listening'
                ? 'Mendengarkan... Ketuk Selesai'
                : phase === 'processing'
                ? 'Memahami Jawabanmu...'
                : 'Ketuk & Bicara'}
            </Text>
          </LinearGradient>
        </Pressable>

        {/* Optional Quick Text Input Fallback */}
        <View style={styles.textFallbackRow}>
          <TextInput
            style={styles.textFallbackInput}
            placeholder="Atau ketik jawaban di sini (opsional)..."
            placeholderTextColor="#94A3B8"
            value={typedText}
            onChangeText={setTypedText}
            onSubmitEditing={handleSendTyped}
            returnKeyType="send"
          />
          <Pressable
            onPress={handleSendTyped}
            disabled={!typedText.trim() || phase === 'processing'}
            style={[
              styles.sendBtn,
              (!typedText.trim() || phase === 'processing') && { opacity: 0.45 },
            ]}
          >
            <Ionicons name="send" size={16} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      {/* Direct Confirm & Continue to Dashboard CTA */}
      {allComplete && (
        <Pressable
          onPress={() => onReadyToSubmit(profileRef.current)}
          disabled={isSubmitting}
          style={styles.completeCtaWrap}
        >
          <LinearGradient colors={['#10B981', '#059669']} style={styles.completeCta}>
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Ionicons name="checkmark-done-circle" size={20} color="#FFFFFF" />
            )}
            <Text style={styles.completeCtaText}>
              {isSubmitting ? 'Menyimpan Profil...' : 'Konfirmasi & Lanjut ke Dashboard'}
            </Text>
          </LinearGradient>
        </Pressable>
      )}

      {/* Hidden WebView Direct PCM Recorder & WAV Converter */}
      <AudioToWavConverter ref={converterRef} />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    gap: 12,
  },
  slotsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  slotsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  slotsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  slotsBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1E6CEF',
    letterSpacing: 0.4,
  },
  slotsCountText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1E6CEF',
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotItem: {
    width: '48.5%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  slotItemFilled: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  slotTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  slotLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  slotValue: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  slotValueEmpty: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
  },
  controlsStrip: {
    flexDirection: 'row',
    gap: 8,
  },
  togglePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  togglePillActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  togglePillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  togglePillTextActive: {
    color: '#1E6CEF',
    fontWeight: '700',
  },
  chatCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minHeight: 150,
    gap: 8,
  },
  initRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 30,
  },
  initText: {
    fontSize: 12.5,
    color: '#475569',
    fontWeight: '500',
  },
  bubbleRow: {
    flexDirection: 'row',
  },
  bubbleLeft: {
    justifyContent: 'flex-start',
  },
  bubbleRight: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '88%',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  aiBubble: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: '#1E6CEF',
    borderBottomRightRadius: 4,
  },
  bubbleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 2,
  },
  bubbleSender: {
    fontSize: 10,
    fontWeight: '800',
  },
  aiSenderText: {
    color: '#1E6CEF',
  },
  userSenderText: {
    color: '#DBEAFE',
  },
  bubbleBody: {
    fontSize: 13,
    lineHeight: 18.5,
  },
  aiBody: {
    color: '#0F172A',
  },
  userBody: {
    color: '#FFFFFF',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: '#B91C1C',
    fontWeight: '500',
  },
  micSection: {
    gap: 10,
  },
  levelWrap: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 6,
  },
  levelLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1E40AF',
    textAlign: 'center',
  },
  levelTrack: {
    height: 7,
    backgroundColor: '#DBEAFE',
    borderRadius: 4,
    overflow: 'hidden',
  },
  levelFill: {
    height: '100%',
    borderRadius: 4,
  },
  micPressable: {
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: '#1E6CEF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  micButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 18,
    gap: 10,
    borderRadius: 999,
  },
  micButtonText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  textFallbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  textFallbackInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E6CEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeCtaWrap: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  completeCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    gap: 8,
    borderRadius: 999,
  },
  completeCtaText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
