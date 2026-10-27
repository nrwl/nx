import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir as osTmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const state = vi.hoisted(() => ({
  tmpRoot: '',
  workspaceRoot: '',
  aiAgent: false,
  stopAfterClone: false,
  cloneDestination: '',
}));
const aiOutput = vi.hoisted(() => ({ records: [] as unknown[] }));

vi.mock('tmp', () => ({
  get tmpdir() {
    return state.tmpRoot;
  },
}));
vi.mock('../../utils/workspace-root', () => ({
  get workspaceRoot() {
    return state.workspaceRoot;
  },
}));
vi.mock('../../native', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../native')>()),
  isAiAgent: () => state.aiAgent,
}));
vi.mock('../../utils/output', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/output')>();
  actual.output.log = () => {};
  return actual;
});
vi.mock('ora', () => ({
  default: () => {
    const spinner = {
      start: () => spinner,
      succeed: () => spinner,
      fail: () => spinner,
    };
    return spinner;
  },
}));
vi.mock('../../utils/git-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/git-utils')>();
  return {
    ...actual,
    cloneFromUpstream: vi.fn(
      async (...args: Parameters<typeof actual.cloneFromUpstream>) => {
        state.cloneDestination = args[1];
        if (state.stopAfterClone) {
          throw new Error('stop after clone');
        }
        return actual.cloneFromUpstream(...args);
      }
    ),
  };
});
vi.mock('../../utils/workspace-context', () => ({
  resetWorkspaceContext: vi.fn(),
}));
vi.mock('../init/implementation/utils', () => ({ runInstall: vi.fn() }));
vi.mock('../init/implementation/format', () => ({
  formatInitWrites: vi.fn(),
  recordInitWrite: vi.fn(),
}));
vi.mock('../init/init-v2', () => ({
  detectPlugins: vi.fn(),
  getPluginReason: vi.fn(),
}));
vi.mock('./utils/ai-output', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./utils/ai-output')>()),
  logProgress: (...args: unknown[]) => aiOutput.records.push(args),
  writeAiOutput: (record: unknown) => aiOutput.records.push(record),
}));

import { importHandler } from './import';

describe('importHandler', () => {
  let root: string;
  let originalCwd: string;
  const originalEnv = { ...process.env };

  function git(cwd: string, ...args: string[]) {
    return execFileSync('git', args, { cwd, encoding: 'utf-8' });
  }

  function createWorkspace() {
    const destination = join(root, 'workspace');
    mkdirSync(destination);
    git(destination, 'init', '-q', '-b', 'main');
    writeFileSync(
      join(destination, 'package.json'),
      JSON.stringify({ name: 'workspace', workspaces: ['libs/*'] })
    );
    writeFileSync(join(destination, 'package-lock.json'), '{}');
    writeFileSync(join(destination, 'nx.json'), '{}');
    git(destination, 'add', '.');
    git(destination, 'commit', '-q', '-m', 'init');
    state.workspaceRoot = destination;
    process.chdir(destination);
    return destination;
  }

  beforeEach(() => {
    root = mkdtempSync(join(osTmpdir(), 'nx-import-spec-'));
    state.tmpRoot = join(root, 'tmp');
    mkdirSync(state.tmpRoot);
    state.aiAgent = false;
    state.stopAfterClone = false;
    state.cloneDestination = '';
    originalCwd = process.cwd();
    aiOutput.records = [];
    process.env.GIT_AUTHOR_NAME = process.env.GIT_COMMITTER_NAME = 'nx';
    process.env.GIT_AUTHOR_EMAIL = process.env.GIT_COMMITTER_EMAIL =
      'nx@example.com';
    process.env.GIT_CONFIG_NOSYSTEM = '1';
    process.env.GIT_CONFIG_GLOBAL = '/dev/null';
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.chdir(originalCwd);
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });

  it('clones into a fresh owner-only directory even when the old import path exists', async () => {
    createWorkspace();
    state.stopAfterClone = true;
    const squatted = join(state.tmpRoot, 'nx-import');
    const elsewhere = join(state.tmpRoot, 'elsewhere');
    mkdirSync(squatted, { mode: 0o777 });
    mkdirSync(elsewhere);
    symlinkSync(elsewhere, join(squatted, 'repo'));

    await expect(
      importHandler({
        sourceRepository: 'https://example.com/source.git',
        ref: 'main',
        source: '.',
        destination: 'libs/source',
        depth: 0,
        verbose: false,
        interactive: false,
      })
    ).rejects.toThrow('Failed to clone');

    const cloneParent = dirname(state.cloneDestination);
    expect(dirname(cloneParent)).toBe(state.tmpRoot);
    expect(cloneParent).not.toBe(squatted);
    if (process.platform !== 'win32') {
      const stats = statSync(cloneParent);
      expect(stats.uid).toBe(process.getuid!());
      expect(stats.mode & 0o077).toBe(0);
    }
  });

  it('keeps credentials in the source URL out of the merge commit and output', async () => {
    state.aiAgent = true;
    const source = join(root, 'source');
    mkdirSync(join(source, 'lib'), { recursive: true });
    git(source, 'init', '-q', '-b', 'main');
    writeFileSync(join(source, 'lib', 'index.ts'), 'export {};\n');
    git(source, 'add', '.');
    git(source, 'commit', '-q', '-m', 'init');

    const destination = createWorkspace();

    const token = 'ghp_secrettoken123';
    const sourceUrl = `https://user:${token}@example.invalid/org/lib.git`;
    process.env.GIT_CONFIG_COUNT = '1';
    process.env.GIT_CONFIG_KEY_0 = `url.${source}.insteadOf`;
    process.env.GIT_CONFIG_VALUE_0 = sourceUrl;

    await importHandler({
      sourceRepository: sourceUrl,
      ref: 'main',
      source: 'lib',
      destination: 'libs/lib',
      plugins: 'skip',
    });

    const log = git(destination, 'log', '--format=%B', 'HEAD');
    expect(log).toContain('feat(repo): merge main from https://');
    expect(log).not.toContain(token);
    expect(JSON.stringify(aiOutput.records)).not.toContain(token);
  });
});
