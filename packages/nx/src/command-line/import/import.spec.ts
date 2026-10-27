import { mkdirSync, mkdtempSync, rmSync, statSync, symlinkSync } from 'node:fs';
import { tmpdir as osTmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const state = vi.hoisted(() => ({
  tmpRoot: '',
  cloneDestination: '',
}));

vi.mock('tmp', () => ({
  get tmpdir() {
    return state.tmpRoot;
  },
}));

vi.mock('../../native', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../native')>()),
  isAiAgent: () => false,
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

vi.mock('../../utils/git-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/git-utils')>()),
  GitRepository: class {
    async hasUncommittedChanges() {
      return false;
    }
  },
  cloneFromUpstream: vi.fn(async (_url: string, destination: string) => {
    state.cloneDestination = destination;
    throw new Error('stop after clone');
  }),
}));

import { importHandler } from './import';

describe('importHandler', () => {
  beforeEach(() => {
    state.tmpRoot = mkdtempSync(join(osTmpdir(), 'nx-import-spec-'));
    state.cloneDestination = '';
  });

  afterEach(() => {
    rmSync(state.tmpRoot, { recursive: true, force: true });
  });

  it('clones into a fresh owner-only directory even when the old import path exists', async () => {
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
});
