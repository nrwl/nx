import {
  addProjectConfiguration,
  type MigrationReturnObject,
  readJson,
  type Tree,
  updateJson,
  updateNxJson,
  readNxJson,
} from '@nx/devkit';
import * as devkit from '@nx/devkit';
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
      'cypress.config.ts',
      `import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';`,
    ],
    ['types.ts', `import type { FoundTarget } from '@nx/cypress/internal';`],
    ['index.ts', `export * from '@nx/cypress';`],
    [
      'index.mts',
      `export { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';`,
    ],
    ['legacy.cts', `import cypress = require('@nx/cypress');`],
    [
      'cypress.config.js',
      `const { nxE2EPreset } = require('@nx/cypress/plugins/cypress-preset');`,
    ],
    [
      'cypress.config.cjs',
      `const preset = require.resolve('@nx/cypress/plugins/cypress-preset');`,
    ],
    [
      'cypress.config.mjs',
      `const { nxE2EPreset } = await import('@nx/cypress/plugins/cypress-preset');`,
    ],
    [
      'types.ts',
      `type Preset = typeof import('@nx/cypress/plugins/cypress-preset');`,
    ],
    [
      'component.tsx',
      `import { x } from '@nx/cypress';\nexport const C = () => <div>{x}</div>;`,
    ],
    [
      'component.jsx',
      'const { x } = require(`@nx/cypress`);\nexport const C = () => <div>{x}</div>;',
    ],
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
    ['a plain string', 'apps/app1/src/index.ts', `const name = '@nx/cypress';`],
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

    const result = await migration(tree);

    expect(result).toBeUndefined();
    expect(tree.read('package.json', 'utf-8')).toBe(originalPackageJson);
  });

  it('should add @nx/cypress when a file with syntax errors still references it', async () => {
    tree.write(
      'apps/app1-e2e/cypress.config.ts',
      `import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';\nexport default {{{`
    );

    await expect(migration(tree)).resolves.toBeUndefined();

    expect(readNxCypressDeclarations().devDependency).toBe(nxVersion);
  });

  it('should report files with syntax errors when no reference is found', async () => {
    tree.write(
      'apps/app1-e2e/cypress.config.ts',
      `// uses @nx/cypress\nexport default {{{`
    );
    const originalPackageJson = tree.read('package.json', 'utf-8');

    const result = await migration(tree);

    expect(tree.read('package.json', 'utf-8')).toBe(originalPackageJson);
    expect(result).toEqual({
      nextSteps: [expect.stringContaining('apps/app1-e2e/cypress.config.ts')],
      agentContext: [
        expect.stringContaining('apps/app1-e2e/cypress.config.ts'),
      ],
    });
  });

  describe('long expression chains', () => {
    const longChain = `export const x = ${Array(50_000).fill('a').join(' + ')};`;

    it('should add @nx/cypress when a reference follows one', async () => {
      tree.write(
        'apps/app1-e2e/bundle.js',
        `${longChain}\nrequire('@nx/cypress/plugins/cypress-preset');`
      );

      await migration(tree);

      expect(readNxCypressDeclarations().devDependency).toBe(nxVersion);
    });

    it('should not change package.json when no reference is found', async () => {
      tree.write('apps/app1/bundle.js', `// @nx/cypress\n${longChain}`);
      const originalPackageJson = tree.read('package.json', 'utf-8');

      const result = await migration(tree);

      expect(result).toBeUndefined();
      expect(tree.read('package.json', 'utf-8')).toBe(originalPackageJson);
    });
  });

  it('should report files nested too deeply to parse', async () => {
    tree.write(
      'apps/app1/bundle.js',
      `// @nx/cypress\nexport const x = ${'['.repeat(50_000)}${']'.repeat(50_000)};`
    );
    const originalPackageJson = tree.read('package.json', 'utf-8');

    const result = await migration(tree);

    expect(tree.read('package.json', 'utf-8')).toBe(originalPackageJson);
    expect(result).toEqual({
      nextSteps: [expect.stringContaining('apps/app1/bundle.js')],
      agentContext: [expect.stringContaining('apps/app1/bundle.js')],
    });
  });

  it('should report the files that mention @nx/cypress when typescript cannot be loaded', async () => {
    const ensurePackage = jest.spyOn(devkit, 'ensurePackage');
    ensurePackage.mockClear();
    ensurePackage.mockImplementationOnce(() => {
      throw new Error('Failed to install typescript');
    });
    tree.write(
      'apps/app1-e2e/cypress.config.ts',
      `import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';`
    );
    tree.write(
      'tools/e2e-generator.ts',
      `import { configurationGenerator } from '@nx/cypress';`
    );
    const originalPackageJson = tree.read('package.json', 'utf-8');

    const result = await migration(tree);

    expect(ensurePackage).toHaveBeenCalledTimes(1);
    expect(tree.read('package.json', 'utf-8')).toBe(originalPackageJson);
    expect(result).toEqual({
      nextSteps: [expect.any(String)],
      agentContext: [expect.any(String)],
    });
    const { nextSteps, agentContext } = result as MigrationReturnObject;
    for (const message of [...nextSteps, ...agentContext]) {
      expect(message).toContain('apps/app1-e2e/cypress.config.ts');
      expect(message).toContain('tools/e2e-generator.ts');
    }
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

  it('should be a no-op when run twice', async () => {
    addCypressTarget();
    await migration(tree);
    const afterFirstRun = tree.read('package.json', 'utf-8');
    expect(readNxCypressDeclarations().devDependency).toBe(nxVersion);

    await migration(tree);

    expect(tree.read('package.json', 'utf-8')).toBe(afterFirstRun);
  });
});
