import { isOnDaemon } from '../daemon/is-on-daemon';
import { sendProgressMessageToClient } from '../daemon/server/client-socket-context';
import { isCI } from './is-ci';
import { globalSpinner, SHOULD_SHOW_SPINNERS } from './spinner';

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
  spinner: typeof globalSpinner;
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

    // When running inside the daemon there is no local TTY, so forward
    // the initial message to the connected client immediately — its own
    // spinner (also a DelayedSpinner) decides whether to render it.
    if (isOnDaemon()) {
      sendProgressMessageToClient(message);
    }

    this.timeouts.push(
      setTimeout(() => {
        this.ready = true;
        this.lastMessage = message;
        if (!SHOULD_SHOW_SPINNERS) {
          console.warn(this.lastMessage);
        } else if (!globalSpinner.isSpinning()) {
          this.spinner = globalSpinner.start(this.lastMessage);
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
        this.spinner.updateText(message);
      }
    } else if (this.ready && this.lastMessage && this.lastMessage !== message) {
      console.warn(message);
    }
    if (isOnDaemon()) {
      sendProgressMessageToClient(message);
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

function normalizeDelayedSpinnerOpts(
  opts: DelayedSpinnerOptions | null | undefined
) {
  opts ??= {};
  opts.delay ??= 500;
  opts.ciDelay ??= 30_000;
  return opts;
}
