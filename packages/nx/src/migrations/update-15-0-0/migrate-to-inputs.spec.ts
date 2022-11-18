import {
  createTreeWithEmptyV1Workspace,
  createTreeWithEmptyWorkspace,
} from '../../generators/testing-utils/create-tree-with-empty-workspace';
import type { Tree } from '../../generators/tree';
import {
  addProjectConfiguration,
  readProjectConfiguration,
  readWorkspaceConfiguration,
  updateWorkspaceConfiguration,
  WorkspaceConfiguration,
} from '../../generators/utils/project-configuration';
import { readJson, writeJson } from '../../generators/utils/json';
import migrateToInputs from './migrate-to-inputs';

describe('15.0.0 migration (migrate-to-inputs)', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add build inputs configuration to inputs', async () => {
    updateWorkspaceConfiguration(tree, {
      version: 2,
      targetDefaults: {
        build: {
          dependsOn: ['^build'],
        },
      },
      implicitDependencies: {
        '.eslintrc.json': '*',
      },
    });
    addProjectConfiguration(tree, 'proj', {
      root: 'proj',
      targets: {
        build: {
          executor: 'nx:run-commands',
          options: {},
        },
      },
    });
    await migrateToInputs(tree);

    const updated = readWorkspaceConfiguration(tree);

    expect(updated.implicitDependencies).toBeUndefined();
    expect(updated).toMatchInlineSnapshot(`
      Object {
        "namedInputs": Object {
          "default": Array [
            "{projectRoot}/**/*",
            "sharedGlobals",
          ],
          "production": Array [
            "default",
          ],
          "sharedGlobals": Array [],
        },
        "targetDefaults": Object {
          "build": Object {
            "dependsOn": Array [
              "^build",
            ],
            "inputs": Array [
              "production",
              "^production",
            ],
          },
        },
        "version": 2,
      }
    `);
  });

  it('should not add build inputs configuration to inputs', async () => {
    updateWorkspaceConfiguration(tree, {
      version: 2,
      targetDefaults: {
        prepare: {
          dependsOn: ['^prepare'],
        },
      },
      implicitDependencies: {
        '.eslintrc.json': '*',
      },
    });
    addProjectConfiguration(tree, 'proj', {
      root: 'proj',
      targets: {
        nobuild: {
          executor: 'nx:run-commands',
          options: {},
        },
      },
    });
    await migrateToInputs(tree);

    const updated = readWorkspaceConfiguration(tree);

    expect(updated.implicitDependencies).toBeUndefined();
    expect(updated).toMatchInlineSnapshot(`
      Object {
        "namedInputs": Object {
          "default": Array [
            "{projectRoot}/**/*",
            "sharedGlobals",
          ],
          "production": Array [
            "default",
          ],
          "sharedGlobals": Array [],
        },
        "targetDefaults": Object {
          "prepare": Object {
            "dependsOn": Array [
              "^prepare",
            ],
          },
        },
        "version": 2,
      }
    `);
  });

  it('should add implicitDependencies that affect all projects to sharedGlobals', async () => {
    updateWorkspaceConfiguration(tree, {
      version: 2,
      implicitDependencies: {
        Jenkinsfile: '*',
      },
    });
    await migrateToInputs(tree);

    const updated = readWorkspaceConfiguration(tree);

    expect(updated.implicitDependencies).toBeUndefined();
    expect(updated.namedInputs.sharedGlobals).toContain(
      '{workspaceRoot}/Jenkinsfile'
    );
  });

  it('should not add package.json to filesets', async () => {
    updateWorkspaceConfiguration(tree, {
      version: 2,
      implicitDependencies: {
        'package.json': {
          dependencies: '*',
          devDependencies: '*',
        },
      },
    });
    await migrateToInputs(tree);

    const updated = readWorkspaceConfiguration(tree);

    expect(updated.implicitDependencies).toBeUndefined();
    expect(updated.namedInputs.sharedGlobals).toEqual([]);
  });

  it('should handle other .json files', async () => {
    updateWorkspaceConfiguration(tree, {
      version: 2,
      implicitDependencies: {
        'config.json': {
          important: '*',
        },
      },
    });
    await migrateToInputs(tree);

    const updated = readWorkspaceConfiguration(tree);

    expect(updated.implicitDependencies).toBeUndefined();
    expect(updated.namedInputs.sharedGlobals).toContain(
      '{workspaceRoot}/config.json'
    );
  });

  it('should add project specific implicit dependencies to project namedInputs', async () => {
    updateWorkspaceConfiguration(tree, {
      version: 2,
      implicitDependencies: {
        'tools/scripts/build-app.js': ['app1', 'app2'],
      },
    });
    addProjectConfiguration(tree, 'app1', {
      root: 'app1',
    });
    addProjectConfiguration(tree, 'app2', {
      root: 'app2',
    });
    addProjectConfiguration(tree, 'lib1', {
      root: 'lib1',
    });

    await migrateToInputs(tree);

    const updated = readWorkspaceConfiguration(tree);
    expect(updated.implicitDependencies).toBeUndefined();
    expect(updated.namedInputs.projectSpecificFiles).toEqual([]);
    expect(updated.namedInputs.default).toContain('projectSpecificFiles');

    const app1 = readProjectConfiguration(tree, 'app1');
    expect(app1.namedInputs.projectSpecificFiles).toContain(
      '{workspaceRoot}/tools/scripts/build-app.js'
    );
    const app2 = readProjectConfiguration(tree, 'app2');
    expect(app2.namedInputs.projectSpecificFiles).toContain(
      '{workspaceRoot}/tools/scripts/build-app.js'
    );

    const lib = readProjectConfiguration(tree, 'lib1');
    expect(lib.namedInputs).toBeUndefined();
  });

  it('should add project specific implicit dependencies to projects with package.json', async () => {
    updateWorkspaceConfiguration(tree, {
      version: 2,
      implicitDependencies: {
        'tools/scripts/build-app.js': ['app1', 'app2'],
      },
    });
    addProjectConfiguration(tree, 'app1', {
      root: 'app1',
    });
    addProjectConfiguration(tree, 'app2', {
      root: 'app2',
    });
    tree.delete('app2/project.json');
    writeJson(tree, 'app2/package.json', { name: 'app2' });
    addProjectConfiguration(tree, 'lib1', {
      root: 'lib1',
    });

    await migrateToInputs(tree);

    const updated = readWorkspaceConfiguration(tree);
    expect(updated.implicitDependencies).toBeUndefined();
    expect(updated.namedInputs.projectSpecificFiles).toEqual([]);
    expect(updated.namedInputs.default).toContain('projectSpecificFiles');

    const app1 = readProjectConfiguration(tree, 'app1');
    expect(app1.namedInputs.projectSpecificFiles).toContain(
      '{workspaceRoot}/tools/scripts/build-app.js'
    );
    const app2 = readJson(tree, 'app2/package.json');
    expect(app2.nx.namedInputs.projectSpecificFiles).toContain(
      '{workspaceRoot}/tools/scripts/build-app.js'
    );

    const lib = readProjectConfiguration(tree, 'lib1');
    expect(lib.namedInputs).toBeUndefined();
  });

  it('should do nothing if there are no implicitDependencies', async () => {
    const workspace: WorkspaceConfiguration = {
      version: 2,
      namedInputs: {
        default: ['{projectRoot}/**/*'],
        production: ['default'],
        sharedGlobals: ['babel.config.json'],
      },
      targetDefaults: {
        build: {
          dependsOn: ['^build'],
          inputs: ['default', '^default'],
        },
      },
    };
    updateWorkspaceConfiguration(tree, workspace);

    await migrateToInputs(tree);

    const updated = readWorkspaceConfiguration(tree);
    expect(updated.implicitDependencies).toBeUndefined();
    expect(updated).toEqual(workspace);
  });

  it('should not make any changes if there is no nx.json', async () => {
    tree.delete('nx.json');

    await migrateToInputs(tree);

    expect(tree.exists('nx.json')).toEqual(false);
  });

  it('should not make any changes if the workspace extends npm.json', async () => {
    const workspace = readWorkspaceConfiguration(tree);
    workspace.extends = 'nx/presets/npm.json';
    updateWorkspaceConfiguration(tree, workspace);

    await migrateToInputs(tree);

    const updatedWorkspace = readWorkspaceConfiguration(tree);
    expect(updatedWorkspace.namedInputs).not.toBeDefined();
  });
});

