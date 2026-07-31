import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  addProjectConfiguration,
  readJson,
  readNxJson,
  Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { addLintingToProject } from './add-linting-to-project';

/**
 * Every framework generator that offers a linter routes through this helper, so
 * this is the one place the `oxlint` arm can be covered once rather than per
 * framework.
 */
describe('addLintingToProject', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'my-lib', {
      root: 'libs/my-lib',
      sourceRoot: 'libs/my-lib/src',
      projectType: 'library',
      targets: {},
    });
  });

  it('registers oxlint when asked for it', async () => {
    await addLintingToProject(tree, {
      linter: 'oxlint',
      project: 'my-lib',
      addPlugin: true,
    });

    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies['oxlint']).toBeDefined();
    expect(devDependencies['@nx/oxlint']).toBeDefined();

    const plugins = readNxJson(tree).plugins?.map((p) =>
      typeof p === 'string' ? p : p.plugin
    );
    expect(plugins).toContain('@nx/oxlint');
    expect(tree.exists('.oxlintrc.json')).toBe(true);
  });

  it('does not pull in eslint when oxlint is requested', async () => {
    await addLintingToProject(tree, {
      linter: 'oxlint',
      project: 'my-lib',
      addPlugin: true,
    });

    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies['eslint']).toBeUndefined();
    expect(devDependencies['@nx/eslint']).toBeUndefined();
  });

  // detox, expo and react-native declare `linter` optional and forward it with
  // `...options`, so undefined reaches here. It has always meant ESLint, and the
  // exhaustiveness check added alongside this must not turn that into a throw.
  it('falls back to eslint when no linter is given', async () => {
    await expect(
      addLintingToProject(tree, {
        linter: undefined,
        project: 'my-lib',
        addPlugin: true,
      })
    ).resolves.toBeDefined();

    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies['@nx/eslint']).toBeDefined();
    expect(devDependencies['oxlint']).toBeUndefined();
  });

  it('configures nothing for none', async () => {
    await addLintingToProject(tree, {
      linter: 'none',
      project: 'my-lib',
      addPlugin: true,
    });

    const { devDependencies = {} } = readJson(tree, 'package.json');
    expect(devDependencies['oxlint']).toBeUndefined();
    expect(devDependencies['eslint']).toBeUndefined();
    expect(tree.exists('.oxlintrc.json')).toBe(false);
  });
});
