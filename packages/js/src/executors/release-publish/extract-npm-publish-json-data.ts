const expectedNpmPublishJsonKeys = [
  'id',
  'name',
  'version',
  'size',
  'filename',
];

// Regular expression to match JSON-like objects, including up to two levels of
// nested objects.
// /{(?:[^{}]|{(?:[^{}]|{[^{}]*})*})*}/g
// Two levels of nesting are required to support both shapes of npm/pnpm publish
// output:
//   - Older npm (<= 11.13) prints the publish summary as a flat object whose only
//     nesting is its own "files" array (one level deep).
//   - Newer npm (>= 11.16, bundled with Node 26) nests that same summary under the
//     package name, e.g. { "@scope/pkg": { ...id/name/files... } }, adding a
//     second level. pnpm publish nests the same way when run from the workspace
//     root. Matching two levels lets us capture the wrapper object in the nested
//     case so its braces are not left behind in beforeJsonData/afterJsonData.
const jsonRegex = /{(?:[^{}]|{(?:[^{}]|{[^{}]*})*})*}/g;

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
  const jsonMatches = str.match(jsonRegex);
  if (jsonMatches) {
    for (const match of jsonMatches) {
      // Cheap upfront check to see if the stringified JSON data has the expected keys as substrings
      if (!expectedNpmPublishJsonKeys.every((key) => str.includes(key))) {
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

      const jsonStartIndex = str.indexOf(match);
      return {
        beforeJsonData: str.slice(0, jsonStartIndex),
        jsonData: publishData,
        afterJsonData: str.slice(jsonStartIndex + match.length),
      };
    }
  }

  // No applicable jsonData detected, the whole contents is the beforeJsonData
  return {
    beforeJsonData: str,
    jsonData: null,
    afterJsonData: '',
  };
}
