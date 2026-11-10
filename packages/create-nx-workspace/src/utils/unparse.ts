export function unparse(options: Object): string[] {
  const unparsed: string[] = [];
  for (const key of Object.keys(options)) {
    const value = options[key as keyof typeof options];
    unparseOption(key, value, unparsed);
  }

  return unparsed;
}

function unparseOption(key: string, value: any, unparsed: string[]) {
  if (value === true) {
    unparsed.push(`--${key}`);
  } else if (value === false) {
    unparsed.push(`--no-${key}`);
  } else if (Array.isArray(value)) {
    value.forEach((item) => unparseOption(key, item, unparsed));
  } else if (Object.prototype.toString.call(value) === '[object Object]') {
    for (const nestedKey of Object.keys(value)) {
      unparseOption(`${key}.${nestedKey}`, value[nestedKey], unparsed);
    }
  } else if (typeof value === 'string' && value.includes(' ')) {
    unparsed.push(`--${key}="${value}"`);
  } else if (value != null) {
    unparsed.push(`--${key}=${value}`);
  }
}
