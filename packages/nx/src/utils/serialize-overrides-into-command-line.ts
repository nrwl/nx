import { flatten } from 'flat';

export function serializeOverridesIntoCommandLine(options: {
  [k: string]: any;
}): string[] {
  const unparsed = options._ ? [...options._] : [];
  for (const key of Object.keys(options)) {
    const value = options[key];
    if (key !== '_') {
      serializeOption(key, value, unparsed);
    }
  }

  return unparsed;
}

function serializeOption(key: string, value: any, unparsed: string[]) {
  if (value === true) {
    unparsed.push(`--${key}`);
  } else if (value === false) {
    unparsed.push(`--no-${key}`);
  } else if (Array.isArray(value)) {
    value.forEach((item) => serializeOption(key, item, unparsed));
  } else if (Object.prototype.toString.call(value) === '[object Object]') {
    const flattened = flatten<any, any>(value, { safe: true });
    for (const flattenedKey in flattened) {
      serializeOption(
        `${key}.${flattenedKey}`,
        flattened[flattenedKey],
        unparsed
      );
    }
  } else if (
    typeof value === 'string' &&
    stringShouldBeWrappedIntoQuotes(value)
  ) {
    const sanitized = value.replace(/"/g, String.raw`\"`);
    unparsed.push(`--${key}="${sanitized}"`);
  } else if (value != null) {
    unparsed.push(`--${key}=${value}`);
  }
}

function stringShouldBeWrappedIntoQuotes(str: string) {
  return str.includes(' ') || str.includes('{') || str.includes('"');
}
