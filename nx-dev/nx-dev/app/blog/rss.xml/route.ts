import { blogApi } from '../../../lib/blog.api';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getExcerpt(content: string, description?: string): string {
  if (description && description.trim().length > 0) {
    return description;
  }
  const paragraphs = content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  return paragraphs.slice(0, 2).join('\n\n');
}

export async function GET() {
  const posts = await blogApi.getBlogs((p) => !!p.published);
  const items = posts
    .map((post) => {
      const link = `https://nx.dev/blog/${post.slug}`;
      const excerpt = getExcerpt(post.content, post.description);
      const authorString =
        post.authors && post.authors.length > 0
          ? post.authors.map((author) => author.name).join(', ')
          : 'Nx Team';
      return `\n    <item>\n      <title>${escapeHtml(
        post.title
      )}</title>\n      <description><![CDATA[${excerpt}]]></description>\n      <link>${link}</link>\n      <guid>${link}</guid>\n      <author>${escapeHtml(
        authorString
      )}</author>\n      <pubDate>${new Date(
        post.date
      ).toUTCString()}</pubDate>\n    </item>`;
    })
    .join('');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n  <channel>\n    <title>Nx Blog</title>\n    <link>https://nx.dev/blog</link>\n    <description>Updates from the Nx team</description>\n    <managingEditor>devrel@nrwl.io (Nx Team)</managingEditor>\n    <webMaster>devrel@nrwl.io (Nx Team)</webMaster>${items}\n  </channel>\n</rss>`;

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/rss+xml',
    },
  });
}
