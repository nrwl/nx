import * as figures from 'figures';
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
   * Whether stdout is positioned at the start of a line. Task output does not
   * reliably end in a newline, so writers that must begin on a fresh line ask
   * for one via {@link ensureLineStart} rather than guessing.
   */
  private atLineStart = true;

  private writeToStream(str: string, stream: WriteStream = process.stdout) {
    if (stream === process.stdout && str.length > 0) {
      this.atLineStart = str.endsWith('\n');
    }
    stream.write(str);
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

  private getCommandWithStatus(
    message: string,
    taskStatus: TaskStatus
  ): string {
    const commandOutput =
      pc.dim('> ') + this.formatCommand(this.normalizeMessage(message));
    return this.addTaskStatus(taskStatus, commandOutput);
  }

  private getStatusIcon(taskStatus: TaskStatus) {
    switch (taskStatus) {
      case 'success':
        return '✅';
      case 'failure':
        return '❌';
      case 'skipped':
      case 'local-cache-kept-existing':
        return '⏩';
      case 'local-cache':
      case 'remote-cache':
        return '🔁';
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
