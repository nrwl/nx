export function formatFlags(
  leftPadding: string,
  flag: string,
  value: any
): string {
  return flag == '_'
    ? `${leftPadding}  ${(value as string[]).join(' ')}`
    : `${leftPadding}  --${flag}=${value}`;
}
