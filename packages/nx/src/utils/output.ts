import * as figures from 'figures';
import { closeSync, openSync, readSync } from 'fs';
import { EOL } from 'os';
import * as pc from 'picocolors';
import * as readline from 'readline';
import { WriteStream } from 'tty';
import type { TaskStatus } from '../tasks-runner/tasks-runner';

/**
 * The statuses whose output can be collapsed to a single line: the task did the
 * work, or the cache stood in for it.
 */
export type CollapsibleTaskStatus = Extract<
  TaskStatus,
  'success' | 'local-cache' | 'local-cache-kept-existing' | 'remote-cache'
>;

const GH_GROUP_PREFIX = '::group::';
const GH_GROUP_SUFFIX = '::endgroup::';

/**
 * `static-failures-only` is `static` with successful tasks collapsed to a single
 * line. They select the same life cycle and differ only in what it prints, so
 * everywhere the life cycle is chosen, the TUI is ruled out, or output is
 * routed, the two behave identically.
 */
export function isStaticOutputStyle(outputStyle: string | undefined): boolean {
  return outputStyle === 'static' || outputStyle === 'static-failures-only';
}

/**
 * Whether a style puts task output on the terminal at all.
 *
 * `summary` does not - it prints a status line and the path to each task's log,
 * deliberately addressing the output instead of reproducing it. So every
 * decision that would put a task's bytes on the terminal has to consult this
 * first, including ones that bypass the life cycle: both batch folds and
 * `BatchProcess`'s live forward write to `output` directly, and under `summary`
 * each would dump exactly what the style exists to keep off the screen.
 *
 * Withholding is only half of it. Whatever a caller suppresses here has to be
 * readable somewhere else, because the style's contract is that the output
 * moved, not that it is gone - `BatchProcess` captures to a file rather than
 * dropping, and `runBatch`'s crash path folds that file into the task results.
 */
export function printsTaskOutput(outputStyle: string | undefined): boolean {
  return outputStyle !== 'summary';
}

/**
 * Whether a run prints every task's output in full rather than collapsing the
 * ones that succeeded. Both static life cycles and the batch renderer have to
 * agree on this, so they read it from here rather than each deriving it.
 *
 * Two styles collapse. `static-failures-only` shows only what failed, and is
 * what a run that named no style gets; `summary` withholds task output
 * altogether, addressing each log by path instead, and outranks `verbose` -
 * asking for more detail cannot turn a style whose whole contract is "the
 * output is on disk" back into one that prints. Every other style prints in
 * full because it was asked for explicitly. Note the static life cycles serve more
 * styles than the static-sounding ones: `shouldUseDynamicLifeCycle` bails on
 * `isCI()` before it looks at the style at all, so in CI `dynamic` and `tui`
 * land here too. This is written as a deny-list for that reason — a new style
 * prints in full until someone decides otherwise, rather than silently
 * collapsing because an allow-list did not list it.
 *
 * Resolving the absent case here rather than assigning `outputStyle` upstream is
 * deliberate: the value is also read by the orchestrator to decide whether a
 * task streams, and naming the default there stops `shouldStreamOutput` from
 * ever being consulted — including for the continuous tasks that must stream.
 */
export function printsFullTaskOutput(args: {
  verbose?: boolean;
  outputStyle?: string;
}): boolean {
  return (
    printsTaskOutput(args.outputStyle) &&
    (!!args.verbose ||
      (args.outputStyle ?? 'static-failures-only') !== 'static-failures-only')
  );
}

/**
 * Whether task output should be wrapped in collapsible log groups. Grouping
 * requires each task's output to be written as one contiguous block, which is
 * why batch mode's implicit streaming backs off when this is on. It does not
 * govern streaming in general — an explicit `--output-style`, the TUI, and
 * long running tasks all still stream.
 */
export function isLogGroupingEnabled(): boolean {
  return (
    process.env.NX_SKIP_LOG_GROUPING !== 'true' && !!process.env.GITHUB_ACTIONS
  );
}

