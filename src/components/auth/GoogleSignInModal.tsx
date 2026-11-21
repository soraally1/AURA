import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview';
import axios from 'axios';

const FIREBASE_WEB_API_KEY =
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyBVSasaETMjlfFMCIVP8aROFlCU9rR0pS8';
const FIREBASE_AUTH_HANDLER_URL = 'https://aura-analisis.firebaseapp.com/__/auth/handler';
const GOOGLE_WEB_CLIENT_ID =
  '255431346346-o1ri3cdd3bodkcje45sfp1878sbdg9of.apps.googleusercontent.com';

export interface GoogleAuthPayload {
  idToken?: string;
  accessToken?: string;
  name?: string;
  email?: string;
}

interface GoogleSignInModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (payload: GoogleAuthPayload) => void;
  onError?: (message: string) => void;
}

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);

    if (typeof globalThis.atob === 'function') {
      const binary = globalThis.atob(padded);
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      const decoded = new TextDecoder().decode(bytes);
      return JSON.parse(decoded);
    }
    return null;
  } catch {
    return null;
  }
}

function extractTokensFromUrl(url: string): GoogleAuthPayload | null {
  if (!url || !url.startsWith(FIREBASE_AUTH_HANDLER_URL)) {
    return null;
  }

  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  const rawParams: string[] = [];

  if (hashIndex !== -1) {
    rawParams.push(url.slice(hashIndex + 1));
  }
  if (queryIndex !== -1) {
    const end = hashIndex !== -1 && hashIndex > queryIndex ? hashIndex : url.length;
    rawParams.push(url.slice(queryIndex + 1, end));
  }

  let idToken: string | undefined;
  let accessToken: string | undefined;

  for (const segment of rawParams) {
    const pairs = segment.split('&');
    for (const pair of pairs) {
      const [rawKey, rawVal] = pair.split('=');
      if (!rawKey || !rawVal) continue;
      const key = decodeURIComponent(rawKey);
      const val = decodeURIComponent(rawVal);
      if (key === 'id_token' && val) {
        idToken = val;
      } else if (key === 'access_token' && val) {
        accessToken = val;
      }
    }
  }

  if (!idToken && !accessToken) {
    return null;
  }

  const claims = idToken ? decodeJwtPayload(idToken) : null;
  return {
    idToken,
    accessToken,
    name: typeof claims?.name === 'string' ? claims.name : undefined,
    email: typeof claims?.email === 'string' ? claims.email : undefined,
  };
}

function buildFallbackGoogleAuthUri(): string {
  const nonce = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const params = new URLSearchParams({
    response_type: 'id_token',
    client_id: GOOGLE_WEB_CLIENT_ID,
    redirect_uri: FIREBASE_AUTH_HANDLER_URL,
    scope: 'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
    nonce,
    prompt: 'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

const INJECTED_INTERCEPT_JS = `
(function() {
  function checkHandlerUrl() {
    try {
      var href = window.location.href || '';
      if (href.indexOf('aura-analisis.firebaseapp.com/__/auth/handler') !== -1 &&
          (href.indexOf('id_token=') !== -1 || href.indexOf('access_token=') !== -1)) {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'OAUTH_CALLBACK_URL',
            url: href
          }));
        }
      }
    } catch (e) {}
  }
  checkHandlerUrl();
  window.addEventListener('hashchange', checkHandlerUrl);
  setInterval(checkHandlerUrl, 120);
})();
true;
`;

export const GoogleSignInModal: React.FC<GoogleSignInModalProps> = ({
  visible,
  onClose,
  onSuccess,
  onError,
}) => {
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState<boolean>(false);
  const hasCompletedRef = useRef<boolean>(false);
  const webViewRef = useRef<WebView | null>(null);

  const prepareGoogleOAuthUrl = useCallback(async () => {
    hasCompletedRef.current = false;
    setIsPreparing(true);
    try {
      const res = await axios.post<{ authUri?: string }>(
        `https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${FIREBASE_WEB_API_KEY}`,
        {
          providerId: 'google.com',
          continueUri: FIREBASE_AUTH_HANDLER_URL,
        },
        { timeout: 6000 }
      );
      if (res.data?.authUri) {
        const uri = res.data.authUri.includes('prompt=')
          ? res.data.authUri
          : `${res.data.authUri}&prompt=select_account`;
        setAuthUrl(uri);
      } else {
        setAuthUrl(buildFallbackGoogleAuthUri());
      }
    } catch {
      setAuthUrl(buildFallbackGoogleAuthUri());
    } finally {
      setIsPreparing(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      void prepareGoogleOAuthUrl();
    } else {
      setAuthUrl(null);
      hasCompletedRef.current = false;
    }
  }, [visible, prepareGoogleOAuthUrl]);

  const handleDetectedUrl = useCallback(
    (url: string): boolean => {
      if (hasCompletedRef.current) return true;
      const extracted = extractTokensFromUrl(url);
      if (extracted) {
        hasCompletedRef.current = true;
        onSuccess(extracted);
        return true;
      }
      if (
        url.startsWith(FIREBASE_AUTH_HANDLER_URL) &&
        (url.includes('error=') || url.includes('access_denied'))
      ) {
        hasCompletedRef.current = true;
        onError?.('Login Google dibatalkan.');
        onClose();
        return true;
      }
      return false;
    },
    [onClose, onError, onSuccess]
  );

  const handleNavigationChange = (navState: WebViewNavigation) => {
    if (navState?.url) {
      handleDetectedUrl(navState.url);
    }
  };

  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const parsed = JSON.parse(event.nativeEvent.data);
      if (parsed?.type === 'OAUTH_CALLBACK_URL' && typeof parsed.url === 'string') {
        handleDetectedUrl(parsed.url);
      }
    } catch {
      // ignore non-json postMessage
    }
  };

  const browserUserAgent =
    Platform.OS === 'android'
      ? 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.6613.127 Mobile Safari/537.36'
      : 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
            <Ionicons name="close" size={22} color="#0F172A" />
          </Pressable>
          <View style={styles.titleWrap}>
            <Ionicons name="lock-closed" size={13} color="#10B981" />
            <Text style={styles.titleText}>Login dengan Akun Google</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {isPreparing || !authUrl ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color="#1E6CEF" />
            <Text style={styles.loaderText}>Menghubungkan ke Google...</Text>
          </View>
        ) : (
          <WebView
            ref={webViewRef}
            source={{ uri: authUrl }}
            userAgent={browserUserAgent}
            injectedJavaScriptBeforeContentLoaded={INJECTED_INTERCEPT_JS}
            injectedJavaScript={INJECTED_INTERCEPT_JS}
            onNavigationStateChange={handleNavigationChange}
            onMessage={handleWebViewMessage}
            onShouldStartLoadWithRequest={(req) => {
              if (handleDetectedUrl(req.url)) {
                return false;
              }
              return true;
            }}
            javaScriptEnabled
            domStorageEnabled
            thirdPartyCookiesEnabled
            sharedCookiesEnabled
            startInLoadingState
            renderLoading={() => (
              <View style={styles.webViewLoading}>
                <ActivityIndicator size="large" color="#1E6CEF" />
              </View>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  titleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loaderText: {
    fontSize: 13.5,
    color: '#64748B',
    fontWeight: '600',
  },
  webViewLoading: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
