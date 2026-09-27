import axios, { type InternalAxiosRequestConfig } from 'axios';
import { AuthSessionSchema, type ApiError, type AuthSession } from '@aceresume/contracts';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

if (!apiBaseUrl) {
  throw new Error(
    'Missing VITE_API_BASE_URL. Copy .env.example to .env before starting the web app.',
  );
}

export const http = axios.create({ baseURL: apiBaseUrl, withCredentials: true });
const refreshClient = axios.create({ baseURL: apiBaseUrl, withCredentials: true });
let accessToken: string | null = null;
let refreshPromise: Promise<AuthSession> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}
http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});
http.interceptors.response.use(undefined, async (error: unknown) => {
  if (
    !axios.isAxiosError(error) ||
    error.response?.status !== 401 ||
    String(error.config?.url).includes('/auth/')
  )
    throw error;
  refreshPromise ??= refreshClient
    .post('/auth/refresh')
    .then((response) => AuthSessionSchema.parse(response.data.data))
    .catch((refreshError: unknown) => {
      setAccessToken(null);
      throw refreshError;
    })
    .finally(() => {
      refreshPromise = null;
    });
  const session = await refreshPromise;
  setAccessToken(session.accessToken);
  if (!error.config) throw error;
  return http.request(error.config);
});

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiError>(error) && error.response?.data)
    return error.response.data.message;
  if (
    typeof error === 'object' &&
    error !== null &&
    'issues' in error &&
    Array.isArray(error.issues) &&
    typeof error.issues[0]?.message === 'string'
  )
    return error.issues[0].message;
  return '暂时无法连接服务，请稍后重试。';
}

export function getApiErrorCode(error: unknown): string | undefined {
  return axios.isAxiosError<ApiError>(error) ? error.response?.data.code : undefined;
}
