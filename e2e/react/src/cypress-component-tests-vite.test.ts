import {
  cleanupProject,
  runCLI,
  runE2ETests,
  uniq,
  updateFile,
} from '@nx/e2e-utils';
import { setupCypressComponentTests } from './cypress-component-tests-setup';

describe('React Cypress Component Tests - vite', () => {
  let projectName;
  let appName;
  let usedInAppLibName;

  beforeAll(async () => {
    const setup = setupCypressComponentTests();
    projectName = setup.projectName;
    appName = setup.appName;
    usedInAppLibName = setup.usedInAppLibName;
  });

  afterAll(() => {
    cleanupProject();
    delete process.env.NX_ADD_PLUGINS;
  });

  // flaky bc of upstream issue https://github.com/cypress-io/cypress/issues/25913
  it.skip('should CT vite projects importing other projects', () => {
    const viteLibName = uniq('vite-lib');
    runCLI(
      `generate @nx/react:lib ${viteLibName} --bundler=vite --no-interactive`
    );

    updateFile(`libs/${viteLibName}/src/lib/${viteLibName}.tsx`, () => {
      return `import { Btn } from '@${projectName}/${usedInAppLibName}';

export function MyComponent() {
  return (
    <>
      <Btn text={'I am the app'}/>
      <p>hello</p>
    </>
  );
}
export default MyComponent;`;
    });

    runCLI(
      `generate @nx/react:cypress-component-configuration --project=${viteLibName} --generate-tests --bundler=vite --build-target=${appName}:build`
    );
    if (runE2ETests()) {
      expect(runCLI(`component-test ${viteLibName}`)).toContain(
        'All specs passed!'
      );
    }
  });
});
