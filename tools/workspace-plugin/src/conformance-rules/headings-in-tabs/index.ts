import {
  createConformanceRule,
  type ConformanceViolation,
} from '@nx/conformance';

const DOCS_PROJECT_NAME = 'astro-docs';

// These tags flatten their children into a plain string, so a heading nested in
// one never reaches the DOM and never lands in the table of contents.
const TEXT_ONLY_TAGS = ['llm_copy_prompt', 'llm_only'];

export default createConformanceRule({
  name: 'headings-in-tabs',
  category: 'consistency',
  description:
    'Ensures that markdoc files do not put headings inside {% tabs %} blocks',
  implementation: async ({ tree, fileMapCache }) => {
    const violations: ConformanceViolation[] = [];

    const docsFiles = fileMapCache.fileMap.projectFileMap?.[DOCS_PROJECT_NAME];

    if (!docsFiles) {
      violations.push({
        message: `Could not find ${DOCS_PROJECT_NAME} project files. This is most likely an issue where the graph failed to create correctly.`,
        sourceProject: DOCS_PROJECT_NAME,
      });
      return {
        severity: 'high',
        details: {
          violations,
        },
      };
    }

    for (const { file } of docsFiles) {
      if (!file.endsWith('.mdoc')) {
        continue;
      }
      violations.push(...checkHeadingsInTabs(tree.read(file, 'utf-8'), file));
    }

    return {
      severity: violations.length > 0 ? 'medium' : 'low',
      details: {
        violations,
      },
    };
  },
});

export function checkHeadingsInTabs(
  content: string,
  filePath: string
): ConformanceViolation[] {
  const violations: ConformanceViolation[] = [];
  const lines = content.split('\n');

  let inCodeBlock = false;
  let tabsDepth = 0;
  let textOnlyDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) {
      continue;
    }

    if (isOpeningTag(line, 'tabs')) {
      tabsDepth++;
      continue;
    }
    if (isClosingTag(line, 'tabs')) {
      tabsDepth--;
      continue;
    }
    if (TEXT_ONLY_TAGS.some((tag) => isOpeningTag(line, tag))) {
      textOnlyDepth++;
      continue;
    }
    if (TEXT_ONLY_TAGS.some((tag) => isClosingTag(line, tag))) {
      textOnlyDepth--;
      continue;
    }

    if (tabsDepth <= 0 || textOnlyDepth > 0) {
      continue;
    }
    const heading = line.match(/^#{1,6}\s+(\S.*)$/);
    if (!heading) {
      continue;
    }

    violations.push({
      message: `Heading "${heading[1]}" at line ${
        i + 1
      } is inside a {% tabs %} block. Its content is hidden until that tab is active, but it still shows up in the table of contents and cannot be scrolled to. Move the section out of the tabs, or drop the heading.`,
      file: filePath,
    });
  }

  return violations;
}

function isOpeningTag(line: string, tag: string): boolean {
  return new RegExp(`^\\{%\\s*${tag}(\\s|%)`).test(line);
}

function isClosingTag(line: string, tag: string): boolean {
  return new RegExp(`^\\{%\\s*/${tag}\\s*%\\}`).test(line);
}
