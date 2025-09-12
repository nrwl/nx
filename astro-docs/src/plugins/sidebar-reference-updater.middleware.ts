import {
  defineRouteMiddleware,
  type StarlightRouteData,
} from '@astrojs/starlight/route-data';
import { devkitPages } from '../utils/devkit-content-queries';
import { getEntries, getEntry } from 'astro:content';

interface SidebarLink {
  type: 'link';
  label: string;
  href: string;
  isCurrent: boolean;
  // TODO: type badge out if we want to add it
  badge: undefined;
  // TODO: type attr out if we want to add it
  attrs: Record<string, any>;
}

interface SidebarGroup {
  type: 'group';
  label: string;
  entries: (SidebarLink | SidebarGroup)[];
  collapsed: boolean;
  // TODO: type badge out if we want to add it
  badge: undefined;
}

export const onRequest = defineRouteMiddleware(async (context) => {
  const { sidebar } = context.locals.starlightRoute;

  const refSection = sidebar.find((s) => s.label === 'Reference');

  if (!refSection || !('entries' in refSection)) {
    return;
  }

  const devkitSection = await getDevKitSection(context.locals.starlightRoute);

  const commandSection = await getCommandsSection(
    context.locals.starlightRoute
  );

  const apiPackageSections = await getApiPackageSections(
    context.locals.starlightRoute
  );

  // Apply sorting to reference entries  
  const newEntries = [...commandSection, ...apiPackageSections, devkitSection];
  
  // Merge new entries with existing entries to preserve any that are already there
  const existingEntries = refSection.entries as (SidebarGroup | SidebarLink)[];
  refSection.entries = sortReferenceEntries(
    existingEntries,
    newEntries,
    desiredSectionOrder
  );
});

async function getDevKitSection({ entry }: StarlightRouteData) {
  const devkitOverview: SidebarLink = {
    type: 'link',
    label: 'Overview',
    href: '/docs/reference/devkit',
    badge: undefined,
    isCurrent: entry.slug === 'reference/devkit',
    attrs: {},
  };

  const devkitItems = await devkitPages();

  const devkitOnlyItems = devkitItems.filter(
    (item) =>
      !item.params.slug?.startsWith('ngcli_adapter') && item.params.slug !== ''
  );
  const ngcliItems = devkitItems.filter(
    (item) =>
      item.params.slug?.startsWith('ngcli_adapter/') &&
      item.params.slug !== 'ngcli_adapter'
  );

  const devkitRoutes = devkitOnlyItems.map(
    (record): SidebarLink => ({
      type: 'link',
      label: record.props.doc.data.title,
      href: `/docs/reference/devkit/${record.props.doc.data.slug}`,
      badge: undefined,
      isCurrent:
        entry.slug === `reference/devkit/${record.props.doc.data.slug}`,
      attrs: {},
    })
  );

  const ngcliOverview: SidebarLink = {
    type: 'link',
    label: 'Overview',
    href: '/docs/reference/devkit/ngcli_adapter',
    badge: undefined,
    isCurrent: entry.slug === 'reference/devkit/ngcli_adapter',
    attrs: {},
  };

  const ngcliRoutes = ngcliItems.map(
    (record): SidebarLink => ({
      type: 'link',
      label: record.props.doc.data.title,
      href: `/docs/reference/devkit/${record.props.doc.data.slug}`,
      badge: undefined,
      isCurrent:
        entry.slug === `reference/devkit/${record.props.doc.data.slug}`,
      attrs: {},
    })
  );

  const ngcliSection: SidebarGroup = {
    type: 'group',
    label: 'ngcli_adapter',
    entries: [ngcliOverview, ...ngcliRoutes],
    collapsed: !entry.slug.startsWith('reference/devkit/ngcli_adapter'),
    badge: undefined,
  };

  const devkitSection: SidebarGroup = {
    type: 'group',
    label: 'Devkit',
    entries: [devkitOverview, ngcliSection, ...devkitRoutes],
    collapsed: !entry.slug.startsWith('reference/devkit'),
    badge: undefined,
  };

  return devkitSection;
}

async function getCommandsSection({ entry }: StarlightRouteData) {
  const docs = await getEntries<'nx-reference-packages'>([
    { collection: 'nx-reference-packages', id: 'nx-cli' },
    { collection: 'nx-reference-packages', id: 'cnw-cli' },
  ]);

  return docs.map((d): SidebarLink => {
    const slug = `reference/${d.data.title.split(' ').join('-')}`.toLowerCase();
    return {
      type: 'link',
      attrs: {},
      label: d.data.title,
      href: `/docs/${slug}`,
      badge: undefined,
      isCurrent: entry.slug === slug,
    };
  });
}

async function getApiPackageSections({ entry }: StarlightRouteData) {
  const packages = ['nx', 'plugin', 'web', 'workspace'];
  const sections: SidebarGroup[] = [];

  for (const pkg of packages) {
    const entries: SidebarLink[] = [];
    
    // Try to get each doc type for this package
    const docTypes = [
      { id: `${pkg}-overview`, label: 'Overview', path: '' },
      { id: `${pkg}-executors`, label: 'Executors', path: '/executors' },
      { id: `${pkg}-generators`, label: 'Generators', path: '/generators' },
      { id: `${pkg}-migrations`, label: 'Migrations', path: '/migrations' },
    ];

    for (const docType of docTypes) {
      try {
        const doc = await getEntry('nx-reference-packages', docType.id);
        if (doc) {
          const href = `/docs/reference/${pkg}${docType.path}`;
          entries.push({
            type: 'link',
            label: docType.label,
            href,
            badge: undefined,
            isCurrent: entry.slug === `reference/${pkg}${docType.path}`,
            attrs: {},
          });
        }
      } catch (e) {
        // Doc doesn't exist, skip
      }
    }

    if (entries.length > 0) {
      const packageName = pkg === 'nx' ? 'nx' : `@nx/${pkg}`;
      sections.push({
        type: 'group',
        label: packageName,
        entries,
        collapsed: !entry.slug.startsWith(`reference/${pkg}`),
        badge: undefined,
      });
    }
  }

  return sections;
}

function sortReferenceEntries(
  existingEntries: (SidebarLink | SidebarGroup)[],
  newEntries: (SidebarLink | SidebarGroup)[],
  desiredOrder: string[]
): (SidebarLink | SidebarGroup)[] {
  const allEntries = [...newEntries, ...existingEntries];

  const linkEntries: SidebarLink[] = [];
  const groupEntries: SidebarGroup[] = [];

  for (const entry of allEntries) {
    if ('entries' in entry && entry.entries) {
      groupEntries.push(entry as SidebarGroup);
    } else {
      linkEntries.push(entry as SidebarLink);
    }
  }

  const orderedLinkEntries: SidebarLink[] = [];

  // Add links in desired order
  for (const desiredLabel of desiredOrder) {
    const linkIndex = linkEntries.findIndex(
      (entry) => entry.label === desiredLabel
    );
    if (linkIndex !== -1) {
      orderedLinkEntries.push(linkEntries[linkIndex]);
      linkEntries.splice(linkIndex, 1);
    }
  }

  orderedLinkEntries.push(...linkEntries);

  // Sort group entries alphabetically by label
  groupEntries.sort((a, b) => a.label.localeCompare(b.label));

  return [...orderedLinkEntries, ...groupEntries];
}

const desiredSectionOrder = [
  'Nx Commands', // auto generated
  'Cloud Commands', // mdoc file
  'create-nx-workspace', // auto generated
];
