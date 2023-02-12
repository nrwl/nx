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
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
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
        e2eName: 'my-app-e2e',
        e2eProjectName: 'my-app-e2e',
        e2eProjectDirectory: 'apps',
        e2eProjectRoot: 'apps/my-app-e2e',
        appProject: 'my-app',
        appFileName: 'my-app',
        appClassName: 'MyApp',
        appDisplayName: 'MyApp',
        appExpoName: 'MyApp',
        appRoot: 'apps/my-app',
        linter: Linter.EsLint,
        framework: 'react-native',
      });
    });

    it('should update configuration', () => {
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
        e2eName: 'my-dir-my-app-e2e',
        e2eProjectName: 'my-dir-my-app-e2e',
        e2eProjectDirectory: 'apps',
        e2eProjectRoot: 'apps/my-dir/my-app-e2e',
        appProject: 'my-dir-my-app',
        appFileName: 'my-app',
        appClassName: 'MyApp',
        appDisplayName: 'MyApp',
        appExpoName: 'MyApp',
        appRoot: 'apps/my-dir/my-app',
        linter: Linter.EsLint,
        framework: 'react-native',
      });
    });

    it('should update configuration', () => {
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
