import {
  exec,
  execSync,
  spawnSync,
  type ExecOptions,
  type ExecSyncOptions,
  type SpawnSyncOptions,
} from 'child_process';
import { existsSync } from 'fs';
import { dirname, join, relative } from 'path';
import {
  detectPackageManager,
  getPackageManagerCommand,
  PackageManagerCommands,
} from './package-manager';
import { workspaceRoot, workspaceRootInner } from './workspace-root';
import { ChildProcess } from '../native';
import { messageToCode } from './exit-codes';
import { readJsonFile } from './fileutils';
import { quoteShellArg } from './shell-quoting';

export function getRunNxBaseCommand(
  packageManagerCommand?: PackageManagerCommands,
  cwd: string = process.cwd()
): string {
  if (existsSync(join(workspaceRoot, 'package.json'))) {
    if (!packageManagerCommand) {
      // `readLocalNxVersion` (command-line/migrate/migrate.ts) mirrors this
      // selector to predict which nx a spawn will run, for the workspaces
      // `getNxBin` declines to resolve; keep the two in sync.
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
 * Locate the nx entry point the workspace at `root` would run, so a caller can
 * spawn it directly instead of going through a shell.
 *
 * Returns null whenever that answer is not certain, leaving the caller to fall
 * back to `getRunNxBaseCommand` and let the package manager locate nx. Null is
 * therefore always safe: it costs the argument fidelity a direct spawn buys,
 * never the ability to run.
 */
export function getNxBin(root: string = workspaceRoot): string | null {
  // A workspace with no root package.json runs nx through the `./nx` wrapper,
  // which reinstalls `.nx/installation` whenever it drifts from nx.json's
  // `installation.version`. Spawning the resolved entry point would skip that
  // sync, and a migration is precisely when the version changes.
  if (!existsSync(join(root, 'package.json'))) {
    return null;
  }

  return findInstalledNxBin(root);
}

// Mirrors a package manager's own bin lookup: ascend to the nearest installed
// nx (npx and bun ascend always, pnpm and yarn inside an outer workspace) and
// take the entry point its `bin` field names, which is the file the manager
// links into `node_modules/.bin`.
//
// Deliberately not a resolver. Resolvers answer from NODE_PATH once their
// explicit paths miss, and `nxCliPath` (command-line/migrate/migrate.ts) points
// NODE_PATH at the temp installation before spawning it; they also answer
// through package self-reference, which hands back the running nx whatever
// `paths` they are given. Either one lets the temp installation hand off to
// itself, which for `--run-migrations` re-enters the same hand-off and respawns
// without end.
function findInstalledNxBin(root: string): string | null {
  for (let dir = root; ; dir = dirname(dir)) {
    const packageDir = join(dir, 'node_modules', 'nx');
    const manifest = join(packageDir, 'package.json');
    if (existsSync(manifest)) {
      let bin: string | Record<string, string> | undefined;
      try {
        ({ bin } = readJsonFile<{ bin?: string | Record<string, string> }>(
          manifest
        ));
      } catch {
        return null;
      }
      // npm accepts both the single-entry shorthand and the map form.
      const entry = typeof bin === 'string' ? bin : bin?.nx;
      return typeof entry === 'string' ? join(packageDir, entry) : null;
    }
    if (dir === dirname(dir)) {
      return null;
    }
  }
}

/**
 * Run a nx command, passing the arguments through as an argv array.
 *
 * When `getNxBin` names an entry point, the child is spawned directly with no
 * shell in between, so every argument reaches the child exactly as provided:
 * shell metacharacters (`(`, `%`, `^`, spaces, quotes) are data, not syntax.
 * Otherwise falls back to the package-manager + shell path with each argument
 * quoted.
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
