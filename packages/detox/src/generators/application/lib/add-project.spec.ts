import {
  addProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
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
        e2eDirectory: 'my-app-e2e',
        e2eProjectName: 'my-app-e2e',
        e2eProjectRoot: 'apps/my-app-e2e',
        importPath: '@proj/my-app-e2e',
        appProject: 'my-app',
        appFileName: 'my-app',
        appClassName: 'MyApp',
        appDisplayName: 'MyApp',
        appExpoName: 'MyApp',
        appRoot: 'apps/my-app',
        linter: 'eslint',
        framework: 'react-native',
        useProjectJson: true,
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

    it('should not add executor targets', () => {
      const project = readProjectConfiguration(tree, 'my-app-e2e');
      expect(project.targets).toEqual({});
    });
  });

  describe('app with directory', () => {
    beforeEach(() => {
      addProject(tree, {
        e2eDirectory: 'my-dir-my-app-e2e',
        e2eProjectName: 'my-dir-my-app-e2e',
        e2eProjectRoot: 'apps/my-dir/my-app-e2e',
        importPath: '@proj/my-dir-my-app-e2e',
        appProject: 'my-dir-my-app',
        appFileName: 'my-app',
        appClassName: 'MyApp',
        appDisplayName: 'MyApp',
        appExpoName: 'MyApp',
        appRoot: 'apps/my-dir/my-app',
        linter: 'eslint',
        framework: 'react-native',
        useProjectJson: true,
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

    it('should not add executor targets', () => {
      const project = readProjectConfiguration(tree, 'my-dir-my-app-e2e');
      expect(project.targets).toEqual({});
    });
  });
});
