import { ProgressTopic } from './progress-topics';
import { globalSpinner } from './spinner';
export type DelayedSpinnerOptions = {
    delay?: number;
    ciDelay?: number;
    /**
     * When set and running inside the Nx daemon, spinner messages are
     * broadcast to every client currently subscribed to this topic so
     * their own spinners stay in sync with daemon-side progress.
     */
    progressTopic?: ProgressTopic;
};
/**
 * A class that allows to delay the creation of a spinner, as well
 * as schedule updates to the message of the spinner. Useful for
 * scenarios where one wants to only show a spinner if an operation
 * takes longer than a certain amount of time.
 */
export declare class DelayedSpinner {
    spinner: typeof globalSpinner;
    timeouts: NodeJS.Timeout[];
    private lastMessage;
    private ready;
    private readonly progressTopic;
    /**
     * Constructs a new {@link DelayedSpinner} instance.
     *
     * @param opts The options for the spinner
     */
    constructor(message: string, opts?: DelayedSpinnerOptions);
    /**
     * Sets the message to display in the spinner.
     *
     * @param message The message to display in the spinner
     * @returns The {@link DelayedSpinner} instance
     */
    setMessage(message: string): this;
    /**
     * Schedules an update to the message of the spinner. Useful for
     * changing the message after a certain amount of time has passed.
     *
     * @param opts The options for the update
     * @returns The {@link DelayedSpinner} instance
     */
    scheduleMessageUpdate(message: string, opts?: DelayedSpinnerOptions): this;
    /**
     * Stops the spinner and cleans up any scheduled timeouts.
     */
    cleanup(): void;
    private broadcastProgress;
}