/**
 * Whether a batch task's output should be held back from the live stream and
 * rendered inside a fold instead. A batch worker writes to stdout/stderr live,
 * so forwarding that copy would put its bytes outside the group and defeat the
 * fold; what is held back is written to a file and rendered by the orchestrator.
 *
 * Note it is the captured file, not each task's `terminalOutput`, that makes
 * this lossless. A worker is free to write bytes it attributes to no task —
 * `@nx/maven`'s exit-code dump, `@nx/gradle`'s configuration phase — and those
 * appear in no `terminalOutput` at all, so the fold has to be able to fall back
 * to the file. See `TaskOrchestrator.printGroupedBatchOutput` for when it does.
 *
 * This is only worth doing when grouping is on and the user has not asked to
 * stream — an explicit stream style (which sets NX_STREAM_OUTPUT) wants the
 * live copy, folds or not.
 */
export function shouldGroupBatchOutput(): boolean {
  return isLogGroupingEnabled() && process.env.NX_STREAM_OUTPUT !== 'true';
}

export interface CLIErrorMessageConfig {
  title: string;
  bodyLines?: string[];
  slug?: string;
}

export interface CLIWarnMessageConfig {
  title: string;
  bodyLines?: string[];
  slug?: string;
}

export interface CLINoteMessageConfig {
  title: string;
  bodyLines?: string[];
}

export interface CLISuccessMessageConfig {
  title: string;
  bodyLines?: string[];
}

/**
 * Custom orange color using ANSI 256-color code 214.
 * picocolors does not support keyword-based colors like chalk,
 * so orange is implemented manually.
 */
export function orange(text: string): string {
  return pc.isColorSupported ? `\x1b[38;5;214m${text}\x1b[39m` : String(text);
}

/**
 * Map of color names to picocolors functions, used for dynamic color access.
 */
const pcColors: Record<string, (text: string) => string> = {
  cyan: pc.cyan,
  red: pc.red,
  yellow: pc.yellow,
  green: pc.green,
  gray: pc.gray,
  white: pc.white,
  blue: pc.blue,
  magenta: pc.magenta,
  orange,
};

class CLIOutput {
  cliName = 'NX';
  formatCommand = (taskId: string) => `${pc.dim('nx run')} ${taskId}`;

  /**
   * Longer dash character which forms more of a continuous line when place side to side
   * with itself, unlike the standard dash character
   */
  private get VERTICAL_SEPARATOR() {
    let divider = '';
    for (let i = 0; i < process.stdout.columns - 1; i++) {
      divider += '\u2014';
    }
    return divider;
  }

  /**
   * Expose some color and other utility functions so that other parts of the codebase that need
   * more fine-grained control of message bodies are still using a centralized
   * implementation.
   */
  colors = {
    gray: pc.gray,
    green: pc.green,
    red: pc.red,
    cyan: pc.cyan,
    white: pc.white,
    orange,
  };
  bold = pc.bold;
  underline = pc.underline;
  dim = pc.dim;

