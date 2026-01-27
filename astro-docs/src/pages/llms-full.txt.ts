import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const contentDocsDir = join(__dirname, '../content/docs');

interface DocEntry {
  slug: string;
  title: string;
  content: string;
  section: string;
}

/**
 * Strips YAML frontmatter from markdown content.
 * Frontmatter is delimited by --- at the start of the file.
 */
function stripFrontmatter(content: string): string {
  // Match frontmatter: starts with ---, ends with ---
  const frontmatterRegex = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;
  return content.replace(frontmatterRegex, '');
}

/**
 * Generates llms-full.txt - a concatenated file of all Nx documentation.
 * This file contains the full content of all docs for LLM consumption.
 * See: https://llmstxt.org/
 */
export const GET: APIRoute = async ({ site }) => {
  const siteUrl = site?.origin ?? 'https://nx.dev';
  const entries: DocEntry[] = [];

  // Preferred section order (same as llms.txt)
  const sectionOrder = [
    'quickstart',
    'getting-started',
    'concepts',
    'features',
    'guides',
    'extending-nx',
    'technologies',
    'reference',
    'enterprise',
    'troubleshooting',
  ];

  // Section display names
  const sectionNames: Record<string, string> = {
    'getting-started': 'Getting Started',
    concepts: 'Core Concepts',
    features: 'Features',
    guides: 'Guides',
    'extending-nx': 'Extending Nx',
    technologies: 'Technologies',
    reference: 'Reference',
    enterprise: 'Enterprise',
    troubleshooting: 'Troubleshooting',
    quickstart: 'Quickstart',
  };

  // Get all docs from the content collection (static .mdoc/.mdx files)
  const docs = await getCollection('docs');

  for (const doc of docs) {
    const slug = doc.id;
    const title = doc.data.title || slug.split('/').pop() || slug;
    const section = slug.split('/')[0] || 'other';

    // Try to get file path from doc.filePath, or try common extensions
    let filePath = doc.filePath;
    if (!filePath) {
      const extensions = ['.mdoc', '.mdx', '.md'];
      for (const ext of extensions) {
        const testPath = join(contentDocsDir, doc.id + ext);
        if (existsSync(testPath)) {
          filePath = testPath;
          break;
        }
      }
    }

    // Skip if no file path found or not readable
    if (!filePath || !existsSync(filePath)) {
      continue;
    }

    try {
      const rawContent = readFileSync(filePath, 'utf-8');
      const content = stripFrontmatter(rawContent);
      entries.push({ slug, title, content, section });
    } catch {
      // Skip files that can't be read
      continue;
    }
  }

  // Get plugin docs (executors, generators for each plugin)
  try {
    const pluginDocs = await getCollection('plugin-docs');
    for (const doc of pluginDocs) {
      if (doc.data.slug && doc.body) {
        const slug = doc.data.slug;
        const section = slug.split('/')[0] || 'technologies';
        entries.push({
          slug,
          title: doc.data.title || slug,
          content: stripFrontmatter(doc.body),
          section,
        });
      }
    }
  } catch {
    // plugin-docs collection might not exist
  }

  // Note: Excluding nx-reference-packages (devkit API docs) for now
  // to keep the file size under 2MB. These are highly technical
  // and can be accessed individually via .md endpoints.

  // Sort entries by section order, then by slug within section
  entries.sort((a, b) => {
    const sectionIndexA = sectionOrder.indexOf(a.section);
    const sectionIndexB = sectionOrder.indexOf(b.section);
    const orderA = sectionIndexA === -1 ? 999 : sectionIndexA;
    const orderB = sectionIndexB === -1 ? 999 : sectionIndexB;

    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return a.slug.localeCompare(b.slug);
  });

  // Generate the llms-full.txt content
  const lines: string[] = [
    '# Nx Documentation',
    '',
    '> Complete Nx documentation compiled into a single file for LLM consumption.',
    '',
    'Nx is a powerful, open source, technology-agnostic build platform designed to efficiently manage codebases of any scale. From small single projects to large enterprise monorepos, Nx provides intelligent task execution, caching, and CI optimization.',
    '',
    `This file was generated from ${entries.length} documentation pages.`,
    `Individual pages are available at: ${siteUrl}/docs/{slug}.md`,
    '',
  ];

  // Track current section for headers
  let currentSection = '';

  for (const entry of entries) {
    // Add section header when section changes
    if (entry.section !== currentSection) {
      currentSection = entry.section;
      const sectionName = sectionNames[currentSection] || currentSection;
      lines.push('');
      lines.push(`# ${sectionName}`);
      lines.push('');
    }

    // URL encode spaces in the slug
    const encodedSlug = entry.slug.replace(/ /g, '%20');
    const sourceUrl = `${siteUrl}/docs/${encodedSlug}.md`;

    lines.push('---');
    lines.push(`<!-- source: ${sourceUrl} -->`);
    lines.push(`## ${entry.title}`);
    lines.push('');
    lines.push(entry.content.trim());
    lines.push('');
  }

  const content = lines.join('\n');

  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
