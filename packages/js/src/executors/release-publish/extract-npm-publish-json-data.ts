const expectedNpmPublishJsonKeys = [
  'id',
  'name',
  'version',
  'size',
  'filename',
];

// Regular expression to match JSON-like objects, including nested objects (which the expected npm publish output will have, e.g. in its "files" array)
// /{(?:[^{}]|{[^{}]*})*}/g
// /{                       : Matches the opening brace of a JSON object
//   (?:              )     : Non-capturing group to apply quantifiers
//      [^{}]               : Matches any character except for braces
//           |              : OR
//            {[^{}]*}      : Matches nested JSON objects
//                     *    : The non-capturing group (i.e. any character except for braces OR nested JSON objects) can repeat zero or more times
//                      }   : Matches the closing brace of a JSON object
//                       /g : Global flag to match all occurrences in the string
const jsonRegex = /{(?:[^{}]|{[^{}]*})*}/g;

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
      try {
        const parsedJson = JSON.parse(match);
        if (
          !expectedNpmPublishJsonKeys.every(
            (key) => parsedJson[key] !== undefined
          )
        ) {
          continue;
        }
        const jsonStartIndex = str.indexOf(match);
        return {
          beforeJsonData: str.slice(0, jsonStartIndex),
          jsonData: parsedJson,
          afterJsonData: str.slice(jsonStartIndex + match.length),
        };
      } catch {
        // Ignore parsing errors for unrelated JSON blocks
      }
    }
  }

  // No applicable jsonData detected, the whole contents is the beforeJsonData
  return {
    beforeJsonData: str,
    jsonData: null,
    afterJsonData: '',
  };
}
