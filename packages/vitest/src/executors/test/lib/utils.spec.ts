import { ExecutorContext, workspaceRoot } from '@nx/devkit';
import { isAbsolute, join } from 'path';
import { getOptions, resolveReportsDirectory } from './utils';
import { normalizeViteConfigFilePath } from '../../../utils/options-utils';
import {
  loadViteDynamicImport,
  loadVitestDynamicImport,
} from '../../../utils/executor-utils';

jest.mock('../../../utils/options-utils', () => ({
  normalizeViteConfigFilePath: jest.fn(),
}));
jest.mock('../../../utils/executor-utils', () => ({
  loadViteDynamicImport: jest.fn(),
  loadVitestDynamicImport: jest.fn(),
}));

describe('getOptions', () => {
  const context = {
    root: '/root',
    cwd: '/root',
    projectName: 'my-lib',
  } as unknown as ExecutorContext;
  let loadConfigFromFile: jest.Mock;

  beforeEach(() => {
    (normalizeViteConfigFilePath as jest.Mock).mockReturnValue(
      '/root/libs/my-lib/vitest.config.ts'
    );
    loadConfigFromFile = jest.fn(async () => ({
      path: '/root/libs/my-lib/vitest.config.ts',
      config: { test: { reporters: ['default'] } },
    }));
    (loadViteDynamicImport as jest.Mock).mockResolvedValue({
      loadConfigFromFile,
    });
    (loadVitestDynamicImport as jest.Mock).mockResolvedValue({
      parseCLI: jest.fn(() => ({ filter: [], options: {} })),
    });
  });

  afterEach(() => jest.clearAllMocks());

  it('should forward the configured mode so vitest reloads the config with it', async () => {
    const result = await getOptions(
      { configFile: 'vitest.config.ts', mode: 'ci' },
      context,
      'libs/my-lib'
    );

    // pre-load and the mode handed to vitest must match, otherwise mode-based
    // config branches resolve inconsistently between the two loads.
    expect(loadConfigFromFile).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'ci' }),
      '/root/libs/my-lib/vitest.config.ts'
    );
    expect(result.mode).toBe('ci');
  });

  it('should default the forwarded mode to "test" when none is provided', async () => {
    const result = await getOptions(
      { configFile: 'vitest.config.ts' },
      context,
      'libs/my-lib'
    );

    expect(loadConfigFromFile).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'test' }),
      '/root/libs/my-lib/vitest.config.ts'
    );
    expect(result.mode).toBe('test');
  });

  it('should default the mode to runMode so benchmark config branches still apply', async () => {
    const result = await getOptions(
      { configFile: 'vitest.config.ts', runMode: 'benchmark' },
      context,
      'libs/my-lib'
    );

    expect(loadConfigFromFile).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'benchmark' }),
      '/root/libs/my-lib/vitest.config.ts'
    );
    expect(result.mode).toBe('benchmark');
  });

  it('should let an explicit mode take precedence over runMode', async () => {
    const result = await getOptions(
      { configFile: 'vitest.config.ts', mode: 'ci', runMode: 'benchmark' },
      context,
      'libs/my-lib'
    );

    expect(loadConfigFromFile).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'ci' }),
      '/root/libs/my-lib/vitest.config.ts'
    );
    expect(result.mode).toBe('ci');
  });
});

describe('resolveReportsDirectory', () => {
  it('should resolve a workspace-root-relative path to absolute', () => {
    // After Nx's resolveNxTokensInOptions processes "{workspaceRoot}/coverage/apps/my-app",
    // the value becomes "coverage/apps/my-app" (workspace-root-relative).
    const result = resolveReportsDirectory('coverage/apps/my-app');
    expect(isAbsolute(result)).toBe(true);
    expect(result).toBe(join(workspaceRoot, 'coverage/apps/my-app'));
  });

  it('should return absolute paths unchanged', () => {
    const absolutePath = '/tmp/coverage/my-app';
    const result = resolveReportsDirectory(absolutePath);
    expect(result).toBe(absolutePath);
  });

  it('should resolve a simple relative path to absolute', () => {
    // A plain relative path like "coverage" (no tokens originally)
    // also gets resolved against workspace root
    const result = resolveReportsDirectory('coverage');
    expect(isAbsolute(result)).toBe(true);
    expect(result).toBe(join(workspaceRoot, 'coverage'));
  });
});
