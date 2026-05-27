import { AgentDefinition } from './types';

jest.mock('which', () => jest.fn());
jest.mock('fs/promises', () => ({
  access: jest.fn(),
  constants: { X_OK: 1 },
}));

import which from 'which';
import { access } from 'fs/promises';
import { detectInstalledAgents } from './detect-installed';

const mockWhich = which as unknown as jest.Mock;
const mockAccess = access as unknown as jest.Mock;

function makeDefinition(
  overrides: Partial<AgentDefinition> & Pick<AgentDefinition, 'id'>
): AgentDefinition {
  return {
    displayName: `${overrides.id} display`,
    binaryNames: ['bin'],
    wellKnownPaths: () => [],
    buildInteractive: () => ({ args: [] }),
    ...overrides,
  };
}

describe('detectInstalledAgents', () => {
  beforeEach(() => {
    mockWhich.mockReset();
    mockAccess.mockReset();
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
    mockWhich.mockImplementation(async (name: string) =>
      name === 'claude' ? '/usr/local/bin/claude' : null
    );
    const definitions = [
      makeDefinition({ id: 'claude-code', binaryNames: ['claude'] }),
    ];

    const result = await detectInstalledAgents(definitions);

    expect(result).toEqual([
      {
        id: 'claude-code',
        displayName: 'claude-code display',
        binary: '/usr/local/bin/claude',
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
    mockWhich.mockImplementation(async (name: string) =>
      name === 'codex.cmd' ? '/usr/local/bin/codex.cmd' : null
    );
    const definitions = [
      makeDefinition({
        id: 'codex',
        binaryNames: ['codex', 'codex.cmd'],
      }),
    ];

    const result = await detectInstalledAgents(definitions);

    expect(result[0]?.binary).toBe('/usr/local/bin/codex.cmd');
    expect(result[0]?.source).toBe('path');
  });

  it('preserves input order and filters out missing agents', async () => {
    mockWhich.mockImplementation(async (name: string) =>
      name === 'opencode' ? '/usr/local/bin/opencode' : null
    );
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
    mockWhich.mockResolvedValue('/usr/local/bin/claude');
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
    expect(result[0]?.binary).toBe('/usr/local/bin/claude');
  });
});
