import { writeFileSync } from 'fs';
import { output } from '../../utils/output';
import {
  AffectedExplanation,
  formatAffectedExplanation,
} from './affected-reasons';

/**
 * Prints `--explain` output.
 *
 * `destination` is what the flag was given, following `--graph`: `true` is a
 * bare `--explain` and prints the human form, `"stdout"` prints JSON, and any
 * other string is a file to write the JSON to.
 */
export function printAffectedExplanation(
  explanation: AffectedExplanation,
  heading: string,
  destination: string | boolean | undefined,
  /** Tasks that run only to satisfy the selected ones. Only `nx affected`
   * runs them, so `show projects` leaves this off. */
  dependencyCount?: number
): void {
  if (destination === 'stdout') {
    console.log(JSON.stringify(explanation, null, 2));
    return;
  }
  if (typeof destination === 'string' && destination) {
    writeFileSync(destination, JSON.stringify(explanation, null, 2));
    output.success({ title: `Reasons written to ${destination}` });
    return;
  }

  const rendered = formatAffectedExplanation(
    explanation,
    heading,
    dependencyCount
  );
  const count = Object.keys(explanation.affected).length;
  if (!count) {
    output.log({ title: rendered });
    return;
  }
  output.log({
    title: `${heading} (${count})`,
    // The heading and its blank line are already in the title.
    bodyLines: rendered.split('\n').slice(2),
  });
}
