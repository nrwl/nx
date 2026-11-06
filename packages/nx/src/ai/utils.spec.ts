import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { getAgentConfigurations } from './utils';

describe('AI agent configuration detection', () => {
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'nx-ai-utils-'));
  });

  afterEach(() => {
    rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('detects Codex MCP config written with an unquoted server name', async () => {
    mkdirSync(join(workspaceRoot, '.codex'), { recursive: true });
    writeFileSync(
      join(workspaceRoot, '.codex', 'config.toml'),
      `[mcp_servers.nx-mcp]
command = "npx"
args = ["nx", "mcp"]
`
    );

    const configurations = await getAgentConfigurations(
      ['codex'],
      workspaceRoot
    );

    expect(configurations.nonConfiguredAgents).toEqual([]);
    expect(configurations.partiallyConfiguredAgents).toMatchObject([
      {
        name: 'codex',
        mcp: true,
        rules: false,
      },
    ]);
  });
});
