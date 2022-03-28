import * as chalk from 'chalk';
import { join } from 'path';
import { dedent } from 'tslint/lib/utils';
import {
  formatDeprecated,
  sortAlphabeticallyFunction,
  generateMarkdownFile,
} from './utils';
const importFresh = require('import-fresh');

export async function generateCNWocumentation() {
  process.env.NX_GENERATE_DOCS_PROCESS = 'true';

  console.log(
    `\n${chalk.blue(
      'i'
    )} Generating Documentation for Create Nx Workspace Command`
  );

  const { commandsObject } = importFresh(
    '../../packages/create-nx-workspace/bin/create-nx-workspace'
  );

  const commandsOutputDirectory = join(
    __dirname,
    '../../docs/',
    'generated',
    'cli'
  );

  const command = commandsObject.getCommandInstance().getCommandHandlers()[
    '$0'
  ];
  const parsedCommand = await parseCommand(command);
  const markdown = generateMarkdown(parsedCommand);
  generateMarkdownFile(commandsOutputDirectory, markdown);

  delete process.env.NX_GENERATE_DOCS_PROCESS;

  console.log(
    `${chalk.green(
      '✓'
    )} Generated Documentation for Create Nx Workspace Command`
  );
}

interface ParsedCommandOption {
  name: string;
  description: string;
  default: string;
  deprecated: boolean | string;
}

interface ParsedCommand {
  commandString: string;
  description: string;
  options?: Array<ParsedCommandOption>;
}

async function parseCommand(command: any): Promise<ParsedCommand> {
  const builder = await command.builder(importFresh('yargs')().resetOptions());
  const builderDescriptions = builder.getUsageInstance().getDescriptions();
  const builderDefaultOptions = builder.getOptions().default;
  const builderAutomatedOptions = builder.getOptions().defaultDescription;
  const builderDeprecatedOptions = builder.getDeprecatedOptions();

  return {
    description: command.description,
    commandString: command.original.replace('$0', 'create-nx-workspace'),
    options:
      Object.keys(builderDescriptions).map((key) => ({
        name: key,
        description: builderDescriptions[key]
          ? builderDescriptions[key].replace('__yargsString__:', '')
          : '',
        default: builderDefaultOptions[key] || builderAutomatedOptions[key],
        deprecated: builderDeprecatedOptions[key],
      })) || null,
  };
}

function generateMarkdown(command: ParsedCommand) {
  let template = dedent`
  ---
  title: "create-nx-workspace - CLI command"
  description: "${command.description}"
  ---
  # create-nx-workspace

  ${command.description}

  ## Usage

  \`\`\`bash
  ${command.commandString}
  \`\`\`

  Install \`create-nx-workspace\` globally to invoke the command directly, or use \`npx create-nx-workspace\`, \`yarn create nx-workspace\`, or \`pnpx create-nx-workspace\`.\n`;

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

  return {
    name: 'create-nx-workspace',
    template,
  };
}
