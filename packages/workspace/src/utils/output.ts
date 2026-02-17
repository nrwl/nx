import { styleText } from 'node:util';

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

const IS_COLOR_SUPPORTED =
  !(!!process.env.NO_COLOR || process.argv.includes('--no-color')) &&
  (!!process.env.FORCE_COLOR ||
    process.argv.includes('--color') ||
    process.platform === 'win32' ||
    ((process.stdout || {}).isTTY && process.env.TERM !== 'dumb') ||
    !!process.env.CI);

/**
 * Automatically disable styling when CI=true
 */
const noStyle = process.env.CI === 'true';

/**
 * Custom orange color using ANSI 256-color code 214.
 * native styleText does not support keyword-based colors like chalk,
 * so orange is implemented manually.
 */
function orange(text: string): string {
  if (noStyle || !IS_COLOR_SUPPORTED) return String(text);
  return `\x1b[38;5;214m${text}\x1b[39m`;
}

class CLIOutput {
  private readonly NX_PREFIX = styleText(['inverse', 'bold', 'cyan'], ' NX ');
  /**
   * Longer dash character which forms more of a continuous line when place side to side
   * with itself, unlike the standard dash character
   */
  private readonly VERTICAL_SEPARATOR =
    '———————————————————————————————————————————————';

  /**
   * Expose some color and other utility functions so that other parts of the codebase that need
   * more fine-grained control of message bodies are still using a centralized
   * implementation.
   */
  colors = {
    gray: (text: string) => styleText('gray', text),
  };
  bold = (text) => styleText('bold', String(text));
  underline = (text) => styleText('underline', String(text));

  private writeToStdOut(str: string) {
    process.stdout.write(str);
  }

  private writeOutputTitle({
    label,
    title,
  }: {
    label?: string;
    title: string;
  }): void {
    let outputTitle: string;
    if (label) {
      outputTitle = `${this.NX_PREFIX} ${label} ${title}\n`;
    } else {
      outputTitle = `${this.NX_PREFIX} ${title}\n`;
    }
    this.writeToStdOut(outputTitle);
  }

  private writeOptionalOutputBody(bodyLines?: string[]): void {
    if (!bodyLines) {
      return;
    }
    this.addNewline();
    bodyLines.forEach((bodyLine) => this.writeToStdOut(`  ${bodyLine}\n`));
  }

  addNewline() {
    this.writeToStdOut('\n');
  }

  addVerticalSeparator() {
    this.writeToStdOut(`\n${styleText('gray', this.VERTICAL_SEPARATOR)}\n\n`);
  }

  addVerticalSeparatorWithoutNewLines() {
    this.writeToStdOut(`${styleText('gray', this.VERTICAL_SEPARATOR)}\n`);
  }

  error({ title, slug, bodyLines }: CLIErrorMessageConfig) {
    this.addNewline();

    this.writeOutputTitle({
      label: styleText(['inverse', 'bold', 'red'], ' ERROR '),
      title: styleText(['bold', 'red'], title),
    });

    this.writeOptionalOutputBody(bodyLines);

    /**
     * Optional slug to be used in an Nx error message redirect URL
     */
    if (slug && typeof slug === 'string') {
      this.addNewline();
      this.writeToStdOut(
        `${styleText(
          'gray',
          '  Learn more about this error: '
        )}https://errors.nx.dev/${slug}\n`
      );
    }

    this.addNewline();
  }

  warn({ title, slug, bodyLines }: CLIWarnMessageConfig) {
    this.addNewline();

    this.writeOutputTitle({
      label: styleText(['inverse', 'bold', 'yellow'], ' WARNING '),
      title: styleText(['bold', 'yellow'], title),
    });

    this.writeOptionalOutputBody(bodyLines);

    /**
     * Optional slug to be used in an Nx warning message redirect URL
     */
    if (slug && typeof slug === 'string') {
      this.addNewline();
      this.writeToStdOut(
        `${styleText(
          'gray',
          '  Learn more about this warning: '
        )}https://errors.nx.dev/${slug}\n`
      );
    }

    this.addNewline();
  }

  note({ title, bodyLines }: CLINoteMessageConfig) {
    this.addNewline();

    this.writeOutputTitle({
      label: styleText(['inverse', 'bold'], orange(' NOTE ')),
      title: styleText('bold', orange(title)),
    });

    this.writeOptionalOutputBody(bodyLines);

    this.addNewline();
  }

  success({ title, bodyLines }: CLISuccessMessageConfig) {
    this.addNewline();

    this.writeOutputTitle({
      label: styleText(['inverse', 'bold', 'green'], ' SUCCESS '),
      title: styleText(['bold', 'green'], title),
    });

    this.writeOptionalOutputBody(bodyLines);

    this.addNewline();
  }

  logSingleLine(message: string) {
    this.addNewline();

    this.writeOutputTitle({
      title: message,
    });

    this.addNewline();
  }

  logCommand(message: string, isCached: boolean = false) {
    this.addNewline();

    this.writeToStdOut(styleText('bold', `> ${message} `));

    if (isCached) {
      this.writeToStdOut(styleText(['bold', 'gray'], `[retrieved from cache]`));
    }

    this.addNewline();
  }

  log({ title, bodyLines }: CLIWarnMessageConfig) {
    this.addNewline();

    this.writeOutputTitle({
      title: styleText('white', title),
    });

    this.writeOptionalOutputBody(bodyLines);

    this.addNewline();
  }
}

export const output = new CLIOutput();
