import Ajv from 'ajv';
import { Tree } from '../tree';
import { ProjectConfiguration } from '../../config/workspace-json-project-json';

import { createTree } from '../testing-utils/create-tree';
import {
  createTreeWithEmptyV1Workspace,
  createTreeWithEmptyWorkspace,
} from '../testing-utils/create-tree-with-empty-workspace';
import { readJson, updateJson, writeJson } from '../utils/json';
import {
  addProjectConfiguration,
  getProjects,
  getWorkspacePath,
  readProjectConfiguration,
  removeProjectConfiguration,
  updateProjectConfiguration,
} from './project-configuration';

import * as projectSchema from '../../../schemas/project-schema.json';
import { joinPathFragments } from '../../utils/path';

type ProjectConfigurationV1 = Pick<
  ProjectConfiguration,
  'root' | 'sourceRoot'
> & {
  architect: {
    [targetName: string]: {
      builder: string;
    };
  };
};

const baseTestProjectConfigV1: ProjectConfigurationV1 = {
  root: 'libs/test',
  sourceRoot: 'libs/test/src',
  architect: {},
};
const baseTestProjectConfigV2: ProjectConfiguration = {
  name: 'test',
  root: 'libs/test',
  sourceRoot: 'libs/test/src',
  targets: {},
};

