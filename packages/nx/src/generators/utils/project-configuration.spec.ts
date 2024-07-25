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
  });
});
