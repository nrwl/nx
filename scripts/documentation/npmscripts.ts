import * as fs from 'fs-extra';
import * as yargs from 'yargs';
import * as path from 'path';
import { dedent } from 'tslint/lib/utils';

import { commandsObject } from '../../packages/schematics/src/command-line/nx-commands';
import { sortAlphabeticallyFunction } from './utils';

const commandsOutputDirectory = path.join(
  __dirname,
  '../../docs/api-npmscripts'
);
fs.removeSync(commandsOutputDirectory);
function getCommands(command) {
  return command.getCommandInstance().getCommandHandlers();
}
function parseCommandInstance(name, command) {
  const builder = command.builder((<any>yargs).resetOptions());
  const builderDescriptions = builder.getUsageInstance().getDescriptions();
  const builderDefaultOptions = builder.getOptions().default;
  return {
    command: command['original'],
    description: command['description'],
    options:
      Object.keys(builderDescriptions).map(name => ({
        command: '--'.concat(name),
        description: builderDescriptions[name]
          ? builderDescriptions[name].replace('__yargsString__:', '')
          : '',
        default: builderDefaultOptions[name]
      })) || null
  };
}
function generateMarkdown(command) {
  let template = dedent`
    # ${command.command}
    ${command.description}
    
    ## Usage
    \`\`\`bash 
    ${command.command}
    \`\`\`
   `;

  if (Array.isArray(command.options) && !!command.options.length) {
    template += '## Options';

    command.options
      .sort((a, b) =>
        sortAlphabeticallyFunction(
          a.command.replace('--', ''),
          b.command.replace('--', '')
        )
      )
      .forEach(
        option =>
          (template += dedent`
          ### ${option.command.replace('--', '')}
          ${
            option.default === undefined || option.default === ''
              ? ''
              : `Default: \`${option.default}\`\n`
          }
          ${option.description}
        `)
      );
  }

  return {
    name: command.command
      .replace(':', '-')
      .replace(' ', '-')
      .replace(/[\]\[.]+/gm, ''),
    template
  };
}

function generateFile(
  outputDirectory: string,
  templateObject: { name: string; template: string }
): void {
  fs.outputFileSync(
    path.join(outputDirectory, `${templateObject.name}.md`),
    templateObject.template
  );
}

// TODO: Try to add option's type, examples, and group?
// TODO: split one command per page / Create an index
const npmscripts = getCommands(commandsObject);

Object.keys(npmscripts)
  .map(name => parseCommandInstance(name, npmscripts[name]))
  .map(command => generateMarkdown(command))
  .forEach(templateObject =>
    generateFile(commandsOutputDirectory, templateObject)
  );
