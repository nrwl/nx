import * as ora from 'ora';
import { isCI } from './is-ci';

export const SHOULD_SHOW_SPINNERS = process.stdout.isTTY && !isCI();

class SpinnerManager {
  #ora!: ReturnType<typeof ora>;
  #prefix: string | undefined;

  start(text?: string, prefix?: string): SpinnerManager {
    if (!SHOULD_SHOW_SPINNERS) {
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
    this.#ora?.succeed(text);
  }

  stop() {
    this.#ora?.stop();
  }

  fail(text?: string) {
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
}

export const globalSpinner = new SpinnerManager();
