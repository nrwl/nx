import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { load as yamlLoad } from 'js-yaml';
import { workspaceRoot } from '@nx/devkit';
import { sync as globSync } from 'glob';
import {
  createConformanceRule,
  type ProjectFilesViolation,
} from '@nx/conformance';

export default createConformanceRule<{ mdGlobPattern: string }>({
  name: 'blog-cover-image',
  category: 'consistency',
  description:
    'Ensures that blog posts have a cover_image defined in avif or jpg format with appropriate fallbacks',
  reporter: 'project-files-reporter',
  implementation: async ({ projectGraph, ruleOptions }) => {
    const violations: ProjectFilesViolation[] = [];
    const webinarWarnings: ProjectFilesViolation[] = [];
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

    // find markdown files
    const files = globSync(blogPattern);

    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

      if (!frontmatterMatch) {
        //ignore missing frontmatter for now
        continue;
      }

      try {
        const frontmatter = yamlLoad(frontmatterMatch[1]) as Record<
          string,
          unknown
        >;

        // Check for webinar tag as we ignore webinars for now (they're pulled in via the Notion API)
        const isWebinar =
          Array.isArray(frontmatter.tags) &&
          frontmatter.tags.includes('webinar');

        const coverImagePath = frontmatter.cover_image as string;
        const fileExtension = extname(coverImagePath).toLowerCase();

        if (fileExtension !== '.avif' && fileExtension !== '.jpg') {
          const message = 'Blog post cover_image must be in avif or jpg format';
          if (isWebinar) {
            webinarWarnings.push({
              message: `[Webinar] ${message}`,
              sourceProject: docsProject.name,
              file: file,
            });
          } else {
            violations.push({
              message,
              sourceProject: docsProject.name,
              file: file,
            });
          }
          continue;
        }

        // Adjust the image path for proper resolution
        // For paths starting with /blog/, we need to look in docs/blog/images/
        let absoluteImagePath: string;
        if (coverImagePath.startsWith('/blog/')) {
          const adjustedPath = coverImagePath.replace(/^\/blog\//, '/');
          absoluteImagePath = join(
            workspaceRoot,
            docsProject.data.root,
            'blog',
            adjustedPath
          );
        } else {
          // For any other paths, use the as-is path
          absoluteImagePath = join(workspaceRoot, coverImagePath);
        }

        // Check if the image file exists
        if (!existsSync(absoluteImagePath)) {
          const message = `Cover image file does not exist: ${coverImagePath} (resolved to ${absoluteImagePath})`;
          if (isWebinar) {
            webinarWarnings.push({
              message: `[Webinar] ${message}`,
              sourceProject: docsProject.name,
              file: file,
            });
          } else {
            violations.push({
              message,
              sourceProject: docsProject.name,
              file: file,
            });
          }
          continue;
        }

        // If it's an AVIF image, check if there's a JPG equivalent
        if (fileExtension === '.avif' && !isWebinar) {
          if (
            !existsSync(absoluteImagePath.replace('.avif', '.jpg')) &&
            !existsSync(absoluteImagePath.replace('.avif', '.png')) &&
            !existsSync(absoluteImagePath.replace('.avif', '.webp'))
          ) {
            violations.push({
              message: `AVIF cover image must have a JPG equivalent to be accepted as a valid OG image: ${coverImagePath.replace(
                '.avif',
                '.jpg'
              )}`,
              sourceProject: docsProject.name,
              file: file,
            });
          }
        }
      } catch (e) {
        // If YAML parsing fails, we skip the file
        continue;
      }
    }

    // Return violations with appropriate severity level
    return {
      severity: violations.length > 0 ? 'high' : 'low',
      details: {
        violations: [...violations, ...webinarWarnings],
      },
    };
  },
});
