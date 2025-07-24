import { spawnSync } from 'child_process';
import { getPackageManagerCommand } from '../../utils/package-manager';
import { workspaceRoot } from '../../utils/workspace-root';

export async function mcpHandler(args: any) {
  const packageManagerCommands = getPackageManagerCommand();

  spawnSync(
    packageManagerCommands.dlx,
    ['-y', 'nx-mcp@latest', , ...args['_']],
    {
      stdio: 'inherit',
      cwd: workspaceRoot,
    }
  );
}

export async function showHelp() {
  const packageManagerCommands = getPackageManagerCommand();

  const helpOutput = spawnSync(
    packageManagerCommands.dlx,
    ['-y', 'nx-mcp@latest', '--help'],
    {
      cwd: workspaceRoot,
      encoding: 'utf-8',
    }
  );

  console.log(helpOutput.stdout?.toString().replaceAll('nx-mcp', 'nx mcp'));
}
