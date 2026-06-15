import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  addProjectConfiguration,
  readNxJson,
  updateNxJson,
  type NxJsonConfiguration,
  type TargetDefaultsRecord,
  type Tree,
} from '@nx/devkit';
import { normalizeTargetDefaults } from '@nx/devkit/internal';
import ensureDependsOnForMf from './ensure-depends-on-for-mf';

const WEBPACK_EXECUTOR = '@nx/angular:webpack-browser';
const NX_MF_DEV_REMOTES = { env: 'NX_MF_DEV_REMOTES' };

// `nxJson.targetDefaults` is typed as the array form post-v23, but the
// fixtures here exercise the legacy record shape too. Cast through this
// helper rather than spread `as any` everywhere.
type LegacyNxJson = Omit<NxJsonConfiguration, 'targetDefaults'> & {
  targetDefaults?: TargetDefaultsRecord;
};

describe('ensure-depends-on-for-mf', () => {
  describe('record-shape input', () => {
    it('adds dependsOn ^build and the dev-remotes env input when the entry already exists', async () => {
      const tree = createTreeWithEmptyWorkspace();
      const nxJson = readNxJson(tree) as LegacyNxJson;
      nxJson.targetDefaults ??= {};
      nxJson.targetDefaults[WEBPACK_EXECUTOR] = {
        inputs: ['production', '^production'],
      };
      updateNxJson(tree, nxJson as NxJsonConfiguration);
      addProject(tree);

      await ensureDependsOnForMf(tree);

      const entry = findWebpackEntry(tree);
      expect(entry).toEqual({
        executor: WEBPACK_EXECUTOR,
        inputs: ['production', '^production', NX_MF_DEV_REMOTES],
        dependsOn: ['^build'],
      });
    });

    it('creates a fresh entry when no targetDefaults exist yet', async () => {
      const tree = createTreeWithEmptyWorkspace();
      addProject(tree);

      await ensureDependsOnForMf(tree);

      const entry = findWebpackEntry(tree);
      // No `production` namedInput on the empty workspace → falls back to default.
      expect(entry).toEqual({
        executor: WEBPACK_EXECUTOR,
        cache: true,
        inputs: ['default', '^default', NX_MF_DEV_REMOTES],
        dependsOn: ['^build'],
      });
    });

    it('appends ^build to dependsOn while preserving other existing deps', async () => {
      const tree = createTreeWithEmptyWorkspace();
      const nxJson = readNxJson(tree) as LegacyNxJson;
      nxJson.targetDefaults ??= {};
      nxJson.targetDefaults[WEBPACK_EXECUTOR] = {
        inputs: ['production', '^production'],
        dependsOn: ['some-task'],
      };
      updateNxJson(tree, nxJson as NxJsonConfiguration);
      addProject(tree);

      await ensureDependsOnForMf(tree);

      const entry = findWebpackEntry(tree);
      expect(entry?.dependsOn).toEqual(['some-task', '^build']);
      expect(entry?.inputs).toEqual([
        'production',
        '^production',
        NX_MF_DEV_REMOTES,
      ]);
    });

    it('leaves an already-correct entry alone (modulo shape upgrade)', async () => {
      const tree = createTreeWithEmptyWorkspace();
      const nxJson = readNxJson(tree) as LegacyNxJson;
      nxJson.targetDefaults ??= {};
      nxJson.targetDefaults[WEBPACK_EXECUTOR] = {
        inputs: ['production', '^production', NX_MF_DEV_REMOTES],
        dependsOn: ['^build'],
      };
      updateNxJson(tree, nxJson as NxJsonConfiguration);
      addProject(tree);

      await ensureDependsOnForMf(tree);

      const entry = findWebpackEntry(tree);
      expect(entry).toEqual({
        executor: WEBPACK_EXECUTOR,
        inputs: ['production', '^production', NX_MF_DEV_REMOTES],
        dependsOn: ['^build'],
      });
    });
  });

  describe('array-shape input', () => {
    it('adds dependsOn and dev-remotes input to an existing executor-keyed entry', async () => {
      const tree = createTreeWithEmptyWorkspace();
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = [
        {
          executor: WEBPACK_EXECUTOR,
          inputs: ['production', '^production'],
        },
      ];
      updateNxJson(tree, nxJson);
      addProject(tree);

      await ensureDependsOnForMf(tree);

      const entry = findWebpackEntry(tree);
      expect(entry).toEqual({
        executor: WEBPACK_EXECUTOR,
        inputs: ['production', '^production', NX_MF_DEV_REMOTES],
        dependsOn: ['^build'],
      });
    });

    it('does not match a target-keyed entry whose name happens to be the executor string', async () => {
      const tree = createTreeWithEmptyWorkspace();
      const nxJson = readNxJson(tree);
      // An entry with `target: '@nx/angular:webpack-browser'` is locator-by-target,
      // not locator-by-executor — it should not collide with the migration's
      // executor-keyed default. We expect a *new* executor-keyed entry to be added
      // alongside it.
      nxJson.targetDefaults = [
        {
          target: WEBPACK_EXECUTOR,
          inputs: ['legacy-input'],
        },
      ];
      updateNxJson(tree, nxJson);
      addProject(tree);

      await ensureDependsOnForMf(tree);

      const all = normalizeTargetDefaults(readNxJson(tree).targetDefaults);
      expect(all).toContainEqual({
        target: WEBPACK_EXECUTOR,
        inputs: ['legacy-input'],
      });
      expect(all).toContainEqual(
        expect.objectContaining({
          executor: WEBPACK_EXECUTOR,
          dependsOn: ['^build'],
        })
      );
    });
  });
});

function findWebpackEntry(tree: Tree) {
  const entries = normalizeTargetDefaults(readNxJson(tree).targetDefaults);
  return entries.find(
    (e) =>
      e.executor === WEBPACK_EXECUTOR &&
      e.target === undefined &&
      e.projects === undefined &&
      e.plugin === undefined
  );
}

function addProject(tree: Tree) {
  tree.write('app/webpack.config.ts', `withModuleFederation`);
  addProjectConfiguration(tree, 'app', {
    name: 'app',
    root: 'app',
    projectType: 'application',
    targets: {
      build: {
        executor: WEBPACK_EXECUTOR,
        options: { webpackConfig: 'app/webpack.config.ts' },
      },
    },
  });
}
