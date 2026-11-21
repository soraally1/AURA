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
import { AuraColors } from '@/constants/aura-theme';

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
  isSubmitting?: boolean;
}

export const VoiceRegistrationAgent: React.FC<VoiceRegistrationAgentProps> = ({
  userName,
  profile,
  onProfileChange,
  onReadyToSubmit,
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
  const speakWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speakSeqRef = useRef<number>(0);

  const stopAllTtsPlayback = useCallback(() => {
    speakSeqRef.current += 1;
    if (speakWatchdogRef.current) {
      clearTimeout(speakWatchdogRef.current);
      speakWatchdogRef.current = null;
    }
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

      const words = text.trim().split(/\s+/).length;
      const maxDurationMs = Math.max(8000, words * 450 + 3000);
      speakWatchdogRef.current = setTimeout(() => {
        if (!isMountedRef.current || seqId !== speakSeqRef.current) return;
        if (shouldAutoListenAfter && autoListen && phaseRef.current === 'speaking') {
          void startListeningRef.current?.();
        } else if (phaseRef.current === 'speaking') {
          updatePhase('ready');
        }
      }, maxDurationMs);

      Speech.speak(text, {
        language: 'id-ID',
        voice: bestVoice,
        pitch: 0.98,
        rate: 0.96,
        onDone: () => {
          if (!isMountedRef.current || seqId !== speakSeqRef.current) return;
          if (speakWatchdogRef.current) {
            clearTimeout(speakWatchdogRef.current);
            speakWatchdogRef.current = null;
          }
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
        if (shouldAutoListenAfter && autoListen) {
          void startListeningRef.current?.();
        } else {
          updatePhase('ready');
        }
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

            const words = text.trim().split(/\s+/).length;
            const maxDurationMs = Math.max(9000, words * 450 + 3500);
            speakWatchdogRef.current = setTimeout(() => {
              if (!isMountedRef.current || seqId !== speakSeqRef.current) return;
              stopAllTtsPlayback();
              if (shouldAutoListenAfter && autoListen) {
                void startListeningRef.current?.();
              } else {
                updatePhase('ready');
              }
            }, maxDurationMs);

            ttsSubRef.current = player.addListener('playbackStatusUpdate', (st) => {
              if (!isMountedRef.current || seqId !== speakSeqRef.current) return;
              if (st.didJustFinish) {
                if (speakWatchdogRef.current) {
                  clearTimeout(speakWatchdogRef.current);
                  speakWatchdogRef.current = null;
                }
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
      } catch {
        if (!active) return;
        const fallbackGreeting = `Halo${userName ? ` ${userName}` : ''}! Saya asisten suara AURA. Sekarang usia kamu berapa tahun?`;
        const nextHistory: VoiceChatMessage[] = [
          { role: 'assistant', content: fallbackGreeting },
        ];
        messagesRef.current = nextHistory;
        setMessages(nextHistory);
        speakAssistantReply(fallbackGreeting, true);
      }
    };

    void bootConversation();
    return () => {
      active = false;
    };
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
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
          shouldRouteThroughEarpiece: false,
        });
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
        'Izin mikrofon ditolak. Aktifkan izin mikrofon atau ketik langsung pada kolom di bawah.'
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

      // Auto-submit cleanly after user finishes speaking and pauses ~1.5s, or 10s max turn
      if (
        (hasSpokenInTurnRef.current && silentElapsed >= 1500 && totalElapsed >= 1350) ||
        totalElapsed >= 10000
      ) {
        void finishListeningRef.current?.();
      }
    }, 140);

    return () => clearInterval(intervalId);
  }, [phase, audioRecorder]);

  const handleSendTyped = async () => {
    const clean = typedText.trim();
    if (!clean || phase === 'processing') return;
    stopAllTtsPlayback();
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

  const filledCount = [
    profile.usia,
    profile.tinggi_badan,
    profile.berat_badan,
    profile.waktu_di_jalan,
  ].filter((v) => v !== null).length;

  const latestAiMsg =
    [...messages].reverse().find((m) => m.role === 'assistant')?.content ||
    'Menyiapkan percakapan dengan AURA AI...';
  const latestUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content;

  return (
    <View style={styles.root}>
      {/* Aura Light-Themed AI Voice Assistant Card matching Login & Register */}
      <View style={styles.voiceCard}>
        {/* Top Header Row: Badge + Audio Toggles */}
        <View style={styles.cardHeaderRow}>
          <View style={styles.aiBadge}>
            <Ionicons name="sparkles" size={13} color={AuraColors.primary} />
            <Text style={styles.aiBadgeText}>ASISTEN SUARA AURA ({filledCount}/4)</Text>
          </View>

          <View style={styles.togglesRow}>
            <Pressable
              style={[styles.miniPill, ttsEnabled && styles.miniPillActive]}
              onPress={() => {
                if (ttsEnabled) stopAllTtsPlayback();
                setTtsEnabled((v) => !v);
              }}
            >
              <Ionicons
                name={ttsEnabled ? 'volume-high' : 'volume-mute'}
                size={13}
                color={ttsEnabled ? AuraColors.primary : '#64748B'}
              />
              <Text style={[styles.miniPillText, ttsEnabled && styles.miniPillTextActive]}>
                {ttsEnabled ? 'Suara On' : 'Mati'}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.miniPill, autoListen && styles.miniPillActive]}
              onPress={() => setAutoListen((v) => !v)}
            >
              <Ionicons
                name="sync"
                size={12}
                color={autoListen ? AuraColors.primary : '#64748B'}
              />
              <Text style={[styles.miniPillText, autoListen && styles.miniPillTextActive]}>
                {autoListen ? 'Auto' : 'Manual'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Active Conversation Bubble */}
        <View style={styles.dialogueBox}>
          {messages.length === 0 ? (
            <View style={styles.initRow}>
              <ActivityIndicator size="small" color={AuraColors.primary} />
              <Text style={styles.initText}>Menyiapkan suara asisten AURA...</Text>
            </View>
          ) : (
            <>
              <Pressable
                onPress={() => speakAssistantReply(latestAiMsg, false)}
                style={styles.aiMessageRow}
              >
                <View style={styles.aiAvatarCircle}>
                  <Ionicons name="volume-medium" size={16} color="#FFFFFF" />
                </View>
                <View style={styles.aiTextCol}>
                  <Text style={styles.aiSenderLabel}>AURA AI • Ketuk untuk putar ulang</Text>
                  <Text style={styles.aiMessageText}>{latestAiMsg}</Text>
                </View>
              </Pressable>

              {latestUserMsg ? (
                <View style={styles.userReplyChip}>
                  <Ionicons name="mic" size={13} color={AuraColors.primary} />
                  <Text style={styles.userReplyText} numberOfLines={1}>
                    Jawabanmu: “{latestUserMsg}”
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </View>

        {/* Live Voice Level Indicator when Listening */}
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
                    width: `${Math.max(8, micLevelPct)}%`,
                    backgroundColor: micLevelPct >= 18 ? '#10B981' : AuraColors.primary,
                  },
                ]}
              />
            </View>
          </View>
        )}

        {/* Error Alert Banner */}
        {agentError ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={16} color="#DC2626" />
            <Text style={styles.errorText}>{agentError}</Text>
          </View>
        ) : null}

        {/* Primary Microphone Action Button */}
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
                : ['#4A9CF4', AuraColors.primary]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
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
                size={20}
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
                : 'Ketuk & Bicara dengan AURA'}
            </Text>
          </LinearGradient>
        </Pressable>

        {/* Quick Conversational Chat Input */}
        <View style={styles.textFallbackRow}>
          <TextInput
            style={styles.textFallbackInput}
            placeholder="Atau balas percakapan AI di sini..."
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
            <Ionicons name="send" size={15} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      {/* Hidden WebView Direct PCM Recorder & WAV Converter */}
      <AudioToWavConverter ref={converterRef} />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    marginBottom: 16,
  },
  voiceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    shadowColor: '#2373F4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    gap: 11,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  aiBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: AuraColors.primary,
    letterSpacing: 0.3,
  },
  togglesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  miniPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  miniPillActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  miniPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  miniPillTextActive: {
    color: AuraColors.primary,
    fontWeight: '700',
  },
  dialogueBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  initRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  initText: {
    fontSize: 12.5,
    color: '#475569',
    fontWeight: '500',
  },
  aiMessageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  aiAvatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: AuraColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  aiTextCol: {
    flex: 1,
    gap: 2,
  },
  aiSenderLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: AuraColors.primary,
  },
  aiMessageText: {
    fontSize: 13.5,
    lineHeight: 19,
    color: '#1E293B',
    fontWeight: '600',
  },
  userReplyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 5,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  userReplyText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#1E40AF',
  },
  levelWrap: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 9,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 5,
  },
  levelLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1E40AF',
    textAlign: 'center',
  },
  levelTrack: {
    height: 6,
    backgroundColor: '#DBEAFE',
    borderRadius: 4,
    overflow: 'hidden',
  },
  levelFill: {
    height: '100%',
    borderRadius: 4,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 9,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: '#B91C1C',
    fontWeight: '500',
  },
  micPressable: {
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: '#2373F4',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  micButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 8,
    borderRadius: 999,
  },
  micButtonText: {
    fontSize: 13.5,
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
    borderColor: '#CBD5E1',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 12.5,
    color: '#0F172A',
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AuraColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
