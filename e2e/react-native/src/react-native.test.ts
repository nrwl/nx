import { ChildProcess } from 'child_process';
import {
  runCLI,
  cleanupProject,
  newProject,
  uniq,
  runCommandUntil,
  killProcessAndPorts,
  fileExists,
  checkFilesExist,
  runE2ETests,
  updateFile,
} from 'e2e/utils';

describe('@nx/react-native', () => {
  let proj: string;
  let appName: string;
  let libName: string;
  let componentName: string;

  beforeAll(() => {
    proj = newProject();
    appName = uniq('app');
    runCLI(
      `generate @nx/react-native:app ${appName} --install=false --no-interactive --unitTestRunner=jest --linter=eslint`
    );
    libName = uniq('lib');
    runCLI(
      `generate @nx/react-native:lib ${libName} --buildable --no-interactive --unitTestRunner=jest --linter=eslint`
    );
    componentName = uniq('Component');
    runCLI(
      `generate @nx/react-native:component ${libName}/src/lib/${componentName}/${componentName} --export --no-interactive`
    );
    updateFile(`${appName}/src/app/App.tsx`, (content) => {
      let updated = `// eslint-disable-next-line @typescript-eslint/no-unused-vars\nimport {${componentName}} from '${proj}/${libName}';\n${content}`;
      return updated;
    });
  });

  afterAll(() => cleanupProject());

  it('should test and lint', async () => {
    expect(() => runCLI(`test ${appName}`)).not.toThrow();
    expect(() => runCLI(`lint ${appName}`)).not.toThrow();
  });

  it('should bundle the app', async () => {
    expect(() =>
      runCLI(
        `bundle ${appName} --platform=ios --bundle-output=dist.js --entry-file=src/main.tsx`
      )
    ).not.toThrow();
    fileExists(` ${appName}/dist.js`);
  }, 200_000);

  it('should start the app', async () => {
    let process: ChildProcess;
    const port = 8081;

    try {
      process = await runCommandUntil(
        `start ${appName} --no-interactive --port=${port}`,
        (output) => {
          return (
            output.includes(`http://localhost:${port}`) ||
            output.includes('Starting JS server...') ||
            output.includes('Welcome to Metro')
          );
        }
      );
    } catch (err) {
      console.error(err);
    }

    // port and process cleanup
    if (process && process.pid) {
      await killProcessAndPorts(process.pid, port);
    }
  });

  it('should serve', async () => {
    let process: ChildProcess;
    const port = 8081;

    try {
      process = await runCommandUntil(
        `serve ${appName} --port=${port}`,
        (output) => {
          return output.includes(`http://localhost:${port}`);
        }
      );
    } catch (err) {
      console.error(err);
    }

    // port and process cleanup
    try {
      if (process && process.pid) {
        await killProcessAndPorts(process.pid, port);
      }
    } catch (err) {
      expect(err).toBeFalsy();
    }
  });

  it('should run e2e for cypress', async () => {
    if (runE2ETests()) {
      expect(() => runCLI(`e2e ${appName}-e2e`)).not.toThrow();

      expect(() =>
        runCLI(`e2e ${appName}-e2e --configuration=ci`)
      ).not.toThrow();

      // port and process cleanup
      try {
        if (process && process.pid) {
          await killProcessAndPorts(process.pid, 4200);
        }
      } catch (err) {
        expect(err).toBeFalsy();
      }
    }
  });

  it('should create storybook with application', async () => {
    runCLI(
      `generate @nx/react:storybook-configuration ${appName} --generateStories --no-interactive`
    );
    checkFilesExist(
      `${appName}/.storybook/main.ts`,
      `${appName}/src/app/App.stories.tsx`
    );

    runCLI(`build-storybook ${appName}`);
    checkFilesExist(`${appName}/storybook-static/index.html`);
  });

  it('should build publishable library', async () => {
    expect(() => {
      runCLI(`build ${libName}`);
      checkFilesExist(
        `dist/${libName}/index.esm.js`,
        `dist/${libName}/src/index.d.ts`
      );
    }).not.toThrow();
  });

  it('should create storybook with library', async () => {
    runCLI(
      `generate @nx/react:storybook-configuration ${libName} --generateStories --no-interactive`
    );
    checkFilesExist(
      `${libName}/.storybook/main.ts`,
      `${libName}/src/lib/${componentName}/${componentName}.stories.tsx`
    );

    runCLI(`build-storybook ${libName}`);
    checkFilesExist(`${libName}/storybook-static/index.html`);
  });

  it('should run build with vite bundler and e2e with playwright', async () => {
    const appName2 = uniq('my-app');
    runCLI(
      `generate @nx/react:application ${appName2} --directory=apps/${appName2} --bundler=vite --e2eTestRunner=playwright --install=false --no-interactive --unitTestRunner=jest --linter=eslint`
    );
    expect(() => runCLI(`build ${appName2}`)).not.toThrow();
    if (runE2ETests()) {
      expect(() => runCLI(`e2e ${appName2}-e2e`)).not.toThrow();
      // port and process cleanup
      try {
        if (process && process.pid) {
          await killProcessAndPorts(process.pid, 4200);
        }
      } catch (err) {
        expect(err).toBeFalsy();
      }
    }

    runCLI(
      `generate @nx/react:storybook-configuration ${appName2} --generateStories --no-interactive`
    );
    checkFilesExist(
      `apps/${appName2}/.storybook/main.ts`,
      `apps/${appName2}/src/app/App.stories.tsx`
    );
    runCLI(`build-storybook ${appName2}`);
    checkFilesExist(`apps/${appName2}/storybook-static/index.html`);
  });
});
