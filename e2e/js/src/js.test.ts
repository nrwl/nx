import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  createFile,
  newProject,
  readJson,
  runCLI,
  runCLIAsync,
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
      `generate @nx/js:lib ${npmScriptsLib} --config=npm-scripts --no-interactive`
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
    runCLI(`generate @nx/js:lib ${base} --bundler=tsc --no-interactive`);

    const lib = uniq('lib');
    runCLI(`generate @nx/js:lib ${lib} --bundler=tsc --no-interactive`);

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

  it('should create a library that can be linted and tested', async () => {
    const libName = uniq('mylib');
    const dirName = uniq('dir');

    runCLI(`generate @nx/js:lib ${libName} --directory ${dirName}`);

    checkFilesExist(
      `libs/${dirName}/${libName}/src/index.ts`,
      `libs/${dirName}/${libName}/README.md`
    );

    // Lint
    const result = runCLI(`lint ${dirName}-${libName}`);

    expect(result).toContain(`Linting "${dirName}-${libName}"...`);
    expect(result).toContain('All files pass linting.');

    // Test
    const testResult = await runCLIAsync(`test ${dirName}-${libName}`);
    expect(testResult.combinedOutput).toContain(
      'Test Suites: 1 passed, 1 total'
    );
  }, 500_000);

  it('should be able to use and be used by other libs', () => {
    const consumerLib = uniq('consumer');
    const producerLib = uniq('producer');

    runCLI(`generate @nx/js:lib ${consumerLib} --bundler=none`);
    runCLI(`generate @nx/js:lib ${producerLib} --bundler=none`);

    updateFile(
      `libs/${producerLib}/src/lib/${producerLib}.ts`,
      'export const a = 0;'
    );

    updateFile(
      `libs/${consumerLib}/src/lib/${consumerLib}.ts`,
      `
    import { a } from '@${scope}/${producerLib}';

    export function ${consumerLib}() {
      return a + 1;
    }`
    );
    updateFile(
      `libs/${consumerLib}/src/lib/${consumerLib}.spec.ts`,
      `
    import { ${consumerLib} } from './${consumerLib}';

    describe('', () => {
      it('should return 1', () => {
        expect(${consumerLib}()).toEqual(1);
      });
    });`
    );

    runCLI(`test ${consumerLib}`);
  });

  it('should be able to add build to non-buildable projects', () => {
    const nonBuildable = uniq('nonbuildable');

    runCLI(`generate @nx/js:lib ${nonBuildable} --bundler=none`);
    expect(() => runCLI(`build ${nonBuildable}`)).toThrow();
    checkFilesDoNotExist(`dist/libs/${nonBuildable}/src/index.js`);

    runCLI(`generate @nx/js:setup-build ${nonBuildable} --bundler=tsc`);
    runCLI(`build ${nonBuildable}`);
    checkFilesExist(`dist/libs/${nonBuildable}/src/index.js`);
  });
});
