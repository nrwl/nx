import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import type { Tree } from '../../generators/tree';
import { writeJson } from '../../generators/utils/json';
import {
  formatCatalogError,
  getCatalogDependenciesFromPackageJson,
} from './index';
import type { CatalogManager } from './manager';
import { PnpmCatalogManager } from './pnpm-manager';
import { CatalogErrorType } from './types';
import { NpmCatalogManager } from './unsupported-manager';

describe('package manager catalogs', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('getCatalogDependenciesFromPackageJson', () => {
    let manager: CatalogManager;

    beforeEach(() => {
      manager = new PnpmCatalogManager();
    });

    it('should return empty map when package.json does not exist', () => {
      const result = getCatalogDependenciesFromPackageJson(
        tree,
        'package.json',
        manager
      );

      expect(result).toStrictEqual(new Map());
    });

    it('should return empty map when manager does not support catalogs', () => {
      const result = getCatalogDependenciesFromPackageJson(
        tree,
        'package.json',
        new NpmCatalogManager()
      );

      expect(result).toStrictEqual(new Map());
    });

    it('should return empty map when package.json cannot be read', () => {
      tree.write('package.json', 'invalid: json: content: [');

      const result = getCatalogDependenciesFromPackageJson(
        tree,
        'package.json',
        manager
      );

      expect(result).toStrictEqual(new Map());
    });

    it('should return empty map when package.json has no dependencies', () => {
      tree.write('package.json', '{}');

      const result = getCatalogDependenciesFromPackageJson(
        tree,
        'package.json',
        manager
      );

      expect(result).toStrictEqual(new Map());
    });

    it('should return empty map when package.json has no catalog dependencies', () => {
      writeJson(tree, 'package.json', { dependencies: { lodash: '^4.17.21' } });

      const result = getCatalogDependenciesFromPackageJson(
        tree,
        'package.json',
        manager
      );

      expect(result).toStrictEqual(new Map());
    });

    it('should return map with catalog dependencies', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `
packages:
  - packages/*
catalog:
  react: ^18.0.0
catalogs:
  react17:
    react: ^17.0.0
    react-dom: ^17.0.0
  other:
    lodash: ^4.17.21
`
      );
      writeJson(tree, 'package.json', {
        dependencies: { react: 'catalog:', lodash: 'catalog:other' },
      });

      const result = getCatalogDependenciesFromPackageJson(
        tree,
        'package.json',
        manager
      );

      expect(result).toStrictEqual(
        new Map([
          ['react', undefined],
          ['lodash', 'other'],
        ])
      );
    });
  });

  describe('formatCatalogError', () => {
    it('should format error with suggestions', () => {
      const error = {
        type: CatalogErrorType.CATALOG_NOT_FOUND,
        message: 'Catalog not found',
        suggestions: ['Try catalog:dev', 'Try catalog:prod'],
      };

      const result = formatCatalogError(error);

      expect(result).toMatchInlineSnapshot(`
        "Catalog not found

        Suggestions:
          • Try catalog:dev
          • Try catalog:prod"
      `);
    });
  });
});