  /**
   * Whether the terminal is positioned at the start of a line. Task output does
   * not reliably end in a newline, so writers that must begin on a fresh line
   * ask for one via {@link ensureLineStart} rather than guessing.
   *
   * Holding that true means a writer that can leave the cursor mid-line has to
   * be routed through this class or declared to it. The ones that exist today:
   *
   * - This class's own writes, via {@link writeToStream}.
   * - A batch worker's live output, via {@link writeTaskOutputChunk}.
   * - `nx:run-commands`, which is the only executor that runs in the main
   *   process (`task-orchestrator.ts` gates that on the executor name), and
   *   whose raw writes go through {@link writeTaskOutputChunk} for this reason.
   *   Its `addColorAndPrefix` splits on newlines without ever appending one, so
   *   its chunks routinely end mid-line.
   * - A pseudo-terminal task, which cannot be routed: the native side writes to
   *   this process's stdout from Rust, at arbitrary PTY read boundaries. It
   *   declares itself via {@link noteExternalWrite} instead, which is why that
   *   exists.
   *
   * Two bypasses are deliberate and safe, both because they re-emit output a
   * whole line at a time via `formatPrefixedLines`, which appends `EOL` to every
   * line it writes: forked task streaming through
   * `NodeChildProcessWithNonDirectOutput`'s `addPrefixTransformer`, and
   * `writePrefixedLines` for a main-process `nx:run-commands` under
   * `NX_PREFIX_OUTPUT`.
   *
   * One bypass is known and is NOT safe. With `NX_NATIVE_COMMAND_RUNNER=false`,
   * `forkProcessLegacy` forks with inherited stdio and yields
   * `NodeChildProcessWithDirectOutput`, whose child writes straight to this
   * process's fd 1 at arbitrary boundaries — unroutable and undeclarable from
   * here. Line tracking is simply wrong on that path; it degrades to the
   * pre-tracking behavior of a glued marker rather than to anything new. Do not
   * read this list as closed: it is what is known, and the way to tell you are
   * adding to it is that you are writing to stdout during a run without going
   * through {@link writeToStream}, {@link writeTaskOutputChunk} or
   * {@link noteExternalWrite}.
   */
  private atLineStart = true;

  private writeToStream(str: string, stream: WriteStream = process.stdout) {
    // stdout and stderr share one cursor wherever this matters — a CI log, a
    // terminal — so a write to either moves it.
    if (
      (stream === process.stdout || stream === process.stderr) &&
      str.length > 0
    ) {
      this.atLineStart = str.endsWith('\n');
    }
    stream.write(str);
  }

  /**
   * Forwards a chunk of a task's output live, keeping {@link atLineStart}
   * accurate. Batch workers write raw chunks that routinely end mid-line, and a
   * collapsed summary line must not be glued onto one.
   *
   * @internal Not part of the output API plugins may rely on.
   */
  writeTaskOutputChunk(
    chunk: string | Buffer,
    stream: WriteStream = process.stdout
  ) {
    if (
      chunk.length > 0 &&
      (stream === process.stdout || stream === process.stderr)
    ) {
      // A Buffer is written through undecoded so a chunk that splits a
      // multi-byte character is not mangled; 0x0a only ever encodes a newline
      // in UTF-8, so its last byte answers the question on its own.
      this.atLineStart =
        typeof chunk === 'string'
          ? chunk.endsWith('\n')
          : chunk[chunk.length - 1] === 0x0a;
    }
    stream.write(chunk);
  }

  /**
   * Declares output this class could not route — a pseudo-terminal task's, which
   * the native side writes straight to our stdout — so the next writer needing a
   * fresh line asks for one instead of trusting a stale position.
   *
   * The chunk is inspected rather than assumed mid-line, so output that did end
   * on a line boundary does not cost a blank line. PTY chunks often end in an
   * escape sequence after the newline, and that reads as mid-line, which is the
   * safe direction to be wrong in: a spare newline, never a glued one.
   */
  noteExternalWrite(chunk?: string | Buffer): void {
    if (chunk === undefined || chunk.length === 0) {
      this.atLineStart = false;
      return;
    }
    this.atLineStart =
      typeof chunk === 'string'
        ? chunk.endsWith('\n')
        : chunk[chunk.length - 1] === 0x0a;
  }

  private ensureLineStart() {
    if (!this.atLineStart) {
      this.addNewline();
    }
  }

  overwriteLine(lineText: string = '') {
    // Ensure we always start writing from column 0.
    readline.cursorTo(process.stdout, 0);
    // this replaces the existing text up to the new line length
    process.stdout.write(lineText);
    // clear whatever text might be left to the right of the cursor (happens
    // when existing text was longer than new one)
    readline.clearLine(process.stdout, 1);
    // Move to the next line and re-anchor to column 0 without relying on
    // terminal newline translation behavior.
    process.stdout.write('\n');
    readline.cursorTo(process.stdout, 0);
  }

  private writeOutputTitle(
    {
      color,
      title,
    }: {
      color: string;
      title: string;
    },
    stream: WriteStream = process.stdout
  ): void {
    this.writeToStream(`${this.applyNxPrefix(color, title)}${EOL}`, stream);
  }

