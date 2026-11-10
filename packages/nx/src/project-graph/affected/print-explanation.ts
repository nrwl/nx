import { writeFileSync } from 'fs';
import * as pc from 'picocolors';
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
  options: { verbose?: boolean } = {}
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

  const rendered = formatAffectedExplanation(explanation, heading, {
    ...options,
    styleTask,
    dim: pc.dim,
    bold: pc.bold,
  });
  if (!Object.keys(explanation.affected).length) {
    output.log({ title: rendered });
    return;
  }
  const [title, , ...bodyLines] = rendered.split('\n');
  output.log({ title: title.replace(/:$/, ''), bodyLines });
}

// Colored like `nx show target`, with the tasks asked for in bold.
function styleTask(id: string, requested: boolean): string {
  const split = id.indexOf(':');
  const colored = `${pc.cyan(id.slice(0, split))}:${pc.green(id.slice(split + 1))}`;
  return requested ? pc.bold(colored) : colored;
}
