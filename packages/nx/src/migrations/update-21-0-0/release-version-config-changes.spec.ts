import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import { Tree } from '../../generators/tree';
import { readJson, writeJson } from '../../generators/utils/json';
import { readNxJson, updateNxJson } from '../../generators/utils/nx-json';

import update from './release-version-config-changes';

describe('release version config changes', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should do nothing when nxJson.release.version is not set', async () => {
    updateNxJson(tree, {});
    await update(tree);
    expect(readNxJson(tree)).toEqual({});

    updateNxJson(tree, {
      release: {},
    });
    await update(tree);
    expect(readNxJson(tree)).toEqual({
      release: {},
    });
  });

  it('should do nothing when useLegacyVersioning is explicitly true', async () => {
    const nxJsonBefore = {
      release: {
        version: {
          useLegacyVersioning: true,
          generatorOptions: {
            specifierSource: 'prompt',
            currentVersionResolver: 'registry',
            currentVersionResolverMetadata: {},
            fallbackCurrentVersionResolver: 'disk',
            versionPrefix: 'auto',
            updateDependents: 'auto',
            logUnchangedProjects: true,
          },
        },
      },
    };
    updateNxJson(tree, nxJsonBefore);

    await update(tree);

    expect(readNxJson(tree)).toEqual(nxJsonBefore);
  });

  it('should set useLegacyVersioning to true when using a generator other than the @nx/js one, and nothing else', async () => {
    updateNxJson(tree, {
      release: {
        version: {
          generator: 'some-other-generator',
          generatorOptions: {
            something: 'related-to-the-custom-generator',
          },
        },
      },
    });

    await update(tree);

    expect(readNxJson(tree)).toMatchInlineSnapshot(`
      {
        "release": {
          "version": {
            "generator": "some-other-generator",
            "generatorOptions": {
              "something": "related-to-the-custom-generator",
            },
            "useLegacyVersioning": true,
          },
        },
      }
    `);
  });

  it('should promote certain generatorOptions to top-level options and remove generatorOptions', async () => {
    updateNxJson(tree, {
      release: {
        version: {
          generatorOptions: {
            specifierSource: 'prompt',
            currentVersionResolver: 'registry',
            currentVersionResolverMetadata: {},
            fallbackCurrentVersionResolver: 'disk',
            versionPrefix: 'auto',
            updateDependents: 'auto',
            logUnchangedProjects: true,
            preserveLocalDependencyProtocols: false,
          },
        },
      },
    });

    await update(tree);

    expect(readNxJson(tree)).toMatchInlineSnapshot(`
      {
        "release": {
          "version": {
            "currentVersionResolver": "registry",
            "currentVersionResolverMetadata": {},
            "fallbackCurrentVersionResolver": "disk",
            "logUnchangedProjects": true,
            "preserveLocalDependencyProtocols": false,
            "specifierSource": "prompt",
            "updateDependents": "auto",
            "versionPrefix": "auto",
          },
        },
      }
    `);
  });

  it('should remove preserveLocalDependencyProtocols if it is explicitly true', async () => {
    updateNxJson(tree, {
      release: {
        version: {
          generatorOptions: { preserveLocalDependencyProtocols: true },
        },
      },
    });

    await update(tree);

    expect(readNxJson(tree)).toMatchInlineSnapshot(`
      {
        "release": {
          "version": {},
        },
      }
    `);
  });

  it('should set preserveLocalDependencyProtocols to false if it is not explicitly true', async () => {
    updateNxJson(tree, {
      release: {
        version: { generatorOptions: {} },
      },
    });

    await update(tree);

    expect(readNxJson(tree)).toMatchInlineSnapshot(`
      {
        "release": {
          "version": {
            "preserveLocalDependencyProtocols": false,
          },
        },
      }
    `);
  });

  it('should replace generatorOptions.packageRoot with manifestRootsToUpdate', async () => {
    updateNxJson(tree, {
      release: {
        version: { generatorOptions: { packageRoot: 'dist/{projectName}' } },
      },
    });

    await update(tree);

    expect(readNxJson(tree)).toMatchInlineSnapshot(`
      {
        "release": {
          "version": {
            "manifestRootsToUpdate": [
              "dist/{projectName}",
            ],
            "preserveLocalDependencyProtocols": false,
          },
        },
      }
    `);
  });

  it('should move certain generatorOptions to versionActionsOptions', async () => {
    updateNxJson(tree, {
      release: {
        version: {
          generatorOptions: {
            skipLockFileUpdate: true,
            installArgs: '--some-flag',
            installIgnoreScripts: true,
          },
        },
      },
    });

    await update(tree);

    expect(readNxJson(tree)).toMatchInlineSnapshot(`
      {
        "release": {
          "version": {
            "preserveLocalDependencyProtocols": false,
            "versionActionsOptions": {
              "installArgs": "--some-flag",
              "installIgnoreScripts": true,
              "skipLockFileUpdate": true,
            },
          },
        },
      }
    `);
  });

  it('should perform the updates on release groups as well', async () => {
    updateNxJson(tree, {
      release: {
        groups: {
          group1: {
            projects: ['project1', 'project2'],
            version: {
              generatorOptions: {
                specifierSource: 'prompt',
                currentVersionResolver: 'registry',
                currentVersionResolverMetadata: {},
                fallbackCurrentVersionResolver: 'disk',
                versionPrefix: 'auto',
                updateDependents: 'auto',
                logUnchangedProjects: true,
                preserveLocalDependencyProtocols: true,
                skipLockFileUpdate: true,
                installArgs: '--some-flag',
                installIgnoreScripts: true,
              },
            },
          },
        },
      },
    });

    await update(tree);

    expect(readNxJson(tree)).toMatchInlineSnapshot(`
      {
        "release": {
          "groups": {
            "group1": {
              "projects": [
                "project1",
                "project2",
              ],
              "version": {
                "currentVersionResolver": "registry",
                "currentVersionResolverMetadata": {},
                "fallbackCurrentVersionResolver": "disk",
                "logUnchangedProjects": true,
                "specifierSource": "prompt",
                "updateDependents": "auto",
                "versionActionsOptions": {
                  "installArgs": "--some-flag",
                  "installIgnoreScripts": true,
                  "skipLockFileUpdate": true,
                },
                "versionPrefix": "auto",
              },
            },
          },
        },
      }
    `);
  });

  it('should update project.json, if applicable', async () => {
    updateNxJson(tree, {});

    writeJson(tree, 'my-lib/project.json', {
      name: 'my-lib',
      projectType: 'library',
      release: {
        version: {
          generatorOptions: {
            specifierSource: 'prompt',
            currentVersionResolver: 'registry',
            currentVersionResolverMetadata: {},
            fallbackCurrentVersionResolver: 'disk',
            versionPrefix: 'auto',
            updateDependents: 'auto',
            logUnchangedProjects: true,
            preserveLocalDependencyProtocols: true,
            skipLockFileUpdate: true,
            installArgs: '--some-flag',
            installIgnoreScripts: true,
          },
        },
      },
    });

    await update(tree);

    expect(readJson(tree, 'my-lib/project.json')).toMatchInlineSnapshot(`
      {
        "name": "my-lib",
        "projectType": "library",
        "release": {
          "version": {
            "currentVersionResolver": "registry",
            "currentVersionResolverMetadata": {},
            "fallbackCurrentVersionResolver": "disk",
            "logUnchangedProjects": true,
            "specifierSource": "prompt",
            "updateDependents": "auto",
            "versionActionsOptions": {
              "installArgs": "--some-flag",
              "installIgnoreScripts": true,
              "skipLockFileUpdate": true,
            },
            "versionPrefix": "auto",
          },
        },
      }
    `);
  });

  it('should update package.json, if applicable', async () => {
    updateNxJson(tree, {});

    writeJson(tree, 'my-lib/package.json', {
      name: 'my-lib',
      version: '1.0.0',
      dependencies: {},
      nx: {
        release: {
          version: {
            generatorOptions: {
              specifierSource: 'prompt',
              currentVersionResolver: 'registry',
              currentVersionResolverMetadata: {},
              fallbackCurrentVersionResolver: 'disk',
              versionPrefix: 'auto',
              updateDependents: 'auto',
              logUnchangedProjects: true,
              preserveLocalDependencyProtocols: true,
              skipLockFileUpdate: true,
              installArgs: '--some-flag',
              installIgnoreScripts: true,
            },
          },
        },
      },
    });

    await update(tree);

    expect(readJson(tree, 'my-lib/package.json')).toMatchInlineSnapshot(`
      {
        "dependencies": {},
        "name": "my-lib",
        "nx": {
          "release": {
            "version": {
              "currentVersionResolver": "registry",
              "currentVersionResolverMetadata": {},
              "fallbackCurrentVersionResolver": "disk",
              "logUnchangedProjects": true,
              "specifierSource": "prompt",
              "updateDependents": "auto",
              "versionActionsOptions": {
                "installArgs": "--some-flag",
                "installIgnoreScripts": true,
                "skipLockFileUpdate": true,
              },
              "versionPrefix": "auto",
            },
          },
        },
        "version": "1.0.0",
      }
    `);
  });
});
