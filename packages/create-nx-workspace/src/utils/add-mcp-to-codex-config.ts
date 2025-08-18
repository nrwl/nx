import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export function addMcpToCodexConfig(): string | undefined {
  try {
    const codexDir = join(homedir(), '.codex');
    const configPath = join(codexDir, 'config.toml');

    if (!existsSync(codexDir)) {
      mkdirSync(codexDir, { recursive: true });
    }

    const mcpBlock = `
[mcp_servers.nx_mcp]
type = "stdio"
command = "npx"
args = ["nx", "mcp"]
`.trim();

    if (!existsSync(configPath)) {
      // If config doesn't exist, create it with the MCP block
      writeFileSync(configPath, mcpBlock);
    } else {
      // If config exists, append the MCP block if it's not already there
      const existingConfig = readFileSync(configPath, 'utf-8');

      if (!existingConfig.includes('[mcp_servers.nx_mcp]')) {
        // Add a newline before the block if the file doesn't end with one
        const separator = existingConfig.endsWith('\n') ? '' : '\n';
        writeFileSync(configPath, existingConfig + separator + mcpBlock);
      } else {
        return;
      }
    }

    return configPath;
  } catch (error) {
    return;
  }
}
