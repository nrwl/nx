import { symlinkSync } from 'fs';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { dirname, join } from 'path';

const source = `/** @type {import('vite').UserConfig} */
import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export const routes = [
  { path: 'home', loadChildren: () => import('./home') },
  { path: 'admin', providers: [AdminService] },
  { path: 'admin', children: [] },
];

export default defineConfig(
  { cacheDir: '../../node_modules/.vite/app', test: { maxThreads: 4 } },
  { plugins: [nxViteTsPaths()] }
);
`;

describe.each([
  ['TypeScript 6', 'typescript', 'classic'],
  ['TypeScript 7.1', '@typescript/native', 'api'],
])('tsquery on %s', (_, packageName, backendKind) => {
  let fs: TempFs;
  let tsquery: typeof import('./tsquery').tsquery;

  beforeAll(async () => {
    fs = new TempFs('tsquery');
    fs.createDirSync('node_modules');
    symlinkSync(
      dirname(require.resolve(`${packageName}/package.json`)),
      join(fs.tempDir, 'node_modules/typescript'),
      'dir'
    );
    vi.resetModules();
    (await import('nx/src/utils/workspace-root')).setWorkspaceRoot(fs.tempDir);
    const { getTypescriptBackend } = await import('nx/src/devkit-internals');
    expect(getTypescriptBackend().kind).toBe(backendKind);
    ({ tsquery } = await import('./tsquery'));
  });

  afterAll(() => {
    fs.cleanup();
  });

  it.each([
    [
      'PropertyAssignment > Identifier[name=/^max(Threads|Forks)$/]',
      ['maxThreads'],
    ],
    [
      'PropertyAssignment:has(Identifier[name="cacheDir"]) > StringLiteral',
      ["'../../node_modules/.vite/app'"],
    ],
    ['ImportDeclaration > StringLiteral[value="vite"]', ["'vite'"]],
    ['ImportSpecifier:has([text="nxViteTsPaths"])', ['nxViteTsPaths']],
    ['PropertyAssignment > NumericLiteral[value=4]', ['4']],
    [
      'PropertyAssignment:not(:has(Identifier[name=path])) > Identifier',
      [
        'loadChildren',
        'providers',
        'children',
        'cacheDir',
        'test',
        'maxThreads',
        'plugins',
      ],
    ],
    [
      'ObjectLiteralExpression:has(PropertyAssignment:has(Identifier[name=path]) > StringLiteral[value=admin]):last-child',
      ["{ path: 'admin', children: [] }"],
    ],
    [
      'ExportAssignment ObjectLiteralExpression:first-child',
      ["{ cacheDir: '../../node_modules/.vite/app', test: { maxThreads: 4 } }"],
    ],
  ])('should match %s', (selector, expected) => {
    const matches = tsquery.query(tsquery.ast(source), selector);

    expect(matches.map((node) => node.getText())).toEqual(expected);
  });

  it('should reject a selector with an unknown node kind', () => {
    expect(() => tsquery.query(source, 'NotAKind')).toThrow(
      '"NotAKind" is not a valid TypeScript Node kind.'
    );
  });

  it('should replace the matches the transformer returns text for and keep the rest of the source', () => {
    const result = tsquery.replace(
      source,
      'PropertyAssignment:has(Identifier[name=path]) > StringLiteral',
      (node) => (node.getText() === "'home'" ? "'start'" : null)
    );

    expect(result).toBe(source.replace("path: 'home'", "path: 'start'"));
  });
});
