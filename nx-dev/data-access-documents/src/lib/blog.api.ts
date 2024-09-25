import { readFileSync, accessSync, constants } from 'fs';
import { join, basename, parse, resolve } from 'path';
import { extractFrontmatter } from '@nx/nx-dev/ui-markdoc';
import { sortPosts } from './blog.util';
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
  async getBlogs(
    filterFn?: (post: BlogPostDataEntry) => boolean
  ): Promise<BlogPostDataEntry[]> {
    return await this.getAllBlogs(filterFn);
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
      const { image, type } = this.determineOgImage(frontmatter.cover_image);

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
        ogImage: image,
        ogImageType: type,
        filePath,
        slug,
        youtubeUrl: frontmatter.youtubeUrl,
        podcastYoutubeId: frontmatter.podcastYoutubeId,
        podcastSpotifyId: frontmatter.podcastSpotifyId,
        podcastIHeartUrl: frontmatter.podcastIHeartUrl,
        podcastAppleUrl: frontmatter.podcastAppleUrl,
        podcastAmazonUrl: frontmatter.podcastAmazonUrl,
        published: frontmatter.published ?? true,
      };
      const isDevelopment = process.env.NODE_ENV === 'development';
      const shouldIncludePost = !frontmatter.draft || isDevelopment;

      if (shouldIncludePost && (!filterFn || filterFn(post))) {
        allPosts.push(post);
      }
    }
    return sortPosts(allPosts);
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

  private fileExists(filePath: string): boolean {
    try {
      accessSync(filePath, constants.F_OK);
      return true;
    } catch (error) {
      return false;
    }
  }

  private determineOgImage(imagePath: string): {
    image: string;
    type: string;
  } {
    const allowedExtensions = ['.png', '.webp', '.jpg', '.jpeg'];
    const defaultImage = 'https://nx.dev/socials/nx-media.png';
    const defaultType = 'png';

    if (!imagePath) {
      return { image: defaultImage, type: defaultType };
    }

    const { ext } = parse(imagePath);

    if (!allowedExtensions.includes(ext)) {
      const foundExt = allowedExtensions.find((allowedExt) => {
        const ogImagePath = imagePath.replace(ext, allowedExt);
        return this.fileExists(
          join(
            'public',
            'documentation',
            resolve(this.options.blogRoot, ogImagePath)
          )
        );
      });

      if (!foundExt) {
        return { image: defaultImage, type: defaultType };
      }

      return {
        image: join('documentation', imagePath.replace(ext, foundExt)),
        type: foundExt.replace('.', ''),
      };
    }

    return {
      image: join('documentation', imagePath),
      type: ext.replace('.', ''),
    };
  }
}
