let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  createProjectGraphAsync: jest.fn().mockImplementation(async () => {
    return projectGraph;
  }),
}));

import {
  addProjectConfiguration,
  type ProjectGraph,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { createJestConfig } from './create-jest-config';

describe('createJestConfig', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    projectGraph = { nodes: {}, dependencies: {} };
  });

  it('should generate files with --js flag', async () => {
    await createJestConfig(tree, { js: true }, 'js');

    expect(tree.exists('jest.config.js')).toBeTruthy();
    expect(tree.read('jest.config.js', 'utf-8')).toMatchSnapshot();
    expect(tree.read('jest.preset.js', 'utf-8')).toMatchSnapshot();
  });

  it('should generate files ', async () => {
    await createJestConfig(tree, {}, 'js');

    expect(tree.exists('jest.config.ts')).toBeTruthy();
    expect(tree.read('jest.config.ts', 'utf-8')).toMatchSnapshot();
    expect(tree.read('jest.preset.js', 'utf-8')).toMatchSnapshot();
  });

  it('should make js jest files', async () => {
    await createJestConfig(tree, { js: true }, 'js');

    expect(tree.exists('jest.config.js')).toBeTruthy();
    expect(tree.exists('jest.preset.js')).toBeTruthy();
  });

  describe('root project', () => {
    it('should not add a monorepo jest.config.ts  to the project', async () => {
      await createJestConfig(tree, { rootProject: true }, 'js');

      expect(tree.exists('jest.config.ts')).toBeFalsy();
    });

    const projectConfig = `export default { displayName: 'my-project' };`;
    const workspaceConfig = `import { getJestProjectsAsync } from '@nx/jest';
export default async () => ({
  projects: await getJestProjectsAsync(),
  extraThing: "Goes Here"
});
`;

    // Before Nx 24, these targets made the generator rename the root config
    function addRootProject(test: TargetConfiguration, graphTest = test) {
      addProjectConfiguration(tree, 'my-project', {
        root: '.',
        projectType: 'application',
        targets: { test },
      });
      projectGraph.nodes['my-project'] = {
        name: 'my-project',
        type: 'app',
        data: { root: '.', targets: { test: graphTest } },
      };
    }

    it.each(['ts', 'js', 'cjs', 'mts'])(
      'should leave the root project jest.config.%s untouched',
      async (ext) => {
        addRootProject({
          executor: '@nx/jest:jest',
          options: { jestConfig: `jest.config.${ext}` },
        });
        tree.write(`jest.config.${ext}`, projectConfig);

        await createJestConfig(tree, { rootProject: false }, 'js');

        expect(tree.read(`jest.config.${ext}`, 'utf-8')).toEqual(projectConfig);
        expect(
          tree.listChanges().filter((c) => c.path.startsWith('jest.config.'))
        ).toHaveLength(1);
      }
    );

    it('should leave the root project jest.config.ts untouched when its test target runs jest', async () => {
      addRootProject(
        { executor: 'nx:run-commands', command: 'jest' },
        { executor: 'nx:run-commands', options: { command: 'jest' } }
      );
      tree.write('jest.config.ts', projectConfig);

      await createJestConfig(tree, { rootProject: false }, 'js');

      expect(tree.read('jest.config.ts', 'utf-8')).toEqual(projectConfig);
      expect(tree.exists('jest.config.app.ts')).toBe(false);
    });

    it('should leave an existing workspace config untouched', async () => {
      tree.write('jest.config.ts', workspaceConfig);

      await createJestConfig(tree, { rootProject: false }, 'js');

      expect(tree.read('jest.config.ts', 'utf-8')).toEqual(workspaceConfig);
      expect(tree.exists('jest.config.app.ts')).toBe(false);
      expect(tree.exists('jest.config.lib.ts')).toBe(false);
    });
  });
});
