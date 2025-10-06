import type { Tree } from '../../generators/tree';
import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import { PnpmCatalogManager } from './pnpm-manager';
import { CatalogErrorType } from './types';

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
    it('should resolve default catalog reference', () => {
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
      const result = manager.validateCatalogReference(tree, 'react', '^18.0.0');

      expect(result.isValid).toBe(false);
      expect(result.error?.type).toBe(CatalogErrorType.INVALID_SYNTAX);
    });

    it('should return invalid when workspace file not found', () => {
      const result = manager.validateCatalogReference(
        tree,
        'react',
        'catalog:'
      );

      expect(result.isValid).toBe(false);
      expect(result.error?.type).toBe(CatalogErrorType.WORKSPACE_NOT_FOUND);
    });

    it('should return invalid when default catalog not found', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `
packages:
  - packages/*
`
      );

      const result = manager.validateCatalogReference(
        tree,
        'react',
        'catalog:'
      );

      expect(result.isValid).toBe(false);
      expect(result.error?.type).toBe(CatalogErrorType.CATALOG_NOT_FOUND);
    });

    it('should return invalid when named catalog not found', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `
packages:
  - packages/*
`
      );

      const result = manager.validateCatalogReference(
        tree,
        'react',
        'catalog:non-existent'
      );

      expect(result.isValid).toBe(false);
      expect(result.error?.type).toBe(CatalogErrorType.CATALOG_NOT_FOUND);
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

      const result = manager.validateCatalogReference(
        tree,
        'lodash',
        'catalog:'
      );

      expect(result.isValid).toBe(false);
      expect(result.error?.type).toBe(CatalogErrorType.PACKAGE_NOT_FOUND);
    });

    it('should return valid for existing catalog entry', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `
catalog:
  react: ^18.0.0
`
      );

      const result = manager.validateCatalogReference(
        tree,
        'react',
        'catalog:'
      );

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
});
