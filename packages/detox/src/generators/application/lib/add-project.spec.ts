import {
  addProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Linter } from '@nrwl/linter';
import { addProject } from './add-project';

describe('Add Project', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'my-app', {
      root: 'my-app',
      targets: {
        serve: {
          executor: 'serve-executor',
          options: {},
          configurations: {
            production: {},
          },
        },
      },
    });
  });

  describe('app at root', () => {
    beforeEach(() => {
      addProject(tree, {
        name: 'my-app-e2e',
        projectName: 'my-app-e2e',
        projectRoot: 'apps/my-app-e2e',
        project: 'my-app',
        appFileName: 'my-app',
        appClassName: 'MyApp',
        linter: Linter.EsLint,
      });
    });

    it('should update workspace.json', () => {
      const project = readProjectConfiguration(tree, 'my-app-e2e');

      expect(project.root).toEqual('apps/my-app-e2e');
      expect(project.sourceRoot).toEqual('apps/my-app-e2e/src');
    });

    it('should update nx.json', () => {
      const project = readProjectConfiguration(tree, 'my-app-e2e');
      expect(project.tags).toEqual([]);
      expect(project.implicitDependencies).toEqual(['my-app']);
    });

    it('should update targets', () => {
      const project = readProjectConfiguration(tree, 'my-app-e2e');
      expect(project.targets).toMatchObject({
        'build-ios': {
          executor: '@nrwl/detox:build',
        },
        'test-ios': {
          executor: '@nrwl/detox:test',
        },
        'build-android': {
          executor: '@nrwl/detox:build',
        },
        'test-android': {
          executor: '@nrwl/detox:test',
        },
      });
    });
  });

  describe('app with directory', () => {
    beforeEach(() => {
      addProject(tree, {
        name: 'my-dir-my-app-e2e',
        projectName: 'my-dir-my-app-e2e',
        projectRoot: 'apps/my-dir/my-app-e2e',
        project: 'my-dir-my-app',
        appFileName: 'my-app',
        appClassName: 'MyApp',
        linter: Linter.EsLint,
      });
    });

    it('should update workspace.json', () => {
      const project = readProjectConfiguration(tree, 'my-dir-my-app-e2e');

      expect(project.root).toEqual('apps/my-dir/my-app-e2e');
      expect(project.sourceRoot).toEqual('apps/my-dir/my-app-e2e/src');
    });

    it('should update nx.json', () => {
      const project = readProjectConfiguration(tree, 'my-dir-my-app-e2e');

      expect(project.tags).toEqual([]);
      expect(project.implicitDependencies).toEqual(['my-dir-my-app']);
    });

    it('should update targets', () => {
      const project = readProjectConfiguration(tree, 'my-dir-my-app-e2e');
      expect(project.targets).toMatchObject({
        'build-ios': {
          executor: '@nrwl/detox:build',
        },
        'test-ios': {
          executor: '@nrwl/detox:test',
        },
        'build-android': {
          executor: '@nrwl/detox:build',
        },
        'test-android': {
          executor: '@nrwl/detox:test',
        },
      });
    });
  });
});
