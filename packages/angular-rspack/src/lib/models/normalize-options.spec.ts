import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { AngularRspackPluginOptions } from './angular-rspack-plugin-options';
import { normalizeOptions, validateOutputMode } from './normalize-options';

describe('validateOutputMode', () => {
  const ssr = { entry: './src/server.ts' };

  it('should accept an undefined output mode', () => {
    expect(() => validateOutputMode(undefined, undefined, false)).not.toThrow();
  });

  it('should reject the "static" output mode', () => {
    expect(() =>
      validateOutputMode('static', './src/main.server.ts', ssr)
    ).toThrow('Only "server" is currently supported');
  });

  it('should require the "server" option for the "server" output mode', () => {
    expect(() => validateOutputMode('server', undefined, ssr)).toThrow(
      'The "server" option is required'
    );
  });

  it('should require the "ssr.entry" option for the "server" output mode', () => {
    expect(() =>
      validateOutputMode('server', './src/main.server.ts', false)
    ).toThrow('The "ssr.entry" option is required');
  });

  it('should accept the "server" output mode with server and ssr entry', () => {
    expect(() =>
      validateOutputMode('server', './src/main.server.ts', ssr)
    ).not.toThrow();
  });
});

describe('normalizeOptions', () => {
  let root: string;
  let baseOptions: AngularRspackPluginOptions;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'normalize-options-'));
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(join(root, 'src', 'main.server.ts'), '');
    await writeFile(join(root, 'src', 'server.ts'), '');
    baseOptions = {
      root,
      index: './src/index.html',
      browser: './src/main.ts',
      tsConfig: './tsconfig.app.json',
    };
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('should not consider the prerender and appShell options when an output mode is set', async () => {
    const normalized = await normalizeOptions({
      ...baseOptions,
      outputMode: 'server',
      server: './src/main.server.ts',
      ssr: { entry: './src/server.ts' },
      prerender: true,
      appShell: true,
    });

    expect(normalized.outputMode).toBe('server');
    expect(normalized.prerender).toBe(false);
    expect(normalized.appShell).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      'The "prerender" option is not considered when "outputMode" is specified.'
    );
    expect(warnSpy).toHaveBeenCalledWith(
      'The "appShell" option is not considered when "outputMode" is specified.'
    );
  });

  it('should warn that build-time prerendering is not performed under an output mode', async () => {
    await normalizeOptions({
      ...baseOptions,
      outputMode: 'server',
      server: './src/main.server.ts',
      ssr: { entry: './src/server.ts' },
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Build-time prerendering of server routes')
    );
  });

  it('should reject an output mode when the server or ssr entry file is missing', async () => {
    await expect(
      normalizeOptions({
        ...baseOptions,
        outputMode: 'server',
        server: './src/does-not-exist.server.ts',
        ssr: { entry: './src/server.ts' },
      })
    ).rejects.toThrow(
      'The "outputMode" option is set to "server", but "./src/does-not-exist.server.ts" does not exist.'
    );
  });

  it('should keep the prerender and appShell options without an output mode', async () => {
    const normalized = await normalizeOptions({
      ...baseOptions,
      prerender: true,
      appShell: true,
    });

    expect(normalized.outputMode).toBeUndefined();
    expect(normalized.prerender).toBe(true);
    expect(normalized.appShell).toBe(true);
  });

  it('should reject the "security.autoCsp" option', async () => {
    await expect(
      normalizeOptions({ ...baseOptions, security: { autoCsp: true } })
    ).rejects.toThrow('The "security.autoCsp" option is not supported');
  });

  it('should carry the "security.allowedHosts" option through', async () => {
    const normalized = await normalizeOptions({
      ...baseOptions,
      security: { allowedHosts: ['example.com'] },
    });

    expect(normalized.security).toEqual({ allowedHosts: ['example.com'] });
  });
});
