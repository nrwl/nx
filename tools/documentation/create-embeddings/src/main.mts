// based on:
// https://github.com/supabase-community/nextjs-openai-doc-search/blob/main/lib/generate-embeddings.ts

import { createClient } from '@supabase/supabase-js';
import { config as loadDotEnvFile } from 'dotenv';
import { expand } from 'dotenv-expand';
import { readFile, readdir } from 'fs/promises';
import 'openai';
import OpenAI from 'openai';
import yargs from 'yargs';
import { createHash } from 'crypto';
import GithubSlugger from 'github-slugger';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { toMarkdown } from 'mdast-util-to-markdown';
import { toString } from 'mdast-util-to-string';
import { u } from 'unist-builder';
import { join, relative } from 'path';
import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import rehypeRemark from 'rehype-remark';
import remarkStringify from 'remark-stringify';
import remarkGfm from 'remark-gfm';
import { workspaceRoot } from '@nx/devkit';

let identityMap = {};

const myEnv = loadDotEnvFile();
expand(myEnv);

type ProcessedMdx = {
  checksum: string;
  sections: Section[];
};

type Section = {
  content: string;
  heading?: string;
  slug?: string;
};

/**
 * Splits a `mdast` tree into multiple trees based on
 * a predicate function. Will include the splitting node
 * at the beginning of each tree.
 *
 * Useful to split a markdown file into smaller sections.
 */
export function splitTreeBy(tree: any, predicate: (node: any) => boolean) {
  return tree.children.reduce((trees: any, node: any) => {
    const [lastTree] = trees.slice(-1);

    if (!lastTree || predicate(node)) {
      const tree = u('root', [node]);
      return trees.concat(tree);
    }

    lastTree.children.push(node);
    return trees;
  }, []);
}

/**
 * Processes MD content for search indexing.
 * It extracts metadata and splits it into sub-sections based on criteria.
 */
export function processMdxForSearch(content: string): ProcessedMdx {
  const checksum = createHash('sha256').update(content).digest('base64');

  const mdTree = fromMarkdown(content, {});

  if (!mdTree) {
    return {
      checksum,
      sections: []
    };
  }

  const sectionTrees = splitTreeBy(mdTree, (node) => node.type === 'heading');

  const slugger = new GithubSlugger();

  const sections = sectionTrees.map((tree: any) => {
    const [firstNode] = tree.children;

    const heading =
      firstNode.type === 'heading'
        ? removeTitleDescriptionFromHeading(toString(firstNode))
        : undefined;
    const slug = heading ? slugger.slug(heading) : undefined;

    return {
      content: toMarkdown(tree),
      heading,
      slug
    };
  });

  return {
    checksum,
    sections
  };
}

type WalkEntry = {
  path: string;
  url_partial: string;
};

abstract class BaseEmbeddingSource {
  checksum?: string;
  sections?: Section[];

  constructor(
    public source: string,
    public path: string,
    public url_partial: string
  ) {
  }

  abstract load(): Promise<{
    checksum: string;
    sections: Section[];
  }>;
}

class MarkdownEmbeddingSource extends BaseEmbeddingSource {
  type: 'markdown' = 'markdown';

  constructor(
    source: string,
    public filePath: string,
    public url_partial: string,
    public fileContent?: string
  ) {
    let path: string;

    // Check if this is an Astro HTML file
    if (filePath.includes('astro-docs/dist') && filePath.endsWith('.html')) {
      // Get path relative to astro-docs root (e.g., dist/concepts/mental-model/index.html)
      const astroDocsIndex = filePath.indexOf('astro-docs/');
      if (astroDocsIndex !== -1) {
        path = filePath.substring(astroDocsIndex + 'astro-docs/'.length);
      } else {
        path = filePath;
      }
    } else {
      // Legacy behavior for markdown files
      path = filePath.replace(/^docs/, '').replace(/\.md?$/, '');
    }

    super(source, path, url_partial);
  }

  async load() {
    const contents =
      this.fileContent ?? (await readFile(this.filePath, 'utf8'));

    let markdown: string;

    // Check if this is HTML (Astro mode)
    if (this.filePath.endsWith('.html')) {
      markdown = await htmlToMarkdown(contents);
    } else {
      markdown = contents;
    }

    const { checksum, sections } = processMdxForSearch(markdown);

    this.checksum = checksum;
    this.sections = sections;

    return {
      checksum,
      sections
    };
  }
}

