import { satisfies } from 'semver';
import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  detectPackageManager,
  newProject,
  packageManagerLockFile,
  readJson,
  runCLI,
  runCLIAsync,
  tmpProjPath,
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

  it('should create libs with js executors (--compiler=swc)', async () => {
    const lib = uniq('lib');
    runCLI(
      `generate @nrwl/js:lib ${lib} --buildable --compiler=swc --no-interactive`
    );
    const libPackageJson = readJson(`libs/${lib}/package.json`);
    expect(libPackageJson.scripts).toBeUndefined();

    expect(runCLI(`build ${lib}`)).toContain(
      'Successfully compiled: 2 files with swc'
    );
    checkFilesExist(
      `dist/libs/${lib}/package.json`,
      `dist/libs/${lib}/src/index.js`,
      `dist/libs/${lib}/src/lib/${lib}.js`,
      `dist/libs/${lib}/src/index.d.ts`,
      `dist/libs/${lib}/src/lib/${lib}.d.ts`
    );

    checkFilesDoNotExist(`libs/${lib}/.babelrc`);

    const parentLib = uniq('parentlib');
    runCLI(
      `generate @nrwl/js:lib ${parentLib} --buildable --compiler=swc --no-interactive`
    );
    const parentLibPackageJson = readJson(`libs/${parentLib}/package.json`);
    expect(parentLibPackageJson.scripts).toBeUndefined();
    expect((await runCLIAsync(`test ${parentLib}`)).combinedOutput).toContain(
      'Ran all test suites'
    );

    expect(runCLI(`build ${parentLib}`)).toContain(
      'Successfully compiled: 2 files with swc'
    );
    checkFilesExist(
      `dist/libs/${parentLib}/package.json`,
      `dist/libs/${parentLib}/src/index.js`,
      `dist/libs/${parentLib}/src/lib/${parentLib}.js`,
      `dist/libs/${parentLib}/src/index.d.ts`,
      `dist/libs/${parentLib}/src/lib/${parentLib}.d.ts`
    );

    const tsconfig = readJson(`tsconfig.base.json`);
    expect(tsconfig.compilerOptions.paths).toEqual({
      [`@${scope}/${lib}`]: [`libs/${lib}/src/index.ts`],
      [`@${scope}/${parentLib}`]: [`libs/${parentLib}/src/index.ts`],
    });

    updateFile(`libs/${parentLib}/src/index.ts`, () => {
      return `
        import { ${lib} } from '@${scope}/${lib}';
        export * from './lib/${parentLib}';
      `;
    });

    const output = runCLI(`build ${parentLib}`);
    expect(output).toContain('1 task it depends on');
    expect(output).toContain('Successfully compiled: 2 files with swc');

    runCLI(`build ${parentLib} --generateLockfile=true`);
    checkFilesExist(
      `dist/libs/${parentLib}/package.json`,
      `dist/libs/${parentLib}/${
        packageManagerLockFile[detectPackageManager(tmpProjPath())]
      }`
    );

    updateJson(`libs/${lib}/.lib.swcrc`, (json) => {
      json.jsc.externalHelpers = true;
      return json;
    });

    runCLI(`build ${lib}`);

    const swcHelpersFromRoot =
      readJson(`package.json`).dependencies['@swc/helpers'];
    const swcHelpersFromDist = readJson(`dist/libs/${lib}/package.json`)
      .peerDependencies['@swc/helpers'];

    expect(swcHelpersFromDist).toEqual(swcHelpersFromRoot);

    updateJson(`libs/${lib}/.lib.swcrc`, (json) => {
      json.jsc.externalHelpers = false;
      return json;
    });

    runCLI(`build ${lib}`);

    expect(readJson(`dist/libs/${lib}/package.json`)).not.toHaveProperty(
      'peerDependencies.@swc/helpers'
    );
  }, 240_000);
});
