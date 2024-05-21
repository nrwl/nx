/**
 * This utility handles extracting and parsing JSON data from a string under the following circumstances:
 * - The string is pure JSON data, unformatted
 * - The string is pure JSON data, formatted
 * - The string contains both JSON and non-JSON data, but ONLY when the JSON data is formatted
 *
 * It also returns the string contents before and after the JSON data.
 */
export function extractJsonDataFromString(str: string): {
  beforeJsonData: string;
  jsonData: Record<string, unknown>;
  afterJsonData: string;
} {
  let beforeJsonData = '';
  let afterJsonData = '';
  const lines = str.split('\n');
  let jsonObject: Record<string, unknown>;
  let jsonBuffer = [];
  let insideJson = false;

  // Handle case when pure JSON data is given but it is not formatted
  if (lines.length === 1) {
    try {
      return {
        beforeJsonData,
        jsonData: JSON.parse(str),
        afterJsonData,
      };
    } catch {
      // Ignore invalid JSON strings
    }
  } else {
    let jsonStartLine = 0;
    let jsonEndLine = 0;

    for (let line of lines) {
      if (line.startsWith('{') && !insideJson) {
        insideJson = true;
        jsonStartLine = lines.indexOf(line);
      }

      if (insideJson) {
        jsonBuffer.push(line);
      }

      if (line.startsWith('}') && insideJson) {
        insideJson = false;
        jsonEndLine = lines.indexOf(line);
        try {
          jsonObject = JSON.parse(jsonBuffer.join('\n'));
          // Capture the content before and after the JSON data
          beforeJsonData = lines.slice(0, jsonStartLine).join('\n');
          afterJsonData = lines.slice(jsonEndLine + 1).join('\n');
          break;
        } catch {
          // Ignore invalid JSON strings
        }
        jsonBuffer = [];
      }
    }
  }

  if (!jsonObject) {
    throw new Error(
      'Failed to parse a valid JSON string within the command output'
    );
  }

  return {
    beforeJsonData,
    jsonData: jsonObject,
    afterJsonData,
  };
}
