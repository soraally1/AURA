import { ApiErrorResponse } from '@/types/auth';

export const ERROR_MESSAGES: Record<string, string> = {
  EMAIL_EXISTS: 'Email sudah terdaftar, silakan gunakan email lain atau login.',
  INVALID_CREDENTIALS: 'Email atau password salah.',
  VALIDATION_ERROR: 'Data yang dimasukkan tidak valid.',
  USER_DISABLED: 'Akun ini telah dinonaktifkan. Hubungi admin.',
  TOO_MANY_ATTEMPTS: 'Terlalu banyak percobaan gagal. Silakan tunggu beberapa saat lagi.',
  TOKEN_REVOKED: 'Sesi telah berakhir karena logout dari perangkat lain.',
  INVALID_REFRESH_TOKEN: 'Sesi login telah berakhir. Silakan masuk kembali.',
  INVALID_TOKEN: 'Sesi tidak valid atau sudah kadaluwarsa. Silakan masuk kembali.',
  UNAUTHORIZED: 'Anda harus masuk terlebih dahulu untuk mengakses fitur ini.',
  PROVIDER_NOT_ALLOWED: 'Metode login ini tidak tersedia untuk akun tersebut.',
  UPSTREAM_ERROR: 'Server autentikasi sedang mengalami gangguan. Coba sesaat lagi.',
};

export function getErrorMessage(error: any): string {
  if (!error) {
    return 'Terjadi kesalahan pada sistem.';
  }

  // Handle structured backend response (either via Axios error.response.data or thrown ApiErrorResponse)
  const responseData: ApiErrorResponse | undefined =
    error.response?.data ?? (error.error ? (error as ApiErrorResponse) : undefined);
  if (responseData?.error) {
    const code = responseData.error.code;
    const backendMessage = responseData.error.message;

    // Specific mapping if available
    if (code && ERROR_MESSAGES[code]) {
      // If code is VALIDATION_ERROR and backend provided a specific field message, prefer backend message
      if (code === 'VALIDATION_ERROR' && backendMessage) {
        return backendMessage;
      }
      return ERROR_MESSAGES[code];
    }

    if (backendMessage) {
      return backendMessage;
    }
  }

  // Timeout errors
  if (error.code === 'ECONNABORTED' || String(error.message || '').includes('timeout')) {
    return 'Koneksi ke server melebihi batas waktu. Silakan coba lagi.';
  }

  // Network or unreachable server errors
  if (error.message === 'Network Error' || !error.response) {
    return 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
  }

  if (typeof error === 'string') {
    return error;
  }

  return error.message || 'Terjadi kesalahan tidak terduga. Silakan coba lagi.';
}
