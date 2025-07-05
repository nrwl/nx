import ora = require('ora');
import { isCI } from './is-ci';

export type DelayedSpinnerOptions = {
  delay?: number;
  ciDelay?: number;
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

  private lastMessage: string;
  private ready: boolean;

  /**
   * Constructs a new {@link DelayedSpinner} instance.
   *
   * @param opts The options for the spinner
   */
  constructor(message: string, opts?: DelayedSpinnerOptions) {
    opts = normalizeDelayedSpinnerOpts(opts);
    const delay = SHOULD_SHOW_SPINNERS ? opts.delay : opts.ciDelay;

    this.timeouts.push(
      setTimeout(() => {
        this.ready = true;
        this.lastMessage = message;
        if (!SHOULD_SHOW_SPINNERS) {
          console.warn(this.lastMessage);
        } else {
          this.spinner = ora(this.lastMessage).start();
        }
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
    if (SHOULD_SHOW_SPINNERS) {
      if (this.spinner) {
        this.spinner.text = message;
      }
    } else if (this.ready && this.lastMessage && this.lastMessage !== message) {
      console.warn(message);
    }
    this.lastMessage = message;
    return this;
  }

  /**
   * Schedules an update to the message of the spinner. Useful for
   * changing the message after a certain amount of time has passed.
   *
   * @param opts The options for the update
   * @returns The {@link DelayedSpinner} instance
   */
  scheduleMessageUpdate(message: string, opts?: DelayedSpinnerOptions) {
    opts = normalizeDelayedSpinnerOpts(opts);
    this.timeouts.push(
      setTimeout(
        () => {
          this.setMessage(message);
        },
        SHOULD_SHOW_SPINNERS ? opts.delay : opts.ciDelay
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

function normalizeDelayedSpinnerOpts(
  opts: DelayedSpinnerOptions | null | undefined
) {
  opts ??= {};
  opts.delay ??= 500;
  opts.ciDelay ??= 30_000;
  return opts;
}
