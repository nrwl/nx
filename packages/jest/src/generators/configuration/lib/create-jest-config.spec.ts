let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  createProjectGraphAsync: jest.fn().mockImplementation(async () => {
    return projectGraph;
  }),
}));

import {
  addProjectConfiguration as _addProjectConfiguration,
  readJson,
  readProjectConfiguration,
  writeJson,
  type ProjectConfiguration,
  type ProjectGraph,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { createJestConfig } from './create-jest-config';

function addProjectConfiguration(
  tree: Tree,
  name: string,
  project: ProjectConfiguration
) {
  _addProjectConfiguration(tree, name, project);
  projectGraph.nodes[name] = {
    name: name,
    type: 'lib',
    data: {
      root: project.root,
      targets: project.targets,
    },
  };
}

describe('createJestConfig', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    projectGraph = {
      nodes: {},
      dependencies: {},
      externalNodes: {},
    };
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

  it('should not override existing files', async () => {
    addProjectConfiguration(tree, 'my-project', {
      root: 'apps/my-app',
      name: 'my-app',
      sourceRoot: 'apps/my-app/src',
      targets: {
        test: {
          executor: '@nx/jest:jest',
          options: {
            jestConfig: 'apps/my-app/jest.config.ts',
          },
        },
      },
    });
    const expected = `
import { getJestProjectsAsync } from '@nx/jest';
export default async () => ({
  projects: await getJestProjectsAsync(),
  extraThing: "Goes Here"
});
`;
    tree.write('jest.config.ts', expected);

    await createJestConfig(tree, {}, 'js');

    expect(tree.read('jest.config.ts', 'utf-8')).toEqual(expected);
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

    const tsAggregator = `import type { Config } from 'jest';
import { getJestProjectsAsync } from '@nx/jest';

export default async (): Promise<Config> => ({
  projects: await getJestProjectsAsync()
});`;
    const jsAggregator = `const { getJestProjectsAsync } = require('@nx/jest');

module.exports = async () => ({
  projects: await getJestProjectsAsync()
});`;
    const rootProjectJestConfig = `export default { displayName: 'my-project' };`;

    function addRootProject(
      graphTargets: ProjectConfiguration['targets'],
      targets?: ProjectConfiguration['targets']
    ) {
      addProjectConfiguration(tree, 'my-project', {
        root: '.',
        name: 'my-project',
        projectType: 'application',
        sourceRoot: 'src',
        targets,
      });
      projectGraph.nodes['my-project'].data.targets = graphTargets;
    }

    it.each([
      ['jest.config.ts', false, 'jest.config.app.ts', tsAggregator],
      ['jest.config.js', true, 'jest.config.app.js', jsAggregator],
      ['jest.config.ts', true, 'jest.config.app.ts', jsAggregator],
    ])(
      'should move the root project %s with js: %s to %s',
      async (rootConfig, js, projectConfig, aggregator) => {
        addRootProject({
          'unit-test': {
            executor: 'nx:run-commands',
            options: { command: 'jest' },
          },
        });
        tree.write(rootConfig, rootProjectJestConfig);

        await createJestConfig(tree, { js, rootProject: false }, 'js');

        expect(tree.read(projectConfig, 'utf-8')).toEqual(
          rootProjectJestConfig
        );
        expect(tree.read(`jest.config.${js ? 'js' : 'ts'}`, 'utf-8')).toEqual(
          aggregator
        );
        expect(
          readProjectConfiguration(tree, 'my-project').targets
        ).toBeUndefined();
      }
    );

    it.each([
      [{ command: 'jest' }, { command: 'jest --config jest.config.app.ts' }],
      [
        { executor: 'nx:run-commands', options: { command: 'jest' } },
        {
          executor: 'nx:run-commands',
          options: { command: 'jest --config jest.config.app.ts' },
        },
      ],
    ])(
      'should point the project.json target %j to the moved config',
      async (target, expected) => {
        addRootProject(
          {
            test: { executor: 'nx:run-commands', options: { command: 'jest' } },
          },
          { test: target }
        );
        tree.write('jest.config.ts', rootProjectJestConfig);

        await createJestConfig(tree, { rootProject: false }, 'js');

        expect(
          readProjectConfiguration(tree, 'my-project').targets.test
        ).toEqual(expected);
      }
    );

    it('should point the root tsconfig.spec.json to the moved config', async () => {
      addRootProject({
        test: { executor: 'nx:run-commands', options: { command: 'jest' } },
      });
      tree.write('jest.config.cts', rootProjectJestConfig);
      writeJson(tree, 'tsconfig.spec.json', {
        include: ['jest.config.ts', './jest.config.cts', 'src/**/*.spec.ts'],
      });

      await createJestConfig(tree, { rootProject: false }, 'js');

      expect(readJson(tree, 'tsconfig.spec.json').include).toEqual([
        'jest.config.app.ts',
        './jest.config.app.cts',
        'src/**/*.spec.ts',
      ]);
    });

    it('should not move the workspace config on a second run', async () => {
      addRootProject({
        test: { executor: 'nx:run-commands', options: { command: 'jest' } },
      });
      tree.write('jest.config.ts', rootProjectJestConfig);

      await createJestConfig(tree, { rootProject: false }, 'js');
      await createJestConfig(tree, { rootProject: false }, 'js');

      expect(tree.read('jest.config.app.ts', 'utf-8')).toEqual(
        rootProjectJestConfig
      );
      expect(tree.read('jest.config.ts', 'utf-8')).toEqual(tsAggregator);
    });
  });
});
