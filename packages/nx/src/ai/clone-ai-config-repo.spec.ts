import { mkdirSync, rmSync, writeFileSync } from 'fs';
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

  beforeEach(() => {
    rmSync(join(state.dir, 'nx-ai-agents-config'), {
      recursive: true,
      force: true,
    });
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
        expect(cloned.startsWith(state.dir)).toBe(true);
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
