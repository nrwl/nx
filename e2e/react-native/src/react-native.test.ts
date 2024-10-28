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
} from 'e2e/utils';

describe('@nx/react-native', () => {
  let appName: string;

  beforeAll(() => {
    newProject();
    appName = uniq('app');
    runCLI(
      `generate @nx/react-native:app ${appName} --install=false --no-interactive`
    );
  });

  afterAll(() => cleanupProject());

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
  });

  it('should run build with vite bundler and e2e with playwright', async () => {
    const appName2 = uniq('my-app');
    runCLI(
      `generate @nx/react-native:application ${appName2} --directory=apps/${appName2} --bundler=vite --e2eTestRunner=playwright --install=false --no-interactive`
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
      `generate @nx/react-native:storybook-configuration ${appName2} --generateStories --no-interactive`
    );
    checkFilesExist(
      `apps/${appName2}/.storybook/main.ts`,
      `apps/${appName2}/src/app/App.stories.tsx`
    );
  });
});
