import { MenuItem, MenuSection } from '@nrwl/nx-dev/models-menu';

export function getBasicNxSection(items: MenuItem[]): MenuSection {
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

export function getBasicRecipesSection(items: MenuItem[]): MenuSection {
  return {
    id: 'basic',
    name: 'Basic',
    hideSectionHeader: true,
    itemList: items
      // .filter((m) => m.id === 'getting-started')
      .map((m) => {
        return {
          ...m,
          disableCollapsible: true,
        };
      }),
  };
}

export function getPackagesSections(items: MenuItem[]): MenuSection[] {
  return items
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
      id: m.id,
      name: m.name,
      itemList: m.children,
      hideSectionHeader: false,
    }));
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
    hideSectionHeader: false,
    itemList: items
      .filter((m) => m.id === 'private-cloud' || m.id === 'reference')
      .map((m) => ({
        ...m,
        disableCollapsible: true,
        itemList: m.children?.map((item) => ({
          ...item,
          disableCollapsible: true,
        })),
      })),
  };
}
