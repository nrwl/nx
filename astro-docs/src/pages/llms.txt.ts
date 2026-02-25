import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

interface DocEntry {
  slug: string;
  title: string;
  description?: string;
  packageType?: string;
}

/**
 * Generates llms.txt dynamically from all documentation collections.
 * This file helps AI agents discover and navigate the Nx documentation.
 * See: https://llmstxt.org/
 */
export const GET: APIRoute = async ({ site }) => {
  // Get the site URL, fallback to nx.dev
  const siteUrl = site?.origin ?? 'https://nx.dev';
  const entries: DocEntry[] = [];
  const devkitApiEntries: DocEntry[] = [];

  // Get all docs from the content collection
  const docs = await getCollection('docs');
  for (const doc of docs) {
    const slug = doc.id;
    const title = doc.data.title || slug.split('/').pop() || slug;
    const description = doc.data.description;
    entries.push({ slug, title, description });
  }

  // Get plugin docs (executors, generators for each plugin)
  try {
    const pluginDocs = await getCollection('plugin-docs');
    for (const doc of pluginDocs) {
      if (doc.data.slug) {
        entries.push({
          slug: doc.data.slug,
          title: doc.data.title || doc.data.slug,
          description: doc.data.description,
        });
      }
    }
  } catch {
    // plugin-docs collection might not exist
  }

  // Get Devkit API docs separately for dedicated section
  try {
    const nxRefDocs = await getCollection('nx-reference-packages');
    for (const doc of nxRefDocs) {
      // Only include devkit package type for now
      if (doc.data.slug !== undefined && doc.data.packageType === 'devkit') {
        devkitApiEntries.push({
          slug: doc.data.slug,
          title: doc.data.title || doc.data.slug,
          description: doc.data.description,
          packageType: doc.data.packageType,
        });
      }
    }
  } catch {
    // nx-reference-packages collection might not exist
  }

  // Sort entries by slug for consistent output
  entries.sort((a, b) => a.slug.localeCompare(b.slug));

  // Group entries by top-level section
  const sections = new Map<string, DocEntry[]>();
  for (const entry of entries) {
    const section = entry.slug.split('/')[0] || 'other';
    if (!sections.has(section)) {
      sections.set(section, []);
    }
    sections.get(section)!.push(entry);
  }

  // Generate the llms.txt content
  const lines: string[] = [
    '# Nx',
    '',
    '> Nx is an AI-first monorepo platform that connects your editor to CI. It helps you deliver fast without breaking things by optimizing builds, scaling CI, and fixing failed PRs.',
    '',
    'Nx is a powerful, open-source, technology-agnostic monorepo platform designed to efficiently manage codebases of any scale. From small workspaces to large enterprise monorepos, Nx provides intelligent task execution, caching, and CI optimization.',
    '',
    'Note: All documentation pages are available as raw Markdown by appending `.md` to the URL.',
    `For example: ${siteUrl}/docs/getting-started/intro.md returns the raw Markdown content.`,
    '',
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

  // Preferred section order
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

  // Helper to sanitize descriptions - collapse to single line and truncate
  function sanitizeDescription(desc: string | undefined): string {
    if (!desc) return '';
    // Replace newlines and multiple spaces with single space, trim
    const cleaned = desc
      .replace(/[\r\n]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    // Truncate long descriptions
    const maxLen = 150;
    if (cleaned.length > maxLen) {
      return cleaned.substring(0, maxLen).replace(/\s+\S*$/, '') + '...';
    }
    return cleaned;
  }

  // Output sections in preferred order
  for (const sectionKey of sectionOrder) {
    const sectionEntries = sections.get(sectionKey);
    if (!sectionEntries || sectionEntries.length === 0) continue;

    const sectionName = sectionNames[sectionKey] || sectionKey;
    lines.push(`## ${sectionName}`);
    lines.push('');

    for (const entry of sectionEntries) {
      // URL encode spaces in the slug
      const encodedSlug = entry.slug.replace(/ /g, '%20');
      const url = `${siteUrl}/docs/${encodedSlug}.md`;
      const desc = sanitizeDescription(entry.description);
      lines.push(`- [${entry.title}](${url})${desc ? `: ${desc}` : ''}`);
    }
    lines.push('');
  }

  // Output any remaining sections not in the preferred order
  for (const [sectionKey, sectionEntries] of sections) {
    if (sectionOrder.includes(sectionKey)) continue;
    if (sectionEntries.length === 0) continue;

    const sectionName = sectionNames[sectionKey] || sectionKey;
    lines.push(`## ${sectionName}`);
    lines.push('');

    for (const entry of sectionEntries) {
      const encodedSlug = entry.slug.replace(/ /g, '%20');
      const url = `${siteUrl}/docs/${encodedSlug}.md`;
      const desc = sanitizeDescription(entry.description);
      lines.push(`- [${entry.title}](${url})${desc ? `: ${desc}` : ''}`);
    }
    lines.push('');
  }

  // Output Devkit API Reference section
  if (devkitApiEntries.length > 0) {
    devkitApiEntries.sort((a, b) => a.title.localeCompare(b.title));

    lines.push('## Devkit API Reference (@nx/devkit)');
    lines.push('');
    lines.push(
      'The following are API docs for `@nx/devkit`, the package used by plugin authors to extend Nx with custom generators, executors, and project graph plugins.'
    );
    lines.push('');

    for (const entry of devkitApiEntries) {
      const encodedSlug = entry.slug.replace(/ /g, '%20');
      const url = `${siteUrl}/docs/reference/devkit/${encodedSlug}.md`;
      lines.push(`- [${entry.title}](${url})`);
    }
    lines.push('');
  }

  const content = lines.join('\n');

  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
