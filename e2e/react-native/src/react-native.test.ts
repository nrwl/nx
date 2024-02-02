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
      `generate @nx/react-native:app ${appName} --project-name-and-root-format=as-provided --install=false --no-interactive`
    );
  });

  afterAll(() => cleanupProject());

  it('should bundle the app', async () => {
    const result = runCLI(
      `bundle ${appName} --platform=ios --bundle-output=dist.js --entry-file=src/main.tsx`
    );
    fileExists(` ${appName}/dist.js`);

    expect(result).toContain(
      `Successfully ran target bundle for project ${appName}`
    );
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
        `serve ${appName} --interactive=false --port=${port}`,
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
      let results = runCLI(`e2e ${appName}-e2e`);
      expect(results).toContain('Successfully ran target e2e');

      results = runCLI(`e2e ${appName}-e2e --configuration=ci`);
      expect(results).toContain('Successfully ran target e2e');
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
});
