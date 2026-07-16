import { addProjectConfiguration, type Tree, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './set-ts-jest-isolated-modules';

const TS_JEST_CONFIG = `export default {
  displayName: 'lib1',
  preset: '../../jest.preset.js',
};
`;

/** Make the tree look like a ts-solution, package-manager-workspaces setup. */
function setupTsSolution(
  tree: Tree,
  { tsVersion, baseCompilerOptions = { composite: true } } = {} as {
    tsVersion?: string;
    baseCompilerOptions?: Record<string, unknown>;
  }
) {
  writeJson(tree, 'package.json', {
    name: '@acme/source',
    workspaces: ['packages/*'],
    devDependencies: { typescript: `~${tsVersion ?? '5.9.0'}` },
  });
  tree.write(
    'node_modules/typescript/package.json',
    JSON.stringify({ name: 'typescript', version: tsVersion ?? '5.9.2' })
  );
  writeJson(tree, 'tsconfig.base.json', {
    compilerOptions: baseCompilerOptions,
  });
  writeJson(tree, 'tsconfig.json', {
    extends: './tsconfig.base.json',
    files: [],
    include: [],
    references: [],
  });
}

function addTsJestProject(
  tree: Tree,
  name: string,
  { jestConfig = TS_JEST_CONFIG, tsconfigSpec = true } = {}
) {
  const root = `packages/${name}`;
  addProjectConfiguration(tree, name, { root, sourceRoot: `${root}/src` });
  tree.write(`${root}/jest.config.ts`, jestConfig);
  if (tsconfigSpec) {
    tree.write(
      `${root}/tsconfig.spec.json`,
      `{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./out-tsc/jest",
    "module": "commonjs",
    "types": ["jest", "node"]
  },
  "include": ["src/**/*.test.ts", "src/**/*.spec.ts", "src/**/*.d.ts"]
}
`
    );
  }
  return root;
}

describe('set-ts-jest-isolated-modules migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('adds isolatedModules to a ts-jest tsconfig.spec.json on TS < 6', async () => {
    setupTsSolution(tree, { tsVersion: '5.9.2' });
    const root = addTsJestProject(tree, 'lib1');

    await migration(tree);

    expect(tree.read(`${root}/tsconfig.spec.json`, 'utf-8'))
      .toMatchInlineSnapshot(`
      "{
        "extends": "../../tsconfig.base.json",
        "compilerOptions": {
          "outDir": "./out-tsc/jest",
          "module": "commonjs",
          "types": ["jest", "node"],
          "isolatedModules": true
        },
        "include": ["src/**/*.test.ts", "src/**/*.spec.ts", "src/**/*.d.ts"]
      }
      "
    `);
  });

  it('preserves comments and existing options', async () => {
    setupTsSolution(tree, { tsVersion: '5.9.2' });
    addProjectConfiguration(tree, 'lib1', { root: 'packages/lib1' });
    tree.write('packages/lib1/jest.config.ts', TS_JEST_CONFIG);
    tree.write(
      'packages/lib1/tsconfig.spec.json',
      `{
  // jest type-check config
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "commonjs" // forced by ts-jest
  }
}
`
    );

    await migration(tree);

    const result = tree.read('packages/lib1/tsconfig.spec.json', 'utf-8');
    expect(result).toContain('// jest type-check config');
    expect(result).toContain('// forced by ts-jest');
    expect(result).toContain('"isolatedModules": true');
  });

  it('is a no-op on TypeScript >= 6', async () => {
    setupTsSolution(tree, { tsVersion: '6.0.3' });
    const root = addTsJestProject(tree, 'lib1');
    const before = tree.read(`${root}/tsconfig.spec.json`, 'utf-8');

    await migration(tree);

    expect(tree.read(`${root}/tsconfig.spec.json`, 'utf-8')).toBe(before);
  });

  it('is a no-op when not a ts-solution (package-manager-workspaces) setup', async () => {
    // No workspaces / tsconfig.base setup -> path-based workspace.
    tree.write(
      'node_modules/typescript/package.json',
      JSON.stringify({ name: 'typescript', version: '5.9.2' })
    );
    const root = addTsJestProject(tree, 'lib1');
    const before = tree.read(`${root}/tsconfig.spec.json`, 'utf-8');

    await migration(tree);

    expect(tree.read(`${root}/tsconfig.spec.json`, 'utf-8')).toBe(before);
  });

  it('is a no-op when the base tsconfig already enables isolatedModules', async () => {
    setupTsSolution(tree, {
      tsVersion: '5.9.2',
      baseCompilerOptions: { composite: true, isolatedModules: true },
    });
    const root = addTsJestProject(tree, 'lib1');
    const before = tree.read(`${root}/tsconfig.spec.json`, 'utf-8');

    await migration(tree);

    expect(tree.read(`${root}/tsconfig.spec.json`, 'utf-8')).toBe(before);
  });

  it('skips swc, babel, and angular jest projects', async () => {
    setupTsSolution(tree, { tsVersion: '5.9.2' });
    const swc = addTsJestProject(tree, 'swclib', {
      jestConfig: `export default {
  preset: '../../jest.preset.js',
  transform: { '^.+\\\\.[tj]s$': ['@swc/jest'] },
};
`,
    });
    const babel = addTsJestProject(tree, 'babellib', {
      jestConfig: `export default {
  preset: '../../jest.preset.js',
  transform: { '^.+\\\\.[tj]s$': 'babel-jest' },
};
`,
    });
    const ng = addTsJestProject(tree, 'nglib', {
      jestConfig: `export default { preset: 'jest-preset-angular' };\n`,
    });
    const before = {
      swc: tree.read(`${swc}/tsconfig.spec.json`, 'utf-8'),
      babel: tree.read(`${babel}/tsconfig.spec.json`, 'utf-8'),
      ng: tree.read(`${ng}/tsconfig.spec.json`, 'utf-8'),
    };

    await migration(tree);

    expect(tree.read(`${swc}/tsconfig.spec.json`, 'utf-8')).toBe(before.swc);
    expect(tree.read(`${babel}/tsconfig.spec.json`, 'utf-8')).toBe(
      before.babel
    );
    expect(tree.read(`${ng}/tsconfig.spec.json`, 'utf-8')).toBe(before.ng);
  });

  it('skips a project whose tsconfig.spec.json already sets isolatedModules', async () => {
    setupTsSolution(tree, { tsVersion: '5.9.2' });
    addProjectConfiguration(tree, 'lib1', { root: 'packages/lib1' });
    tree.write('packages/lib1/jest.config.ts', TS_JEST_CONFIG);
    const original = `{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "module": "commonjs", "isolatedModules": true }
}
`;
    tree.write('packages/lib1/tsconfig.spec.json', original);

    await migration(tree);

    expect(tree.read('packages/lib1/tsconfig.spec.json', 'utf-8')).toBe(
      original
    );
  });

  it('skips a ts-jest project that has no tsconfig.spec.json', async () => {
    setupTsSolution(tree, { tsVersion: '5.9.2' });
    addProjectConfiguration(tree, 'lib1', { root: 'packages/lib1' });
    tree.write('packages/lib1/jest.config.ts', TS_JEST_CONFIG);

    await expect(migration(tree)).resolves.not.toThrow();
    expect(tree.exists('packages/lib1/tsconfig.spec.json')).toBe(false);
  });
});
