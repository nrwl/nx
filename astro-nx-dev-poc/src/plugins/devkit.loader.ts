import * as typedoc from 'typedoc';
import { join } from 'path';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import type { CollectionEntry, RenderedContent } from 'astro:content';
import type { LoaderContext } from 'astro/loaders';
import { workspaceRoot } from '@nx/devkit';
import NxMarkdownTheme from './utils/typedoc/theme.ts';
import { watchAndCall } from './utils/watch.ts';

type DocEntry = CollectionEntry<'devkit-docs'>;

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

export function DevkitLoader() {
  return {
    name: 'nx-devkit-loader',
    async load({ store, logger, watcher, renderMarkdown }: LoaderContext) {
      const generate = async () => {
        logger.info('Generating DevKit documentation');
        store.clear();

        const { defaultTypedocOptions, outDir, buildDir, projectRoot } =
          setupTypeDoc(logger);

        const devkitEntryPoint = join(
          projectRoot,
          'build',
          'packages',
          'devkit',
          'index.d.ts'
        );
        if (!existsSync(devkitEntryPoint)) {
          logger.warn(
            'build/packages/devkit/index.d.ts not found, please run build first'
          );
          throw new Error(
            `build/packages/devkit/index.d.ts not found, unable to generate docs. Make sure to run devkit build first. ${devkitEntryPoint}`
          );
        }

        const devkitDocs = await generateDocsForEntry(
          {
            ...defaultTypedocOptions,
            entryPoints: [devkitEntryPoint],
            tsconfig: join(buildDir, 'tsconfig.lib.json'),
            out: outDir,
            excludePrivate: true,
            publicPath: '/reference/core-api/devkit/',
          },
          // @ts-expect-error typemismatch bc auto generated types in .astro vs astro:content etc
          renderMarkdown,
          'devkit'
        );

        devkitDocs.forEach(store.set);

        const devkitOverviewPage = await createOverview(
          devkitDocs,
          // @ts-expect-error typemismatch bc auto generated types in .astro vs astro:content etc
          renderMarkdown,
          'devkit'
        );
        store.set(devkitOverviewPage);

        const ngcliEntryPoint = join(
          projectRoot,
          'build',
          'packages',
          'devkit',
          'ngcli-adapter.d.ts'
        );

        if (!existsSync(ngcliEntryPoint)) {
          logger.warn(
            'build/packages/devkit/ngcli-adapter.d.ts not found, skipping ngcli_adapter documentation generation'
          );
          throw new Error(
            `build/packages/devkit/ngcli-adapter.d.ts not found, unable to generate docs. Make sure to run devkit build first. ${ngcliEntryPoint}`
          );
        }

        const ngcliDocs = await generateDocsForEntry(
          {
            ...defaultTypedocOptions,
            entryPoints: [ngcliEntryPoint],
            tsconfig: join(buildDir, 'tsconfig.lib.json'),
            out: join(outDir, 'ngcli_adapter'),
            publicPath: '/reference/core-api/devkit/ngcli_adapter/',
          },
          // @ts-expect-error typemismatch bc auto generated types in .astro vs astro:content etc
          renderMarkdown,
          'ngcli_adapter'
        );
        ngcliDocs.forEach(store.set);

        const ngcliOverviewPage = await createOverview(
          ngcliDocs,
          // @ts-expect-error typemismatch bc auto generated types in .astro vs astro:content etc
          renderMarkdown,
          'ngcli_adapter'
        );

        store.set(ngcliOverviewPage);

        logger.info('DevKit documentation generated successfully');
      };

      if (watcher) {
        // Watch for changes in the devkit loader files themselves
        const pathsToWatch = [
          join(import.meta.dirname, 'devkit.loader.ts'),
          join(import.meta.dirname, 'utils', 'typedoc'),
        ];
        watchAndCall(watcher, pathsToWatch, generate);
      }

      await generate();
    },
  };
}

