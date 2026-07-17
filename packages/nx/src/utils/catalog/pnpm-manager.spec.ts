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

    it('should handle an empty catalog block (null scalar)', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `packages:
  - 'apps/*'
catalog:
`
      );

      manager.updateCatalogVersions(tree, [
        { packageName: 'react', version: '^18.3.0' },
      ]);

      const content = tree.read('pnpm-workspace.yaml', 'utf-8');
      const result = load(content);
      expect(result.catalog.react).toBe('^18.3.0');
    });

    it('should handle a catalog block containing only comments', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `catalog:
  # TODO: pin react when stable
`
      );

      manager.updateCatalogVersions(tree, [
        { packageName: 'react', version: '^18.3.0' },
      ]);

      const content = tree.read('pnpm-workspace.yaml', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "catalog:
          react: ^18.3.0
          # TODO: pin react when stable
        "
      `);
    });

    it('should handle an empty named catalog (null scalar)', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `catalogs:
  legacy:
`
      );

      manager.updateCatalogVersions(tree, [
        { packageName: 'react', version: '^17.0.2', catalogName: 'legacy' },
      ]);

      const content = tree.read('pnpm-workspace.yaml', 'utf-8');
      const result = load(content);
      expect(result.catalogs.legacy.react).toBe('^17.0.2');
    });

    it('should write through catalogs.default when catalog is an empty placeholder', () => {
      // Regression: with both keys present and `catalog:` as a null
      // placeholder, the update must go to the populated catalogs.default
      // and not seed a new top-level `catalog`, which would produce a
      // duplicate-default config rejected by validateCatalogReference.
      tree.write(
        'pnpm-workspace.yaml',
        `catalog:
catalogs:
  default:
    react: ^18.0.0
`
      );

      manager.updateCatalogVersions(tree, [
        { packageName: 'react', version: '^18.3.0' },
      ]);

      const content = tree.read('pnpm-workspace.yaml', 'utf-8');
      const result = load(content);
      expect(result.catalogs.default.react).toBe('^18.3.0');
      // The empty `catalog:` placeholder should remain empty, not be
      // populated with a duplicate entry.
      expect(result.catalog).toBeNull();
    });

    it('should handle an empty catalogs.default block', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `catalogs:
  default:
`
      );

      manager.updateCatalogVersions(tree, [
        { packageName: 'react', version: '^18.3.0' },
      ]);

      const content = tree.read('pnpm-workspace.yaml', 'utf-8');
      const result = load(content);
      // Should write through the existing catalogs.default skeleton rather
      // than creating a new shorthand `catalog:` key.
      expect(result.catalogs.default.react).toBe('^18.3.0');
      expect(result.catalog).toBeUndefined();
    });

    it('should update through a YAML alias pointing at an anchored map', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `_defaults: &defaults
  react: ^18.0.0
  lodash: ^4.17.20
catalog: *defaults
`
      );

      manager.updateCatalogVersions(tree, [
        { packageName: 'react', version: '^18.3.0' },
      ]);

      const content = tree.read('pnpm-workspace.yaml', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "_defaults: &defaults
          react: ^18.3.0
          lodash: ^4.17.20
        catalog: *defaults
        "
      `);
      const result = load(content);
      expect(result.catalog.react).toBe('^18.3.0');
      expect(result.catalog.lodash).toBe('^4.17.20');
    });

    it('should update through a YAML alias on a named catalog', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `_legacy: &legacy
  react: ^17.0.0
catalogs:
  legacy: *legacy
`
      );

      manager.updateCatalogVersions(tree, [
        { packageName: 'react', version: '^17.0.2', catalogName: 'legacy' },
      ]);

      const content = tree.read('pnpm-workspace.yaml', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "_legacy: &legacy
          react: ^17.0.2
        catalogs:
          legacy: *legacy
        "
      `);
      const result = load(content);
      expect(result.catalogs.legacy.react).toBe('^17.0.2');
    });

    it('should update through an alias on the catalogs key itself', () => {
      // Regression: when `catalogs:` is itself an alias to an anchored map
      // containing `default`, the router must follow the alias to find the
      // existing default rather than fall through and create a duplicate
      // top-level `catalog`.
      tree.write(
        'pnpm-workspace.yaml',
        `_cats: &cats
  default:
    react: ^18.0.0
catalogs: *cats
`
      );

      manager.updateCatalogVersions(tree, [
        { packageName: 'react', version: '^18.3.0' },
      ]);

      const content = tree.read('pnpm-workspace.yaml', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "_cats: &cats
          default:
            react: ^18.3.0
        catalogs: *cats
        "
      `);
      const result = load(content);
      expect(result.catalogs.default.react).toBe('^18.3.0');
      expect(result.catalog).toBeUndefined();
    });

    it('should create a missing named catalog inside an aliased catalogs map', () => {
      // Regression: when `catalogs:` is an alias to an empty anchored map,
      // adding a named catalog must create it inside the anchored target
      // rather than calling doc.setIn through the alias (which throws).
      tree.write(
        'pnpm-workspace.yaml',
        `_cats: &cats {}
catalogs: *cats
`
      );

      manager.updateCatalogVersions(tree, [
        { packageName: 'react', version: '^17.0.2', catalogName: 'legacy' },
      ]);

      const content = tree.read('pnpm-workspace.yaml', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "_cats: &cats { legacy: { react: ^17.0.2 } }
        catalogs: *cats
        "
      `);
      const result = load(content);
      expect(result.catalogs.legacy.react).toBe('^17.0.2');
    });

    it('should update a null placeholder inside an aliased catalogs map', () => {
      // Regression: a null named-catalog placeholder living inside an
      // aliased catalogs map must be turned into a populated map without
      // falling back to doc.setIn (which doesn't traverse the alias).
      tree.write(
        'pnpm-workspace.yaml',
        `_cats: &cats
  legacy:
catalogs: *cats
`
      );

      manager.updateCatalogVersions(tree, [
        { packageName: 'react', version: '^17.0.2', catalogName: 'legacy' },
      ]);

      const content = tree.read('pnpm-workspace.yaml', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "_cats: &cats
          legacy:
            react: ^17.0.2
        catalogs: *cats
        "
      `);
      const result = load(content);
      expect(result.catalogs.legacy.react).toBe('^17.0.2');
    });

    it('should update an anchored null default catalog placeholder', () => {
      // Regression: replacing an anchored `catalog:` placeholder with a map
      // must keep the anchor, otherwise an alias referencing it (`*cat`)
      // becomes unresolved and String(doc) throws.
      tree.write(
        'pnpm-workspace.yaml',
        `catalog: &cat
mirror: *cat
`
      );

      manager.updateCatalogVersions(tree, [
        { packageName: 'react', version: '^18.3.0' },
      ]);

      const content = tree.read('pnpm-workspace.yaml', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "catalog: &cat
          react: ^18.3.0
        mirror: *cat
        "
      `);
      const result = load(content);
      expect(result.catalog.react).toBe('^18.3.0');
      // the alias now resolves to the populated catalog map
      expect(result.mirror.react).toBe('^18.3.0');
    });

    it('should update an anchored null named catalog placeholder', () => {
      // Regression: same anchor preservation for a named-catalog placeholder.
      tree.write(
        'pnpm-workspace.yaml',
        `catalogs:
  legacy: &legacy
mirror: *legacy
`
      );

      manager.updateCatalogVersions(tree, [
        { packageName: 'react', version: '^17.0.2', catalogName: 'legacy' },
      ]);

      const content = tree.read('pnpm-workspace.yaml', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "catalogs:
          legacy: &legacy
            react: ^17.0.2
        mirror: *legacy
        "
      `);
      const result = load(content);
      expect(result.catalogs.legacy.react).toBe('^17.0.2');
      expect(result.mirror.react).toBe('^17.0.2');
    });

    it('should sever a default catalog aliased to a separate null anchor', () => {
      // `catalog` aliases a separate anchor, so the update converts it into an
      // owned map; the `!nextWasAlias` guard intentionally leaves the anchor on
      // its definition (copying it here would duplicate the anchor).
      tree.write(
        'pnpm-workspace.yaml',
        `_legacy: &legacy
catalog: *legacy
`
      );

      manager.updateCatalogVersions(tree, [
        { packageName: 'react', version: '^18.3.0' },
      ]);

      const content = tree.read('pnpm-workspace.yaml', 'utf-8');
      const result = load(content);
      expect(result.catalog.react).toBe('^18.3.0');
      // the anchor definition is untouched and no longer shared
      expect(result._legacy).toBeNull();
    });

    it('should create a default catalog in an empty file', () => {
      tree.write('pnpm-workspace.yaml', '');

      manager.updateCatalogVersions(tree, [
        { packageName: 'react', version: '^18.3.0' },
      ]);

      const content = tree.read('pnpm-workspace.yaml', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "catalog:
          react: ^18.3.0
        "
      `);
      const result = load(content);
      expect(result.catalog.react).toBe('^18.3.0');
    });

    it('should create a named catalog when catalogs is absent', () => {
      // Exercises multi-level fresh-map creation: neither `catalogs` nor the
      // named catalog exists yet, so both maps are seeded before the entry.
      tree.write(
        'pnpm-workspace.yaml',
        `packages:
  - 'packages/*'
`
      );

      manager.updateCatalogVersions(tree, [
        { packageName: 'react', version: '^17.0.2', catalogName: 'legacy' },
      ]);

      const content = tree.read('pnpm-workspace.yaml', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "packages:
          - 'packages/*'
        catalogs:
          legacy:
            react: ^17.0.2
        "
      `);
      const result = load(content);
      expect(result.catalogs.legacy.react).toBe('^17.0.2');
    });

    it('should override a merge-keyed catalog entry with an own key', () => {
      // A `<<:` merge isn't resolved by change detection, so the bump appends an
      // own key. pnpm resolves the own key over the merge, so the effective
      // version is correct and the anchored merge source is left untouched.
      tree.write(
        'pnpm-workspace.yaml',
        `_base: &base
  react: ^18.0.0
catalog:
  <<: *base
  lodash: ^4.0.0
`
      );

      manager.updateCatalogVersions(tree, [
        { packageName: 'react', version: '^18.3.0' },
      ]);

      const content = tree.read('pnpm-workspace.yaml', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "_base: &base
          react: ^18.0.0
        catalog:
          <<: *base
          lodash: ^4.0.0
          react: ^18.3.0
        "
      `);
      const result = load(content);
      expect(result.catalog.react).toBe('^18.3.0');
      expect(result._base.react).toBe('^18.0.0');
    });

    it('should surface a YAML parse error with location detail on malformed input', () => {
      // parseDocument records errors instead of throwing; the update must still
      // fail loudly with the line/column detail the old load() surfaced.
      tree.write(
        'pnpm-workspace.yaml',
        `catalog:
  react: ^18.0.0
  react: ^19.0.0
`
      );

      expect(() =>
        manager.updateCatalogVersions(tree, [
          { packageName: 'react', version: '^18.3.0' },
        ])
      ).toThrow('Map keys must be unique at line 3, column 3');
    });

    it('should surface an unresolved alias with location detail', () => {
      // A dangling alias is not a syntax error, so parseDocument keeps
      // doc.errors empty; the update must still fail loudly instead of
      // silently overwriting the broken reference.
      tree.write(
        'pnpm-workspace.yaml',
        `catalog:
  react: *missing
`
      );

      expect(() =>
        manager.updateCatalogVersions(tree, [
          { packageName: 'react', version: '^18.3.0' },
        ])
      ).toThrow('Unresolved alias "missing" at line 2');
    });

    it('should be a no-op when the aliased catalog already has the target version', () => {
      // Regression: the change-detection check must traverse aliases,
      // otherwise an identical write fires every time on aliased paths.
      const original = `_defaults: &defaults
  react: ^18.0.0
catalog: *defaults
`;
      tree.write('pnpm-workspace.yaml', original);

      manager.updateCatalogVersions(tree, [
        { packageName: 'react', version: '^18.0.0' },
      ]);

      const content = tree.read('pnpm-workspace.yaml', 'utf-8');
      expect(content).toBe(original);
    });

    it('should preserve comments across catalog updates', () => {
      tree.write(
        'pnpm-workspace.yaml',
        `# Workspace configuration
# See https://pnpm.io/pnpm-workspace_yaml

packages:
  # All applications
  - 'apps/*'
  # Shared libraries
  - 'libs/*'

# Default catalog
catalog:
  # Pinned: do not bump without testing
  react: ^18.0.0
  # Bumped after CVE
  axios: ^1.7.4

catalogs:
  # Legacy React 17 versions
  legacy:
    react: ^17.0.0
    react-dom: ^17.0.0
`
      );

      manager.updateCatalogVersions(tree, [
        { packageName: 'react', version: '^18.3.0' },
        { packageName: 'react', version: '^17.0.2', catalogName: 'legacy' },
        { packageName: 'lodash', version: '^4.17.21' },
      ]);

      const content = tree.read('pnpm-workspace.yaml', 'utf-8');
      expect(content).toMatchInlineSnapshot(`
        "# Workspace configuration
        # See https://pnpm.io/pnpm-workspace_yaml

        packages:
          # All applications
          - 'apps/*'
          # Shared libraries
          - 'libs/*'

        # Default catalog
        catalog:
          # Pinned: do not bump without testing
          react: ^18.3.0
          # Bumped after CVE
          axios: ^1.7.4
          lodash: ^4.17.21

        catalogs:
          # Legacy React 17 versions
          legacy:
            react: ^17.0.2
            react-dom: ^17.0.0
        "
      `);
    });
  });
});
