import type { APIRoute } from 'astro';

const siteUrl = import.meta.env.SITE ?? 'https://nx.dev';
const isProductionDomain = siteUrl === 'https://nx.dev';

const productionRobotsTxt = `# https://www.robotstxt.org/robotstxt.html
User-agent: *
Allow: /
# Content usage preferences — https://contentsignals.org/
# nx.dev is public documentation for the Nx open-source CLI; we actively
# want AI assistants to consume, reference, and train on these docs.
Content-Signal: search=yes, ai-input=yes, ai-train=yes

# Host
Host: https://nx.dev

# Sitemaps
Sitemap: https://nx.dev/sitemap.xml
`;

// Block all crawling on non-production domains (canary, versioned, etc.)
const nonProductionRobotsTxt = `# This is a non-production deployment (canary, versioned, preview, etc.)
# All crawling is disallowed to prevent duplicate content in search results.
User-agent: *
Disallow: /
`;

export const GET: APIRoute = () => {
  return new Response(
    isProductionDomain ? productionRobotsTxt : nonProductionRobotsTxt,
    {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    }
  );
};
