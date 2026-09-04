import {
  detectFormatter,
  FormatterType,
  resolveFormatterBin,
} from '../../../utils/formatters';

/**
 * The command the agent runs over the files it changed, with a `<paths>`
 * placeholder. `--` keeps a path that starts with `-` from being read as an
 * option.
 */
export function formatCommandFor(
  formatter: FormatterType,
  pmExec: string
): string {
  switch (formatter) {
    case 'prettier':
      // --ignore-unknown skips files prettier has no parser for.
      return `${pmExec} prettier --write --ignore-unknown -- <paths>`;
    case 'oxfmt':
      // oxfmt exits 2 when every path was skipped; the flag makes that
      // success. Unlike prettier it skips unparseable files on its own.
      return `${pmExec} oxfmt --no-error-on-unmatched-pattern -- <paths>`;
    default: {
      const unhandled: never = formatter;
      throw new Error(`Unhandled formatter: ${unhandled}`);
    }
  }
}

/**
 * Resolved per dispense so a migration's formatter change takes effect; the
 * scope rules name the replacement commands for the step that made it. `null`
 * when no formatter is configured or its binary cannot be resolved: under npm
 * the command would otherwise make `npx` download it.
 */
export function resolveFormatCommand(
  root: string,
  pmExec: string
): string | null {
  const formatter = detectFormatter(root);
  if (formatter === null) {
    return null;
  }
  try {
    resolveFormatterBin[formatter]();
  } catch {
    return null;
  }
  return formatCommandFor(formatter, pmExec);
}
