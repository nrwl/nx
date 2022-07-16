import { DocumentMetadata } from '@nrwl/nx-dev/models-document';
import { MenuItem, MenuSection } from '@nrwl/nx-dev/models-menu';

export function createMenuItems(root: DocumentMetadata): MenuItem[] {
  const items = root?.itemList;

  const createPathMetadata = (g: DocumentMetadata, parentId = ''): MenuItem => {
    const pathData = {
      ...g,
      path: g.path ?? `/${parentId}/${g.id}`,
    };

    if (Array.isArray(g.itemList)) {
      pathData.itemList = g.itemList.map((value) =>
        createPathMetadata(value, `${parentId}/${g.id}`)
      );
    }

    return pathData;
  };

  return (
    items?.map((item) => {
      return {
        ...item,
        itemList: item.itemList?.map((ii) => createPathMetadata(ii, item.id)),
      };
    }) ?? []
  );
}

export function getBasicSection(items: MenuItem[]): MenuSection {
  return {
    id: 'basic',
    name: 'Basic',
    hideSectionHeader: true,
    itemList: items
      .filter(
        (m) =>
          m.id === 'getting-started' ||
          m.id === 'core-features' ||
          m.id === 'plugin-features' ||
          m.id === 'concepts' ||
          m.id === 'recipes' ||
          m.id === 'reference'
      )
      .map((m) => {
        return {
          ...m,
          disableCollapsible: !m.id.endsWith('tutorial'),
        };
      }),
  };
}

export function getDeepDiveSection(items: MenuItem[]): MenuSection {
  return {
    id: 'deep-dive',
    name: 'Deep Dive',
    itemList: items
      .filter(
        (m) =>
          m.id === 'workspace-concepts' ||
          m.id === 'structure' ||
          m.id === 'extending-nx' ||
          m.id === 'generators' ||
          m.id === 'executors' ||
          m.id === 'ci' ||
          m.id === 'modern-angular' ||
          m.id === 'guides' ||
          m.id === 'module-federation' ||
          m.id === 'examples' ||
          m.id === 'core-extended'
      )
      .map((m) => ({
        ...m,
        disableCollapsible: true,
        itemList: m.itemList?.map((item) => ({
          ...item,
          disableCollapsible: true,
        })),
      })),
  };
}

export function getPackageApiSection(items: MenuItem[]): MenuSection {
  const getGuides = (menu: MenuItem) =>
    menu.itemList?.filter(
      (x) => !x.path?.includes('executors') && !x.path?.includes('generators')
    ) || [];
  const getExecutors = (menu: MenuItem) =>
    menu.itemList?.filter((x) => x.path?.includes('executors')) || [];
  const getGenerators = (menu: MenuItem) =>
    menu.itemList?.filter((x) => x.path?.includes('generators')) || [];

  return {
    id: 'official-packages',
    name: 'Reference',
    itemList: items
      .filter(
        (m) =>
          m.id !== 'add-nx-to-monorepo' &&
          m.id !== 'cra-to-nx' &&
          m.id !== 'create-nx-plugin' &&
          m.id !== 'create-nx-workspace' &&
          m.id !== 'make-angular-cli-faster' &&
          m.id !== 'tao'
      )
      .map((m) => ({
        ...m,
        itemList: [
          {
            id: m.id + '-guides',
            name: 'Guides',
            itemList: getGuides(m),
          },
          {
            id: m.id + '-executors',
            name: 'Executors',
            itemList: getExecutors(m),
          },
          {
            id: m.id + '-generators',
            name: 'Generators',
            itemList: getGenerators(m),
          },
        ],
      })),
  };
}

export function getBasicNxCloudSection(items: MenuItem[]): MenuSection {
  return {
    id: 'basic',
    name: 'Basic',
    hideSectionHeader: true,
    itemList: items
      .filter(
        (m) => m.id === 'intro' || m.id === 'set-up' || m.id === 'account'
      )
      .map((m) => {
        return {
          ...m,
          disableCollapsible: !m.id.endsWith('tutorial'),
        };
      }),
  };
}

export function getDeepDiveNxCloudSection(items: MenuItem[]): MenuSection {
  return {
    id: 'deep-dive',
    name: 'Deep Dive',
    itemList: items
      .filter((m) => m.id === 'private-cloud' || m.id === 'reference')
      .map((m) => ({
        ...m,
        disableCollapsible: true,
        itemList: m.itemList?.map((item) => ({
          ...item,
          disableCollapsible: true,
        })),
      })),
  };
}
