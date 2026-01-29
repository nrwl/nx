import { defineRouteMiddleware } from '@astrojs/starlight/route-data';

/**
 * Highlights sidebar items when viewing sub-routes that aren't explicitly listed in the sidebar.
 *
 * For example, when viewing `/docs/technologies/angular/guides/module-federation-with-ssr`,
 * the "Angular" sidebar link (pointing to `technologies/angular/introduction`) will be
 * marked as current since the page falls under the `technologies/angular/` path.
 *
 * Uses longest-prefix matching so more specific items win. E.g., a page under
 * `technologies/angular/angular-rspack/` will highlight "Angular Rspack" rather than "Angular".
 */

interface SidebarLink {
  type: 'link';
  label: string;
  href: string;
  isCurrent: boolean;
  badge: any;
  attrs: Record<string, any>;
}

interface SidebarGroup {
  type: 'group';
  label: string;
  entries: (SidebarLink | SidebarGroup)[];
  collapsed: boolean;
  badge: any;
}

type SidebarEntry = SidebarLink | SidebarGroup;

function flattenSidebarLinks(entries: SidebarEntry[]): SidebarLink[] {
  return entries.reduce<SidebarLink[]>((acc, entry) => {
    if (entry.type === 'group') acc.push(...flattenSidebarLinks(entry.entries));
    else acc.push(entry);
    return acc;
  }, []);
}

/**
 * Extracts the parent directory path from a sidebar link's href.
 * E.g., "/docs/technologies/angular/introduction" → "technologies/angular/"
 */
function getParentPath(href: string): string {
  // Strip /docs/ prefix
  const path = href.replace(/^\/docs\//, '');
  // Remove the last segment (the page name) to get the directory
  const lastSlash = path.lastIndexOf('/');
  if (lastSlash === -1) return '';
  return path.substring(0, lastSlash + 1);
}

export const onRequest = defineRouteMiddleware((context) => {
  const { sidebar, entry } = context.locals.starlightRoute;
  const currentSlug = entry.slug;

  const allLinks = flattenSidebarLinks(sidebar as SidebarEntry[]);

  // If any link already matches exactly, no work needed
  if (allLinks.some((link) => link.isCurrent)) {
    return;
  }

  // Find the best (longest) prefix match
  let bestMatch: SidebarLink | null = null;
  let bestPrefixLength = 0;

  for (const link of allLinks) {
    const parentPath = getParentPath(link.href);
    if (
      parentPath &&
      currentSlug.startsWith(parentPath) &&
      parentPath.length > bestPrefixLength
    ) {
      bestMatch = link;
      bestPrefixLength = parentPath.length;
    }
  }

  if (bestMatch) {
    bestMatch.isCurrent = true;
  }
});
