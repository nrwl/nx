import * as ora from 'ora';

class SpinnerManager {
  #ora!: ReturnType<typeof ora>;
  #prefix: string | undefined;

  start(text?: string, prefix?: string): SpinnerManager {
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
    this.#ora.succeed(text);
  }

  stop() {
    this.#ora.stop();
  }

  fail(text?: string) {
    this.#ora.fail(text);
  }

  updateText(text?: string) {
    if (this.#ora) {
      this.#ora.text = text;
    } else {
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
