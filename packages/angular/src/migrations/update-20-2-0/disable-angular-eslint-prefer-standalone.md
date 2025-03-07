#### Disable Angular ESLint Prefer Standalone

Disable the Angular ESLint prefer-standalone rule if not set.

#### Sample Code Changes

Update import paths for `withModuleFederation` and `withModuleFederationForSSR`.

{% tabs %}
{% tab label="Before" %}

```json {% fileName="apps/app1/.eslintrc.json" %}
{
  "overrides": [
    {
      "files": ["*.html"],
      "rules": {
        "some-rule-for-html": "error"
      }
    }
  ]
}
```

{% /tab %}
{% tab label="After" %}

```json {% fileName="apps/app1/.eslintrc.json" %}
{
  "overrides": [
    {
      "files": ["*.html"],
      "rules": {
        "some-rule-for-html": "error"
      }
    },
    {
      "files": ["*.ts"],
      "rules": {
        "@angular-eslint/prefer-standalone": "off"
      }
    }
  ]
}
```

{% /tab %}
{% /tabs %}

import {
addProjectConfiguration,
writeJson,
type ProjectConfiguration,
type ProjectGraph,
type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './disable-angular-eslint-prefer-standalone';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
...jest.requireActual('@nx/devkit'),
createProjectGraphAsync: () => Promise.resolve(projectGraph),
}));

