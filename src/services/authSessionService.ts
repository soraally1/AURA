import { isAxiosError } from 'axios';
import { authApi } from './api';
import { TokenStorage } from './storage';
import { User, isProfileComplete } from '@/types/auth';

export type AuthCheckReason =
  | 'valid_token'
  | 'refreshed'
  | 'offline_cache'
  | 'unauthenticated'
  | 'revoked';

export interface AuthCheckResult {
  isLoggedIn: boolean;
  user: User | null;
  needsProfileCompletion: boolean;
  reason: AuthCheckReason;
  tokenExpiresAt: number | null;
}

export interface AuthCheckOptions {
  /**
   * When false and a valid (unexpired) token + cached profile exist locally,
   * returns the cached session immediately without waiting for `/api/auth/me`.
   * Defaults to true.
   */
  verifyWithServer?: boolean;
  /** Maximum wait time (ms) for server verification/refresh before falling back to cache. */
  timeoutMs?: number;
  /** Force `/api/auth/me` check even if another check recently ran. */
  forceServerVerify?: boolean;
}

const DEFAULT_VERIFY_TIMEOUT_MS = 6000;
const DEFAULT_TOKEN_LEEWAY_SECONDS = 60;

const BASE64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function decodeBase64Fallback(base64: string): string {
  const clean = base64.replace(/=+$/, '');
  let bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const c1 = BASE64_CHARS.indexOf(clean[i]);
    const c2 = BASE64_CHARS.indexOf(clean[i + 1]);
    const c3 = i + 2 < clean.length ? BASE64_CHARS.indexOf(clean[i + 2]) : -1;
    const c4 = i + 3 < clean.length ? BASE64_CHARS.indexOf(clean[i + 3]) : -1;
    if (c1 < 0 || c2 < 0) break;

    bytes.push((c1 << 2) | (c2 >> 4));
    if (c3 >= 0) {
      bytes.push(((c2 & 0x0f) << 4) | (c3 >> 2));
      if (c4 >= 0) {
        bytes.push(((c3 & 0x03) << 6) | c4);
      }
    }
  }
  return String.fromCharCode(...bytes);
}

