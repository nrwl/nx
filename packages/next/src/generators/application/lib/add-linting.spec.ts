import {
  ProjectConfiguration,
  ProjectGraph,
  Tree,
  addProjectConfiguration,
  logger,
  readJson,
  updateJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { addLinting } from './add-linting';
import { NormalizedSchema } from './normalize-options';

let projectGraph: ProjectGraph;
vi.mock('@nx/devkit', async () => ({
  ...(await vi.importActual<any>('@nx/devkit')),
  createProjectGraphAsync: vi.fn().mockImplementation(async () => projectGraph),
}));

describe('updateEslint', () => {
  let tree: Tree;
  let schema: NormalizedSchema;

  beforeEach(async () => {
    projectGraph = { nodes: {}, dependencies: {}, externalNodes: {} };
    schema = {
      projectName: 'my-app',
      projectSimpleName: 'my-app',
      appProjectRoot: 'my-app',
      directory: 'my-app',
      importPath: '@proj/my-app',
      linter: 'eslint',
      unitTestRunner: 'jest',
      e2eProjectName: 'my-app-e2e',
      e2eProjectRoot: 'my-app-e2e',
      outputPath: 'dist/my-app',
      parsedTags: [],
      fileName: 'index',
      e2eTestRunner: 'cypress',
      isTsSolutionSetup: false,
    };
    tree = createTreeWithEmptyWorkspace();
    const project: ProjectConfiguration = {
      root: schema.appProjectRoot,
      sourceRoot: schema.appProjectRoot,
      projectType: 'application',
      targets: {},
      tags: schema.parsedTags,
    };

    addProjectConfiguration(tree, schema.projectName, {
      ...project,
    });
  });

  it('should update the eslintrc config', async () => {
    tree.write('.eslintrc.json', JSON.stringify({ extends: ['some-config'] }));

    await addLinting(tree, schema);

    expect(readJson(tree, `${schema.appProjectRoot}/.eslintrc.json`))
      .toMatchInlineSnapshot(`
      {
        "extends": [
          "plugin:@nx/react-typescript",
          "next",
          "next/core-web-vitals",
          "../.eslintrc.json",
        ],
        "ignorePatterns": [
          "!**/*",
          ".next/**/*",
        ],
        "overrides": [
          {
            "files": [
              "*.ts",
              "*.tsx",
              "*.js",
              "*.jsx",
            ],
            "rules": {
              "@next/next/no-html-link-for-pages": [
                "error",
                "my-app/pages",
              ],
            },
          },
          {
            "files": [
              "*.ts",
              "*.tsx",
            ],
            "rules": {},
          },
          {
            "files": [
              "*.js",
              "*.jsx",
            ],
            "rules": {},
          },
        ],
      }
    `);
  });

  it('should update the flat config', async () => {
    tree.write('eslint.config.cjs', `module.exports = []`);

    await addLinting(tree, schema);

    expect(tree.read(`${schema.appProjectRoot}/eslint.config.cjs`, 'utf-8'))
      .toMatchInlineSnapshot(`
      "const nx = require("@nx/eslint-plugin");
      const nextVitals = require("eslint-config-next/core-web-vitals");
      const baseConfig = require("../eslint.config.cjs");

      module.exports = [
          ...nextVitals,

          ...nx.configs["flat/react-typescript"],
          ...baseConfig,
          {
              ignores: [
                  ".next/**/*"
              ]
          }
      ];
      "
    `);
  });

  it.each([
    [
      '~9.39.0',
      'flat/react',
      'nextEslintPluginNext.configs["core-web-vitals"]',
      'eslint-config-next',
      true,
    ],
    [
      '~9.39.0',
      'flat/react-base',
      'nextEslintPluginNext.configs["core-web-vitals"]',
      'eslint-config-next',
      true,
    ],
    [
      '^10.0.0',
      'flat/react-base',
      '...nextVitals',
      '@next/eslint-plugin-next',
      false,
    ],
  ])(
    'with ESLint %s and a root config that spreads %s, should add %s',
    async (eslintVersion, rootPreset, expectedElement, absentModule, warns) => {
      updateJson(tree, 'package.json', (json) => ({
        ...json,
        devDependencies: { ...json.devDependencies, eslint: eslintVersion },
      }));
      tree.write(
        'eslint.config.mjs',
        `import nx from '@nx/eslint-plugin';\n\nexport default [...nx.configs['${rootPreset}']];\n`
      );

      const warnSpy = vi.spyOn(logger, 'warn');
      await addLinting(tree, schema);

      const appConfig = tree.read(
        `${schema.appProjectRoot}/eslint.config.mjs`,
        'utf-8'
      );
      expect(appConfig).toContain(expectedElement);
      expect(appConfig).not.toContain(absentModule);
      const fallbackWarnings = warnSpy.mock.calls
        .map(([message]) => message)
        .filter((message) => message.includes('@next/eslint-plugin-next'));
      expect(fallbackWarnings).toEqual(
        warns
          ? [
              expect.stringContaining(
                'eslint.config.mjs registers react, react-hooks, import or jsx-a11y'
              ),
            ]
          : []
      );
      warnSpy.mockRestore();
    }
  );

  const nextPluginConfig = [
    'nextEslintPluginNext.configs["core-web-vitals"]',
    'eslint-config-next',
  ] as const;
  const nextVitalsSpread = [
    '...nextVitals',
    '@next/eslint-plugin-next',
  ] as const;
  const localModuleChain = (lastModule: string): Record<string, string> => ({
    'eslint.config.mjs': `import nx from '@nx/eslint-plugin';\nimport shared from './tools/eslint/index.mjs';\n\nexport default [...nx.configs['flat/base'], ...shared];\n`,
    'tools/eslint/index.mjs': `import './cycle.mjs';\n\nexport { default } from './react.cjs';\n`,
    'tools/eslint/cycle.mjs': `import './index.mjs';\n`,
    'tools/eslint/react.cjs': `const hooks = require('./hooks');\n\nmodule.exports = [hooks];\n`,
    'tools/eslint/hooks.js': lastModule,
  });

  it.each([
    [
      'one of them registers a plugin eslint-config-next also registers',
      localModuleChain(
        `const reactHooks = require('eslint-plugin-react-hooks');\n\nmodule.exports = { plugins: { 'react-hooks': reactHooks } };\n`
      ),
      ...nextPluginConfig,
    ],
    [
      'one of them registers such a plugin under a computed key',
      localModuleChain(
        `const name = 'react-hooks';\n\nmodule.exports = { plugins: { [name]: require('eslint-plugin-react-hooks') } };\n`
      ),
      ...nextPluginConfig,
    ],
    [
      'one of them loads a config of such a plugin by subpath',
      localModuleChain(
        `module.exports = require('eslint-plugin-react/configs/recommended');\n`
      ),
      ...nextPluginConfig,
    ],
    [
      'none of them registers such a plugin',
      localModuleChain(`module.exports = { rules: {} };\n`),
      ...nextVitalsSpread,
    ],
  ])(
    'should follow the local modules the root config loads when %s',
    async (_, files, expectedElement, absentModule) => {
      updateJson(tree, 'package.json', (json) => ({
        ...json,
        devDependencies: { ...json.devDependencies, eslint: '~9.39.0' },
      }));
      for (const [file, content] of Object.entries(files)) {
        tree.write(file, content);
      }

      await addLinting(tree, schema);

      const appConfig = tree.read(
        `${schema.appProjectRoot}/eslint.config.mjs`,
        'utf-8'
      );
      expect(appConfig).toContain(expectedElement);
      expect(appConfig).not.toContain(absentModule);
    }
  );

  it('should pin ESLint v9 when the workspace uses Next.js 15', async () => {
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: { ...json.dependencies, next: '~15.2.4' },
    }));

    await addLinting(tree, schema);

    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies['eslint']).toBe('^9.8.0');
    expect(devDependencies['eslint-config-next']).toBe('^15.5.18');
    expect(devDependencies['eslint-plugin-react']).toBeDefined();
    expect(devDependencies['eslint-plugin-import-x']).toBeUndefined();
  });

  it('should not pin ESLint v9 when the workspace uses the latest Next.js version', async () => {
    await addLinting(tree, schema);

    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies['eslint']).toBe('^10.0.0');
  });
});
