import { MenuItem, MenuSection } from '@nx/nx-dev/models-menu';

const COLLAPSIBLE_SECTIONS = ['concepts', 'recipes', 'enterprise'];

export function getBasicNxSection(items: MenuItem[]): MenuSection {
  return {
    id: 'basic',
    name: 'Basic',
    hideSectionHeader: true,
    itemList: items
      .filter(
        (m) =>
          m.id === 'getting-started' ||
          m.id === 'features' ||
          m.id === 'concepts' ||
          m.id === 'technologies' ||
          m.id === 'recipes' ||
          m.id === 'nx-enterprise' ||
          m.id === 'showcase' ||
          m.id === 'reference' ||
          m.id === 'troubleshooting'
      )
      .map((m) => {
        return {
          ...m,
          disableCollapsible: !COLLAPSIBLE_SECTIONS.some((collapsibleSection) =>
            m.id.endsWith(collapsibleSection)
          ),
        };
      }),
  };
}

export function getBasicPluginsSection(items: MenuItem[]): MenuSection {
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
        m.id !== 'create-nx-plugin' &&
        m.id !== 'create-nx-workspace' &&
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
        (m) =>
          m.id === 'intro' ||
          m.id === 'features' ||
          m.id === 'concepts' ||
          m.id === 'recipes' ||
          m.id === 'reference' ||
          m.id === 'troubleshooting'
      )
      .map((m) => {
        if (m.id === 'recipes') {
          m.children.map((recipesChild) => {
            if (recipesChild.id !== 'enterprise') {
              return recipesChild;
            }
            recipesChild.children = recipesChild.children.filter(
              (enterpriseChild) => enterpriseChild.id !== 'on-premise'
            );
            return recipesChild;
          });
        }
        return {
          ...m,
          disableCollapsible:
            !m.id.endsWith('tutorial') && !m.id.endsWith('concepts'),
        };
      }),
  };
}
