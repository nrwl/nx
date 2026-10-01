import { dots } from 'cli-spinners';
import * as figures from 'figures';
import * as pc from 'picocolors';
import { clearLine, cursorTo, moveCursor } from 'readline';
import stringWidth from 'string-width';
import { stripVTControlCharacters } from 'util';
import { isCI } from './is-ci';

export const SHOULD_SHOW_SPINNERS = process.stdout.isTTY && !isCI();

/**
 * A single-line spinner on stderr. When stderr is not an interactive terminal,
 * `start`, `succeed`, and `fail` print plain lines instead.
 */
export class Spinner {
  text: string;
  prefixText: string | undefined;

  #stream = process.stderr;
  #enabled = this.#stream.isTTY && !isCI();
  #interval: NodeJS.Timeout | undefined;
  #frameIndex = 0;
  #linesToClear = 0;

  constructor(text = '') {
    this.text = text;
  }

  get isSpinning(): boolean {
    return this.#interval !== undefined;
  }

  start(text?: string): this {
    if (text !== undefined) {
      this.text = text;
    }
    if (!this.#enabled) {
      if (this.text) {
        this.#stream.write(`- ${this.text}\n`);
      }
      return this;
    }
    if (this.isSpinning) {
      return this;
    }
    this.#render();
    this.#interval = setInterval(() => this.#render(), dots.interval);
    this.#interval.unref();
    return this;
  }

  stop(): this {
    if (this.#interval) {
      clearInterval(this.#interval);
      this.#interval = undefined;
    }
    this.#clear();
    return this;
  }

  succeed(text?: string): this {
    return this.#persist(pc.green(figures.tick), text);
  }

  fail(text?: string): this {
    return this.#persist(pc.red(figures.cross), text);
  }

  #persist(symbol: string, text = this.text): this {
    this.stop();
    this.#stream.write(`${this.#prefix()}${symbol} ${text}\n`);
    return this;
  }

  #prefix(): string {
    return this.prefixText ? `${this.prefixText} ` : '';
  }

  #render() {
    this.#clear();
    const frame = dots.frames[this.#frameIndex];
    this.#frameIndex = (this.#frameIndex + 1) % dots.frames.length;
    const line = `${this.#prefix()}${pc.cyan(frame)} ${this.text}`;
    this.#stream.write(line);
    this.#linesToClear = this.#countRows(line);
  }

  #clear() {
    if (!this.#linesToClear) {
      return;
    }
    cursorTo(this.#stream, 0);
    for (let i = 0; i < this.#linesToClear; i++) {
      if (i > 0) {
        moveCursor(this.#stream, 0, -1);
      }
      clearLine(this.#stream, 1);
    }
    this.#linesToClear = 0;
  }

  // Long text wraps, and every wrapped row must be cleared before a redraw.
  #countRows(line: string): number {
    const columns = this.#stream.columns || 80;
    return stripVTControlCharacters(line)
      .split('\n')
      .reduce(
        (rows, text) =>
          rows + Math.max(1, Math.ceil(stringWidth(text) / columns)),
        0
      );
  }
}

export interface StartSpinnerOptions {
  /**
   * When `true`, the text passed to `start`, `succeed`, and `fail` is NOT
   * emitted in non-TTY environments. By default (`false`), the text is logged
   * via `console.warn` so progress information isn't lost in non-interactive
   * environments. Set to `true` when completion is reported through a
   * different mechanism (e.g. a batched logger).
   *
   * Defaults to `false`.
   */
  skipNonTtyLogging?: boolean;
}

class SpinnerManager {
  #spinner: Spinner | undefined;
  #prefix: string | undefined;
  #skipNonTtyLogging = false;

  start(
    text?: string,
    prefix?: string,
    opts?: StartSpinnerOptions
  ): SpinnerManager {
    this.#skipNonTtyLogging = opts?.skipNonTtyLogging ?? false;
    if (this.#handleNonTty(text)) {
      return this;
    }
    if (prefix !== undefined) {
      this.#prefix = prefix;
    }
    this.#spinner ??= new Spinner();
    this.#spinner.prefixText = this.#prefix;
    this.#spinner.start(text ?? '');
    return this;
  }

  succeed(text?: string) {
    if (this.#handleNonTty(text)) {
      return;
    }
    this.#spinner?.succeed(text);
  }

  stop() {
    this.#spinner?.stop();
  }

  fail(text?: string) {
    if (this.#handleNonTty(text)) {
      return;
    }
    this.#spinner?.fail(text);
  }

  updateText(text?: string) {
    if (this.#spinner) {
      this.#spinner.text = text ?? '';
    } else if (SHOULD_SHOW_SPINNERS) {
      this.#spinner = new Spinner(text);
      this.#spinner.prefixText = this.#prefix;
    }
  }

  isSpinning() {
    return this.#spinner?.isSpinning ?? false;
  }

  // Returns `true` when the caller should short-circuit because stdout isn't a
  // TTY (text emitted via `console.warn` unless the caller opted out).
  #handleNonTty(text?: string): boolean {
    if (SHOULD_SHOW_SPINNERS) {
      return false;
    }
    if (!this.#skipNonTtyLogging && text) {
      console.warn(text);
    }
    return true;
  }
}

export const globalSpinner = new SpinnerManager();
