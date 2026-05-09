import {
  addProjectConfiguration,
  readNxJson,
  readProjectConfiguration,
  type Tree,
  updateNxJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migrateNgrxGeneratorDefaults from './migrate-ngrx-generator-defaults';

describe('migrate-ngrx-generator-defaults', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should be a no-op when no @nx/angular:ngrx defaults are set', async () => {
    const before = readNxJson(tree);

    await migrateNgrxGeneratorDefaults(tree);

    expect(readNxJson(tree)).toEqual(before);
  });

  it('should be a no-op when nx.json has no generators field', async () => {
    updateNxJson(tree, { ...readNxJson(tree), generators: undefined });

    await migrateNgrxGeneratorDefaults(tree);

    const nxJson = readNxJson(tree);
    expect(nxJson.generators).toBeUndefined();
  });

  it('should split flat defaults across the two new generator keys', async () => {
    updateNxJson(tree, {
      ...readNxJson(tree),
      generators: {
        '@nx/angular:ngrx': { facade: true, minimal: false, barrels: true },
      },
    });

    await migrateNgrxGeneratorDefaults(tree);

    const generators = readNxJson(tree).generators!;
    expect(generators['@nx/angular:ngrx']).toBeUndefined();
    // `minimal` only goes to root-store: in the old generator it was a no-op
    // for feature usage, but ngrx-feature-store treats it as skip-templates.
    expect(generators['@nx/angular:ngrx-root-store']).toEqual({
      facade: true,
      minimal: false,
    });
    expect(generators['@nx/angular:ngrx-feature-store']).toEqual({
      facade: true,
      barrels: true,
    });
  });

  it('should not propagate `minimal` to the feature-store key', async () => {
    updateNxJson(tree, {
      ...readNxJson(tree),
      generators: {
        '@nx/angular:ngrx': { minimal: true, facade: true },
      },
    });

    await migrateNgrxGeneratorDefaults(tree);

    const generators = readNxJson(tree).generators!;
    expect(generators['@nx/angular:ngrx-root-store']).toEqual({
      minimal: true,
      facade: true,
    });
    // `minimal: true` would skip template generation while still wiring imports,
    // producing broken modules. Drop it from the feature-store defaults.
    expect(generators['@nx/angular:ngrx-feature-store']).toEqual({
      facade: true,
    });
  });

  it('should merge nested and flat shapes when both are present', async () => {
    updateNxJson(tree, {
      ...readNxJson(tree),
      generators: {
        '@nx/angular': {
          ngrx: { facade: false, barrels: true, directory: '+ngrx' },
        },
        // Flat overrides nested at runtime, so `facade: true` wins;
        // `barrels` and `directory` survive from the nested shape.
        '@nx/angular:ngrx': { facade: true },
      },
    });

    await migrateNgrxGeneratorDefaults(tree);

    const generators = readNxJson(tree).generators!;
    expect(generators['@nx/angular:ngrx']).toBeUndefined();
    expect(generators['@nx/angular']?.ngrx).toBeUndefined();
    // Output uses the flat shape because it's the dominant runtime shape.
    expect(generators['@nx/angular:ngrx-root-store']).toEqual({
      facade: true,
      directory: '+ngrx',
    });
    expect(generators['@nx/angular:ngrx-feature-store']).toEqual({
      facade: true,
      directory: '+ngrx',
      barrels: true,
    });
  });

  it('should preserve nested format when defaults are nested', async () => {
    updateNxJson(tree, {
      ...readNxJson(tree),
      generators: {
        '@nx/angular': {
          ngrx: { facade: true, barrels: true },
          component: { changeDetection: 'OnPush' },
        },
      },
    });

    await migrateNgrxGeneratorDefaults(tree);

    const generators = readNxJson(tree).generators!;
    expect(generators['@nx/angular'].ngrx).toBeUndefined();
    expect(generators['@nx/angular']['ngrx-root-store']).toEqual({
      facade: true,
    });
    expect(generators['@nx/angular']['ngrx-feature-store']).toEqual({
      facade: true,
      barrels: true,
    });
    // Sibling generator defaults under the same collection are untouched.
    expect(generators['@nx/angular'].component).toEqual({
      changeDetection: 'OnPush',
    });
  });

  it('should rename the deprecated `module` option to `parent` on the feature key', async () => {
    updateNxJson(tree, {
      ...readNxJson(tree),
      generators: {
        '@nx/angular:ngrx': {
          module: 'libs/my-lib/src/lib/my-lib-module.ts',
          facade: true,
        },
      },
    });

    await migrateNgrxGeneratorDefaults(tree);

    const generators = readNxJson(tree).generators!;
    expect(generators['@nx/angular:ngrx-feature-store']).toEqual({
      parent: 'libs/my-lib/src/lib/my-lib-module.ts',
      facade: true,
    });
    // Root store doesn't accept `parent`/`module` (it derives from `project`).
    expect(generators['@nx/angular:ngrx-root-store']).toEqual({ facade: true });
  });

  it('should let `module` win over `parent` when both are set (matching old runtime)', async () => {
    updateNxJson(tree, {
      ...readNxJson(tree),
      generators: {
        '@nx/angular:ngrx': {
          module: 'libs/my-lib/src/lib/my-lib-module.ts',
          parent: 'libs/other/src/lib/other-module.ts',
        },
      },
    });

    await migrateNgrxGeneratorDefaults(tree);

    const generators = readNxJson(tree).generators!;
    // Old generator resolved `options.module ?? options.parent` — module won.
    expect(generators['@nx/angular:ngrx-feature-store']).toEqual({
      parent: 'libs/my-lib/src/lib/my-lib-module.ts',
    });
  });

  it('should write to the nested replacement shape when the user already uses it', async () => {
    updateNxJson(tree, {
      ...readNxJson(tree),
      generators: {
        // Old defaults are flat...
        '@nx/angular:ngrx': { facade: true, barrels: true },
        // ...but the user already configured the replacement in nested form.
        '@nx/angular': {
          'ngrx-root-store': { facade: false },
        },
      },
    });

    await migrateNgrxGeneratorDefaults(tree);

    const generators = readNxJson(tree).generators!;
    // Migrated values land under the nested shape so the user's `facade: false`
    // isn't overridden by a competing flat replacement key at runtime.
    expect(generators['@nx/angular:ngrx-root-store']).toBeUndefined();
    expect(generators['@nx/angular']['ngrx-root-store']).toEqual({
      facade: false,
    });
    // Feature store didn't have an existing replacement entry, so it falls
    // back to the input shape (flat).
    expect(generators['@nx/angular:ngrx-feature-store']).toEqual({
      facade: true,
      barrels: true,
    });
  });

  it('should drop the obsolete `root` toggle and not write empty defaults', async () => {
    updateNxJson(tree, {
      ...readNxJson(tree),
      generators: {
        '@nx/angular:ngrx': { root: true },
      },
    });

    await migrateNgrxGeneratorDefaults(tree);

    const generators = readNxJson(tree).generators!;
    expect(generators['@nx/angular:ngrx']).toBeUndefined();
    expect(generators['@nx/angular:ngrx-root-store']).toBeUndefined();
    expect(generators['@nx/angular:ngrx-feature-store']).toBeUndefined();
  });

  it('should not overwrite existing defaults under the new generator keys', async () => {
    updateNxJson(tree, {
      ...readNxJson(tree),
      generators: {
        '@nx/angular:ngrx': { facade: true, minimal: false },
        '@nx/angular:ngrx-root-store': { facade: false },
      },
    });

    await migrateNgrxGeneratorDefaults(tree);

    const generators = readNxJson(tree).generators!;
    // User-set `facade` wins; `minimal` is filled in from the migration.
    expect(generators['@nx/angular:ngrx-root-store']).toEqual({
      facade: false,
      minimal: false,
    });
  });

  it('should remove an empty collection bucket after deleting nested defaults', async () => {
    updateNxJson(tree, {
      ...readNxJson(tree),
      generators: {
        '@nx/angular': { ngrx: { facade: true } },
      },
    });

    await migrateNgrxGeneratorDefaults(tree);

    const generators = readNxJson(tree).generators!;
    // The collection bucket gets the new keys, so it should still exist.
    expect(generators['@nx/angular']).toBeDefined();
    expect(generators['@nx/angular'].ngrx).toBeUndefined();
    expect(generators['@nx/angular']['ngrx-root-store']).toEqual({
      facade: true,
    });
  });

  it('should clean up the collection bucket when no other siblings remain (edge: empty new defaults)', async () => {
    updateNxJson(tree, {
      ...readNxJson(tree),
      generators: {
        '@nx/angular': { ngrx: { root: true } },
      },
    });

    await migrateNgrxGeneratorDefaults(tree);

    const generators = readNxJson(tree).generators!;
    // Only the obsolete `root` toggle was set; nothing migrated; collection bucket emptied and removed.
    expect(generators['@nx/angular']).toBeUndefined();
  });

  it('should migrate generator defaults set in project.json', async () => {
    addProjectConfiguration(tree, 'my-app', {
      root: 'apps/my-app',
      generators: {
        '@nx/angular:ngrx': {
          facade: true,
          minimal: false,
          barrels: true,
          module: 'apps/my-app/src/app/app-module.ts',
        },
      },
    });

    await migrateNgrxGeneratorDefaults(tree);

    const generators = readProjectConfiguration(tree, 'my-app').generators!;
    expect(generators['@nx/angular:ngrx']).toBeUndefined();
    expect(generators['@nx/angular:ngrx-root-store']).toEqual({
      facade: true,
      minimal: false,
    });
    expect(generators['@nx/angular:ngrx-feature-store']).toEqual({
      facade: true,
      barrels: true,
      parent: 'apps/my-app/src/app/app-module.ts',
    });
  });

  it('should migrate nested generator defaults set in project.json', async () => {
    addProjectConfiguration(tree, 'my-lib', {
      root: 'libs/my-lib',
      generators: {
        '@nx/angular': {
          ngrx: { facade: true, barrels: true },
          component: { changeDetection: 'OnPush' },
        },
      },
    });

    await migrateNgrxGeneratorDefaults(tree);

    const generators = readProjectConfiguration(tree, 'my-lib').generators!;
    expect(generators['@nx/angular'].ngrx).toBeUndefined();
    expect(generators['@nx/angular']['ngrx-root-store']).toEqual({
      facade: true,
    });
    expect(generators['@nx/angular']['ngrx-feature-store']).toEqual({
      facade: true,
      barrels: true,
    });
    expect(generators['@nx/angular'].component).toEqual({
      changeDetection: 'OnPush',
    });
  });

  it('should migrate defaults in nx.json and project.json independently in the same run', async () => {
    updateNxJson(tree, {
      ...readNxJson(tree),
      generators: {
        '@nx/angular:ngrx': { facade: true },
      },
    });
    addProjectConfiguration(tree, 'my-app', {
      root: 'apps/my-app',
      generators: {
        '@nx/angular:ngrx': { barrels: true },
      },
    });

    await migrateNgrxGeneratorDefaults(tree);

    const nxJsonGenerators = readNxJson(tree).generators!;
    expect(nxJsonGenerators['@nx/angular:ngrx']).toBeUndefined();
    expect(nxJsonGenerators['@nx/angular:ngrx-root-store']).toEqual({
      facade: true,
    });
    expect(nxJsonGenerators['@nx/angular:ngrx-feature-store']).toEqual({
      facade: true,
    });

    const projectGenerators = readProjectConfiguration(
      tree,
      'my-app'
    ).generators!;
    expect(projectGenerators['@nx/angular:ngrx']).toBeUndefined();
    expect(projectGenerators['@nx/angular:ngrx-root-store']).toBeUndefined();
    expect(projectGenerators['@nx/angular:ngrx-feature-store']).toEqual({
      barrels: true,
    });
  });

  it('should leave projects without ngrx defaults untouched', async () => {
    addProjectConfiguration(tree, 'my-app', {
      root: 'apps/my-app',
      generators: {
        '@nx/angular:component': { changeDetection: 'OnPush' },
      },
    });

    await migrateNgrxGeneratorDefaults(tree);

    expect(readProjectConfiguration(tree, 'my-app').generators).toEqual({
      '@nx/angular:component': { changeDetection: 'OnPush' },
    });
  });
});
