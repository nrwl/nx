import {
  Tree,
  readJson,
  readProjectConfiguration,
  updateJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';
import { normalizeCyTsConfigNames } from './update-cy-tsconfig';
import { libraryGenerator } from '@nx/js';

describe('Cypress Migration - update-cy-tsconfig', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });
  it('should do nothing if cypress/tsconfig.json exists', async () => {
    await libraryGenerator(tree, { name: 'my-lib' });
    addCyExecutor(tree, 'my-lib');
    const tsconfig = {
      extends: '../tsconfig.json',
      compilerOptions: {
        sourceMap: false,
        outDir: '../../../dist/out-tsc',
        allowJs: true,
        types: ['cypress', 'node'],
      },
      include: ['**/*.ts', '**/*.js', '../cypress.config.ts'],
    };
    tree.write(
      'libs/my-lib/cypress/tsconfig.json',
      JSON.stringify(tsconfig, null, 2)
    );
    updateJson(tree, 'libs/my-lib/tsconfig.json', (json) => {
      json.references ??= [];
      json.references.push({ path: './cypress/tsconfig.json' });
      return json;
    });

    await normalizeCyTsConfigNames(tree);
    expect(readJson(tree, 'libs/my-lib/tsconfig.json').references).toEqual(
      expect.arrayContaining([{ path: './cypress/tsconfig.json' }])
    );
    expect(readJson(tree, 'libs/my-lib/cypress/tsconfig.json')).toEqual(
      tsconfig
    );
  });

  it('should move cypress/tsconfig.cy.json to cypress/tsconfig.json', async () => {
    await libraryGenerator(tree, { name: 'my-lib' });
    addCyExecutor(tree, 'my-lib');
    const tsconfig = {
      extends: '../tsconfig.json',
      compilerOptions: {
        outDir: '../../../dist/out-tsc',
        module: 'commonjs',
        types: ['cypress', 'node'],
        sourceMap: false,
      },
      include: [
        'support/**/*.ts',
        '../cypress.config.ts',
        '../**/*.cy.ts',
        '../**/*.cy.tsx',
        '../**/*.cy.js',
        '../**/*.cy.jsx',
        '../**/*.d.ts',
      ],
    };

    tree.write(
      'libs/my-lib/cypress/tsconfig.cy.json',
      JSON.stringify(tsconfig, null, 2)
    );

    updateJson(tree, 'libs/my-lib/tsconfig.json', (json) => {
      json.references ??= [];
      json.references.push({ path: './cypress/tsconfig.cy.json' });
      return json;
    });

    await normalizeCyTsConfigNames(tree);
    expect(tree.exists('libs/my-lib/cypress/tsconfig.cy.json')).toBeFalsy();
    expect(readJson(tree, 'libs/my-lib/tsconfig.json').references).toEqual(
      expect.arrayContaining([{ path: './cypress/tsconfig.json' }])
    );
    expect(readJson(tree, 'libs/my-lib/cypress/tsconfig.json')).toEqual(
      tsconfig
    );
  });

  it('should move tsconfig.cy.json to cypress/tsconfig.json', async () => {
    await libraryGenerator(tree, { name: 'my-lib' });
    addCyExecutor(tree, 'my-lib');
    const tsconfig = {
      extends: './tsconfig.json',
      compilerOptions: {
        outDir: '../../dist/out-tsc',
        module: 'commonjs',
        types: ['cypress', 'node'],
        sourceMap: false,
      },
      include: [
        'cypress/support/**/*.ts',
        'cypress.config.ts',
        '**/*.cy.ts',
        '**/*.cy.tsx',
        '**/*.cy.js',
        '**/*.cy.jsx',
        '**/*.d.ts',
      ],
    };

    tree.write(
      'libs/my-lib/tsconfig.cy.json',
      JSON.stringify(tsconfig, null, 2)
    );
    updateJson(tree, 'libs/my-lib/tsconfig.json', (json) => {
      json.references ??= [];
      json.references.push({ path: './tsconfig.cy.json' });
      return json;
    });

    await normalizeCyTsConfigNames(tree);
    expect(tree.exists('libs/my-lib/tsconfig.cy.json')).toBeFalsy();
    expect(readJson(tree, 'libs/my-lib/tsconfig.json').references).toEqual(
      expect.arrayContaining([{ path: './cypress/tsconfig.json' }])
    );
    expect(readJson(tree, 'libs/my-lib/cypress/tsconfig.json')).toEqual({
      extends: '../tsconfig.json',
      compilerOptions: {
        outDir: '../../../dist/out-tsc',
        module: 'commonjs',
        types: ['cypress', 'node'],
        sourceMap: false,
      },
      include: [
        'support/**/*.ts',
        '../cypress.config.ts',
        '../**/*.cy.ts',
        '../**/*.cy.tsx',
        '../**/*.cy.js',
        '../**/*.cy.jsx',
        '../**/*.d.ts',
      ],
    });
  });

  it('should be idepotent', async () => {
    await libraryGenerator(tree, { name: 'my-lib' });
    addCyExecutor(tree, 'my-lib');
    const tsconfig = {
      extends: './tsconfig.json',
      compilerOptions: {
        outDir: '../../dist/out-tsc',
        module: 'commonjs',
        types: ['cypress', 'node'],
        sourceMap: false,
      },
      include: [
        'cypress/support/**/*.ts',
        'cypress.config.ts',
        '**/*.cy.ts',
        '**/*.cy.tsx',
        '**/*.cy.js',
        '**/*.cy.jsx',
        '**/*.d.ts',
      ],
    };

    tree.write(
      'libs/my-lib/tsconfig.cy.json',
      JSON.stringify(tsconfig, null, 2)
    );
    updateJson(tree, 'libs/my-lib/tsconfig.json', (json) => {
      json.references ??= [];
      json.references.push({ path: './tsconfig.cy.json' });
      return json;
    });

    await normalizeCyTsConfigNames(tree);
    expect(tree.exists('libs/my-lib/tsconfig.cy.json')).toBeFalsy();
    expect(readJson(tree, 'libs/my-lib/tsconfig.json').references).toEqual(
      expect.arrayContaining([{ path: './cypress/tsconfig.json' }])
    );
    expect(readJson(tree, 'libs/my-lib/cypress/tsconfig.json')).toEqual({
      extends: '../tsconfig.json',
      compilerOptions: {
        outDir: '../../../dist/out-tsc',
        module: 'commonjs',
        types: ['cypress', 'node'],
        sourceMap: false,
      },
      include: [
        'support/**/*.ts',
        '../cypress.config.ts',
        '../**/*.cy.ts',
        '../**/*.cy.tsx',
        '../**/*.cy.js',
        '../**/*.cy.jsx',
        '../**/*.d.ts',
      ],
    });

    await normalizeCyTsConfigNames(tree);
    expect(tree.exists('libs/my-lib/tsconfig.cy.json')).toBeFalsy();
    expect(readJson(tree, 'libs/my-lib/tsconfig.json').references).toEqual([
      { path: './tsconfig.lib.json' },
      { path: './tsconfig.spec.json' },
      { path: './cypress/tsconfig.json' },
    ]);
    expect(readJson(tree, 'libs/my-lib/cypress/tsconfig.json')).toEqual({
      extends: '../tsconfig.json',
      compilerOptions: {
        outDir: '../../../dist/out-tsc',
        module: 'commonjs',
        types: ['cypress', 'node'],
        sourceMap: false,
      },
      include: [
        'support/**/*.ts',
        '../cypress.config.ts',
        '../**/*.cy.ts',
        '../**/*.cy.tsx',
        '../**/*.cy.js',
        '../**/*.cy.jsx',
        '../**/*.d.ts',
      ],
    });
  });
});

function addCyExecutor(tree: Tree, projectName: string) {
  const pc = readProjectConfiguration(tree, projectName);

  pc.targets['e2e'] = {
    executor: '@nx/cypress:cypress',
    options: {
      testingType: 'e2e',
      devServerTarget: `${projectName}:serve`,
      cypressConfig: `${projectName}/cypress.config.ts`,
    },
  };

  updateProjectConfiguration(tree, projectName, pc);
}
