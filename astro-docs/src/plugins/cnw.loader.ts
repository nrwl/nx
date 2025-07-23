import { workspaceRoot } from '@nx/devkit';
import { join, relative } from 'path';
import { fork } from 'child_process';
import type { Loader, LoaderContext } from 'astro/loaders';
import type { CollectionEntry, RenderedContent } from 'astro:content';
import { watchAndCall } from './utils/watch.ts';

type DocEntry = CollectionEntry<'cnw-docs'>;

interface ParsedCommandOption {
  name: string[];
  type: string;
  description: string;
  default: any;
  deprecated: boolean | string;
  hidden: boolean;
  choices?: string[];
}

interface ParsedCommand {
  name: string;
  commandString: string;
  description: string;
  options?: ParsedCommandOption[];
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
            // Aliases should be formatted with single dash for short options
            return n.length === 1 ? `\`--${n}\`` : `\`--${n}\``;
          }
        })
        .join(', ');

      let description = option.description || '';

      // Add deprecation warning
      if (option.deprecated) {
        description += ` **⚠️ Deprecated**${
          option.deprecated !== true ? `: ${option.deprecated}` : ''
        }`;
      }

      // Add choices if available
      let type = option.type;
      if (option.choices && option.choices.length > 0) {
        type = option.choices.map((c) => `\`${c}\``).join(', ');
      }

      // Add default value
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

export function CnwLoader(): Loader {
  return {
    name: 'cnw-loader',
    load: async ({ store, logger, watcher, renderMarkdown }) => {
      // Function to regenerate CNW docs
      const generate = async () => {
        store.clear();
        // @ts-expect-error - astro:content types seem to always be out of sync w/ generated types
        const entry = await generateCnwDocs(logger, renderMarkdown);
        store.set(entry);
        logger.info(`Generated CNW documentation`);
      };

      if (watcher) {
        const pathsToWatch = [
          join(import.meta.dirname, 'cnw.loader.ts'),
          join(import.meta.dirname, 'utils', 'cnw-subprocess.cjs'),
        ];

        watchAndCall(watcher, pathsToWatch, generate);
      }
      await generate();
    },
  };
}

async function generateCnwDocs(
  logger: LoaderContext['logger'],
  renderMarkdown: (content: string) => Promise<RenderedContent>
): Promise<DocEntry> {
  logger.info('🔍 Generating Create Nx Workspace documentation...');

  try {
    // Run the CNW parser in a subprocess to avoid ESM/CJS issues
    const subprocessPath = join(
      workspaceRoot,
      'astro-docs/src/plugins/utils/cnw-subprocess.cjs'
    );

    // Run subprocess and get results
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

    logger.info('✅ Generated Create Nx Workspace documentation');

    const entry: DocEntry = {
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
        docType: 'cnw',
      },
      rendered: await renderMarkdown(markdown),
      collection: 'cnw-docs',
    };

    return entry;
  } catch (error: any) {
    logger.error('❌ Failed to generate CNW docs:');
    logger.error(error.message);
    throw error;
  }
}
