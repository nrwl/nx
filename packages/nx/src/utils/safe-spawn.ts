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

// A line break ends the command line whatever the quoting, so no value can
// carry one. `%` is refused for arguments only: `quoteShellArg` leaves it
// unquoted by design and cmd.exe expands it, which is meaningless in a
// `-Dkey=value` pair but ordinary in a directory name.
const LINE_BREAK = /[\r\n]/;
const UNQUOTABLE_ARG_ON_WINDOWS = /[%\r\n]/;

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
  return spawn(quoteBinary(binary, shell), quoteArgs(args, shell), {
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
  return execFileSync(quoteBinary(binary, shell), quoteArgs(args, shell), {
    stdio: 'pipe',
    ...options,
    windowsHide: true,
    shell,
    encoding: 'utf-8',
  });
}

// The binary needs quoting too: Node joins it into the same command line, so a
// path holding a space or an `&` would split there. It is a filesystem path
// rather than configuration, so only a line break is refused.
function quoteBinary(binary: string, shell: boolean): string {
  if (!shell) {
    return binary;
  }
  if (LINE_BREAK.test(binary)) {
    throw new Error(
      `Cannot run ${JSON.stringify(
        binary
      )}: a line break in the path would end the command line before cmd.exe reached the rest of it.`
    );
  }
  return quoteShellArg(binary);
}

function quoteArgs(args: readonly string[], shell: boolean): string[] {
  if (!shell) {
    return [...args];
  }
  return args.map((arg) => {
    if (UNQUOTABLE_ARG_ON_WINDOWS.test(arg)) {
      throw new Error(
        `Cannot safely pass ${JSON.stringify(
          arg
        )} to cmd.exe: a percent sign or line break inside it would leave the rest of the command line to be read as commands. Remove it from your Nx configuration and try again.`
      );
    }
    return quoteShellArg(arg);
  });
}
