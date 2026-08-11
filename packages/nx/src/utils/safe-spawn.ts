import {
  ChildProcess,
  execFileSync,
  ExecFileSyncOptions,
  spawn,
  SpawnOptions,
} from 'child_process';
import { quoteShellArg } from './shell-quoting';

// Node cannot launch a Windows `.cmd`/`.bat` shim without a shell, and both the
// maven and gradle wrappers are one. The shell stays there and each argument is
// quoted; everywhere else no shell runs, so the argv array is passed as-is.
//
// Deliberately a function: a module-level const is fixed at import time, which
// makes the Windows branch untestable — the trap cross-spawn's `isWin` sets.
const needsShell = () => process.platform === 'win32';

/**
 * Spawn a process with arguments that carry workspace configuration.
 *
 * @throws on Windows if an argument cannot be safely quoted for cmd.exe.
 */
export function safeSpawn(
  binary: string,
  args: readonly string[],
  options: Omit<SpawnOptions, 'shell'> = {}
): ChildProcess {
  return spawn(binary, quoteForPlatform(args), {
    ...options,
    windowsHide: true,
    shell: needsShell(),
  });
}

/**
 * Synchronous {@link safeSpawn}, returning the child's stdout.
 */
export function safeExecFileSync(
  binary: string,
  args: readonly string[],
  options: Omit<ExecFileSyncOptions, 'encoding' | 'shell'> = {}
): string {
  return execFileSync(binary, quoteForPlatform(args), {
    stdio: 'pipe',
    ...options,
    windowsHide: true,
    shell: needsShell(),
    encoding: 'utf-8',
  });
}

// `quoteShellArg` deliberately lets these through — see its spec. That is fine
// for argv the user typed, but these arguments come from nx.json in a cloned
// repository, where cmd.exe expanding `%VAR%` or a line break ending the
// command is worth refusing outright. Neither is meaningful in a Maven property
// or a Gradle `-P` value.
const UNQUOTABLE_ON_WINDOWS = /[%\r\n]/;

function quoteForPlatform(args: readonly string[]): string[] {
  if (!needsShell()) {
    return [...args];
  }
  return args.map((arg) => {
    if (UNQUOTABLE_ON_WINDOWS.test(arg)) {
      throw new Error(
        `Cannot safely pass ${JSON.stringify(
          arg
        )} to cmd.exe: a percent sign or line break inside it would leave the rest of the argument to be read as commands. Remove it from your Nx configuration and try again.`
      );
    }
    return quoteShellArg(arg);
  });
}
