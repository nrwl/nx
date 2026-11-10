import {
  addProjectConfiguration,
  readJson,
  type Tree,
  updateJson,
  updateNxJson,
  readNxJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { nxVersion } from '../../utils/versions';
import migration from './add-nx-cypress-dependency';

describe('add-nx-cypress-dependency migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  function readNxCypressDeclarations() {
    const { dependencies, devDependencies } = readJson(tree, 'package.json');
    return {
      dependency: dependencies?.['@nx/cypress'],
      devDependency: devDependencies?.['@nx/cypress'],
    };
  }

  function addCypressTarget() {
    addProjectConfiguration(tree, 'app1-e2e', {
      root: 'apps/app1-e2e',
      targets: { e2e: { executor: '@nx/cypress:cypress' } },
    });
  }

  it('should add @nx/cypress when a project target uses an @nx/cypress executor', async () => {
    addCypressTarget();

    await migration(tree);

    expect(readNxCypressDeclarations()).toEqual({
      dependency: undefined,
      devDependency: nxVersion,
    });
  });

  it.each([
    ['an executor key', { '@nx/cypress:cypress': { cache: true } }],
    [
      'an executor key with an array value',
      { '@nx/cypress:cypress': [{ cache: true }] },
    ],
    ['an executor value', { e2e: { executor: '@nx/cypress:cypress' } }],
    [
      'an executor value in an array',
      { e2e: [{ executor: '@nx/cypress:cypress' }] },
    ],
  ])(
    'should add @nx/cypress when targetDefaults use %s',
    async (_, targetDefaults) => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = targetDefaults;
      updateNxJson(tree, nxJson);

      await migration(tree);

      expect(readNxCypressDeclarations().devDependency).toBe(nxVersion);
    }
  );

  it.each([
    ['a string', '@nx/cypress/plugin'],
    ['an object', { plugin: '@nx/cypress/plugin', options: {} }],
  ])(
    'should add @nx/cypress when the plugin is registered as %s',
    async (_, plugin) => {
      const nxJson = readNxJson(tree);
      nxJson.plugins = [plugin];
      updateNxJson(tree, nxJson);

      await migration(tree);

      expect(readNxCypressDeclarations().devDependency).toBe(nxVersion);
    }
  );

  it.each([
    [
      'cypress.config.ts',
      `import { nxE2EStorybookPreset } from '@nx/storybook/presets/cypress';`,
    ],
    [
      'cypress.config.js',
      `const { nxE2EPreset } = require("@nx/cypress/plugins/cypress-preset");`,
    ],
    ['cypress.config.cjs', 'const { x } = require(`@nx/cypress`);'],
    ['cypress.config.cjs', `(require)('@nx/storybook/presets/cypress');`],
    ['cypress.config.cjs', `const name = '@nx/cypress';\nrequire(name);`],
    [
      'cypress.config.cjs',
      'console.log(`@nx/cypress ${require(`@nx/cypress/package.json`).version}`);',
    ],
    ['cypress.config.cjs', `require('@nx/storybook/presets/cypr\\u0065ss');`],
    ['cypress.config.cjs', `require('@nx/cypr\\u{65}ss');`],
    ['cypress.config.cjs', `require('@nx/\\x63ypress');`],
    ['cypress.config.cjs', `require('@nx/\\143ypress');`],
    ['cypress.config.cjs', `require('@nx/\\cypress');`],
    ['cypress.config.cjs', `require('@nx/cy\\\npress');`],
  ])(
    'should add @nx/cypress when %s references it with `%s`',
    async (fileName, content) => {
      tree.write(`apps/app1-e2e/${fileName}`, content);

      await migration(tree);

      expect(readNxCypressDeclarations().devDependency).toBe(nxVersion);
    }
  );

  it('should keep an existing @nx/cypress devDependency version', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies = { '@nx/cypress': '23.0.0' };
      return json;
    });
    addCypressTarget();

    await migration(tree);

    expect(readNxCypressDeclarations()).toEqual({
      dependency: undefined,
      devDependency: '23.0.0',
    });
  });

  it('should not add a devDependency when @nx/cypress is already a dependency', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.dependencies = { '@nx/cypress': '23.0.0' };
      return json;
    });
    addCypressTarget();

    await migration(tree);

    expect(readNxCypressDeclarations()).toEqual({
      dependency: '23.0.0',
      devDependency: undefined,
    });
  });

  it.each([
    ['a comment', 'apps/app1/src/index.ts', `// uses @nx/cypress`],
    [
      'a computed module name',
      'apps/app1/src/index.ts',
      `require('@nx/' + 'cypress');`,
    ],
    [
      'a package with the same prefix',
      'apps/app1/src/index.ts',
      `import x from '@nx/cypress-extras';`,
    ],
    [
      'a non-source file',
      'apps/app1/README.md',
      `import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';`,
    ],
    [
      'a git-ignored file',
      'dist/apps/app1-e2e/cypress.config.js',
      `const { nxE2EPreset } = require('@nx/cypress/plugins/cypress-preset');`,
    ],
  ])('should not change package.json for %s', async (_, filePath, content) => {
    tree.write('.gitignore', 'dist\n');
    tree.write(filePath, content);
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: { test: { executor: '@nx/cypress-extras:run' } },
    });
    const nxJson = readNxJson(tree);
    nxJson.plugins = ['@nx/cypress-extras/plugin'];
    updateNxJson(tree, nxJson);
    const originalPackageJson = tree.read('package.json', 'utf-8');

    await migration(tree);

    expect(tree.read('package.json', 'utf-8')).toBe(originalPackageJson);
  });

  it('should skip malformed plugin entries', async () => {
    const nxJson = readNxJson(tree);
    nxJson.plugins = [null, {} as any];
    updateNxJson(tree, nxJson);
    tree.write(
      'apps/app1-e2e/cypress.config.ts',
      `import { nxE2EStorybookPreset } from '@nx/storybook/presets/cypress';`
    );

    await migration(tree);

    expect(readNxCypressDeclarations().devDependency).toBe(nxVersion);
  });

  it('should not create package.json when the workspace has none', async () => {
    tree.delete('package.json');
    addCypressTarget();

    await migration(tree);

    expect(tree.exists('package.json')).toBe(false);
  });
});
