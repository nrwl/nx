import { workspaceRoot } from '@nx/devkit';
import { join, relative } from 'path';
import { fork } from 'child_process';
import {
  existsSync,
  readFileSync,
  cpSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import * as typedoc from 'typedoc';
import type { Loader, LoaderContext } from 'astro/loaders';
import type { CollectionEntry, RenderedContent } from 'astro:content';
import { watchAndCall } from './utils/watch';
import NxMarkdownTheme from './utils/typedoc/theme';
import {
  parseExecutors,
  parseGenerators,
  parseMigrations,
} from './utils/plugin-schema-parser';
import {
  getExecutorsMarkdown,
  getGeneratorsMarkdown,
  getMigrationsMarkdown,
} from './utils/generate-plugin-markdown';
import {
  getGithubStars,
  getNpmData,
  getNpmDownloads,
  shouldFetchStats,
} from './utils/plugin-stats';

type DocEntry = CollectionEntry<'nx-reference-packages'>;
// ============================================================================
// CNW (Create Nx Workspace) Package Loader
// ============================================================================

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

async function loadCnwPackage(context: LoaderContext): Promise<DocEntry[]> {
  const { logger, renderMarkdown } = context;
  logger.info('🔍 Loading Create Nx Workspace documentation...');

  try {
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
        packageType: 'cnw',
        docType: 'cli',
        description: 'Create a new Nx workspace',
      },
      // @ts-expect-error - astro types are mismatched bc of auto generated location loading, etc
      rendered: await renderMarkdown(markdown),
      collection: 'nx-reference-packages',
    };

    return [entry];
  } catch (error: any) {
    logger.error('❌ Failed to load CNW docs:');
    logger.error(error.message);
    return [];
  }
}

// ============================================================================
// Nx CLI Package Loader
// ============================================================================

