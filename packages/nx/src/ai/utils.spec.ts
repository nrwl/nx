import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import * as cloneModule from './clone-ai-config-repo';
import { getAgentConfigurations } from './utils';

describe('AI agent configuration detection', () => {
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'nx-ai-utils-'));
    // The update check for a configured agent fetches the ai-config repo from GitHub
    vi.spyOn(cloneModule, 'getAiConfigRepoPath').mockImplementation(() => {
      throw new Error('offline');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it.each([
    ['an unquoted', '[mcp_servers.nx-mcp]'],
    ['a quoted', '[mcp_servers."nx-mcp"]'],
  ])(
    'detects Codex MCP config written with %s server name',
    async (_, header) => {
      mkdirSync(join(workspaceRoot, '.codex'), { recursive: true });
      writeFileSync(
        join(workspaceRoot, '.codex', 'config.toml'),
        `${header}
command = "npx"
args = ["nx", "mcp"]
`
      );

      const configurations = await getAgentConfigurations(
        ['codex'],
        workspaceRoot
      );

      expect(configurations.nonConfiguredAgents).toEqual([]);
      expect(configurations.fullyConfiguredAgents).toMatchObject([
        { name: 'codex' },
      ]);
    }
  );

  it('does not detect Codex MCP config when the nx-mcp table is commented out', async () => {
    mkdirSync(join(workspaceRoot, '.codex'), { recursive: true });
    writeFileSync(
      join(workspaceRoot, '.codex', 'config.toml'),
      `[mcp_servers.other]
command = "other-mcp"

# [mcp_servers."nx-mcp"]
# command = "npx"
# args = ["nx", "mcp"]
`
    );

    const configurations = await getAgentConfigurations(
      ['codex'],
      workspaceRoot
    );

    expect(configurations.fullyConfiguredAgents).toEqual([]);
    expect(configurations.nonConfiguredAgents).toMatchObject([
      { name: 'codex' },
    ]);
  });
});
