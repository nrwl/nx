import {
  ChildProcess,
  execFileSync,
  ExecFileSyncOptions,
  spawn,
  SpawnOptions,
} from 'child_process';
import { extname } from 'path';
import { quoteShellArg } from './shell-quoting';

// Node cannot launch a Windows `.cmd`/`.bat` shim without a shell, and a bare
// name like `mvn` needs one to be resolved through PATHEXT. Everything else —
// including a `.exe` — spawns directly, so the shell and the quoting below
// reach only the invocations that cannot do without them.
//
// Deliberately a function: a module-level const is fixed at import time, which
// would make the Windows branch untestable.
function needsShell(binary: string): boolean {
  if (process.platform !== 'win32') {
    return false;
  }
  const ext = extname(binary).toLowerCase();
  return ext === '' || ext === '.cmd' || ext === '.bat';
}

// `quoteShellArg` deliberately lets these through — see its spec. That is fine
// for argv a user typed, but cmd.exe expands `%VAR%` and a line break ends the
// command line whatever the quoting, so neither can be made safe here.
const UNQUOTABLE_ON_WINDOWS = /[%\r\n]/;

/**
 * Spawn a process without letting its arguments become shell syntax.
 *
 * @throws on Windows if the binary or an argument cannot be safely quoted for
 * cmd.exe.
 */
export function safeSpawn(
  binary: string,
  args: readonly string[],
  options: Omit<SpawnOptions, 'shell'> = {}
): ChildProcess {
  const shell = needsShell(binary);
  return spawn(quote(binary, shell), quoteAll(args, shell), {
    ...options,
    windowsHide: true,
    shell,
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
  const shell = needsShell(binary);
  return execFileSync(quote(binary, shell), quoteAll(args, shell), {
    stdio: 'pipe',
    ...options,
    windowsHide: true,
    shell,
    encoding: 'utf-8',
  });
}

// The binary needs the same treatment as the arguments: Node joins it into the
// same command line, so a path holding a space or an `&` would split there.
function quote(value: string, shell: boolean): string {
  if (!shell) {
    return value;
  }
  if (UNQUOTABLE_ON_WINDOWS.test(value)) {
    throw new Error(
      `Cannot safely pass ${JSON.stringify(
        value
      )} to cmd.exe: a percent sign or line break inside it would leave the rest of the command to be read as commands. Remove it from your Nx configuration and try again.`
    );
  }
  return quoteShellArg(value);
}

function quoteAll(args: readonly string[], shell: boolean): string[] {
  return shell ? args.map((arg) => quote(arg, shell)) : [...args];
}
