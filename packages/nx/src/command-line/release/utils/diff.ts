/**
 * Minimal line-diff implementation for nx release output.
 *
 * Replaces jest-diff to eliminate transitive dependencies (pretty-format,
 * chalk, ansi-styles@5) that cause version conflicts for supply chain
 * hardening.
 *
 * Uses @jest/diff-sequences (zero deps) for the core LCS algorithm.
 *
 * Source algorithm: https://github.com/jestjs/jest/tree/main/packages/jest-diff
 */

import diffSequences from '@jest/diff-sequences';

const DIFF_DELETE = -1;
const DIFF_EQUAL = 0;
const DIFF_INSERT = 1;

interface DiffOptions {
  contextLines?: number;
  expand?: boolean;
  aColor?: (s: string) => string;
  bColor?: (s: string) => string;
  patchColor?: (s: string) => string;
  omitAnnotationLines?: boolean;
}

const noColor = (s: string) => s;

function diffLinesRaw(
  aLines: string[],
  bLines: string[]
): Array<[number, string]> {
  const aLength = aLines.length;
  const bLength = bLines.length;

  const isCommon = (aIndex: number, bIndex: number) =>
    aLines[aIndex] === bLines[bIndex];

  const diffs: Array<[number, string]> = [];
  let aIndex = 0;
  let bIndex = 0;

  const foundSubsequence = (
    nCommon: number,
    aCommon: number,
    bCommon: number
  ) => {
    for (; aIndex !== aCommon; aIndex += 1) {
      diffs.push([DIFF_DELETE, aLines[aIndex]]);
    }
    for (; bIndex !== bCommon; bIndex += 1) {
      diffs.push([DIFF_INSERT, bLines[bIndex]]);
    }
    for (; nCommon !== 0; nCommon -= 1, aIndex += 1, bIndex += 1) {
      diffs.push([DIFF_EQUAL, bLines[bIndex]]);
    }
  };

  diffSequences(aLength, bLength, isCommon, foundSubsequence);

  for (; aIndex !== aLength; aIndex += 1) {
    diffs.push([DIFF_DELETE, aLines[aIndex]]);
  }
  for (; bIndex !== bLength; bIndex += 1) {
    diffs.push([DIFF_INSERT, bLines[bIndex]]);
  }

  return diffs;
}

function formatNoExpand(
  diffs: Array<[number, string]>,
  contextLines: number,
  aColor: (s: string) => string,
  bColor: (s: string) => string,
  patchColor: (s: string) => string
): string {
  const lines: string[] = [];
  let aLine = 0;
  let bLine = 0;

  // Group diffs into hunks with context
  const hunks: Array<{
    aStart: number;
    bStart: number;
    lines: string[];
  }> = [];
  let currentHunk: { aStart: number; bStart: number; lines: string[] } | null =
    null;
  let trailingContext = 0;

  for (let i = 0; i < diffs.length; i++) {
    const [type, line] = diffs[i];
    const isChange = type !== DIFF_EQUAL;

    if (isChange) {
      // Look back for leading context if starting a new hunk
      if (!currentHunk) {
        const contextStart = Math.max(0, i - contextLines);
        currentHunk = {
          aStart: aLine - (i - contextStart),
          bStart: bLine - (i - contextStart),
          lines: [],
        };
        // Add leading context
        for (let j = contextStart; j < i; j++) {
          const ctx = diffs[j][1];
          currentHunk.lines.push(ctx ? `  ${ctx}` : '');
        }
      } else if (trailingContext > 0) {
        // We're continuing a hunk, trailing context was already added
      }
      trailingContext = 0;

      if (type === DIFF_DELETE) {
        currentHunk.lines.push(aColor(line ? `- ${line}` : '-'));
      } else {
        currentHunk.lines.push(bColor(line ? `+ ${line}` : '+'));
      }
    } else {
      if (currentHunk) {
        trailingContext++;
        if (trailingContext <= contextLines) {
          currentHunk.lines.push(line ? `  ${line}` : '');
        }
        // Check if we should close this hunk
        // Look ahead to see if there's another change within contextLines
        let nextChangeWithin = false;
        for (let j = i + 1; j < diffs.length && j <= i + contextLines; j++) {
          if (diffs[j][0] !== DIFF_EQUAL) {
            nextChangeWithin = true;
            break;
          }
        }
        if (!nextChangeWithin && trailingContext >= contextLines) {
          hunks.push(currentHunk);
          currentHunk = null;
          trailingContext = 0;
        }
      }
    }

    if (type === DIFF_DELETE) {
      aLine++;
    } else if (type === DIFF_INSERT) {
      bLine++;
    } else {
      aLine++;
      bLine++;
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  const hasEqualLines = diffs.some(([type]) => type === DIFF_EQUAL);

  for (let i = 0; i < hunks.length; i++) {
    if (i > 0) {
      // Separator between hunks (matches jest-diff patch mark behavior)
      lines.push(patchColor(`@@ @@`));
    }
    lines.push(...hunks[i].lines);
  }

  // jest-diff adds a patch mark (leading newline) only when context lines
  // exist and are being skipped. When all lines are changes, no patch mark.
  const prefix = hasEqualLines ? '\n' : '';
  return prefix + lines.join('\n');
}

function formatExpand(
  diffs: Array<[number, string]>,
  aColor: (s: string) => string,
  bColor: (s: string) => string
): string {
  const lines: string[] = [];
  for (const [type, line] of diffs) {
    if (type === DIFF_DELETE) {
      lines.push(aColor(line ? `- ${line}` : '-'));
    } else if (type === DIFF_INSERT) {
      lines.push(bColor(line ? `+ ${line}` : '+'));
    } else {
      lines.push(line ? `  ${line}` : '');
    }
  }
  return lines.join('\n');
}

const NO_DIFF_MESSAGE = 'Compared values have no visual difference.';

export function diff(a: string, b: string, options: DiffOptions = {}): string {
  if (a === b) {
    return NO_DIFF_MESSAGE;
  }

  const aLines = a.split('\n');
  const bLines = b.split('\n');
  const diffs = diffLinesRaw(a === '' ? [] : aLines, b === '' ? [] : bLines);

  const aColor = options.aColor || noColor;
  const bColor = options.bColor || noColor;
  const patchColor = options.patchColor || noColor;
  const contextLines =
    typeof options.contextLines === 'number' ? options.contextLines : 5;
  const expand = options.expand ?? true;

  if (expand) {
    return formatExpand(diffs, aColor, bColor);
  } else {
    return formatNoExpand(diffs, contextLines, aColor, bColor, patchColor);
  }
}
