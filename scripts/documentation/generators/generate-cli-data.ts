import * as chalk from 'chalk';
import { readFileSync } from 'fs';
import { readJsonSync } from 'fs-extra';
import { codeBlock, h1, h2, h3, lines } from 'markdown-factory';
import { join } from 'path';
import { register as registerTsConfigPaths } from 'tsconfig-paths';

import { examples } from '../../../packages/nx/src/command-line/examples';
import {
  formatDescription,
  generateMarkdownFile,
  generateOptionsMarkdown,
  getCommands,
  parseCommand,
  ParsedCommand,
} from '../utils';

const importFresh = require('import-fresh');

const sharedCommands = ['generate', 'run'];

export async function generateCliDocumentation(
  commandsOutputDirectory: string
) {
  /**
   * For certain commands, they will output dynamic data at runtime in a real workspace,
   * so we leverage an envrionment variable to inform the logic of the context that we
   * are just statically generating documentation for the current execution.
   */
  process.env.NX_GENERATE_DOCS_PROCESS = 'true';

  const config = readJsonSync(
    join(__dirname, '../../../tsconfig.base.json')
  ).compilerOptions;
  registerTsConfigPaths(config);

  console.log(`\n${chalk.blue('i')} Generating Documentation for Nx Commands`);

  const { commandsObject } = importFresh(
    '../../../packages/nx/src/command-line/nx-commands'
  );

  function generateMarkdown(command: ParsedCommand) {
    let templateLines = [
      `
---
title: "${command.name} - CLI command"
description: "${command.description}"
---`,
      h1(command.name),
      formatDescription(command.description, command.deprecated),
      h2('Usage'),
      codeBlock(`nx ${command.commandString}`, 'shell'),
      'Install `nx` globally to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpm nx`.',
    ];

    if (examples[command.name] && examples[command.name].length > 0) {
      templateLines.push(h3('Examples'));
      examples[command.name].forEach((example) => {
        templateLines.push(
          example.description + ':',
          codeBlock(` nx ${example.command}`, 'shell')
        );
      });
    }

    templateLines.push(generateOptionsMarkdown(command));

    if (command.subcommands?.length) {
      templateLines.push(h2('Subcommands'));
      for (const subcommand of command.subcommands) {
        templateLines.push(
          h3(subcommand.name),
          formatDescription(subcommand.description, subcommand.deprecated),
          codeBlock(
            `nx ${command.commandString} ${subcommand.commandString}`,
            'shell'
          ),
          generateOptionsMarkdown(subcommand, 2)
        );
      }
    }

    return {
      name: command.name
        .replace(':', '-')
        .replace(' ', '-')
        .replace(/[\]\[.]+/gm, ''),
      template: lines(templateLines),
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
      const sharedCommandsDirectory = join(
        __dirname,
        '../../../docs/shared/cli'
      );
      const sharedCommandsOutputDirectory = join(
        __dirname,
        '../../../docs/',
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
