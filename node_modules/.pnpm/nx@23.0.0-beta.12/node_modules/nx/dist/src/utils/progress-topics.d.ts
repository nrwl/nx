/**
 * Named channels that daemon clients can subscribe to in order to
 * receive streaming progress/log output produced by a long-running
 * daemon operation. A handler subscribes the requesting socket to the
 * topics it will produce output for, and broadcast helpers fan out to
 * every currently-subscribed socket for that topic.
 *
 * Topics are the contract between the code producing progress (usually
 * through a {@link DelayedSpinner}) and the daemon subscriber registry
 * that routes those messages to connected clients, so they live next
 * to the spinner rather than inside the daemon implementation.
 *
 * Add new topics here as other long-running daemon operations grow
 * their own streaming surfaces.
 */
export declare const ProgressTopics: {
    readonly GraphConstruction: "graph-construction";
};
export type ProgressTopic = (typeof ProgressTopics)[keyof typeof ProgressTopics];