async function createOverview(
  records: DocEntry[],
  renderMarkdown: (content: string) => Promise<RenderedContent>,
  baseSlug: DocEntry['data']['docType']
): Promise<DocEntry> {
  const record: DocEntry = {
    id: `${baseSlug}-overview`,
    body: '',
    collection: 'devkit-docs',
    data: {
      kind: 'Project',
      category: 'Project',
      docType: baseSlug,
      title: `${baseSlug} Overview`,
      description: `${baseSlug} description`,
    },
  };

  // alphabetize categories
  const categories = Object.values(categoryMap).toSorted((a, b) =>
    a.localeCompare(b)
  );

  const baseUrl =
    `/api/plugins/devkit` +
    (baseSlug === 'ngcli_adapter' ? `/${baseSlug}` : '');

  for (const name of categories) {
    const ofKind = records
      .filter((r) => r.data.category === name)
      .toSorted((a, b) => a.data.title.localeCompare(b.data.title));

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
              .replaceAll(' ', '')})`
        )
        .join('\n- ');
  }

  record.rendered = await renderMarkdown(record.body!);

  return record;
}

async function generateDocsForEntry(
  options: Partial<typedoc.TypeDocOptions> & { [key: string]: unknown },
  renderMarkdown: (content: string) => Promise<RenderedContent>,
  baseSlug: DocEntry['data']['docType']
) {
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

  // Process all reflections and generate markdown content
  const reflections = project.getReflectionsByKind(typedoc.ReflectionKind.All);

  for (const reflection of reflections) {
    if (
      !reflection.name ||
      reflection.flags.isPrivate ||
      !allowedReflections.includes(reflection.kind)
    )
      continue;

    // Generate markdown content for this reflection
    const markdownContent = generateMarkdownForReflection(
      reflection as typedoc.DeclarationReflection,
      baseSlug
    );

    if (markdownContent) {
      const rendered = await renderMarkdown(markdownContent);

      const documentRecord: DocEntry = {
        id: `${baseSlug}_${reflection.name.toLowerCase().replaceAll(' ', '')}`,
        body: markdownContent,
        rendered,
        collection: 'devkit-docs',
        data: {
          title: reflection.name,
          docType: baseSlug,
          description: reflection.comment?.summary
            ? parseComment(reflection.comment.summary, baseSlug)
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

function generateMarkdownForReflection(
  reflection: typedoc.DeclarationReflection,
  baseSlug: DocEntry['data']['docType']
): string | null {
  let content = '';

  // Comment/description
  if (reflection.comment) {
    if (reflection.comment.summary) {
      content += parseComment(reflection.comment.summary, baseSlug) + '\n\n';
    }
    if (reflection.comment.blockTags) {
      for (const tag of reflection.comment.blockTags) {
        // TODO: any other tags we need to handle inside a description?
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

  // Signatures (for functions/methods)
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

  // Properties (for interfaces/classes)
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

function parseComment(
  comment: typedoc.CommentDisplayPart[],
  baseSlug: DocEntry['data']['docType']
) {
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
              const baseUrl =
                `/api/plugins/devkit` +
                (baseSlug === 'ngcli_adapter' ? `/${baseSlug}` : '');
              const url =
                typeof part.target === 'string'
                  ? part.target
                  : // TODO: there are cases where links are to a specific header inside another document that we need to handle
                    //  i.e. Workspace -> NxJsonConfiguration#<tasksDefaultOptions>

                    `${baseUrl}/${part.text.toLowerCase().replaceAll(' ', '')}`;
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

function setupTypeDoc(logger: LoaderContext['logger']) {
  const tempDir = join(tmpdir(), `nx-devkit-docs`);
  const projectRoot = process.cwd();

  // Setup temporary build directory
  const buildDir = join(workspaceRoot, 'build', 'packages', 'devkit');
  const outDir = join(tempDir, 'docs', 'generated', 'devkit');

  // Create necessary directories
  mkdirSync(buildDir, { recursive: true });
  mkdirSync(outDir, { recursive: true });
  mkdirSync(join(tempDir, 'packages', 'devkit'), { recursive: true });

  // Copy the actual tsconfig.json files
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

  // Copy tsconfig files to temp directory
  cpSync(tsconfigLibPath, join(buildDir, 'tsconfig.lib.json'));
  if (existsSync(tsconfigPath)) {
    cpSync(tsconfigPath, join(tempDir, 'packages', 'devkit', 'tsconfig.json'));
  }
  // Copy tsconfig.base.json if it exists
  if (existsSync(tsconfigBasePath)) {
    cpSync(tsconfigBasePath, join(tempDir, 'tsconfig.base.json'));
  }

  // Update tsconfig paths to point to the absolute paths
  let tsconfigContent = readFileSync(
    join(buildDir, 'tsconfig.lib.json'),
    'utf-8'
  );

  // Replace relative extends with absolute path
  if (tsconfigContent.includes('"extends": "./tsconfig.json"')) {
    tsconfigContent = tsconfigContent.replace(
      '"extends": "./tsconfig.json"',
      `"extends": "${join(tempDir, 'packages', 'devkit', 'tsconfig.json')}"`
    );
  }

  // Add explicit rootDir and outDir to avoid issues
  const tsconfigObj = JSON.parse(tsconfigContent);
  tsconfigObj.compilerOptions = tsconfigObj.compilerOptions || {};
  tsconfigObj.compilerOptions.rootDir = projectRoot;
  tsconfigObj.compilerOptions.typeRoots = [
    join(projectRoot, 'node_modules', '@types'),
  ];

  // Exclude test files to avoid type conflicts
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
    skipErrorChecking: true, // Skip TypeScript errors
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
