import { serializeSingleOverride } from 'nx/src/utils/serialize-overrides-into-command-line';

export function formatFlags(
  leftPadding: string,
  flag: string,
  value: any
): string[] {
  if (flag === '_') {
    return [`${leftPadding}  ${(value as string[]).join(' ')}`];
  }

  return serializeSingleOverride(flag, value).map(
    (s) => `${leftPadding}  ${s}`
  );
}