describe('15.0.0 migration (migrate-to-inputs) (v1)', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyV1Workspace();
  });

  it('should add project specific implicit dependencies to project namedInputs', async () => {
    updateWorkspaceConfiguration(tree, {
      version: 2,
      implicitDependencies: {
        'tools/scripts/build-app.js': ['app1', 'app2'],
      },
    });
    addProjectConfiguration(tree, 'app1', {
      root: 'app1',
    });
    addProjectConfiguration(tree, 'app2', {
      root: 'app2',
    });
    addProjectConfiguration(tree, 'lib1', {
      root: 'lib1',
    });

    await migrateToInputs(tree);

    const updated = readWorkspaceConfiguration(tree);
    expect(updated.implicitDependencies).toBeUndefined();
    expect(updated.namedInputs.projectSpecificFiles).toEqual([]);
    expect(updated.namedInputs.default).toContain('projectSpecificFiles');

    const app1 = readProjectConfiguration(tree, 'app1');
    expect(app1.namedInputs.projectSpecificFiles).toContain(
      '{workspaceRoot}/tools/scripts/build-app.js'
    );
    const app2 = readProjectConfiguration(tree, 'app2');
    expect(app2.namedInputs.projectSpecificFiles).toContain(
      '{workspaceRoot}/tools/scripts/build-app.js'
    );

    const lib = readProjectConfiguration(tree, 'lib1');
    expect(lib.namedInputs).toBeUndefined();
  });
});
