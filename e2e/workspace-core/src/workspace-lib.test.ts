import {
  checkFilesExist,
  newProject,
  readJson,
  removeProject,
  runCLI,
  runCLIAsync,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';

let proj: string;

beforeAll(() => {
  proj = newProject();
});

afterAll(() => removeProject({ onlyOnCI: true }));

describe('@nrwl/workspace:library', () => {
  it('should be able to be created', () => {
    const libName = uniq('mylib');
    const dirName = uniq('dir');

    runCLI(`generate @nrwl/workspace:lib ${libName} --directory ${dirName}`);

    checkFilesExist(
      `libs/${dirName}/${libName}/src/index.ts`,
      `libs/${dirName}/${libName}/README.md`
    );
  });

  describe('linting', () => {
    it('should support eslint', () => {
      const libName = uniq('mylib');

      runCLI(`generate @nrwl/workspace:lib ${libName}`);

      const result = runCLI(`lint ${libName}`);

      expect(result).toContain(`Linting "${libName}"...`);
      expect(result).toContain('All files pass linting.');
    });

    it('should support tslint', () => {
      const libName = uniq('mylib');

      runCLI(`generate @nrwl/workspace:lib ${libName} --linter tslint`);

      const result = runCLI(`lint ${libName}`);

      expect(result).toContain(`Linting "${libName}"...`);
      expect(result).toContain('All files pass linting.');
    });
  });

  describe('unit testing', () => {
    it('should support jest', async () => {
      const libName = uniq('mylib');

      runCLI(`generate @nrwl/workspace:lib ${libName} --linter tslint`);

      const { stderr: result } = await runCLIAsync(`test ${libName}`);

      expect(result).toContain(`Test Suites: 1 passed, 1 total`);
      expect(result).toContain('Tests:       1 passed, 1 total');
    });
  });

  it('should be able to use and be used by other libs', () => {
    const consumerLib = uniq('consumer');
    const producerLib = uniq('producer');

    runCLI(`generate @nrwl/workspace:lib ${consumerLib}`);
    runCLI(`generate @nrwl/workspace:lib ${producerLib}`);

    updateFile(
      `libs/${producerLib}/src/lib/${producerLib}.ts`,
      'export const a = 0;'
    );

    updateFile(
      `libs/${consumerLib}/src/lib/${consumerLib}.ts`,
      `
    import { a } from '@${proj}/${producerLib}';

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

  it('should be able to be built when it is buildable', () => {
    const buildableLib = uniq('buildable');

    runCLI(`generate @nrwl/workspace:lib ${buildableLib} --buildable`);

    const result = runCLI(`build ${buildableLib}`);

    expect(result).toContain(
      `Compiling TypeScript files for project "${buildableLib}"...`
    );
    expect(result).toContain(
      `Done compiling TypeScript files for project "${buildableLib}".`
    );
    expect(result).toContain('Copying asset files...');
    expect(result).toContain('Done copying asset files.');

    const json = readJson(`dist/libs/${buildableLib}/package.json`);
    expect(json.main).toEqual('./src/index.js');
    expect(json.typings).toEqual('./src/index.d.ts');
  });
});

describe('@nrwl/workspace:npm-package', () => {
  it('should create a minimal npm package', () => {
    const npmPackage = uniq('npm-package');

    runCLI(`generate @nrwl/workspace:npm-package ${npmPackage}`);

    const result = runCLI(`test ${npmPackage}`);
    expect(result).toContain('Hello World');
  });
});
