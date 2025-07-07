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
      const authors =
        post.authors && post.authors.length > 0
          ? post.authors
          : [{ name: 'Nx Team', image: '', twitter: '', github: '' }];
      const authorElements = authors
        .map(
          (author) =>
            `\n    <author>\n      <name>${escapeHtml(
              author.name
            )}</name>\n    </author>`
        )
        .join('');
      return `\n  <entry>\n    <title>${escapeHtml(
        post.title
      )}</title>\n    <link href="${link}"/>\n    <id>${link}</id>\n    <updated>${new Date(
        post.date
      ).toISOString()}</updated>${authorElements}\n    <summary><![CDATA[${excerpt}]]></summary>\n  </entry>`;
    })
    .join('');

  const atom = `<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom">\n  <title>Nx Blog</title>\n  <link href="https://nx.dev/blog"/>\n  <link rel="self" href="https://nx.dev/blog/atom.xml"/>\n  <id>https://nx.dev/blog</id>\n  <updated>${new Date().toISOString()}</updated>\n  <author>\n    <name>Nx Team</name>\n    <email>devrel@nrwl.io</email>\n  </author>${items}\n</feed>`;

  return new Response(atom, {
    headers: {
      'Content-Type': 'application/atom+xml',
    },
  });
}
