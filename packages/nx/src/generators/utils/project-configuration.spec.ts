import Ajv from 'ajv';
import { Tree } from '../tree';
import { ProjectConfiguration } from '../../config/workspace-json-project-json';

import { createTree } from '../testing-utils/create-tree';
import { createTreeWithEmptyWorkspace } from '../testing-utils/create-tree-with-empty-workspace';
import { readJson, updateJson, writeJson } from '../utils/json';
import {
  addProjectConfiguration,
  getProjects,
  readProjectConfiguration,
  removeProjectConfiguration,
  updateProjectConfiguration,
} from './project-configuration';

import * as projectSchema from '../../../schemas/project-schema.json';
import { joinPathFragments } from '../../utils/path';

const projectConfiguration: ProjectConfiguration = {
  name: 'test',
  root: 'libs/test',
  sourceRoot: 'libs/test/src',
  targets: {},
};

describe('project configuration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should create project.json file when adding a project if standalone is true', () => {
    addProjectConfiguration(tree, 'test', projectConfiguration);

    expect(readProjectConfiguration(tree, 'test')).toMatchInlineSnapshot(`
      {
        "$schema": "../../node_modules/nx/schemas/project-schema.json",
        "name": "test",
        "root": "libs/test",
        "sourceRoot": "libs/test/src",
        "targets": {},
      }
    `);
    expect(tree.exists('libs/test/project.json')).toBeTruthy();
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
    });

    it('should read project configuration from package.json files', () => {
      writeJson(tree, 'proj/package.json', {
        name: 'proj',
        nx: {},
      });

      const proj = readProjectConfiguration(tree, 'proj');

      expect(proj).toEqual({
        root: 'proj',
        sourceRoot: 'proj',
        projectType: 'library',
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
        root: 'proj',
        sourceRoot: 'proj',
        projectType: 'library',
      });
    });
  });
});
