import React, { useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';

export interface AudioToWavConverterRef {
  /**
   * Mengonversi audio file URI (misalnya .m4a / .aac / .3gp) menjadi file .wav PCM 16-bit.
   * Mengembalikan local file URI dari file .wav yang tersimpan di cache.
   */
  convertToWav: (inputUri: string, targetSampleRate?: number) => Promise<string>;
}

const CONVERTER_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
<script>
  function postBack(data) {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify(data));
    }
  }

  function base64ToArrayBuffer(base64) {
    var binaryString = window.atob(base64);
    var len = binaryString.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  function arrayBufferToBase64(buffer) {
    var binary = '';
    var bytes = new Uint8Array(buffer);
    var len = bytes.byteLength;
    var chunkSize = 8192;
    for (var i = 0; i < len; i += chunkSize) {
      var chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
      binary += String.fromCharCode.apply(null, chunk);
    }
    return window.btoa(binary);
  }

  function encodeWAV(samples, sampleRate) {
    var buffer = new ArrayBuffer(44 + samples.length * 2);
    var view = new DataView(buffer);

    function writeString(view, offset, string) {
      for (var i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    }

    /* RIFF identifier */
    writeString(view, 0, 'RIFF');
    /* file length minus 8 bytes */
    view.setUint32(4, 36 + samples.length * 2, true);
    /* RIFF type */
    writeString(view, 8, 'WAVE');
    /* format chunk identifier */
    writeString(view, 12, 'fmt ');
    /* format chunk length */
    view.setUint32(16, 16, true);
    /* sample format: 1 = uncompressed PCM */
    view.setUint16(20, 1, true);
    /* channel count: 1 = mono */
    view.setUint16(22, 1, true);
    /* sample rate (e.g. 16000) */
    view.setUint32(24, sampleRate, true);
    /* byte rate: sampleRate * channels * bitsPerSample / 8 */
    view.setUint32(28, sampleRate * 2, true);
    /* block align: channels * bitsPerSample / 8 */
    view.setUint16(32, 2, true);
    /* bits per sample: 16 */
    view.setUint16(34, 16, true);
    /* data chunk identifier */
    writeString(view, 36, 'data');
    /* data chunk length */
    view.setUint32(40, samples.length * 2, true);

    /* 16-bit PCM little-endian samples */
    var offset = 44;
    for (var i = 0; i < samples.length; i++, offset += 2) {
      var s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return buffer;
  }

  function decodeAudioBuffer(audioCtx, arrayBuffer) {
    return new Promise(function(resolve, reject) {
      try {
        var res = audioCtx.decodeAudioData(arrayBuffer, function(decoded) {
          resolve(decoded);
        }, function(err) {
          reject(err || new Error('Gagal mendekode stream audio.'));
        });
        if (res && typeof res.then === 'function') {
          res.then(resolve).catch(reject);
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  async function processConvertRequest(messageData) {
    var reqId = messageData.id;
    var base64 = messageData.base64;
    var targetSampleRate = messageData.targetSampleRate || 16000;

    try {
      var arrayBuffer = base64ToArrayBuffer(base64);

      // Cek apakah file sudah memiliki header RIFF WAVE
      if (arrayBuffer.byteLength >= 12) {
        var headerBytes = new Uint8Array(arrayBuffer.slice(0, 4));
        var riffStr = String.fromCharCode.apply(null, headerBytes);
        var typeBytes = new Uint8Array(arrayBuffer.slice(8, 12));
        var waveStr = String.fromCharCode.apply(null, typeBytes);
        if (riffStr === 'RIFF' && waveStr === 'WAVE') {
          postBack({
            id: reqId,
            success: true,
            wavBase64: base64,
            isAlreadyWav: true,
          });
          return;
        }
      }

      var AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) {
        throw new Error('Web Audio API tidak didukung pada perangkat ini.');
      }

      var audioCtx = new AudioCtxClass();
      if (audioCtx.state === 'suspended') {
        try { await audioCtx.resume(); } catch (e) {}
      }

      var decodedBuffer = await decodeAudioBuffer(audioCtx, arrayBuffer);

      var channelData;
      var actualSampleRate = decodedBuffer.sampleRate;

      // Resample ke targetSampleRate (16000Hz) jika berbeda
      var OfflineCtxClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (decodedBuffer.sampleRate !== targetSampleRate && OfflineCtxClass) {
        try {
          var outLength = Math.max(1, Math.ceil(decodedBuffer.duration * targetSampleRate));
          var offlineCtx = new OfflineCtxClass(1, outLength, targetSampleRate);
          var source = offlineCtx.createBufferSource();
          source.buffer = decodedBuffer;
          source.connect(offlineCtx.destination);
          source.start(0);
          var rendered = await offlineCtx.startRendering();
          channelData = rendered.getChannelData(0);
          actualSampleRate = targetSampleRate;
        } catch (resampleErr) {
          channelData = decodedBuffer.getChannelData(0);
          actualSampleRate = decodedBuffer.sampleRate;
        }
      } else {
        channelData = decodedBuffer.getChannelData(0);
      }

      var wavBuffer = encodeWAV(channelData, actualSampleRate);
      var wavBase64 = arrayBufferToBase64(wavBuffer);

      postBack({
        id: reqId,
        success: true,
        wavBase64: wavBase64,
        sampleRate: actualSampleRate,
        duration: decodedBuffer.duration,
      });
    } catch (err) {
      postBack({
        id: reqId,
        success: false,
        error: err ? (err.message || String(err)) : 'Terjadi kesalahan saat konversi audio.',
      });
    }
  }

  function handleMessage(event) {
    var messageData;
    try {
      messageData = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    } catch (e) {
      return;
    }

    if (!messageData || messageData.type !== 'CONVERT_TO_WAV') return;
    processConvertRequest(messageData);
  }

  window.addEventListener('message', handleMessage);
  document.addEventListener('message', handleMessage);

  window.onload = function() {
    postBack({ type: 'READY' });
  };
</script>
</body>
</html>
`;

export const AudioToWavConverter = forwardRef<AudioToWavConverterRef, {}>((_, ref) => {
  const webViewRef = useRef<WebView>(null);
  const isReadyRef = useRef<boolean>(false);
  const pendingRequests = useRef<
    Map<
      string,
      {
        resolve: (val: string) => void;
        reject: (err: any) => void;
        timeoutId: ReturnType<typeof setTimeout>;
      }
    >
  >(new Map());

  useImperativeHandle(ref, () => ({
    convertToWav: async (inputUri: string, targetSampleRate: number = 16000): Promise<string> => {
      // 1. Baca file rekaman sebagai base64
      let base64: string;
      try {
        base64 = await FileSystem.readAsStringAsync(inputUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch (readErr: any) {
        console.warn('[AudioConverter] Gagal membaca input audio:', readErr);
        throw new Error('Gagal membaca file rekaman audio: ' + (readErr?.message || 'File tidak ditemukan'));
      }

      if (!base64 || base64.length < 50) {
        throw new Error('File rekaman batuk kosong atau terlalu pendek.');
      }

      // 2. Kirim pesan ke WebView converter
      return new Promise<string>((resolve, reject) => {
        const id = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

        const timeoutId = setTimeout(() => {
          if (pendingRequests.current.has(id)) {
            pendingRequests.current.delete(id);
            reject(new Error('Waktu konversi audio ke WAV melebihi batas (timeout).'));
          }
        }, 15000);

        pendingRequests.current.set(id, { resolve, reject, timeoutId });

        const payload = JSON.stringify({
          type: 'CONVERT_TO_WAV',
          id,
          base64,
          targetSampleRate,
        });

        webViewRef.current?.postMessage(payload);
      });
    },
  }));

  const handleMessage = async (event: any) => {
    try {
      const rawData = event.nativeEvent.data;
      const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;

      if (data.type === 'READY') {
        isReadyRef.current = true;
        return;
      }

      const req = pendingRequests.current.get(data.id);
      if (!req) return;

      clearTimeout(req.timeoutId);
      pendingRequests.current.delete(data.id);

      if (data.success && data.wavBase64) {
        // Simpan file WAV asli hasil konversi ke cache local
        const outputUri = `${FileSystem.cacheDirectory}cough_converted_${Date.now()}.wav`;
        await FileSystem.writeAsStringAsync(outputUri, data.wavBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        req.resolve(outputUri);
      } else {
        req.reject(new Error(data.error || 'Gagal mengonversi audio ke WAV.'));
      }
    } catch (e: any) {
      console.warn('[AudioConverter] handleMessage error:', e);
    }
  };

  return (
    <View style={styles.hiddenContainer} pointerEvents="none">
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: CONVERTER_HTML }}
        onMessage={handleMessage}
        onLoadEnd={() => {
          isReadyRef.current = true;
        }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowFileAccess={true}
        mediaPlaybackRequiresUserAction={false}
        style={styles.webView}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  hiddenContainer: {
    width: 1,
    height: 1,
    opacity: 0,
    position: 'absolute',
    top: -100,
    left: -100,
  },
  webView: {
    width: 1,
    height: 1,
  },
});
