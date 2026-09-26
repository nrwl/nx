import {
  addProjectConfiguration,
  readNxJson,
  readProjectConfiguration,
  updateNxJson,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './add-pnpm-deploy-output-cache-inputs';

const SETTINGS_JSON_INPUT = {
  json: '{workspaceRoot}/package.json',
  fields: [
    'packageManager',
    'pnpm.onlyBuiltDependencies',
    'pnpm.neverBuiltDependencies',
    'pnpm.allowBuilds',
    'pnpm.supportedArchitectures',
    'pnpm.patchedDependencies',
  ],
};
const PNPM_MAJOR_PROBE = {
  runtime: `node -e "try{console.log('pnpm major '+require('child_process').execSync('pnpm --version',{stdio:['ignore','pipe','ignore']}).toString().trim().split('.')[0])}catch{console.log('pnpm major unavailable')}"`,
};
const SETTINGS_INPUTS = [
  '{workspaceRoot}/pnpm-workspace.yaml',
  SETTINGS_JSON_INPUT,
  PNPM_MAJOR_PROBE,
];
// What the migration writes for a target that declared no `inputs`: nx's own
// default, spelled out, plus the settings sources.
const DEPLOY_INPUTS = ['default', '^default', ...SETTINGS_INPUTS];

describe('add-pnpm-deploy-output-cache-inputs migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write('pnpm-lock.yaml', 'lockfileVersion: 9.0\n');
  });

  it('adds the settings sources to a webpack target with generatePackageJson', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {
          executor: '@nx/webpack:webpack',
          options: { generatePackageJson: true },
        },
      },
    });

    await update(tree);

    expect(readProjectConfiguration(tree, 'app1').targets.build.inputs).toEqual(
      DEPLOY_INPUTS
    );
  });

  it('adds them when the option is enabled only in a configuration', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {
          executor: '@nx/esbuild:esbuild',
          options: {},
          configurations: {
            production: { generatePackageJson: true },
          },
        },
      },
    });

    await update(tree);

    expect(readProjectConfiguration(tree, 'app1').targets.build.inputs).toEqual(
      DEPLOY_INPUTS
    );
  });

  it('adds them to generateLockfile-gated executors', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {
          executor: '@nx/next:build',
          options: { generateLockfile: true },
        },
      },
    });

    await update(tree);

    expect(readProjectConfiguration(tree, 'app1').targets.build.inputs).toEqual(
      DEPLOY_INPUTS
    );
  });

  it('leaves targets without the gating option alone', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: { executor: '@nx/webpack:webpack', options: {} },
        // generatePackageJson is not next's gate for the deploy output
        'build-next': {
          executor: '@nx/next:build',
          options: { generatePackageJson: true },
        },
      },
    });

    await update(tree);

    const targets = readProjectConfiguration(tree, 'app1').targets;
    expect(targets.build.inputs).toBeUndefined();
    expect(targets['build-next'].inputs).toBeUndefined();
  });

  it('leaves unrelated executors alone', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {
          executor: '@nx/angular:webpack-browser',
          options: { generatePackageJson: true },
        },
      },
    });

    await update(tree);

    expect(
      readProjectConfiguration(tree, 'app1').targets.build.inputs
    ).toBeUndefined();
  });

  it('does nothing in a workspace without a pnpm lockfile', async () => {
    tree.delete('pnpm-lock.yaml');
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {
          executor: '@nx/webpack:webpack',
          options: { generatePackageJson: true },
        },
      },
    });

    await update(tree);

    expect(
      readProjectConfiguration(tree, 'app1').targets.build.inputs
    ).toBeUndefined();
  });

  it("appends to the target's own inputs without spelling the default", async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {
          executor: '@nx/webpack:webpack',
          options: { generatePackageJson: true },
          inputs: ['production', '^production'],
        },
      },
    });

    await update(tree);

    expect(readProjectConfiguration(tree, 'app1').targets.build.inputs).toEqual(
      [
        'production',
        '^production',
        '{workspaceRoot}/pnpm-workspace.yaml',
        SETTINGS_JSON_INPUT,
        PNPM_MAJOR_PROBE,
      ]
    );
  });

  it('appends to the targetDefaults entry supplying the inherited inputs', async () => {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      '@nx/webpack:webpack': {
        inputs: ['production', '^production'],
      },
    };
    updateNxJson(tree, nxJson);
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {
          executor: '@nx/webpack:webpack',
          options: { generatePackageJson: true },
        },
      },
    });

    await update(tree);

    expect(
      readNxJson(tree).targetDefaults['@nx/webpack:webpack'].inputs
    ).toEqual([
      'production',
      '^production',
      '{workspaceRoot}/pnpm-workspace.yaml',
      SETTINGS_JSON_INPUT,
      PNPM_MAJOR_PROBE,
    ]);
    expect(
      readProjectConfiguration(tree, 'app1').targets.build.inputs
    ).toBeUndefined();
  });

  it('reads the gating option from a matching targetDefaults entry', async () => {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      '@nx/webpack:webpack': {
        options: { generatePackageJson: true },
      },
    };
    updateNxJson(tree, nxJson);
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: { executor: '@nx/webpack:webpack' },
      },
    });

    await update(tree);

    expect(readProjectConfiguration(tree, 'app1').targets.build.inputs).toEqual(
      DEPLOY_INPUTS
    );
  });

  it('matches a target whose executor comes from targetDefaults', async () => {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      build: {
        executor: '@nx/webpack:webpack',
        options: { generatePackageJson: true },
      },
    };
    updateNxJson(tree, nxJson);
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {},
      },
    });

    await update(tree);

    expect(readProjectConfiguration(tree, 'app1').targets.build.inputs).toEqual(
      DEPLOY_INPUTS
    );
  });

  it('never matches a command target through defaults', async () => {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      build: {
        executor: '@nx/webpack:webpack',
        options: { generatePackageJson: true },
      },
    };
    updateNxJson(tree, nxJson);
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: { command: 'webpack-cli build' },
      },
    });

    await update(tree);

    expect(
      readProjectConfiguration(tree, 'app1').targets.build.inputs
    ).toBeUndefined();
  });

  it('skips sources the target already hashes', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {
          executor: '@nx/webpack:webpack',
          options: { generatePackageJson: true },
          inputs: ['default', '{workspaceRoot}/pnpm-workspace.yaml'],
        },
      },
    });

    await update(tree);

    expect(readProjectConfiguration(tree, 'app1').targets.build.inputs).toEqual(
      [
        'default',
        '{workspaceRoot}/pnpm-workspace.yaml',
        SETTINGS_JSON_INPUT,
        PNPM_MAJOR_PROBE,
      ]
    );
  });

  it('treats a whole-file root package.json fileset as covering the settings fields', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {
          executor: '@nx/webpack:webpack',
          options: { generatePackageJson: true },
          inputs: ['default', '{workspaceRoot}/package.json'],
        },
      },
    });

    await update(tree);

    expect(readProjectConfiguration(tree, 'app1').targets.build.inputs).toEqual(
      [
        'default',
        '{workspaceRoot}/package.json',
        '{workspaceRoot}/pnpm-workspace.yaml',
        PNPM_MAJOR_PROBE,
      ]
    );
  });

  it('treats an existing json input covering the settings fields as sufficient', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {
          executor: '@nx/webpack:webpack',
          options: { generatePackageJson: true },
          inputs: ['default', { json: '{workspaceRoot}/package.json' }],
        },
      },
    });

    await update(tree);

    expect(readProjectConfiguration(tree, 'app1').targets.build.inputs).toEqual(
      [
        'default',
        { json: '{workspaceRoot}/package.json' },
        '{workspaceRoot}/pnpm-workspace.yaml',
        PNPM_MAJOR_PROBE,
      ]
    );
  });

  it('treats subtree field entries as covering their nested fields', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {
          executor: '@nx/webpack:webpack',
          options: { generatePackageJson: true },
          inputs: [
            'default',
            {
              json: '{workspaceRoot}/package.json',
              fields: ['packageManager', 'pnpm'],
            },
          ],
        },
      },
    });

    await update(tree);

    expect(readProjectConfiguration(tree, 'app1').targets.build.inputs).toEqual(
      [
        'default',
        {
          json: '{workspaceRoot}/package.json',
          fields: ['packageManager', 'pnpm'],
        },
        '{workspaceRoot}/pnpm-workspace.yaml',
        PNPM_MAJOR_PROBE,
      ]
    );
  });

  it('does not treat a manifest fileset cancelled by an exact negation as covering', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {
          executor: '@nx/webpack:webpack',
          options: { generatePackageJson: true },
          inputs: [
            'default',
            '{workspaceRoot}/package.json',
            '!{workspaceRoot}/package.json',
          ],
        },
      },
    });

    await update(tree);

    expect(readProjectConfiguration(tree, 'app1').targets.build.inputs).toEqual(
      [
        'default',
        '{workspaceRoot}/package.json',
        '!{workspaceRoot}/package.json',
        '{workspaceRoot}/pnpm-workspace.yaml',
        SETTINGS_JSON_INPUT,
        PNPM_MAJOR_PROBE,
      ]
    );
  });

  it('does not treat a manifest fileset a glob negation could cancel as covering', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {
          executor: '@nx/webpack:webpack',
          options: { generatePackageJson: true },
          inputs: [
            'default',
            '{workspaceRoot}/package.json',
            '{workspaceRoot}/pnpm-workspace.yaml',
            '!{workspaceRoot}/*.json',
          ],
        },
      },
    });

    await update(tree);

    expect(readProjectConfiguration(tree, 'app1').targets.build.inputs).toEqual(
      [
        'default',
        '{workspaceRoot}/package.json',
        '{workspaceRoot}/pnpm-workspace.yaml',
        '!{workspaceRoot}/*.json',
        SETTINGS_JSON_INPUT,
        PNPM_MAJOR_PROBE,
      ]
    );
  });

  it('does not treat a manifest fileset an extglob negation could cancel as covering', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {
          executor: '@nx/webpack:webpack',
          options: { generatePackageJson: true },
          inputs: [
            'default',
            '{workspaceRoot}/package.json',
            '{workspaceRoot}/pnpm-workspace.yaml',
            '!{workspaceRoot}/@(package|other).json',
          ],
        },
      },
    });

    await update(tree);

    expect(readProjectConfiguration(tree, 'app1').targets.build.inputs).toEqual(
      [
        'default',
        '{workspaceRoot}/package.json',
        '{workspaceRoot}/pnpm-workspace.yaml',
        '!{workspaceRoot}/@(package|other).json',
        SETTINGS_JSON_INPUT,
        PNPM_MAJOR_PROBE,
      ]
    );
  });

  it('does not treat a manifest fileset an object-form negation could cancel as covering', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {
          executor: '@nx/webpack:webpack',
          options: { generatePackageJson: true },
          inputs: [
            'default',
            '{workspaceRoot}/package.json',
            '{workspaceRoot}/pnpm-workspace.yaml',
            { fileset: '!{workspaceRoot}/package.json' },
          ],
        },
      },
    });

    await update(tree);

    expect(readProjectConfiguration(tree, 'app1').targets.build.inputs).toEqual(
      [
        'default',
        '{workspaceRoot}/package.json',
        '{workspaceRoot}/pnpm-workspace.yaml',
        { fileset: '!{workspaceRoot}/package.json' },
        SETTINGS_JSON_INPUT,
        PNPM_MAJOR_PROBE,
      ]
    );
  });

  it('does not treat a json input excluding the settings fields as covering them', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {
          executor: '@nx/webpack:webpack',
          options: { generatePackageJson: true },
          inputs: [
            'default',
            { json: '{workspaceRoot}/package.json', excludeFields: ['pnpm'] },
          ],
        },
      },
    });

    await update(tree);

    expect(readProjectConfiguration(tree, 'app1').targets.build.inputs).toEqual(
      [
        'default',
        { json: '{workspaceRoot}/package.json', excludeFields: ['pnpm'] },
        '{workspaceRoot}/pnpm-workspace.yaml',
        SETTINGS_JSON_INPUT,
        PNPM_MAJOR_PROBE,
      ]
    );
  });

  it('appends to the matching targetDefaults entry, not a later filtered one', async () => {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {
      '@nx/webpack:webpack': [
        {
          filter: { projects: ['app1'] },
          inputs: ['matching-input'],
        },
        {
          filter: { projects: ['app2'] },
          inputs: ['nonmatching-input'],
        },
      ],
    };
    updateNxJson(tree, nxJson);
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {
          executor: '@nx/webpack:webpack',
          options: { generatePackageJson: true },
        },
      },
    });

    await update(tree);

    const entries = readNxJson(tree).targetDefaults[
      '@nx/webpack:webpack'
    ] as any[];
    expect(entries[0].inputs).toEqual([
      'matching-input',
      '{workspaceRoot}/pnpm-workspace.yaml',
      SETTINGS_JSON_INPUT,
      PNPM_MAJOR_PROBE,
    ]);
    expect(entries[1].inputs).toEqual(['nonmatching-input']);
  });

  it('still adds the settings fields next to a json input hashing other fields', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {
          executor: '@nx/webpack:webpack',
          options: { generatePackageJson: true },
          inputs: [
            'default',
            { json: '{workspaceRoot}/package.json', fields: ['dependencies'] },
          ],
        },
      },
    });

    await update(tree);

    expect(readProjectConfiguration(tree, 'app1').targets.build.inputs).toEqual(
      [
        'default',
        { json: '{workspaceRoot}/package.json', fields: ['dependencies'] },
        '{workspaceRoot}/pnpm-workspace.yaml',
        SETTINGS_JSON_INPUT,
        PNPM_MAJOR_PROBE,
      ]
    );
  });

  it('leaves a target alone when a later glob entry replaced its executor entry', async () => {
    // same-file entries merge against the lower layers independently and the
    // last write wins, so the glob entry replaced the whole executor entry:
    // the target no longer runs the deploy executor
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {
          executor: '@nx/webpack:webpack',
          options: { generatePackageJson: true },
        },
        'build*': { inputs: ['{projectRoot}/**/*'] },
      },
    });

    await update(tree);

    expect(readProjectConfiguration(tree, 'app1').targets.build).toEqual({
      inputs: ['{projectRoot}/**/*'],
    });
  });

  it('treats a glob entry before the deploy target as a separate target', async () => {
    // at merge time the glob key precedes the entry creating `build`, so it
    // becomes a literal target of its own and overlays nothing
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        'build*': { inputs: ['{projectRoot}/**/*'] },
        build: {
          executor: '@nx/webpack:webpack',
          options: { generatePackageJson: true },
        },
      },
    });

    await update(tree);

    const targets = readProjectConfiguration(tree, 'app1').targets;
    expect(targets['build*'].inputs).toEqual(['{projectRoot}/**/*']);
    expect(targets.build.inputs).toEqual(DEPLOY_INPUTS);
  });

  it('is idempotent', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {
          executor: '@nx/webpack:webpack',
          options: { generatePackageJson: true },
        },
      },
    });

    await update(tree);
    await update(tree);

    expect(readProjectConfiguration(tree, 'app1').targets.build.inputs).toEqual(
      DEPLOY_INPUTS
    );
  });

  describe('inferred webpack/rspack target overlays', () => {
    function registerPlugin(
      plugin:
        | string
        | {
            plugin: string;
            options?: { buildTargetName?: string };
            include?: string[];
            exclude?: string[];
          }
    ): void {
      const nxJson = readNxJson(tree);
      nxJson.plugins = [...(nxJson.plugins ?? []), plugin];
      updateNxJson(tree, nxJson);
    }

    it('appends to a project-level overlay that replaces the inferred inputs', async () => {
      registerPlugin('@nx/webpack/plugin');
      tree.write('apps/app1/webpack.config.js', '');
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        targets: {
          build: { inputs: ['production', '^production'] },
        },
      });

      await update(tree);

      expect(
        readProjectConfiguration(tree, 'app1').targets.build.inputs
      ).toEqual(['production', '^production', ...SETTINGS_INPUTS]);
    });

    it('appends to a glob-key overlay that replaces the inferred inputs', async () => {
      registerPlugin('@nx/webpack/plugin');
      tree.write('apps/app1/webpack.config.js', '');
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        targets: {
          'build*': { inputs: ['production', '^production'] },
        },
      });

      await update(tree);

      expect(
        readProjectConfiguration(tree, 'app1').targets['build*'].inputs
      ).toEqual(['production', '^production', ...SETTINGS_INPUTS]);
    });

    it('repairs the inputs a later glob entry merged over the exact one', async () => {
      registerPlugin('@nx/webpack/plugin');
      tree.write('apps/app1/webpack.config.js', '');
      // the project read collapses a glob key onto an earlier same-file
      // sibling (last write wins), so the migration sees one entry with the
      // glob entry's content
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        targets: {
          build: { inputs: ['production', '^production'] },
          'build*': { inputs: ['{projectRoot}/**/*'] },
        },
      });

      await update(tree);

      const targets = readProjectConfiguration(tree, 'app1').targets;
      expect(targets.build.inputs).toEqual([
        '{projectRoot}/**/*',
        ...SETTINGS_INPUTS,
      ]);
      expect(targets['build*']).toBeUndefined();
    });

    it('appends to the exact entry merging after a glob entry', async () => {
      registerPlugin('@nx/webpack/plugin');
      tree.write('apps/app1/webpack.config.js', '');
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        targets: {
          'build*': { inputs: ['{projectRoot}/**/*'] },
          // merges last, so its array is the effective one
          build: { inputs: ['production', '^production'] },
        },
      });

      await update(tree);

      const targets = readProjectConfiguration(tree, 'app1').targets;
      expect(targets.build.inputs).toEqual([
        'production',
        '^production',
        ...SETTINGS_INPUTS,
      ]);
      expect(targets['build*'].inputs).toEqual(['{projectRoot}/**/*']);
    });

    it('ignores a glob entry a later exact entry overrides', async () => {
      registerPlugin('@nx/webpack/plugin');
      tree.write('apps/app1/webpack.config.js', '');
      // only the last matching entry applies, and it declares no inputs, so
      // the plugin-generated inputs stay intact
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        targets: {
          'build*': { inputs: ['{projectRoot}/**/*'] },
          build: { outputs: ['{projectRoot}/dist'] },
        },
      });

      await update(tree);

      const targets = readProjectConfiguration(tree, 'app1').targets;
      expect(targets['build*'].inputs).toEqual(['{projectRoot}/**/*']);
      expect(targets.build.inputs).toBeUndefined();
    });

    it('leaves an overlay that replaces the run-commands payload alone', async () => {
      registerPlugin('@nx/webpack/plugin');
      tree.write('apps/app1/webpack.config.js', '');
      tree.write('apps/app2/webpack.config.js', '');
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        targets: {
          build: {
            options: { command: 'echo custom' },
            inputs: ['production', '^production'],
          },
        },
      });
      addProjectConfiguration(tree, 'app2', {
        root: 'apps/app2',
        targets: {
          build: {
            options: { commands: ['echo one', 'echo two'] },
            inputs: ['production', '^production'],
          },
        },
      });

      await update(tree);

      expect(
        readProjectConfiguration(tree, 'app1').targets.build.inputs
      ).toEqual(['production', '^production']);
      expect(
        readProjectConfiguration(tree, 'app2').targets.build.inputs
      ).toEqual(['production', '^production']);
    });

    it('appends to an overlay restating the inferred command', async () => {
      registerPlugin('@nx/webpack/plugin');
      tree.write('apps/app1/webpack.config.js', '');
      tree.write('apps/app2/webpack.config.js', '');
      // the same command the plugin infers changes nothing when merged, so
      // the inferred build still runs with the replacing inputs
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        targets: {
          build: {
            options: { command: 'webpack-cli build' },
            inputs: ['production', '^production'],
          },
        },
      });
      addProjectConfiguration(tree, 'app2', {
        root: 'apps/app2',
        targets: {
          build: {
            command: 'webpack-cli build',
            inputs: ['production', '^production'],
          },
        },
      });

      await update(tree);

      expect(
        readProjectConfiguration(tree, 'app1').targets.build.inputs
      ).toEqual(['production', '^production', ...SETTINGS_INPUTS]);
      expect(
        readProjectConfiguration(tree, 'app2').targets.build.inputs
      ).toEqual(['production', '^production', ...SETTINGS_INPUTS]);
    });

    it('appends to an overlay restating the run-commands executor', async () => {
      registerPlugin('@nx/webpack/plugin');
      tree.write('apps/app1/webpack.config.js', '');
      // no command of its own, so the inferred one survives the merge
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        targets: {
          build: {
            executor: 'nx:run-commands',
            inputs: ['production', '^production'],
          },
        },
      });

      await update(tree);

      expect(
        readProjectConfiguration(tree, 'app1').targets.build.inputs
      ).toEqual(['production', '^production', ...SETTINGS_INPUTS]);
    });

    it('appends when the inferred command wins a differing one before a spread', async () => {
      registerPlugin('@nx/webpack/plugin');
      tree.write('apps/app1/webpack.config.js', '');
      // keys before '...' lose to the spread's expansion, so the inferred
      // command survives and the build still runs
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        targets: {
          build: {
            options: { command: 'echo custom', '...': true },
            inputs: ['production', '^production'],
          },
        },
      });

      await update(tree);

      expect(
        readProjectConfiguration(tree, 'app1').targets.build.inputs
      ).toEqual(['production', '^production', ...SETTINGS_INPUTS]);
    });

    it('leaves an overlay whose command after a spread replaces the inferred one alone', async () => {
      registerPlugin('@nx/webpack/plugin');
      tree.write('apps/app1/webpack.config.js', '');
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        targets: {
          build: {
            options: { '...': true, command: 'echo custom' },
            inputs: ['production', '^production'],
          },
        },
      });

      await update(tree);

      expect(
        readProjectConfiguration(tree, 'app1').targets.build.inputs
      ).toEqual(['production', '^production']);
    });

    it('appends to the targetDefaults entry replacing the inferred inputs', async () => {
      registerPlugin('@nx/webpack/plugin');
      tree.write('apps/app1/webpack.config.js', '');
      addProjectConfiguration(tree, 'app1', { root: 'apps/app1' });
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        build: { inputs: ['production', '^production'] },
      };
      updateNxJson(tree, nxJson);

      await update(tree);

      expect(readNxJson(tree).targetDefaults.build.inputs).toEqual([
        'production',
        '^production',
        ...SETTINGS_INPUTS,
      ]);
      expect(
        readProjectConfiguration(tree, 'app1').targets?.build
      ).toBeUndefined();
    });

    it('leaves an inferred target without an overlay alone', async () => {
      registerPlugin('@nx/webpack/plugin');
      tree.write('apps/app1/webpack.config.js', '');
      addProjectConfiguration(tree, 'app1', { root: 'apps/app1' });

      await update(tree);

      expect(
        readProjectConfiguration(tree, 'app1').targets?.build
      ).toBeUndefined();
      // the workspace's seeded defaults supply no inputs, so no layer is
      // narrowed to spell out nx's default
      expect(readNxJson(tree).targetDefaults).toEqual({
        build: { cache: true },
        lint: { cache: true },
      });
    });

    it('leaves an overlay that spreads the inferred inputs alone', async () => {
      registerPlugin('@nx/webpack/plugin');
      tree.write('apps/app1/webpack.config.js', '');
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        targets: {
          build: { inputs: ['...', '{projectRoot}/deploy.json'] },
        },
      });

      await update(tree);

      expect(
        readProjectConfiguration(tree, 'app1').targets.build.inputs
      ).toEqual(['...', '{projectRoot}/deploy.json']);
    });

    it("honors the registration's exclude filter", async () => {
      registerPlugin({
        plugin: '@nx/webpack/plugin',
        exclude: ['apps/app1/**'],
      });
      tree.write('apps/app1/webpack.config.js', '');
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        targets: {
          build: { inputs: ['production', '^production'] },
        },
      });

      await update(tree);

      expect(
        readProjectConfiguration(tree, 'app1').targets.build.inputs
      ).toEqual(['production', '^production']);
    });

    it("honors the registration's buildTargetName option", async () => {
      registerPlugin({
        plugin: '@nx/webpack/plugin',
        options: { buildTargetName: 'bundle' },
      });
      tree.write('apps/app1/webpack.config.js', '');
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        targets: {
          bundle: { inputs: ['production', '^production'] },
          build: { inputs: ['production', '^production'] },
        },
      });

      await update(tree);

      const targets = readProjectConfiguration(tree, 'app1').targets;
      expect(targets.bundle.inputs).toEqual([
        'production',
        '^production',
        ...SETTINGS_INPUTS,
      ]);
      expect(targets.build.inputs).toEqual(['production', '^production']);
    });

    it('skips an overlay that replaces the target identity', async () => {
      registerPlugin('@nx/webpack/plugin');
      tree.write('apps/app1/webpack.config.js', '');
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        targets: {
          build: {
            executor: '@nx/angular:webpack-browser',
            inputs: ['production', '^production'],
          },
        },
      });

      await update(tree);

      expect(
        readProjectConfiguration(tree, 'app1').targets.build.inputs
      ).toEqual(['production', '^production']);
    });

    it('appends to a glob targetDefaults key supplying the inherited inputs', async () => {
      registerPlugin('@nx/webpack/plugin');
      tree.write('apps/app1/webpack.config.js', '');
      addProjectConfiguration(tree, 'app1', { root: 'apps/app1' });
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        'build*': { inputs: ['production', '^production'] },
      };
      updateNxJson(tree, nxJson);

      await update(tree);

      expect(readNxJson(tree).targetDefaults['build*'].inputs).toEqual([
        'production',
        '^production',
        ...SETTINGS_INPUTS,
      ]);
    });

    it('matches a defaults entry filtered to the source plugin', async () => {
      registerPlugin('@nx/webpack/plugin');
      tree.write('apps/app1/webpack.config.js', '');
      addProjectConfiguration(tree, 'app1', { root: 'apps/app1' });
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        build: [
          {
            filter: { plugin: '@nx/webpack/plugin' },
            inputs: ['production', '^production'],
          },
        ],
      };
      updateNxJson(tree, nxJson);

      await update(tree);

      const entries = readNxJson(tree).targetDefaults.build as any[];
      expect(entries[0].inputs).toEqual([
        'production',
        '^production',
        ...SETTINGS_INPUTS,
      ]);
    });

    it('leaves a plugin-filtered defaults entry alone once the overlay restates the executor', async () => {
      registerPlugin('@nx/webpack/plugin');
      tree.write('apps/app1/webpack.config.js', '');
      // an authored executor drops the runtime's plugin attribution, so the
      // filtered entry never applies to this target and the plugin's own
      // inputs stay effective
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        targets: { build: { executor: 'nx:run-commands' } },
      });
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        build: [
          {
            filter: { plugin: '@nx/webpack/plugin' },
            inputs: ['production', '^production'],
          },
        ],
      };
      updateNxJson(tree, nxJson);

      await update(tree);

      const entries = readNxJson(tree).targetDefaults.build as any[];
      expect(entries[0].inputs).toEqual(['production', '^production']);
      expect(
        readProjectConfiguration(tree, 'app1').targets.build.inputs
      ).toBeUndefined();
    });

    it('keeps the plugin attribution for an overlay restating only the options command', async () => {
      registerPlugin('@nx/webpack/plugin');
      tree.write('apps/app1/webpack.config.js', '');
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        targets: { build: { options: { command: 'webpack-cli build' } } },
      });
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        build: [
          {
            filter: { plugin: '@nx/webpack/plugin' },
            inputs: ['production', '^production'],
          },
        ],
      };
      updateNxJson(tree, nxJson);

      await update(tree);

      const entries = readNxJson(tree).targetDefaults.build as any[];
      expect(entries[0].inputs).toEqual([
        'production',
        '^production',
        ...SETTINGS_INPUTS,
      ]);
    });

    it('skips a defaults entry whose projects filter excludes the project', async () => {
      registerPlugin('@nx/webpack/plugin');
      tree.write('apps/app1/webpack.config.js', '');
      addProjectConfiguration(tree, 'app1', { root: 'apps/app1' });
      addProjectConfiguration(tree, 'other', { root: 'apps/other' });
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        build: [
          {
            filter: { projects: ['other'] },
            inputs: ['production', '^production'],
          },
        ],
      };
      updateNxJson(tree, nxJson);

      await update(tree);

      const entries = readNxJson(tree).targetDefaults.build as any[];
      expect(entries[0].inputs).toEqual(['production', '^production']);
    });

    it('repairs an rspack-inferred overlay', async () => {
      registerPlugin('@nx/rspack/plugin');
      tree.write('apps/app1/rspack.config.ts', '');
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        targets: {
          build: { inputs: ['production', '^production'] },
        },
      });

      await update(tree);

      expect(
        readProjectConfiguration(tree, 'app1').targets.build.inputs
      ).toEqual(['production', '^production', ...SETTINGS_INPUTS]);
    });
  });
});
