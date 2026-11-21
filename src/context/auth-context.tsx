import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { useRouter } from 'expo-router';
import { authApi, setOnSessionExpired } from '@/services/api';
import { TokenStorage } from '@/services/storage';
import {
  authSessionService,
  AuthCheckOptions,
  AuthCheckReason,
  AuthCheckResult,
} from '@/services/authSessionService';
import {
  User,
  AuthResponseData,
  RegisterPayload,
  UpdateProfilePayload,
  isProfileComplete,
} from '@/types/auth';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isProfileCompleted: boolean;
  authStatus: AuthCheckReason | null;
  login: (email: string, password: string) => Promise<AuthResponseData>;
  register: (payload: RegisterPayload) => Promise<AuthResponseData>;
  updateProfile: (payload: UpdateProfilePayload) => Promise<User>;
  logout: () => Promise<void>;
  checkAuth: (options?: AuthCheckOptions) => Promise<AuthCheckResult>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authStatus, setAuthStatus] = useState<AuthCheckReason | null>(null);

  const checkAuth = useCallback(
    async (options?: AuthCheckOptions): Promise<AuthCheckResult> => {
      try {
        setIsLoading(true);

        // Instant optimistic hydration from local cache when a stored session exists
        const hasSession = await authSessionService.hasStoredSession();
        if (hasSession) {
          const cached = await TokenStorage.getUserProfile();
          if (cached) {
            setUser(cached);
          }
        }

        const result = await authSessionService.checkAuthStatus(options);
        setUser(result.user);
        setAuthStatus(result.reason);
        return result;
      } catch (err) {
        console.warn('[AuthProvider] Unexpected session check error:', err);
        setUser(null);
        setAuthStatus('unauthenticated');
        return {
          isLoggedIn: false,
          user: null,
          needsProfileCompletion: false,
          reason: 'unauthenticated',
          tokenExpiresAt: null,
        };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    checkAuth();

    // Register callback for session expiration from axios interceptor
    setOnSessionExpired(() => {
      setUser(null);
      setAuthStatus('revoked');
      router.replace('/');
    });
  }, [checkAuth, router]);

  const login = async (email: string, password: string): Promise<AuthResponseData> => {
    const data = await authApi.login({
      email: email.trim().toLowerCase(),
      password,
    });
    await TokenStorage.saveTokens(data.tokens);
    await TokenStorage.setUserProfile(data.user);
    setUser(data.user);
    setAuthStatus('valid_token');
    return data;
  };

  const register = async (payload: RegisterPayload): Promise<AuthResponseData> => {
    const data = await authApi.register({
      ...payload,
      email: payload.email.trim().toLowerCase(),
    });
    await TokenStorage.saveTokens(data.tokens);
    await TokenStorage.setUserProfile(data.user);
    setUser(data.user);
    setAuthStatus('valid_token');
    return data;
  };

  const updateProfile = async (payload: UpdateProfilePayload): Promise<User> => {
    const updatedUser = await authApi.updateProfile(payload);
    const merged = (user ? { ...user, ...updatedUser } : updatedUser) as User;
    await TokenStorage.setUserProfile(merged);
    setUser(merged);
    return merged;
  };

  const logout = async (): Promise<void> => {
    try {
      await authApi.logout();
    } finally {
      await TokenStorage.clearTokens();
      setUser(null);
      setAuthStatus('unauthenticated');
      router.replace('/');
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    isProfileCompleted: isProfileComplete(user),
    authStatus,
    login,
    register,
    updateProfile,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
