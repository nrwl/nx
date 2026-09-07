const expectedNpmPublishJsonKeys = [
  'id',
  'name',
  'version',
  'size',
  'filename',
];

// Pair each '{' with its matching '}' in the publish output. The output is npm's
// pretty-printed JSON summary interleaved with arbitrary lifecycle-script text,
// so we recognize only genuine JSON structure and treat everything else as
// opaque, without interpreting it as JSON (unlike a JSONC parser):
//   - Braces and quotes inside a JSON string value are ignored, so a files[].path
//     like "templates/{{name}}/file.txt" doesn't throw off the pairing (#36236).
//   - '//' and '/*' are not comments; lifecycle output legitimately prints globs
//     and paths such as dist/*.js, and npm/pnpm emit plain JSON.
//   - A raw newline ends a string. A valid JSON string never contains one (it is
//     escaped as \n), so this can't truncate a real value, but it stops a stray
//     unpaired '"' in log text from swallowing the summary on a later line.
//   - A quote only opens a string inside an object, so a lone '"' in the preamble
//     or between objects stays inert.
// Stray unmatched braces are left unpaired.
function matchBracePositions(str: string): Map<number, number> {
  const matches = new Map<number, number>();
  const openBraceStack: number[] = [];
  let inString = false;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (inString) {
      if (char === '\\') {
        i++; // skip the escaped character
      } else if (char === '"' || char === '\n' || char === '\r') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      if (openBraceStack.length > 0) {
        inString = true;
      }
    } else if (char === '{') {
      openBraceStack.push(i);
    } else if (char === '}') {
      const openIndex = openBraceStack.pop();
      if (openIndex !== undefined) {
        matches.set(openIndex, i);
      }
    }
  }
  return matches;
}

// Yield every balanced {...} object in the output, left to right by start
// position, so an outer wrapper is seen before the objects nested inside it.
function* iterateBalancedJsonObjects(
  str: string
): Generator<{ text: string; index: number }> {
  const closeByOpen = matchBracePositions(str);
  for (let i = 0; i < str.length; i++) {
    const closeIndex = closeByOpen.get(i);
    if (closeIndex !== undefined) {
      yield { text: str.slice(i, closeIndex + 1), index: i };
    }
  }
}

function isNpmPublishSummary(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    expectedNpmPublishJsonKeys.every(
      (key) => (value as Record<string, unknown>)[key] !== undefined
    )
  );
}

export function extractNpmPublishJsonData(str: string): {
  beforeJsonData: string;
  jsonData: Record<string, unknown> | null;
  afterJsonData: string;
} {
  for (const { text: match, index } of iterateBalancedJsonObjects(str)) {
    // Cheap check to skip candidates that can't be the summary before parsing
    if (!expectedNpmPublishJsonKeys.every((key) => match.includes(key))) {
      continue;
    }
    // Full JSON parsing to identify the JSON object
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(match);
    } catch {
      // Ignore parsing errors for unrelated JSON blocks
      continue;
    }

    // npm <= 11.13 emits the summary as a flat object, while npm >= 11.16 (and
    // pnpm publish run from the workspace root) nest it one level deep under the
    // package name. Support both by unwrapping a single level when the matched
    // object isn't itself the summary.
    let publishData: Record<string, unknown> | null = null;
    if (isNpmPublishSummary(parsedJson)) {
      publishData = parsedJson;
    } else if (typeof parsedJson === 'object' && parsedJson !== null) {
      for (const value of Object.values(
        parsedJson as Record<string, unknown>
      )) {
        if (isNpmPublishSummary(value)) {
          publishData = value;
          break;
        }
      }
    }

    if (!publishData) {
      continue;
    }

    return {
      beforeJsonData: str.slice(0, index),
      jsonData: publishData,
      afterJsonData: str.slice(index + match.length),
    };
  }

  // No applicable jsonData detected, the whole contents is the beforeJsonData
  return {
    beforeJsonData: str,
    jsonData: null,
    afterJsonData: '',
  };
}
