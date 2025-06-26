import { marked } from 'marked';
import { gfmHeadingId } from 'marked-gfm-heading-id';
import matter from 'gray-matter';
import { createSlug } from './extract-headings';

// Configure marked with GFM heading IDs
marked.use(
  gfmHeadingId({
    prefix: '', // Don't add prefix to IDs
  })
);

export async function parseMarkdownToHtml(markdown: string): Promise<string> {
  // Parse frontmatter and content separately
  const { content } = matter(markdown);

  // Convert markdown to HTML
  let html = await marked.parse(content);

  // Add anchor links to headings (handles headings with nested HTML like <code> tags)
  html = html.replace(
    /<h([1-6])\s+id="([^"]+)">(.*?)<\/h[1-6]>/g,
    (match, level, id, content) => {
      // Extract text content for aria-label
      const textOnly = content.replace(/<[^>]*>/g, '');
      return `<h${level} id="${id}">${content}<a href="#${id}" class="anchor-link" aria-label="Direct link to ${textOnly}">#</a></h${level}>`;
    }
  );

  return html;
}
