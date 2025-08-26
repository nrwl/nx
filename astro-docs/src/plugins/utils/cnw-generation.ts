import { workspaceRoot } from '@nx/devkit';
import type { LoaderContext } from 'astro/loaders';
import type { CollectionEntry } from 'astro:content';
import { fork } from 'node:child_process';
import { join, relative } from 'node:path';

export interface ParsedCommandOption {
  name: string[];
  type: string;
  description: string;
  default: any;
  deprecated: boolean | string;
  hidden: boolean;
  choices?: string[];
}

export interface ParsedCommand {
  name: string;
  commandString: string;
  description: string;
  options?: ParsedCommandOption[];
}

export async function loadCnwPackage(
  context: LoaderContext
): Promise<CollectionEntry<'nx-reference-packages'>> {
  const { logger, renderMarkdown } = context;
  logger.info('🔍 Loading Create Nx Workspace documentation...');

  const subprocessPath = join(
    workspaceRoot,
    'astro-docs/src/plugins/utils/cnw-subprocess.cjs'
  );

  const result = await new Promise<{
    command: ParsedCommand;
    presets: string[];
    presetDescriptions: Record<string, string>;
  }>((resolve, reject) => {
    const child = fork(subprocessPath, [], {
      cwd: workspaceRoot,
      silent: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
      logger.warn(data.toString());
    });

    child.on('message', (message: any) => {
      if (message.type === 'result') {
        resolve(message.data);
      } else if (message.type === 'error') {
        reject(new Error(message.error));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('exit', (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `CNW subprocess exited with code ${code}\nstderr: ${stderr}`
          )
        );
      }
    });
  });

  const markdown = generateCNWMarkdown(
    result.command,
    result.presets,
    result.presetDescriptions
  );

  logger.info('✅ Loaded Create Nx Workspace documentation');

  const entry: CollectionEntry<'nx-reference-packages'> = {
    id: 'cnw-cli',
    body: markdown,
    filePath: relative(
      join(workspaceRoot, 'astro-docs'),
      join(
        workspaceRoot,
        'packages/create-nx-workspace/bin/create-nx-workspace.ts'
      )
    ),
    data: {
      title: 'create-nx-workspace',
      packageType: 'cnw',
      docType: 'cli',
      description: 'Create a new Nx workspace',
    },
    // @ts-expect-error - astro types are mismatched bc of auto generated location loading, etc
    rendered: await renderMarkdown(markdown),
  };

  return entry;
}

function generateCNWMarkdown(
  command: ParsedCommand,
  presets: string[],
  presetDescriptions: Record<string, string>
): string {
  let content = `
${command.description}

## Usage

\`\`\`bash
npx ${command.commandString}
\`\`\`

`;

  // Add options table
  if (command.options && command.options.length > 0) {
    content += '## Options\n\n';
    content += '| Option | Type | Description |\n';
    content += '| ----------- | ----------- | ---------- |\n';

    const sortedOptions = command.options
      .filter((option) => !option.hidden)
      .sort((a, b) => a.name[0].localeCompare(b.name[0]));

    for (const option of sortedOptions) {
      const optionNames = option.name
        .map((n, index) => {
          if (index === 0) {
            return `\`--${n}\``;
          } else {
            return n.length === 1 ? `\`--${n}\`` : `\`--${n}\``;
          }
        })
        .join(', ');

      let description = option.description || '';

      if (option.deprecated) {
        description += ` **⚠️ Deprecated**${
          option.deprecated !== true ? `: ${option.deprecated}` : ''
        }`;
      }

      let type = option.type;
      if (option.choices && option.choices.length > 0) {
        type = option.choices.map((c) => `\`${c}\``).join(', ');
      }

      if (option.default !== undefined) {
        description += ` (Default: \`${JSON.stringify(option.default).replace(
          /"/g,
          ''
        )}\`)`;
      }

      content += `| ${optionNames} | ${type} | ${
        description || '_No Description_'
      } |\n`;
    }

    content += '\n';
  }

  // Add presets table
  content += '## Presets\n\n';
  content += '| Preset | Description |\n';
  content += '| ---------- | ----------|\n';

  const sortedPresets = presets.sort();
  for (const preset of sortedPresets) {
    const description =
      presetDescriptions[preset] || 'No description available';
    content += `| ${preset} | ${description} |\n`;
  }

  return content;
}
