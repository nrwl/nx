import {
  cleanupProject,
  newProject,
  readFile,
  runCLI,
  runCommand,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';
import { typescriptVersion } from '@nx/js/src/utils/versions';

describe('nx sync', () => {
  beforeAll(() => {
    newProject({ packages: [], packageManager: 'npm' });
  });

  afterAll(() => cleanupProject());

  // Regression test: the daemon runs sync generators in-process and is spawned
  // with the workspace's custom resolve conditions, so a generator's workspace
  // imports resolve to TypeScript source whose NodeNext `.js` specifiers need
  // the `.js` -> `.ts` resolver hooks registered at daemon startup.
  it('should run a global sync generator whose workspace imports resolve to TypeScript source via custom conditions', () => {
    updateJson('package.json', (json) => {
      json.workspaces = ['packages/*'];
      json.devDependencies ??= {};
      json.devDependencies['typescript'] = typescriptVersion;
      return json;
    });
    updateFile(
      'tsconfig.base.json',
      JSON.stringify({
        compilerOptions: {
          module: 'nodenext',
          moduleResolution: 'nodenext',
          target: 'es2022',
          strict: true,
          declaration: true,
          customConditions: ['source'],
        },
      })
    );

    // ESM workspace lib exposing its TypeScript source via the custom condition
    updateFile(
      'packages/utils/package.json',
      JSON.stringify({
        name: '@proj/utils',
        version: '0.0.0',
        type: 'module',
        exports: {
          '.': {
            source: './src/index.ts',
            types: './dist/index.d.ts',
            default: './dist/index.js',
          },
        },
      })
    );
    updateFile(
      'packages/utils/tsconfig.json',
      JSON.stringify({
        extends: '../../tsconfig.base.json',
        compilerOptions: { rootDir: 'src', outDir: 'dist' },
        include: ['src'],
      })
    );
    // NodeNext convention: `.js` specifier for a `.ts` source file
    updateFile(
      'packages/utils/src/index.ts',
      `export { greet } from './lib/greet.js';`
    );
    updateFile(
      'packages/utils/src/lib/greet.ts',
      `export function greet(name: string): string {
        return \`Hello, \${name}!\`;
      }`
    );

    // ESM plugin whose sync generator imports the workspace lib
    updateFile(
      'packages/plugin/package.json',
      JSON.stringify({
        name: '@proj/plugin',
        version: '0.0.0',
        type: 'module',
        exports: {
          './package.json': './package.json',
          '.': {
            source: './src/index.ts',
            types: './dist/index.d.ts',
            default: './dist/index.js',
          },
        },
        generators: './generators.json',
        dependencies: { '@proj/utils': '*' },
      })
    );
    updateFile(
      'packages/plugin/tsconfig.json',
      JSON.stringify({
        extends: '../../tsconfig.base.json',
        compilerOptions: { rootDir: 'src', outDir: 'dist' },
        include: ['src'],
      })
    );
    updateFile(
      'packages/plugin/generators.json',
      JSON.stringify({
        generators: {
          sync: {
            factory: './dist/generators/sync.js',
            schema: './generators-schema.json',
            description: 'Sync generator that imports @proj/utils',
          },
        },
      })
    );
    updateFile(
      'packages/plugin/generators-schema.json',
      JSON.stringify({ type: 'object', properties: {} })
    );
    updateFile(
      'packages/plugin/src/index.ts',
      `export const createNodesV2 = ['**/package.json', async () => []];`
    );
    updateFile(
      'packages/plugin/src/generators/sync.ts',
      `import { greet } from '@proj/utils';

      export default function syncGenerator(tree: {
        write(path: string, content: string): void;
      }) {
        tree.write('sync-output.txt', greet('sync'));
      }`
    );

    updateJson('nx.json', (json) => {
      json.plugins = [...(json.plugins ?? []), '@proj/plugin'];
      json.sync = { globalGenerators: ['@proj/plugin:sync'] };
      return json;
    });

    // Build with tsc directly: running builds through nx would itself trigger
    // the sync check before the packages exist in dist.
    runCommand('npm install');
    runCommand('npx tsc -p packages/utils/tsconfig.json');
    runCommand('npx tsc -p packages/plugin/tsconfig.json');

    // Kill any daemon started before the custom conditions existed, so the
    // sync below spawns one with the workspace's resolve conditions.
    runCLI('reset');
    runCLI('sync', { env: { NX_DAEMON: 'true' } });

    expect(readFile('sync-output.txt')).toBe('Hello, sync!');
    // Guard against a silently disabled daemon: the generator must have run in
    // the daemon process, which is the process this regression is about.
    expect(readFile('.nx/workspace-data/d/daemon.log')).toContain(
      'running scheduled generator @proj/plugin:sync'
    );
  });
});
