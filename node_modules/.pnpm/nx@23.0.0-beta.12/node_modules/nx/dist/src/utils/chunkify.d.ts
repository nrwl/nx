export declare function chunkify(target: string[], maxChunkLength?: number): string[][];
/**
 * Get the maximum length of a command-line argument string based on current platform
 *
 * https://serverfault.com/questions/69430/what-is-the-maximum-length-of-a-command-line-in-mac-os-x
 * https://support.microsoft.com/en-us/help/830473/command-prompt-cmd-exe-command-line-string-limitation
 * https://unix.stackexchange.com/a/120652
 *
 * Taken from: https://github.com/lint-staged/lint-staged/blob/adf50b00669f6aac2eeca25dd28ff86a9a3c2a48/lib/index.js#L21-L37
 */
export declare function getMaxArgLength(): 262144 | 8191 | 131072;
