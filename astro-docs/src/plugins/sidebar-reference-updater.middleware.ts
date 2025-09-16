import {
  defineRouteMiddleware,
  type StarlightRouteData,
} from '@astrojs/starlight/route-data';
import { devkitPages } from '../utils/devkit-content-queries';
import { getEntries } from 'astro:content';

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
  const nxSection = await getNxPackageSection(
    'nx',
    context.locals.starlightRoute
  );
  const webSection = await getNxPackageSection(
    'web',
    context.locals.starlightRoute
  );
  const workspaceSection = await getNxPackageSection(
    'workspace',
    context.locals.starlightRoute
  );
  const pluginSection = await getNxPackageSection(
    'plugin',
    context.locals.starlightRoute
  );

  const commandSection = await getCommandsSection(
    context.locals.starlightRoute
  );

  // Add Plugin Registry and Changelog links
  const pluginRegistryLink: SidebarLink = {
    type: 'link',
    label: 'Plugin Registry',
    href: '/docs/plugin-registry',
    badge: undefined,
    isCurrent: context.locals.starlightRoute.entry.slug === 'plugin-registry',
    attrs: {},
  };

  const changelogLink: SidebarLink = {
    type: 'link',
    label: 'Changelog',
    href: '/changelog',
    badge: undefined,
    isCurrent: false, // This is on Next.js
    attrs: {},
  };

  // Apply sorting to reference entries
  const newEntries = [
    ...commandSection,
    pluginRegistryLink,
    changelogLink,
    nxSection,
    devkitSection,
    webSection,
    workspaceSection,
    pluginSection,
  ] as Array<SidebarGroup | SidebarLink>;
  refSection.entries = sortReferenceEntries(
    refSection.entries as (SidebarGroup | SidebarLink)[],
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

async function getNxPackageSection(
  packageName: 'nx' | 'web' | 'workspace' | 'plugin',
  { entry }: StarlightRouteData
) {
  const docTypes = ['overview', 'generators', 'executors', 'migrations'];
  const docIds = docTypes.map((type) => `${packageName}-${type}`);

  const docs = await getEntries<'nx-reference-packages'>(
    docIds.map((id) => ({ collection: 'nx-reference-packages' as const, id }))
  );

  const overviewDoc = docs.find((d) => d?.id === `${packageName}-overview`);
  if (!overviewDoc) {
    const label =
      packageName === 'nx'
        ? 'Nx'
        : packageName.charAt(0).toUpperCase() + packageName.slice(1);
    return {
      type: 'group',
      label,
      entries: [],
      collapsed: true,
      badge: undefined,
    };
  }

  const packageOverview: SidebarLink = {
    type: 'link',
    label: 'Overview',
    href: `/docs/reference/${packageName}`,
    badge: undefined,
    isCurrent: entry.slug === `reference/${packageName}`,
    attrs: {},
  };

  const packageRoutes = docs
    .filter((d) => {
      // Skip if it's the overview doc
      if (d?.id === `${packageName}-overview`) return false;
      // Skip if data or slug is missing
      if (!d?.data?.slug) return false;
      // Ensure slug is a string and not undefined
      if (typeof d.data.slug !== 'string') return false;
      return true;
    })
    .map(
      (record): SidebarLink => ({
        type: 'link',
        label: record.data.title || 'Untitled',
        href: `/docs/${record.data.slug}`,
        badge: undefined,
        isCurrent: entry.slug === record.data.slug,
        attrs: {},
      })
    );

  const label =
    packageName === 'nx'
      ? 'Nx'
      : packageName.charAt(0).toUpperCase() + packageName.slice(1);
  const packageSection: SidebarGroup = {
    type: 'group',
    label,
    entries: [packageOverview, ...packageRoutes],
    collapsed: !entry.slug.startsWith(`reference/${packageName}`),
    badge: undefined,
  };

  return packageSection;
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
  'Nx configuration',
  'Project Configuration',
  'Inputs and Named Inputs',
  '.nxignore',
  'Environment Variables',
  'Glossary',
  'Plugin Registry',
  'Changelog',
  'Releases',
  'Node.js and TypeScript Compatibility',
  'create-nx-workspace', // auto generated
];
