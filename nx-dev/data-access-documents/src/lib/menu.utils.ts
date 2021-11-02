import {
  DocumentMetadata,
  FlavorMetadata,
  VersionMetadata,
} from '@nrwl/nx-dev/data-access-documents';
import { MenuItem, MenuSection } from './menu.models';

export function createMenuItems(
  version: VersionMetadata,
  flavor: FlavorMetadata,
  root: DocumentMetadata[]
): MenuItem[] {
  const items = root.find((x) => x.id === flavor.id)?.itemList;

  const createPathMetadata = (g: DocumentMetadata, parentId = ''): MenuItem => {
    const pathData = {
      ...g,
      path: `/${version.id}/${flavor.id}/${parentId}/${g.id}`,
      url: `/${version.alias}/${flavor.alias}/${parentId}/${g.id}`,
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
          m.id === 'core-concepts'
      )
      .map((m) => {
        return {
          ...m,
          disableCollapsible: m.id !== 'tutorial',
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
        m.id === 'gatsby' ||
        m.id === 'detox' ||
        m.id === 'react-native' ||
        m.id === 'nx-plugin' ||
        m.id === 'nx-devkit' ||
        m.id === 'cli'
    ),
  };
}
