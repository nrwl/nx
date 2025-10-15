import { load } from '@zkochan/js-yaml';
import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import type { Tree } from '../../generators/tree';
import { PnpmCatalogManager } from './pnpm-manager';

describe('PnpmCatalogManager', () => {
  let tree: Tree;
  let manager: PnpmCatalogManager;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    manager = new PnpmCatalogManager();
  });

  describe('isCatalogReference', () => {
    it('should return true for catalog references', () => {
      expect(manager.isCatalogReference('catalog:')).toBe(true);
      expect(manager.isCatalogReference('catalog:react18')).toBe(true);
    });

    it('should return false for non-catalog references', () => {
      expect(manager.isCatalogReference('^18.0.0')).toBe(false);
      expect(manager.isCatalogReference('latest')).toBe(false);
      expect(manager.isCatalogReference('catalog')).toBe(false);
    });
  });

  describe('parseCatalogReference', () => {
    it('should parse default catalog reference', () => {
      const result = manager.parseCatalogReference('catalog:');

      expect(result).toStrictEqual({
        catalogName: undefined,
        isDefaultCatalog: true,
      });
    });

    it('should normalize catalog:default to default catalog reference', () => {
      const result = manager.parseCatalogReference('catalog:default');

      expect(result).toStrictEqual({
        catalogName: undefined,
        isDefaultCatalog: true,
      });
    });

    it('should parse named catalog reference', () => {
      const result = manager.parseCatalogReference('catalog:react18');

      expect(result).toStrictEqual({
        catalogName: 'react18',
        isDefaultCatalog: false,
      });
    });

    it('should return null for non-catalog reference', () => {
      const result = manager.parseCatalogReference('^18.0.0');

      expect(result).toBe(null);
    });
  });

  describe('getCatalogDefinitions', () => {
    it('should return null when no pnpm-workspace.yaml exists', () => {
      const result = manager.getCatalogDefinitions(tree);

      expect(result).toBe(null);
    });

    it('should parse catalog definitions from pnpm-workspace.yaml', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `
packages:
  - 'packages/*'
catalog:
  react: ^18.0.0
  lodash: ^4.17.21
catalogs:
  react17:
    react: ^17.0.0
    react-dom: ^17.0.0
  react18:
    react: ^18.0.0
    react-dom: ^18.0.0
`
      );

      const result = manager.getCatalogDefinitions(tree);

      expect(result).toStrictEqual({
        packages: ['packages/*'],
        catalog: {
          react: '^18.0.0',
          lodash: '^4.17.21',
        },
        catalogs: {
          react17: {
            react: '^17.0.0',
            'react-dom': '^17.0.0',
          },
          react18: {
            react: '^18.0.0',
            'react-dom': '^18.0.0',
          },
        },
      });
    });

    it('should handle parsing errors gracefully', () => {
      tree.write('pnpm-workspace.yaml', 'invalid: yaml: content: [');

      const result = manager.getCatalogDefinitions(tree);

      expect(result).toBe(null);
    });
  });

  describe('resolveCatalogReference', () => {
    it('should resolve default catalog reference from top-level catalog field', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `
catalog:
  react: ^18.0.0
`
      );

      const result = manager.resolveCatalogReference(tree, 'react', 'catalog:');

      expect(result).toBe('^18.0.0');
    });

    it('should resolve catalog:default from top-level catalog field', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `
catalog:
  react: ^18.0.0
`
      );

      const result = manager.resolveCatalogReference(
        tree,
        'react',
        'catalog:default'
      );

      expect(result).toBe('^18.0.0');
    });

    it('should resolve catalog: from catalogs.default field', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `
catalogs:
  default:
    react: ^18.0.0
`
      );

      const result = manager.resolveCatalogReference(tree, 'react', 'catalog:');

      expect(result).toBe('^18.0.0');
    });

    it('should resolve catalog:default from catalogs.default field', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `
catalogs:
  default:
    react: ^18.0.0
`
      );

      const result = manager.resolveCatalogReference(
        tree,
        'react',
        'catalog:default'
      );

      expect(result).toBe('^18.0.0');
    });

    it('should resolve named catalog reference', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `
catalogs:
  react17:
    react: ^17.0.0
`
      );

      const result = manager.resolveCatalogReference(
        tree,
        'react',
        'catalog:react17'
      );

      expect(result).toBe('^17.0.0');
    });

    it('should return null for non-catalog references', () => {
      const result = manager.resolveCatalogReference(tree, 'react', '^18.0.0');

      expect(result).toBe(null);
    });

    it('should return null for missing catalog', () => {
      const result = manager.resolveCatalogReference(
        tree,
        'react',
        'catalog:nonexistent'
      );

      expect(result).toBe(null);
    });

    it('should return null for missing package in catalog', () => {
      const result = manager.resolveCatalogReference(
        tree,
        'nonexistent',
        'catalog:'
      );

      expect(result).toBe(null);
    });
  });

  describe('validateCatalogReference', () => {
    it('should return invalid for non-catalog syntax', () => {
      expect(() =>
        manager.validateCatalogReference(tree, 'react', '^18.0.0')
      ).toThrow(
        'Invalid catalog reference syntax: "^18.0.0". Expected format: "catalog:" or "catalog:name"'
      );
    });

    it('should return invalid when workspace file not found', () => {
      expect(() =>
        manager.validateCatalogReference(tree, 'react', 'catalog:')
      ).toThrow(
        'Cannot get Pnpm catalog definitions. No pnpm-workspace.yaml found in workspace root.'
      );
    });

    it('should return error for catalog: when both definitions exist', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `
catalog:
  react: ^18.0.0
catalogs:
  default:
    lodash: ^4.17.21
`
      );

      expect(() =>
        manager.validateCatalogReference(tree, 'react', 'catalog:')
      ).toThrow(
        "The 'default' catalog was defined multiple times. Use the 'catalog' field or 'catalogs.default', but not both."
      );
    });

    it('should return error for catalog:default when both definitions exist', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `
catalog:
  react: ^18.0.0
catalogs:
  default:
    lodash: ^4.17.21
`
      );

      expect(() =>
        manager.validateCatalogReference(tree, 'react', 'catalog:default')
      ).toThrow(
        "The 'default' catalog was defined multiple times. Use the 'catalog' field or 'catalogs.default', but not both."
      );
    });

    it('should return invalid when default catalog not found', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `
packages:
  - packages/*
`
      );

      expect(() =>
        manager.validateCatalogReference(tree, 'react', 'catalog:')
      ).toThrow('No default catalog defined in pnpm-workspace.yaml');
    });

    it('should return invalid when named catalog not found', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `
packages:
  - packages/*
`
      );

      expect(() =>
        manager.validateCatalogReference(tree, 'react', 'catalog:non-existent')
      ).toThrow('Catalog "non-existent" not found in pnpm-workspace.yaml');
    });

    it('should return invalid for a missing package in catalog', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `
packages:
  - packages/*
catalog:
  react: ^18.0.0
`
      );

      expect(() =>
        manager.validateCatalogReference(tree, 'lodash', 'catalog:')
      ).toThrow('Package "lodash" not found in default catalog ("catalog")');
    });

    it('should return valid for existing catalog entry in top-level catalog', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `
catalog:
  react: ^18.0.0
`
      );

      expect(() =>
        manager.validateCatalogReference(tree, 'react', 'catalog:')
      ).not.toThrow();
    });

    it('should validate catalog:default with top-level catalog field', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `
catalog:
  react: ^18.0.0
`
      );

      expect(() =>
        manager.validateCatalogReference(tree, 'react', 'catalog:default')
      ).not.toThrow();
    });

    it('should validate catalog: with catalogs.default field', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `
catalogs:
  default:
    react: ^18.0.0
`
      );

      expect(() =>
        manager.validateCatalogReference(tree, 'react', 'catalog:')
      ).not.toThrow();
    });

    it('should validate catalog:default with catalogs.default field', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `
catalogs:
  default:
    react: ^18.0.0
`
      );

      expect(() =>
        manager.validateCatalogReference(tree, 'react', 'catalog:default')
      ).not.toThrow();
    });
  });

  describe('updateCatalogVersions', () => {
    it('should update existing top-level catalog field', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `
catalog:
  react: ^18.0.0
  lodash: ^4.17.21
`
      );

      manager.updateCatalogVersions(tree, [
        { packageName: 'react', version: '^18.3.0' },
      ]);

      const content = tree.read('pnpm-workspace.yaml', 'utf-8');
      const result = load(content);
      expect(result.catalog.react).toBe('^18.3.0');
      expect(result.catalog.lodash).toBe('^4.17.21');
    });

    it('should update existing catalogs.default field', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `
catalogs:
  default:
    react: ^18.0.0
    lodash: ^4.17.21
`
      );

      manager.updateCatalogVersions(tree, [
        { packageName: 'react', version: '^18.3.0' },
      ]);

      const content = tree.read('pnpm-workspace.yaml', 'utf-8');
      const result = load(content);
      expect(result.catalogs.default.react).toBe('^18.3.0');
      expect(result.catalogs.default.lodash).toBe('^4.17.21');
    });

    it('should update existing top-level catalog field with catalogName: "default"', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `
catalog:
  react: ^18.0.0
  lodash: ^4.17.21
`
      );

      manager.updateCatalogVersions(tree, [
        { packageName: 'react', version: '^18.3.0', catalogName: 'default' },
      ]);

      const content = tree.read('pnpm-workspace.yaml', 'utf-8');
      const result = load(content);
      expect(result.catalog.react).toBe('^18.3.0');
      expect(result.catalog.lodash).toBe('^4.17.21');
    });

    it('should update existing catalogs.default field with catalogName: "default"', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `
catalogs:
  default:
    react: ^18.0.0
    lodash: ^4.17.21
`
      );

      manager.updateCatalogVersions(tree, [
        { packageName: 'react', version: '^18.3.0', catalogName: 'default' },
      ]);

      const content = tree.read('pnpm-workspace.yaml', 'utf-8');
      const result = load(content);
      expect(result.catalogs.default.react).toBe('^18.3.0');
      expect(result.catalogs.default.lodash).toBe('^4.17.21');
    });

    it('should create catalog field when neither exists', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `
packages:
  - 'packages/*'
`
      );

      manager.updateCatalogVersions(tree, [
        { packageName: 'react', version: '^18.0.0' },
      ]);

      const content = tree.read('pnpm-workspace.yaml', 'utf-8');
      const result = load(content);
      expect(result.catalog.react).toBe('^18.0.0');
      expect(result.catalogs).toBeUndefined();
    });

    it('should update named catalog', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `
catalogs:
  react18:
    react: ^18.0.0
    react-dom: ^18.0.0
`
      );

      manager.updateCatalogVersions(tree, [
        { packageName: 'react', version: '^18.3.0', catalogName: 'react18' },
      ]);

      const content = tree.read('pnpm-workspace.yaml', 'utf-8');
      const result = load(content);
      expect(result.catalogs.react18.react).toBe('^18.3.0');
      expect(result.catalogs.react18['react-dom']).toBe('^18.0.0');
    });

    it('should handle multiple updates at once', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `
catalog:
  react: ^18.0.0
catalogs:
  react17:
    react: ^17.0.0
`
      );

      manager.updateCatalogVersions(tree, [
        { packageName: 'react', version: '^18.3.0' },
        { packageName: 'react', version: '^17.0.2', catalogName: 'react17' },
      ]);

      const content = tree.read('pnpm-workspace.yaml', 'utf-8');
      const result = load(content);
      expect(result.catalog.react).toBe('^18.3.0');
      expect(result.catalogs.react17.react).toBe('^17.0.2');
    });

    it('should add new packages to existing catalog', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `
catalog:
  react: ^18.0.0
`
      );

      manager.updateCatalogVersions(tree, [
        { packageName: 'lodash', version: '^4.17.21' },
      ]);

      const content = tree.read('pnpm-workspace.yaml', 'utf-8');
      const result = load(content);
      expect(result.catalog.react).toBe('^18.0.0');
      expect(result.catalog.lodash).toBe('^4.17.21');
    });
  });
});
