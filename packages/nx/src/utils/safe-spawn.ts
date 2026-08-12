import {
  ChildProcess,
  execFileSync,
  ExecFileSyncOptions,
  spawn,
  SpawnOptions,
} from 'child_process';
import { win32 } from 'path';
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
  // win32.extname, not the platform default: this branch only runs on Windows,
  // where `path` is win32 anyway, and pinning it lets a test model the real
  // parse rather than posix's (which reads `C:\ws\my.app\gradlew` as `.app\gradlew`).
  const ext = win32.extname(binary).toLowerCase();
  return ext === '' || ext === '.cmd' || ext === '.bat';
}

// A line break ends the command line whatever the quoting, so nothing can carry
// one.
//
// `%` is deliberately NOT refused, and this is a known gap rather than a safe
// case. cmd.exe expands `%VAR%` before it parses separators, and `quoteShellArg`
// does not count `%` as needing quotes, so a value carrying `%` and nothing else
// reaches cmd unquoted; `bin/nx.ts` loads the workspace's own `.env` before the
// graph is built, so a repo can set the variable too. Refusing it is what an
// earlier revision did, and it made any workspace under a `%` path — a legal
// Windows directory name — unusable. The gap is bounded by the same argument
// that bounds this whole class: a repo that can reach here already has `mvnw` /
// `pom.xml` executing on its behalf.
const LINE_BREAK = /[\r\n]/;

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
  return quoteForCmd(binary, `the path ${JSON.stringify(binary)}`);
}

function quoteForCmd(value: string, described: string): string {
  if (LINE_BREAK.test(value)) {
    throw new Error(
      `Cannot pass ${described} to cmd.exe: a line break inside it would end the command line before cmd.exe reached the rest of it.`
    );
  }
  return quoteShellArg(value);
}

function quoteArgs(args: readonly string[], shell: boolean): string[] {
  if (!shell) {
    return [...args];
  }
  return args.map((arg) =>
    quoteForCmd(arg, `the argument ${JSON.stringify(arg)}`)
  );
}
