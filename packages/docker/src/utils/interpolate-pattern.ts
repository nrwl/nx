const tokenRegex = /\{(env\.([^}]+)|([^|{}]+)(?:\|([^{}]+))?)\}/g;

function formatDate(date: Date, format: string) {
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');

  return format
    .replace(/YYYY/g, year)
    .replace(/YY/g, year.slice(-2))
    .replace(/MM/g, month)
    .replace(/DD/g, day)
    .replace(/HH/g, hours)
    .replace(/mm/g, minutes)
    .replace(/ss/g, seconds);
}

/**
 * Interpolates pattern tokens in a string.
 *
 * Supported tokens:
 * - {tokenName} - Simple token replacement
 * - {currentDate} - Current date in ISO format
 * - {currentDate|FORMAT} - Current date with custom format (YYYY, YY, MM, DD, HH, mm, ss)
 * - {env.VAR_NAME} - Environment variable value
 *
 * @param pattern - String containing tokens to interpolate
 * @param tokens - Record of token values
 * @returns Interpolated string
 */
export function interpolatePattern(
  pattern: string,
  tokens: Record<string, any>
): string {
  return pattern.replace(
    tokenRegex,
    (match, fullMatch, envVarName, identifier, format) => {
      // Handle environment variables
      if (envVarName) {
        const envValue = process.env[envVarName];
        return envValue !== undefined ? envValue : match;
      }

      // Handle other tokens
      const value = tokens[identifier];

      if (value === undefined) {
        return match; // Keep original token if no data
      }

      // Handle date formatting
      if (identifier === 'currentDate') {
        if (format) {
          return formatDate(value, format);
        } else {
          return (value as Date).toISOString();
        }
      }

      return value;
    }
  );
}

/**
 * Recursively interpolates pattern tokens in all string values within an object or array.
 *
 * @param obj - Object or array to process
 * @param tokens - Record of token values
 * @returns New object/array with interpolated values
 */
export function interpolateObject<T>(obj: T, tokens: Record<string, any>): T {
  if (typeof obj === 'string') {
    return interpolatePattern(obj, tokens) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => interpolateObject(item, tokens)) as T;
  }

  if (obj !== null && typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = interpolateObject(value, tokens);
    }
    return result;
  }

  return obj;
}
