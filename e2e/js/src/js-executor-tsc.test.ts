import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  createFile,
  detectPackageManager,
  getPackageManagerCommand,
  newProject,
  packageManagerLockFile,
  readFile,
  readJson,
  rmDist,
  runCLI,
  runCLIAsync,
  runCommand,
  runCommandUntil,
  tmpProjPath,
  uniq,
  updateFile,
  updateJson,
  waitUntil,
} from '../../utils';

describe('js:tsc executor', () => {
  let scope;
  beforeAll(() => (scope = newProject()));
  afterAll(() => cleanupProject());

  it('should not create a `.babelrc` file when creating libs with js executors (--compiler=tsc)', () => {
    const lib = uniq('lib');
    runCLI(
      `generate @nx/js:lib libs/${lib} --compiler=tsc --includeBabelRc=false --no-interactive`
    );

    checkFilesDoNotExist(`libs/${lib}/.babelrc`);
  });

  it('should allow wildcard ts path alias', async () => {
    const base = uniq('base');
    runCLI(`generate @nx/js:lib libs/${base} --bundler=tsc --no-interactive`);

    const lib = uniq('lib');
    runCLI(`generate @nx/js:lib libs/${lib} --bundler=tsc --no-interactive`);

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

  it('should update package.json with detected dependencies', async () => {
    const pmc = getPackageManagerCommand();
    const lib = uniq('lib');
    runCLI(`generate @nx/js:lib libs/${lib} --bundler=tsc --no-interactive`);

    // Add a dependency for this lib to check the built package.json
    runCommand(`${pmc.addProd} react`);
    runCommand(`${pmc.addDev} @types/react`);
    updateFile(`libs/${lib}/src/index.ts`, (content) => {
      return `
        import 'react';
        ${content};
    `;
    });
  }, 240_000);
});
