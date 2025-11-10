import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { logger } from '@nx/devkit';

/**
 * Detect Maven executable: mvnd > mvnw > mvn
 */
export function detectMavenExecutable(workspaceRoot: string): string {
  // First priority: Check for Maven Daemon
  try {
    execSync('mvnd --version', { stdio: 'pipe' });
    logger.verbose(`[Maven] Found Maven Daemon, using: mvnd`);
    return 'mvnd';
  } catch {
    // Maven Daemon not available
  }

  // Second priority: Check for Maven wrapper
  if (process.platform === 'win32') {
    const wrapperPath = join(workspaceRoot, 'mvnw.cmd');
    if (existsSync(wrapperPath)) {
      logger.verbose(`[Maven] Found Maven wrapper, using: mvnw.cmd`);
      return 'mvnw.cmd';
    }
  } else {
    const wrapperPath = join(workspaceRoot, 'mvnw');
    if (existsSync(wrapperPath)) {
      logger.verbose(`[Maven] Found Maven wrapper, using: ./mvnw`);
      return './mvnw';
    }
  }

  // Fallback: Use regular Maven
  logger.verbose(`[Maven] Using fallback: mvn`);
  return 'mvn';
}
