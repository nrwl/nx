import { ExecutorContext, workspaceRoot } from '@nx/devkit';
import { isAbsolute, join } from 'path';
import { getOptions, resolveReportsDirectory } from './utils';
import { normalizeViteConfigFilePath } from '../../../utils/options-utils';
import {
  loadViteDynamicImport,
  loadVitestDynamicImport,
} from '../../../utils/executor-utils';
import { isCI } from '@nx/devkit/internal';

jest.mock('../../../utils/options-utils', () => ({
  normalizeViteConfigFilePath: jest.fn(),
}));
jest.mock('../../../utils/executor-utils', () => ({
  loadViteDynamicImport: jest.fn(),
  loadVitestDynamicImport: jest.fn(),
}));
jest.mock('nx/src/devkit-internals', () => ({ isCI: jest.fn() }));

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
    (isCI as jest.Mock).mockReturnValue(false);
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

  describe('watch resolution', () => {
    const mockParsedWatch = (watch: boolean | undefined) => {
      (loadVitestDynamicImport as jest.Mock).mockResolvedValue({
        parseCLI: jest.fn(() => ({
          filter: [],
          options: watch === undefined ? {} : { watch },
        })),
      });
    };
    const mockConfigWatch = (watch: boolean | undefined) => {
      loadConfigFromFile.mockResolvedValue({
        path: '/root/libs/my-lib/vitest.config.ts',
        config: {
          test: {
            reporters: ['default'],
            ...(watch === undefined ? {} : { watch }),
          },
        },
      });
    };
    const mockParsedUi = () => {
      (loadVitestDynamicImport as jest.Mock).mockResolvedValue({
        parseCLI: jest.fn(() => ({ filter: [], options: { ui: true } })),
      });
    };
    const withEnv = async (
      ci: boolean,
      tty: boolean,
      fn: () => Promise<void>
    ) => {
      (isCI as jest.Mock).mockReturnValue(ci);
      const prevTty = process.stdin.isTTY;
      Object.defineProperty(process.stdin, 'isTTY', {
        value: tty,
        configurable: true,
      });
      try {
        await fn();
      } finally {
        Object.defineProperty(process.stdin, 'isTTY', {
          value: prevTty,
          configurable: true,
        });
      }
    };
    const callGetOptions = () =>
      getOptions({ configFile: 'vitest.config.ts' }, context, 'libs/my-lib');

    it('should default watch to false when neither CLI nor config set it', async () => {
      const result = await callGetOptions();
      expect(result.watch).toBe(false);
    });

    it('should honor config test.watch when no CLI --watch is passed', async () => {
      mockConfigWatch(true);
      const result = await callGetOptions();
      expect(result.watch).toBe(true);
    });

    it('should let an explicit CLI --watch override the config', async () => {
      mockParsedWatch(true);
      mockConfigWatch(false);
      const result = await callGetOptions();
      expect(result.watch).toBe(true);
    });

    it('should let an explicit CLI --no-watch override config test.watch: true', async () => {
      mockParsedWatch(false);
      mockConfigWatch(true);
      const result = await callGetOptions();
      expect(result.watch).toBe(false);
    });

    it('should watch on --ui in an interactive terminal (not CI)', async () => {
      mockParsedUi();
      await withEnv(false, true, async () => {
        const result = await callGetOptions();
        expect(result.watch).toBe(true);
      });
    });

    it('should not watch on --ui in CI', async () => {
      mockParsedUi();
      await withEnv(true, true, async () => {
        const result = await callGetOptions();
        expect(result.watch).toBe(false);
      });
    });

    it('should not watch on --ui when not attached to a TTY', async () => {
      mockParsedUi();
      await withEnv(false, false, async () => {
        const result = await callGetOptions();
        expect(result.watch).toBe(false);
      });
    });

    it('should let config test.watch: false override --ui', async () => {
      mockParsedUi();
      mockConfigWatch(false);
      await withEnv(false, true, async () => {
        const result = await callGetOptions();
        expect(result.watch).toBe(false);
      });
    });
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
