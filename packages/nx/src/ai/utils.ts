import { appendFileSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { canInstallNxConsoleForEditor } from '../native';
import { flushChanges, FsTree } from '../generators/tree';
import setupAiAgentsGenerator from './set-up-ai-agents/set-up-ai-agents';
import { homedir } from 'os';
import { output } from '../utils/output';

export type Agent = 'claude' | 'gemini' | 'codex' | 'cursor' | 'copilot';

export function getAgentIsConfigured(
  agent: Agent,
  workspaceRoot: string
): {
  rules: boolean;
  mcp: boolean;
} {
  switch (agent) {
    case 'claude': {
      const mcpPath = claudeMcpPath(workspaceRoot);
      let mcpConfigured: boolean;
      try {
        const mcpContents = JSON.parse(readFileSync(mcpPath, 'utf-8'));
        mcpConfigured = !!mcpContents['mcpServers']['nx-mcp'];
      } catch {
        mcpConfigured = false;
      }
      return {
        rules: existsSync(claudeMdPath(workspaceRoot)),
        mcp: mcpConfigured,
      };
    }
    case 'gemini': {
      const geminiMdExists = existsSync(geminiMdPath(workspaceRoot));
      const agentsMdExists = existsSync(agentsMdPath(workspaceRoot));
      let mcpConfigured: boolean;
      let pointsToAgentsMd: boolean;
      try {
        const geminiSettings = JSON.parse(
          readFileSync(geminiSettingsPath(workspaceRoot), 'utf-8')
        );
        pointsToAgentsMd = geminiSettings.contextFileName === 'AGENTS.md';
        mcpConfigured = geminiSettings?.['mcpServers']?.['nx-mcp'];
      } catch {
        mcpConfigured = false;
        pointsToAgentsMd = false;
      }

      return {
        mcp: mcpConfigured,
        rules: geminiMdExists || (pointsToAgentsMd && agentsMdExists),
      };
    }
    case 'copilot': {
      const hasInstalledNxConsole =
        !canInstallNxConsoleForEditor('vscode') &&
        !canInstallNxConsoleForEditor('vscode-insiders');
      const agentsMdExists = existsSync(agentsMdPath(workspaceRoot));

      return {
        mcp: hasInstalledNxConsole,
        rules: agentsMdExists,
      };
    }
    case 'cursor': {
      const hasInstalledNxConsole = !canInstallNxConsoleForEditor('cursor');
      const agentsMdExists = existsSync(agentsMdPath(workspaceRoot));

      return {
        mcp: hasInstalledNxConsole,
        rules: agentsMdExists,
      };
    }
    default: {
      return {
        rules: false,
        mcp: false,
      };
    }
  }
}

export async function getAgentConfigurationIsOutdated(
  agent: Agent,
  workspaceRoot: string
): Promise<boolean> {
  // todo: download latest version and check against it
  return false;
}

export async function configureAgents(
  agents: Agent[],
  workspaceRoot: string,
  useLatest?: boolean
): Promise<void> {
  const tree = new FsTree(workspaceRoot, false);
  await setupAiAgentsGenerator(
    tree,
    {
      directory: '.',
      agents: agents,
    },
    !useLatest
  );

  flushChanges(workspaceRoot, tree.listChanges());

  if (agents.includes('codex')) {
    const configTomlPath = join(homedir(), '.codex', 'config.toml');

    if (existsSync(configTomlPath)) {
      const tomlContents = readFileSync(configTomlPath, 'utf-8');
      if (!tomlContents.includes(nxMcpTomlHeader)) {
        appendFileSync(configTomlPath, `\n${nxMcpTomlConfig}`);
        output.log({
          title: `Updated ${configTomlPath} with nx-mcp server`,
        });
      }
    } else {
      mkdirSync(join(homedir(), '.codex'), { recursive: true });
      writeFileSync(configTomlPath, nxMcpTomlConfig);
      output.log({
        title: `Created ${configTomlPath} with nx-mcp server`,
      });
    }
  }
}

export function getAgentConfigurations(
  agentsToConsider: Agent[],
  workspaceRoot: string
): {
  nonConfiguredAgents: Agent[];
  partiallyConfiguredAgents: Agent[];
  fullyConfiguredAgents: Agent[];
} {
  const nonConfiguredAgents: Agent[] = [];
  const partiallyConfiguredAgents: Agent[] = [];
  const fullyConfiguredAgents: Agent[] = [];

  agentsToConsider.forEach((agent) => {
    const configured = getAgentIsConfigured(agent, workspaceRoot);
    if (configured.mcp && configured.rules) {
      fullyConfiguredAgents.push(agent);
    } else if (!configured.mcp && !configured.rules) {
      nonConfiguredAgents.push(agent);
    } else {
      partiallyConfiguredAgents.push(agent);
    }
  });

  return {
    nonConfiguredAgents,
    partiallyConfiguredAgents,
    fullyConfiguredAgents,
  };
}

export function agentsMdPath(root: string): string {
  return join(root, 'AGENTS.md');
}

export function geminiMdPath(root: string): string {
  return join(root, 'GEMINI.md');
}

export function geminiSettingsPath(root: string): string {
  return join(root, '.gemini', 'settings.json');
}

export function claudeMdPath(root: string): string {
  return join(root, 'CLAUDE.md');
}

export function claudeMcpPath(root: string): string {
  return join(root, '.mcp.json');
}

const nxMcpTomlHeader = `[mcp_servers."nx-mcp"]`;
const nxMcpTomlConfig = `${nxMcpTomlHeader}
type = "stdio"
command = "npx"
args = ["nx", "mcp"]
`;
