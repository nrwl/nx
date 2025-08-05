import { afterEach, beforeEach, describe, expect, vi, it } from 'vitest';
import {
  isPresent,
  isUsingWindows,
  maxWorkers,
  normalizeQuotes,
  parseMaxWorkers,
} from './utils';
import * as nodeOSModule from 'node:os';
import { ENV_NG_BUILD_MAX_WORKERS } from './constants.ts';
import * as osModule from 'node:os';

vi.mock('node:os');

describe('isPresent', () => {
  it('should return true if the variable is a non empty string', () => {
    expect(isPresent('not-a-number')).toBe(true);
  });

  it('should return true if the variable is a non empty string and parseable to number', () => {
    expect(isPresent('4')).toBe(true);
  });

  it('should return false if the variable is an empty string', () => {
    expect(isPresent('')).toBe(false);
  });

  it('should return false if the variable is an empty string after trim', () => {
    expect(isPresent('   ')).toBe(false);
  });

  it('should return false if the variable is a non empty string', () => {
    expect(isPresent(undefined)).toBe(false);
  });
});

describe('parseMaxWorkers', () => {
  it('should parse max worker as number if the string is parsable to number', () => {
    expect(parseMaxWorkers('4')).toBe(4);
  });

  it('should return null if the string is empty', () => {
    expect(parseMaxWorkers('')).toBeNull();
  });

  it('should return null if the string is not parsable to number', () => {
    expect(parseMaxWorkers('test')).toBeNull();
  });

  it.each(['0', '0.3', '-1'])(
    'should return null if the string is parsable to number but <=0',
    () => {
      expect(parseMaxWorkers('0')).toBeNull();
    }
  );
});

describe('maxWorkers', () => {
  const availableParallelismSpy = vi.spyOn(
    nodeOSModule,
    'availableParallelism'
  );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NODE_ENV', '');
  });

  it('should return the parsed value from env var "ENV_NG_BUILD_MAX_WORKERS" if set', () => {
    vi.stubEnv(ENV_NG_BUILD_MAX_WORKERS, '42');
    expect(maxWorkers()).toBe(42);
    expect(availableParallelismSpy).not.toHaveBeenCalled();
  });

  it('should return availableParallelism() - 1 if env var is not set', () => {
    vi.stubEnv(ENV_NG_BUILD_MAX_WORKERS, '');
    availableParallelismSpy.mockReturnValue(3);

    expect(maxWorkers()).toBe(2); // availableParallelism() - 1
    expect(availableParallelismSpy).toHaveBeenCalledTimes(1);
  });

  it('should return at least 1 worker even if availableParallelism is low', () => {
    vi.stubEnv(ENV_NG_BUILD_MAX_WORKERS, '');
    availableParallelismSpy.mockReturnValue(1);

    expect(maxWorkers()).toBe(1); // max(availableParallelism - 1, 1)
    expect(availableParallelismSpy).toHaveBeenCalledTimes(1);
  });

  it('should cap max workers at 4 if availableParallelism is high', () => {
    vi.stubEnv(ENV_NG_BUILD_MAX_WORKERS, '');
    availableParallelismSpy.mockReturnValue(10);

    expect(maxWorkers()).toBe(4); // Min(4, max(availableParallelism - 1, 1))
    expect(availableParallelismSpy).toHaveBeenCalledTimes(1);
  });
});

describe('normalizeQuotes', () => {
  it.each(["'", '"', '`'])('should remove (%s) quotes if given', (quote) => {
    expect(normalizeQuotes(`${quote}test${quote}`)).toBe('test');
  });
});

describe('isUsingWindows', async () => {
  const platformSpy = vi.spyOn(osModule, 'platform');

  beforeEach(() => {
    platformSpy.mockClear();
    // platformSpy.mockReturnValue('linux');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return true if the platform is win32', () => {
    platformSpy.mockReturnValue('win32');
    expect(isUsingWindows()).toBe(true);
    expect(platformSpy).toHaveBeenCalledTimes(1);
  });

  it.each([
    'aix',
    'android',
    'darwin',
    'freebsd',
    'haiku',
    'linux',
    'openbsd',
    'sunos',
    'cygwin',
    'netbsd',
  ] as const)('should return false if platform is %s', (platform) => {
    platformSpy.mockReturnValue(platform);
    expect(isUsingWindows()).toBe(false);
    expect(platformSpy).toHaveBeenCalledTimes(1);
  });
});
