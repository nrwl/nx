import {
  cleanupProject,
  newProject,
  packageInstall,
  runCLI,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';

describe('@nx/js/typescript typecheck outside TS solution setups', () => {
  const lib = uniq('lib');
  // A cache hit prints "[local cache]" or, when the daemon finds the outputs
  // already on disk, "[existing outputs match the cache, left as is]".
  const fromCache = /\[(local cache|existing outputs match the cache)/;

  beforeAll(() => {
    newProject({ packages: ['@nx/js'] });
    updateJson('nx.json', (json) => {
      json.plugins = [
        ...(json.plugins ?? []).filter(
          (p) => (typeof p === 'string' ? p : p.plugin) !== '@nx/js/typescript'
        ),
        '@nx/js/typescript',
      ];
      return json;
    });
    updateFile(`libs/${lib}/project.json`, JSON.stringify({ name: lib }));
    updateFile(
      `libs/${lib}/tsconfig.json`,
      JSON.stringify({
        compilerOptions: { strict: true, types: [] },
        include: ['src/**/*.ts'],
      })
    );
    updateFile(`libs/${lib}/src/index.ts`, `export const value: number = 1;\n`);
  });

  afterAll(() => cleanupProject());

  it('should rerun when an npm alias of typescript is updated', () => {
    packageInstall('@typescript/native', undefined, 'npm:typescript@6.0.2');
    expect(runCLI(`typecheck ${lib}`)).not.toMatch(fromCache);
    expect(runCLI(`typecheck ${lib}`)).toMatch(fromCache);

    packageInstall('@typescript/native', undefined, 'npm:typescript@6.0.3');

    expect(runCLI(`typecheck ${lib}`)).not.toMatch(fromCache);
  });
});
