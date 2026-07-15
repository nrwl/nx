/**
 * Splits a single comma-separated input line into fields, honoring double-quoted fields
 * (with "" as an escaped quote) so that a `key="value,with,commas"` field isn't split apart.
 * This is a minimal, dependency-free stand-in for the single-line subset of `csv-parse/sync`
 * used by the ported metadata parsers.
 */
export function splitFields(input: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"' && current.length === 0) {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Splits a `key=value` field on the first `=` only, so values may safely contain further
 * `=` characters (e.g. `pattern={{date 'YYYYMMDD' tz='Asia/Tokyo'}}`).
 */
export function splitKeyValue(field: string): [string] | [string, string] {
  const idx = field.indexOf('=');
  if (idx === -1) {
    return [field.trim()];
  }
  return [field.slice(0, idx).trim(), field.slice(idx + 1).trim()];
}
