import { readJsonSync } from 'fs-extra';
import { workspaceRoot } from '@nx/devkit';
import { outputFileSync } from 'fs-extra';
import { join } from 'path';
import { register as registerTsConfigPaths } from 'tsconfig-paths';

const importFresh = require('import-fresh');

// Set environment variable for documentation generation
process.env.NX_GENERATE_DOCS_PROCESS = 'true';

interface ParsedCommandOption {
  name: string[];
  type: string;
  description: string;
  default: string;
  deprecated: boolean | string;
  hidden: boolean;
  choices?: string[];
}

interface ParsedCommand {
  name: string;
  command: string;
  description: string;
  aliases: string[];
  options: ParsedCommandOption[];
}

const YargsTypes = ['array', 'count', 'string', 'boolean', 'number'];

// Helper functions adapted from the legacy documentation utils
function getCommands(command: any) {
  return command.getInternalMethods().getCommandInstance().getCommandHandlers();
}

async function parseCommand(
  name: string,
  command: any
): Promise<ParsedCommand> {
  // If it's not a function, return a stripped down version
  if (
    !(
      command.builder &&
      command.builder.constructor &&
      command.builder.call &&
      command.builder.apply
    )
  ) {
    return {
      name,
      command: command.original || name,
      description:
        command.description || command.describe || command.desc || '',
      aliases: [],
      options: [],
    };
  }

  // Get options from yargs builder
  const builder = await command.builder(
    importFresh('yargs')().getInternalMethods().reset()
  );

  const builderDescriptions = builder
    .getInternalMethods()
    .getUsageInstance()
    .getDescriptions();
  const builderOptions = builder.getOptions();
  const builderDefaultOptions = builderOptions.default;
  const builderAutomatedOptions = builderOptions.defaultDescription;
  const builderDeprecatedOptions = builder.getDeprecatedOptions();
  const builderOptionsChoices = builderOptions.choices;

  const builderOptionTypes = YargsTypes.reduce((acc, type) => {
    builderOptions[type].forEach(
      (option: any) => (acc = { ...acc, [option]: type })
    );
    return acc;
  }, {});

  // Extract options
  const options: ParsedCommandOption[] = Object.keys(builderDescriptions)
    .map((key) => ({
      name: [key, ...(builderOptions.alias[key] || [])],
      description: builderDescriptions[key]
        ? builderDescriptions[key].replace('__yargsString__:', '')
        : '',
      default: builderDefaultOptions[key] ?? builderAutomatedOptions[key],
      type: (builderOptionTypes as any)[key] || 'string',
      choices: builderOptionsChoices[key],
      deprecated: builderDeprecatedOptions[key],
      hidden: builderOptions.hiddenOptions.includes(key),
    }))
    .filter((option) => !option.hidden);

  return {
    name,
    command: command.original ? command.original.replace('$0', name) : name,
    description: command.description || command.describe || command.desc || '',
    aliases: [],
    options,
  };
}

function generateCLIOverviewPage(
  commands: Record<string, ParsedCommand>,
  outputDir: string
) {
  const commandNames = Object.keys(commands).sort();

  const content = `---
title: Nx CLI
description: Complete reference for all Nx CLI commands
---

# Nx CLI

The Nx command line has various subcommands and options to help you manage your Nx workspace and run tasks efficiently. 
Below is a complete reference for all available commands and their options.
You can run nx --help to view all available options. 

## Available Commands

${commandNames
  .map((cmdName) => {
    const cmd = commands[cmdName];
    let section = `### \`nx ${cmdName}\`\n`;

    section += cmd.description || 'No description available';

    if (cmd.aliases && cmd.aliases.length > 0) {
      section += `**Aliases:** ${cmd.aliases
        .map((alias) => `\`${alias}\``)
        .join(', ')}`;
    }

    section += `\n\n**Usage:**
\`\`\`bash
nx ${cmd.command || cmdName}
\`\`\`
`;

    // Add options table if there are options
    if (cmd.options && cmd.options.length > 0) {
      section += '\n#### Options\n\n';
      section += '| Option | Type | Description | Default |\n';
      section += '|--------|------|-------------|---------|\n';

      const sortedOptions = cmd.options.sort((a, b) =>
        a.name[0].localeCompare(b.name[0])
      );

      for (const option of sortedOptions) {
        const optionNames = option.name.map((n) => `\`--${n}\``).join(', ');
        let description = option.description || 'No description';

        // Add alias information
        if (option.name.length > 1) {
          const aliases = option.name
            .slice(1)
            .map((a) => `\`-${a}\``)
            .join(', ');
          description += ` (alias: ${aliases})`;
        }

        // Add deprecation warning
        if (option.deprecated) {
          description += ` **⚠️ Deprecated**${
            option.deprecated !== true ? `: ${option.deprecated}` : ''
          }`;
        }

        // Add choices if available
        if (option.choices && option.choices.length > 0) {
          description += ` (choices: ${option.choices
            .map((c) => `\`${c}\``)
            .join(', ')})`;
        }

        const defaultValue =
          option.default !== undefined
            ? `\`${JSON.stringify(option.default).replace(/"/g, '')}\``
            : '';

        section += `| ${optionNames} | ${option.type} | ${description} | ${defaultValue} |\n`;
      }

      section += '\n';
    }

    return section;
  })
  .join('\n')}

## Getting Help

You can get help for any command by adding the \`--help\` flag:

\`\`\`bash
nx <command> --help
\`\`\`
`;

  outputFileSync(join(outputDir, 'nx-cli.md'), content);
}

async function generateCLIDocs() {
  console.log('🔍 Analyzing Nx CLI commands...');

  // Register TypeScript paths from the base config (same as legacy script)
  const config = readJsonSync(
    join(workspaceRoot, 'tsconfig.base.json')
  ).compilerOptions;
  registerTsConfigPaths(config);

  console.log('📁 Using yargs command object...');

  // Import the commandsObject from the nx-commands file (same as legacy script)
  const nxCommandsPath = join(
    workspaceRoot,
    'packages/nx/src/command-line/nx-commands'
  );
  const { commandsObject } = importFresh(nxCommandsPath);

  // Get all commands from yargs
  const nxCommands = getCommands(commandsObject);

  // Commands to exclude from documentation (same as legacy script)
  const sharedCommands = ['generate', 'exec'];
  const hiddenCommands = ['$0', 'conformance', 'conformance:check'];

  const commands: Record<string, ParsedCommand> = {};

  // Parse each command
  for (const [name, commandConfig] of Object.entries(nxCommands)) {
    if (sharedCommands.includes(name) || hiddenCommands.includes(name)) {
      continue;
    }

    // Check if command has description (same as legacy script)
    if (
      !(
        (commandConfig as any).description ||
        (commandConfig as any).describe ||
        (commandConfig as any).desc
      )
    ) {
      continue;
    }

    try {
      const parsedCommand = await parseCommand(name, commandConfig);
      commands[name] = parsedCommand;
    } catch (error) {
      console.warn(`⚠️ Could not parse command ${name}:`, error.message);
    }
  }

  const outputDir = join(__dirname, '../docs/api');

  // Only generate the overview page with all commands included
  generateCLIOverviewPage(commands, outputDir);

  delete process.env.NX_GENERATE_DOCS_PROCESS;

  console.log(
    `✅ Generated CLI documentation with ${
      Object.keys(commands).length
    } commands`
  );
}

// Run the generator
if (require.main === module) {
  generateCLIDocs().catch(console.error);
}

export { generateCLIDocs };