  private writeOptionalOutputBody(
    bodyLines?: string[],
    stream: WriteStream = process.stdout
  ): void {
    if (!bodyLines) {
      return;
    }
    this.addNewline(stream);
    bodyLines.forEach((bodyLine) =>
      this.writeToStream(`${bodyLine}${EOL}`, stream)
    );
  }

  applyNxPrefix(color = 'cyan', text: string): string {
    const colorFn = pcColors[color] || ((t: string) => t);
    const nxPrefix = pc.inverse(pc.bold(colorFn(` ${this.cliName} `)));
    return `${nxPrefix}  ${text}`;
  }

  addNewline(stream: WriteStream = process.stdout) {
    this.writeToStream(EOL, stream);
  }

  addVerticalSeparator(color = 'gray') {
    this.addNewline();
    this.addVerticalSeparatorWithoutNewLines(color);
    this.addNewline();
  }

  addVerticalSeparatorWithoutNewLines(color = 'gray') {
    this.writeToStream(`${this.getVerticalSeparator(color)}${EOL}`);
  }

  getVerticalSeparatorLines(color = 'gray') {
    return ['', this.getVerticalSeparator(color), ''];
  }

  private getVerticalSeparator(color: string): string {
    const colorFn = pcColors[color] || ((t: string) => t);
    return pc.dim(colorFn(this.VERTICAL_SEPARATOR));
  }

  error({ title, slug, bodyLines }: CLIErrorMessageConfig) {
    const stream = process.stderr;
    this.addNewline(stream);

    this.writeOutputTitle(
      {
        color: 'red',
        title: pc.red(title),
      },
      stream
    );

    this.writeOptionalOutputBody(bodyLines, stream);

    /**
     * Optional slug to be used in an Nx error message redirect URL
     */
    if (slug && typeof slug === 'string') {
      this.addNewline(stream);
      this.writeToStream(
        `${pc.gray(
          '  Learn more about this error: '
        )}https://errors.nx.dev/${slug}${EOL}`,
        stream
      );
    }

    this.addNewline(stream);
  }

  warn({ title, slug, bodyLines }: CLIWarnMessageConfig) {
    this.addNewline(process.stderr);

    this.writeOutputTitle(
      {
        color: 'yellow',
        title: pc.yellow(title),
      },
      process.stderr
    );

    this.writeOptionalOutputBody(bodyLines, process.stderr);

    /**
     * Optional slug to be used in an Nx warning message redirect URL
     */
    if (slug && typeof slug === 'string') {
      this.addNewline(process.stderr);
      this.writeToStream(
        `${pc.gray(
          '  Learn more about this warning: '
        )}https://errors.nx.dev/${slug}${EOL}`,
        process.stderr
      );
    }

    this.addNewline(process.stderr);
  }

  note({ title, bodyLines }: CLINoteMessageConfig) {
    this.addNewline();

    this.writeOutputTitle({
      color: 'orange',
      title: orange(title),
    });

    this.writeOptionalOutputBody(bodyLines);

    this.addNewline();
  }

  success({ title, bodyLines }: CLISuccessMessageConfig) {
    this.addNewline();

    this.writeOutputTitle({
      color: 'green',
      title: pc.green(title),
    });

    this.writeOptionalOutputBody(bodyLines);

    this.addNewline();
  }

  logSingleLine(message: string) {
    this.addNewline();

    this.writeOutputTitle({
      color: 'gray',
      title: message,
    });

    this.addNewline();
  }

  logRawLine(message: string) {
    this.writeToStream(`${message}${EOL}`);
    this.addNewline();
  }

  logCommand(message: string, taskStatus?: TaskStatus) {
    this.addNewline();
    this.writeToStream(this.getCommandWithStatus(message, taskStatus));
    this.addNewline();
    this.addNewline();
  }

