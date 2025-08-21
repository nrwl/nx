import { spawnSync } from 'child_process';
import {
  detectPackageManager,
  getPackageManagerCommand,
} from '../../utils/package-manager';
import { workspaceRoot } from '../../utils/workspace-root';

export async function mcpHandler(args: any) {
  const packageManager = detectPackageManager();
  const packageManagerCommands = getPackageManagerCommand(packageManager);

  const passthroughArgs =
    args['_'][0] === 'mcp' ? args['_'].slice(1) : args['_'];

  let dlxArgs: string[];

  if (packageManager === 'npm') {
    dlxArgs = ['-y', 'nx-mcp@latest', ...passthroughArgs];
  } else if (packageManager === 'yarn') {
    dlxArgs = ['--quiet', 'nx-mcp@latest', ...passthroughArgs];
  } else if (packageManager === 'bun') {
    dlxArgs = ['--silent', 'nx-mcp@latest', ...passthroughArgs];
  } else {
    dlxArgs = ['nx-mcp@latest', ...passthroughArgs];
  }

  // spawnSync would break with a .dlx value with a space (like pnpm dlx is)
  const spawnSyncArgs = `${packageManagerCommands.dlx} ${dlxArgs.join(
    ' '
  )}`.split(' ');

  spawnSync(spawnSyncArgs[0], spawnSyncArgs.slice(1), {
    stdio: 'inherit',
    cwd: workspaceRoot,
  });
}

export async function showHelp() {
  const packageManager = detectPackageManager();
  const packageManagerCommands = getPackageManagerCommand(packageManager);

  let dlxArgs: string[];
  if (packageManager === 'npm') {
    dlxArgs = ['-y', 'nx-mcp@latest', '--help'];
  } else if (packageManager === 'yarn') {
    dlxArgs = ['--quiet', 'nx-mcp@latest', '--help'];
  } else if (packageManager === 'bun') {
    dlxArgs = ['--silent', 'nx-mcp@latest', '--help'];
  } else {
    dlxArgs = ['nx-mcp@latest', '--help'];
  }

  const helpOutput = spawnSync(packageManagerCommands.dlx, dlxArgs, {
    cwd: workspaceRoot,
    encoding: 'utf-8',
  });

  console.log(helpOutput.stdout?.toString().replaceAll('nx-mcp', 'nx mcp'));
}
