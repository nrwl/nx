import { getCollection } from 'astro:content';

export interface DocEntry {
  slug: string;
  title: string;
  description?: string;
}

/** Sections large enough that inlining them blows the llms.txt index budget. */
export const NESTED_SECTIONS = ['technologies', 'reference', 'kb'] as const;
export type NestedSection = (typeof NESTED_SECTIONS)[number];

export const SECTION_NAMES: Record<string, string> = {
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
  'how-nx-works': 'How Nx Works',
  'platform-features': 'Platform Features',
  'technologies-tools': 'Technologies and Tools',
  kb: 'Knowledge Base',
};

export const SECTION_ORDER = [
  'quickstart',
  'getting-started',
  'concepts',
  'how-nx-works',
  'features',
  'platform-features',
  'guides',
  'extending-nx',
  'technologies-tools',
  'technologies',
  'reference',
  'kb',
  'enterprise',
  'troubleshooting',
];

export const INTRO =
  'Nx is an AI-first monorepo platform that connects your editor to CI. It helps you deliver fast without breaking things by optimizing builds, scaling CI, and fixing failed PRs.';

export const DESCRIPTION =
  'Nx is a powerful, open-source, technology-agnostic monorepo platform designed to efficiently manage codebases of any scale. From small workspaces to large enterprise monorepos, Nx provides intelligent task execution, caching, and CI optimization.';

/** Collapse to a single line and truncate so each index entry stays one row. */
export function sanitizeDescription(desc: string | undefined): string {
  if (!desc) return '';
  const cleaned = desc
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const maxLen = 150;
  if (cleaned.length > maxLen) {
    return cleaned.substring(0, maxLen).replace(/\s+\S*$/, '') + '...';
  }
  return cleaned;
}

export function renderEntry(entry: DocEntry, siteUrl: string): string {
  const encodedSlug = entry.slug.replace(/ /g, '%20');
  const url = `${siteUrl}/docs/${encodedSlug}.md`;
  const desc = sanitizeDescription(entry.description);
  return `- [${entry.title}](${url})${desc ? `: ${desc}` : ''}`;
}

export interface CollectedDocs {
  /** Doc entries keyed by their top-level slug segment. */
  sections: Map<string, DocEntry[]>;
  /** `@nx/devkit` API pages, kept apart so they can get their own heading. */
  devkitApiEntries: DocEntry[];
}

export async function collectDocs(): Promise<CollectedDocs> {
  const entries: DocEntry[] = [];
  const devkitApiEntries: DocEntry[] = [];

  const docs = await getCollection('docs');
  for (const doc of docs) {
    const slug = doc.id;
    entries.push({
      slug,
      title: doc.data.title || slug.split('/').pop() || slug,
      description: doc.data.description,
    });
  }

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

  try {
    const nxRefDocs = await getCollection('nx-reference-packages');
    for (const doc of nxRefDocs) {
      if (doc.data.slug !== undefined && doc.data.packageType === 'devkit') {
        devkitApiEntries.push({
          slug: `reference/devkit/${doc.data.slug}`,
          title: doc.data.title || doc.data.slug,
          description: doc.data.description,
        });
      }
    }
  } catch {
    // nx-reference-packages collection might not exist
  }

  entries.sort((a, b) => a.slug.localeCompare(b.slug));
  devkitApiEntries.sort((a, b) => a.title.localeCompare(b.title));

  const sections = new Map<string, DocEntry[]>();
  for (const entry of entries) {
    const section = entry.slug.split('/')[0] || 'other';
    if (!sections.has(section)) {
      sections.set(section, []);
    }
    sections.get(section)!.push(entry);
  }

  return { sections, devkitApiEntries };
}

export function textResponse(content: string): Response {
  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

/**
 * Renders the nested index for one long-tail section, linked from /llms.txt.
 * Devkit API pages get their own heading inside the reference index.
 */
export async function renderSectionIndex(
  sectionKey: NestedSection,
  siteUrl: string
): Promise<string> {
  const { sections, devkitApiEntries } = await collectDocs();
  const sectionName = SECTION_NAMES[sectionKey] || sectionKey;
  const entries = sections.get(sectionKey) ?? [];

  const lines: string[] = [
    `# Nx ${sectionName}`,
    '',
    `> ${sectionName} pages from the Nx documentation. See ${siteUrl}/llms.txt for the full index.`,
    '',
    `## ${sectionName}`,
    '',
    ...entries.map((entry) => renderEntry(entry, siteUrl)),
    '',
  ];

  if (sectionKey === 'reference' && devkitApiEntries.length > 0) {
    lines.push('## Devkit API Reference (@nx/devkit)');
    lines.push('');
    lines.push(
      'API docs for `@nx/devkit`, the package plugin authors use to extend Nx with custom generators, executors, and project graph plugins.'
    );
    lines.push('');
    lines.push(...devkitApiEntries.map((entry) => renderEntry(entry, siteUrl)));
    lines.push('');
  }

  return lines.join('\n');
}