  logCommandOutput(message: string, taskStatus: TaskStatus, output: string) {
    let commandOutputWithStatus = this.getCommandWithStatus(
      message,
      taskStatus
    );

    const grouped = isLogGroupingEnabled();
    if (grouped) {
      const icon = this.getStatusIcon(taskStatus);
      commandOutputWithStatus = `${GH_GROUP_PREFIX}${icon} ${commandOutputWithStatus}`;
    }

    this.addNewline();
    this.writeToStream(commandOutputWithStatus);
    this.addNewline();
    this.addNewline();
    this.writeToStream(output);

    if (grouped) {
      // GitHub only recognizes ::endgroup:: as a workflow command when it
      // starts a line, and task output routinely lacks a trailing newline.
      this.ensureLineStart();
      this.writeToStream(`${GH_GROUP_SUFFIX}${EOL}`);
    }
  }

  /**
   * A single line standing in for a task's full output, used when the output
   * itself carries no information worth printing (a success, or a cache hit).
   * Statuses that carry a diagnosable body are deliberately not accepted here.
   */
  logCommandSummary(message: string, taskStatus: CollapsibleTaskStatus) {
    // The preceding task may have left the cursor mid-line, and this line must
    // not be glued onto the end of that task's output.
    this.ensureLineStart();
    const icon = pc.green(figures.tick);
    const command = this.addTaskStatus(
      taskStatus,
      this.formatCommand(this.normalizeMessage(message))
    );
    this.writeToStream(`${icon}  ${command}${EOL}`);
  }

  /**
   * A one-line stand-in for a task whose full output is shown elsewhere — used
   * for the tasks of a batch rendered as a single log group rather than per
   * task. `note` points the reader at that group.
   */
  logCommandRedirect(
    message: string,
    // A skipped task never ran, so it has no fold to be redirected to - and the
    // icon ladder below would render it with the success tick. Excluding it
    // makes the call site's `status !== 'skipped'` check a consequence of the
    // type rather than a convention to remember.
    taskStatus: Exclude<TaskStatus, 'skipped'>,
    note: string
  ) {
    this.ensureLineStart();
    // A stopped task did not fail; it never got to finish. The TUI summary
    // already draws that distinction, so use the same glyph.
    const icon =
      taskStatus === 'stopped'
        ? pc.cyan(figures.squareSmallFilled)
        : taskStatus === 'failure'
          ? pc.red(figures.cross)
          : pc.green(figures.tick);
    const command = this.formatCommand(this.normalizeMessage(message));
    this.writeToStream(`${icon}  ${command}  ${pc.dim(note)}${EOL}`);
  }

  /**
   * Prints a batch's combined output as one log group. A batch runner's
   * diagnostics — a crash, a config-phase error, a runner summary — belong to no
   * single task, so the group is labelled with the batch rather than a task.
   *
   * The batch's own output is copied straight from the file it was captured
   * into, so an arbitrarily long log costs a fixed amount of memory here.
   * Nothing is withheld: this rendering is chosen because the whole log was
   * asked for, because no task claimed any of it, or because a task failed or
   * was stopped — in which case repeating claimed bytes beside the per-task
   * blocks is deliberate (see TaskOrchestrator.printGroupedBatchOutput).
   */
  logBatchGroup(
    label: string,
    body: { capturedOutputPath?: string; trailer?: string },
    taskStatus: TaskStatus
  ) {
    const grouped = isLogGroupingEnabled();
    let header = `${pc.dim('> ')}${pc.bold(label)}`;
    if (grouped) {
      header = `${GH_GROUP_PREFIX}${this.getStatusIcon(taskStatus)} ${header}`;
    }

    this.addNewline();
    this.writeToStream(header);
    this.addNewline();
    this.addNewline();
    try {
      if (body.capturedOutputPath) {
        this.copyFileToStream(body.capturedOutputPath);
      }
      if (body.trailer) {
        this.ensureLineStart();
        this.writeToStream(`${body.trailer}${EOL}`);
      }
    } finally {
      // The header is already on the stream, so an exception while rendering
      // the body must not skip the terminator: GitHub would fold every line
      // after this point into a group that never closes, swallowing the rest of
      // the run's output rather than just this batch's.
      if (grouped) {
        this.ensureLineStart();
        this.writeToStream(`${GH_GROUP_SUFFIX}${EOL}`);
      } else {
        this.ensureLineStart();
      }
    }
  }

