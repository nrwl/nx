import 'nx/src/internal-testing-utils/mock-project-graph';

import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  Tree,
  readProjectConfiguration,
  readNxJson,
  updateNxJson,
} from '@nx/devkit';

import * as devkitExports from 'nx/src/devkit-exports';

import { applicationGenerator } from './application';
import { Schema } from './schema';
import { PackageManagerCommands } from 'nx/src/utils/package-manager';

describe('application generator', () => {
  let tree: Tree;
  const options: Schema = { directory: 'test' } as Schema;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    jest
      .spyOn(devkitExports, 'getPackageManagerCommand')
      .mockReturnValue({ exec: 'npx' } as PackageManagerCommands);
  });

  it('should run successfully', async () => {
    await applicationGenerator(tree, options);
    const config = readProjectConfiguration(tree, 'test');
    expect(config).toBeDefined();
  });

  it('should set up project correctly with given options', async () => {
    const nxJson = readNxJson(tree);
    nxJson.plugins ??= [];
    nxJson.plugins.push({
      plugin: '@nx/vite/plugin',
      options: {
        buildTargetName: 'build',
        previewTargetName: 'preview',
      },
    });
    updateNxJson(tree, nxJson);
    await applicationGenerator(tree, {
      ...options,
      unitTestRunner: 'vitest',
      e2eTestRunner: 'playwright',
      addPlugin: true,
    });
    expect(tree.read('.eslintrc.json', 'utf-8')).toMatchSnapshot();
    expect(tree.read('test/vite.config.ts', 'utf-8')).toMatchSnapshot();
    expect(tree.read('test/.eslintrc.json', 'utf-8')).toMatchSnapshot();
    expect(tree.read('test/src/app/App.spec.ts', 'utf-8')).toMatchSnapshot();
    expect(
      tree.read('test-e2e/playwright.config.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(listFiles(tree)).toMatchSnapshot();
    expect(readNxJson(tree).targetDefaults['e2e-ci--**/*'])
      .toMatchInlineSnapshot(`
      {
        "dependsOn": [
          "^build",
        ],
      }
    `);
  });

  it('should set up project correctly for cypress', async () => {
    const nxJson = readNxJson(tree);
    nxJson.plugins ??= [];
    nxJson.plugins.push({
      plugin: '@nx/vite/plugin',
      options: {
        buildTargetName: 'build',
        previewTargetName: 'preview',
      },
    });
    updateNxJson(tree, nxJson);
    await applicationGenerator(tree, {
      ...options,
      addPlugin: true,
      unitTestRunner: 'vitest',
      e2eTestRunner: 'cypress',
    });
    expect(tree.read('.eslintrc.json', 'utf-8')).toMatchSnapshot();
    expect(tree.read('test/vite.config.ts', 'utf-8')).toMatchSnapshot();
    expect(tree.read('test/.eslintrc.json', 'utf-8')).toMatchSnapshot();
    expect(tree.read('test/src/app/App.spec.ts', 'utf-8')).toMatchSnapshot();
    expect(tree.read('test-e2e/cypress.config.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should not use stylesheet if --style=none', async () => {
    await applicationGenerator(tree, { ...options, style: 'none' });

    expect(tree.exists('test/src/style.none')).toBeFalsy();
    expect(tree.read('test/src/main.ts', 'utf-8')).not.toContain('styles.none');
  });
});

function listFiles(tree: Tree): string[] {
  const files = new Set<string>();
  tree.listChanges().forEach((change) => {
    if (change.type !== 'DELETE') {
      files.add(change.path);
    }
  });

  return Array.from(files).sort((a, b) => a.localeCompare(b));
}