/**
 * Decodes the JSON payload of a JWT without external dependencies (Hermes/Web/Node safe).
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }

    const binary =
      typeof globalThis.atob === 'function'
        ? globalThis.atob(base64)
        : decodeBase64Fallback(base64);

    // Handle UTF-8 characters inside JWT claims (e.g. display names)
    const percentEncoded = Array.from(binary)
      .map((ch) => `%${ch.charCodeAt(0).toString(16).padStart(2, '0')}`)
      .join('');
    const jsonStr = decodeURIComponent(percentEncoded);
    const parsed = JSON.parse(jsonStr);
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function getTokenExpirationSeconds(token: string): number | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  return typeof payload.exp === 'number' ? payload.exp : null;
}

export function isTokenExpired(
  token: string | null | undefined,
  leewaySeconds: number = DEFAULT_TOKEN_LEEWAY_SECONDS
): boolean {
  if (!token) return true;
  const exp = getTokenExpirationSeconds(token);
  if (exp === null) return true;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return exp <= nowSeconds + leewaySeconds;
}

function isAuthRejectionError(err: unknown): boolean {
  if (isAxiosError(err)) {
    const status = err.response?.status;
    return status === 401 || status === 403;
  }
  const code = (err as { error?: { code?: string } } | null)?.error?.code;
  return (
    code === 'INVALID_TOKEN' ||
    code === 'INVALID_REFRESH_TOKEN' ||
    code === 'TOKEN_REVOKED' ||
    code === 'UNAUTHORIZED' ||
    code === 'USER_DISABLED'
  );
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(label)), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

let inFlightDefaultCheck: Promise<AuthCheckResult> | null = null;
let inFlightForcedCheck: Promise<AuthCheckResult> | null = null;

async function runAuthStatusCheck(
  options: AuthCheckOptions
): Promise<AuthCheckResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_VERIFY_TIMEOUT_MS;
  const verifyWithServer = options.verifyWithServer ?? true;

  const [idTokenRaw, refreshToken, cachedUser] = await Promise.all([
    TokenStorage.getIdToken(),
    TokenStorage.getRefreshToken(),
    TokenStorage.getUserProfile(),
  ]);

  // 1. No tokens at all -> definitively not logged in
  if (!idTokenRaw && !refreshToken) {
    if (cachedUser) {
      await TokenStorage.clearTokens();
    }
    return {
      isLoggedIn: false,
      user: null,
      needsProfileCompletion: false,
      reason: 'unauthenticated',
      tokenExpiresAt: null,
    };
  }

  let activeIdToken = idTokenRaw;
  let didRefresh = false;

  // 2. Proactively refresh if idToken is missing or near/past expiration
  if (!activeIdToken || isTokenExpired(activeIdToken)) {
    if (!refreshToken) {
      await TokenStorage.clearTokens();
      return {
        isLoggedIn: false,
        user: null,
        needsProfileCompletion: false,
        reason: 'revoked',
        tokenExpiresAt: null,
      };
    }

    try {
      const refreshedTokens = await withTimeout(
        authApi.refreshToken(refreshToken),
        timeoutMs,
        'AUTH_REFRESH_TIMEOUT'
      );

      await TokenStorage.setIdToken(refreshedTokens.idToken);
      if (refreshedTokens.refreshToken) {
        await TokenStorage.setRefreshToken(refreshedTokens.refreshToken);
      }

      activeIdToken = refreshedTokens.idToken;
      didRefresh = true;
    } catch (refreshErr) {
      if (isAuthRejectionError(refreshErr)) {
        await TokenStorage.clearTokens();
        return {
          isLoggedIn: false,
          user: null,
          needsProfileCompletion: false,
          reason: 'revoked',
          tokenExpiresAt: null,
        };
      }

      // Network/timeout/5xx error during refresh: keep cached offline session if present
      if (cachedUser) {
        return {
          isLoggedIn: true,
          user: cachedUser,
          needsProfileCompletion: !isProfileComplete(cachedUser),
          reason: 'offline_cache',
          tokenExpiresAt: idTokenRaw ? getTokenExpirationSeconds(idTokenRaw) : null,
        };
      }

      return {
        isLoggedIn: false,
        user: null,
        needsProfileCompletion: false,
        reason: 'unauthenticated',
        tokenExpiresAt: null,
      };
    }
  }

  const tokenExpiresAt = activeIdToken
    ? getTokenExpirationSeconds(activeIdToken)
    : null;

  // 3. Fast path if caller requested local-only verification and cached profile exists
  if (!verifyWithServer && !options.forceServerVerify && cachedUser) {
    return {
      isLoggedIn: true,
      user: cachedUser,
      needsProfileCompletion: !isProfileComplete(cachedUser),
      reason: didRefresh ? 'refreshed' : 'valid_token',
      tokenExpiresAt,
    };
  }

  // 4. Verify live user profile against server (/api/auth/me)
  try {
    const profile = await withTimeout(
      authApi.getMe(),
      timeoutMs,
      'AUTH_VERIFY_TIMEOUT'
    );
    await TokenStorage.setUserProfile(profile);
    return {
      isLoggedIn: true,
      user: profile,
      needsProfileCompletion: !isProfileComplete(profile),
      reason: didRefresh ? 'refreshed' : 'valid_token',
      tokenExpiresAt,
    };
  } catch (verifyErr) {
    if (isAuthRejectionError(verifyErr)) {
      await TokenStorage.clearTokens();
      return {
        isLoggedIn: false,
        user: null,
        needsProfileCompletion: false,
        reason: 'revoked',
        tokenExpiresAt: null,
      };
    }

    // Transient network failure / server timeout -> keep cached user session intact
    if (cachedUser) {
      return {
        isLoggedIn: true,
        user: cachedUser,
        needsProfileCompletion: !isProfileComplete(cachedUser),
        reason: 'offline_cache',
        tokenExpiresAt,
      };
    }

    return {
      isLoggedIn: false,
      user: null,
      needsProfileCompletion: false,
      reason: 'unauthenticated',
      tokenExpiresAt: null,
    };
  }
}

/**
 * Checks the user's authentication status reliably:
 * - Decodes JWT expiration locally without external dependencies
 * - Proactively exchanges expired ID tokens using the stored refresh token
 * - Verifies live account state via `/api/auth/me`
 * - Falls back safely to cached profile on transient offline/timeout errors
 * - Deduplicates concurrent calls to avoid refresh-token races
 */
export async function checkAuthStatus(
  options: AuthCheckOptions = {}
): Promise<AuthCheckResult> {
  if (options.forceServerVerify) {
    if (!inFlightForcedCheck) {
      inFlightForcedCheck = runAuthStatusCheck(options).finally(() => {
        inFlightForcedCheck = null;
      });
    }
    return inFlightForcedCheck;
  }

  if (!inFlightDefaultCheck) {
    inFlightDefaultCheck = runAuthStatusCheck(options).finally(() => {
      inFlightDefaultCheck = null;
    });
  }
  return inFlightDefaultCheck;
}

/**
 * Convenience boolean check: returns true if the user currently has an active logged-in session.
 */
export async function isUserLoggedIn(
  options: AuthCheckOptions = {}
): Promise<boolean> {
  const result = await checkAuthStatus(options);
  return result.isLoggedIn;
}

/**
 * Fast local-only check (no network call):
 * returns true if a refresh token exists or the stored ID token has not expired.
 */
export async function hasStoredSession(): Promise<boolean> {
  const [idToken, refreshToken] = await Promise.all([
    TokenStorage.getIdToken(),
    TokenStorage.getRefreshToken(),
  ]);

  if (refreshToken) return true;
  return Boolean(idToken && !isTokenExpired(idToken));
}

export async function getAuthenticatedUser(
  options: AuthCheckOptions = {}
): Promise<User | null> {
  const result = await checkAuthStatus(options);
  return result.user;
}

export const authSessionService = {
  checkAuthStatus,
  isUserLoggedIn,
  hasStoredSession,
  getAuthenticatedUser,
  isTokenExpired,
  getTokenExpirationSeconds,
  decodeJwtPayload,
};
