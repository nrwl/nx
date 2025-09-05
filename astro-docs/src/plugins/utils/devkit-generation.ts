import { type CollectionEntry } from 'astro:content';
import { setupTypeDoc, runTypeDoc } from './typedoc/typedoc';
import type { LoaderContext } from 'astro/loaders';
import { workspaceRoot } from '@nx/devkit';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join as pathJoin } from 'node:path';

export async function loadDevkitPackage(
  context: LoaderContext
): Promise<CollectionEntry<'nx-reference-packages'>[]> {
  const { logger, renderMarkdown } = context;
  logger.info('Loading DevKit documentation');

  const { defaultTypedocOptions, outDir, buildDir } = setupTypeDoc(logger);
  const entries: CollectionEntry<'nx-reference-packages'>[] = [];

  // TODO: Caleb there seems to be a resolution error where this entrypoint will resolved types
  // from the node_modules/nx package and not the local workspace changes
  // see: DOC-188

  logger.info('Generating devkit docs to dir...');
  // generate main @nx/devkit docs
  const devkitEntryPoint = join(
    workspaceRoot,
    'dist',
    'packages',
    'devkit',
    'index.d.ts'
  );
  if (existsSync(devkitEntryPoint)) {
    await runTypeDoc(
      {
        ...defaultTypedocOptions,
        entryPoints: [devkitEntryPoint],
        tsconfig: join(buildDir, 'tsconfig.lib.json'),
        out: outDir,
        excludePrivate: true,
        publicPath: '/docs/reference/devkit/',
      },
      logger
    );
  }

  logger.info('Generating devkit/ngcli_adapter docs...');
  // generate ngcli docs in same dir
  const ngcliEntryPoint = join(
    workspaceRoot,
    'dist',
    'packages',
    'devkit',
    'ngcli-adapter.d.ts'
  );
  if (existsSync(ngcliEntryPoint)) {
    await runTypeDoc(
      {
        ...defaultTypedocOptions,
        entryPoints: [ngcliEntryPoint],
        tsconfig: join(buildDir, 'tsconfig.lib.json'),
        out: join(outDir, 'ngcli_adapter'),
        publicPath: '/docs/reference/devkit/ngcli_adapter/',
      },
      logger
    );
  }

  logger.info(`Loading devkit docs from ${outDir}`);

  const markdownFiles = await walkDirectory(outDir);

  for (const filePath of markdownFiles) {
    // Get the relative path from the output directory
    const relativePath = filePath.replace(outDir + '/', '');
    // Get the title from the filename (last part without .md)
    const pathParts = relativePath.split('/');
    const fileName = pathParts[pathParts.length - 1];

    let slug = '';
    let title = '';
    let category = '';

    // Handle README.md files as overview routes
    if (fileName === 'README.md') {
      if (pathParts.length === 1) {
        // Root README becomes 'overview' 'devkit' index route
        slug = '';
        title = '@nx/devkit Overview';
        category = 'overview';
      } else if (pathParts.length === 2 && pathParts[0] === 'ngcli_adapter') {
        // ngcli_adapter/README becomes 'devkit/ngcli_adapter' index route
        slug = 'ngcli_adapter';
        title = 'ngcli_adapter Overview';
        category = 'overview';
      }
    } else {
      // Regular markdown files are in the same location as file location
      // NOTE: we might want to change this to flatten out the "types" i.e. interface/function etc
      // that will require changing the URL generation of typedoc as well
      slug = relativePath.replace(/\.md$/, '');
      title = fileName.replace(/\.md$/, '');
      category = pathParts.length > 1 ? pathParts[0] : 'overview';
    }

    // Read the markdown content
    let content = await readFile(filePath, 'utf-8');

    // // Remove .md extensions from all links in the content
    if (content) {
      // Remove .md from markdown links: [text](path.md) -> [text](path)
      content = content
        .replace(/(\[.*?\]\([^)]*?)\.md(\)|#)/gi, '$1$2')
        // Remove .md from any remaining URLs that end with .md
        .replace(/\.md(?=[#)\s]|$)/gim, '');
    }

    const rendered = content ? await renderMarkdown(content) : undefined;

    const mappedCategory = directoryToCategoryMap[category] || category;

    const documentRecord: CollectionEntry<'nx-reference-packages'> = {
      id: `devkit_${slug.replace(/\//g, '-')}`,
      body: content,
      // @ts-expect-error astro auto gen types don't align
      rendered,
      collection: 'nx-reference-packages',
      data: {
        title: title,
        packageType: 'devkit',
        docType: slug,
        category: mappedCategory,
      },
    };

    entries.push(documentRecord);
  }

  return entries;
}

/**
 * Recursively walk a directory and return all .md file paths
 */
async function walkDirectory(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = pathJoin(dir, entry.name);

    if (entry.isDirectory()) {
      // Recursively walk subdirectories
      const subFiles = await walkDirectory(fullPath);
      files.push(...subFiles);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}
