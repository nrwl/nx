import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export function agentsMdPath(root: string): string {
  return join(root, 'AGENTS.md');
}

export function geminiMdPath(root: string): string {
  return join(root, 'GEMINI.md');
}

export function parseGeminiSettings(root: string): any | undefined {
  const settingsPath = geminiSettingsPath(root);
  try {
    return JSON.parse(readFileSync(settingsPath, 'utf-8'));
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

export function claudeMcpPath(root: string): string {
  return join(root, '.mcp.json');
}

export const codexConfigTomlPath = join(homedir(), '.codex', 'config.toml');
