import * as ora from 'ora';

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

  /**
   * Constructs a new {@link DelayedSpinner} instance.
   *
   * @param message The message to display in the spinner
   * @param ms The number of milliseconds to wait before creating the spinner
   */
  constructor(message: string, ms: number) {
    this.timeouts.push(
      setTimeout(() => {
        this.spinner = ora(message);
      }, ms).unref()
    );
  }

  /**
   * Sets the message to display in the spinner.
   *
   * @param message The message to display in the spinner
   * @returns The {@link DelayedSpinner} instance
   */
  setMessage(message: string) {
    this.spinner.text = message;
    return this;
  }

  /**
   * Schedules an update to the message of the spinner. Useful for
   * changing the message after a certain amount of time has passed.
   *
   * @param message The message to display in the spinner
   * @param delay How long to wait before updating the message
   * @returns The {@link DelayedSpinner} instance
   */
  scheduleMessageUpdate(message: string, delay: number) {
    this.timeouts.push(
      setTimeout(() => {
        this.spinner.text = message;
      }, delay).unref()
    );
    return this;
  }

  /**
   * Stops the spinner and cleans up any scheduled timeouts.
   */
  cleanup() {
    this.spinner.stop();
    this.timeouts.forEach((t) => clearTimeout(t));
  }
}
