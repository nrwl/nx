import {
  createConformanceRule,
  type ConformanceViolation,
} from '@nx/conformance';
import { workspaceRoot } from '@nx/devkit';
import { sync as globSync } from 'glob';
import { load as yamlLoad } from 'js-yaml';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export default createConformanceRule<{ mdGlobPattern: string }>({
  name: 'blog-description',
  category: 'consistency',
  description:
    'Ensures that markdown documentation files have a description in their frontmatter',
  implementation: async ({ projectGraph, ruleOptions }) => {
    const violations: ConformanceViolation[] = [];
    const { mdGlobPattern } = ruleOptions;

    // Look for the docs project
    const docsProject = Object.values(projectGraph.nodes).find(
      (project) => project.name === 'docs'
    );

    if (!docsProject) {
      return {
        severity: 'low',
        details: {
          violations: [],
        },
      };
    }

    const blogPattern = join(
      workspaceRoot,
      docsProject.data.root,
      mdGlobPattern
    );
    const files = findMarkdownFiles(blogPattern);

    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

      if (!frontmatterMatch) {
        violations.push({
          message: 'Markdown documentation files must have frontmatter',
          sourceProject: docsProject.name,
          file: file,
        });
        continue;
      }

      try {
        const frontmatter = yamlLoad(frontmatterMatch[1]) as Record<
          string,
          unknown
        >;

        if (!frontmatter.description) {
          violations.push({
            message:
              'Markdown documentation files must have a description field in their frontmatter',
            sourceProject: docsProject.name,
            file: file,
          });
        }
      } catch (e) {
        // If YAML parsing fails, we skip the file
        continue;
      }
    }

    return {
      severity: 'high',
      details: {
        violations,
      },
    };
  },
});

function findMarkdownFiles(pattern: string): string[] {
  return globSync(pattern);
}
