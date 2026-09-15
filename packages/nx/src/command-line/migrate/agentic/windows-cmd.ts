import { SpawnOptions } from 'child_process';
import { extname } from 'path';

// Backslash-escape embedded quotes per MS C runtime convention, then wrap in
// quotes. Callers caret-escape cmd.exe metacharacters on top.
export function quoteCmdArg(arg: string): string {
  return `"${arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, '$1$1')}"`;
}

const CMD_META_CHARS = /([()\][!^"`<>&|;, ])/g;

export function caretEscape(quoted: string): string {
  return quoted.replace(CMD_META_CHARS, '^$1');
}

/**
 * Stops cmd.exe expanding `%VAR%` inside an argument. A caret cannot escape
 * `%`, since expansion runs before caret processing, so each `%` becomes
 * `%%cd:~,%`: `%cd:~,%` is a zero-length substring of a built-in and expands to
 * nothing, leaving the leading `%`. Runs after the caret passes so the `,` it
 * introduces stays uncareted, which the substring syntax requires.
 */
export function neutralizePercent(escaped: string): string {
  return escaped.replace(/%/g, '%%cd:~,%');
}

// "The maximum length of the string that you can use at the command prompt is
// 8191 characters".
// https://learn.microsoft.com/troubleshoot/windows-client/shell-experience/command-line-string-limitation
export const WINDOWS_COMMAND_LINE_LIMIT = 8191;
// Absorbs cmd.exe's own accounting of the string, which cannot be measured
// from here.
const WINDOWS_COMMAND_LINE_RESERVE = 1000;
export const WINDOWS_COMMAND_LINE_BUDGET =
  WINDOWS_COMMAND_LINE_LIMIT - WINDOWS_COMMAND_LINE_RESERVE;

export interface AdaptedSpawn {
  binary: string;
  args: string[];
  options: SpawnOptions;
  /**
   * Length of the command line Windows will receive. Set only on the `cmd.exe`
   * wrapper path.
   */
  commandLineLength?: number;
}

/**
 * Node's `spawn` cannot directly execute `.cmd` / `.bat` shims on Windows;
 * `which` resolves to those when an agent was installed via npm. Wrap them in
 * a `cmd.exe /c` invocation with `windowsVerbatimArguments` so quoting follows
 * the cmd.exe convention rather than Node's default cooking.
 *
 * On non-Windows or for non-shim binaries this is a passthrough.
 */
export function adaptSpawnForWindowsShim(
  binary: string,
  args: readonly string[],
  options: SpawnOptions
): AdaptedSpawn {
  if (process.platform !== 'win32') {
    return { binary, args: [...args], options };
  }
  const ext = extname(binary).toLowerCase();
  if (ext !== '.cmd' && ext !== '.bat') {
    return { binary, args: [...args], options };
  }

  assertNoLineBreaks(binary, args);
  const cmdLine = [escapeCmdCommand(binary), ...args.map(escapeCmdArg)].join(
    ' '
  );
  const comspec = process.env.comspec || 'cmd.exe';
  // Both modes are set rather than inherited, since a machine-wide registry
  // setting can flip either: `/e:on` for the `%cd:~,%` substring, `/v:off` so a
  // `!` stays literal. The outer quotes stop `cmd.exe /c` stripping the inner
  // ones around the binary path.
  const cmdArgs = ['/e:on', '/v:off', '/d', '/s', '/c', `"${cmdLine}"`];
  return {
    binary: comspec,
    args: cmdArgs,
    options: { ...options, windowsVerbatimArguments: true },
    // `windowsVerbatimArguments` makes the command line the argv joined by
    // single spaces, so this is what CreateProcess and then cmd.exe see.
    commandLineLength: [comspec, ...cmdArgs].join(' ').length,
  };
}

// No escaping reproduces a line break on the other side, and cmd.exe truncates
// the command line at it, so the call is refused.
function assertNoLineBreaks(binary: string, args: readonly string[]): void {
  const offending = [binary, ...args].find((value) => /[\r\n]/.test(value));
  if (offending !== undefined) {
    throw new Error(
      `Cannot pass a multi-line argument to "${binary}" on Windows: cmd.exe truncates the command line at the line break. Offending argument: ${JSON.stringify(
        offending.slice(0, 120)
      )}`
    );
  }
}

function escapeCmdArg(arg: string): string {
  return neutralizePercent(caretEscape(quoteCmdArg(arg)));
}

// cmd.exe parses the command portion twice, so it is caret-escaped twice.
function escapeCmdCommand(arg: string): string {
  return neutralizePercent(caretEscape(caretEscape(quoteCmdArg(arg))));
}