interface ParsedCliCommand {
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

async function loadNxCliPackage(context: LoaderContext): Promise<DocEntry[]> {
  const { logger, renderMarkdown } = context;
  logger.info('🔍 Loading Nx CLI documentation...');

  try {
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

    const entry: DocEntry = {
      id: 'nx-cli',
      body: markdown,
      filePath: relative(
        join(workspaceRoot, 'astro-docs'),
        join(workspaceRoot, 'packages/nx/src/command-line/nx-commands.ts')
      ),
      data: {
        title: 'Nx CLI Reference',
        packageType: 'nx-cli',
        docType: 'cli',
        description: 'Complete reference for Nx CLI commands',
      },
      // @ts-expect-error - astro types are mismatched bc of auto generated location loading, etc
      rendered: await renderMarkdown(markdown),
      collection: 'nx-reference-packages',
    };

    return [entry];
  } catch (error: any) {
    logger.error('❌ Failed to load CLI docs:');
    logger.error(error.message);
    return [];
  }
}

// ============================================================================
// DevKit Package Loader
// ============================================================================

const categoryMap: Record<number, string> = {
  [typedoc.ReflectionKind.Class]: 'Classes',
  [typedoc.ReflectionKind.Enum]: 'Enumerations',
  [typedoc.ReflectionKind.Function]: 'Functions',
  [typedoc.ReflectionKind.Interface]: 'Interfaces',
  [typedoc.ReflectionKind.TypeAlias]: 'Type Aliases',
  [typedoc.ReflectionKind.Variable]: 'Variables',
};

const allowedReflections = [
  typedoc.ReflectionKind.Class,
  typedoc.ReflectionKind.Enum,
  typedoc.ReflectionKind.Function,
  typedoc.ReflectionKind.Interface,
  typedoc.ReflectionKind.TypeAlias,
  typedoc.ReflectionKind.Variable,
];

function setupTypeDoc(logger: any) {
  const tempDir = join(tmpdir(), `nx-devkit-docs`);
  const projectRoot = process.cwd();
  const buildDir = join(workspaceRoot, 'dist', 'packages', 'devkit');
  const outDir = join(tempDir, 'docs', 'generated', 'devkit');

  mkdirSync(buildDir, { recursive: true });
  mkdirSync(outDir, { recursive: true });
  mkdirSync(join(tempDir, 'packages', 'devkit'), { recursive: true });

  const devkitPath = join(workspaceRoot, 'packages', 'devkit');
  const tsconfigLibPath = join(devkitPath, 'tsconfig.lib.json');
  const tsconfigPath = join(devkitPath, 'tsconfig.json');
  const tsconfigBasePath = join(workspaceRoot, 'tsconfig.base.json');

  if (!existsSync(tsconfigLibPath)) {
    logger.warn(
      'tsconfig.lib.json not found, skipping DevKit documentation generation'
    );
    throw new Error(
      `tsconfig.lib.json not found, unable to generate docs. ${tsconfigLibPath}`
    );
  }

  cpSync(tsconfigLibPath, join(buildDir, 'tsconfig.lib.json'));
  if (existsSync(tsconfigPath)) {
    cpSync(tsconfigPath, join(tempDir, 'packages', 'devkit', 'tsconfig.json'));
  }
  if (existsSync(tsconfigBasePath)) {
    cpSync(tsconfigBasePath, join(tempDir, 'tsconfig.base.json'));
  }

  let tsconfigContent = readFileSync(
    join(buildDir, 'tsconfig.lib.json'),
    'utf-8'
  );

  if (tsconfigContent.includes('"extends": "../../tsconfig.base.json"')) {
    tsconfigContent = tsconfigContent.replace(
      '"extends": "../../tsconfig.base.json"',
      `"extends": "${join(tempDir, 'packages', 'devkit', 'tsconfig.json')}"`
    );
  }

  const tsconfigObj = JSON.parse(tsconfigContent);
  tsconfigObj.compilerOptions = tsconfigObj.compilerOptions || {};
  tsconfigObj.compilerOptions.rootDir = projectRoot;
  tsconfigObj.compilerOptions.typeRoots = [
    join(projectRoot, 'node_modules', '@types'),
  ];

  tsconfigObj.exclude = [
    ...(tsconfigObj.exclude || []),
    '**/*.spec.ts',
    '**/*.test.ts',
    '**/test/**',
    '**/tests/**',
    'node_modules/@types/jasmine/**',
    'node_modules/@types/jest/**',
  ];

  writeFileSync(
    join(buildDir, 'tsconfig.lib.json'),
    JSON.stringify(tsconfigObj, null, 2)
  );

  rmSync(outDir, { recursive: true, force: true });

  const defaultTypedocOptions: Partial<typedoc.TypeDocOptions> & {
    [key: string]: unknown;
  } = {
    plugin: ['typedoc-plugin-markdown'],
    disableSources: true,
    theme: 'markdown',
    readme: 'none',
    hideBreadcrumbs: true,
    allReflectionsHaveOwnDocument: true,
    skipErrorChecking: true,
    compilerOptions: {
      skipLibCheck: true,
      skipDefaultLibCheck: true,
      noEmit: true,
    },
  };

  return {
    projectRoot,
    outDir,
    buildDir,
    defaultTypedocOptions,
  };
}

function parseComment(comment: typedoc.CommentDisplayPart[], baseSlug: string) {
  const result: string[] = [];
  for (const part of comment) {
    switch (part.kind) {
      case 'text':
      case 'code':
        result.push(part.text);
        break;
      case 'inline-tag':
        switch (part.tag) {
          case '@label':
          case '@inheritdoc':
            break;
          case '@link':
          case '@linkcode':
          case '@linkplain': {
            if (part.target) {
              const baseUrl = `/api/plugins/devkit${
                baseSlug === 'ngcli_adapter' ? `/${baseSlug}` : ''
              }`;
              const url =
                typeof part.target === 'string'
                  ? part.target
                  : `${baseUrl}/${part.text.toLowerCase().replace(/\s/g, '')}`;
              const wrap = part.tag === '@linkcode' ? '`' : '';
              result.push(
                url ? `[${wrap}${part.text}${wrap}](${url})` : part.text
              );
            } else {
              result.push(part.text);
            }
            break;
          }
          default:
            result.push(`{${part.tag} ${part.text}}`);
            break;
        }
        break;
      default:
        result.push('');
    }
  }

  return result
    .join('')
    .split('\n')
    .filter((line) => !line.startsWith('@note'))
    .join('\n');
}

function generateMarkdownForReflection(
  reflection: typedoc.DeclarationReflection,
  baseSlug: string
): string | null {
  let content = '';

  if (reflection.comment) {
    if (reflection.comment.summary) {
      content += parseComment(reflection.comment.summary, baseSlug) + '\n\n';
    }
    if (reflection.comment.blockTags) {
      for (const tag of reflection.comment.blockTags) {
        if (tag.tag === '@deprecated') {
          content += `:::caution[Deprecated]\n`;
          content += parseComment(tag.content, baseSlug) + '\n';
          content += `:::\n`;
        } else {
          content += `**@${tag.tag}**: ${parseComment(tag.content, baseSlug)}`;
        }
      }
      content += '\n\n';
    }
  }

  if (reflection.signatures) {
    content += '## Signatures\n\n';
    for (const sig of reflection.signatures) {
      content += '```typescript\n';
      content += `${sig.name}(${formatParameters(
        sig.parameters
      )}): ${formatType(sig.type)}\n`;
      content += '```\n\n';

      if (sig.comment?.summary) {
        content += parseComment(sig.comment.summary, baseSlug) + '\n\n';
      }

      if (sig.parameters && sig.parameters.length > 0) {
        content += '### Parameters\n\n';
        for (const param of sig.parameters) {
          content += `- **${param.name}**: \`${formatType(param.type)}\``;
          if (param.comment?.summary) {
            content += ' - ' + parseComment(param.comment.summary, baseSlug);
          }
          content += '\n';
        }
        content += '\n';
      }
    }
  }

  if (reflection.children && reflection.children.length > 0) {
    const properties = reflection.children.filter(
      (child) =>
        child.kind === typedoc.ReflectionKind.Property ||
        child.kind === typedoc.ReflectionKind.Method
    );

    if (properties.length > 0) {
      content += '## Properties\n\n';
      for (const prop of properties) {
        content += `**${prop.name}**: \`${formatType(prop.type)}\`\n\n`;
        if (prop.comment?.summary) {
          content += parseComment(prop.comment.summary, baseSlug) + '\n\n';
        }
      }
    }
  }

  return content || null;
}

function formatParameters(parameters?: typedoc.ParameterReflection[]): string {
  if (!parameters || parameters.length === 0) return '';
  return parameters.map((p) => `${p.name}: ${formatType(p.type)}`).join(', ');
}

function formatType(type?: typedoc.SomeType): string {
  if (!type) return 'unknown';

  if (type.type === 'intrinsic') {
    return (type as any).name || 'any';
  } else if (type.type === 'reference') {
    return (type as any).name || 'any';
  } else if (type.type === 'union') {
    const types = (type as any).types;
    return types ? types.map((t: any) => formatType(t)).join(' | ') : 'any';
  } else if (type.type === 'array') {
    const elementType = (type as any).elementType;
    return elementType ? `${formatType(elementType)}[]` : 'any[]';
  } else if (type.type === 'literal') {
    return (type as any).value ? `'${(type as any).value}'` : 'any';
  } else if (type.type === 'reflection') {
    return 'Object';
  }

  return 'any';
}

async function generateDocsForEntry(
  options: Partial<typedoc.TypeDocOptions> & { [key: string]: unknown },
  renderMarkdown: (content: string) => Promise<RenderedContent>,
  packageType: 'devkit' | 'ngcli_adapter'
): Promise<DocEntry[]> {
  const records: DocEntry[] = [];
  const app = await typedoc.Application.bootstrapWithPlugins(
    options as Partial<typedoc.TypeDocOptions>,
    [
      new typedoc.TypeDocReader(),
      new typedoc.PackageJsonReader(),
      new typedoc.TSConfigReader(),
    ]
  );

  app.renderer.defineTheme('nx-markdown-theme', NxMarkdownTheme);

  const project = await app.convert();
  if (!project) {
    throw new Error('Failed to convert the project');
  }

  const reflections = project.getReflectionsByKind(typedoc.ReflectionKind.All);

  for (const reflection of reflections) {
    if (
      !reflection.name ||
      reflection.flags.isPrivate ||
      !allowedReflections.includes(reflection.kind)
    )
      continue;

    const markdownContent = generateMarkdownForReflection(
      reflection as typedoc.DeclarationReflection,
      packageType
    );

    if (markdownContent) {
      const rendered = await renderMarkdown(markdownContent);

      const documentRecord: DocEntry = {
        id: `${packageType}_${reflection.name
          .toLowerCase()
          .replace(/\s/g, '')}`,
        body: markdownContent,
        rendered,
        collection: 'nx-reference-packages',
        data: {
          title: reflection.name,
          packageType: 'devkit',
          docType: packageType,
          description: reflection.comment?.summary
            ? parseComment(reflection.comment.summary, packageType)
            : 'No description available',
          kind: typedoc.ReflectionKind[reflection.kind],
          category: categoryMap[reflection.kind] || 'Other',
        },
      };

      records.push(documentRecord);
    }
  }

  return records;
}

async function createDevkitOverview(
  records: DocEntry[],
  renderMarkdown: (content: string) => Promise<RenderedContent>,
  packageType: 'devkit' | 'ngcli_adapter'
): Promise<DocEntry> {
  const record: DocEntry = {
    id: `${packageType}-overview`,
    body: '',
    collection: 'nx-reference-packages',
    data: {
      kind: 'Project',
      category: 'Project',
      packageType: 'devkit',
      docType: `${packageType}-overview`,
      title: `${packageType} Overview`,
      description: `${packageType} description`,
    },
  };

  const categories = Object.values(categoryMap).sort((a, b) =>
    a.localeCompare(b)
  );
  const baseUrl = `/api/plugins/devkit${
    packageType === 'ngcli_adapter' ? `/${packageType}` : ''
  }`;

  for (const name of categories) {
    const ofKind = records
      .filter((r) => r.data.category === name)
      .sort((a, b) => a.data.title.localeCompare(b.data.title));

    if (ofKind.length === 0) {
      continue;
    }

    record.body += `\n## ${name}\n\n`;
    record.body +=
      `- ` +
      ofKind
        .map(
          (r) =>
            `[${r.data.title}](${baseUrl}/${r.data.title
              .toLowerCase()
              .replace(/\s/g, '')})`
        )
        .join('\n- ');
  }

  record.rendered = await renderMarkdown(record.body!);

  return record;
}

async function loadDevkitPackage(context: LoaderContext): Promise<DocEntry[]> {
  const { logger, renderMarkdown } = context;
  logger.info('Loading DevKit documentation');

  try {
    const { defaultTypedocOptions, outDir, buildDir } = setupTypeDoc(logger);
    const entries: DocEntry[] = [];

    // Load main devkit
    const devkitEntryPoint = join(
      workspaceRoot,
      'dist',
      'packages',
      'devkit',
      'index.d.ts'
    );
    if (existsSync(devkitEntryPoint)) {
      const devkitDocs = await generateDocsForEntry(
        {
          ...defaultTypedocOptions,
          entryPoints: [devkitEntryPoint],
          tsconfig: join(buildDir, 'tsconfig.lib.json'),
          out: outDir,
          excludePrivate: true,
          publicPath: '/reference/core-api/devkit/',
        },
        // @ts-expect-error - astro types are mismatched bc of auto generated location loading, etc
        renderMarkdown,
        'devkit'
      );

      entries.push(...devkitDocs);

      const devkitOverview = await createDevkitOverview(
        devkitDocs,
        // @ts-expect-error - astro types are mismatched bc of auto generated location loading, etc
        renderMarkdown,
        'devkit'
      );
      entries.push(devkitOverview);
    }

    // Load ngcli adapter
    const ngcliEntryPoint = join(
      workspaceRoot,
      'dist',
      'packages',
      'devkit',
      'ngcli-adapter.d.ts'
    );
    if (existsSync(ngcliEntryPoint)) {
      const ngcliDocs = await generateDocsForEntry(
        {
          ...defaultTypedocOptions,
          entryPoints: [ngcliEntryPoint],
          tsconfig: join(buildDir, 'tsconfig.lib.json'),
          out: join(outDir, 'ngcli_adapter'),
          publicPath: '/reference/core-api/devkit/ngcli_adapter/',
        },
        // @ts-expect-error - astro types are mismatched bc of auto generated location loading, etc
        renderMarkdown,
        'ngcli_adapter'
      );

      entries.push(...ngcliDocs);

      const ngcliOverview = await createDevkitOverview(
        ngcliDocs,
        // @ts-expect-error - astro types are mismatched bc of auto generated location loading, etc
        renderMarkdown,
        'ngcli_adapter'
      );
      entries.push(ngcliOverview);
    }

    logger.info('DevKit documentation loaded successfully');
    return entries;
  } catch (error: any) {
    logger.error(`Failed to load DevKit docs: ${error.message}`);
    return [];
  }
}

// ============================================================================
// Nx Core, Plugin, and Web Package Loaders
// ============================================================================

async function loadNxSpecialPackage(
  packageName: 'nx' | 'plugin' | 'web' | 'workspace',
  context: LoaderContext
): Promise<DocEntry[]> {
  const { logger, renderMarkdown } = context;
  const entries: DocEntry[] = [];

  logger.info(`Loading ${packageName} package documentation...`);

  const pluginPath = join(workspaceRoot, 'packages', packageName);

  if (!existsSync(pluginPath)) {
    logger.warn(`Package ${packageName} path does not exist`);
    return [];
  }

  const packageJsonPath = join(pluginPath, 'package.json');
  let packageDescription = `The Nx ${packageName} package`;

  try {
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      if (packageJson.description && packageJson.description.trim()) {
        packageDescription = packageJson.description.trim();
      }
    }
  } catch (error) {
    // Fall back to default description
  }