type EmbeddingSource = MarkdownEmbeddingSource;

async function generateEmbeddings() {
  const argv = await yargs(process.argv)
    .option('refresh', {
      alias: 'r',
      description: 'Refresh data',
      type: 'boolean'
    })
    .option('local', {
      alias: 'l',
      description: 'Write to local JSON files instead of Supabase',
      type: 'boolean'
    })
    .option('mode', {
      alias: 'm',
      description: 'Source mode: astro or legacy',
      type: 'string',
      choices: ['astro', 'legacy'],
      default: 'legacy'
    })
    .argv;

  const shouldRefresh = argv.refresh;
  const isLocal = argv.local;
  const sourceMode = argv.mode as 'astro' | 'legacy';

  // Skip validation when in local mode
  if (!isLocal) {
    if (!process.env.NX_NEXT_PUBLIC_SUPABASE_URL) {
      throw new Error(
        'Environment variable NX_NEXT_PUBLIC_SUPABASE_URL is required: skipping embeddings generation'
      );
    }

    if (!process.env.NX_SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        'Environment variable NX_SUPABASE_SERVICE_ROLE_KEY is required: skipping embeddings generation'
      );
    }

    if (!process.env.NX_OPENAI_KEY) {
      throw new Error(
        'Environment variable NX_OPENAI_KEY is required: skipping embeddings generation'
      );
    }
  }

  const supabaseClient = !isLocal
    ? createClient(
        process.env.NX_NEXT_PUBLIC_SUPABASE_URL,
        process.env.NX_SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false
          }
        }
      )
    : null;

  // Local storage for JSON output
  const localPages: any[] = [];
  const localPageSections: any[] = [];
  let nextPageId = 1;
  let nextSectionId = 1;

  const allFilesPaths: WalkEntry[] = sourceMode === 'astro' ? await getAstroPaths() : await getLegacyPaths();

  const embeddingSources: EmbeddingSource[] = [
    ...allFilesPaths.map((entry) => {
      return new MarkdownEmbeddingSource(
        'guide',
        entry.path,
        entry.url_partial
      );
    }),
    ...(await createMarkdownForCommunityPlugins()).map((content, index) => {
      return new MarkdownEmbeddingSource(
        'community-plugins',
        '/community/approved-plugins.json#' + index,
        content.url,
        content.text
      );
    })
  ];

  console.log(`Discovered ${embeddingSources.length} pages`);

  if (!shouldRefresh) {
    console.log('Checking which pages are new or have changed');
  } else {
    console.log('Refresh flag set, re-generating all pages');
  }

  for (const [index, embeddingSource] of embeddingSources.entries()) {
    const { type, source, path, url_partial } = embeddingSource;

    try {
      const { checksum, sections } = await embeddingSource.load();

      if (isLocal) {
        // Local mode: skip queries, just accumulate data
        const pageId = nextPageId++;

        console.log(
          `#${index}: [${path}] Adding ${sections.length} page sections (with embeddings)`
        );
        console.log(
          `${embeddingSources.length - index - 1} pages remaining to process.`
        );

        // Create page record (will update checksum after all sections succeed)
        const pageRecord = {
          id: pageId,
          checksum: null,
          path,
          url_partial,
          type,
          source
        };

        for (const { slug, heading, content } of sections) {
          // OpenAI recommends replacing newlines with spaces for best results (specific to embeddings)
          const input = content.replace(/\n/g, ' ');

          try {
            // For local mode, skip actual embedding generation
            // Just create placeholder data with same structure
            const longer_heading =
              source !== 'community-plugins'
                ? removeTitleDescriptionFromHeading(
                  createLongerHeading(heading, url_partial)
                )
                : heading;

            localPageSections.push({
              id: nextSectionId++,
              page_id: pageId,
              slug,
              heading:
                heading?.length && heading !== null && heading !== 'null'
                  ? heading
                  : longer_heading,
              longer_heading,
              content,
              url_partial,
              token_count: 0, // Placeholder
              embedding: [] // Placeholder
            });
          } catch (err) {
            console.error(
              `Failed to process section for '${path}' starting with '${input.slice(
                0,
                40
              )}...'`
            );
            throw err;
          }
        }

        // Set page checksum now that all sections succeeded
        pageRecord.checksum = checksum;
        localPages.push(pageRecord);
      } else {
        // Supabase mode: existing logic
        // Check for existing page in DB and compare checksums
        const { error: fetchPageError, data: existingPage } = await supabaseClient
          .from('nods_page')
          .select('id, path, checksum')
          .filter('path', 'eq', path)
          .limit(1)
          .maybeSingle();

        if (fetchPageError) {
          throw fetchPageError;
        }

        // We use checksum to determine if this page & its sections need to be regenerated
        if (!shouldRefresh && existingPage?.checksum === checksum) {
          continue;
        }

        if (existingPage) {
          if (!shouldRefresh) {
            console.log(
              `#${index}: [${path}] Docs have changed, removing old page sections and their embeddings`
            );
          } else {
            console.log(
              `#${index}: [${path}] Refresh flag set, removing old page sections and their embeddings`
            );
          }

          const { error: deletePageSectionError } = await supabaseClient
            .from('nods_page_section')
            .delete()
            .filter('page_id', 'eq', existingPage.id);

          if (deletePageSectionError) {
            throw deletePageSectionError;
          }
        }

        // Create/update page record. Intentionally clear checksum until we
        // have successfully generated all page sections.
        const { error: upsertPageError, data: page } = await supabaseClient
          .from('nods_page')
          .upsert(
            {
              checksum: null,
              path,
              url_partial,
              type,
              source
            },
            { onConflict: 'path' }
          )
          .select()
          .limit(1)
          .single();

        if (upsertPageError) {
          throw upsertPageError;
        }

        console.log(
          `#${index}: [${path}] Adding ${sections.length} page sections (with embeddings)`
        );
        console.log(
          `${embeddingSources.length - index - 1} pages remaining to process.`
        );

        for (const { slug, heading, content } of sections) {
          // OpenAI recommends replacing newlines with spaces for best results (specific to embeddings)
          const input = content.replace(/\n/g, ' ');

          try {
            const openai = new OpenAI({
              apiKey: process.env.NX_OPENAI_KEY
            });
            const embeddingResponse = await openai.embeddings.create({
              model: 'text-embedding-ada-002',
              input
            });

            const [responseData] = embeddingResponse.data;

            const longer_heading =
              source !== 'community-plugins'
                ? removeTitleDescriptionFromHeading(
                  createLongerHeading(heading, url_partial)
                )
                : heading;

            const { error: insertPageSectionError } = await supabaseClient
              .from('nods_page_section')
              .insert({
                page_id: page.id,
                slug,
                heading:
                  heading?.length && heading !== null && heading !== 'null'
                    ? heading
                    : longer_heading,
                longer_heading,
                content,
                url_partial,
                token_count: embeddingResponse.usage.total_tokens,
                embedding: responseData.embedding
              })
              .select()
              .limit(1)
              .single();

            if (insertPageSectionError) {
              throw insertPageSectionError;
            }

            // Add delay after each request
            await delay(500); // delay of 0.5 second
          } catch (err) {
            // TODO: decide how to better handle failed embeddings
            console.error(
              `Failed to generate embeddings for '${path}' page section starting with '${input.slice(
                0,
                40
              )}...'`
            );

            throw err;
          }
        }

        // Set page checksum so that we know this page was stored successfully
        const { error: updatePageError } = await supabaseClient
          .from('nods_page')
          .update({ checksum })
          .filter('id', 'eq', page.id);

        if (updatePageError) {
          throw updatePageError;
        }
      }
    } catch (err) {
      console.error(
        `Page '${path}' or one/multiple of its page sections failed to store properly. Page has been marked with null checksum to indicate that it needs to be re-generated.`
      );
      console.error(err);
    }
  }

  // Write local JSON files if in local mode
  if (isLocal) {
    const fs = await import('fs/promises');
    const path = await import('path');

    const tmpDir = path.join(process.cwd(), 'tmp');
    await fs.mkdir(tmpDir, { recursive: true });

    const pagesFile = path.join(tmpDir, `nods_page_${sourceMode}.json`);
    const sectionsFile = path.join(tmpDir, `nods_page_section_${sourceMode}.json`);

    await fs.writeFile(pagesFile, JSON.stringify(localPages, null, 2));
    await fs.writeFile(sectionsFile, JSON.stringify(localPageSections, null, 2));

    console.log(`\nWrote ${localPages.length} pages to ${pagesFile}`);
    console.log(`Wrote ${localPageSections.length} sections to ${sectionsFile}`);
  }

  console.log('Embedding generation complete');
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Recursively find all index.html files in Astro dist directory
 */
