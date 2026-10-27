import {
  chmodSync,
  lstatSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'fs';
import { join } from 'path';
import { withEnvironmentVariables } from '../internal-testing-utils/with-environment';

const state = vi.hoisted(() => {
  const fs = require('node:fs') as typeof import('node:fs');
  const os = require('node:os') as typeof import('node:os');
  const path = require('node:path') as typeof import('node:path');
  return {
    dir: fs.mkdtempSync(path.join(os.tmpdir(), 'nx-ai-clone-env-')),
    execSync: vi.fn(),
  };
});

vi.mock('os', async () => ({
  ...(await vi.importActual<typeof import('os')>('os')),
  tmpdir: () => state.dir,
}));

vi.mock('../utils/nx-tmp-dir', () => {
  const path = require('node:path') as typeof import('node:path');
  const shared = path.join(state.dir, '.nx');
  return {
    NX_TMP_DIR: shared,
    NX_USER_TMP_DIR: path.join(shared, 'user'),
  };
});

vi.mock('child_process', () => ({
  execSync: (...args: unknown[]) => state.execSync(...args),
}));

import { tmpdir } from 'os';
import { getAiConfigRepoPath } from './clone-ai-config-repo';

const HEAD = '0123456789abcdef0123456789abcdef01234567';

// Names from `git rev-parse --local-env-vars`, plus GIT_NAMESPACE and one
// indexed GIT_CONFIG_KEY_/GIT_CONFIG_VALUE_ pair.
const REPO_LOCAL_GIT_VARS = [
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_COMMON_DIR',
  'GIT_CONFIG',
  'GIT_CONFIG_COUNT',
  'GIT_CONFIG_KEY_0',
  'GIT_CONFIG_PARAMETERS',
  'GIT_CONFIG_VALUE_0',
  'GIT_DIR',
  'GIT_GRAFT_FILE',
  'GIT_IMPLICIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_NAMESPACE',
  'GIT_NO_REPLACE_OBJECTS',
  'GIT_OBJECT_DIRECTORY',
  'GIT_PREFIX',
  'GIT_REPLACE_REF_BASE',
  'GIT_SHALLOW_FILE',
  'GIT_WORK_TREE',
] as const;

describe('getAiConfigRepoPath', () => {
  const execSyncMock = state.execSync;

  const sharedRoot = join(state.dir, '.nx');
  const userRoot = join(sharedRoot, 'user');
  const cacheDir = join(userRoot, 'nx-ai-agents-config');

  beforeEach(() => {
    for (const dir of [sharedRoot, join(state.dir, 'nx-ai-agents-config')]) {
      rmSync(dir, { recursive: true, force: true });
    }
    state.execSync.mockReset();
    state.execSync.mockImplementation((command: string) => {
      const cmd = String(command);
      if (cmd.includes('ls-remote')) {
        return `${HEAD}\tHEAD\n`;
      }
      const dest = cmd.match(/"([^"]+)"/)?.[1];
      if (dest) {
        mkdirSync(dest, { recursive: true });
        writeFileSync(join(dest, 'README.md'), 'cached');
      }
      return '';
    });
  });

  afterAll(() => {
    rmSync(state.dir, { recursive: true, force: true });
  });

  it('runs git without repository-local variables from the calling hook', () => {
    expect(tmpdir()).toBe(state.dir);

    const hookEnv = Object.fromEntries(
      REPO_LOCAL_GIT_VARS.map((key) => [key, `/caller/${key}`])
    );

    withEnvironmentVariables(
      {
        ...hookEnv,
        GIT_SSH_COMMAND: 'ssh -o BatchMode=yes',
      },
      () => {
        const cloned = getAiConfigRepoPath();
        expect(cloned).toBe(join(cacheDir, HEAD.slice(0, 10)));
        expectGitEnv(execSyncMock);
        expect(
          execSyncMock.mock.calls.map(([command]) => String(command))
        ).toEqual([
          expect.stringContaining('git ls-remote '),
          expect.stringContaining('git clone '),
        ]);

        execSyncMock.mockClear();
        expect(getAiConfigRepoPath()).toBe(cloned);
        expectGitEnv(execSyncMock);
        expect(execSyncMock).toHaveBeenCalledTimes(1);
        expect(String(execSyncMock.mock.calls[0][0])).toContain(
          'git ls-remote '
        );

        expect(process.env.GIT_INDEX_FILE).toBe('/caller/GIT_INDEX_FILE');
      }
    );
  });

  describe.skipIf(process.platform === 'win32')('cache location', () => {
    it('ignores a clone planted in the shared tmp dir', () => {
      const planted = join(state.dir, 'nx-ai-agents-config', HEAD.slice(0, 10));
      mkdirSync(planted, { recursive: true });
      writeFileSync(join(planted, 'README.md'), '<% planted %>');

      const cloned = getAiConfigRepoPath();

      expect(cloned).toBe(join(cacheDir, HEAD.slice(0, 10)));
      expect(
        execSyncMock.mock.calls.some(([c]) => String(c).includes('git clone'))
      ).toBe(true);
    });

    it('keeps the cache in owner-only directories', () => {
      getAiConfigRepoPath();

      for (const dir of [userRoot, cacheDir]) {
        expect(lstatSync(dir).mode & 0o077).toBe(0);
      }
    });

    it('refuses a symlinked user dir', () => {
      const elsewhere = join(state.dir, 'elsewhere');
      const plantedClone = join(
        elsewhere,
        'nx-ai-agents-config',
        HEAD.slice(0, 10)
      );
      mkdirSync(plantedClone, { recursive: true });
      writeFileSync(join(plantedClone, 'README.md'), '<% planted %>');
      mkdirSync(sharedRoot);
      symlinkSync(elsewhere, userRoot);

      expect(() => getAiConfigRepoPath()).toThrow(/symlink/);
      expect(execSyncMock).not.toHaveBeenCalled();
    });

    it('refuses a shared root other users can write to without the sticky bit', () => {
      mkdirSync(sharedRoot);
      chmodSync(sharedRoot, 0o777);

      expect(() => getAiConfigRepoPath()).toThrow(/not sticky/);
      expect(execSyncMock).not.toHaveBeenCalled();
    });
  });
});

function expectGitEnv(execSyncMock: typeof state.execSync) {
  expect(execSyncMock.mock.calls.length).toBeGreaterThan(0);
  for (const [, options] of execSyncMock.mock.calls) {
    const env = options.env as NodeJS.ProcessEnv;
    expect(
      Object.fromEntries(REPO_LOCAL_GIT_VARS.map((key) => [key, env[key]]))
    ).toEqual(
      Object.fromEntries(REPO_LOCAL_GIT_VARS.map((key) => [key, undefined]))
    );
    expect(env.PATH).toBe(process.env.PATH);
    expect(env.GIT_SSH_COMMAND).toBe('ssh -o BatchMode=yes');
  }
}
