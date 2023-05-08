import { CommandModule } from 'yargs';
import { linkToNxDevAndExamples } from '../yargs-utils/documentation';
import { withDepGraphOptions } from '../yargs-utils/shared-options';

export const yargsDepGraphCommand: CommandModule = {
  command: 'graph',
  describe: 'Graph dependencies within workspace',
  aliases: ['dep-graph'],
  builder: (yargs) =>
    linkToNxDevAndExamples(withDepGraphOptions(yargs), 'dep-graph'),
  handler: async (args) =>
    await (await import('./graph')).generateGraph(args as any, []),
};
