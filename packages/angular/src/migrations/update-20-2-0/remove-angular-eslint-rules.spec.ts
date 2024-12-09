import {
  addProjectConfiguration,
  writeJson,
  type ProjectConfiguration,
  type ProjectGraph,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './remove-angular-eslint-rules';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: () => Promise.resolve(projectGraph),
}));

describe('remove-angular-eslint-rules', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    const projectConfig: ProjectConfiguration = {
      name: 'app1',
      root: 'apps/app1',
    };
    projectGraph = {
      dependencies: {
        app1: [
          {
            source: 'app1',
            target: 'npm:@angular/core',
            type: 'static',
          },
        ],
      },
      nodes: {
        app1: {
          data: projectConfig,
          name: 'app1',
          type: 'app',
        },
      },
    };
    addProjectConfiguration(tree, projectConfig.name, projectConfig);
  });

  describe('.eslintrc.json', () => {
    it.each([
      ['@angular-eslint/no-host-metadata-property'],
      ['@angular-eslint/sort-ngmodule-metadata-arrays'],
      ['@angular-eslint/prefer-standalone-component'],
    ])('should remove %s rule', async (rule) => {
      writeJson(tree, 'apps/app1/.eslintrc.json', {
        overrides: [
          {
            files: ['*.ts'],
            rules: { [rule]: ['error'] },
          },
        ],
      });

      await migration(tree);

      expect(tree.read('apps/app1/.eslintrc.json', 'utf8')).not.toContain(rule);
    });

    it('should remove multiple rules', async () => {
      writeJson(tree, 'apps/app1/.eslintrc.json', {
        overrides: [
          {
            files: ['*.ts'],
            rules: {
              '@angular-eslint/no-host-metadata-property': ['error'],
              '@angular-eslint/sort-ngmodule-metadata-arrays': ['error'],
              '@angular-eslint/prefer-standalone-component': ['error'],
            },
          },
        ],
      });

      await migration(tree);

      expect(tree.read('apps/app1/.eslintrc.json', 'utf8'))
        .toMatchInlineSnapshot(`
        "{
          "overrides": [
            {
              "files": ["*.ts"],
              "rules": {}
            }
          ]
        }
        "
      `);
    });
  });

  describe('flat config', () => {
    it.each([
      ['@angular-eslint/no-host-metadata-property'],
      ['@angular-eslint/sort-ngmodule-metadata-arrays'],
      ['@angular-eslint/prefer-standalone-component'],
    ])('should remove %s rule', async (rule) => {
      tree.write('eslint.config.js', 'module.exports = [];');
      tree.write(
        'apps/app1/eslint.config.js',
        `module.exports = [
          {
            files: ['*.ts'],
            rules: { '${rule}': ['error'] },
          },
        ];
        `
      );

      await migration(tree);

      expect(tree.read('apps/app1/eslint.config.js', 'utf8')).not.toContain(
        rule
      );
    });

    it('should remove multiple rules', async () => {
      tree.write('eslint.config.js', 'module.exports = [];');
      tree.write(
        'apps/app1/eslint.config.js',
        `module.exports = [
          {
            files: ['*.ts'],
            rules: {
              '@angular-eslint/no-host-metadata-property': ['error'],
              '@angular-eslint/sort-ngmodule-metadata-arrays': ['error'],
              '@angular-eslint/prefer-standalone-component': ['error'],
            },
          },
        ];
        `
      );

      await migration(tree);

      expect(tree.read('apps/app1/eslint.config.js', 'utf8'))
        .toMatchInlineSnapshot(`
        "module.exports = [
          {
            files: ['**/*.ts'],
            rules: {},
          },
        ];
        "
      `);
    });
  });
});
