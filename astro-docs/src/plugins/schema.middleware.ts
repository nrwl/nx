import { defineRouteMiddleware } from '@astrojs/starlight/route-data';

const CANONICAL_DOMAIN = 'https://nx.dev';

interface SidebarEntry {
  type: 'link' | 'group';
  label: string;
  href?: string;
  isCurrent?: boolean;
  entries?: SidebarEntry[];
}

interface BreadcrumbItem {
  label: string;
  href?: string;
}

/**
 * Walk the sidebar tree to find the breadcrumb path to the current page.
 */
function findBreadcrumbPath(
  entries: SidebarEntry[],
  path: BreadcrumbItem[] = []
): BreadcrumbItem[] | null {
  for (const entry of entries) {
    if (entry.type === 'link' && entry.isCurrent) {
      return [...path, { label: entry.label, href: entry.href }];
    }
    if (entry.type === 'group' && entry.entries) {
      const result = findBreadcrumbPath(entry.entries, [
        ...path,
        { label: entry.label },
      ]);
      if (result) return result;
    }
  }
  return null;
}

/**
 * Build BreadcrumbList JSON-LD from the sidebar-derived breadcrumb path.
 */
function buildBreadcrumbList(
  crumbs: BreadcrumbItem[],
  currentPath: string
): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Nx',
        item: CANONICAL_DOMAIN,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Docs',
        item: `${CANONICAL_DOMAIN}/docs/getting-started/intro`,
      },
      ...crumbs.map((crumb, i) => ({
        '@type': 'ListItem',
        position: i + 3,
        name: crumb.label,
        ...(crumb.href
          ? { item: `${CANONICAL_DOMAIN}${crumb.href}` }
          : { item: `${CANONICAL_DOMAIN}${currentPath}` }),
      })),
    ],
  };
}

/**
 * Build TechArticle JSON-LD for the current documentation page.
 */
function buildTechArticle(
  title: string,
  description: string,
  currentPath: string
): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: title,
    description,
    url: `${CANONICAL_DOMAIN}${currentPath}`,
    publisher: {
      '@type': 'Organization',
      name: 'Nx',
      url: CANONICAL_DOMAIN,
      logo: {
        '@type': 'ImageObject',
        url: `${CANONICAL_DOMAIN}/docs/nx-media.png`,
      },
    },
    isPartOf: {
      '@type': 'WebSite',
      name: 'Nx',
      url: CANONICAL_DOMAIN,
    },
  };
}

export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute;
  const { head, sidebar, entry } = route;
  const currentPath = context.url.pathname;
  const title = entry.data.title || 'Nx Documentation';
  const description =
    (entry.data as Record<string, unknown>).description?.toString() || '';

  const schemas: object[] = [];

  // BreadcrumbList from sidebar hierarchy
  const crumbs = findBreadcrumbPath(sidebar as SidebarEntry[]);
  if (crumbs && crumbs.length > 0) {
    schemas.push(buildBreadcrumbList(crumbs, currentPath));
  }

  // TechArticle for the current page
  schemas.push(buildTechArticle(title, description, currentPath));

  // Inject each schema as a separate script tag
  for (const schema of schemas) {
    head.push({
      tag: 'script',
      attrs: { type: 'application/ld+json' },
      content: JSON.stringify(schema),
    });
  }
});
