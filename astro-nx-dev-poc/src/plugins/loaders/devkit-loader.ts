import * as typedoc from 'typedoc';
import { join, resolve } from 'path';
import {
  existsSync,
  readFileSync,
  writeFileSync,
  cpSync,
  rmSync,
  mkdirSync,
} from 'fs';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import type { DataStore, RenderedContent } from 'astro:content';
import type { LoaderContext } from 'astro/loaders';
import type { PluginDocEntry } from './utils/plugin-schema-parser';

interface DocumentRecord {
  title: string;
  description?: string;
  path?: string;
  kind?: string;
  category?: string;
}

export function DevKitLoader() {
  return {
    name: 'nx-devkit-loader',
    async load({ store, logger, watcher, renderMarkdown }: LoaderContext) {
      logger.info('Generating DevKit documentation');
      store.clear();

      const tempDir = join(tmpdir(), `nx-devkit-docs-${randomUUID()}`);
      const projectRoot = process.cwd();

      // Setup temporary build directory
      const buildDir = join(tempDir, 'build', 'packages', 'devkit');
      const outDir = join(tempDir, 'docs', 'generated', 'devkit');

      // Create necessary directories
      mkdirSync(buildDir, { recursive: true });
      mkdirSync(outDir, { recursive: true });
      mkdirSync(join(tempDir, 'packages', 'devkit'), { recursive: true });

      // Copy the actual tsconfig.json files
      const devkitPath = join(projectRoot, 'packages', 'devkit');
      const tsconfigLibPath = join(devkitPath, 'tsconfig.lib.json');
      const tsconfigPath = join(devkitPath, 'tsconfig.json');
      const tsconfigBasePath = join(projectRoot, 'tsconfig.base.json');

      if (!existsSync(tsconfigLibPath)) {
        logger.warn(
          'tsconfig.lib.json not found, skipping DevKit documentation generation'
        );
        return;
      }

      // Copy tsconfig files to temp directory
      cpSync(tsconfigLibPath, join(buildDir, 'tsconfig.lib.json'));
      if (existsSync(tsconfigPath)) {
        cpSync(
          tsconfigPath,
          join(tempDir, 'packages', 'devkit', 'tsconfig.json')
        );
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

      // Common TypeDoc options
      const commonTypedocOptions: Partial<typedoc.TypeDocOptions> & {
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

      // Generate main devkit documentation
      const mainEntryPoint = join(
        projectRoot,
        'build',
        'packages',
        'devkit',
        'index.d.ts'
      );
      if (!existsSync(mainEntryPoint)) {
        logger.warn(
          'build/packages/devkit/index.d.ts not found, please run build first'
        );
        return;
      }

      await generateDocsForEntry(
        {
          ...commonTypedocOptions,
          entryPoints: [mainEntryPoint],
          tsconfig: join(buildDir, 'tsconfig.lib.json'),
          out: outDir,
          excludePrivate: true,
          publicPath: '/reference/core-api/devkit/',
        },
        store,
        logger,
        renderMarkdown,
        'devkit'
      );

      // Generate ngcli-adapter documentation
      const ngcliEntryPoint = join(
        projectRoot,
        'build',
        'packages',
        'devkit',
        'ngcli-adapter.d.ts'
      );
      await generateDocsForEntry(
        {
          ...commonTypedocOptions,
          entryPoints: [ngcliEntryPoint],
          tsconfig: join(buildDir, 'tsconfig.lib.json'),
          out: join(outDir, 'ngcli_adapter'),
          publicPath: '/reference/core-api/devkit/ngcli_adapter/',
        },
        store,
        logger,
        renderMarkdown,
        'devkit/ngcli_adapter'
      );

      logger.info('DevKit documentation generated successfully');
    },
  };
}

async function generateDocsForEntry(
  options: Partial<typedoc.TypeDocOptions> & { [key: string]: unknown },
  store: LoaderContext['store'],
  logger: LoaderContext['logger'],
  renderMarkdown: (content: string) => Promise<RenderedContent>,
  baseSlug: string
) {
  const app = await typedoc.Application.bootstrapWithPlugins(
    options as Partial<typedoc.TypeDocOptions>,
    [
      new typedoc.TypeDocReader(),
      new typedoc.PackageJsonReader(),
      new typedoc.TSConfigReader(),
    ]
  );

  const project = await app.convert();
  if (!project) {
    throw new Error('Failed to convert the project');
  }

  // Instead of writing to filesystem, we'll capture the output
  const renderer = app.renderer;
  const theme = renderer.theme as any;

  // Process all reflections and generate markdown content
  const reflections = project.getReflectionsByKind(typedoc.ReflectionKind.All);

  for (const reflection of reflections) {
    if (!reflection.name || reflection.flags.isPrivate) continue;

    // Generate markdown content for this reflection
    const markdownContent = generateMarkdownForReflection(
      reflection,
      options.publicPath as string
    );

    if (markdownContent) {
      const slug = `${baseSlug}/${reflection.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')}`;
      const rendered = await renderMarkdown(markdownContent);

      logger.info(
        `Rendered content for ${reflection.name}: ${
          rendered ? 'success' : 'empty'
        }`
      );

      const documentRecord: PluginDocEntry<DocumentRecord> = {
        id: slug,
        body: markdownContent,
        rendered,
        data: {
          title: reflection.name,
          description: reflection.comment?.summary?.[0]?.text || '',
          path: `${options.publicPath}${reflection.name}`,
          kind: typedoc.ReflectionKind[reflection.kind],
          category: getReflectionCategory(reflection.kind),
        },
      };

      store.set(documentRecord);
      logger.info(`Added documentation for ${reflection.name}`);
    }
  }
}

function generateMarkdownForReflection(
  reflection: typedoc.Reflection,
  publicPath: string
): string | null {
  let content = '';

  // Title
  content += `# ${reflection.name}\n\n`;

  // Kind badge and category
  const kindName = typedoc.ReflectionKind[reflection.kind] || 'Unknown';
  const category = getReflectionCategory(reflection.kind);
  content += `**Kind**: ${kindName}\n`;
  content += `**Category**: ${category}\n\n`;

  // Comment/description
  if (reflection.comment) {
    if (reflection.comment.summary) {
      content +=
        reflection.comment.summary.map((part) => part.text).join('') + '\n\n';
    }
    if (reflection.comment.blockTags) {
      for (const tag of reflection.comment.blockTags) {
        content += `**@${tag.tag}**: ${tag.content
          .map((part) => part.text)
          .join('')}\n\n`;
      }
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
        content +=
          sig.comment.summary.map((part) => part.text).join('') + '\n\n';
      }

      if (sig.parameters && sig.parameters.length > 0) {
        content += '### Parameters\n\n';
        for (const param of sig.parameters) {
          content += `- **${param.name}**: \`${formatType(param.type)}\``;
          if (param.comment?.summary) {
            content +=
              ' - ' + param.comment.summary.map((part) => part.text).join('');
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
        content += `### ${prop.name}\n\n`;
        content += `\`${formatType(prop.type)}\`\n\n`;
        if (prop.comment?.summary) {
          content +=
            prop.comment.summary.map((part) => part.text).join('') + '\n\n';
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
    return 'object';
  }

  return 'any';
}

function getReflectionCategory(kind: typedoc.ReflectionKind): string {
  // Map TypeDoc ReflectionKind to plural category names
  const categoryMap: Record<number, string> = {
    [typedoc.ReflectionKind.Project]: 'Projects',
    [typedoc.ReflectionKind.Module]: 'Modules',
    [typedoc.ReflectionKind.Namespace]: 'Namespaces',
    [typedoc.ReflectionKind.Enum]: 'Enumerations',
    [typedoc.ReflectionKind.EnumMember]: 'Enumeration Members',
    [typedoc.ReflectionKind.Variable]: 'Variables',
    [typedoc.ReflectionKind.Function]: 'Functions',
    [typedoc.ReflectionKind.Class]: 'Classes',
    [typedoc.ReflectionKind.Interface]: 'Interfaces',
    [typedoc.ReflectionKind.Constructor]: 'Constructors',
    [typedoc.ReflectionKind.Property]: 'Properties',
    [typedoc.ReflectionKind.Method]: 'Methods',
    [typedoc.ReflectionKind.CallSignature]: 'Call Signatures',
    [typedoc.ReflectionKind.IndexSignature]: 'Index Signatures',
    [typedoc.ReflectionKind.ConstructorSignature]: 'Constructor Signatures',
    [typedoc.ReflectionKind.Parameter]: 'Parameters',
    [typedoc.ReflectionKind.TypeLiteral]: 'Type Literals',
    [typedoc.ReflectionKind.TypeParameter]: 'Type Parameters',
    [typedoc.ReflectionKind.Accessor]: 'Accessors',
    [typedoc.ReflectionKind.GetSignature]: 'Get Signatures',
    [typedoc.ReflectionKind.SetSignature]: 'Set Signatures',
    [typedoc.ReflectionKind.TypeAlias]: 'Type Aliases',
    [typedoc.ReflectionKind.Reference]: 'References',
  };

  return categoryMap[kind] || 'Other';
}
