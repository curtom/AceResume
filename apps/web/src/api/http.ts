import axios from 'axios';
import { type ApiError } from '@aceresume/contracts';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

if (!apiBaseUrl) {
  throw new Error(
    'Missing VITE_API_BASE_URL. Copy .env.example to .env before starting the web app.',
  );
}

export const http = axios.create({ baseURL: apiBaseUrl, withCredentials: true });

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiError>(error) && error.response?.data)
    return error.response.data.message;
  return '暂时无法连接服务，请稍后重试。';
}
