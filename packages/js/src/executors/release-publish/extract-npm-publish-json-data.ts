const expectedNpmPublishJsonKeys = [
  'id',
  'name',
  'version',
  'size',
  'filename',
];

export function extractNpmPublishJsonData(str: string): {
  beforeJsonData: string;
  jsonData: Record<string, unknown> | null;
  afterJsonData: string;
} {
  const jsonRegex = /{(?:[^{}]|{[^{}]*})*}/g;
  const jsonMatches = str.match(jsonRegex);
  let jsonData: Record<string, unknown> | null = null;
  let jsonStartIndex = -1;
  let jsonEndIndex = -1;

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
        jsonData = parsedJson;
        jsonStartIndex = str.indexOf(match);
        jsonEndIndex = jsonStartIndex + match.length;
        break;
      } catch {
        // Ignore parsing errors for unrelated JSON blocks
      }
    }
  }

  if (jsonData) {
    const beforeJsonData = str.slice(0, jsonStartIndex);
    const afterJsonData = str.slice(jsonEndIndex);
    return {
      beforeJsonData,
      jsonData,
      afterJsonData,
    };
  }

  // No jsonData detected, the whole contents is the beforeJsonData
  return {
    beforeJsonData: str,
    jsonData: null,
    afterJsonData: '',
  };
}
