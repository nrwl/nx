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
  subcommands?: ParsedCliCommand[];
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
      slug: 'reference/nx-commands',
      packageType: 'nx-cli',
      docType: 'cli',
      description: 'Complete reference for Nx CLI commands',
      filter: 'type:References',
    },
    // @ts-expect-error - astro types are mismatched bc of auto generated location loading, etc
    rendered: await renderMarkdown(markdown),
    collection: 'nx-reference-packages',
  };

  return entry;
}

interface FlattenedCommand {
  fullName: string;
  cmd: ParsedCliCommand;
  parentOptions?: ParsedCliCommand['options'];
}

function flattenCommands(
  commands: Record<string, ParsedCliCommand>
): FlattenedCommand[] {
  const allCommands: FlattenedCommand[] = [];

  for (const [cmdName, cmd] of Object.entries(commands)) {
    allCommands.push({ fullName: cmdName, cmd });

    if (cmd.subcommands) {
      for (const sub of cmd.subcommands) {
        // For $0 (default command), use parent name; otherwise, combine parent and sub name
        const subName =
          sub.command?.startsWith('$0') || sub.name === '$0'
            ? cmdName
            : `${cmdName} ${sub.name}`;
        allCommands.push({
          fullName: subName,
          cmd: sub,
          parentOptions: cmd.options,
        });
      }
    }
  }

  return allCommands.sort((a, b) => a.fullName.localeCompare(b.fullName));
}

function generateOptionsTable(
  options: ParsedCliCommand['options'],
  label = 'Options'
): string {
  if (!options || options.length === 0) {
    return '';
  }

  let section = `\n#### ${label}\n\n`;
  section += '| Option | Type | Description | Default |\n';
  section += '|--------|------|-------------|---------|\n';

  const sortedOptions = [...options].sort((a, b) =>
    a.name[0].localeCompare(b.name[0])
  );

  for (const option of sortedOptions) {
    // Format option names following the convention:
    // - Canonical (first) option always gets --
    // - Single-character aliases get -
    // - Multi-character aliases get --
    const [canonical, ...aliases] = option.name;
    const formattedNames = [canonical, ...aliases].map((name) => {
      if (name === canonical) {
        return `\`--${name}\``;
      }
      return name.length === 1 ? `\`-${name}\`` : `\`--${name}\``;
    });
    const optionNames = formattedNames.join(', ');
    let description = option.description || '';

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
  return section;
}

function generateCLIMarkdown(
  commands: Record<string, ParsedCliCommand>
): string {
  const flattenedCommands = flattenCommands(commands);

  const content = `
The Nx command line has various subcommands and options to help you manage your Nx workspace and run tasks efficiently.
Below is a complete reference for all available commands and their options.
You can run nx --help to view all available options.

## Available Commands

${flattenedCommands
  .map(({ fullName, cmd, parentOptions }) => {
    let section = `### \`nx ${fullName}\`\n`;

    section += cmd.description || 'No description available';

    if (cmd.aliases && cmd.aliases.length > 0) {
      section += `\n\n**Aliases:** ${cmd.aliases
        .map((alias) => `\`${alias}\``)
        .join(', ')}`;
    }

    // Build the usage command string
    const usageCmd = cmd.command
      ? cmd.command.replace('$0', fullName)
      : fullName;

    section += `\n\n**Usage:**
\`\`\`bash
nx ${usageCmd}
\`\`\`
`;

    // If this is a parent command with subcommands, label options as "Shared Options"
    const hasSubcommands = cmd.subcommands && cmd.subcommands.length > 0;
    const optionsLabel = hasSubcommands ? 'Shared Options' : 'Options';

    // Add options table if there are options
    section += generateOptionsTable(cmd.options, optionsLabel);

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