  const ghStarMap = await getGithubStars([{ owner: 'nrwl', repo: 'nx' }]);
  const npmPackageName = packageName === 'nx' ? 'nx' : `@nx/${packageName}`;

  // Create overview entry
  const overviewEntry: DocEntry = {
    id: `${packageName}-overview`,
    collection: 'nx-reference-packages',
    data: {
      title: npmPackageName,
      packageType: packageName,
      docType: 'overview',
      description: packageDescription,
      features: [],
      totalDocs: 0,
      githubStars: ghStarMap.get('nrwl/nx')?.stargazers?.totalCount || 0,
    },
  };

  // Process generators
  const generators = parseGenerators(pluginPath);
  if (generators && generators.size > 0) {
    const markdown = getGeneratorsMarkdown(packageName, generators);
    entries.push({
      id: `${packageName}-generators`,
      body: markdown,
      // @ts-expect-error - astro types are mismatched bc of auto generated location loading, etc
      rendered: await renderMarkdown(markdown),
      collection: 'nx-reference-packages',
      data: {
        title: `${npmPackageName} Generators`,
        packageType: packageName,
        docType: 'generators',
        description: packageDescription,
      },
    });
    overviewEntry.data.features!.push('generators');
    overviewEntry.data.totalDocs!++;
  }

