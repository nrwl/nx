import { readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { extractFrontmatter } from '@nx/nx-dev/ui-markdoc';

export type BlogPostFrontmatter = {
  title: string;
  description: string;
  authors: string[];
  published: string;
  updated?: string;
  cover_image: string;
  tags: string[];
  reposts: string[];
};

export type BlogPostDataEntry = {
  content: string;
  frontmatter: BlogPostFrontmatter;
  filePath: string;
  slug: string;
};

const calculateSlug = (filePath: string, frontmatter: any) => {
  const baseName = basename(filePath, '.md');
  return frontmatter.slug || baseName;
};

export class BlogApi {
  constructor(
    private readonly options: {
      id: string;
      blogRoot: string;
    }
  ) {
    if (!options.id) {
      throw new Error('id cannot be undefined');
    }
    if (!options.blogRoot) {
      throw new Error('public blog root cannot be undefined');
    }
  }

  getBlogPosts(): BlogPostDataEntry[] {
    const files = readdirSync(this.options.blogRoot);

    return files
      .map((file) => {
        const filePath = join(this.options.blogRoot, file);

        // filter out directories (e.g. images etc)
        if (!filePath.endsWith('.md')) {
          return null;
        }

        const content = readFileSync(filePath, 'utf8');

        const frontmatter = extractFrontmatter(content);
        const slug = calculateSlug(filePath, frontmatter);

        return {
          content,
          frontmatter: {
            title: frontmatter.title,
            description: frontmatter.description,
            authors: frontmatter.authors,
            published: frontmatter.published,
            updated: frontmatter.updated ?? null,
            cover_image: frontmatter.cover_image ?? null,
            tags: frontmatter.tags,
            reposts: frontmatter.reposts,
          },
          filePath,
          slug,
        };
      })
      .filter((x) => !!x);
  }
}
