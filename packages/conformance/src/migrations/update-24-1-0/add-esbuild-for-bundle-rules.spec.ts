import {
  addProjectConfiguration,
  readJson,
  type Tree,
  updateJson,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { esbuildVersion } from '../../utils/versions';
import update from './add-esbuild-for-bundle-rules';

describe('add-esbuild-for-bundle-rules migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  function addRulesProject(target: Record<string, unknown>) {
    addProjectConfiguration(tree, 'conformance-rules', {
      root: 'packages/conformance-rules',
      targets: { build: target },
    });
  }

  it('should add esbuild when a target uses the bundle-rules executor', async () => {
    addRulesProject({ executor: '@nx/conformance:bundle-rules' });

    await update(tree);

    expect(readJson(tree, 'package.json').devDependencies.esbuild).toBe(
      esbuildVersion
    );
  });

  it('should add esbuild when the executor comes from targetDefaults', async () => {
    updateJson(tree, 'nx.json', (json) => ({
      ...json,
      targetDefaults: {
        build: { executor: '@nx/conformance:bundle-rules' },
      },
    }));
    addRulesProject({ options: { outputPath: 'dist/rules' } });

    await update(tree);

    expect(readJson(tree, 'package.json').devDependencies.esbuild).toBe(
      esbuildVersion
    );
  });

  it('should keep an existing esbuild declaration', async () => {
    addRulesProject({ executor: '@nx/conformance:bundle-rules' });
    writeJson(tree, 'package.json', {
      name: 'test',
      dependencies: { esbuild: '0.24.0' },
    });

    await update(tree);

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.dependencies.esbuild).toBe('0.24.0');
    expect(packageJson.devDependencies?.esbuild).toBeUndefined();
  });

  it('should not add esbuild when no target uses bundle-rules', async () => {
    addRulesProject({ executor: '@nx/js:tsc' });

    await update(tree);

    expect(
      readJson(tree, 'package.json').devDependencies?.esbuild
    ).toBeUndefined();
  });
});