  // Process executors
  const executors = parseExecutors(pluginPath);
  if (executors && executors.size > 0) {
    const markdown = getExecutorsMarkdown(packageName, executors);
    entries.push({
      id: `${packageName}-executors`,
      body: markdown,
      // @ts-expect-error - astro types are mismatched bc of auto generated location loading, etc
      rendered: await renderMarkdown(markdown),
      collection: 'nx-reference-packages',
      data: {
        title: `${npmPackageName} Executors`,
        packageType: packageName,
        docType: 'executors',
        description: packageDescription,
      },
    });
    overviewEntry.data.features!.push('executors');
    overviewEntry.data.totalDocs!++;
  }

  // Process migrations
  const migrations = parseMigrations(pluginPath);
  if (migrations && migrations.size > 0) {
    const markdown = getMigrationsMarkdown(packageName, migrations);
    entries.push({
      id: `${packageName}-migrations`,
      body: markdown,
      // @ts-expect-error - astro types are mismatched bc of auto generated location loading, etc
      rendered: await renderMarkdown(markdown),
      collection: 'nx-reference-packages',
      data: {
        title: `${npmPackageName} Migrations`,
        packageType: packageName,
        docType: 'migrations',
        description: packageDescription,
      },
    });
    overviewEntry.data.features!.push('migrations');
    overviewEntry.data.totalDocs!++;
  }

