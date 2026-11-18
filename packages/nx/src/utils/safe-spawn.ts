import {
  ChildProcess,
  execFileSync,
  ExecFileSyncOptions,
  spawn,
  SpawnOptions,
} from 'child_process';
import { win32 } from 'path';
import { LINE_BREAK, quoteShellArg } from './shell-quoting';

// Node refuses to launch a Windows `.cmd`/`.bat` shim without a shell
// (CVE-2024-27980). A bare name takes the shell for the same reason, one step
// removed: libuv walks PATH and PATHEXT itself, so no shell is needed to *find*
// the binary — but the walk may land on a `.cmd`/`.bat`, and this cannot know
// which in advance, so it is deliberately conservative. Everything else,
// including a `.exe`, spawns directly, so the shell and the quoting below reach
// only the invocations that cannot do without them.
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

// `%` is deliberately NOT refused, and this is a known gap rather than a safe
// case. cmd.exe expands `%VAR%` whether or not the value is quoted — see
// `quoteShellArg`'s own docstring in ./shell-quoting, which says so and pins it
// with a test — so quoting contains nothing here. It applies to the binary path
// as much as to the arguments, and an expansion yielding a `"` defeats the
// literal-quote refusal below, because that inspects the pre-expansion bytes.
// `bin/nx.ts` loads the workspace's own `.env` before the graph is built, so a
// repo can set the variable too.
//
// Refusing `%` is what an earlier revision did, and it made any workspace under
// a `%` path — a legal Windows directory name — fail graph construction. The gap
// is bounded by the argument that bounds this whole class: a repo that can reach
// here already has `mvnw` / `pom.xml` executing on its behalf. Closing it
// properly is tracked as NXC-4798.

/**
 * Spawn a binary that may be a Windows `.cmd`/`.bat` shim, without letting its
 * arguments become shell syntax.
 *
 * Off Windows, and for a `.exe`, no shell is involved at all. Where one is —
 * a shim or a bare name — the binary and every argument are quoted for cmd.exe.
 *
 * Not a complete guarantee: cmd.exe expands `%VAR%` in the binary or any
 * argument whether or not it is quoted, so a caller with untrusted arguments
 * inherits that gap (NXC-4798). See the note on `LINE_BREAK` above.
 *
 * @throws on Windows when the binary or an argument contains a line break, or a
 * literal `"` (via `quoteShellArg`). Those are the only refusals — the `%`
 * expansion above is not one of them.
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
 *
 * Carries the same Windows caveats: `%VAR%` is expanded quoted or not
 * (NXC-4798), and a line break or literal `"` throws.
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
// path holding a space or an `&` would split there.
function quoteBinary(binary: string, shell: boolean): string {
  if (!shell) {
    return binary;
  }
  return quoteForCmd(binary, `the path ${JSON.stringify(binary)}`);
}

function quoteForCmd(value: string, described: string, remedy = ''): string {
  if (LINE_BREAK.test(value)) {
    throw new Error(
      `Cannot pass ${described} to cmd.exe: a line break inside it would end the command line before cmd.exe reached the rest of it.${remedy}`
    );
  }
  return quoteShellArg(value);
}

function quoteArgs(args: readonly string[], shell: boolean): string[] {
  if (!shell) {
    return [...args];
  }
  return args.map((arg) =>
    quoteForCmd(
      arg,
      `the argument ${JSON.stringify(arg)}`,
      ' Remove it from your Nx configuration and try again.'
    )
  );
}
