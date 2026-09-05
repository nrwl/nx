import type { Mock } from 'vitest';
import {
  getDaemonSocketPath,
  getForkedProcessSocketPath,
  getNxConsoleSocketPath,
  getPluginSocketPath,
  InvalidSocketDirConfigured,
  resetSocketDirWarningsForTesting,
} from './tmp-dir';
import {
  resolveDaemonSocketPath,
  resolveForkedProcessSocketPath,
  resolveNxConsoleSocketPath,
  resolvePluginSocketPath,
  type SocketDirDetails,
} from '../native';
import { logger } from '../utils/logger';
import { isSandbox } from '../utils/is-sandbox';
import { workspaceRoot } from '../utils/workspace-root';
import { NX_HOME_TMP_DIR, NX_TMP_DIR } from '../utils/nx-tmp-dir';

// Where the socket directory *is* now lives in native/utils/socket_path.rs and
// is covered by that crate's tests. What is left here is the reporting: which
// sentence a resolution produces, which of them fire once per process, and what
// `assertValidSocketPath` can read back afterwards. So the resolvers are stubbed
// and the tests stage their return value.
vi.mock('../native', async () => ({
  ...(await vi.importActual('../native')),
  resolveDaemonSocketPath: vi.fn(),
  resolveForkedProcessSocketPath: vi.fn(),
  resolvePluginSocketPath: vi.fn(),
  resolveNxConsoleSocketPath: vi.fn(),
}));

vi.mock('../utils/is-sandbox', () => ({
  isSandbox: vi.fn(() => false),
}));

// The source lazy-requires the logger (CJS channel), which vi.mock cannot
// intercept. Mutate the CJS instance and return it from the factory so both
// module channels share the same mocked object.
vi.mock('../utils/logger', () => {
  const cjs = require('../utils/logger');
  cjs.logger.verbose = vi.fn();
  cjs.logger.warn = vi.fn();
  return cjs;
});

const SOCKET_DIR = '/tmp/.nx/501/sockets/abc123';
const SOCKET_PATH = `${SOCKET_DIR}/d.sock`;

/** A resolution that succeeded on the preferred root. */
const resolved = (
  overrides: Partial<SocketDirDetails> = {}
): SocketDirDetails => ({
  path: SOCKET_PATH,
  dir: SOCKET_DIR,
  tooLong: false,
  usedWorkspaceFallback: false,
  remedies: [],
  ...overrides,
});

const stage = (details: SocketDirDetails) => {
  for (const resolver of [
    resolveDaemonSocketPath,
    resolveForkedProcessSocketPath,
    resolvePluginSocketPath,
    resolveNxConsoleSocketPath,
  ]) {
    (resolver as Mock).mockReturnValue(details);
  }
};

