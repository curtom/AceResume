import { describe, expect, it } from 'vitest';
import { redact } from '../src/common/structured-logger.js';

describe('redact', () => {
  it('removes sensitive field values from structured logs', () => {
    expect(redact({ token: 'secret', nested: { password: 'hidden', id: 'safe' } })).toEqual({
      token: '[REDACTED]',
      nested: { password: '[REDACTED]', id: 'safe' },
    });
  });
});
