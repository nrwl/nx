import * as chalk from 'chalk';
import { readFileSync } from 'fs';
import { readJsonSync } from 'fs-extra';
import { join } from 'path';
import {
  formatDeprecated,
  generateMarkdownFile,
  getCommands,
  parseCommand,
  ParsedCommand,
  sortAlphabeticallyFunction,
} from './utils';
import { register as registerTsConfigPaths } from 'tsconfig-paths';
import { examples } from '../../packages/nx/src/command-line/examples';
import { dedent } from 'tslint/lib/utils';

const importFresh = require('import-fresh');

const sharedCommands = [
  'build',
  'e2e',
  'generate',
  'lint',
  'run',
  'serve',
  'test',
];

export async function generateCLIDocumentation(
  commandsOutputDirectory: string
) {
  /**
   * For certain commands, they will output dynamic data at runtime in a real workspace,
   * so we leverage an envrionment variable to inform the logic of the context that we
   * are just statically generating documentation for the current execution.
   */
  process.env.NX_GENERATE_DOCS_PROCESS = 'true';

  const config = readJsonSync(
    join(__dirname, '../../tsconfig.base.json')
  ).compilerOptions;
  registerTsConfigPaths(config);

  console.log(`\n${chalk.blue('i')} Generating Documentation for Nx Commands`);

  const { commandsObject } = importFresh(
    '../../packages/nx/src/command-line/nx-commands'
  );

  function generateMarkdown(command: ParsedCommand) {
    let template = dedent`
---
title: "${command.name} - CLI command"
description: "${command.description}"
---
# ${command.name}

${command.description}

## Usage

\`\`\`bash
nx ${command.commandString}
\`\`\`

[Install \`nx\` globally](/getting-started/nx-setup#install-nx) to invoke the command directly using \`nx\`, or use \`npx nx\`, \`yarn nx\`, or \`pnpx nx\`.\n`;

    if (examples[command.name] && examples[command.name].length > 0) {
      template += `\n### Examples`;
      examples[command.name].forEach((example) => {
        template += dedent`
              ${example.description}:
              \`\`\`bash
              nx ${example.command}
              \`\`\`
            `;
      });
    }

    if (Array.isArray(command.options) && !!command.options.length) {
      template += '\n## Options';

      command.options
        .sort((a, b) => sortAlphabeticallyFunction(a.name, b.name))
        .forEach((option) => {
          template += dedent`
                ### ${option.deprecated ? `~~${option.name}~~` : option.name}
                ${
                  option.default === undefined || option.default === ''
                    ? ''
                    : `Default: \`${option.default}\`\n`
                }
              `;
          template += dedent`
                ${formatDeprecated(option.description, option.deprecated)}
              `;
        });
    }

    return {
      name: command.name
        .replace(':', '-')
        .replace(' ', '-')
        .replace(/[\]\[.]+/gm, ''),
      template,
    };
  }

  // TODO: Try to add option's type, examples, and group?
  const nxCommands = getCommands(commandsObject);
  await Promise.all(
    Object.keys(nxCommands)
      .filter((name) => !sharedCommands.includes(name))
      .filter((name) => nxCommands[name].description)
      .map((name) => parseCommand(name, nxCommands[name]))
      .map(async (command) => generateMarkdown(await command))
      .map(async (templateObject) =>
        generateMarkdownFile(commandsOutputDirectory, await templateObject)
      )
  );

  await Promise.all(
    sharedCommands.map((command) => {
      const sharedCommandsDirectory = join(__dirname, '../../docs/shared/cli');
      const sharedCommandsOutputDirectory = join(
        __dirname,
        '../../docs/',
        'generated',
        'cli'
      );
      const templateObject = {
        name: command,
        template: readFileSync(
          join(sharedCommandsDirectory, `${command}.md`),
          'utf-8'
        ),
      };

      return generateMarkdownFile(
        sharedCommandsOutputDirectory,
        templateObject
      );
    })
  );

  delete process.env.NX_GENERATE_DOCS_PROCESS;

  console.log(`${chalk.green('✓')} Generated Documentation for Nx Commands`);
}
