import type { APIRoute } from 'astro';
import {
  collectDocs,
  DESCRIPTION,
  INTRO,
  NESTED_SECTIONS,
  renderEntry,
  SECTION_NAMES,
  SECTION_ORDER,
  textResponse,
} from '../utils/llms';

/**
 * Generates llms.txt dynamically from all documentation collections.
 * This file helps AI agents discover and navigate the Nx documentation.
 * See: https://llmstxt.org/
 *
 * Long-tail sections get their own nested index instead of being inlined, so
 * this stays a navigation index an agent can read in one go rather than a
 * six-figure dump of every page on the site.
 */
export const GET: APIRoute = async ({ site }) => {
  const siteUrl = site?.origin ?? 'https://nx.dev';
  const { sections, devkitApiEntries } = await collectDocs();

  const lines: string[] = [
    '# Nx',
    '',
    `> ${INTRO}`,
    '',
    DESCRIPTION,
    '',
    '## Reading these docs as an agent',
    '',
    `- Append \`.md\` to any docs URL for raw Markdown, for example ${siteUrl}/docs/getting-started/intro.md`,
    `- Requesting a docs URL with \`Accept: text/markdown\` returns the same Markdown`,
    `- [Full documentation](${siteUrl}/llms-full.txt): every page concatenated into one file`,
    '',
    '## When to use Nx',
    '',
    'Use Nx when a repository holds more than one buildable or testable project and you need to know what depends on what, run only the affected tasks, or reuse cached results. Reach for these entry points rather than scraping the docs:',
    '',
    `- Nx CLI: the \`nx\` package on npm. Run any command with \`npx nx <command>\`. Commands are documented at ${siteUrl}/docs/reference/nx-commands.md`,
    `- [Nx MCP server](${siteUrl}/docs/reference/nx-mcp.md): run \`nx mcp\` to expose the workspace project graph, generators, and CI results as MCP tools`,
    `- [Agent skills](${siteUrl}/.well-known/agent-skills/index.json): task-scoped instructions for navigating a workspace, running tasks, scaffolding code, and monitoring CI`,
    `- [Set up AI agents](${siteUrl}/docs/getting-started/ai-setup.md): run \`nx configure-ai-agents\` to write agent rules, skills, and MCP config into a workspace`,
    '',
  ];

  const renderSection = (sectionKey: string) => {
    const sectionEntries = sections.get(sectionKey);
    if (!sectionEntries || sectionEntries.length === 0) return;

    const sectionName = SECTION_NAMES[sectionKey] || sectionKey;
    lines.push(`## ${sectionName}`);
    lines.push('');

    if ((NESTED_SECTIONS as readonly string[]).includes(sectionKey)) {
      const count =
        sectionKey === 'reference'
          ? sectionEntries.length + devkitApiEntries.length
          : sectionEntries.length;
      lines.push(
        `${count} pages, indexed separately: [${sectionName} index](${siteUrl}/docs/${sectionKey}/llms.txt)`
      );
      lines.push('');
      return;
    }

    for (const entry of sectionEntries) {
      lines.push(renderEntry(entry, siteUrl));
    }
    lines.push('');
  };

  for (const sectionKey of SECTION_ORDER) {
    renderSection(sectionKey);
  }
  for (const sectionKey of sections.keys()) {
    if (SECTION_ORDER.includes(sectionKey)) continue;
    renderSection(sectionKey);
  }

  return textResponse(lines.join('\n'));
};