describe('socket directories', () => {
  beforeEach(() => {
    stage(resolved());
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Both fallback warnings are latched once per process, so without this only
    // the first test staging either one would see it.
    resetSocketDirWarningsForTesting();
    (isSandbox as Mock).mockReturnValue(false);
  });

  describe('resolution', () => {
    it('should resolve each socket for the current workspace', () => {
      expect(getDaemonSocketPath()).toBe(SOCKET_PATH);
      expect(getPluginSocketPath('123-0-abcd')).toBe(SOCKET_PATH);
      expect(getForkedProcessSocketPath('7')).toBe(SOCKET_PATH);

      expect(resolveDaemonSocketPath).toHaveBeenCalledWith(workspaceRoot);
      expect(resolvePluginSocketPath).toHaveBeenCalledWith(
        workspaceRoot,
        '123-0-abcd'
      );
      expect(resolveForkedProcessSocketPath).toHaveBeenCalledWith(
        workspaceRoot,
        '7'
      );
    });

    it('should resolve the console socket for another workspace and environment', () => {
      // Nx Console runs in the editor's extension host rather than inside the
      // workspace, and loads a workspace `.env` into a copy rather than into
      // process.env. Both have to reach the resolver or the two ends disagree
      // exactly when the workspace configures a socket dir.
      const env = { NX_SOCKET_DIR: '/tmp/configured' };

      getNxConsoleSocketPath('/workspace/one', env);

      expect(resolveNxConsoleSocketPath).toHaveBeenCalledWith(
        '/workspace/one',
        env
      );
    });

    it('should resolve the console socket for the current workspace by default', () => {
      getNxConsoleSocketPath();

      expect(resolveNxConsoleSocketPath).toHaveBeenCalledWith(
        workspaceRoot,
        undefined
      );
    });

    it('should report nothing when the preferred root was used', () => {
      getDaemonSocketPath();

      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.verbose).not.toHaveBeenCalled();
    });
  });

  describe('a path the platform will not bind', () => {
    it('should refuse it rather than let the bind fail', () => {
      // Every socket goes through this, including the Nx Console one, which is
      // both the longest leaf and the one with no Nx process on the other end
      // to report a bind error.
      stage(resolved({ tooLong: true }));

      expect(() => getNxConsoleSocketPath()).toThrow(
        'exceeds the maximum socket length'
      );
    });

    it('should advise a shorter NX_SOCKET_DIR when the user has not set one', () => {
      stage(resolved({ tooLong: true }));

      expect(() => getDaemonSocketPath()).toThrow(
        'Set NX_SOCKET_DIR to a shorter path'
      );
    });

    it('should not blame a fallback that did not happen', () => {
      stage(resolved({ tooLong: true }));

      try {
        getDaemonSocketPath();
        throw new Error('should have thrown');
      } catch (e) {
        expect((e as Error).message).not.toContain('Nx fell back');
        expect((e as Error).cause).toBeUndefined();
      }
    });

    it('should attach why the default directory was rejected', () => {
      stage(
        resolved({
          tooLong: true,
          usedWorkspaceFallback: true,
          refusalDetails: '/tmp/.nx is owned by uid 0, not by you',
        })
      );

      try {
        getDaemonSocketPath();
        throw new Error('should have thrown');
      } catch (e) {
        expect((e as Error).message).toContain('Nx fell back');
        expect((e as Error).message).toContain('--verbose');
        expect(((e as Error).cause as Error).message).toContain(
          '/tmp/.nx is owned by uid 0, not by you'
        );
      }
    });

    it('should stop advising a shorter path once the configured one was refused', () => {
      // They already set one, and it was rejected for a reason that has nothing
      // to do with length. Repeating the generic advice sends them in a circle.
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      stage(
        resolved({
          tooLong: true,
          usedWorkspaceFallback: true,
          refusedConfiguredDir: '/mnt/read-only/sockets',
          refusalError: '/mnt/read-only/sockets could not be created (EROFS)',
        })
      );

      try {
        getDaemonSocketPath();
        throw new Error('should have thrown');
      } catch (e) {
        const message = (e as Error).message;
        expect(message).toContain('/mnt/read-only/sockets');
        expect(message).toContain('could not be used');
        expect(message).not.toContain('Set NX_SOCKET_DIR to a shorter path');
      }
    });
  });

  describe('a directory Nx will not accept', () => {
    it.each([
      [
        'shared-with-other-users',
        'shared with the other users on this machine',
      ],
      ['os-temp-root', 'is the operating system temp directory'],
      ['nx-managed', 'keeps its own runtime state in'],
    ])('should throw for %s', (invalidReason, sentence) => {
      stage(resolved({ path: '/tmp', dir: '/tmp', invalidReason }));

      expect(() => getDaemonSocketPath()).toThrow(InvalidSocketDirConfigured);
      expect(() => getDaemonSocketPath()).toThrow(sentence);
    });

    it('should carry the directory and the reason on the error', () => {
      // The reason is not decorative: it decides which of the three sentences a
      // user is told, and telling someone their own 0700 directory lets a local
      // attacker execute code would be false.
      stage(
        resolved({ path: '/tmp', dir: '/tmp', invalidReason: 'os-temp-root' })
      );

      try {
        getDaemonSocketPath();
        throw new Error('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(InvalidSocketDirConfigured);
        expect((e as InvalidSocketDirConfigured).dir).toBe('/tmp');
        expect((e as InvalidSocketDirConfigured).reason).toBe('os-temp-root');
      }
    });
  });

  describe('a refused NX_SOCKET_DIR', () => {
    const refused = () =>
      resolved({
        path: '/workspace/.nx/workspace-data/d/d.sock',
        dir: '/workspace/.nx/workspace-data/d',
        refusedConfiguredDir: '/tmp/too/deep',
        refusalError: '/tmp/too/deep is owned by uid 0, not by you',
        usedWorkspaceFallback: true,
      });

    it('should never be swapped out silently', () => {
      // The substitute is longer and would otherwise resurface as a length
      // complaint about a path the user never set.
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      stage(refused());

      getDaemonSocketPath();

      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('/tmp/too/deep is owned by uid 0, not by you')
      );
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('/workspace/.nx/workspace-data/d')
      );
      warn.mockRestore();
    });

    it('should warn once, since one command resolves several socket dirs', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      stage(refused());

      getDaemonSocketPath();
      getPluginSocketPath('1');

      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    });
  });

  describe('the workspace fallback', () => {
    const fellBack = (overrides: Partial<SocketDirDetails> = {}) =>
      resolved({
        path: '/workspace/.nx/workspace-data/d/d.sock',
        dir: '/workspace/.nx/workspace-data/d',
        attemptedDir: '/tmp/.nx/501/sockets/abc123',
        usedWorkspaceFallback: true,
        refusalDetails: '/tmp/.nx is owned by uid 0, not by you',
        ...overrides,
      });

    it('should warn rather than only log, since it is where the length budget trips', () => {
      // The workspace path grows with checkout depth, and an allowlist scoped to
      // Nx's usual roots no longer covers it.
      stage(fellBack());

      getDaemonSocketPath();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('/workspace/.nx/workspace-data/d')
      );
      expect(logger.verbose).toHaveBeenCalledWith(
        expect.stringContaining('/tmp/.nx/501/sockets/abc123'),
        expect.any(Error)
      );
    });

    it('should warn once per process', () => {
      // Neither accessor is memoized and one CLI process resolves several, so
      // without the latch a single command repeats this many times.
      stage(fellBack());

      getDaemonSocketPath();
      getPluginSocketPath('1');

      expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    it('should pass on the advice for what was refused', () => {
      stage(
        fellBack({
          remedies: ['Run `chmod 0700 /tmp/.nx/501` and try again;'],
        })
      );

      getDaemonSocketPath();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Run `chmod 0700 /tmp/.nx/501` and try again;')
      );
    });

    it('should name the roots a sandbox allowlist would have to cover', () => {
      (isSandbox as Mock).mockReturnValue(true);
      stage(fellBack());

      getDaemonSocketPath();

      const warned = (logger.warn as Mock).mock.calls[0][0];
      expect(warned).toContain(NX_TMP_DIR);
      if (NX_HOME_TMP_DIR) {
        expect(warned).toContain(NX_HOME_TMP_DIR);
      }
    });

    it('should not mention a sandbox when there is none', () => {
      stage(fellBack());

      getDaemonSocketPath();

      expect((logger.warn as Mock).mock.calls[0][0]).not.toContain(
        'sandbox allowlist'
      );
    });

    it('should say why the other roots were rejected when asked', () => {
      stage(fellBack());

      getDaemonSocketPath();

      expect((logger.verbose as Mock).mock.calls[0][1].message).toContain(
        '/tmp/.nx is owned by uid 0, not by you'
      );
      expect((logger.warn as Mock).mock.calls[0][0]).toContain(
        'Run with --verbose'
      );
    });
  });

  describe('a demotion to a later root', () => {
    const demoted = (overrides: Partial<SocketDirDetails> = {}) =>
      resolved({
        path: '/home/me/.nx/sockets/abc123/d.sock',
        dir: '/home/me/.nx/sockets/abc123',
        demotedFrom: '/tmp/.nx/501/sockets',
        refusalDetails: '/tmp/.nx is owned by uid 0, not by you',
        ...overrides,
      });

    it('should be verbose rather than a warning, since nothing failed', () => {
      stage(demoted());

      getDaemonSocketPath();

      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.verbose).toHaveBeenCalledWith(
        expect.stringContaining('/tmp/.nx/501/sockets')
      );
    });

    it('should name the skipped root if the demoted path then proves too long', () => {
      // Without this the length failure reads as though the user chose the path.
      stage(demoted({ tooLong: true }));

      try {
        getDaemonSocketPath();
        throw new Error('should have thrown');
      } catch (e) {
        expect((e as Error).message).toContain('Nx fell back');
        expect(((e as Error).cause as Error).message).toContain(
          '/tmp/.nx/501/sockets'
        );
      }
    });
  });
});
