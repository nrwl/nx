import { ChildProcess } from 'child_process';
import {
  runCLI,
  cleanupProject,
  newProject,
  uniq,
  readJson,
  runCommandUntil,
  killProcessAndPorts,
  fileExists,
} from 'e2e/utils';

describe('@nx/react-native (legacy)', () => {
  let appName: string;

  beforeAll(() => {
    newProject();
    appName = uniq('app');
    runCLI(
      `generate @nx/react-native:app ${appName} --project-name-and-root-format=as-provided --install=false --no-interactive`,
      { env: { NX_ADD_PLUGINS: 'false' } }
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
});