describe('disable-angular-eslint-prefer-standalone', () => {
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
it('should not disable @angular-eslint/prefer-standalone when it is set', async () => {
writeJson(tree, 'apps/app1/.eslintrc.json', {
overrides: [
{
files: ['*.ts'],
rules: { '@angular-eslint/prefer-standalone': ['error'] },
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
              "rules": {
                "@angular-eslint/prefer-standalone": ["error"]
              }
            }
          ]
        }
        "
      `);
    });

    it('should not disable @angular-eslint/prefer-standalone when there are multiple overrides for angular eslint and the rule is set in one of them', async () => {
      writeJson(tree, 'apps/app1/.eslintrc.json', {
        overrides: [
          {
            files: ['*.ts'],
            rules: {
              '@angular-eslint/directive-selector': [
                'error',
                { type: 'attribute', prefix: 'app', style: 'camelCase' },
              ],
            },
          },
          {
            files: ['*.ts'],
            rules: { '@angular-eslint/prefer-standalone': ['error'] },
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
              "rules": {
                "@angular-eslint/directive-selector": [
                  "error",
                  {
                    "type": "attribute",
                    "prefix": "app",
                    "style": "camelCase"
                  }
                ]
              }
            },
            {
              "files": ["*.ts"],
              "rules": {
                "@angular-eslint/prefer-standalone": ["error"]
              }
            }
          ]
        }
        "
      `);
    });

    it('should disable @angular-eslint/prefer-standalone in an existing override for angular eslint', async () => {
      writeJson(tree, 'apps/app1/.eslintrc.json', {
        overrides: [
          {
            files: ['*.ts'],
            rules: { 'no-unused-vars': 'error' },
          },
          {
            files: ['*.ts'],
            rules: {
              '@angular-eslint/directive-selector': [
                'error',
                { type: 'attribute', prefix: 'app', style: 'camelCase' },
              ],
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
              "rules": {
                "no-unused-vars": "error"
              }
            },
            {
              "files": ["*.ts"],
              "rules": {
                "@angular-eslint/directive-selector": [
                  "error",
                  {
                    "type": "attribute",
                    "prefix": "app",
                    "style": "camelCase"
                  }
                ],
                "@angular-eslint/prefer-standalone": "off"
              }
            }
          ]
        }
        "
      `);
    });

    it('should disable @angular-eslint/prefer-standalone in an existing override for ts files', async () => {
      writeJson(tree, 'apps/app1/.eslintrc.json', {
        overrides: [
          {
            files: ['*.ts'],
            rules: { 'no-unused-vars': 'error' },
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
              "rules": {
                "no-unused-vars": "error",
                "@angular-eslint/prefer-standalone": "off"
              }
            }
          ]
        }
        "
      `);
    });

    it('should disable @angular-eslint/prefer-standalone in a new override', async () => {
      writeJson(tree, 'apps/app1/.eslintrc.json', {
        overrides: [
          {
            files: ['*.html'],
            rules: { 'some-rule-for-html': 'error' },
          },
        ],
      });

      await migration(tree);

      expect(tree.read('apps/app1/.eslintrc.json', 'utf8'))
        .toMatchInlineSnapshot(`
        "{
          "overrides": [
            {
              "files": ["*.html"],
              "rules": {
                "some-rule-for-html": "error"
              }
            },
            {
              "files": ["*.ts"],
              "rules": {
                "@angular-eslint/prefer-standalone": "off"
              }
            }
          ]
        }
        "
      `);
    });

});

describe('flat config', () => {
it('should not disable @angular-eslint/prefer-standalone when it is set', async () => {
tree.write('eslint.config.js', 'module.exports = [];');
tree.write(
'apps/app1/eslint.config.js',
`module.exports = [
          {
            files: ['*.ts'],
            rules: { '@angular-eslint/prefer-standalone': ['error'] },
          },
        ];
        `
);

      await migration(tree);

      expect(tree.read('apps/app1/eslint.config.js', 'utf8'))
        .toMatchInlineSnapshot(`
        "module.exports = [
          {
            files: ['*.ts'],
            rules: { '@angular-eslint/prefer-standalone': ['error'] },
          },
        ];
        "
      `);
    });

    it('should not disable @angular-eslint/prefer-standalone when there are multiple overrides for angular eslint and the rule is set in one of them', async () => {
      tree.write('eslint.config.js', 'module.exports = [];');
      tree.write(
        'apps/app1/eslint.config.js',
        `module.exports = [
          {
            files: ['*.ts'],
            rules: {
              '@angular-eslint/directive-selector': [
                'error',
                { type: 'attribute', prefix: 'app', style: 'camelCase' },
              ],
            },
          },
          {
            files: ['*.ts'],
            rules: { '@angular-eslint/prefer-standalone': ['error'] },
          },
        ];
        `
      );

      await migration(tree);

      expect(tree.read('apps/app1/eslint.config.js', 'utf8'))
        .toMatchInlineSnapshot(`
        "module.exports = [
          {
            files: ['*.ts'],
            rules: {
              '@angular-eslint/directive-selector': [
                'error',
                { type: 'attribute', prefix: 'app', style: 'camelCase' },
              ],
            },
          },
          {
            files: ['*.ts'],
            rules: { '@angular-eslint/prefer-standalone': ['error'] },
          },
        ];
        "
      `);
    });

    it('should disable @angular-eslint/prefer-standalone in an existing override for angular eslint', async () => {
      tree.write('eslint.config.js', 'module.exports = [];');
      tree.write(
        'apps/app1/eslint.config.js',
        `module.exports = [
          {
            files: ['*.ts'],
            rules: { 'no-unused-vars': 'error' },
          },
          {
            files: ['*.ts'],
            rules: {
              '@angular-eslint/directive-selector': [
                'error',
                { type: 'attribute', prefix: 'app', style: 'camelCase' },
              ],
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
            files: ['*.ts'],
            rules: { 'no-unused-vars': 'error' },
          },
          {
            files: ['**/*.ts'],
            rules: {
              '@angular-eslint/directive-selector': [
                'error',
                {
                  type: 'attribute',
                  prefix: 'app',
                  style: 'camelCase',
                },
              ],
              '@angular-eslint/prefer-standalone': 'off',
            },
          },
        ];
        "
      `);
    });

    it('should disable @angular-eslint/prefer-standalone in an existing override for ts files', async () => {
      tree.write('eslint.config.js', 'module.exports = [];');
      tree.write(
        'apps/app1/eslint.config.js',
        `module.exports = [
          {
            files: ['*.ts'],
            rules: { 'no-unused-vars': 'error' },
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
            rules: {
              'no-unused-vars': 'error',
              '@angular-eslint/prefer-standalone': 'off',
            },
          },
        ];
        "
      `);
    });

    it('should disable @angular-eslint/prefer-standalone in a new override', async () => {
      tree.write('eslint.config.js', 'module.exports = [];');
      tree.write(
        'apps/app1/eslint.config.js',
        `module.exports = [
          {
            files: ['*.html'],
            rules: { 'some-rule-for-html': 'error' },
          },
        ];
        `
      );

      await migration(tree);

      expect(tree.read('apps/app1/eslint.config.js', 'utf8'))
        .toMatchInlineSnapshot(`
        "module.exports = [
          {
            files: ['*.html'],
            rules: { 'some-rule-for-html': 'error' },
          },
          {
            files: ['**/*.ts'],
            rules: {
              '@angular-eslint/prefer-standalone': 'off',
            },
          },
        ];
        "
      `);
    });

});
});
