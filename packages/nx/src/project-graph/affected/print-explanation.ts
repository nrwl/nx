import { output } from '../../utils/output';
import { AffectedReason, formatAffectedExplanation } from './affected-reasons';

/**
 * Prints `--explain` output, as JSON when `--json` was also passed.
 *
 * JSON goes to stdout unadorned so it can be piped; the human form goes through
 * `output` so it is formatted like the rest of the CLI.
 */
export function printAffectedExplanation(
  reasons: Record<string, AffectedReason[]>,
  heading: string,
  args: { json?: boolean }
): void {
  if (args.json) {
    console.log(JSON.stringify(reasons, null, 2));
    return;
  }
  const rendered = formatAffectedExplanation(reasons, heading);
  if (!Object.keys(reasons).length) {
    output.log({ title: rendered });
    return;
  }
  output.log({
    title: `${heading} (${Object.keys(reasons).length})`,
    // The heading and its blank line are already in the title.
    bodyLines: rendered.split('\n').slice(2),
  });
}
