import {
  AuthSessionSchema,
  MessageDataSchema,
  UserSummarySchema,
  type AuthSession,
  type LoginRequest,
  type RegisterRequest,
  type UserSummary,
} from '@aceresume/contracts';
import { http } from './http';

function readMessage(value: unknown): string {
  if (!value || typeof value !== 'object' || !('data' in value))
    throw new Error('Invalid API response.');
  return MessageDataSchema.parse(value.data).message;
}
export async function register(input: RegisterRequest): Promise<string> {
  return readMessage((await http.post('/auth/register', input)).data);
}
export async function verifyEmail(token: string): Promise<string> {
  return readMessage((await http.post('/auth/verify-email', { token })).data);
}
export async function login(input: LoginRequest): Promise<AuthSession> {
  return AuthSessionSchema.parse((await http.post('/auth/login', input)).data.data);
}
export async function refresh(): Promise<AuthSession> {
  return AuthSessionSchema.parse((await http.post('/auth/refresh')).data.data);
}
export async function logout(): Promise<void> {
  await http.post('/auth/logout');
}
export async function forgotPassword(email: string): Promise<string> {
  return readMessage((await http.post('/auth/forgot-password', { email })).data);
}
export async function resetPassword(token: string, password: string): Promise<string> {
  return readMessage((await http.post('/auth/reset-password', { token, password })).data);
}
export async function getMe(): Promise<UserSummary> {
  return UserSummarySchema.parse((await http.get('/auth/me')).data.data);
}
