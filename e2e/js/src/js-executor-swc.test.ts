import { satisfies } from 'semver';
import { execSync } from 'child_process';
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

describe('js:swc executor', () => {
  let scope: string;

  beforeAll(() => {
    scope = newProject();
  });

  afterAll(() => {
    cleanupProject();
  });

  it('should create libs with js executors (--bundler=swc)', async () => {
    const lib = uniq('lib');
    runCLI(`generate @nx/js:lib ${lib} --bundler=swc --no-interactive`);

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

    const tsconfig = readJson(`tsconfig.base.json`);
    expect(tsconfig.compilerOptions.paths).toEqual({
      [`@${scope}/${lib}`]: [`libs/${lib}/src/index.ts`],
    });

    // Legacy behavior (updateBuildableProjectDepsInPackageJson): add @swc/helpers if externalHelpers is true
    // TODO(v17):  Remove this test
    updateJson(`libs/${lib}/package.json`, (json) => {
      delete json.dependencies['@swc/helpers'];
      return json;
    });
    runCLI(
      `build ${lib} --generateLockfile=true --updateBuildableProjectDepsInPackageJson`
    );
    checkFilesExist(
      `dist/libs/${lib}/package.json`,
      `dist/libs/${lib}/${
        packageManagerLockFile[detectPackageManager(tmpProjPath())]
      }`
    );
    expect(
      satisfies(
        readJson(`dist/libs/${lib}/package.json`).peerDependencies[
          '@swc/helpers'
        ],
        readJson(`package.json`).dependencies['@swc/helpers']
      )
    ).toBeTruthy();

    // Legacy behavior (updateBuildableProjectDepsInPackageJson): don't add @swc/helpers if externalHelpers is false
    // TODO(v17):  Remove this test
    updateJson(`libs/${lib}/.swcrc`, (json) => {
      json.jsc.externalHelpers = false;
      return json;
    });

    runCLI(`build ${lib}`);

    expect(readJson(`dist/libs/${lib}/package.json`)).not.toHaveProperty(
      'peerDependencies.@swc/helpers'
    );
  }, 240_000);

  it('should handle swcrc path mappings', async () => {
    const lib = uniq('lib');
    runCLI(`generate @nx/js:lib ${lib} --bundler=swc --no-interactive`);

    // add a dummy x.ts file for path mappings
    updateFile(
      `libs/${lib}/src/x.ts`,
      `
export function x() {
  console.log('x');
}
    `
    );

    // update .swcrc to use path mappings
    updateJson(`libs/${lib}/.swcrc`, (json) => {
      json.jsc.baseUrl = '.';
      json.jsc.paths = {
        '~/*': ['./src/*'],
      };
      return json;
    });

    // update lib.ts to use x
    updateFile(`libs/${lib}/src/lib/${lib}.ts`, () => {
      return `
// @ts-ignore
import { x } from '~/x';

export function myLib() {
  console.log(x());
}

myLib();
  `;
    });

    // now run build without type checking (since we're using path mappings not in tsconfig)
    runCLI(`build ${lib} --skipTypeCheck`);

    // invoke the lib with node
    const result = execSync(`node dist/libs/${lib}/src/lib/${lib}.js`, {
      cwd: tmpProjPath(),
    }).toString();
    expect(result).toContain('x');
  }, 240_000);
});
