import { homedir } from 'os';
import { join } from 'path';

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

export const codexConfigTomlPath = join(homedir(), '.codex', 'config.toml');
