import {
  cleanupProject,
  newProject,
  readFile,
  reservePort,
  runCLI,
  uniq,
  updateFile,
} from '@nx/e2e-utils';

export interface ProjectsTestSetup {
  proj: string;
  app1: string;
  app1Port: number;
  esbuildApp: string;
  lib1: string;
  app1DefaultModule: string;
  app1DefaultComponentTemplate: string;
  esbuildAppDefaultModule: string;
  esbuildAppDefaultComponentTemplate: string;
  esbuildAppDefaultProjectConfig: string;
}

export async function setupProjectsTest(): Promise<ProjectsTestSetup> {
  const proj = newProject({
    packages: [
      '@nx/angular',
      '@nx/webpack',
      '@nx/vitest',
      '@nx/playwright',
      '@nx/rspack',
    ],
  });
  const app1 = uniq('app1');
  // app1 gets an e2e run; pin its dev-server/e2e port to a reserved one so it
  // does not collide on the shared default 4200.
  const app1Port = await reservePort();
  const esbuildApp = uniq('esbuild-app');
  const lib1 = uniq('lib1');

  runCLI(
    `generate @nx/angular:app ${app1} --port=${app1Port} --no-standalone --bundler=webpack --no-interactive`
  );
  runCLI(
    `generate @nx/angular:app ${esbuildApp} --bundler=esbuild --no-standalone --no-interactive`
  );
  runCLI(`generate @nx/angular:lib ${lib1} --no-interactive`);

  const app1DefaultModule = readFile(`${app1}/src/app/app-module.ts`);
  const app1DefaultComponentTemplate = readFile(`${app1}/src/app/app.html`);
  const esbuildAppDefaultModule = readFile(
    `${esbuildApp}/src/app/app-module.ts`
  );
  const esbuildAppDefaultComponentTemplate = readFile(
    `${esbuildApp}/src/app/app.html`
  );
  const esbuildAppDefaultProjectConfig = readFile(`${esbuildApp}/project.json`);

  return {
    proj,
    app1,
    app1Port,
    esbuildApp,
    lib1,
    app1DefaultModule,
    app1DefaultComponentTemplate,
    esbuildAppDefaultModule,
    esbuildAppDefaultComponentTemplate,
    esbuildAppDefaultProjectConfig,
  };
}

export function resetProjectsTest(setup: ProjectsTestSetup): void {
  updateFile(`${setup.app1}/src/app/app-module.ts`, setup.app1DefaultModule);
  updateFile(
    `${setup.app1}/src/app/app.html`,
    setup.app1DefaultComponentTemplate
  );
  updateFile(
    `${setup.esbuildApp}/src/app/app-module.ts`,
    setup.esbuildAppDefaultModule
  );
  updateFile(
    `${setup.esbuildApp}/src/app/app.html`,
    setup.esbuildAppDefaultComponentTemplate
  );
  updateFile(
    `${setup.esbuildApp}/project.json`,
    setup.esbuildAppDefaultProjectConfig
  );
}

export function cleanupProjectsTest(): void {
  cleanupProject();
}
