import { execSync } from 'node:child_process';
import { verboseLog, verboseError } from './logger';

export interface DotNetClient {
  getProjectReferencesAsync(projectFile: string): Promise<string[]>;
}

export class NativeDotNetClient implements DotNetClient {
  constructor(private workspaceRoot: string) {}

  async getProjectReferencesAsync(projectFile: string): Promise<string[]> {
    try {
      verboseLog(`[dotnet-cli] Getting references for: ${projectFile}`);
      verboseLog(`[dotnet-cli]   Working directory: ${this.workspaceRoot}`);
      const command = `dotnet list "${projectFile}" reference`;
      verboseLog(`[dotnet-cli]   Command: ${command}`);

      const output = execSync(command, {
        cwd: this.workspaceRoot,
        encoding: 'utf8',
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'ignore'], // Suppress stderr
      });

      verboseLog(`[dotnet-cli]   Raw output (${output.length} chars):`);
      verboseLog(
        `[dotnet-cli]   ${output.split('\n').join('\n[dotnet-cli]   ')}`
      );

      const references = output
        .split('\n')
        .slice(2) // Skip header lines
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      verboseLog(
        `[dotnet-cli]   Parsed references (${
          references.length
        }): ${JSON.stringify(references)}`
      );
      return references;
    } catch (error) {
      verboseError(
        `[dotnet-cli] Failed to get project references for ${projectFile}: ${error.message}`
      );
      verboseError(
        `[dotnet-cli] Error details: ${JSON.stringify(error, null, 2)}`
      );
      return [];
    }
  }
}
