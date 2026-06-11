/**
 * Returns the path to a temp directory containing `nx@latest`.
 * The installation is cached for the lifetime of the daemon process.
 * Guards against concurrent callers by reusing the in-flight promise.
 */
export declare function getLatestNxTmpPath(): Promise<string>;
/**
 * Clean up the latest Nx installation on daemon shutdown.
 */
export declare function cleanupLatestNx(): void;
