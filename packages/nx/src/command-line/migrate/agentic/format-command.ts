import { detectFormatter } from '../../../utils/formatters';

/**
 * The command the agent runs over the files it changed, with a `<paths>`
 * placeholder, or `null` when the workspace has no formatter configured.
 * Resolved by nx so the agent never has to detect the formatter itself.
 */
export function resolveFormatCommand(
  root: string,
  pmExec: string
): string | null {
  const formatter = detectFormatter(root);
  switch (formatter) {
    case null:
      return null;
    case 'prettier':
      return `${pmExec} prettier --write --ignore-unknown <paths>`;
    case 'oxfmt':
      return `${pmExec} oxfmt --no-error-on-unmatched-pattern <paths>`;
    default: {
      const unhandled: never = formatter;
      throw new Error(`Unhandled formatter: ${unhandled}`);
    }
  }
}
