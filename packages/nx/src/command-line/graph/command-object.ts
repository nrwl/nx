import { CommandModule } from 'yargs';
import { linkToNxDevAndExamples } from '../yargs-utils/documentation';
import {
  withAffectedOptions,
  withDepGraphOptions,
} from '../yargs-utils/shared-options';

export const yargsDepGraphCommand: CommandModule = {
  command: 'graph',
  describe: 'Graph dependencies within workspace',
  aliases: ['dep-graph'],
  builder: (yargs) =>
    linkToNxDevAndExamples(
      withAffectedOptions(withDepGraphOptions(yargs)),
      'dep-graph'
    )
      .option('affected', {
        type: 'boolean',
        description: 'Highlight affected projects',
      })
      .implies('untracked', 'affected')
      .implies('uncommitted', 'affected')
      .implies('files', 'affected')
      .implies('base', 'affected')
      .implies('head', 'affected'),
  handler: async (args) =>
    await (await import('./graph')).generateGraph(args as any, []),
};
