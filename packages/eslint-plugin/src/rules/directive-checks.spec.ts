import { type ProjectGraph, type ProjectGraphProjectNode } from '@nx/devkit';
import { createProjectRootMappings } from '@nx/devkit/internal';
import * as parser from '@typescript-eslint/parser';
import { TSESLint } from '@typescript-eslint/utils';
import directiveChecks, { RULE_NAME } from './directive-checks';

const { readSourceMapsCache } = vi.hoisted(() => ({
  readSourceMapsCache: vi.fn(),
}));

vi.mock('@nx/devkit/internal', async () => ({
  ...(await vi.importActual<any>('@nx/devkit/internal')),
  readSourceMapsCache,
}));

const linter = new TSESLint.Linter();
const projectPath = `${process.cwd()}/proj`;

function project(
  name: string,
  root: string,
  targets: ProjectGraphProjectNode['data']['targets'] = {}
): ProjectGraphProjectNode {
  return { name, type: 'lib', data: { root, targets } };
}

function runRule(
  content: string,
  {
    file = 'apps/shop-e2e/src/checkout.spec.ts',
    nodes = [project('shop-e2e', 'apps/shop-e2e')],
    sourceMaps = null,
  }: {
    file?: string;
    nodes?: ProjectGraphProjectNode[];
    sourceMaps?: Record<string, Record<string, [string, string]>> | null;
  } = {}
): TSESLint.Linter.LintMessage[] {
  const projectGraph: ProjectGraph = {
    nodes: Object.fromEntries(nodes.map((node) => [node.name, node])),
    dependencies: Object.fromEntries(nodes.map((node) => [node.name, []])),
  };
  readSourceMapsCache.mockReturnValue(sourceMaps);
  (global as any).projectPath = projectPath;
  (global as any).projectGraph = projectGraph;
  (global as any).projectFileMap = {};
  (global as any).projectRootMappings = createProjectRootMappings(
    projectGraph.nodes
  );
  return linter.verify(
    content,
    [
      {
        files: ['**/*.ts'],
        languageOptions: {
          parser,
          parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
        },
        plugins: { '@nx': { rules: { [RULE_NAME]: directiveChecks } } },
        rules: { [`@nx/${RULE_NAME}`]: 'error' },
      },
    ] as any,
    `${projectPath}/${file}`
  );
}

function summarize(messages: TSESLint.Linter.LintMessage[]) {
  return messages.map(({ messageId, line, column, endColumn }) => ({
    messageId,
    line,
    column,
    endColumn,
  }));
}

