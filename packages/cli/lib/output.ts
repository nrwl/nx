/**
 * This file has been copied from workspace/src/command-line/output
 * Consider that file to be the golden source. Changes (which should be few)
 * should be copied here if necessary.
 */
import { Instance as Chalk } from 'chalk';
import * as isCI from 'is-ci';

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

export interface CLILogMessageConfig {
  title: string;
  bodyLines?: string[];
}

export interface CLINoteMessageConfig {
  title: string;
  bodyLines?: string[];
}

export interface CLISuccessMessageConfig {
  title: string;
}

/**
 * Automatically disable styling applied by chalk if on CI
 */
const chalk = new Chalk({ level: isCI ? 0 : undefined });

class CLIOutput {
  private readonly NX_PREFIX = `${chalk.cyan(
    '>'
  )} ${chalk.reset.inverse.bold.cyan(' NX ')}`;
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
    gray: chalk.gray,
  };
  bold = chalk.bold;
  underline = chalk.underline;

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
    this.writeToStdOut(`\n${chalk.gray(this.VERTICAL_SEPARATOR)}\n\n`);
  }

  error({ title, slug, bodyLines }: CLIErrorMessageConfig) {
    this.addNewline();

    this.writeOutputTitle({
      label: chalk.reset.inverse.bold.red(' ERROR '),
      title: chalk.bold.red(title),
    });

    this.writeOptionalOutputBody(bodyLines);

    /**
     * Optional slug to be used in an Nx error message redirect URL
     */
    if (slug && typeof slug === 'string') {
      this.addNewline();
      this.writeToStdOut(
        `${chalk.grey(
          '  Learn more about this error: '
        )}https://errors.nx.dev/${slug}\n`
      );
    }

    this.addNewline();
  }

  warn({ title, slug, bodyLines }: CLIWarnMessageConfig) {
    this.addNewline();

    this.writeOutputTitle({
      label: chalk.reset.inverse.bold.yellow(' WARNING '),
      title: chalk.bold.yellow(title),
    });

    this.writeOptionalOutputBody(bodyLines);

    /**
     * Optional slug to be used in an Nx warning message redirect URL
     */
    if (slug && typeof slug === 'string') {
      this.addNewline();
      this.writeToStdOut(
        `${chalk.grey(
          '  Learn more about this warning: '
        )}https://errors.nx.dev/${slug}\n`
      );
    }

    this.addNewline();
  }

  note({ title, bodyLines }: CLINoteMessageConfig) {
    this.addNewline();

    this.writeOutputTitle({
      label: chalk.reset.inverse.bold.keyword('orange')(' NOTE '),
      title: chalk.bold.keyword('orange')(title),
    });

    this.writeOptionalOutputBody(bodyLines);

    this.addNewline();
  }

  success({ title }: CLISuccessMessageConfig) {
    this.addNewline();

    this.writeOutputTitle({
      label: chalk.reset.inverse.bold.green(' SUCCESS '),
      title: chalk.bold.green(title),
    });

    this.addNewline();
  }

  logSingleLine(message: string) {
    this.addNewline();

    this.writeOutputTitle({
      title: message,
    });

    this.addNewline();
  }

  log({ title, bodyLines }: CLIWarnMessageConfig) {
    this.addNewline();

    this.writeOutputTitle({
      title: chalk.white(title),
    });

    this.writeOptionalOutputBody(bodyLines);

    this.addNewline();
  }
}

export const output = new CLIOutput();
