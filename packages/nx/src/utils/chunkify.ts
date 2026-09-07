const TERMINAL_SIZE = getMaxArgLength();

export function chunkify(
  target: string[],
  maxChunkLength: number = TERMINAL_SIZE - 500,
  /**
   * How long each entry will be once it reaches the command line. Callers that
   * quote or escape afterwards pass that transformation's length here, so the
   * chunk is sized against what is actually spawned rather than the raw string.
   */
  measure: (item: string) => number = (item) => item.length
): string[][] {
  const chunks = [];
  let currentChunk = [];
  let currentChunkLength = 0;
  for (const file of target) {
    const length = measure(file);
    if (
      // Prevent empty chunk if first file path is longer than maxChunkLength
      currentChunk.length &&
      // +1 accounts for the space between file names
      currentChunkLength + length + 1 >= maxChunkLength
    ) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentChunkLength = 0;
    }
    currentChunk.push(file);
    currentChunkLength += length + 1;
  }
  chunks.push(currentChunk);
  return chunks;
}

/**
 * Get the maximum length of a command-line argument string based on current platform
 *
 * https://serverfault.com/questions/69430/what-is-the-maximum-length-of-a-command-line-in-mac-os-x
 * https://support.microsoft.com/en-us/help/830473/command-prompt-cmd-exe-command-line-string-limitation
 * https://unix.stackexchange.com/a/120652
 *
 * Taken from: https://github.com/lint-staged/lint-staged/blob/adf50b00669f6aac2eeca25dd28ff86a9a3c2a48/lib/index.js#L21-L37
 */
export function getMaxArgLength() {
  switch (process.platform) {
    case 'darwin':
      return 262144;
    case 'win32':
      return 8191;
    default:
      return 131072;
  }
}
