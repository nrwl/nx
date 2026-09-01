import { writeFileSync } from 'fs';
import { output } from '../../utils/output';
import { AffectedReason, formatAffectedExplanation } from './affected-reasons';

/**
 * Prints `--explain` output.
 *
 * `destination` is what the flag was given, following `--graph`: `true` is a
 * bare `--explain` and prints the human form, `"stdout"` prints JSON, and any
 * other string is a file to write the JSON to.
 */
export function printAffectedExplanation(
  reasons: Record<string, AffectedReason[]>,
  heading: string,
  destination: string | boolean | undefined
): void {
  if (destination === 'stdout') {
    console.log(JSON.stringify(reasons, null, 2));
    return;
  }
  if (typeof destination === 'string' && destination) {
    writeFileSync(destination, JSON.stringify(reasons, null, 2));
    output.success({ title: `Reasons written to ${destination}` });
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
