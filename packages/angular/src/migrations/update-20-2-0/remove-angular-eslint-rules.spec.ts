import {
  addProjectConfiguration,
  writeJson,
  type ProjectConfiguration,
  type ProjectGraph,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration, { rulesToRemove } from './remove-angular-eslint-rules';

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
    it.each(rulesToRemove)('should remove %s rule', async (rule) => {
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

    it('should handle rules set in the root config', async () => {
      writeJson(tree, '.eslintrc.json', {
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
      writeJson(tree, 'apps/app1/.eslintrc.json', {
        extends: '../../.eslintrc.json',
      });

      await migration(tree);

      expect(tree.read('.eslintrc.json', 'utf8')).toMatchInlineSnapshot(`
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
      expect(tree.read('apps/app1/.eslintrc.json', 'utf8'))
        .toMatchInlineSnapshot(`
        "{
          "extends": "../../.eslintrc.json"
        }
        "
      `);
    });

    it('should handle rules set in the root base config', async () => {
      writeJson(tree, '.eslintrc.base.json', {
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
      writeJson(tree, 'apps/app1/.eslintrc.json', {
        extends: '../../.eslintrc.base.json',
      });

      await migration(tree);

      expect(tree.read('.eslintrc.base.json', 'utf8')).toMatchInlineSnapshot(`
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
      expect(tree.read('apps/app1/.eslintrc.json', 'utf8'))
        .toMatchInlineSnapshot(`
        "{
          "extends": "../../.eslintrc.base.json"
        }
        "
      `);
    });
  });

  describe('flat config', () => {
    it.each(rulesToRemove)('should remove %s rule', async (rule) => {
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

    it('should handle rules set in the root config', async () => {
      tree.write(
        'eslint.config.js',
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
      tree.write(
        'apps/app1/eslint.config.js',
        `const baseConfig = require('../../eslint.config.js');

        module.exports = [...baseConfig];
        `
      );

      await migration(tree);

      expect(tree.read('eslint.config.js', 'utf8')).toMatchInlineSnapshot(`
        "module.exports = [
          {
            files: ['**/*.ts'],
            rules: {},
          },
        ];
        "
      `);
      expect(tree.read('apps/app1/eslint.config.js', 'utf8'))
        .toMatchInlineSnapshot(`
        "const baseConfig = require('../../eslint.config.js');

        module.exports = [...baseConfig];
        "
      `);
    });

    it('should handle rules set in the root base config', async () => {
      tree.write(
        'eslint.base.config.js',
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
      tree.write('eslint.config.js', 'module.exports = [];');
      tree.write(
        'apps/app1/eslint.config.js',
        `const baseConfig = require('../../eslint.base.config.js');

        module.exports = [...baseConfig];
        `
      );

      await migration(tree);

      expect(tree.read('eslint.base.config.js', 'utf8')).toMatchInlineSnapshot(`
        "module.exports = [
          {
            files: ['**/*.ts'],
            rules: {},
          },
        ];
        "
      `);
      expect(tree.read('apps/app1/eslint.config.js', 'utf8'))
        .toMatchInlineSnapshot(`
        "const baseConfig = require('../../eslint.base.config.js');

        module.exports = [...baseConfig];
        "
      `);
    });
  });
});
