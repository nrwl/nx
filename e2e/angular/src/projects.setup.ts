import {
  cleanupProject,
  newProject,
  readFile,
  runCLI,
  uniq,
  updateFile,
} from '@nx/e2e-utils';

let projName: string;

export const app1 = uniq('app1');
export const esbuildApp = uniq('esbuild-app');
export const lib1 = uniq('lib1');

let app1DefaultModule: string;
let app1DefaultComponentTemplate: string;
let esbuildAppDefaultModule: string;
let esbuildAppDefaultComponentTemplate: string;
let esbuildAppDefaultProjectConfig: string;

export function getProjName() {
  return projName;
}

export function setupAngularProjectsSuite() {
  beforeAll(() => {
    projName = newProject({ packages: ['@nx/angular'] });
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
