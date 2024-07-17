import { readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { extractFrontmatter } from '@nx/nx-dev/ui-markdoc';
import { sortPodcasts, sortPosts } from './blog.util';
import { BlogPostDataEntry } from './blog.model';
import { readFile, readdir } from 'fs/promises';

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

  async getBlogTags(): Promise<string[]> {
    const blogs = await this.getBlogs();
    const tags = new Set<string>();
    blogs.forEach((blog) => {
      blog.tags.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags);
  }

  async getPodcastBlogs(): Promise<BlogPostDataEntry[]> {
    return sortPodcasts(
      await this.getBlogs((post) =>
        post.tags.map((t) => t.toLowerCase()).includes('podcast')
      )
    );
  }

  async getBlogs(
    filterFn?: (post: BlogPostDataEntry) => boolean
  ): Promise<BlogPostDataEntry[]> {
    return sortPosts(await this.getAllBlogs(filterFn));
  }

  async getAllBlogs(
    filterFn?: (post: BlogPostDataEntry) => boolean
  ): Promise<BlogPostDataEntry[]> {
    const files: string[] = await readdir(this.options.blogRoot);
    const authors = JSON.parse(
      readFileSync(join(this.options.blogRoot, 'authors.json'), 'utf8')
    );
    const allPosts: BlogPostDataEntry[] = [];

    for (const file of files) {
      const filePath = join(this.options.blogRoot, file);
      if (!filePath.endsWith('.md')) continue;
      const content = await readFile(filePath, 'utf8');
      const frontmatter = extractFrontmatter(content);
      const slug = this.calculateSlug(filePath, frontmatter);
      const post = {
        content,
        title: frontmatter.title ?? null,
        description: frontmatter.description ?? null,
        authors: authors.filter((author) =>
          frontmatter.authors.includes(author.name)
        ),
        date: this.calculateDate(file, frontmatter),
        cover_image: frontmatter.cover_image
          ? `/documentation${frontmatter.cover_image}` // Match the prefix used by markdown parser
          : null,
        tags: frontmatter.tags ?? [],
        reposts: frontmatter.reposts ?? [],
        pinned: frontmatter.pinned ?? false,
        filePath,
        slug,
      };
      const isDevelopment = process.env.NODE_ENV === 'development';
      const shouldIncludePost = !frontmatter.draft || isDevelopment;

      if (shouldIncludePost && (!filterFn || filterFn(post))) {
        allPosts.push(post);
      }
    }
    return allPosts;
  }

  // Optimize this so we don't read the FS multiple times
  async getBlogPostBySlug(
    slug: string | null
  ): Promise<BlogPostDataEntry | undefined> {
    if (!slug) throw new Error(`Could not find blog post with slug: ${slug}`);
    return (await this.getBlogs()).find((post) => post.slug === slug);
  }

  private calculateSlug(filePath: string, frontmatter: any): string {
    const baseName = basename(filePath, '.md');
    return frontmatter.slug || baseName;
  }

  private calculateDate(filename: string, frontmatter: any): string {
    const date: Date = new Date();
    const timeString = date.toTimeString();
    if (frontmatter.date) {
      return new Date(frontmatter.date + ' ' + timeString).toISOString();
    } else {
      const regexp = /^(\d\d\d\d-\d\d-\d\d).+$/;
      const match = filename.match(regexp);
      if (match) {
        return new Date(match[1] + ' ' + timeString).toISOString();
      } else {
        throw new Error(`Could not parse date from filename: ${filename}`);
      }
    }
  }
}
