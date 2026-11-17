import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock prettier to avoid dynamic import issues
vi.mock('prettier', () => ({
  format: vi.fn((code) => code),
  resolveConfig: vi.fn(() => Promise.resolve({})),
  getFileInfo: vi.fn(() => Promise.resolve({})),
}));

// Mock @nx/js generators to control behavior
vi.mock('@nx/js', () => ({
  initGenerator: vi.fn(async (tree) => {
    // Add basic tsconfig files
    tree.write(
      'tsconfig.base.json',
      JSON.stringify({
        compileOnSave: false,
        compilerOptions: {
          rootDir: '.',
          sourceMap: true,
          declaration: false,
          moduleResolution: 'node',
          emitDecoratorMetadata: true,
          experimentalDecorators: true,
          importHelpers: true,
          target: 'es2015',
          module: 'esnext',
          lib: ['es2020', 'dom'],
          skipLibCheck: true,
          skipDefaultLibCheck: true,
          baseUrl: '.',
          paths: {},
        },
        exclude: ['node_modules', 'tmp'],
      })
    );
    tree.write(
      'tsconfig.json',
      JSON.stringify({
        extends: './tsconfig.base.json',
        compileOnSave: false,
        files: [],
        references: [],
      })
    );

    // Add nx.json with TypeScript plugin
    tree.write(
      'nx.json',
      JSON.stringify({
        plugins: [
          {
            plugin: '@nx/js/typescript',
            options: {
              typecheck: {
                targetName: 'typecheck',
              },
            },
          },
        ],
      })
    );

    return () => {};
  }),
  libraryGenerator: vi.fn(async (tree, options) => {
    const { name, directory } = options;
    const projectPath = directory;

    // Create library structure
    tree.write(`${projectPath}/tsconfig.lib.json`, JSON.stringify({}));
    tree.write(
      `${projectPath}/tsconfig.json`,
      JSON.stringify({
        extends: '../../tsconfig.base.json',
        compilerOptions: {
          module: 'commonjs',
          forceConsistentCasingInFileNames: true,
          strict: true,
          noImplicitOverride: true,
          noPropertyAccessFromIndexSignature: true,
          noImplicitReturns: true,
          noFallthroughCasesInSwitch: true,
        },
        files: [],
        include: [],
        references: [
          {
            path: './tsconfig.lib.json',
          },
        ],
      })
    );
    tree.write(
      `${projectPath}/package.json`,
      JSON.stringify({
        name: `@proj/${name}`,
        version: '0.0.1',
        private: true,
        type: 'module',
        scripts: {},
        main: './src/index.ts',
        types: './src/index.ts',
        exports: {
          '.': {
            import: './src/index.ts',
            types: './src/index.ts',
            default: './src/index.ts',
          },
          './package.json': './package.json',
        },
        nx: {
          name: name,
        },
        dependencies: {},
      })
    );
    tree.write(`${projectPath}/README.md`, `# ${name}`);
    tree.write(`${projectPath}/src/index.ts`, '');

    // Update tsconfig.json references
    const tsconfig = JSON.parse(tree.read('tsconfig.json', 'utf-8'));
    tsconfig.references = tsconfig.references || [];
    tsconfig.references.push({ path: `./${projectPath}` });
    tree.write('tsconfig.json', JSON.stringify(tsconfig, null, 2));

    return () => {};
  }),
  setupPrettierGenerator: vi.fn(async (tree) => {
    tree.write('.prettierrc', JSON.stringify({ singleQuote: true }));
    tree.write('.prettierignore', '/dist\n/coverage\n');

    // Update package.json devDependencies
    const packageJson = JSON.parse(tree.read('package.json', 'utf-8'));
    packageJson.dependencies = packageJson.dependencies || {};
    packageJson.devDependencies = packageJson.devDependencies || {};
    packageJson.devDependencies['prettier'] = '^2.6.2';
    packageJson.devDependencies['@nx/js'] = 'X.X.X';
    packageJson.devDependencies['@swc-node/register'] = 'X.X.X';
    packageJson.devDependencies['@swc/core'] = 'X.X.X';
    packageJson.devDependencies['@swc/helpers'] = 'X.X.X';
    packageJson.devDependencies['@types/node'] = 'X.X.X';
    packageJson.devDependencies['tslib'] = 'X.X.X';
    packageJson.devDependencies['typescript'] = 'X.X.X';
    tree.write('package.json', JSON.stringify(packageJson, null, 2));

    return () => {};
  }),
}));

import { readJson, Tree, writeJson } from '@nx/devkit';
import { createTree } from '@nx/devkit/testing';

import preset from './preset';

