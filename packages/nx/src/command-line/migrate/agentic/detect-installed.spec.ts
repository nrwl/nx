import type { Mock } from 'vitest';
import { delimiter, join, resolve } from 'path';
import { AgentDefinition } from './types';

vi.mock('which', () => ({ default: vi.fn() }));
vi.mock('fs/promises', () => ({
  access: vi.fn(),
  constants: { X_OK: 1 },
}));
vi.mock('child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('child_process')>()),
  // Every probe fails to start, so each candidate lands in the rejected list.
  execFile: vi.fn((_file, _args, _options, callback) => {
    setImmediate(() =>
      callback(Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' }), '')
    );
    return { stdin: null };
  }),
}));

import which from 'which';
import { access } from 'fs/promises';
import {
  confirmAgentIdentity,
  detectInstalledAgents,
} from './detect-installed';

const mockWhich = which as unknown as Mock;
const mockAccess = access as unknown as Mock;

const BIN = resolve('/usr/local/bin');

function makeDefinition(
  overrides: Partial<AgentDefinition> & Pick<AgentDefinition, 'id'>
): AgentDefinition {
  return {
    displayName: `${overrides.id} display`,
    binaryNames: ['bin'],
    wellKnownPaths: () => [],
    ...overrides,
  };
}

// `which` given an absolute name checks only that file.
function installed(...binaries: string[]): void {
  mockWhich.mockImplementation(async (path: string) =>
    binaries.includes(path) ? [path] : null
  );
}

describe('detectInstalledAgents', () => {
  const originalPath = process.env.PATH;

  beforeEach(() => {
    mockWhich.mockReset();
    mockAccess.mockReset();
    process.env.PATH = BIN;
  });

  afterEach(() => {
    process.env.PATH = originalPath;
  });

  it('returns an empty array when no agents are detected', async () => {
    mockWhich.mockResolvedValue(null);
    const definitions = [
      makeDefinition({ id: 'claude-code', binaryNames: ['claude'] }),
    ];

    const result = await detectInstalledAgents(definitions);

    expect(result).toEqual([]);
  });

  it('marks PATH-resolved agents with source "path"', async () => {
    installed(join(BIN, 'claude'));
    const definitions = [
      makeDefinition({ id: 'claude-code', binaryNames: ['claude'] }),
    ];

    const result = await detectInstalledAgents(definitions);

    expect(result).toEqual([
      {
        id: 'claude-code',
        displayName: 'claude-code display',
        binary: join(BIN, 'claude'),
        source: 'path',
      },
    ]);
  });

  it('falls back to well-known paths when PATH misses', async () => {
    mockWhich.mockResolvedValue(null);
    mockAccess.mockImplementation(async (path: string) => {
      if (path === '/home/me/.claude/local/claude') {
        return;
      }
      throw new Error('not executable');
    });
    const definitions = [
      makeDefinition({
        id: 'claude-code',
        binaryNames: ['claude'],
        wellKnownPaths: () => ['/home/me/.claude/local/claude'],
      }),
    ];

    const result = await detectInstalledAgents(definitions);

    expect(result).toEqual([
      {
        id: 'claude-code',
        displayName: 'claude-code display',
        binary: '/home/me/.claude/local/claude',
        source: 'well-known',
      },
    ]);
  });

  it('tries multiple binary names per agent and returns the first PATH hit', async () => {
    installed(join(BIN, 'codex.cmd'));
    const definitions = [
      makeDefinition({
        id: 'codex',
        binaryNames: ['codex', 'codex.cmd'],
      }),
    ];

    const result = await detectInstalledAgents(definitions);

    expect(result[0]?.binary).toBe(join(BIN, 'codex.cmd'));
    expect(result[0]?.source).toBe('path');
  });

  it('preserves input order and filters out missing agents', async () => {
    installed(join(BIN, 'opencode'));
    mockAccess.mockRejectedValue(new Error('not executable'));
    const definitions = [
      makeDefinition({ id: 'claude-code', binaryNames: ['claude'] }),
      makeDefinition({ id: 'codex', binaryNames: ['codex'] }),
      makeDefinition({ id: 'opencode', binaryNames: ['opencode'] }),
    ];

    const result = await detectInstalledAgents(definitions);

    expect(result.map((r) => r.id)).toEqual(['opencode']);
  });

  it('prefers PATH over well-known when both are present', async () => {
    installed(join(BIN, 'claude'));
    mockAccess.mockResolvedValue(undefined);
    const definitions = [
      makeDefinition({
        id: 'claude-code',
        binaryNames: ['claude'],
        wellKnownPaths: () => ['/home/me/.claude/local/claude'],
      }),
    ];

    const result = await detectInstalledAgents(definitions);

    expect(result[0]?.source).toBe('path');
    expect(result[0]?.binary).toBe(join(BIN, 'claude'));
  });

  it('returns a PATH match from a relative PATH entry as an absolute path', async () => {
    process.env.PATH = join('node_modules', '.bin');
    const binary = resolve('node_modules', '.bin', 'claude');
    installed(binary);

    const result = await detectInstalledAgents([
      makeDefinition({ id: 'claude-code', binaryNames: ['claude'] }),
    ]);

    expect(result[0]?.binary).toBe(binary);
  });

  describe('on Windows', () => {
    const originalPlatform = process.platform;
    const cwd = resolve('workspace');
    const binDir = resolve('bin');
    const copilotLike = makeDefinition({
      id: 'copilot',
      binaryNames: ['copilot'],
      readVersionOutput: () => ({ kind: 'unrecognized' }),
    });

    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      vi.spyOn(process, 'cwd').mockReturnValue(cwd);
      // `which` tries each PATHEXT entry in both cases, so a case-insensitive
      // filesystem gives every shim twice.
      mockWhich.mockImplementation(async (path: string) =>
        path === join(cwd, 'copilot') || path === join(binDir, 'copilot')
          ? [`${path}.CMD`, `${path}.cmd`]
          : null
      );
    });

    afterEach(() => {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
      vi.mocked(process.cwd).mockRestore();
    });

    it.each([
      ['skips the current directory PATH does not list', [binDir], [binDir]],
      [
        'keeps the current directory at its PATH position',
        [binDir, cwd],
        [binDir, cwd],
      ],
      ['unquotes a quoted PATH entry', [`"${cwd}"`], [cwd]],
      ['skips an empty PATH entry', ['', binDir], [binDir]],
      ['keeps `.` at its PATH position', [binDir, '.'], [binDir, cwd]],
    ])(
      '%s and probes each shim once',
      async (_label, pathEntries, expectedDirs) => {
        process.env.PATH = pathEntries.join(delimiter);

        const identity = await confirmAgentIdentity(copilotLike, {
          id: 'copilot',
          displayName: copilotLike.displayName,
          binary: join(expectedDirs[0], 'copilot.CMD'),
          source: 'path',
        });

        expect(identity).toEqual({
          kind: 'rejected',
          binaries: expectedDirs.map((dir) => ({
            binary: join(dir, 'copilot.CMD'),
            reason: expect.any(String),
            unsupported: false,
          })),
        });
      }
    );
  });
});
