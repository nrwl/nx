/**
 * Turns options into CLI flags: `{ maxWarnings: 0, fix: true }` gives
 * `--max-warnings=0 --fix`. Arrays repeat the flag; `false`, `null` and
 * `undefined` give none.
 */
export function createCliOptions(
  obj: Record<string, string | number | boolean | string[] | undefined | null>
): string[] {
  const args: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null || value === false) {
      continue;
    }
    const flag = `--${key.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}`;
    if (value === true) {
      args.push(flag);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        args.push(`${flag}=${item}`);
      }
    } else {
      args.push(`${flag}=${value}`);
    }
  }
  return args;
}
