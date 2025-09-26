import { checkFilesExist, runCLI, uniq, updateFile } from '@nx/e2e-utils';
import { names } from '@nx/devkit';

import { getProjName, setupAngularProjectsSuite } from './projects.setup';

describe('Angular Projects - publishable libs', () => {
  setupAngularProjectsSuite();

  it('should build publishable libs successfully', () => {
    const proj = getProjName();
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
});
