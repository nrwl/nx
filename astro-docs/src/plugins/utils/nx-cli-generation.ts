import { workspaceRoot } from '@nx/devkit';
import type { LoaderContext } from 'astro/loaders';
import type { CollectionEntry } from 'astro:content';
import { fork } from 'node:child_process';
import { join, relative } from 'node:path';

export interface ParsedCliCommand {
  name?: string;
  command?: string;
  description?: string;
  aliases?: string[];
  options?: Array<{
    name: string[];
    type: string;
    description: string;
    default?: any;
    deprecated?: boolean | string;
    choices?: string[];
  }>;
}

export async function loadNxCliPackage(
  context: LoaderContext
): Promise<CollectionEntry<'nx-reference-packages'>> {
  const { logger, renderMarkdown } = context;
  logger.info('🔍 Loading Nx CLI documentation...');

  const subprocessPath = join(
    workspaceRoot,
    'astro-docs/src/plugins/utils/cli-subprocess.cjs'
  );

  const result = await new Promise<{
    commands: Record<string, ParsedCliCommand>;
  }>((resolve, reject) => {
    const child = fork(subprocessPath, [], {
      cwd: workspaceRoot,
      silent: true,
      stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
    });

    child.on('message', (message: any) => {
      if (message.type === 'result') {
        resolve(message.data);
      } else if (message.type === 'error') {
        reject(new Error(message.error));
      }
      child.send({ type: 'stop' });
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`CLI subprocess exited with code ${code}`));
      }
    });

    child.send({ type: 'start' });
  });

  const markdown = generateCLIMarkdown(result.commands);

  logger.info(
    `✅ Loaded CLI documentation with ${
      Object.keys(result.commands).length
    } commands`
  );

  const entry: CollectionEntry<'nx-reference-packages'> = {
    id: 'nx-cli',
    body: markdown,
    filePath: relative(
      join(workspaceRoot, 'astro-docs'),
      join(workspaceRoot, 'packages/nx/src/command-line/nx-commands.ts')
    ),
    data: {
      title: 'Nx Commands',
      packageType: 'nx-cli',
      docType: 'cli',
      description: 'Complete reference for Nx CLI commands',
    },
    // @ts-expect-error - astro types are mismatched bc of auto generated location loading, etc
    rendered: await renderMarkdown(markdown),
    collection: 'nx-reference-packages',
  };

  return entry;
}

function generateCLIMarkdown(
  commands: Record<string, ParsedCliCommand>
): string {
  const commandNames = Object.keys(commands).sort();

  const content = `
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

        if (option.name.length > 1) {
          const aliases = option.name
            .slice(1)
            .map((a) => `\`-${a}\``)
            .join(', ');
          description += ` (alias: ${aliases})`;
        }

        if (option.deprecated) {
          description += ` **⚠️ Deprecated**${
            option.deprecated !== true ? `: ${option.deprecated}` : ''
          }`;
        }

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
