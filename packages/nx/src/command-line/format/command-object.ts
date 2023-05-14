import { CommandModule, Argv } from 'yargs';
import { linkToNxDevAndExamples } from '../yargs-utils/documentation';
import { parseCSV, withAffectedOptions } from '../yargs-utils/shared-options';

export const yargsFormatCheckCommand: CommandModule = {
  command: 'format:check',
  describe: 'Check for un-formatted files',
  builder: (yargs) =>
    linkToNxDevAndExamples(withFormatOptions(yargs), 'format:check'),
  handler: async (args) => {
    await (await import('./format')).format('check', args);
    process.exit(0);
  },
};

export const yargsFormatWriteCommand: CommandModule = {
  command: 'format:write',
  describe: 'Overwrite un-formatted files',
  aliases: ['format'],
  builder: (yargs) =>
    linkToNxDevAndExamples(withFormatOptions(yargs), 'format:write'),
  handler: async (args) => {
    await (await import('./format')).format('write', args);
    process.exit(0);
  },
};

function withFormatOptions(yargs: Argv): Argv {
  return withAffectedOptions(yargs)
    .parserConfiguration({
      'camel-case-expansion': true,
    })
    .option('libs-and-apps', {
      describe: 'Format only libraries and applications files.',
      type: 'boolean',
    })
    .option('projects', {
      describe: 'Projects to format (comma/space delimited)',
      type: 'string',
      coerce: parseCSV,
    })
    .option('all', {
      describe: 'Format all projects',
      type: 'boolean',
    })
    .conflicts({
      all: 'projects',
    });
}