  /**
   * Copies a file to stdout a chunk at a time. Reading it into one string would
   * reintroduce the unbounded growth that writing it to disk avoided, and a
   * long batch log can exceed the maximum length of a JS string.
   */
  private copyFileToStream(path: string) {
    let fd: number;
    try {
      fd = openSync(path, 'r');
    } catch {
      // The batch left nothing behind, or it is already cleaned up. The tasks'
      // own redirect lines still point at this group.
      return;
    }
    try {
      const buffer = Buffer.allocUnsafe(64 * 1024);
      let bytesRead: number;
      while ((bytesRead = readSync(fd, buffer, 0, buffer.length, null)) > 0) {
        // Copy before writing. `stream.write` queues a Buffer by reference, and
        // stdout is a pipe wherever grouping is on, so a backed-up write would
        // still be holding this memory when the next read overwrites it.
        this.writeTaskOutputChunk(Buffer.from(buffer.subarray(0, bytesRead)));
      }
    } finally {
      closeSync(fd);
    }
  }

  private getCommandWithStatus(
    message: string,
    taskStatus: TaskStatus
  ): string {
    const commandOutput =
      pc.dim('> ') + this.formatCommand(this.normalizeMessage(message));
    return this.addTaskStatus(taskStatus, commandOutput);
  }

  private getStatusIcon(taskStatus: TaskStatus): string {
    switch (taskStatus) {
      case 'success':
        return '✅';
      case 'failure':
        return '❌';
      case 'stopped':
        return '⏹️';
      case 'skipped':
      case 'local-cache-kept-existing':
        return '⏩';
      case 'local-cache':
      case 'remote-cache':
        return '🔁';
      default: {
        // The repo compiles with `strict: false`, so a `: string` return type
        // alone does not reject a fallthrough - `undefined` stays assignable.
        // This does: a new `TaskStatus` member fails to narrow to `never` here.
        // Worth the lines because the gap already shipped once, rendering
        // `::group::undefined > nx run ...` for a stopped task.
        const unhandled: never = taskStatus;
        void unhandled;
        // Returning `unhandled` would print the status text where an icon goes
        // (`::group::queued > nx run ...`) for a value that reached us over IPC
        // or from cache metadata without passing the compiler. No icon reads
        // better than a wrong one.
        return '';
      }
    }
  }

  private normalizeMessage(message: string) {
    if (message.startsWith('nx run ')) {
      return message.substring('nx run '.length);
    } else if (message.startsWith('run ')) {
      return message.substring('run '.length);
    } else {
      return message;
    }
  }

  private addTaskStatus(taskStatus: TaskStatus, commandOutput: string) {
    if (taskStatus === 'local-cache') {
      return `${commandOutput}  ${pc.dim('[local cache]')}`;
    } else if (taskStatus === 'remote-cache') {
      return `${commandOutput}  ${pc.dim('[remote cache]')}`;
    } else if (taskStatus === 'local-cache-kept-existing') {
      return `${commandOutput}  ${pc.dim(
        '[existing outputs match the cache, left as is]'
      )}`;
    } else {
      return commandOutput;
    }
  }

  log({ title, bodyLines, color }: CLIWarnMessageConfig & { color?: string }) {
    this.addNewline();

    const colorFn = color ? pcColors[color] : undefined;
    this.writeOutputTitle({
      color: 'cyan',
      title: colorFn ? colorFn(title) : title,
    });

    this.writeOptionalOutputBody(bodyLines);

    this.addNewline();
  }

  drain(): Promise<void> {
    return new Promise((resolve) => {
      if (process.stdout.writableNeedDrain) {
        process.stdout.once('drain', resolve);
      } else {
        resolve();
      }
    });
  }
}

export const output = new CLIOutput();
