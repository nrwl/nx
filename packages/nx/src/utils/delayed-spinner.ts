import * as ora from 'ora';
import { isCI } from './is-ci';

export type DelayedSpinnerOptions = {
  delay?: number;
  ciDelay?: number;
  message: string;
};

/**
 * A class that allows to delay the creation of a spinner, as well
 * as schedule updates to the message of the spinner. Useful for
 * scenarios where one wants to only show a spinner if an operation
 * takes longer than a certain amount of time.
 */
export class DelayedSpinner {
  spinner: ora.Ora;
  timeouts: NodeJS.Timeout[] = [];
  initial: number = Date.now();
  lastMessage: string;

  /**
   * Constructs a new {@link DelayedSpinner} instance.
   *
   * @param opts The options for the spinner
   */
  constructor(opts: DelayedSpinnerOptions);

  /**
   * Constructs a new {@link DelayedSpinner} instance.
   *
   * @param message The message to display in the spinner
   * @param ms The number of milliseconds to wait before creating the spinner
   */
  constructor(message: string, ms?: number);

  constructor(messageOrOpts: string | DelayedSpinnerOptions, ms?: number) {
    const message =
      typeof messageOrOpts === 'string' ? messageOrOpts : messageOrOpts.message;
    const opts: Omit<DelayedSpinnerOptions, 'message'> =
      typeof messageOrOpts === 'string' ? { delay: ms } : messageOrOpts;
    const ciDelay = opts.ciDelay ?? opts.delay ?? 10_000;
    const delay = SHOULD_SHOW_SPINNERS ? ciDelay : opts.delay ?? 500;

    this.timeouts.push(
      setTimeout(() => {
        if (!SHOULD_SHOW_SPINNERS) {
          console.warn(message);
        } else {
          this.spinner = ora(message);
        }
        this.lastMessage = message;
      }, delay).unref()
    );
  }

  /**
   * Sets the message to display in the spinner.
   *
   * @param message The message to display in the spinner
   * @returns The {@link DelayedSpinner} instance
   */
  setMessage(message: string) {
    if (this.spinner && SHOULD_SHOW_SPINNERS) {
      this.spinner.text = message;
    } else if (this.lastMessage && this.lastMessage !== message) {
      console.warn(message);
      this.lastMessage = message;
    }
    return this;
  }

  /**
   * Schedules an update to the message of the spinner. Useful for
   * changing the message after a certain amount of time has passed.
   *
   * @param opts The options for the update
   * @returns The {@link DelayedSpinner} instance
   */
  scheduleMessageUpdate({ message, delay, ciDelay }: DelayedSpinnerOptions) {
    this.timeouts.push(
      setTimeout(
        () => {
          this.setMessage(message);
        },
        SHOULD_SHOW_SPINNERS ? delay : ciDelay
      ).unref()
    );
    return this;
  }

  /**
   * Stops the spinner and cleans up any scheduled timeouts.
   */
  cleanup() {
    this.spinner?.stop();
    this.timeouts.forEach((t) => clearTimeout(t));
  }
}

const SHOULD_SHOW_SPINNERS = process.stdout.isTTY && !isCI();
