import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import type { Tree } from '../../generators/tree';
import { readJson, writeJson } from '../../generators/utils/json';
import { BunCatalogManager } from './bun-manager';

describe('BunCatalogManager', () => {
  let tree: Tree;
  let manager: BunCatalogManager;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    manager = new BunCatalogManager();
  });

  describe('isCatalogReference', () => {
    it('should return true for catalog references', () => {
      expect(manager.isCatalogReference('catalog:')).toBe(true);
      expect(manager.isCatalogReference('catalog:web')).toBe(true);
    });

    it('should return false for non-catalog references', () => {
      expect(manager.isCatalogReference('^18.0.0')).toBe(false);
      expect(manager.isCatalogReference('latest')).toBe(false);
      expect(manager.isCatalogReference('catalog')).toBe(false);
      expect(manager.isCatalogReference('workspace:*')).toBe(false);
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

    it('should treat catalog:default as a named catalog reference', () => {
      // Unlike pnpm, bun does not treat "default" as an alias for the
      // `catalog` field — it is an ordinary named catalog.
      const result = manager.parseCatalogReference('catalog:default');

      expect(result).toStrictEqual({
        catalogName: 'default',
        isDefaultCatalog: false,
      });
    });

    it('should treat whitespace-only names as the default catalog', () => {
      const result = manager.parseCatalogReference('catalog:  ');

      expect(result).toStrictEqual({
        catalogName: undefined,
        isDefaultCatalog: true,
      });
    });

    it('should parse named catalog reference', () => {
      const result = manager.parseCatalogReference('catalog:web');

      expect(result).toStrictEqual({
        catalogName: 'web',
        isDefaultCatalog: false,
      });
    });

    it('should return null for non-catalog reference', () => {
      expect(manager.parseCatalogReference('^18.0.0')).toBe(null);
    });
  });

  describe('getCatalogDefinitions', () => {
    it('should return null when no package.json exists', () => {
      tree.delete('package.json');

      expect(manager.getCatalogDefinitions(tree)).toBe(null);
    });

    it('should return null when package.json has no catalog fields', () => {
      writeJson(tree, 'package.json', { dependencies: { lodash: '^4.17.21' } });

      expect(manager.getCatalogDefinitions(tree)).toBe(null);
    });

    it('should parse top-level catalog and catalogs fields', () => {
      writeJson(tree, 'package.json', {
        name: 'root',
        workspaces: ['packages/*'],
        catalog: { react: '^18.0.0', lodash: '^4.17.21' },
        catalogs: {
          web: { react: '^18.0.0', 'react-dom': '^18.0.0' },
          legacy: { react: '^17.0.0' },
        },
      });

      expect(manager.getCatalogDefinitions(tree)).toStrictEqual({
        catalog: { react: '^18.0.0', lodash: '^4.17.21' },
        catalogs: {
          web: { react: '^18.0.0', 'react-dom': '^18.0.0' },
          legacy: { react: '^17.0.0' },
        },
      });
    });

    it('should parse catalog and catalogs nested under workspaces', () => {
      writeJson(tree, 'package.json', {
        name: 'root',
        workspaces: {
          packages: ['packages/*'],
          catalog: { react: '^19.0.0' },
          catalogs: { testing: { jest: '30.0.0' } },
        },
      });

      expect(manager.getCatalogDefinitions(tree)).toStrictEqual({
        catalog: { react: '^19.0.0' },
        catalogs: { testing: { jest: '30.0.0' } },
      });
    });

    it('should ignore top-level fields when workspaces-nested catalogs exist', () => {
      // Bun's locations are all-or-nothing: any catalog field under
      // `workspaces` disables both top-level fields.
      writeJson(tree, 'package.json', {
        name: 'root',
        catalog: { react: '^18.0.0' },
        workspaces: {
          packages: ['packages/*'],
          catalog: { react: '^17.0.0' },
        },
      });

      expect(manager.getCatalogDefinitions(tree)).toStrictEqual({
        catalog: { react: '^17.0.0' },
        catalogs: undefined,
      });
    });

    it('should ignore a top-level catalog when only nested catalogs exists', () => {
      writeJson(tree, 'package.json', {
        name: 'root',
        catalog: { react: '^18.0.0' },
        workspaces: {
          packages: ['packages/*'],
          catalogs: { testing: { jest: '30.0.0' } },
        },
      });

      expect(manager.getCatalogDefinitions(tree)).toStrictEqual({
        catalog: undefined,
        catalogs: { testing: { jest: '30.0.0' } },
      });
    });

    it('should handle parsing errors gracefully', () => {
      tree.write('package.json', '{ not valid json');

      expect(manager.getCatalogDefinitions(tree)).toBe(null);
    });
  });

  describe('resolveCatalogReference', () => {
    it('should resolve default catalog reference from top-level catalog field', () => {
      writeJson(tree, 'package.json', { catalog: { react: '^18.0.0' } });

      expect(manager.resolveCatalogReference(tree, 'react', 'catalog:')).toBe(
        '^18.0.0'
      );
    });

    it('should not resolve catalog:default from the catalog field', () => {
      // "default" is an ordinary named catalog in bun, so it does not resolve
      // against the singular `catalog` field.
      writeJson(tree, 'package.json', { catalog: { react: '^18.0.0' } });

      expect(
        manager.resolveCatalogReference(tree, 'react', 'catalog:default')
      ).toBe(null);
    });

    it('should not resolve catalog: from the catalogs.default field', () => {
      // The inverse also holds: `catalog:` resolves only against the singular
      // `catalog` field, never `catalogs.default`.
      writeJson(tree, 'package.json', {
        catalogs: { default: { react: '^18.0.0' } },
      });

      expect(manager.resolveCatalogReference(tree, 'react', 'catalog:')).toBe(
        null
      );
    });

    it('should resolve catalog:default from the catalogs.default field', () => {
      writeJson(tree, 'package.json', {
        catalogs: { default: { react: '^18.0.0' } },
      });

      expect(
        manager.resolveCatalogReference(tree, 'react', 'catalog:default')
      ).toBe('^18.0.0');
    });

    it('should resolve a whitespace-only name as the default catalog', () => {
      writeJson(tree, 'package.json', { catalog: { react: '^18.0.0' } });

      expect(manager.resolveCatalogReference(tree, 'react', 'catalog:  ')).toBe(
        '^18.0.0'
      );
    });

    it('should resolve named catalog reference', () => {
      writeJson(tree, 'package.json', {
        catalogs: { legacy: { react: '^17.0.0' } },
      });

      expect(
        manager.resolveCatalogReference(tree, 'react', 'catalog:legacy')
      ).toBe('^17.0.0');
    });

    it('should resolve from a workspaces-nested catalog', () => {
      writeJson(tree, 'package.json', {
        workspaces: {
          packages: ['packages/*'],
          catalog: { vite: '6.0.0' },
        },
      });

      expect(manager.resolveCatalogReference(tree, 'vite', 'catalog:')).toBe(
        '6.0.0'
      );
    });

    it('should return null for non-catalog references', () => {
      expect(manager.resolveCatalogReference(tree, 'react', '^18.0.0')).toBe(
        null
      );
    });

    it('should return null for missing catalog', () => {
      expect(
        manager.resolveCatalogReference(tree, 'react', 'catalog:nonexistent')
      ).toBe(null);
    });

    it('should return null for missing package in catalog', () => {
      writeJson(tree, 'package.json', { catalog: { react: '^18.0.0' } });

      expect(
        manager.resolveCatalogReference(tree, 'nonexistent', 'catalog:')
      ).toBe(null);
    });
  });

  describe('getCatalogReferencesForPackage', () => {
    it('should return catalog:default for a package in catalogs.default', () => {
      // Unlike pnpm, `catalogs.default` is an ordinary named catalog in bun.
      writeJson(tree, 'package.json', {
        catalogs: { default: { react: '^18.0.0' } },
      });

      expect(
        manager.getCatalogReferencesForPackage(tree, 'react')
      ).toStrictEqual([
        { catalogRef: 'catalog:default', versionSpec: '^18.0.0' },
      ]);
    });

    it('should return default and named references for a package in both', () => {
      writeJson(tree, 'package.json', {
        catalog: { react: '^18.0.0' },
        catalogs: { legacy: { react: '^17.0.0' } },
      });

      expect(
        manager.getCatalogReferencesForPackage(tree, 'react')
      ).toStrictEqual([
        { catalogRef: 'catalog:', versionSpec: '^18.0.0' },
        { catalogRef: 'catalog:legacy', versionSpec: '^17.0.0' },
      ]);
    });

    it('should return an empty array when the package is not catalogued', () => {
      writeJson(tree, 'package.json', { catalog: { react: '^18.0.0' } });

      expect(
        manager.getCatalogReferencesForPackage(tree, 'lodash')
      ).toStrictEqual([]);
    });
  });

  describe('validateCatalogReference', () => {
    it('should throw for non-catalog syntax', () => {
      expect(() =>
        manager.validateCatalogReference(tree, 'react', '^18.0.0')
      ).toThrow(
        'Invalid catalog reference syntax: "^18.0.0". Expected format: "catalog:" or "catalog:name"'
      );
    });

    it('should throw when no catalog definitions exist', () => {
      writeJson(tree, 'package.json', {});

      expect(() =>
        manager.validateCatalogReference(tree, 'react', 'catalog:')
      ).toThrow(
        'Cannot get Bun catalog definitions. No catalog defined in package.json.'
      );
    });

    it('should allow catalog and catalogs.default to coexist', () => {
      // Unlike pnpm, bun does not treat this as a duplicate default: the two
      // are addressed independently via "catalog:" and "catalog:default".
      writeJson(tree, 'package.json', {
        catalog: { react: '^18.0.0' },
        catalogs: { default: { lodash: '^4.17.21' } },
      });

      expect(() =>
        manager.validateCatalogReference(tree, 'react', 'catalog:')
      ).not.toThrow();
      expect(() =>
        manager.validateCatalogReference(tree, 'lodash', 'catalog:default')
      ).not.toThrow();
    });

    it('should throw when default catalog not found', () => {
      writeJson(tree, 'package.json', {
        catalogs: { web: { react: '^18.0.0' } },
      });

      expect(() =>
        manager.validateCatalogReference(tree, 'react', 'catalog:')
      ).toThrow('No default catalog defined in package.json');
    });

    it('should throw when named catalog not found', () => {
      writeJson(tree, 'package.json', { catalog: { react: '^18.0.0' } });

      expect(() =>
        manager.validateCatalogReference(tree, 'react', 'catalog:non-existent')
      ).toThrow('Catalog "non-existent" not found in package.json');
    });

    it('should throw for a missing package in catalog', () => {
      writeJson(tree, 'package.json', { catalog: { react: '^18.0.0' } });

      expect(() =>
        manager.validateCatalogReference(tree, 'lodash', 'catalog:')
      ).toThrow('Package "lodash" not found in default catalog ("catalog")');
    });

    it('should not throw for an existing catalog entry', () => {
      writeJson(tree, 'package.json', { catalog: { react: '^18.0.0' } });

      expect(() =>
        manager.validateCatalogReference(tree, 'react', 'catalog:')
      ).not.toThrow();
    });

    it('should validate a workspaces-nested named catalog entry', () => {
      writeJson(tree, 'package.json', {
        workspaces: {
          packages: ['packages/*'],
          catalogs: { testing: { jest: '30.0.0' } },
        },
      });

      expect(() =>
        manager.validateCatalogReference(tree, 'jest', 'catalog:testing')
      ).not.toThrow();
    });
  });

  describe('updateCatalogVersions', () => {
    it('should update an existing top-level catalog entry', () => {
      writeJson(tree, 'package.json', {
        catalog: { react: '^18.0.0', lodash: '^4.17.21' },
      });

      manager.updateCatalogVersions(tree, [
        { packageName: 'react', version: '^18.3.0' },
      ]);

      const result = readJson(tree, 'package.json');
      expect(result.catalog.react).toBe('^18.3.0');
      expect(result.catalog.lodash).toBe('^4.17.21');
    });

    it('should update a catalogs.default entry via its literal name', () => {
      // `catalogs.default` is an ordinary named catalog in bun, addressed by
      // catalogName "default" — a default (unnamed) update goes to `catalog`.
      writeJson(tree, 'package.json', {
        catalogs: { default: { react: '^18.0.0' } },
      });

      manager.updateCatalogVersions(tree, [
        { packageName: 'react', version: '^18.3.0', catalogName: 'default' },
      ]);

      const result = readJson(tree, 'package.json');
      expect(result.catalogs.default.react).toBe('^18.3.0');
    });

    it('should create a top-level catalog field when none exists', () => {
      writeJson(tree, 'package.json', {
        name: 'root',
        workspaces: ['packages/*'],
      });

      manager.updateCatalogVersions(tree, [
        { packageName: 'react', version: '^18.0.0' },
      ]);

      const result = readJson(tree, 'package.json');
      expect(result.catalog.react).toBe('^18.0.0');
      expect(result.catalogs).toBeUndefined();
    });

    it('should update a named catalog', () => {
      writeJson(tree, 'package.json', {
        catalogs: { web: { react: '^18.0.0', 'react-dom': '^18.0.0' } },
      });

      manager.updateCatalogVersions(tree, [
        { packageName: 'react', version: '^18.3.0', catalogName: 'web' },
      ]);

      const result = readJson(tree, 'package.json');
      expect(result.catalogs.web.react).toBe('^18.3.0');
      expect(result.catalogs.web['react-dom']).toBe('^18.0.0');
    });

    it('should update a workspaces-nested catalog in place', () => {
      writeJson(tree, 'package.json', {
        workspaces: {
          packages: ['packages/*'],
          catalog: { vite: '6.0.0' },
        },
      });

      manager.updateCatalogVersions(tree, [
        { packageName: 'vite', version: '6.1.0' },
      ]);

      const result = readJson(tree, 'package.json');
      expect(result.workspaces.catalog.vite).toBe('6.1.0');
      expect(result.catalog).toBeUndefined();
    });

    it('should create a named catalog in the nested location when it is active', () => {
      // With any catalog field under `workspaces`, bun ignores the top-level
      // fields, so a new named catalog must be created inside `workspaces`
      // where bun will actually read it.
      writeJson(tree, 'package.json', {
        workspaces: {
          packages: ['packages/*'],
          catalog: { vite: '6.0.0' },
        },
      });

      manager.updateCatalogVersions(tree, [
        { packageName: 'jest', version: '30.0.0', catalogName: 'testing' },
      ]);

      const result = readJson(tree, 'package.json');
      expect(result.workspaces.catalogs.testing.jest).toBe('30.0.0');
      expect(result.catalogs).toBeUndefined();
    });

    it('should add a new package to an existing catalog', () => {
      writeJson(tree, 'package.json', { catalog: { react: '^18.0.0' } });

      manager.updateCatalogVersions(tree, [
        { packageName: 'lodash', version: '^4.17.21' },
      ]);

      const result = readJson(tree, 'package.json');
      expect(result.catalog.react).toBe('^18.0.0');
      expect(result.catalog.lodash).toBe('^4.17.21');
    });

    it('should handle multiple updates at once', () => {
      writeJson(tree, 'package.json', {
        catalog: { react: '^18.0.0' },
        catalogs: { legacy: { react: '^17.0.0' } },
      });

      manager.updateCatalogVersions(tree, [
        { packageName: 'react', version: '^18.3.0' },
        { packageName: 'react', version: '^17.0.2', catalogName: 'legacy' },
      ]);

      const result = readJson(tree, 'package.json');
      expect(result.catalog.react).toBe('^18.3.0');
      expect(result.catalogs.legacy.react).toBe('^17.0.2');
    });

    it('should preserve other package.json fields and formatting', () => {
      tree.write(
        'package.json',
        `{
  "name": "root",
  "private": true,
  "workspaces": ["packages/*"],
  "catalog": {
    "react": "^18.0.0"
  }
}
`
      );

      manager.updateCatalogVersions(tree, [
        { packageName: 'react', version: '^18.3.0' },
      ]);

      expect(tree.read('package.json', 'utf-8')).toBe(
        `{
  "name": "root",
  "private": true,
  "workspaces": ["packages/*"],
  "catalog": {
    "react": "^18.3.0"
  }
}
`
      );
    });

    it('should be a no-op when the target version already matches', () => {
      const original = `{
  "catalog": {
    "react": "^18.0.0"
  }
}
`;
      tree.write('package.json', original);

      manager.updateCatalogVersions(tree, [
        { packageName: 'react', version: '^18.0.0' },
      ]);

      expect(tree.read('package.json', 'utf-8')).toBe(original);
    });

    it('should replace a null catalog placeholder with a populated map', () => {
      writeJson(tree, 'package.json', { catalog: null });

      manager.updateCatalogVersions(tree, [
        { packageName: 'react', version: '^18.3.0' },
      ]);

      const result = readJson(tree, 'package.json');
      expect(result.catalog.react).toBe('^18.3.0');
    });

    it('should route a default update to catalog even when catalogs.default exists', () => {
      // The default catalog is only the `catalog` field in bun, so an unnamed
      // update must not be redirected into the `catalogs.default` named
      // catalog.
      writeJson(tree, 'package.json', {
        catalog: null,
        catalogs: { default: { react: '^18.0.0' } },
      });

      manager.updateCatalogVersions(tree, [
        { packageName: 'react', version: '^18.3.0' },
      ]);

      const result = readJson(tree, 'package.json');
      expect(result.catalog.react).toBe('^18.3.0');
      expect(result.catalogs.default.react).toBe('^18.0.0');
    });

    it('should replace a null named catalog placeholder', () => {
      writeJson(tree, 'package.json', { catalogs: { legacy: null } });

      manager.updateCatalogVersions(tree, [
        { packageName: 'react', version: '^17.0.2', catalogName: 'legacy' },
      ]);

      const result = readJson(tree, 'package.json');
      expect(result.catalogs.legacy.react).toBe('^17.0.2');
    });

    it('should create a named catalog when catalogs is absent', () => {
      writeJson(tree, 'package.json', { name: 'root' });

      manager.updateCatalogVersions(tree, [
        { packageName: 'react', version: '^17.0.2', catalogName: 'legacy' },
      ]);

      const result = readJson(tree, 'package.json');
      expect(result.catalogs.legacy.react).toBe('^17.0.2');
    });

    it('should throw on a malformed package.json', () => {
      tree.write('package.json', '{ not valid json');

      expect(() =>
        manager.updateCatalogVersions(tree, [
          { packageName: 'react', version: '^18.3.0' },
        ])
      ).toThrow();
    });
  });
});
