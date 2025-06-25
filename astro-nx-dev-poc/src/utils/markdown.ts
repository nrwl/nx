import { marked } from 'marked';
import matter from 'gray-matter';

export async function parseMarkdownToHtml(markdown: string): Promise<string> {
  // Parse frontmatter and content separately
  const { content } = matter(markdown);
  
  // Convert markdown to HTML (content without frontmatter)
  return await marked.parse(content);
}