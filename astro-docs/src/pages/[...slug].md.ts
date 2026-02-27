import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const contentDocsDir = join(__dirname, '../content/docs');

/**
 * Generate static paths for all documentation pages as .md endpoints.
 * This allows AI agents and tools to fetch raw markdown content via URLs like:
 * /docs/getting-started/intro.md
 */
export const getStaticPaths: GetStaticPaths = async () => {
  const paths: Array<{
    params: { slug: string };
    props: { rawContent: string };
  }> = [];

  // Get all docs from the content collection (static .mdoc/.mdx files)
  const docs = await getCollection('docs');

  for (const doc of docs) {
    // doc.id is the path without extension (e.g., "getting-started/intro")
    const slug = doc.id;

    // Try to get file path from doc.filePath, or try common extensions
    let filePath = doc.filePath;
    if (!filePath) {
      // Try common extensions
      const extensions = ['.mdoc', '.mdx', '.md'];
      for (const ext of extensions) {
        const testPath = join(contentDocsDir, doc.id + ext);
        if (existsSync(testPath)) {
          filePath = testPath;
          break;
        }
      }
    }

    // Skip if no file path found or not a file
    if (!filePath || !existsSync(filePath)) {
      continue;
    }

    try {
      const stat = statSync(filePath);
      if (!stat.isFile()) {
        continue;
      }
    } catch {
      continue;
    }

    // Read the raw content from the file
    let rawContent = '';
    try {
      rawContent = readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    paths.push({
      params: { slug },
      props: { rawContent },
    });
  }

  // Get all plugin docs from the generated collection
  try {
    const pluginDocs = await getCollection('plugin-docs');
    for (const doc of pluginDocs) {
      if (doc.data.slug) {
        paths.push({
          params: { slug: doc.data.slug },
          props: { rawContent: doc.body || '' },
        });
      }
    }
  } catch {
    // plugin-docs collection might not exist in all environments
  }

  // Get all nx-reference-packages docs (devkit, nx CLI, etc.)
  try {
    const nxRefDocs = await getCollection('nx-reference-packages');
    for (const doc of nxRefDocs) {
      if (doc.data.slug !== undefined) {
        const packageType = doc.data.packageType;
        let fullSlug = doc.data.slug;

        if (packageType === 'devkit') {
          fullSlug = `reference/devkit/${doc.data.slug}`;
        } else if (packageType === 'nx') {
          fullSlug = `reference/nx/${doc.data.slug}`;
        } else if (packageType === 'plugin') {
          fullSlug = `reference/plugin/${doc.data.slug}`;
        } else if (packageType === 'web') {
          fullSlug = `reference/web/${doc.data.slug}`;
        } else if (packageType === 'workspace') {
          fullSlug = `reference/workspace/${doc.data.slug}`;
        }

        paths.push({
          params: { slug: fullSlug },
          props: { rawContent: doc.body || '' },
        });
      }
    }
  } catch {
    // nx-reference-packages collection might not exist in all environments
  }

  return paths;
};

export const GET: APIRoute = async ({ props }) => {
  const { rawContent } = props as { rawContent: string };

  return new Response(rawContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
