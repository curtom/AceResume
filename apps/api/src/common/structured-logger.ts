import type { LoggerService } from '@nestjs/common';

const sensitiveKey = /password|secret|token|authorization|cookie/i;

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        sensitiveKey.test(key) ? '[REDACTED]' : redact(nestedValue),
      ]),
    );
  }
  return value;
}

export class StructuredLogger implements LoggerService {
  log(message: unknown, ...optional: unknown[]): void {
    this.write('log', message, optional);
  }

  error(message: unknown, ...optional: unknown[]): void {
    this.write('error', message, optional);
  }

  warn(message: unknown, ...optional: unknown[]): void {
    this.write('warn', message, optional);
  }

  debug(message: unknown, ...optional: unknown[]): void {
    this.write('debug', message, optional);
  }

  verbose(message: unknown, ...optional: unknown[]): void {
    this.write('verbose', message, optional);
  }

  fatal(message: unknown, ...optional: unknown[]): void {
    this.write('fatal', message, optional);
  }

  private write(level: string, message: unknown, optional: unknown[]): void {
    process.stdout.write(`${JSON.stringify(redact({ level, message, optional }))}\n`);
  }
}
