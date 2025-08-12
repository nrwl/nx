import { spawnSync } from 'child_process';
import { getPackageManagerCommand } from '../../utils/package-manager';
import { workspaceRoot } from '../../utils/workspace-root';

export async function mcpHandler(args: any) {
  const packageManagerCommands = getPackageManagerCommand();

  const passthroughArgs =
    args['_'][0] === 'mcp' ? args['_'].slice(1) : args['_'];
  spawnSync(
    packageManagerCommands.dlx,
    ['-y', 'nx-mcp@latest', ...passthroughArgs],
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
