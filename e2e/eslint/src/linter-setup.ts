import { cleanupProject, newProject, runCLI, uniq } from '@nx/e2e-utils';

export interface LinterIntegratedTestContext {
  myapp: string;
  mylib: string;
  projScope: string;
}

export function setupLinterIntegratedTest(): LinterIntegratedTestContext {
  const myapp = uniq('myapp');
  const mylib = uniq('mylib');

  const projScope = newProject({
    packages: ['@nx/react', '@nx/js', '@nx/eslint'],
  });
  runCLI(
    `generate @nx/react:app apps/${myapp} --tags=validtag --linter eslint --unitTestRunner vitest`
  );
  runCLI(`generate @nx/js:lib libs/${mylib} --linter eslint`);

  return { myapp, mylib, projScope };
}

export function cleanupLinterIntegratedTest() {
  cleanupProject();
}

export interface LinterRootProjectsTestContext {}

export function setupLinterRootProjectsTest(): LinterRootProjectsTestContext {
  newProject({
    packages: ['@nx/react', '@nx/js', '@nx/angular', '@nx/node'],
  });
  return {};
}

export function cleanupLinterRootProjectsTest() {
  cleanupProject();
}
