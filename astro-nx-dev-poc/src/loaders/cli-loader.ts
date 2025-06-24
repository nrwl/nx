import { workspaceRoot } from '@nx/devkit';
import { readFileSync } from 'fs';
import { join } from 'path';
import { register as registerTsConfigPaths } from 'tsconfig-paths';
import {
  getCommands,
  parseCommand,
  type ParsedCommand,
} from './utils/nx-command-parser';

function generateCLIMarkdown(commands: Record<string, ParsedCommand>): string {
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
        let description = option.description || '';

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

        section += `| ${optionNames} | ${option.type} | ${
          description || '_No Description_'
        } | ${defaultValue} |\n`;
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

  return content;
}

export async function generateNxCliDocs(): Promise<string> {
  console.log('🔍 Generating Nx CLI documentation...');

  try {
    // Look for nx-commands in the main Nx repository (go up from poc-beta-docs)
    const nxCommandsPath = join(
      workspaceRoot,
      '../packages/nx/src/command-line/nx-commands'
    );

    console.log(`📍 Looking for nx-commands at: ${nxCommandsPath}`);

    // If the nx-commands file doesn't exist, try alternative path
    if (!require('fs').existsSync(nxCommandsPath)) {
      console.error('❌ Nx CLI source not found at expected location');
      throw new Error(`Cannot find nx-commands at ${nxCommandsPath}`);
    }

    // Register TypeScript paths from the base config in main Nx repo
    const tsconfigPath = join(workspaceRoot, '../tsconfig.base.json');
    const config = readJsonSync(tsconfigPath).compilerOptions;
    registerTsConfigPaths(config);

    console.log('📁 Using yargs command object...');

    const { default: importFresh } = await import('import-fresh');
    const { commandsObject } = importFresh(nxCommandsPath);

    // Get all commands from yargs
    const nxCommands = getCommands(commandsObject);

    // Commands to exclude from documentation
    const sharedCommands = ['generate', 'exec'];
    const hiddenCommands = ['$0', 'conformance', 'conformance:check'];

    const commands: Record<string, ParsedCommand> = {};

    // Parse each command
    for (const [name, commandConfig] of Object.entries(nxCommands)) {
      if (sharedCommands.includes(name) || hiddenCommands.includes(name)) {
        continue;
      }

      // Check if command has description
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
        const parsedCommand = await parseCommand(
          name,
          commandConfig,
          importFresh
        );
        commands[name] = parsedCommand;
      } catch (error: any) {
        console.warn(`⚠️ Could not parse command ${name}:`, error.message);
      }
    }

    const markdown = generateCLIMarkdown(commands);

    delete process.env.NX_GENERATE_DOCS_PROCESS;

    console.log(
      `✅ Generated CLI documentation with ${
        Object.keys(commands).length
      } commands`
    );

    return markdown;
  } catch (error: any) {
    console.error('❌ Failed to generate CLI docs:', error.message);
    throw error;
  }
}

function readJsonSync(filePath: string): any {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading JSON file at ${filePath}:`, error);
    throw error;
  }
}
