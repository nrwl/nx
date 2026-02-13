/*
 * Because we don't want to depend on @nx/workspace (to speed up the workspace creation)
 * we duplicate the helper functions from @nx/workspace in this file.
 */

import { styleText } from 'node:util';
import { EOL } from 'os';
import { isCI } from './ci/is-ci';

export interface CLIErrorMessageConfig {
  title: string;
  bodyLines?: string[];
}

export interface CLIWarnMessageConfig {
  title: string;
  bodyLines?: string[];
}

export interface CLINoteMessageConfig {
  title: string;
  bodyLines?: string[];
}

export interface CLISuccessMessageConfig {
  title: string;
  bodyLines?: string[];
}

const IS_COLOR_SUPPORTED =
  !isCI() &&
  !(!!process.env.NO_COLOR || process.argv.includes('--no-color')) &&
  (!!process.env.FORCE_COLOR ||
    process.argv.includes('--color') ||
    process.platform === 'win32' ||
    ((process.stdout || {}).isTTY && process.env.TERM !== 'dumb'));

/**
 * Custom orange color using ANSI 256-color code 214.
 * native styleText does not support keyword-based colors like chalk,
 * so orange is implemented manually.
 */
function orange(text: string): string {
  return IS_COLOR_SUPPORTED ? `\x1b[38;5;214m${text}\x1b[39m` : String(text);
}

export class CLIOutput {
  private outstream = this.real ? process.stdout : new FakeStdout();
  constructor(private real = true) {}
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
    gray: (text: string) => styleText('gray', text),
    green: (text: string) => styleText('green', text),
    red: (text: string) => styleText('red', text),
    cyan: (text: string) => styleText('cyan', text),
    white: (text: string) => styleText('white', text),
  };
  bold = (text) => styleText('bold', String(text));
  underline = (text) => styleText('underline', String(text));
  dim = (text) => styleText('dim', String(text));

  private writeToStdOut(str: string) {
    this.outstream.write(str);
  }

  private writeOutputTitle({
    color,
    title,
  }: {
    color: string;
    title: string;
  }): void {
    this.writeToStdOut(`${this.applyCLIPrefix(color, title)}${EOL}`);
  }

  private writeOptionalOutputBody(bodyLines?: string[]): void {
    if (!bodyLines) {
      return;
    }
    this.addNewline();
    bodyLines.forEach((bodyLine) => this.writeToStdOut(`${bodyLine}${EOL}`));
  }

  private cliName = 'NX';

  setCliName(name: string) {
    this.cliName = name;
  }

  applyCLIPrefix(color = 'cyan', text: string): string {
    let cliPrefix = '';
    if (color === 'orange') {
      cliPrefix = styleText(['inverse', 'bold'], orange(` ${this.cliName} `));
    } else {
      cliPrefix = styleText(
        ['inverse', 'bold', color as any],
        ` ${this.cliName} `
      );
    }
    return `${cliPrefix}  ${text}`;
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
    this.writeToStdOut(
      `${styleText('dim', styleText(color as any, this.VERTICAL_SEPARATOR))}${EOL}`
    );
  }

  error({ title, bodyLines }: CLIErrorMessageConfig) {
    this.addNewline();

    this.writeOutputTitle({
      color: 'red',
      title: styleText('red', title),
    });

    this.writeOptionalOutputBody(bodyLines);

    this.addNewline();
  }

  warn({ title, bodyLines }: CLIWarnMessageConfig) {
    this.addNewline();

    this.writeOutputTitle({
      color: 'yellow',
      title: styleText('yellow', title),
    });

    this.writeOptionalOutputBody(bodyLines);

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
      title: styleText('green', title),
    });

    this.writeOptionalOutputBody(bodyLines);
  }

  logSingleLine(message: string) {
    this.addNewline();

    this.writeOutputTitle({
      color: 'gray',
      title: message,
    });

    this.addNewline();
  }

  log({ title, bodyLines, color }: CLIWarnMessageConfig & { color?: string }) {
    this.addNewline();

    this.writeOutputTitle({
      color: 'cyan',
      title: color ? styleText(color as any, title) : title,
    });

    this.writeOptionalOutputBody(bodyLines);

    this.addNewline();
  }

  getOutput() {
    return this.outstream.toString();
  }
}

export const output = new CLIOutput();

class FakeStdout {
  private content = '';
  write(str: string) {
    this.content += str;
  }

  toString() {
    return this.content;
  }
}
