import { describe, expect, it, vi } from 'vitest';
import { getApiErrorMessage } from '../src/api/http';

vi.mock('axios', () => ({
  default: {
    create: () => ({}),
    isAxiosError: () => false,
  },
}));

describe('getApiErrorMessage', () => {
  it('does not expose raw unknown errors', () => {
    expect(getApiErrorMessage(new Error('connection password=secret'))).toBe(
      '暂时无法连接服务，请稍后重试。',
    );
  });
});
