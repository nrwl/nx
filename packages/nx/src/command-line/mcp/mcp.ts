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

  // For commands that might contain spaces like "pnpm dlx"
  const dlxCommand = packageManagerCommands.dlx.split(' ');
  const executable = dlxCommand[0];
  const execArgs = [...dlxCommand.slice(1), ...dlxArgs];

  spawnSync(executable, execArgs, {
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

  const dlxCommand = packageManagerCommands.dlx.split(' ');
  const executable = dlxCommand[0];
  const execArgs = [...dlxCommand.slice(1), ...dlxArgs];

  const helpOutput = spawnSync(executable, execArgs, {
    cwd: workspaceRoot,
    encoding: 'utf-8',
  });

  console.log(helpOutput.stdout?.toString().replaceAll('nx-mcp', 'nx mcp'));
}
