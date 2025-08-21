import Ajv from 'ajv';
import { Tree } from '../tree';
import { ProjectConfiguration } from '../../config/workspace-json-project-json';

import { createTree } from '../testing-utils/create-tree';
import { createTreeWithEmptyWorkspace } from '../testing-utils/create-tree-with-empty-workspace';
import { readJson, writeJson } from '../utils/json';
import {
  addProjectConfiguration,
  getProjects,
  readProjectConfiguration,
  removeProjectConfiguration,
  updateProjectConfiguration,
} from './project-configuration';

import * as projectSchema from '../../../schemas/project-schema.json';
import { joinPathFragments } from '../../utils/path';
import { PackageJson } from '../../utils/package-json';

const projectConfiguration: ProjectConfiguration = {
  name: 'test',
  root: 'libs/test',
  sourceRoot: 'libs/test/src',
};

describe('project configuration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should create project.json file when adding a project if standalone is true', () => {
    addProjectConfiguration(tree, 'test', {
      ...projectConfiguration,
      targets: {
        test: {},
      },
    });

    expect(readProjectConfiguration(tree, 'test')).toMatchInlineSnapshot(`
      {
        "$schema": "../../node_modules/nx/schemas/project-schema.json",
        "name": "test",
        "root": "libs/test",
        "sourceRoot": "libs/test/src",
        "targets": {
          "test": {},
        },
      }
    `);
    expect(tree.exists('libs/test/project.json')).toBeTruthy();
  });

  it('should add a comment to show project details when targets are missing', () => {
    addProjectConfiguration(tree, 'test', {
      ...projectConfiguration,
      targets: {},
    });

    expect(readProjectConfiguration(tree, 'test')).toMatchInlineSnapshot(`
      {
        "$schema": "../../node_modules/nx/schemas/project-schema.json",
        "name": "test",
        "root": "libs/test",
        "sourceRoot": "libs/test/src",
        "targets": {},
      }
    `);

    expect(tree.read('libs/test/project.json', 'utf-8')).toMatchInlineSnapshot(`
      "{
        "name": "test",
        "$schema": "../../node_modules/nx/schemas/project-schema.json",
        "sourceRoot": "libs/test/src",
        "// targets": "to see all targets run: nx show project test --web",
        "targets": {}
      }
      "
    `);

    // Adding a target removes the "// targets" comment.
    updateProjectConfiguration(tree, 'test', {
      ...projectConfiguration,
      targets: {
        test: {},
      },
    });

    expect(tree.read('libs/test/project.json', 'utf-8')).toMatchInlineSnapshot(`
      "{
        "name": "test",
        "$schema": "../../node_modules/nx/schemas/project-schema.json",
        "sourceRoot": "libs/test/src",
        "targets": {
          "test": {}
        }
      }
      "
    `);

    // Emptying out targets add "// targets" comment back.
    updateProjectConfiguration(tree, 'test', {
      ...projectConfiguration,
      targets: {},
    });

    expect(tree.read('libs/test/project.json', 'utf-8')).toMatchInlineSnapshot(`
      "{
        "name": "test",
        "$schema": "../../node_modules/nx/schemas/project-schema.json",
        "sourceRoot": "libs/test/src",
        "// targets": "to see all targets run: nx show project test --web",
        "targets": {}
      }
      "
    `);
  });

  it('should update project.json file when updating a project', () => {
    addProjectConfiguration(tree, 'test', projectConfiguration);
    const expectedProjectConfig = {
      ...projectConfiguration,
      targets: { build: { executor: '' } },
    };
    updateProjectConfiguration(tree, 'test', expectedProjectConfig);

    expect(
      readJson(tree, 'libs/test/project.json').targets.build
    ).toBeDefined();
  });

  it('should remove project.json file when removing project configuration', () => {
    addProjectConfiguration(tree, 'test', projectConfiguration);
    removeProjectConfiguration(tree, 'test');

    expect(tree.exists('test/project.json')).toBeFalsy();
  });

  describe('JSON schema', () => {
    it('should have JSON $schema in project configuration for standalone projects', () => {
      addProjectConfiguration(tree, 'test', projectConfiguration, true);
      const projectJson = readJson(tree, 'libs/test/project.json');
      expect(projectJson['$schema']).toBeTruthy();
      expect(projectJson['$schema']).toEqual(
        '../../node_modules/nx/schemas/project-schema.json'
      );
    });

    it('should match project configuration with JSON $schema', () => {
      const ajv = new Ajv();
      const validate = ajv.compile(projectSchema);

      addProjectConfiguration(tree, 'test', projectConfiguration, true);
      const projectJson = readJson(tree, 'libs/test/project.json');

      expect(validate(projectJson)).toEqual(true);
    });
  });

  it('should get a map of projects', () => {
    addProjectConfiguration(tree, 'proj', {
      root: 'proj',
    });

    const projects = getProjects(tree);

    expect(projects.size).toEqual(1);
    expect(projects.get('proj')).toEqual({
      $schema: '../node_modules/nx/schemas/project-schema.json',
      name: 'proj',
      root: 'proj',
    });
  });

  it('should find projects created during generator run when called from callback', () => {
    // Simulate what happens during a generator callback:
    // 1. A project is created during generator execution
    addProjectConfiguration(tree, 'test-proj', {
      root: 'libs/test-proj',
    });

    // Verify the project is found before callback
    let projects = getProjects(tree);
    expect(projects.size).toEqual(1);
    expect(projects.has('test-proj')).toBeTruthy();

    // 2. Simulate changes being flushed to disk by modifying the tree
    // to mark the file as UPDATE instead of CREATE
    const projectJsonPath = 'libs/test-proj/project.json';
    const projectJsonContent = tree.read(projectJsonPath, 'utf-8');

    // Clear the tree and write the file again to simulate it being flushed
    // This creates a scenario similar to what happens in callbacks
    tree.write(projectJsonPath, projectJsonContent);

    // 3. getProjects should still find the project even when it's marked as UPDATE
    projects = getProjects(tree);
    expect(projects.size).toEqual(1);
    expect(projects.has('test-proj')).toBeTruthy();
    expect(projects.get('test-proj')).toEqual({
      $schema: '../../node_modules/nx/schemas/project-schema.json',
      name: 'test-proj',
      root: 'libs/test-proj',
    });
  });

  describe('without nx.json', () => {
    beforeEach(() => tree.delete('nx.json'));

    it('should create project.json file when adding a project if standalone is true', () => {
      addProjectConfiguration(tree, 'test', projectConfiguration);

      expect(tree.exists('libs/test/project.json')).toBeTruthy();
    });

    it('should create project.json file if all other apps in the workspace use project.json', () => {
      addProjectConfiguration(tree, 'project-a', {
        root: 'apps/project-a',
        targets: {},
      });
      addProjectConfiguration(tree, 'project-b', {
        root: 'apps/project-b',
        targets: {},
      });
      expect(tree.exists('apps/project-b/project.json')).toBeTruthy();
    });

    it('should update project.json file when updating a project', () => {
      addProjectConfiguration(tree, 'test', projectConfiguration);
      const expectedProjectConfig = {
        ...projectConfiguration,
        targets: { build: { executor: '' } },
      };
      updateProjectConfiguration(tree, 'test', expectedProjectConfig);
      expect(
        readJson(tree, 'libs/test/project.json').targets.build
      ).toBeDefined();
    });

    it('should remove project.json file when removing project configuration', () => {
      addProjectConfiguration(tree, 'test', projectConfiguration);
      removeProjectConfiguration(tree, 'test');

      expect(tree.exists('test/project.json')).toBeFalsy();
    });

    it('should remove project configuration', () => {
      addProjectConfiguration(tree, 'test', projectConfiguration);
      removeProjectConfiguration(tree, 'test');

      expect(
        tree.exists(
          joinPathFragments(projectConfiguration.root, 'project.json')
        )
      ).toBeFalsy();
    });

    it('should get a map of projects', () => {
      addProjectConfiguration(tree, 'proj', {
        root: 'proj',
      });

      const projects = getProjects(tree);

      expect(projects.size).toEqual(1);
      expect(projects.get('proj')).toEqual({
        $schema: '../node_modules/nx/schemas/project-schema.json',
        name: 'proj',
        root: 'proj',
      });
    });
  });

  describe('for npm workspaces', () => {
    beforeEach(() => {
      tree = createTree();
      writeJson<PackageJson>(tree, 'package.json', {
        name: '@testing/root',
        version: '0.0.1',
        workspaces: ['*/**/package.json'],
      });
    });

    it('should read project configuration from package.json files', () => {
      writeJson(tree, 'proj/package.json', {
        name: 'proj',
        nx: {},
      });

      const proj = readProjectConfiguration(tree, 'proj');

      expect(proj).toEqual({
        name: 'proj',
        root: 'proj',
      });
    });

    it('should get a map of projects', () => {
      writeJson(tree, 'proj/package.json', {
        name: 'proj',
        nx: {},
      });
      const projects = getProjects(tree);

      expect(projects.size).toEqual(1);
      expect(projects.get('proj')).toEqual({
        name: 'proj',
        root: 'proj',
      });
    });

    it('should handle reading + writing project configuration', () => {
      writeJson(tree, 'proj/package.json', {
        name: 'proj',
        nx: {},
      });

      const proj = readProjectConfiguration(tree, 'proj');
      expect(proj).toEqual({
        name: 'proj',
        root: 'proj',
      });

      updateProjectConfiguration(tree, 'proj', {
        name: 'proj',
        root: 'proj',
        sourceRoot: 'proj/src',
        targets: {
          build: {
            command: 'echo "building"',
          },
        },
      });

      const updatedProj = readProjectConfiguration(tree, 'proj');
      expect(updatedProj).toEqual({
        name: 'proj',
        root: 'proj',
        sourceRoot: 'proj/src',
        targets: {
          build: {
            command: 'echo "building"',
          },
        },
      });

      expect(tree.read('proj/package.json', 'utf-8')).toMatchInlineSnapshot(`
        "{
          "name": "proj",
          "nx": {
            "sourceRoot": "proj/src",
            "targets": {
              "build": {
                "command": "echo \\"building\\""
              }
            }
          }
        }
        "
      `);
      expect(tree.exists('proj/project.json')).toBeFalsy();
    });

    it('should avoid writing empty nx property', () => {
      writeJson(tree, 'proj/package.json', {
        name: 'proj',
      });

      updateProjectConfiguration(tree, 'proj', {
        root: 'proj',
      });

      const updatedProj = readProjectConfiguration(tree, 'proj');
      expect(updatedProj).toEqual({
        name: 'proj',
        root: 'proj',
      });

      expect(tree.read('proj/package.json', 'utf-8')).toMatchInlineSnapshot(`
        "{
          "name": "proj"
        }
        "
      `);
      expect(tree.exists('proj/project.json')).toBeFalsy();

      // Adding tags will add nx property
      updateProjectConfiguration(tree, 'proj', {
        root: 'proj',
        tags: ['test'],
      });
      expect(tree.read('proj/package.json', 'utf-8')).toMatchInlineSnapshot(`
        "{
          "name": "proj",
          "nx": {
            "tags": [
              "test"
            ]
          }
        }
        "
      `);
    });
  });

  describe('with both project.json and package.json', () => {
    it('should not copy properties from package.json to project.json when updating', () => {
      // Set up a project with both package.json and project.json
      const projectRoot = 'libs/mixed-project';

      // Create package.json with some nx configuration
      writeJson<PackageJson>(tree, `${projectRoot}/package.json`, {
        name: 'mixed-project',
        version: '1.0.0',
        nx: {
          tags: ['from-package-json'],
          implicitDependencies: ['package-implicit-dep'],
          namedInputs: {
            packageNamedInput: ['src/**/*'],
          },
        },
      });

      // Create project.json with different configuration
      writeJson(tree, `${projectRoot}/project.json`, {
        name: 'mixed-project',
        $schema: '../../node_modules/nx/schemas/project-schema.json',
        sourceRoot: `${projectRoot}/src`,
        targets: {
          build: {
            executor: '@nx/webpack:webpack',
            options: {
              outputPath: 'dist/mixed-project',
            },
          },
        },
      });

      // Read the merged configuration (should include properties from both files)
      const mergedConfig = readProjectConfiguration(tree, 'mixed-project');
      expect(mergedConfig.tags).toEqual(['from-package-json']);
      expect(mergedConfig.implicitDependencies).toEqual([
        'package-implicit-dep',
      ]);
      expect(mergedConfig.namedInputs?.packageNamedInput).toEqual(['src/**/*']);
      expect(mergedConfig.targets?.build).toBeDefined();

      // Update the project configuration with new values
      updateProjectConfiguration(tree, 'mixed-project', {
        ...mergedConfig,
        sourceRoot: `${projectRoot}/updated-src`,
        targets: {
          ...mergedConfig.targets,
          test: {
            executor: '@nx/jest:jest',
            options: {
              jestConfig: `${projectRoot}/jest.config.ts`,
            },
          },
        },
      });

      // Check that project.json only contains project.json-specific properties
      // and doesn't include properties that came from package.json
      const projectJsonContent = readJson(tree, `${projectRoot}/project.json`);

      expect(projectJsonContent).toEqual({
        name: 'mixed-project',
        $schema: '../../node_modules/nx/schemas/project-schema.json',
        sourceRoot: `${projectRoot}/updated-src`,
        targets: {
          build: {
            executor: '@nx/webpack:webpack',
            options: {
              outputPath: 'dist/mixed-project',
            },
          },
          test: {
            executor: '@nx/jest:jest',
            options: {
              jestConfig: `${projectRoot}/jest.config.ts`,
            },
          },
        },
      });

      // Verify that properties from package.json are NOT in project.json
      expect(projectJsonContent.tags).toBeUndefined();
      expect(projectJsonContent.implicitDependencies).toBeUndefined();
      expect(projectJsonContent.namedInputs).toBeUndefined();

      // Verify that package.json is unchanged
      const packageJsonContent = readJson(tree, `${projectRoot}/package.json`);
      expect(packageJsonContent.nx.tags).toEqual(['from-package-json']);
      expect(packageJsonContent.nx.implicitDependencies).toEqual([
        'package-implicit-dep',
      ]);
      expect(packageJsonContent.nx.namedInputs?.packageNamedInput).toEqual([
        'src/**/*',
      ]);
    });

    it('should handle nested properties correctly when both files exist', () => {
      const projectRoot = 'libs/nested-test';

      // Create package.json with nested configuration
      writeJson<PackageJson>(tree, `${projectRoot}/package.json`, {
        name: 'nested-test',
        version: '1.0.0',
        nx: {
          targets: {
            lint: {
              executor: '@nx/eslint:lint',
              options: {
                lintFilePatterns: ['src/**/*.ts'],
              },
            },
          },
          metadata: {
            description: 'from-package',
            technologies: ['from-package-tech'],
          },
        },
      });

      // Create project.json with different nested configuration
      writeJson(tree, `${projectRoot}/project.json`, {
        name: 'nested-test',
        $schema: '../../node_modules/nx/schemas/project-schema.json',
        targets: {
          build: {
            executor: '@nx/webpack:webpack',
            options: {
              outputPath: 'dist/nested-test',
            },
          },
        },
        metadata: {
          description: 'from-project',
          technologies: ['from-project-tech'],
        },
      });

      // Read merged config - this will include properties from both files merged together
      const mergedConfig = readProjectConfiguration(tree, 'nested-test');
      expect(mergedConfig.targets?.lint).toBeDefined(); // from package.json
      expect(mergedConfig.targets?.build).toBeDefined(); // from project.json

      // Metadata arrays get merged, non-arrays get overridden
      expect(mergedConfig.metadata?.description).toEqual('from-project'); // project.json overrides
      expect(mergedConfig.metadata?.technologies).toEqual([
        'from-package-tech',
        'from-project-tech',
      ]); // arrays get merged

      // Update configuration
      updateProjectConfiguration(tree, 'nested-test', {
        ...mergedConfig,
        targets: {
          ...mergedConfig.targets,
          test: {
            executor: '@nx/jest:jest',
          },
        },
      });

      // Verify project.json only contains properties that should be there
      const projectJsonContent = readJson(tree, `${projectRoot}/project.json`);

      // Should have targets that were originally in project.json plus new ones
      expect(projectJsonContent.targets?.build).toBeDefined(); // was in original project.json
      expect(projectJsonContent.targets?.test).toBeDefined(); // newly added
      expect(projectJsonContent.targets?.lint).toBeUndefined(); // this came from package.json, shouldn't be copied

      // Should have metadata that was originally in project.json (includes merged values)
      expect(projectJsonContent.metadata?.description).toEqual('from-project'); // was in original project.json
      expect(projectJsonContent.metadata?.technologies).toEqual([
        'from-package-tech',
        'from-project-tech',
      ]); // merged array (acceptable for this approach)
    });

    it('should allow project.json to override properties from package.json', () => {
      const projectRoot = 'libs/override-test';

      // Create package.json with a name
      writeJson<PackageJson>(tree, `${projectRoot}/package.json`, {
        name: 'package-name',
        version: '1.0.0',
        nx: {
          targets: {
            build: {
              executor: '@nx/webpack:webpack',
              options: {
                outputPath: 'dist/package-name',
              },
            },
          },
        },
      });

      // Create project.json that overrides the name and adds new targets
      writeJson(tree, `${projectRoot}/project.json`, {
        name: 'project-name-override',
        $schema: '../../node_modules/nx/schemas/project-schema.json',
        targets: {
          test: {
            executor: '@nx/jest:jest',
          },
        },
      });

      // Read merged config - project.json name should take precedence
      const mergedConfig = readProjectConfiguration(
        tree,
        'project-name-override'
      );
      expect(mergedConfig.name).toEqual('project-name-override'); // project.json overrides package.json
      expect(mergedConfig.targets?.build).toBeDefined(); // from package.json
      expect(mergedConfig.targets?.test).toBeDefined(); // from project.json

      // Update configuration
      updateProjectConfiguration(tree, 'project-name-override', {
        ...mergedConfig,
        targets: {
          ...mergedConfig.targets,
          lint: {
            executor: '@nx/eslint:lint',
          },
        },
      });

      // Verify project.json keeps the override name and only its targets
      const projectJsonContent = readJson(tree, `${projectRoot}/project.json`);

      expect(projectJsonContent.name).toEqual('project-name-override'); // should keep the override
      expect(projectJsonContent.targets?.test).toBeDefined(); // was in original project.json
      expect(projectJsonContent.targets?.lint).toBeDefined(); // newly added
      expect(projectJsonContent.targets?.build).toBeUndefined(); // came from package.json, shouldn't be copied

      // Verify package.json is unchanged
      const packageJsonContent = readJson(tree, `${projectRoot}/package.json`);
      expect(packageJsonContent.name).toEqual('package-name'); // unchanged
      expect(packageJsonContent.nx.targets?.build).toBeDefined(); // unchanged
    });

    it('should write property to project.json when value differs from package.json', () => {
      const projectRoot = 'libs/override-value-test';

      // Create package.json with some properties
      writeJson<PackageJson>(tree, `${projectRoot}/package.json`, {
        name: 'override-value-test',
        version: '1.0.0',
        nx: {
          tags: ['package-tag'],
          sourceRoot: 'src-from-package',
        },
      });

      // Create project.json with NO tags or sourceRoot initially
      writeJson(tree, `${projectRoot}/project.json`, {
        name: 'override-value-test',
        $schema: '../../node_modules/nx/schemas/project-schema.json',
        targets: {
          build: {
            executor: '@nx/webpack:webpack',
          },
        },
      });

      // Read merged config
      const mergedConfig = readProjectConfiguration(
        tree,
        'override-value-test'
      );
      expect(mergedConfig.tags).toEqual(['package-tag']); // from package.json
      expect(mergedConfig.sourceRoot).toEqual('src-from-package'); // from package.json

      // Update configuration with DIFFERENT values than what's in package.json
      updateProjectConfiguration(tree, 'override-value-test', {
        ...mergedConfig,
        tags: ['overridden-tag'], // different from package.json
        sourceRoot: 'src-overridden', // different from package.json
      });

      // Verify project.json now contains the overridden values
      const projectJsonContent = readJson(tree, `${projectRoot}/project.json`);

      expect(projectJsonContent.tags).toEqual(['overridden-tag']); // should be written to project.json because it's different
      expect(projectJsonContent.sourceRoot).toEqual('src-overridden'); // should be written to project.json because it's different

      // Verify package.json is unchanged
      const packageJsonContent = readJson(tree, `${projectRoot}/package.json`);
      expect(packageJsonContent.nx.tags).toEqual(['package-tag']); // unchanged
      expect(packageJsonContent.nx.sourceRoot).toEqual('src-from-package'); // unchanged
    });
  });
});
