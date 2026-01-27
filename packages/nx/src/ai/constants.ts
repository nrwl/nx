import { homedir } from 'os';
import { join } from 'path';
import { major } from 'semver';
import { readJsonFile } from '../utils/fileutils';
import { getAgentRules } from './set-up-ai-agents/get-agent-rules';

export function agentsMdPath(root: string): string {
  return join(root, 'AGENTS.md');
}

export function geminiMdPath(root: string): string {
  return join(root, 'GEMINI.md');
}

export function parseGeminiSettings(root: string): any | undefined {
  const settingsPath = geminiSettingsPath(root);
  try {
    return readJsonFile(settingsPath);
  } catch {
    return undefined;
  }
}

export function geminiSettingsPath(root: string): string {
  return join(root, '.gemini', 'settings.json');
}

export function claudeMdPath(root: string): string {
  return join(root, 'CLAUDE.md');
}

export function opencodeMcpPath(root: string): string {
  return join(root, 'opencode.json');
}

export const codexConfigTomlPath = join(homedir(), '.codex', 'config.toml');

export const nxRulesMarkerCommentStart = `<!-- nx configuration start-->`;
export const nxRulesMarkerCommentDescription = `<!-- Leave the start & end comments to automatically receive updates. -->`;
export const nxRulesMarkerCommentEnd = `<!-- nx configuration end-->`;
export const rulesRegex = new RegExp(
  `${nxRulesMarkerCommentStart}[\\s\\S]*?${nxRulesMarkerCommentEnd}`,
  'm'
);

export const getAgentRulesWrapped = (writeNxCloudRules: boolean) => {
  const agentRulesString = getAgentRules(writeNxCloudRules);
  return `${nxRulesMarkerCommentStart}\n${nxRulesMarkerCommentDescription}\n${agentRulesString}\n${nxRulesMarkerCommentEnd}`;
};

export const nxMcpTomlHeader = `[mcp_servers."nx-mcp"]`;

/**
 * Get the MCP TOML configuration based on the Nx version.
 * For Nx 22+, uses 'nx mcp'
 * For Nx < 22, uses 'nx-mcp'
 */
export function getNxMcpTomlConfig(nxVersion: string): string {
  const majorVersion = major(nxVersion);
  const args = majorVersion >= 22 ? '["nx", "mcp"]' : '["nx-mcp"]';
  return `${nxMcpTomlHeader}
type = "stdio"
command = "npx"
args = ${args}
`;
}
