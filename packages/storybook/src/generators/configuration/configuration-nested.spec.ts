import {
  addProjectConfiguration,
  NxJsonConfiguration,
  Tree,
  updateJson,
  writeJson,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import * as enquirer from 'enquirer';

import configurationGenerator from './configuration';
import * as workspaceConfiguration from './test-configs/root-workspace-configuration.json';

// nested code imports graph from the repo, which might have innacurate graph version
jest.mock('nx/src/project-graph/project-graph', () => ({
  ...jest.requireActual<any>('nx/src/project-graph/project-graph'),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(async () => ({ nodes: {}, dependencies: {} })),
}));

jest.mock('enquirer');
// @ts-ignore
enquirer.prompt = jest.fn();
describe('@nrwl/storybook:configuration for workspaces with Root project', () => {
  beforeAll(() => {
    process.env.NX_INTERACTIVE = 'true';
  });
  afterAll(() => {
    // cleanup
    delete process.env.NX_INTERACTIVE;
  });
  describe('basic functionalities', () => {
    let tree: Tree;
    // @ts-ignore
    enquirer.prompt = jest
      .fn()
      .mockReturnValue(Promise.resolve({ bundler: 'webpack' }));
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
            path: './.storybook/tsconfig.json',
          },
        ],
      });
      writeJson(tree, 'package.json', {
        devDependencies: {
          '@storybook/addon-essentials': '~6.2.9',
          '@storybook/react': '~6.2.9',
        },
      });
    });

    it('should generate files for root app', async () => {
      await configurationGenerator(tree, {
        name: 'web',
        uiFramework: '@storybook/react',
      });

      expect(enquirer.prompt).toHaveBeenCalled();
      expect(tree.exists('.storybook/main.js')).toBeTruthy();
      expect(tree.exists('.storybook/tsconfig.json')).toBeTruthy();
      expect(tree.exists('.storybook/preview.js')).toBeTruthy();
    });

    it('should generate Storybook files for nested project only', async () => {
      writeJson(tree, 'apps/reapp/tsconfig.json', {});

      await configurationGenerator(tree, {
        name: 'reapp',
        uiFramework: '@storybook/react',
        tsConfiguration: true,
      });

      expect(tree.exists('.storybook/main.ts')).toBeFalsy();
      expect(tree.exists('.storybook/tsconfig.json')).toBeFalsy();
      expect(tree.exists('.storybook/preview.ts')).toBeFalsy();

      expect(tree.exists('apps/reapp/.storybook/main.ts')).toBeTruthy();
      expect(tree.exists('apps/reapp/.storybook/tsconfig.json')).toBeTruthy();
      expect(tree.exists('apps/reapp/.storybook/preview.ts')).toBeTruthy();

      await configurationGenerator(tree, {
        name: 'web',
        uiFramework: '@storybook/react',
        tsConfiguration: true,
      });

      expect(tree.exists('.storybook/main.ts')).toBeTruthy();
      expect(tree.exists('.storybook/tsconfig.json')).toBeTruthy();
      expect(tree.exists('.storybook/preview.ts')).toBeTruthy();

      expect(tree.read('.storybook/main.ts', 'utf-8')).toMatchSnapshot();
      expect(tree.read('.storybook/tsconfig.json', 'utf-8')).toMatchSnapshot();
      expect(tree.read('.storybook/preview.ts', 'utf-8')).toMatchSnapshot();
      expect(
        tree.read('apps/reapp/.storybook/main.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('apps/reapp/.storybook/tsconfig.json', 'utf-8')
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
