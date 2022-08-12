export function formatFlags(
  leftPadding: string,
  flag: string,
  value: any
): string {
  return flag == '_'
    ? `${leftPadding}  ${(value as string[]).join(' ')}`
    : `${leftPadding}  --${flag}=${formatValue(value)}`;
}

function formatValue(value: any) {
  if (Array.isArray(value)) {
    return `[${value.join(',')}]`;
  } else if (typeof value === 'object') {
    return JSON.stringify(value);
  } else {
    return value;
  }
}
