import * as chalk from 'chalk';
import { readFileSync } from 'fs';
import { readJsonSync, removeSync } from 'fs-extra';
import { join } from 'path';
import { dedent } from 'tslint/lib/utils';
import { Framework, Frameworks } from './frameworks';
import {
  formatDeprecated,
  generateMarkdownFile,
  sortAlphabeticallyFunction,
} from './utils';
import { register as registerTsConfigPaths } from 'tsconfig-paths';

import { examples } from '../../packages/workspace/src/command-line/examples';

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

interface ParsedCommandOption {
  name: string;
  description: string;
  default: string;
  deprecated: boolean | string;
}

interface ParsedCommand {
  name: string;
  description: string;
  options?: Array<ParsedCommandOption>;
}

export async function generateCLIDocumentation() {
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
    '../../packages/workspace/src/command-line/nx-commands'
  );

  await Promise.all(
    Frameworks.map(async (framework: Framework) => {
      const commandsOutputDirectory = join(
        __dirname,
        '../../docs/',
        framework,
        'cli'
      );
      removeSync(commandsOutputDirectory);

      function getCommands(command) {
        return command.getCommandInstance().getCommandHandlers();
      }
      async function parseCommandInstance(
        name: string,
        command: any
      ): Promise<ParsedCommand> {
        // It is not a function return a strip down version of the command
        if (
          !(
            command.builder &&
            command.builder.constructor &&
            command.builder.call &&
            command.builder.apply
          )
        ) {
          return { name, description: command.description };
        }
        // Show all the options we can get from yargs
        const builder = await command.builder(
          importFresh('yargs')().resetOptions()
        );
        const builderDescriptions = builder
          .getUsageInstance()
          .getDescriptions();
        const builderDefaultOptions = builder.getOptions().default;
        const builderDeprecatedOptions = builder.getDeprecatedOptions();
        return {
          name,
          description: command.description,
          options:
            Object.keys(builderDescriptions).map((key) => ({
              name: key,
              description: builderDescriptions[key]
                ? builderDescriptions[key].replace('__yargsString__:', '')
                : '',
              default: builderDefaultOptions[key],
              deprecated: builderDeprecatedOptions[key],
            })) || null,
        };
      }

      function generateMarkdown(command: ParsedCommand) {
        let template = dedent`
# ${command.name}

${command.description}

## Usage

\`\`\`bash
nx ${command.name}
\`\`\`

[Install \`nx\` globally]({{framework}}/getting-started/nx-setup#install-nx) to invoke the command directly using \`nx\`, or use \`npx nx\`, \`yarn nx\`, or \`pnpx nx\`.\n`;

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
          .map((name) => parseCommandInstance(name, nxCommands[name]))
          .map(async (command) => generateMarkdown(await command))
          .map(async (templateObject) =>
            generateMarkdownFile(commandsOutputDirectory, await templateObject)
          )
      );

      await Promise.all(
        sharedCommands.map((command) => {
          const sharedCommandsDirectory = join(
            __dirname,
            '../../docs/shared/cli'
          );
          const sharedCommandsOutputDirectory = join(
            __dirname,
            '../../docs/',
            framework,
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
    })
  );

  delete process.env.NX_GENERATE_DOCS_PROCESS;

  console.log(`${chalk.green('✓')} Generated Documentation for Nx Commands`);
}