async function getAstroPaths(): Promise<WalkEntry[]> {
  console.log('Using Astro mode - reading from astro-docs/dist');
  const astroDocsRoot = join(workspaceRoot, 'astro-docs');
  const files: WalkEntry[] = [];
  const distDir = join(astroDocsRoot, 'dist');

  async function walkDir(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        await walkDir(fullPath);
      } else if (entry.name === 'index.html') {
        // Derive URL from directory path
        // dist/getting-started/index.html -> /docs/getting-started
        // dist/concepts/mental-model/index.html -> /docs/concepts/mental-model
        const dirPath = relative(distDir, join(fullPath, '..'));
        const urlPath = dirPath === '.' ? '' : '/' + dirPath;

        files.push({
          path: fullPath,  // Full path for reading the file
          url_partial: `/docs${urlPath}` || '/docs'
        });
      }
    }
  }

  await walkDir(distDir);
  return files;
}

function getAllFilesFromMapJson(doc): WalkEntry[] {
  const files: WalkEntry[] = [];

  function traverse(itemList) {
    for (const item of itemList) {
      if (item.file && item.file.length > 0) {
        // we can exclude some docs here, eg. the deprecated ones
        // the path is the relative path to the file within the nx repo
        // the url_partial is the relative path to the file within the docs site - under nx.dev
        files.push({
          path: `docs/${item.file}.md`,
          url_partial: identityMap[item.id]?.path || ''
        });
      }

      if (item.itemList) {
        traverse(item.itemList);
      }
    }
  }

  for (const item of doc.content) {
    traverse([item]);
  }
  return files;
}

