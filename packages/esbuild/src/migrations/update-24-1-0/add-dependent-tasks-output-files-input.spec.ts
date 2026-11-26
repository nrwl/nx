import {
  addProjectConfiguration,
  readNxJson,
  readProjectConfiguration,
  updateNxJson,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './add-dependent-tasks-output-files-input';

const DEPENDENT_OUTPUTS = {
  dependentTasksOutputFiles: '**/*',
  transitive: true,
};

describe('add-dependent-tasks-output-files-input', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  function setTargetDefaults(targetDefaults: any) {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = targetDefaults;
    updateNxJson(tree, nxJson);
  }

  it('should add the input to the executor-keyed target defaults', async () => {
    setTargetDefaults({
      '@nx/esbuild:esbuild': {
        cache: true,
        dependsOn: ['^build'],
        inputs: ['production', '^production'],
      },
    });

    await update(tree);

    expect(readNxJson(tree).targetDefaults['@nx/esbuild:esbuild']).toEqual({
      cache: true,
      dependsOn: ['^build'],
      inputs: ['production', '^production', DEPENDENT_OUTPUTS],
    });
  });

  it('should add the input to target-keyed and filtered entries for the executor', async () => {
    setTargetDefaults({
      build: [
        {
          filter: { executor: '@nx/esbuild:esbuild' },
          inputs: ['production'],
        },
        { filter: { executor: '@nx/js:tsc' }, inputs: ['production'] },
      ],
      bundle: { executor: '@nx/esbuild:esbuild', inputs: ['default'] },
    });

    await update(tree);

    expect(readNxJson(tree).targetDefaults).toEqual({
      build: [
        {
          filter: { executor: '@nx/esbuild:esbuild' },
          inputs: ['production', DEPENDENT_OUTPUTS],
        },
        { filter: { executor: '@nx/js:tsc' }, inputs: ['production'] },
      ],
      bundle: {
        executor: '@nx/esbuild:esbuild',
        inputs: ['default', DEPENDENT_OUTPUTS],
      },
    });
  });

  it('should add the input to project targets that declare inputs', async () => {
    addProjectConfiguration(tree, 'api', {
      root: 'apps/api',
      targets: {
        build: {
          executor: '@nx/esbuild:esbuild',
          inputs: ['production', '^production'],
        },
        bundle: { executor: '@nx/esbuild:esbuild' },
        compile: { executor: '@nx/js:tsc', inputs: ['production'] },
      },
    });

    await update(tree);

    expect(readProjectConfiguration(tree, 'api').targets).toEqual({
      build: {
        executor: '@nx/esbuild:esbuild',
        inputs: ['production', '^production', DEPENDENT_OUTPUTS],
      },
      bundle: { executor: '@nx/esbuild:esbuild' },
      compile: { executor: '@nx/js:tsc', inputs: ['production'] },
    });
  });

  it('should keep an existing dependentTasksOutputFiles input', async () => {
    setTargetDefaults({
      '@nx/esbuild:esbuild': {
        inputs: ['production', { dependentTasksOutputFiles: '**/*.js' }],
      },
    });

    await update(tree);

    expect(
      readNxJson(tree).targetDefaults['@nx/esbuild:esbuild'].inputs
    ).toEqual(['production', { dependentTasksOutputFiles: '**/*.js' }]);
  });

  it('should not change a workspace that has no esbuild inputs to extend', async () => {
    setTargetDefaults({
      '@nx/js:tsc': { inputs: ['production', '^production'] },
      '@nx/esbuild:esbuild': { cache: true },
    });
    addProjectConfiguration(tree, 'lib', {
      root: 'libs/lib',
      targets: { build: { executor: '@nx/js:tsc', inputs: ['production'] } },
    });
    const nxJson = readNxJson(tree);
    const project = readProjectConfiguration(tree, 'lib');

    await update(tree);

    expect(readNxJson(tree)).toEqual(nxJson);
    expect(readProjectConfiguration(tree, 'lib')).toEqual(project);
  });

  it('should change nothing when run a second time', async () => {
    setTargetDefaults({
      '@nx/esbuild:esbuild': { inputs: ['production', '^production'] },
    });
    addProjectConfiguration(tree, 'api', {
      root: 'apps/api',
      targets: {
        build: { executor: '@nx/esbuild:esbuild', inputs: ['default'] },
      },
    });

    await update(tree);
    const nxJson = tree.read('nx.json', 'utf-8');
    const project = tree.read('apps/api/project.json', 'utf-8');
    await update(tree);

    expect(tree.read('nx.json', 'utf-8')).toBe(nxJson);
    expect(tree.read('apps/api/project.json', 'utf-8')).toBe(project);
  });
});
