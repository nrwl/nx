import {
  addProjectConfiguration,
  NxJsonConfiguration,
  Tree,
  updateJson,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import configurationGenerator from './configuration';
import * as workspaceConfiguration from './test-configs/root-workspace-configuration.json';
import { storybookVersion } from '../../utils/versions';

// nested code imports graph from the repo, which might have innacurate graph version
jest.mock('nx/src/project-graph/project-graph', () => ({
  ...jest.requireActual<any>('nx/src/project-graph/project-graph'),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(async () => ({ nodes: {}, dependencies: {} })),
}));

describe('@nx/storybook:configuration for workspaces with Root project', () => {
  describe('basic functionalities', () => {
    let tree: Tree;
    beforeEach(async () => {
      tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
        json.namedInputs = {
          production: ['default'],
        };
        return json;
      });
      writeConfig(tree, workspaceConfiguration);
      writeJson(tree, 'tsconfig.json', {
        extends: './tsconfig.base.json',
        compilerOptions: {
          jsx: 'react-jsx',
          allowJs: false,
          esModuleInterop: false,
          allowSyntheticDefaultImports: true,
          forceConsistentCasingInFileNames: true,
          isolatedModules: true,
          lib: ['DOM', 'DOM.Iterable', 'ESNext'],
          module: 'ESNext',
          moduleResolution: 'Node',
          noEmit: true,
          resolveJsonModule: true,
          skipLibCheck: true,
          strict: true,
          target: 'ESNext',
          types: ['vite/client', 'vitest'],
          useDefineForClassFields: true,
          noImplicitOverride: true,
          noPropertyAccessFromIndexSignature: true,
          noImplicitReturns: true,
          noFallthroughCasesInSwitch: true,
        },
        files: [],
        include: [],
        references: [
          {
            path: './tsconfig.app.json',
          },
          {
            path: './tsconfig.spec.json',
          },
          {
            path: './tsconfig.storybook.json',
          },
        ],
      });
      writeJson(tree, 'package.json', {
        devDependencies: {
          '@storybook/react-webpack5': storybookVersion,
          storybook: storybookVersion,
        },
      });

      jest.resetModules();
      jest.doMock('storybook/package.json', () => ({
        version: storybookVersion,
      }));
    });

    it('should generate files for root app - js for tsConfiguration: false', async () => {
      await configurationGenerator(tree, {
        project: 'web',
        uiFramework: '@storybook/react-webpack5',
        tsConfiguration: false,
        addPlugin: true,
      });

      expect(tree.exists('.storybook/main.js')).toBeTruthy();
      expect(tree.exists('tsconfig.storybook.json')).toBeTruthy();
      expect(tree.exists('.storybook/preview.js')).toBeTruthy();
    });

    it('should generate Storybook files for nested project only', async () => {
      writeJson(tree, 'apps/reapp/tsconfig.json', {});

      await configurationGenerator(tree, {
        project: 'reapp',
        uiFramework: '@storybook/react-webpack5',
        addPlugin: true,
      });

      expect(tree.exists('.storybook/main.ts')).toBeFalsy();
      expect(tree.exists('tsconfig.storybook.json')).toBeFalsy();
      expect(tree.exists('.storybook/preview.ts')).toBeFalsy();

      expect(tree.exists('apps/reapp/.storybook/main.ts')).toBeTruthy();
      expect(tree.exists('apps/reapp/tsconfig.storybook.json')).toBeTruthy();
      expect(tree.exists('apps/reapp/.storybook/preview.ts')).toBeTruthy();

      await configurationGenerator(tree, {
        project: 'web',
        uiFramework: '@storybook/react-vite',
        addPlugin: true,
      });

      expect(tree.exists('.storybook/main.ts')).toBeTruthy();
      expect(tree.exists('tsconfig.storybook.json')).toBeTruthy();
      expect(tree.exists('.storybook/preview.ts')).toBeTruthy();

      expect(tree.read('.storybook/main.ts', 'utf-8')).toMatchSnapshot();
      expect(tree.read('tsconfig.storybook.json', 'utf-8')).toMatchSnapshot();
      expect(tree.read('.storybook/preview.ts', 'utf-8')).toMatchSnapshot();
      expect(
        tree.read('apps/reapp/.storybook/main.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('apps/reapp/tsconfig.storybook.json', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('apps/reapp/.storybook/preview.ts', 'utf-8')
      ).toMatchSnapshot();
    });
  });
});

function writeConfig(tree: Tree, config: any) {
  Object.keys(config.projects).forEach((project) => {
    addProjectConfiguration(tree, project, config.projects[project]);
  });
}
