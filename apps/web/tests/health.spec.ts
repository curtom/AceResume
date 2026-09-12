import { describe, expect, it, vi } from 'vitest';
import { getApiErrorMessage } from '../src/api/http';

vi.mock('axios', () => ({
  default: {
    create: () => ({
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
      post: vi.fn(),
      request: vi.fn(),
    }),
    isAxiosError: () => false,
  },
}));

describe('getApiErrorMessage', () => {
  it('does not expose raw unknown errors', () => {
    expect(getApiErrorMessage(new Error('connection password=secret'))).toBe(
      '暂时无法连接服务，请稍后重试。',
    );
  });

  it('shows a local schema validation message', () => {
    expect(getApiErrorMessage({ issues: [{ message: '学校不能为空' }] })).toBe('学校不能为空');
  });
});
