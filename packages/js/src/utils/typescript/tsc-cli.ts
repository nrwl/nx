import { readJsonFile } from '@nx/devkit';
import type { ApiTypescriptBackend } from '@nx/devkit/internal';
import { dirname, join } from 'path';
import { stripVTControlCharacters } from 'util';

export function getTscCliPath(backend: ApiTypescriptBackend): string {
  const { bin } = readJsonFile<{ bin: { tsc: string } }>(
    backend.packageJsonPath
  );
  return join(dirname(backend.packageJsonPath), bin.tsc);
}

// The summary `tsc` prints after the diagnostics of a build, which the
// TypeScript 6 API never prints.
export function stripTscErrorSummary(output: string): string {
  const summary = /\nFound \d+ errors?\b[\s\S]*$/.exec(output);
  return summary ? output.slice(0, summary.index) : output;
}

const watchStatusPattern =
  /^(?:\[[^\]]+\]|\S.* -) (Starting compilation in watch mode\.\.\.|File change detected\. Starting incremental compilation\.\.\.|Found (\d+) errors?\. Watching for file changes\.)\r?$/;

/**
 * Parses a `tsc --watch` status line into the diagnostic code TypeScript 6
 * reports for it. Expects English output (`--locale en`).
 */
export function parseTscWatchStatus(
  line: string
): { code: number; text: string; errorCount?: number } | undefined {
  const match = stripVTControlCharacters(line).match(watchStatusPattern);
  if (!match) {
    return undefined;
  }
  const [, text, errorCount] = match;
  if (errorCount === undefined) {
    return {
      code: text.startsWith('Starting') ? 6031 : 6032,
      text,
    };
  }
  return {
    code: errorCount === '1' ? 6193 : 6194,
    text,
    errorCount: Number(errorCount),
  };
}
