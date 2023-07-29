import { execSync } from 'child_process';

const TERMINAL_SIZE =
  process.platform === 'win32' ? 8192 : getUnixTerminalSize();

export function chunkify(
  target: string[],
  maxChunkLength: number = TERMINAL_SIZE - 500
): string[][] {
  const chunks = [];
  let currentChunk = [];
  let currentChunkLength = 0;
  for (const file of target) {
    if (
      // Prevent empty chunk if first file path is longer than maxChunkLength
      currentChunk.length &&
      // +1 accounts for the space between file names
      currentChunkLength + file.length + 1 >= maxChunkLength
    ) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentChunkLength = 0;
    }
    currentChunk.push(file);
    currentChunkLength += file.length + 1;
  }
  chunks.push(currentChunk);
  return chunks;
}

function getUnixTerminalSize() {
  try {
    const argMax = execSync('getconf ARG_MAX').toString().trim();
    return Number.parseInt(argMax);
  } catch {
    // This number varies by system, but 100k seems like a safe
    // number from some research...
    // https://stackoverflow.com/questions/19354870/bash-command-line-and-input-limit
    return 100000;
  }
}
