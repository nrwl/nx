import { execSync } from 'node:child_process';
import { logger } from '@nx/devkit';

export interface DotNetClient {
  getProjectReferencesAsync(projectFile: string): Promise<string[]>;
}

export class NativeDotNetClient implements DotNetClient {
  constructor(private workspaceRoot: string) {}

  async getProjectReferencesAsync(projectFile: string): Promise<string[]> {
    try {
      const output = execSync(`dotnet list "${projectFile}" reference`, {
        cwd: this.workspaceRoot,
        encoding: 'utf8',
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'ignore'], // Suppress stderr
      });

      return output
        .split('\n')
        .slice(2) // Skip header lines
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    } catch (error) {
      logger.warn(
        `Failed to get project references for ${projectFile}: ${error.message}`
      );
      return [];
    }
  }
}
