import { names } from '@nx/devkit';
import {
  checkFilesExist,
  cleanupProject,
  newProject,
  runCLI,
  uniq,
  updateFile,
} from '@nx/e2e-utils';

describe('Angular Projects - publishable and scoped', () => {
  beforeAll(() => newProject({ packages: ['@nx/angular'] }));
  afterAll(() => cleanupProject());

  it('should build publishable libs successfully', () => {
    const proj = 'proj';
    const lib = uniq('lib');
    const childLib = uniq('child');
    const entryPoint = uniq('entrypoint');

    runCLI(
      `generate @nx/angular:lib ${lib} --publishable --importPath=@${proj}/${lib} --no-standalone --no-interactive`
    );
    runCLI(
      `generate @nx/angular:secondary-entry-point --name=${entryPoint} --library=${lib} --no-interactive`
    );

    runCLI(
      `generate @nx/angular:library ${childLib} --publishable=true --importPath=@${proj}/${childLib} --no-standalone --no-interactive`
    );
    runCLI(
      `generate @nx/angular:secondary-entry-point --name=sub --library=${childLib} --no-interactive`
    );

    const moduleContent = `
    import { NgModule } from '@angular/core';
    import { CommonModule } from '@angular/common';
          import { ${
            names(childLib).className
          }Module } from '@${proj}/${childLib}';
    import { SubModule } from '@${proj}/${childLib}/sub';
    @NgModule({
      imports: [CommonModule, ${names(childLib).className}Module, SubModule]
    })
    export class ${names(lib).className}Module {}`;

    updateFile(`${lib}/src/lib/${lib}-module.ts`, moduleContent);

    const buildOutput = runCLI(`build ${lib}`, { env: { CI: 'false' } });

    expect(buildOutput).toContain(`Building entry point '@${proj}/${lib}'`);
    expect(buildOutput).toContain(
      `Building entry point '@${proj}/${lib}/${entryPoint}'`
    );
    expect(buildOutput).toContain('Successfully ran target build');

    expect(() => runCLI(`lint ${lib} --fix`)).not.toThrow();
    expect(() => runCLI(`lint ${childLib} --fix`)).not.toThrow();
  });

  it('should support generating libraries with a scoped name when', () => {
    const libName = uniq('@my-org/lib1');

    runCLI(`generate @nx/angular:lib ${libName} --buildable --standalone`);

    checkFilesExist(
      `${libName}/src/index.ts`,
      `${libName}/src/lib/${libName.split('/')[1]}/${libName.split('/')[1]}.ts`
    );
    expect(() => runCLI(`build ${libName}`)).not.toThrow();
    expect(() => runCLI(`test ${libName}`)).not.toThrow();
  }, 500_000);
});
