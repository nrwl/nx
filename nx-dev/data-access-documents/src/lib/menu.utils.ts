import { DocumentMetadata } from '@nrwl/nx-dev/data-access-documents';
import { MenuItem, MenuSection } from './menu.models';

export function createMenuItems(root: DocumentMetadata): MenuItem[] {
  const items = root?.itemList;

  const createPathMetadata = (g: DocumentMetadata, parentId = ''): MenuItem => {
    const pathData = {
      ...g,
      path: `/${parentId}/${g.id}`,
      url: `/${parentId}/${g.id}`,
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
          m.id === 'tutorial' ||
          m.id === 'migration' ||
          m.id === 'configuration' ||
          m.id === 'using-nx' ||
          m.id === 'react-tutorial' ||
          m.id === 'angular-tutorial' ||
          m.id === 'node-tutorial'
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
          m.id === 'generators' ||
          m.id === 'executors' ||
          m.id === 'ci' ||
          m.id === 'modern-angular' ||
          m.id === 'guides' ||
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

export function getApiSection(items: MenuItem[]): MenuSection {
  return {
    id: 'api',
    name: 'API / Reference',
    itemList: items.filter(
      (m) =>
        // m.id === 'plugins-overview' ||
        m.id === 'workspace' ||
        m.id === 'js' ||
        m.id === 'web' ||
        m.id === 'angular' ||
        m.id === 'react' ||
        m.id === 'jest' ||
        m.id === 'cypress' ||
        m.id === 'storybook' ||
        m.id === 'linter' ||
        m.id === 'node' ||
        m.id === 'express' ||
        m.id === 'nest' ||
        m.id === 'next' ||
        m.id === 'detox' ||
        m.id === 'react-native' ||
        m.id === 'nx-plugin' ||
        m.id === 'nx-devkit' ||
        m.id === 'cli'
    ),
  };
}
