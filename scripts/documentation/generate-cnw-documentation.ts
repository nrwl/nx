import * as chalk from 'chalk';
import { dedent } from 'tslint/lib/utils';
import {
  generateMarkdownFile,
  getCommands,
  parseCommand,
  ParsedCommand,
  sortAlphabeticallyFunction,
  formatDeprecated,
  generateOptionsMarkdown,
} from './utils';
const importFresh = require('import-fresh');

export async function generateCNWocumentation(commandsOutputDirectory: string) {
  process.env.NX_GENERATE_DOCS_PROCESS = 'true';

  console.log(
    `\n${chalk.blue(
      'i'
    )} Generating Documentation for Create Nx Workspace Command`
  );

  const { commandsObject } = importFresh(
    '../../packages/create-nx-workspace/bin/create-nx-workspace'
  );

  const command = getCommands(commandsObject)['$0'];
  const parsedCommand = await parseCommand('create-nx-workspace', command);
  const markdown = generateMarkdown(parsedCommand);
  generateMarkdownFile(commandsOutputDirectory, markdown);

  delete process.env.NX_GENERATE_DOCS_PROCESS;

  console.log(
    `${chalk.green(
      '✓'
    )} Generated Documentation for Create Nx Workspace Command`
  );
}

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
  ${command.commandString}
  \`\`\`

  Install \`create-nx-workspace\` globally to invoke the command directly, or use \`npx create-nx-workspace\`, \`yarn create nx-workspace\`, or \`pnpx create-nx-workspace\`.\n`;

  template += generateOptionsMarkdown(command);

  return {
    name: command.name,
    template,
  };
}
