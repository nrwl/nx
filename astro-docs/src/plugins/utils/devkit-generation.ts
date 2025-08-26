import { type CollectionEntry, type RenderedContent } from 'astro:content';
import {
  allowedReflections,
  categoryMap,
  setupTypeDoc,
} from './typedoc/setupTypeDoc';
import type { LoaderContext } from 'astro/loaders';
import { workspaceRoot } from '@nx/devkit';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import {
  Application,
  DeclarationReflection,
  PackageJsonReader,
  ReflectionKind,
  TSConfigReader,
  TypeDocReader,
  type TypeDocOptions,
} from 'typedoc';
import {
  formatDeclarationToMarkdown,
  formatComment,
} from './markdown-formatters';
import NxMarkdownTheme from './typedoc/theme';

export async function loadDevkitPackage(
  context: LoaderContext
): Promise<CollectionEntry<'nx-reference-packages'>[]> {
  const { logger, renderMarkdown } = context;
  logger.info('Loading DevKit documentation');

  try {
    const { defaultTypedocOptions, outDir, buildDir } = setupTypeDoc(logger);
    const entries: CollectionEntry<'nx-reference-packages'>[] = [];

    // TODO: Caleb there seems to be a resolution error where this entrypoint will resolved types
    // from the node_modules/nx package and not the local workspace changes
    // see: DOC-188
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
          publicPath: '/docs/reference/devkit/',
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
          publicPath: '/docs/reference/devkit/ngcli_adapter/',
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

async function generateDocsForEntry(
  options: Partial<TypeDocOptions> & { [key: string]: unknown },
  renderMarkdown: (content: string) => Promise<RenderedContent>,
  packageType: 'devkit' | 'ngcli_adapter'
): Promise<CollectionEntry<'nx-reference-packages'>[]> {
  const records: CollectionEntry<'nx-reference-packages'>[] = [];
  const app = await Application.bootstrapWithPlugins(
    options as Partial<TypeDocOptions>,
    [new TypeDocReader(), new PackageJsonReader(), new TSConfigReader()]
  );

  app.renderer.defineTheme('nx-markdown-theme', NxMarkdownTheme);

  const project = await app.convert();
  if (!project) {
    throw new Error('Failed to convert the project');
  }

  const reflections = project.getReflectionsByKind(ReflectionKind.All);

  for (const reflection of reflections) {
    if (
      !reflection.name ||
      reflection.flags.isPrivate ||
      !allowedReflections.includes(reflection.kind)
    ) {
      continue;
    }

    const childReflections = reflections.filter(
      (r) => r.parent && r.parent.id === reflection.id
    );
    const { content, ...metadata } = formatDeclarationToMarkdown(
      reflection as DeclarationReflection,
      childReflections as DeclarationReflection[],
      packageType
    );

    if (content) {
      const rendered = await renderMarkdown(content);
      // todo: look for deprecation notices in the metadata
      const documentRecord: CollectionEntry<'nx-reference-packages'> = {
        id: `${packageType}_${reflection.name.replace(/\s/g, '')}`,
        body: content,
        rendered,
        collection: 'nx-reference-packages',
        data: {
          title: reflection.name,
          packageType: 'devkit',
          docType: packageType,
          description: reflection.comment?.summary
            ? formatComment(reflection.comment.summary, packageType)
            : 'No description available',
          kind: ReflectionKind[reflection.kind],
          category: categoryMap[reflection.kind] || 'Other',
        },
      };

      records.push(documentRecord);
    }
  }

  return records;
}

async function createDevkitOverview(
  records: CollectionEntry<'nx-reference-packages'>[],
  renderMarkdown: (content: string) => Promise<RenderedContent>,
  packageType: 'devkit' | 'ngcli_adapter'
): Promise<CollectionEntry<'nx-reference-packages'>> {
  const record: CollectionEntry<'nx-reference-packages'> = {
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
  const baseUrl = `/docs/reference/devkit${
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
            `[${r.data.title}](${baseUrl}/${r.data.title.replace(/\s/g, '')})`
        )
        .join('\n- ');
  }

  record.rendered = await renderMarkdown(record.body!);

  return record;
}
