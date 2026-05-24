import {
  addDependenciesToPackageJson,
  readJson,
  readNxJson,
  Tree,
  updateJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { nxVersion } from '../../utils/versions';
import { initGenerator } from './init';

describe('init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add dependencies', async () => {
    const existing = 'existing';
    const existingVersion = '1.0.0';

    addDependenciesToPackageJson(
      tree,
      {
        '@nx/node': nxVersion,
        [existing]: existingVersion,
      },
      {
        [existing]: existingVersion,
      }
    );
    await initGenerator(tree, {});

    const packageJson = readJson(tree, 'package.json');
    const nxJson = readNxJson(tree);

    expect(packageJson.dependencies['@nx/node']).toBeUndefined();
    expect(packageJson.dependencies[existing]).toBeDefined();
    expect(packageJson.devDependencies['@nx/node']).toBeDefined();
    expect(packageJson.devDependencies[existing]).toBeDefined();
    expect(nxJson.plugins).toContainEqual({
      plugin: '@nx/node',
      options: {
        respectSideEffects: true,
        removeTypeOnlyEdges: true,
        fallbackToStaticGraph: true,
        affectedNarrowing: true,
      },
    });
    expect(nxJson.pluginsConfig?.['@nx/js']).toMatchObject({
      analyzeSourceFiles: false,
      analyzePackageJson: false,
    });
  });

  it('should not fail when dependencies is missing from package.json and no other init generators are invoked', async () => {
    updateJson(tree, 'package.json', (json) => {
      delete json.dependencies;
      return json;
    });

    await expect(initGenerator(tree, {})).resolves.toBeTruthy();
  });

  it('should preserve existing @nx/js plugin config when disabling duplicate analysis', async () => {
    updateJson(tree, 'nx.json', (json) => {
      json.pluginsConfig = {
        '@nx/js': {
          analyzeLockfile: true,
        },
      };
      return json;
    });

    await initGenerator(tree, {});

    expect(readNxJson(tree).pluginsConfig?.['@nx/js']).toMatchObject({
      analyzeLockfile: true,
      analyzeSourceFiles: false,
      analyzePackageJson: false,
    });
  });
});
