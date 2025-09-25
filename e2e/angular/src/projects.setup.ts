import {
  cleanupProject,
  newProject,
  readFile,
  runCLI,
  uniq,
  updateFile,
} from '@nx/e2e-utils';

export let proj: string;
export let app1: string;
export let esbuildApp: string;
export let lib1: string;
export let app1DefaultModule: string;
export let app1DefaultComponentTemplate: string;
export let esbuildAppDefaultModule: string;
export let esbuildAppDefaultComponentTemplate: string;
export let esbuildAppDefaultProjectConfig: string;

export function registerAngularProjectsSetup() {
  beforeAll(() => {
    proj = newProject({ packages: ['@nx/angular'] });
    app1 = uniq('app1');
    esbuildApp = uniq('esbuild-app');
    lib1 = uniq('lib1');

    runCLI(
      `generate @nx/angular:app ${app1} --no-standalone --bundler=webpack --no-interactive`
    );
    runCLI(
      `generate @nx/angular:app ${esbuildApp} --bundler=esbuild --no-standalone --no-interactive`
    );
    runCLI(`generate @nx/angular:lib ${lib1} --no-interactive`);

    app1DefaultModule = readFile(`${app1}/src/app/app-module.ts`);
    app1DefaultComponentTemplate = readFile(`${app1}/src/app/app.html`);
    esbuildAppDefaultModule = readFile(`${esbuildApp}/src/app/app-module.ts`);
    esbuildAppDefaultComponentTemplate = readFile(
      `${esbuildApp}/src/app/app.html`
    );
    esbuildAppDefaultProjectConfig = readFile(`${esbuildApp}/project.json`);
  });

  afterEach(() => {
    updateFile(`${app1}/src/app/app-module.ts`, app1DefaultModule);
    updateFile(`${app1}/src/app/app.html`, app1DefaultComponentTemplate);
    updateFile(`${esbuildApp}/src/app/app-module.ts`, esbuildAppDefaultModule);
    updateFile(
      `${esbuildApp}/src/app/app.html`,
      esbuildAppDefaultComponentTemplate
    );
    updateFile(`${esbuildApp}/project.json`, esbuildAppDefaultProjectConfig);
  });

  afterAll(() => cleanupProject());
}
