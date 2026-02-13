import { styleText } from 'node:util';
import yargs = require('yargs');
import { examples } from '../examples';

export function linkToNxDevAndExamples<T>(
  yargs: yargs.Argv<T>,
  command: string
) {
  (examples[command] || []).forEach((t) => {
    yargs = yargs.example(t.command, t.description);
  });
  return yargs.epilog(
    styleText(
      'bold',
      `Find more information and examples at https://nx.dev/nx/${command.replace(
        ':',
        '-'
      )}`
    )
  );
}
