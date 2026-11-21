import axios, { AxiosError, InternalAxiosRequestConfig, isAxiosError } from 'axios';
import { TokenStorage } from './storage';
import {
  ApiResponse,
  AuthResponseData,
  User,
  AuthTokens,
  RegisterPayload,
  UpdateProfilePayload,
} from '@/types/auth';

export const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://aurabackend-eight.vercel.app';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Listener for session expiration (e.g. redirect to login)
let onSessionExpiredCallback: (() => void) | null = null;

export function setOnSessionExpired(callback: () => void) {
  onSessionExpiredCallback = callback;
}

// 1. Request Interceptor: Attach Bearer idToken
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const idToken = await TokenStorage.getIdToken();
    if (idToken && config.headers) {
      config.headers.Authorization = `Bearer ${idToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Endpoints that should never trigger auto-refresh or session-expired redirect on 401
const AUTH_PUBLIC_OR_SESSION_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/logout',
];

const isSkipRefreshRequest = (url?: string): boolean => {
  if (!url) return false;
  return AUTH_PUBLIC_OR_SESSION_PATHS.some((path) => url.includes(path));
};

// 2. Response Interceptor: Silent Token Refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Never intercept 401 on login/register/refresh/logout endpoints:
    // Wrong password on login must bubble directly to the Sign In form!
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isSkipRefreshRequest(originalRequest.url)
    ) {
      originalRequest._retry = true;
      const refreshToken = await TokenStorage.getRefreshToken();

      if (refreshToken) {
        try {
          // Allow up to 7s for cold-start Vercel + Firebase token exchange
          const res = await axios.post<ApiResponse<{ tokens: AuthTokens }>>(
            `${BASE_URL}/api/auth/refresh`,
            { refreshToken },
            { headers: { 'Content-Type': 'application/json' }, timeout: 7000 }
          );

          if (res.data.success && res.data.data?.tokens?.idToken) {
            const newIdToken = res.data.data.tokens.idToken;
            await TokenStorage.setIdToken(newIdToken);

            if (res.data.data.tokens.refreshToken) {
              await TokenStorage.setRefreshToken(res.data.data.tokens.refreshToken);
            }

            // Retry original request with new token
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newIdToken}`;
            }
            return api(originalRequest);
          }
        } catch (refreshErr) {
          const refreshStatus = isAxiosError(refreshErr)
            ? refreshErr.response?.status
            : undefined;
          console.warn('[API] Token refresh failed:', refreshStatus ?? 'network/timeout', refreshErr);

          // Only clear stored session when server explicitly rejects/revokes the refresh token (401/403).
          // Preserve cached session if user is simply offline or request timed out.
          if (refreshStatus === 401 || refreshStatus === 403) {
            await TokenStorage.clearTokens();
            if (onSessionExpiredCallback) {
              onSessionExpiredCallback();
            }
          }
        }
      } else {
        await TokenStorage.clearTokens();
        if (onSessionExpiredCallback) {
          onSessionExpiredCallback();
        }
      }
    }

    return Promise.reject(error);
  }
);

// Authentication Endpoints
export const authApi = {
  /**
   * Register new user
   * POST /api/auth/register
   */
  register: async (payload: RegisterPayload): Promise<AuthResponseData> => {
    const res = await api.post<ApiResponse<AuthResponseData>>(
      '/api/auth/register',
      payload
    );
    if (!res.data.success) {
      throw res.data;
    }
    return res.data.data;
  },

  /**
   * Update authenticated user profile
   * PUT /api/auth/profile
   */
  updateProfile: async (payload: UpdateProfilePayload): Promise<User> => {
    const res = await api.put<ApiResponse<{ user: User } | User>>(
      '/api/auth/profile',
      payload
    );
    if (!res.data.success) {
      throw res.data;
    }
    const data = res.data.data;
    return 'user' in data ? data.user : (data as unknown as User);
  },

  /**
   * Login user
   * POST /api/auth/login
   */
  login: async (payload: {
    email: string;
    password: string;
  }): Promise<AuthResponseData> => {
    const res = await api.post<ApiResponse<AuthResponseData>>(
      '/api/auth/login',
      {
        email: payload.email.trim().toLowerCase(),
        password: payload.password,
      }
    );
    if (!res.data.success) {
      throw res.data;
    }
    return res.data.data;
  },

  /**
   * Get current authenticated user profile
   * GET /api/auth/me
   */
  getMe: async (): Promise<User> => {
    const res = await api.get<ApiResponse<{ user: User } | User>>(
      '/api/auth/me'
    );
    if (!res.data.success) {
      throw res.data;
    }
    const data = res.data.data;
    return 'user' in data ? data.user : data;
  },

  /**
   * Refresh access token
   * POST /api/auth/refresh
   */
  refreshToken: async (refreshToken: string): Promise<AuthTokens> => {
    const res = await axios.post<ApiResponse<{ tokens: AuthTokens }>>(
      `${BASE_URL}/api/auth/refresh`,
      { refreshToken },
      { timeout: 7000 }
    );
    if (!res.data.success) {
      throw res.data;
    }
    return res.data.data.tokens;
  },

  /**
   * Logout user
   * POST /api/auth/logout
   */
  logout: async (): Promise<void> => {
    try {
      await api.post('/api/auth/logout', undefined, { timeout: 3000 });
    } catch (err) {
      // Still proceed with local token deletion even if server is unreachable or token already expired
      console.warn('[API] Logout request error (proceeding with local cleanup):', err);
    } finally {
      await TokenStorage.clearTokens();
    }
  },
};

export * from './terrainService';
export * from './locationService';
