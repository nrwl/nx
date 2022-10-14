import { flatten } from 'flat';

export function serializeOverridesIntoCommandLine(args: {
  [k: string]: any;
}): string[] {
  const r = args['_'] ? [...args['_']] : [];

  Object.keys(args)
    .filter((a) => a !== '_')
    .forEach((a) => r.push(...serializeSingleOverride(a, args[a])));

  return r;
}

export function serializeSingleOverride(key: string, value: any): string[] {
  if (value === true) {
    return [`--${key}`];
  } else if (value === false) {
    return [`--no-${key}`];
  } else if (Array.isArray(value)) {
    return value
      .map((item) => serializeSingleOverride(key, item))
      .flat() as string[];
  } else if (typeof value === 'object') {
    const flattened = flatten<any, any>(value, { safe: true });

    return Object.keys(flattened)
      .map((flattenedKey) => {
        return serializeSingleOverride(
          `${key}.${flattenedKey}`,
          flattened[flattenedKey]
        );
      })
      .flat();
  } else if (
    typeof value === 'string' &&
    stringShouldBeWrappedIntoQuotes(value)
  ) {
    const sanitized = value.replace(/"/g, String.raw`\"`);
    return [`--${key}="${sanitized}"`];
  } else if (value != null) {
    return [`--${key}=${value}`];
  }
}

function stringShouldBeWrappedIntoQuotes(str: string) {
  return str.includes(' ') || str.includes('{') || str.includes('"');
}