  // Fetch npm stats if needed
  const existingOverviewEntry = context.store.get<DocEntry['data']>(
    `${packageName}-overview`
  );
  if (shouldFetchStats(existingOverviewEntry)) {
    const npmPackage = {
      name: npmPackageName,
      url: `https://github.com/nrwl/nx/tree/master/packages/${packageName}`,
      description: packageDescription,
    };
    const npmDownloads = await getNpmDownloads(npmPackage);
    const npmMeta = await getNpmData(npmPackage);

    overviewEntry.data.npmDownloads = npmDownloads;
    overviewEntry.data.lastPublishedDate = npmMeta.lastPublishedDate;
    overviewEntry.data.lastFetched = new Date();
  }

  entries.push(overviewEntry);

  logger.info(`✅ Loaded ${packageName} package documentation`);
  return entries;
}

// ============================================================================
// Main Loader
// ============================================================================

export function NxReferencePackagesLoader(): Loader {
  return {
    name: 'nx-reference-packages-loader',
    async load(context: LoaderContext) {
      const { logger, watcher, store } = context;

      const generate = async () => {
        logger.info(
          'Starting Nx reference packages documentation generation...'
        );
        store.clear();

        // Load all packages in parallel
        const results = await Promise.allSettled([
          loadCnwPackage(context),
          loadNxCliPackage(context),
          loadDevkitPackage(context),
          loadNxSpecialPackage('nx', context),
          loadNxSpecialPackage('plugin', context),
          loadNxSpecialPackage('web', context),
          loadNxSpecialPackage('workspace', context),
        ]);

        // Process results and store documents
        for (const result of results) {
          if (result.status === 'fulfilled') {
            for (const doc of result.value) {
              store.set(doc);
            }
          } else {
            logger.error(`Failed to load package: ${result.reason}`);
          }
        }

        logger.info(
          '✅ Nx reference packages documentation generation complete'
        );
      };

      // Set up file watching
      if (watcher) {
        const pathsToWatch = [
          join(import.meta.dirname, 'nx-reference-packages.loader.ts'),
          join(import.meta.dirname, 'utils', 'cnw-subprocess.cjs'),
          join(import.meta.dirname, 'utils', 'cli-subprocess.cjs'),
          join(import.meta.dirname, 'utils', 'typedoc'),
          join(import.meta.dirname, 'utils', 'plugin-schema-parser.ts'),
          join(import.meta.dirname, 'utils', 'generate-plugin-markdown.ts'),
        ];

        watchAndCall(watcher, pathsToWatch, generate);
      }

      await generate();
    },
  };
}