describe('directive-checks', () => {
  describe('the comment block that opens a file', () => {
    it.each([
      [
        'a misspelled name, with a suggestion',
        '// @nx-depend-on: shop',
        'unknownDirectiveSuggestion',
        '"@nx-depend-on" is not a directive Nx reads, so Nx ignores it. Did you mean "@nx-depends-on"?',
      ],
      [
        'an unknown name',
        '// @nx-cache-forever',
        'unknownDirective',
        '"@nx-cache-forever" is not a directive Nx reads, so Nx ignores it.',
      ],
      [
        'a known name without its colon',
        '// @nx-depends-on shop',
        'unparsableDirective',
        'Nx can\'t read this "@nx-depends-on" directive, so it ignores it. Write it as "@nx-depends-on: <project>, <project>".',
      ],
      [
        'a bare directive followed by text',
        '// @nx-ignore-server-inputs // the app is mocked',
        'unparsableDirective',
        'Nx can\'t read this "@nx-ignore-server-inputs" directive, so it ignores it. Write it as "@nx-ignore-server-inputs".',
      ],
      [
        'an @nx-depends-on with no projects',
        '// @nx-depends-on: , ',
        'emptyDependsOn',
        '"@nx-depends-on" lists no projects, so Nx ignores it. List the projects the test depends on, separated by commas.',
      ],
      [
        'an @nx-ignore-server-inputs with a value',
        '// @nx-ignore-server-inputs: true',
        'ignoreServerInputsValue',
        '"@nx-ignore-server-inputs" takes no value, so Nx ignores it. Write "@nx-ignore-server-inputs" alone.',
      ],
      [
        'an empty @nx-target-name',
        '#!/usr/bin/env node\n// @nx-target-name:',
        'emptyTargetName',
        '"@nx-target-name" is empty, so Nx ignores it.',
      ],
    ])('reports %s', (_, content, messageId, message) => {
      expect(runRule(content)).toEqual([
        expect.objectContaining({ messageId, message }),
      ]);
    });

    it('reports every @nx-target-name after the first', () => {
      const messages = runRule(
        '// @nx-target-name: seed\n// @nx-target-name: seed-db\n// @nx-target-name: db'
      );

      expect(summarize(messages)).toEqual([
        {
          messageId: 'extraTargetName',
          line: 2,
          column: 4,
          endColumn: 28,
        },
        {
          messageId: 'extraTargetName',
          line: 3,
          column: 4,
          endColumn: 23,
        },
      ]);
    });

    it('reports a known directive in a comment after code', () => {
      const messages = runRule(
        "'use strict';\nimport './a';\n/**\n * @nx-depends-on: shop\n */\nconst a = 1; // @nx-ignore-server-inputs"
      );

      expect(messages.map(({ message }) => message)).toEqual([
        'Nx reads "@nx-depends-on" only in the comments that open the file, on lines before any code, so it ignores this one.',
        'Nx reads "@nx-ignore-server-inputs" only in the comments that open the file, on lines before any code, so it ignores this one.',
      ]);
      expect(summarize(messages)).toEqual([
        expect.objectContaining({ line: 4, column: 4, endColumn: 24 }),
        expect.objectContaining({ line: 6, column: 17, endColumn: 41 }),
      ]);
    });

    it('reports a directive on the line where code follows the comment that opens the file', () => {
      const messages = runRule(
        '/* Header\n * @nx-depends-on: shop\n * @nx-ignore-server-inputs */ export {};'
      );

      expect(
        messages.map(({ messageId, line }) => ({ messageId, line }))
      ).toEqual([{ messageId: 'directiveAfterCode', line: 3 }]);
    });

    it.each([
      [
        'directives Nx reads',
        '#!/usr/bin/env node\n/**\n * @nx-target-name: seed\n */\n// @nx-ignore-server-inputs\nexport {};',
      ],
      [
        'an empty @nx-depends-on next to one listing projects',
        '// @nx-depends-on:\n// @nx-depends-on: shop',
      ],
      [
        'repeated bare @nx-ignore-server-inputs',
        '// @nx-ignore-server-inputs\n// @nx-ignore-server-inputs',
      ],
      [
        'an @nx- mention that is not a whole line',
        '// See @nx-depends-on in the docs.\n// Uses @nx-ignore-server-inputs.\nexport {};\n// see @nx-depends-on',
      ],
    ])('does not report %s', (_, content) => {
      expect(runRule(content)).toEqual([]);
    });
  });

  describe('a directive the runner of an atomized test file ignores', () => {
    const file = 'apps/shop-e2e/src/checkout.spec.ts';
    const splitTarget = 'e2e-ci--src/checkout.spec.ts';

    function runWithPlugin(content: string, plugin: string | undefined) {
      return runRule(content, {
        file,
        nodes: [
          project('shop-e2e', 'apps/shop-e2e', { [splitTarget]: {} }),
          project('shop', 'apps/shop'),
        ],
        sourceMaps: plugin
          ? {
              'apps/shop-e2e': {
                [`targets.${splitTarget}`]: ['jest.config.ts', plugin],
              },
            }
          : null,
      });
    }

    it.each([
      ['@nx/jest/plugin', 'ignore-server-inputs'],
      ['@nx/vitest', 'ignore-server-inputs'],
      ['@nx/vitest', 'depends-on'],
    ])('reports %s ignoring @nx-%s', (plugin, name) => {
      const content =
        name === 'depends-on'
          ? '// @nx-depends-on: shop'
          : '// @nx-ignore-server-inputs';

      expect(runWithPlugin(content, plugin)).toEqual([
        expect.objectContaining({
          messageId: 'unsupportedDirective',
          message: `${plugin} doesn't apply "@nx-${name}", so Nx ignores it in this file.`,
        }),
      ]);
    });

    it.each([
      ['a plugin that applies it', '@nx/playwright/plugin'],
      ['a plugin the rule does not know', '@acme/e2e-plugin'],
      ['no cached source map', undefined],
    ])('does not report a split task from %s', (_, plugin) => {
      expect(
        runWithPlugin('// @nx-ignore-server-inputs', plugin).filter(
          ({ messageId }) => messageId === 'unsupportedDirective'
        )
      ).toEqual([]);
    });

    it('reports only that the runner ignores a directive, not its value', () => {
      const messages = runWithPlugin(
        '// @nx-depends-on:\n// @nx-ignore-server-inputs: true',
        '@nx/jest/plugin'
      );

      expect(
        messages.map(({ messageId, line }) => ({ messageId, line }))
      ).toEqual([
        { messageId: 'emptyDependsOn', line: 1 },
        { messageId: 'unsupportedDirective', line: 2 },
      ]);
    });

    it('does not report a file that no split task runs', () => {
      expect(
        runRule('// @nx-ignore-server-inputs', {
          file: 'apps/shop-e2e/src/other.spec.ts',
          nodes: [project('shop-e2e', 'apps/shop-e2e', { [splitTarget]: {} })],
          sourceMaps: {
            'apps/shop-e2e': {
              [`targets.${splitTarget}`]: ['jest.config.ts', '@nx/jest/plugin'],
            },
          },
        })
      ).toEqual([]);
    });
  });

  describe('@nx-depends-on patterns', () => {
    const splitTarget = 'e2e-ci--src/checkout.spec.ts';

    const playwright: [string, string] = [
      'apps/shop-e2e/playwright.config.ts',
      '@nx/playwright/plugin',
    ];

    /** Runs the rule with `inputs` written by `inputSources`, item by item. */
    function runWithInputs(
      inputs: ProjectGraphProjectNode['data']['targets'][string]['inputs'],
      inputsSource: [string, string],
      inputSources: [string, string][]
    ) {
      return runRule(
        '// @nx-depends-on: shop-e2e, shop-uii, !legacy, tag:none',
        {
          nodes: [
            project('shop-e2e', 'apps/shop-e2e', { [splitTarget]: { inputs } }),
            project('shop-ui', 'libs/shop-ui'),
          ],
          sourceMaps: {
            'apps/shop-e2e': {
              [`targets.${splitTarget}`]: playwright,
              [`targets.${splitTarget}.inputs`]: inputsSource,
              ...Object.fromEntries(
                inputSources.map((source, index) => [
                  `targets.${splitTarget}.inputs.${index}`,
                  source,
                ])
              ),
            },
          },
        }
      );
    }

    // The cached graph predates the edit that added `shop-uii` and `tag:none`,
    // and a target default spreads the inputs the plugin added.
    it('reports each pattern that matches no project where it is written', () => {
      const projects = ['shop-e2e', 'shop-ui'];
      const messages = runWithInputs(
        [
          'default',
          { input: 'production', projects, always: true },
          { input: 'production', projects, dependencies: true, always: true },
          { externalDependencies: ['@playwright/test'] },
        ],
        ['nx.json#targetDefaults.e2e-ci--**/**', 'nx/target-defaults'],
        [playwright, playwright, playwright, playwright]
      );

      expect(
        messages.map(({ message, column, endColumn }) => ({
          message,
          column,
          endColumn,
        }))
      ).toEqual([
        {
          message:
            '"shop-uii" matches no project. Any Nx command that runs this test fails. Did you mean "shop-ui"?',
          column: 30,
          endColumn: 38,
        },
        {
          message:
            '"tag:none" matches no project. Any Nx command that runs this test fails.',
          column: 49,
          endColumn: 57,
        },
      ]);
    });

    // The hasher checks the replacement's patterns, not the directive's.
    it('does not report patterns when a project.json entry replaces the inputs the plugin added', () => {
      const projectJson: [string, string] = [
        'apps/shop-e2e/project.json',
        'nx/core/project-json',
      ];
      expect(
        runWithInputs(
          [
            'default',
            '^production',
            { input: 'default', projects: ['shop-ui'], always: true },
          ],
          projectJson,
          [projectJson, projectJson, projectJson]
        )
      ).toEqual([]);
    });
  });
});
