"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DelayedSpinner = void 0;
const is_on_daemon_1 = require("../daemon/is-on-daemon");
const client_socket_context_1 = require("../daemon/server/client-socket-context");
const spinner_1 = require("./spinner");
/**
 * A class that allows to delay the creation of a spinner, as well
 * as schedule updates to the message of the spinner. Useful for
 * scenarios where one wants to only show a spinner if an operation
 * takes longer than a certain amount of time.
 */
class DelayedSpinner {
    /**
     * Constructs a new {@link DelayedSpinner} instance.
     *
     * @param opts The options for the spinner
     */
    constructor(message, opts) {
        this.timeouts = [];
        opts = normalizeDelayedSpinnerOpts(opts);
        this.progressTopic = opts.progressTopic;
        const delay = spinner_1.SHOULD_SHOW_SPINNERS ? opts.delay : opts.ciDelay;
        this.lastMessage = message;
        this.broadcastProgress(message);
        this.timeouts.push(setTimeout(() => {
            this.ready = true;
            if (!spinner_1.SHOULD_SHOW_SPINNERS) {
                console.warn(this.lastMessage);
            }
            else if (!spinner_1.globalSpinner.isSpinning()) {
                this.spinner = spinner_1.globalSpinner.start(this.lastMessage);
            }
        }, delay).unref());
    }
    /**
     * Sets the message to display in the spinner.
     *
     * @param message The message to display in the spinner
     * @returns The {@link DelayedSpinner} instance
     */
    setMessage(message) {
        if (spinner_1.SHOULD_SHOW_SPINNERS) {
            if (this.spinner && this.ready) {
                this.spinner.updateText(message);
            }
        }
        else if (this.ready && this.lastMessage && this.lastMessage !== message) {
            console.warn(message);
        }
        this.broadcastProgress(message);
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
    scheduleMessageUpdate(message, opts) {
        opts = normalizeDelayedSpinnerOpts(opts);
        this.timeouts.push(setTimeout(() => {
            this.setMessage(message);
        }, spinner_1.SHOULD_SHOW_SPINNERS ? opts.delay : opts.ciDelay).unref());
        return this;
    }
    /**
     * Stops the spinner and cleans up any scheduled timeouts.
     */
    cleanup() {
        this.spinner?.stop();
        this.timeouts.forEach((t) => clearTimeout(t));
    }
    broadcastProgress(message) {
        if (this.progressTopic && (0, is_on_daemon_1.isOnDaemon)()) {
            (0, client_socket_context_1.sendProgressMessageToTopic)(this.progressTopic, message);
        }
    }
}
exports.DelayedSpinner = DelayedSpinner;
function normalizeDelayedSpinnerOpts(opts) {
    opts ??= {};
    opts.delay ??= 500;
    opts.ciDelay ??= 30_000;
    return opts;
}
