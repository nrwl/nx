import { detectFormatter, FormatterType } from '../../../utils/formatters';

/**
 * The command the agent runs over the files it changed, with a `<paths>`
 * placeholder.
 */
export function formatCommandFor(
  formatter: FormatterType,
  pmExec: string
): string {
  switch (formatter) {
    case 'prettier':
      // --ignore-unknown skips files prettier has no parser for.
      return `${pmExec} prettier --write --ignore-unknown <paths>`;
    case 'oxfmt':
      // oxfmt exits 2 when every path was skipped; the flag makes that
      // success. Unlike prettier it skips unparseable files on its own.
      return `${pmExec} oxfmt --no-error-on-unmatched-pattern <paths>`;
    default: {
      const unhandled: never = formatter;
      throw new Error(`Unhandled formatter: ${unhandled}`);
    }
  }
}

/**
 * Resolved against the workspace as it is now, so it goes stale once a
 * migration changes the formatter; callers re-resolve per dispense, and the
 * scope rules name the replacement commands for the step that made the change.
 * `null` when no formatter is configured.
 */
export function resolveFormatCommand(
  root: string,
  pmExec: string
): string | null {
  const formatter = detectFormatter(root);
  return formatter === null ? null : formatCommandFor(formatter, pmExec);
}
