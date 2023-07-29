import { Tree, readJson } from '@nx/devkit';
import { writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './rename-angular-eslint-accesibility-rules';

describe('rename-angular-eslint-accesibility-rules migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should rename relevant rules keeping their config and handling overrides', async () => {
    writeJson(tree, '.eslintrc.json', {
      rules: {
        '@angular-eslint/component-class-suffix': [
          'error',
          { suffixes: ['Page', 'View'] },
        ],
        '@angular-eslint/template/accessibility-alt-text': ['error'],
        '@angular-eslint/template/no-call-expression': ['error'],
        '@angular-eslint/template/accessibility-role-has-required-aria': [
          'error',
        ],
      },
      overrides: [
        {
          files: ['*.ts'],
          rules: {
            '@angular-eslint/component-class-suffix': [
              'warn',
              { suffixes: ['Page', 'View'] },
            ],
          },
        },
        {
          files: ['*.html'],
          rules: {
            '@angular-eslint/template/accessibility-alt-text': ['warn'],
            '@angular-eslint/template/no-call-expression': ['warn'],
            '@angular-eslint/template/accessibility-role-has-required-aria': [
              'warn',
            ],
          },
        },
      ],
    });

    await migration(tree);

    expect(readJson(tree, '.eslintrc.json')).toMatchInlineSnapshot(`
      {
        "overrides": [
          {
            "files": [
              "*.ts",
            ],
            "rules": {
              "@angular-eslint/component-class-suffix": [
                "warn",
                {
                  "suffixes": [
                    "Page",
                    "View",
                  ],
                },
              ],
            },
          },
          {
            "files": [
              "*.html",
            ],
            "rules": {
              "@angular-eslint/template/alt-text": [
                "warn",
              ],
              "@angular-eslint/template/no-call-expression": [
                "warn",
              ],
              "@angular-eslint/template/role-has-required-aria": [
                "warn",
              ],
            },
          },
        ],
        "rules": {
          "@angular-eslint/component-class-suffix": [
            "error",
            {
              "suffixes": [
                "Page",
                "View",
              ],
            },
          ],
          "@angular-eslint/template/alt-text": [
            "error",
          ],
          "@angular-eslint/template/no-call-expression": [
            "error",
          ],
          "@angular-eslint/template/role-has-required-aria": [
            "error",
          ],
        },
      }
    `);
  });
});
