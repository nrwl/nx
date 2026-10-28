import type { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './replace-babel-class-properties-loose';

describe('replace-babel-class-properties-loose', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('moves classProperties.loose to loose for every Nx preset and config file name', async () => {
    tree.write(
      'libs/a/.babelrc',
      `{
  // comments are kept
  "presets": [["@nx/js/babel", { "useBuiltIns": "usage", "classProperties": { "loose": false } }]]
}`
    );
    tree.write(
      'libs/b/.babelrc.json',
      `{ "presets": [["@nx/react/babel", { "runtime": "automatic", "classProperties": { "loose": false } }]] }`
    );
    tree.write(
      'babel.config.json',
      `{ "presets": [["@nx/web/babel", { "classProperties": { "loose": true } }]] }`
    );

    const result = await migration(tree);

    expect(tree.read('libs/a/.babelrc', 'utf-8')).toMatchInlineSnapshot(`
      "{
        // comments are kept
        "presets": [
          [
            "@nx/js/babel",
            {
              "useBuiltIns": "usage",
              "loose": false
            }
          ]
        ]
      }
      "
    `);
    expect(tree.read('libs/b/.babelrc.json', 'utf-8')).toMatchInlineSnapshot(`
      "{
        "presets": [
          [
            "@nx/react/babel",
            {
              "runtime": "automatic",
              "loose": false
            }
          ]
        ]
      }
      "
    `);
    expect(tree.read('babel.config.json', 'utf-8')).toMatchInlineSnapshot(`
      "{
        "presets": [
          [
            "@nx/web/babel",
            {
              "loose": true
            }
          ]
        ]
      }
      "
    `);
    expect(result).toEqual({ skipAgentic: true });
  });

  it('keeps the classProperties.loose value when loose is also set, since it used to take precedence', async () => {
    tree.write(
      '.babelrc',
      `{ "presets": [["@nx/js/babel", { "loose": true, "classProperties": { "loose": false } }]] }`
    );

    await migration(tree);

    expect(tree.read('.babelrc', 'utf-8')).toMatchInlineSnapshot(`
      "{
        "presets": [
          [
            "@nx/js/babel",
            {
              "loose": false
            }
          ]
        ]
      }
      "
    `);
  });

  it('drops an empty classProperties without setting loose', async () => {
    tree.write(
      '.babelrc',
      `{ "presets": [["@nx/js/babel", { "classProperties": {} }]] }`
    );

    await migration(tree);

    expect(tree.read('.babelrc', 'utf-8')).toMatchInlineSnapshot(
      `
      "{
        "presets": [["@nx/js/babel", {}]]
      }
      "
    `
    );
  });

  it('updates presets under env, overrides and overrides env alongside the top-level one', async () => {
    tree.write(
      '.babelrc',
      `{
  "presets": [["@nx/js/babel", { "classProperties": { "loose": false } }]],
  "env": { "test": { "presets": [["@nx/react/babel", { "classProperties": { "loose": false } }]] } },
  "overrides": [{
    "test": "./legacy",
    "presets": [["@nx/js/babel", { "classProperties": { "loose": false } }]],
    "env": { "production": { "presets": [["@nx/web/babel", { "classProperties": { "loose": false } }]] } }
  }]
}`
    );

    await migration(tree);

    expect(tree.read('.babelrc', 'utf-8')).toMatchInlineSnapshot(`
      "{
        "presets": [
          [
            "@nx/js/babel",
            {
              "loose": false
            }
          ]
        ],
        "env": {
          "test": {
            "presets": [
              [
                "@nx/react/babel",
                {
                  "loose": false
                }
              ]
            ]
          }
        },
        "overrides": [
          {
            "test": "./legacy",
            "presets": [
              [
                "@nx/js/babel",
                {
                  "loose": false
                }
              ]
            ],
            "env": {
              "production": {
                "presets": [
                  [
                    "@nx/web/babel",
                    {
                      "loose": false
                    }
                  ]
                ]
              }
            }
          }
        ]
      }
      "
    `);
  });

  it('leaves non-Nx presets and configs without classProperties unchanged', async () => {
    const otherPreset = `{ "presets": [["some-preset", { "classProperties": { "loose": false } }]] }\n`;
    const noOption = `{ "presets": [["@nx/js/babel", { "useBuiltIns": "usage" }]] }\n`;
    tree.write('libs/a/.babelrc', otherPreset);
    tree.write('libs/b/.babelrc', noOption);

    const result = await migration(tree);

    expect(tree.read('libs/a/.babelrc', 'utf-8')).toBe(otherPreset);
    expect(tree.read('libs/b/.babelrc', 'utf-8')).toBe(noOption);
    expect(result).toEqual({ skipAgentic: true });
  });

  it('is idempotent', async () => {
    tree.write(
      '.babelrc',
      `{ "presets": [["@nx/js/babel", { "classProperties": { "loose": false } }]] }`
    );

    await migration(tree);
    const once = tree.read('.babelrc', 'utf-8');
    await migration(tree);

    expect(tree.read('.babelrc', 'utf-8')).toBe(once);
  });

  it('reports unparsable JSON configs and JS configs using an Nx preset instead of editing them', async () => {
    const unparsable = `{ "presets": [["@nx/js/babel", { "classProperties": { "loose": false } }]`;
    tree.write('libs/a/.babelrc', unparsable);
    tree.write(
      'libs/b/babel.config.js',
      `const options = require('../../babel-options');
module.exports = { presets: [['@nx/js/babel', options]] };`
    );
    tree.write(
      'libs/c/babel.config.js',
      `module.exports = { presets: ['@babel/preset-env'] };`
    );

    const result = await migration(tree);

    expect(tree.read('libs/a/.babelrc', 'utf-8')).toBe(unparsable);
    expect(result).toEqual({
      nextSteps: [
        expect.stringContaining('Could not parse libs/a/.babelrc.'),
        expect.stringContaining(
          'libs/b/babel.config.js uses an Nx babel preset'
        ),
      ],
      agentContext: [
        expect.stringContaining('Could not parse libs/a/.babelrc.'),
        expect.stringContaining(
          'libs/b/babel.config.js uses an Nx babel preset'
        ),
      ],
    });
  });
});
