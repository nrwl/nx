import { isSandbox } from './is-sandbox';

describe('isSandbox', () => {
  const envVars = [
    'SANDBOX_RUNTIME',
    'GEMINI_SANDBOX',
    'CODEX_SANDBOX',
    'CURSOR_SANDBOX',
  ];

  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of envVars) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envVars) {
      if (originalEnv[key] !== undefined) {
        process.env[key] = originalEnv[key];
      } else {
        delete process.env[key];
      }
    }
  });

  it('should return false when no sandbox env vars are set', () => {
    expect(isSandbox()).toBe(false);
  });

  it.each(envVars)('should return true when %s is set', (envVar: string) => {
    process.env[envVar] = 'true';
    expect(isSandbox()).toBe(true);
  });
});
