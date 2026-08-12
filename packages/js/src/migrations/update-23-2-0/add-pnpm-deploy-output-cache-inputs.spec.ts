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
// What the migration writes for a target that declared no `inputs`: nx's own
// default, spelled out, plus the settings sources.
const DEPLOY_INPUTS = [
  'default',
  '^default',
  '{workspaceRoot}/pnpm-workspace.yaml',
  SETTINGS_JSON_INPUT,
  PNPM_MAJOR_PROBE,
];

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
});
