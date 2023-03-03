import {
  cleanupProject,
  createFile,
  expectJestTestsToPass,
  newProject,
  readJson,
  runCLI,
  uniq,
  updateFile,
  updateJson,
} from '../../utils';

describe('js e2e', () => {
  let scope: string;

  beforeEach(() => {
    scope = newProject();
  });

  afterEach(() => cleanupProject());

  it('should create libs with npm scripts', () => {
    const npmScriptsLib = uniq('npmscriptslib');
    runCLI(
      `generate @nrwl/js:lib ${npmScriptsLib} --config=npm-scripts --no-interactive`
    );
    const libPackageJson = readJson(`libs/${npmScriptsLib}/package.json`);
    expect(libPackageJson.scripts.test).toBeDefined();
    expect(libPackageJson.scripts.build).toBeDefined();
    expect(runCLI(`test ${npmScriptsLib}`)).toContain('implement test');

    const tsconfig = readJson(`tsconfig.base.json`);
    expect(tsconfig.compilerOptions.paths).toEqual({
      [`@${scope}/${npmScriptsLib}`]: [`libs/${npmScriptsLib}/src/index.ts`],
    });
  }, 240_000);

  it('should allow wildcard ts path alias', async () => {
    const base = uniq('base');
    runCLI(`generate @nrwl/js:lib ${base} --bundler=tsc --no-interactive`);

    const lib = uniq('lib');
    runCLI(`generate @nrwl/js:lib ${lib} --bundler=tsc --no-interactive`);

    updateFile(`libs/${base}/src/index.ts`, () => {
      return `
        import { ${lib} } from '@${scope}/${lib}'
        export * from './lib/${base}';

        ${lib}();
      `;
    });

    expect(runCLI(`build ${base}`)).toContain(
      'Done compiling TypeScript files'
    );

    updateJson('tsconfig.base.json', (json) => {
      json['compilerOptions']['paths'][`@${scope}/${lib}/*`] = [
        `libs/${lib}/src/*`,
      ];
      return json;
    });

    createFile(
      `libs/${lib}/src/${lib}.ts`,
      `
export function ${lib}Wildcard() {
  return '${lib}-wildcard';
};
    `
    );

    updateFile(`libs/${base}/src/index.ts`, () => {
      return `
        import { ${lib} } from '@${scope}/${lib}';
        import { ${lib}Wildcard } from '@${scope}/${lib}/src/${lib}';
        export * from './lib/${base}';

        ${lib}();
        ${lib}Wildcard();
      `;
    });

    expect(runCLI(`build ${base}`)).toContain(
      'Done compiling TypeScript files'
    );
  }, 240_000);

  it('should run default jest tests', async () => {
    await expectJestTestsToPass('@nrwl/js:lib');
  }, 240_000);
});
