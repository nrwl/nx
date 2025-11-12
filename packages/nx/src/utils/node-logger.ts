import { appendFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

let logFilePath: string | null = null;

export function initNodeLogger(workspaceRoot: string) {
  logFilePath = join(workspaceRoot, '.nx', 'workspace-data', 'nx.node.log');
  try {
    mkdirSync(dirname(logFilePath), { recursive: true });
    // Clear the log file on init
    appendFileSync(
      logFilePath,
      `\n\n=== NEW SESSION ${new Date().toISOString()} ===\n\n`
    );
  } catch (e) {
    console.error('Failed to initialize node logger:', e);
  }
}

export function nodeLog(message: string) {
  if (!logFilePath) {
    return;
  }
  try {
    const timestamp = new Date().toISOString();
    appendFileSync(logFilePath, `[${timestamp}] ${message}\n`);
  } catch (e) {
    // Silently fail - don't want to break anything
  }
}
