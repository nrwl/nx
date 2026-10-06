import ora from 'ora';
import { isCI } from './is-ci';

export const SHOULD_SHOW_SPINNERS = process.stdout.isTTY && !isCI();

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
  #ora!: ReturnType<typeof ora>;
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
    if (this.#ora) {
      this.#ora.text = text;
      this.#ora.prefixText = this.#prefix;
    } else {
      this.#createOra(text);
    }
    this.#ora.start();
    return this;
  }

  succeed(text?: string) {
    if (this.#handleNonTty(text)) {
      return;
    }
    this.#ora?.succeed(text);
  }

  stop() {
    this.#ora?.stop();
  }

  fail(text?: string) {
    if (this.#handleNonTty(text)) {
      return;
    }
    this.#ora?.fail(text);
  }

  updateText(text?: string) {
    if (this.#ora) {
      this.#ora.text = text;
    } else if (SHOULD_SHOW_SPINNERS) {
      this.#createOra(text);
    }
  }

  isSpinning() {
    return this.#ora?.isSpinning ?? false;
  }

  #createOra(text?: string) {
    this.#ora = ora({
      text: text,
      prefixText: this.#prefix,
      hideCursor: false,
      discardStdin: false,
    });
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
