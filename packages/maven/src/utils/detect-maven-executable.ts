import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { logger } from '@nx/devkit';

// Cache Maven version to avoid repeated execSync calls
let cachedMavenVersion: string | null = null;

/**
 * Detect Maven version (e.g., "4.0.0-rc-4" or "3.9.9")
 */
export function detectMavenVersion(workspaceRoot: string): string | null {
  if (cachedMavenVersion !== null) {
    return cachedMavenVersion;
  }

  const executable = detectMavenExecutable(workspaceRoot);
  try {
    const output = execSync(`${executable} --version`, {
      cwd: workspaceRoot,
      stdio: 'pipe',
      encoding: 'utf-8',
      windowsHide: true,
    });
    // Parse version from output like "Apache Maven 4.0.0-rc-4" or "Apache Maven 3.9.9"
    const match = output.match(/Apache Maven (\d+\.\d+\.\d+[^\s]*)/);
    if (match) {
      cachedMavenVersion = match[1];
      logger.verbose(`[Maven] Detected version: ${cachedMavenVersion}`);
      return cachedMavenVersion;
    }
  } catch {
    // Failed to detect version
  }
  return null;
}

/**
 * Check if Maven 4.x is being used
 */
export function isMaven4(workspaceRoot: string): boolean {
  const version = detectMavenVersion(workspaceRoot);
  return version?.startsWith('4') ?? false;
}

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
