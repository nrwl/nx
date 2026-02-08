import * as pc from 'picocolors';
import { EOL } from 'os';
import * as readline from 'readline';
import type { TaskStatus } from '../tasks-runner/tasks-runner';

const GH_GROUP_PREFIX = '::group::';
const GH_GROUP_SUFFIX = '::endgroup::';

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

  private writeToStdOut(str: string) {
    process.stdout.write(str);
  }

  overwriteLine(lineText: string = '') {
    // this replaces the existing text up to the new line length
    process.stdout.write(lineText);
    // clear whatever text might be left to the right of the cursor (happens
    // when existing text was longer than new one)
    readline.clearLine(process.stdout, 1);
    process.stdout.write(EOL);
  }

  private writeOutputTitle({
    color,
    title,
  }: {
    color: string;
    title: string;
  }): void {
    this.writeToStdOut(`${this.applyNxPrefix(color, title)}${EOL}`);
  }

  private writeOptionalOutputBody(bodyLines?: string[]): void {
    if (!bodyLines) {
      return;
    }
    this.addNewline();
    bodyLines.forEach((bodyLine) => this.writeToStdOut(`${bodyLine}${EOL}`));
  }

  applyNxPrefix(color = 'cyan', text: string): string {
    const colorFn = pcColors[color] || ((t: string) => t);
    const nxPrefix = pc.inverse(pc.bold(colorFn(` ${this.cliName} `)));
    return `${nxPrefix}  ${text}`;
  }

  addNewline() {
    this.writeToStdOut(EOL);
  }

  addVerticalSeparator(color = 'gray') {
    this.addNewline();
    this.addVerticalSeparatorWithoutNewLines(color);
    this.addNewline();
  }

  addVerticalSeparatorWithoutNewLines(color = 'gray') {
    this.writeToStdOut(`${this.getVerticalSeparator(color)}${EOL}`);
  }

  getVerticalSeparatorLines(color = 'gray') {
    return ['', this.getVerticalSeparator(color), ''];
  }

  private getVerticalSeparator(color: string): string {
    const colorFn = pcColors[color] || ((t: string) => t);
    return pc.dim(colorFn(this.VERTICAL_SEPARATOR));
  }

  error({ title, slug, bodyLines }: CLIErrorMessageConfig) {
    this.addNewline();

    this.writeOutputTitle({
      color: 'red',
      title: pc.red(title),
    });

    this.writeOptionalOutputBody(bodyLines);

    /**
     * Optional slug to be used in an Nx error message redirect URL
     */
    if (slug && typeof slug === 'string') {
      this.addNewline();
      this.writeToStdOut(
        `${pc.gray(
          '  Learn more about this error: '
        )}https://errors.nx.dev/${slug}${EOL}`
      );
    }

    this.addNewline();
  }

  warn({ title, slug, bodyLines }: CLIWarnMessageConfig) {
    this.addNewline();

    this.writeOutputTitle({
      color: 'yellow',
      title: pc.yellow(title),
    });

    this.writeOptionalOutputBody(bodyLines);

    /**
     * Optional slug to be used in an Nx warning message redirect URL
     */
    if (slug && typeof slug === 'string') {
      this.addNewline();
      this.writeToStdOut(
        `${pc.gray(
          '  Learn more about this warning: '
        )}https://errors.nx.dev/${slug}${EOL}`
      );
    }

    this.addNewline();
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

  logCommand(message: string, taskStatus?: TaskStatus) {
    this.addNewline();
    this.writeToStdOut(this.getCommandWithStatus(message, taskStatus));
    this.addNewline();
    this.addNewline();
  }

  logCommandOutput(message: string, taskStatus: TaskStatus, output: string) {
    let commandOutputWithStatus = this.getCommandWithStatus(
      message,
      taskStatus
    );

    if (
      process.env.NX_SKIP_LOG_GROUPING !== 'true' &&
      process.env.GITHUB_ACTIONS
    ) {
      const icon = this.getStatusIcon(taskStatus);
      commandOutputWithStatus = `${GH_GROUP_PREFIX}${icon} ${commandOutputWithStatus}`;
    }

    this.addNewline();
    this.writeToStdOut(commandOutputWithStatus);
    this.addNewline();
    this.addNewline();
    this.writeToStdOut(output);

    if (
      process.env.NX_SKIP_LOG_GROUPING !== 'true' &&
      process.env.GITHUB_ACTIONS
    ) {
      this.writeToStdOut(GH_GROUP_SUFFIX);
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

  private addTaskStatus(
    taskStatus:
      | 'success'
      | 'failure'
      | 'skipped'
      | 'local-cache-kept-existing'
      | 'local-cache'
      | 'remote-cache',
    commandOutput: string
  ) {
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