describe('preset', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTree();
    // createTree seeds a .prettierrc that a new workspace would not have
    tree.delete('.prettierrc');

    writeJson(tree, 'package.json', {
      name: '@proj/source',
      workspaces: ['packages/*'],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize a minimal TS monorepo and create a library with an example conformance rule inside', async () => {
    expect(tree.children('')).toMatchInlineSnapshot(`
[
  "package.json",
]
`);

    await preset(tree);

    expect(tree.children('')).toMatchInlineSnapshot(`
[
  ".prettierrc",
  "package.json",
  "nx.json",
  "tsconfig.base.json",
  "tsconfig.json",
  "packages",
  ".prettierignore",
]
`);

    expect(readJson(tree, 'nx.json')).toMatchInlineSnapshot(`
{
  "plugins": [
    {
      "options": {
        "typecheck": {
          "targetName": "typecheck",
        },
      },
      "plugin": "@nx/js/typescript",
    },
  ],
}
`);

    const packageJson = readJson(tree, 'package.json');
    // Strip specific version numbers from test snapshot by updating each value to X.X.X
    for (const depType of ['dependencies', 'devDependencies']) {
      Object.keys(packageJson[depType]).forEach((key) => {
        packageJson[depType][key] = 'X.X.X';
      });
    }
    expect(packageJson).toMatchInlineSnapshot(`
{
  "dependencies": {},
  "devDependencies": {
    "@nx/js": "X.X.X",
    "@swc-node/register": "X.X.X",
    "@swc/core": "X.X.X",
    "@swc/helpers": "X.X.X",
    "@types/node": "X.X.X",
    "esbuild": "X.X.X",
    "prettier": "X.X.X",
    "tslib": "X.X.X",
    "typescript": "X.X.X",
  },
  "name": "@proj/source",
  "workspaces": [
    "packages/*",
  ],
}
`);

    expect(readJson(tree, 'tsconfig.json')).toMatchInlineSnapshot(`
{
  "compileOnSave": false,
  "extends": "./tsconfig.base.json",
  "files": [],
  "references": [
    {
      "path": "./packages/conformance-rules",
    },
  ],
}
`);

    expect(tree.children('packages/conformance-rules')).toMatchInlineSnapshot(`
      [
        "tsconfig.lib.json",
        "tsconfig.json",
        "package.json",
        "README.md",
        "src",
      ]
    `);

    expect(tree.children('packages/conformance-rules/src'))
      .toMatchInlineSnapshot(`
[
  "example-conformance-rule",
]
`);

    expect(
      tree.children('packages/conformance-rules/src/example-conformance-rule')
    ).toMatchInlineSnapshot(`
[
  "index.ts",
  "schema.json",
]
`);

    expect(
      readJson(
        tree,
        'packages/conformance-rules/src/example-conformance-rule/schema.json'
      )
    ).toMatchInlineSnapshot(`
{
  "$id": "example-conformance-rule",
  "$schema": "http://json-schema.org/schema",
  "additionalProperties": false,
  "properties": {},
  "title": "example-conformance-rule rule configuration",
  "type": "object",
}
`);

    expect(
      tree.read(
        'packages/conformance-rules/src/example-conformance-rule/index.ts',
        'utf-8'
      )
    ).toMatchInlineSnapshot(`
"import { createConformanceRule, ConformanceViolation } from '@nx/conformance';

export default createConformanceRule({
  name: 'example-conformance-rule',
  category: 'consistency',
  description: 'An example conformance rule generated by the preset',
  implementation: async (context) => {
    const violations: ConformanceViolation[] = [];

    return {
      severity: 'low',
      details: {
        violations,
      },
    };
  },
});
"
`);

    expect(readJson(tree, 'packages/conformance-rules/package.json'))
      .toMatchInlineSnapshot(`
{
  "dependencies": {},
  "exports": {
    ".": {
      "default": "./src/index.ts",
      "import": "./src/index.ts",
      "types": "./src/index.ts",
    },
    "./package.json": "./package.json",
  },
  "main": "./src/index.ts",
  "name": "@proj/conformance-rules",
  "nx": {
    "name": "conformance-rules",
    "targets": {
      "build": {
        "executor": "@nx/conformance:bundle-rules",
        "options": {
          "outputPath": "{projectRoot}/dist",
        },
        "outputs": [
          "{options.outputPath}",
        ],
      },
      "publish-conformance-rules": {
        "command": "npx nx-cloud publish-conformance-rules {projectRoot}/dist",
        "dependsOn": [
          "build",
        ],
      },
    },
  },
  "private": true,
  "scripts": {},
  "type": "module",
  "types": "./src/index.ts",
  "version": "0.0.1",
}
`);
  });
});
