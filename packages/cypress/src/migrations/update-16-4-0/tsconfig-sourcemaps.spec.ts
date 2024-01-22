import {
  Tree,
  addProjectConfiguration,
  readJson,
  readProjectConfiguration,
  updateJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';
import { fixLegacyCypressTsconfig } from './tsconfig-sourcemaps';

describe('Cypress Migration: tsconfig-sourcemaps', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should remove tsconfig.e2e.json and update tsconfig.json', async () => {
    addLegacyProject(tree);

    await fixLegacyCypressTsconfig(tree);
    expect(readProjectConfiguration(tree, 'legacy-e2e').targets.e2e)
      .toMatchInlineSnapshot(`
      {
        "configurations": {
          "production": {
            "devServerTarget": "legacy-e2e:serve:production",
          },
        },
        "executor": "@nx/cypress:cypress",
        "options": {
          "cypressConfig": "apps/legacy-e2e/cypress.config.ts",
          "devServerTarget": "legacy-e2e:serve",
          "testingType": "e2e",
        },
      }
    `);
    expect(readJson(tree, 'apps/legacy-e2e/tsconfig.json'))
      .toMatchInlineSnapshot(`
      {
        "compilerOptions": {
          "outDir": "../../dist/out-tsc",
          "resolveJsonModule": true,
          "sourceMap": false,
          "strict": true,
          "types": [
            "cypress",
            "node",
          ],
        },
        "exclude": [],
        "extends": "../../tsconfig.base.json",
        "files": [],
        "include": [
          "cypress.ci.1.config.ts",
          "cypress.ci.2.config.ts",
          "cypress.ci.3.config.ts",
          "cypress.ci.4.config.ts",
          "src/**/*.ts",
          "cypress.config.ts",
        ],
        "references": [],
      }
    `);
    expect(tree.exists('apps/legacy-e2e/tsconfig.e2e.json')).toBeFalsy();
    expect(tree.exists('apps/legacy-e2e/tsconfig.e2e.prod.json')).toBeFalsy();
  });

  it('should do nothing if tsconfig option is not used', async () => {
    addLegacyProject(tree);

    tree.delete('apps/legacy-e2e/tsconfig.e2e.json');
    tree.delete('apps/legacy-e2e/tsconfig.e2e.prod.json');
    const pc = readProjectConfiguration(tree, 'legacy-e2e');

    delete pc.targets.e2e.options.tsConfig;
    delete pc.targets.e2e.configurations;

    const existingProjectConfig = pc.targets.e2e;

    updateProjectConfiguration(tree, 'legacy-e2e', pc);

    updateJson(tree, 'apps/legacy-e2e/tsconfig.json', (json) => {
      json.references = [];
      return json;
    });

    const existingTsConfig = readJson(tree, 'apps/legacy-e2e/tsconfig.json');

    await fixLegacyCypressTsconfig(tree);

    expect(readProjectConfiguration(tree, 'legacy-e2e').targets.e2e).toEqual(
      existingProjectConfig
    );
    expect(readJson(tree, 'apps/legacy-e2e/tsconfig.json')).toEqual(
      existingTsConfig
    );
  });
});

function addLegacyProject(tree: Tree) {
  addProjectConfiguration(tree, 'legacy-e2e', {
    root: 'apps/legacy-e2e',
    sourceRoot: 'apps/legacy-e2e/src',
    targets: {
      e2e: {
        executor: '@nx/cypress:cypress',
        options: {
          cypressConfig: 'apps/legacy-e2e/cypress.config.ts',
          tsConfig: 'apps/legacy-e2e/tsconfig.e2e.json',
          devServerTarget: 'legacy-e2e:serve',
          testingType: 'e2e',
        },
        configurations: {
          production: {
            devServerTarget: 'legacy-e2e:serve:production',
            tsConfig: 'apps/legacy-e2e/tsconfig.e2e.prod.json',
          },
        },
      },
    },
  });

  tree.write(
    'apps/legacy-e2e/tsconfig.e2e.json',
    JSON.stringify({
      extends: './tsconfig.json',
      compilerOptions: {
        sourceMap: false,
        outDir: '../../dist/out-tsc',
        types: ['cypress', 'node'],
      },
      include: ['src/**/*.ts', 'cypress.config.ts'],
    })
  );
  tree.write(
    'apps/legacy-e2e/tsconfig.e2e.prod.json',
    JSON.stringify({
      extends: './tsconfig.e2e.json',
      compilerOptions: {
        sourceMap: false,
        outDir: '../../dist/out-tsc',
        types: ['cypress', 'node'],
        strict: true,
      },
      include: ['src/**/*.ts', 'cypress.config.ts'],
    })
  );
  tree.write(
    'apps/legacy-e2e/tsconfig.json',
    JSON.stringify({
      extends: '../../tsconfig.base.json',
      compilerOptions: {
        types: ['cypress', 'node'],
        resolveJsonModule: true,
      },
      include: [
        'cypress.ci.1.config.ts',
        'cypress.ci.2.config.ts',
        'cypress.ci.3.config.ts',
        'cypress.ci.4.config.ts',
      ],
      files: [],
      references: [
        {
          path: './tsconfig.e2e.json',
        },
        {
          path: './tsconfig.e2e.prod.json',
        },
      ],
    })
  );
}