function getAllFilesWithItemList(data): WalkEntry[] {
  const files: WalkEntry[] = [];

  function traverse(itemList) {
    for (const item of itemList) {
      if (item.file && item.file.length > 0) {
        // the path is the relative path to the file within the nx repo
        // the url_partial is the relative path to the file within the docs site - under nx.dev

        files.push({ path: `docs/${item.file}.md`, url_partial: item.path });
        if (!identityMap[item.id]) {
          identityMap = { ...identityMap, [item.id]: item };
        }
      }

      if (item.itemList) {
        traverse(item.itemList);
      }
    }
  }

  for (const key in data) {
    if (data[key].itemList) {
      traverse([data[key]]);
    } else {
      if (data[key].documents) {
        files.push(...getAllFilesWithItemList(data[key].documents));
      }
      if (data[key].generators) {
        files.push(...getAllFilesWithItemList(data[key].generators));
      }
      if (data[key].executors) {
        files.push(...getAllFilesWithItemList(data[key].executors));
      }
      if (data[key]?.length > 0) {
        traverse(data[key]);
      }
    }
  }
  return files;
}

function createLongerHeading(
  heading?: string | null,
  url_partial?: string
): string | undefined {
  if (url_partial?.length) {
    if (heading?.length && heading !== null && heading !== 'null') {
      return `${heading}${` - ${
        url_partial.split('/')?.[1]?.[0]?.toUpperCase() +
        url_partial.split('/')?.[1]?.slice(1)
      }`}`;
    } else {
      return url_partial
        .split('#')[0]
        .split('/')
        .map((part) =>
          part?.length ? part[0]?.toUpperCase() + part.slice(1) + ' - ' : ''
        )
        .join('')
        .slice(0, -3);
    }
  }
}