describe('project configuration', () => {
  let tree: Tree;

  describe('workspace v1', () => {
    beforeEach(() => {
      tree = createTreeWithEmptyV1Workspace();
    });

    describe('readProjectConfiguration', () => {
      it('should get info from workspace.json', () => {
        updateJson(tree, getWorkspacePath(tree), (json) => {
          json.projects['proj1'] = {
            root: 'proj1',
          };
          return json;
        });

        const config = readProjectConfiguration(tree, 'proj1');
        expect(config).toEqual({
          root: 'proj1',
        });
      });

      it('should should not fail if projects is not defined in nx.json', () => {
        updateJson(tree, getWorkspacePath(tree), (json) => {
          json.projects['proj1'] = {
            root: 'proj1',
          };
          return json;
        });
        updateJson(tree, 'nx.json', (json) => {
          delete json.projects;
          return json;
        });

        const config = readProjectConfiguration(tree, 'proj1');
        expect(config).toEqual({
          root: 'proj1',
        });
      });
    });

    describe('addProjectConfiguration', () => {
      it('should throw when standalone is true', () => {
        expect(() =>
          addProjectConfiguration(tree, 'test', baseTestProjectConfigV2, true)
        ).toThrow();
      });

      it('should update workspace.json file correctly', () => {
        addProjectConfiguration(tree, 'test', baseTestProjectConfigV2);

        expect(readJson(tree, 'workspace.json').projects.test).toEqual(
          baseTestProjectConfigV1
        );
      });
    });

    describe('without nx.json', () => {
      beforeEach(() => tree.delete('nx.json'));

      afterEach(() => expect(tree.exists('nx.json')).toEqual(false));

      it('should throw when standalone is true', () => {
        expect(() =>
          addProjectConfiguration(tree, 'test', baseTestProjectConfigV2, true)
        ).toThrow();
      });

      it('should update workspace.json file correctly when adding a project', () => {
        addProjectConfiguration(tree, 'test', baseTestProjectConfigV2, false);

        expect(readJson(tree, 'workspace.json').projects.test).toEqual(
          baseTestProjectConfigV1
        );
      });

      it('should update workspace.json file correctly when updating a project', () => {
        addProjectConfiguration(tree, 'test', baseTestProjectConfigV2, false);
        const updatedProjectConfiguration = {
          ...baseTestProjectConfigV2,
          targets: { build: { executor: '' } },
        };
        const expectedProjectConfiguration = {
          ...baseTestProjectConfigV1,
          architect: { build: { builder: '' } },
        };
        updateProjectConfiguration(tree, 'test', updatedProjectConfiguration);

        expect(readJson(tree, 'workspace.json').projects.test).toEqual(
          expectedProjectConfiguration
        );
      });

      it('should remove project configuration', () => {
        addProjectConfiguration(tree, 'test', baseTestProjectConfigV2, false);
        removeProjectConfiguration(tree, 'test');

        expect(readJson(tree, 'workspace.json').projects.test).toBeUndefined();
      });
    });
  });

  describe('workspace v2', () => {
    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    });

    describe('readProjectConfiguration', () => {
      it('should get info from workspace.json', () => {
        writeJson(tree, 'workspace.json', {
          version: 2,
          projects: {
            proj1: {
              root: 'proj1',
            },
          },
        });

        const config = readProjectConfiguration(tree, 'proj1');
        expect(config).toEqual({
          root: 'proj1',
        });
      });

      it('should should not fail if projects is not defined in nx.json', () => {
        writeJson(tree, 'libs/proj1/project.json', {
          name: 'proj1',
        });
        updateJson(tree, 'nx.json', (json) => {
          delete json.projects;
          return json;
        });

        const config = readProjectConfiguration(tree, 'proj1');
        expect(config).toEqual({
          name: 'proj1',
          root: 'libs/proj1',
        });
      });
    });

    describe('addProjectConfiguration', () => {
      it('should create project.json file when adding a project if standalone is true', () => {
        addProjectConfiguration(tree, 'test', baseTestProjectConfigV2, true);

        expect(tree.exists('libs/test/project.json')).toBeTruthy();
      });

      it('should create project.json file if all other apps in the workspace use project.json', () => {
        addProjectConfiguration(
          tree,
          'project-a',
          {
            root: 'apps/project-a',
            targets: {},
          },
          true
        );
        addProjectConfiguration(tree, 'project-b', {
          root: 'apps/project-b',
          targets: {},
        });
        expect(tree.exists('apps/project-b/project.json')).toBeTruthy();
      });

      it("should not create project.json file if any other app in the workspace doesn't use project.json", () => {
        writeJson(tree, 'workspace.json', {
          version: 2,
          projects: {},
        });
        addProjectConfiguration(
          tree,
          'project-a',
          {
            root: 'apps/project-a',
            targets: {},
          },
          false
        );
        addProjectConfiguration(tree, 'project-b', {
          root: 'apps/project-b',
          targets: {},
        });
        expect(tree.exists('apps/project-a/project.json')).toBeFalsy();
        expect(tree.exists('apps/project-b/project.json')).toBeFalsy();
      });

      it('should not create project.json file when adding a project if standalone is false', () => {
        writeJson(tree, 'workspace.json', {
          version: 2,
          projects: {},
        });
        addProjectConfiguration(tree, 'test', baseTestProjectConfigV2, false);

        expect(tree.exists('libs/test/project.json')).toBeFalsy();
      });

      it('should be able to read from standalone projects', () => {
        tree.write(
          'libs/test/project.json',
          JSON.stringify(baseTestProjectConfigV2, null, 2)
        );
        tree.write(
          'workspace.json',
          JSON.stringify(
            {
              projects: {
                test: 'libs/test',
              },
            },
            null,
            2
          )
        );

        const projectConfig = readProjectConfiguration(tree, 'test');

        expect(projectConfig).toEqual(baseTestProjectConfigV2);
      });

      it('should update project.json file when updating a project', () => {
        addProjectConfiguration(tree, 'test', baseTestProjectConfigV2, true);
        const expectedProjectConfig = {
          ...baseTestProjectConfigV2,
          targets: { build: { executor: '' } },
        };
        updateProjectConfiguration(tree, 'test', expectedProjectConfig);

        expect(readJson(tree, 'libs/test/project.json')).toEqual({
          name: 'test',
          ...expectedProjectConfig,
          root: undefined,
        });
      });

      it('should update workspace.json file when updating an inline project', () => {
        writeJson(tree, 'workspace.json', {
          version: 2,
          projects: {},
        });
        addProjectConfiguration(tree, 'test', baseTestProjectConfigV2, false);
        const expectedProjectConfig = {
          ...baseTestProjectConfigV2,
          targets: { build: { executor: '' } },
        };
        updateProjectConfiguration(tree, 'test', expectedProjectConfig);

        expect(readJson(tree, 'workspace.json').projects.test).toEqual(
          expectedProjectConfig
        );
      });

      it('should remove project.json file when removing project configuration', () => {
        addProjectConfiguration(tree, 'test', baseTestProjectConfigV2, true);
        removeProjectConfiguration(tree, 'test');

        expect(tree.exists('test/project.json')).toBeFalsy();
      });

      it('should support workspaces with standalone and inline projects', () => {
        writeJson(tree, 'workspace.json', {
          version: 2,
          projects: {},
        });
        addProjectConfiguration(tree, 'test', baseTestProjectConfigV2, true);
        addProjectConfiguration(tree, 'test2', baseTestProjectConfigV2, false);
        const configurations = getProjects(tree);
        expect(configurations.get('test')).toEqual({
          $schema: '../../node_modules/nx/schemas/project-schema.json',
          name: 'test',
          ...baseTestProjectConfigV2,
        });
        expect(configurations.get('test2')).toEqual({
          ...baseTestProjectConfigV2,
        });
      });

      describe('JSON schema', () => {
        it('should have JSON $schema in project configuration for standalone projects', () => {
          addProjectConfiguration(tree, 'test', baseTestProjectConfigV2, true);
          const projectJson = readJson(tree, 'libs/test/project.json');
          expect(projectJson['$schema']).toBeTruthy();
          expect(projectJson['$schema']).toEqual(
            '../../node_modules/nx/schemas/project-schema.json'
          );
        });

        it('should match project configuration with JSON $schema', () => {
          const ajv = new Ajv();
          const validate = ajv.compile(projectSchema);

          addProjectConfiguration(tree, 'test', baseTestProjectConfigV2, true);
          const projectJson = readJson(tree, 'libs/test/project.json');

          expect(validate(projectJson)).toEqual(true);
        });
      });
    });

    describe('getProjects', () => {
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

    describe('without nx.json', () => {
      beforeEach(() => tree.delete('nx.json'));

      afterEach(() => expect(tree.exists('nx.json')).toEqual(false));

      it('should create project.json file when adding a project if standalone is true', () => {
        addProjectConfiguration(tree, 'test', baseTestProjectConfigV2, true);

        expect(tree.exists('libs/test/project.json')).toBeTruthy();
      });

      it('should create project.json file if all other apps in the workspace use project.json', () => {
        addProjectConfiguration(
          tree,
          'project-a',
          {
            root: 'apps/project-a',
            targets: {},
          },
          true
        );
        addProjectConfiguration(
          tree,
          'project-b',
          {
            root: 'apps/project-b',
            targets: {},
          },
          true
        );
        expect(tree.exists('apps/project-b/project.json')).toBeTruthy();
      });

      it("should not create project.json file if any other app in the workspace doesn't use project.json", () => {
        writeJson(tree, 'workspace.json', {
          version: 2,
          projects: {},
        });
        addProjectConfiguration(
          tree,
          'project-a',
          {
            root: 'apps/project-a',
            targets: {},
          },
          false
        );
        addProjectConfiguration(tree, 'project-b', {
          root: 'apps/project-b',
          targets: {},
        });
        expect(tree.exists('apps/project-a/project.json')).toBeFalsy();
        expect(tree.exists('apps/project-b/project.json')).toBeFalsy();
      });

      it('should not create project.json file when adding a project if standalone is false', () => {
        writeJson(tree, 'workspace.json', {
          version: 2,
          projects: {},
        });
        addProjectConfiguration(tree, 'test', baseTestProjectConfigV2, false);

        expect(tree.exists('libs/test/project.json')).toBeFalsy();
      });

      it('should be able to read from standalone projects', () => {
        tree.write(
          'workspace.json',
          JSON.stringify(
            {
              projects: {
                test: {
                  root: '/libs/test',
                },
              },
            },
            null,
            2
          )
        );

        const projectConfig = readProjectConfiguration(tree, 'test');

        expect(projectConfig).toEqual({
          root: '/libs/test',
        });
      });

      it('should update project.json file when updating a project', () => {
        addProjectConfiguration(tree, 'test', baseTestProjectConfigV2, true);
        const expectedProjectConfig = {
          ...baseTestProjectConfigV2,
          targets: { build: { executor: '' } },
        };
        updateProjectConfiguration(tree, 'test', expectedProjectConfig);

        expect(readJson(tree, 'libs/test/project.json')).toEqual({
          name: 'test',
          ...expectedProjectConfig,
          root: undefined,
        });
      });

      it('should update workspace.json file when updating an inline project', () => {
        writeJson(tree, 'workspace.json', {
          version: 2,
          projects: {},
        });
        addProjectConfiguration(tree, 'test', baseTestProjectConfigV2, false);
        const expectedProjectConfig = {
          ...baseTestProjectConfigV2,
          targets: { build: { executor: '' } },
        };
        updateProjectConfiguration(tree, 'test', expectedProjectConfig);

        expect(readJson(tree, 'workspace.json').projects.test).toEqual(
          expectedProjectConfig
        );
      });

      it('should remove project.json file when removing project configuration', () => {
        addProjectConfiguration(tree, 'test', baseTestProjectConfigV2, true);
        removeProjectConfiguration(tree, 'test');

        expect(tree.exists('test/project.json')).toBeFalsy();
      });

      it('should remove project configuration', () => {
        addProjectConfiguration(tree, 'test', baseTestProjectConfigV2, false);
        removeProjectConfiguration(tree, 'test');

        expect(
          tree.exists(
            joinPathFragments(baseTestProjectConfigV2.root, 'project.json')
          )
        ).toBeFalsy();
      });

      describe('getProjects', () => {
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
    });
  });

  describe('for npm workspaces', () => {
    beforeEach(() => {
      tree = createTree();
    });

    describe('readProjectConfiguration', () => {
      it('should read project configuration from package.json files', () => {
        writeJson(tree, 'proj/package.json', {
          name: 'proj',
        });

        const proj = readProjectConfiguration(tree, 'proj');

        expect(proj).toEqual({
          root: 'proj',
          sourceRoot: 'proj',
          projectType: 'library',
        });
      });
    });

    describe('getProjects', () => {
      beforeEach(() => {
        writeJson(tree, 'proj/package.json', {
          name: 'proj',
        });
      });

      it('should get a map of projects', () => {
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
});
