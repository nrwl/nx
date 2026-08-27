import type { Mock } from 'vitest';
import { join } from 'node:path';
import {
  getDaemonSocketDir,
  getNxConsoleSocketPath,
  getPluginSocketDir,
  getRefusedConfiguredSocketDir,
  getSocketDir,
  getSocketDirFallbackCause,
  InvalidSocketDirConfigured,
  resetSocketDirWarningsForTesting,
} from './tmp-dir';
import {
  resolveDaemonSocketDir,
  resolveNxConsoleSocketPath,
  resolvePluginSocketDir,
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
  resolveDaemonSocketDir: vi.fn(),
  resolvePluginSocketDir: vi.fn(),
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

/** A resolution that succeeded on the preferred root. */
const resolved = (
  overrides: Partial<SocketDirDetails> = {}
): SocketDirDetails => ({
  path: SOCKET_DIR,
  usedWorkspaceFallback: false,
  remedies: [],
  ...overrides,
});

const stage = (details: SocketDirDetails) => {
  (resolveDaemonSocketDir as Mock).mockReturnValue(details);
  (resolvePluginSocketDir as Mock).mockReturnValue(details);
  (resolveNxConsoleSocketPath as Mock).mockReturnValue(details);
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
    it('should resolve the daemon and plugin directories for the current workspace', () => {
      expect(getSocketDir()).toBe(SOCKET_DIR);
      expect(getPluginSocketDir()).toBe(SOCKET_DIR);

      expect(resolveDaemonSocketDir).toHaveBeenCalledWith(workspaceRoot);
      expect(resolvePluginSocketDir).toHaveBeenCalledWith(workspaceRoot);
    });

    it('should keep the daemon socket file name short', () => {
      // The whole path is held to 95 characters by assertValidSocketPath, so
      // the one segment this module chooses is deliberately one letter.
      expect(getDaemonSocketDir()).toBe(join(SOCKET_DIR, 'd.sock'));
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
      getSocketDir();

      expect(getSocketDirFallbackCause()).toBeUndefined();
      expect(getRefusedConfiguredSocketDir()).toBeUndefined();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should clear the previous resolution rather than leak it into the next', () => {
      // assertValidSocketPath reads both accessors immediately after the call
      // that produced the path, and one CLI process resolves several.
      stage(
        resolved({
          path: '/workspace/.nx/workspace-data/d',
          refusedConfiguredDir: '/tmp/refused',
          refusalError: '/tmp/refused exists and is not a directory',
          usedWorkspaceFallback: true,
        })
      );
      getSocketDir();
      expect(getRefusedConfiguredSocketDir()).toBe('/tmp/refused');

      stage(resolved());
      getSocketDir();

      expect(getRefusedConfiguredSocketDir()).toBeUndefined();
      expect(getSocketDirFallbackCause()).toBeUndefined();
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
      stage(resolved({ path: '/tmp', invalidReason }));

      expect(() => getSocketDir()).toThrow(InvalidSocketDirConfigured);
      expect(() => getSocketDir()).toThrow(sentence);
    });

    it('should carry the directory and the reason on the error', () => {
      // The reason is not decorative: it decides which of the three sentences a
      // user is told, and telling someone their own 0700 directory lets a local
      // attacker execute code would be false.
      stage(resolved({ path: '/tmp', invalidReason: 'os-temp-root' }));

      try {
        getSocketDir();
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
        path: '/workspace/.nx/workspace-data/d',
        refusedConfiguredDir: '/tmp/too/deep',
        refusalError: '/tmp/too/deep is owned by uid 0, not by you',
        usedWorkspaceFallback: true,
      });

    it('should never be swapped out silently', () => {
      // The substitute is longer and would otherwise resurface as a length
      // complaint about a path the user never set.
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      stage(refused());

      getSocketDir();

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

      getSocketDir();
      getPluginSocketDir();

      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    });

    it('should be readable back, apart from the fallback cause', () => {
      // So a length error stops telling someone to shorten an NX_SOCKET_DIR
      // that was refused for another reason.
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      stage(refused());

      getSocketDir();

      expect(getRefusedConfiguredSocketDir()).toBe('/tmp/too/deep');
      expect(getSocketDirFallbackCause()).toBeInstanceOf(Error);
    });
  });

  describe('the workspace fallback', () => {
    const fellBack = (overrides: Partial<SocketDirDetails> = {}) =>
      resolved({
        path: '/workspace/.nx/workspace-data/d',
        attemptedDir: '/tmp/.nx/501/sockets/abc123',
        usedWorkspaceFallback: true,
        refusalDetails: '/tmp/.nx is owned by uid 0, not by you',
        ...overrides,
      });

    it('should warn rather than only log, since it is where the length budget trips', () => {
      // The workspace path grows with checkout depth, and an allowlist scoped to
      // Nx's usual roots no longer covers it.
      stage(fellBack());

      getSocketDir();

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

      getSocketDir();
      getPluginSocketDir();

      expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    it('should pass on the advice for what was refused', () => {
      stage(
        fellBack({
          remedies: ['Run `chmod 0700 /tmp/.nx/501` and try again;'],
        })
      );

      getSocketDir();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Run `chmod 0700 /tmp/.nx/501` and try again;')
      );
    });

    it('should name the roots a sandbox allowlist would have to cover', () => {
      (isSandbox as Mock).mockReturnValue(true);
      stage(fellBack());

      getSocketDir();

      const warned = (logger.warn as Mock).mock.calls[0][0];
      expect(warned).toContain(NX_TMP_DIR);
      if (NX_HOME_TMP_DIR) {
        expect(warned).toContain(NX_HOME_TMP_DIR);
      }
    });

    it('should not mention a sandbox when there is none', () => {
      stage(fellBack());

      getSocketDir();

      expect((logger.warn as Mock).mock.calls[0][0]).not.toContain(
        'sandbox allowlist'
      );
    });

    it('should say why the other roots were rejected when asked', () => {
      stage(fellBack());

      getSocketDir();

      expect(getSocketDirFallbackCause()).toBeInstanceOf(Error);
      expect((getSocketDirFallbackCause() as Error).message).toContain(
        '/tmp/.nx is owned by uid 0, not by you'
      );
      expect((logger.warn as Mock).mock.calls[0][0]).toContain(
        'Run with --verbose'
      );
    });
  });

  describe('a demotion to a later root', () => {
    const demoted = () =>
      resolved({
        path: '/home/me/.nx/sockets/abc123',
        demotedFrom: '/tmp/.nx/501/sockets',
        refusalDetails: '/tmp/.nx is owned by uid 0, not by you',
      });

    it('should be verbose rather than a warning, since nothing failed', () => {
      stage(demoted());

      getSocketDir();

      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.verbose).toHaveBeenCalledWith(
        expect.stringContaining('/tmp/.nx/501/sockets')
      );
    });

    it('should still record a cause', () => {
      // assertValidSocketPath keys its "run with --verbose" block off it, and
      // without it a later length failure reads as though the user chose the
      // path.
      stage(demoted());

      getSocketDir();

      expect(getSocketDirFallbackCause()).toBeInstanceOf(Error);
      expect(getRefusedConfiguredSocketDir()).toBeUndefined();
    });
  });
});