async function getLegacyPaths(): Promise<WalkEntry[]> {
  const mapJson = await import( '../../../../docs/map.json').then((m) => m.default);
  const manifestsCI = await import('../../../../docs/generated/manifests/ci.json' ).then((m) => m.default);
  const manifestsExtending =await import ('../../../../docs/generated/manifests/extending-nx.json' ).then((m) => m.default);
  const manifestsNx = await import('../../../../docs/generated/manifests/nx.json' ).then((m) => m.default);
  const manifestsPackages = await import( '../../../../docs/generated/manifests/new-nx-api.json' ).then((m) => m.default);
  const manifestsTags = await import('../../../../docs/generated/manifests/tags.json' ).then((m) => m.default);

  console.log('Using legacy mode - reading from docs/ and manifests');
  // Ensures that indentityMap gets populated first
  let legacyPaths = [...getAllFilesWithItemList(manifestsNx)];

  legacyPaths = [
    ...legacyPaths,
    ...getAllFilesFromMapJson(mapJson),
    ...getAllFilesWithItemList(manifestsCI),
    ...getAllFilesWithItemList(manifestsExtending),
    ...getAllFilesWithItemList(manifestsPackages),
    ...getAllFilesWithItemList(manifestsTags)
  ].filter(
    (entry) =>
      !entry.path.includes('sitemap') && !entry.path.includes('deprecated')
  );

  return legacyPaths;
}

async function createMarkdownForCommunityPlugins(): Promise<{
  text: string;
  url: string;
}[]> {
  const communityPlugins = await import( '../../../../community/approved-plugins.json' ).then(m => m.default);
  return communityPlugins.map((plugin) => {
    return {
      text: `## ${plugin.name} plugin\n\nThere is a ${plugin.name} community plugin.\n\nHere is the description for it: ${plugin.description}\n\nHere is the link to it: [${plugin.url}](${plugin.url})\n\nHere is the list of all the plugins that exist for Nx: https://nx.dev/plugin-registry`,
      url: plugin.url
    };
  });
}

function removeTitleDescriptionFromHeading(
  inputString?: string
): string | null {
  /**
   * Heading node can be like this:
   * title: 'Angular Monorepo Tutorial - Part 1: Code Generation'
   * description: In this tutorial you'll create a frontend-focused workspace with Nx.
   *
   * We only want to keep the title part.
   */
  if (!inputString) {
    return null;
  }
  const titleMatch = inputString.match(/title:\s*(.+?)(?=\s*description:)/);
  if (titleMatch) {
    const title = titleMatch[1].trim();
    return title.replace(`{% highlightColor="green" %}`, '').trim();
  } else {
    return inputString.replace(`{% highlightColor="green" %}`, '').trim();
  }
}

async function main() {
  await generateEmbeddings();
}

// <astro-island> can also contain content so we need to make them plain HTML first
function preprocessAstroIslands(html: string): string {
  const astroIslandPattern = /<astro-island[^>]*>([\s\S]*?)<\/astro-island>/g;

  let processed = html;
  let match;

  while ((match = astroIslandPattern.exec(processed)) !== null) {
    const fullIsland = match[0];
    const islandContent = match[1];
    const templateMatch = islandContent.match(/<template data-astro-template[^>]*>([\s\S]*?)<\/template>/);
    if (templateMatch) {
      const templateContent = templateMatch[1];
      const visibleContent = islandContent.replace(/<template data-astro-template[^>]*>[\s\S]*?<\/template>/, '');
      const cleanedVisible = visibleContent.replace(/<!--astro:end-->/, '');
      const replacement = `<div class="astro-island-content">${cleanedVisible}${templateContent}</div>`;
      processed = processed.replace(fullIsland, replacement);
    }
  }
  return processed;
}

async function htmlToMarkdown(html:string): Promise<string> {
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/);
  const htmlToProcess = mainMatch ? mainMatch[1] : html;
  const processedHtml = preprocessAstroIslands(htmlToProcess);
  const file = await unified()
    .use(rehypeParse, { fragment: true })
    .use(remarkGfm)
    .use(rehypeRemark)
    .use(remarkStringify, {
      bullet: '-',
      emphasis: '*',
      strong: '*',
      fence: '`',
      fences: true,
      incrementListMarker: true
    })
    .process(processedHtml);
  return String(file);
}
main().catch((err) => console.error(err));
