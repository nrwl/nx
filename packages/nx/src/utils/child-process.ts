import {
  exec,
  execSync,
  spawnSync,
  type ExecOptions,
  type ExecSyncOptions,
  type SpawnSyncOptions,
} from 'child_process';
import { existsSync } from 'fs';
import { join, relative } from 'path';
import {
  detectPackageManager,
  getPackageManagerCommand,
  PackageManagerCommands,
} from './package-manager';
import { workspaceRoot, workspaceRootInner } from './workspace-root';
import { ChildProcess } from '../native';
import { messageToCode } from './exit-codes';
import { getNxRequirePaths } from './installation-directory';
import { quoteShellArg } from './shell-quoting';

export function getRunNxBaseCommand(
  packageManagerCommand?: PackageManagerCommands,
  cwd: string = process.cwd()
): string {
  if (existsSync(join(workspaceRoot, 'package.json'))) {
    if (!packageManagerCommand) {
      const pm = detectPackageManager(workspaceRoot);
      packageManagerCommand = getPackageManagerCommand(pm, workspaceRoot);
    }
    return `${packageManagerCommand.exec} nx`;
  } else {
    const offsetFromRoot = relative(cwd, workspaceRootInner(cwd, null));
    if (process.platform === 'win32') {
      return '.\\' + join(`${offsetFromRoot}`, 'nx.bat');
    } else {
      return './' + join(`${offsetFromRoot}`, 'nx');
    }
  }
}

/**
 * Resolve the local nx CLI entry point, including `.nx/installation` wrapper
 * layouts. Returns null when nx cannot be resolved from disk (e.g. Yarn PnP).
 */
export function getNxBin(root: string = workspaceRoot): string | null {
  try {
    return require.resolve('nx/bin/nx.js', { paths: getNxRequirePaths(root) });
  } catch {
    return null;
  }
}

/**
 * Run a nx command, passing the arguments through as an argv array.
 *
 * When the nx entry point can be resolved, the child is spawned directly with
 * no shell in between, so every argument reaches the child exactly as
 * provided — shell metacharacters (`(`, `%`, `^`, spaces, quotes) are data,
 * not syntax. When nx cannot be resolved from disk (e.g. Yarn PnP), falls
 * back to the package-manager + shell path with each argument quoted.
 */
export function runNxArgvSync(
  argv: string[],
  options?: SpawnSyncOptions & {
    cwd?: string;
    nxBin?: string;
  }
) {
  let { nxBin, ...spawnOptions } = options ?? {};
  spawnOptions.cwd ??= process.cwd();
  spawnOptions.windowsHide ??= true;

  nxBin ??= getNxBin(
    workspaceRootInner(spawnOptions.cwd as string, null) ?? workspaceRoot
  );
  if (!nxBin) {
    runNxSync(
      argv.map(quoteShellArg).join(' '),
      spawnOptions as ExecSyncOptions & { cwd?: string }
    );
    return;
  }

  const result = spawnSync(process.execPath, [nxBin, ...argv], spawnOptions);
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const error = new Error(
      `Command failed: nx ${argv.join(' ')} (exit code ${result.status})`
    );
    (error as any).status = result.status ?? 1;
    throw error;
  }
}

export function runNxSync(
  cmd: string,
  options?: ExecSyncOptions & {
    cwd?: string;
    packageManagerCommand?: PackageManagerCommands;
  }
) {
  let { packageManagerCommand, ...execSyncOptions } = options ?? {};

  execSyncOptions.cwd ??= process.cwd();
  execSyncOptions.windowsHide ??= true;

  const baseCmd = getRunNxBaseCommand(
    packageManagerCommand,
    execSyncOptions.cwd
  );
  execSync(`${baseCmd} ${cmd}`, execSyncOptions);
}

export async function runNxAsync(
  cmd: string,
  options?: ExecOptions & {
    cwd?: string;
    silent?: boolean;
    packageManagerCommand?: PackageManagerCommands;
  }
): Promise<void> {
  options ??= {};
  options.cwd ??= process.cwd();
  let { silent, packageManagerCommand, ...execSyncOptions } = options;
  silent ??= true;

  const baseCmd = getRunNxBaseCommand(
    packageManagerCommand,
    execSyncOptions.cwd
  );
  return new Promise<void>((resolve, reject) => {
    const child = exec(
      `${baseCmd} ${cmd}`,
      { ...execSyncOptions, windowsHide: true },
      (error, stdout, stderr) => {
        if (error) {
          reject(stderr || stdout || error.message);
        } else {
          resolve();
        }
      }
    );
    if (!silent) {
      child.stdout?.pipe(process.stdout);
      child.stderr?.pipe(process.stderr);
    }
  });
}

export class PseudoTtyProcess {
  isAlive = true;

  exitCallbacks = [];

  constructor(private childProcess: ChildProcess) {
    childProcess.onExit((message) => {
      this.isAlive = false;

      const exitCode = messageToCode(message);

      this.exitCallbacks.forEach((cb) => cb(exitCode));
    });
  }

  onExit(callback: (code: number) => void): void {
    this.exitCallbacks.push(callback);
  }

  onOutput(callback: (message: string) => void): void {
    this.childProcess.onOutput(callback);
  }

  kill(): void {
    try {
      this.childProcess.kill();
    } catch {
      // when the child process completes before we explicitly call kill, this will throw
      // do nothing
    } finally {
      if (this.isAlive == true) {
        this.isAlive = false;
      }
    }
  }
}
